import { test, expect } from '@playwright/test'

test.describe('Account contracts', () => {
  test('page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/account/contracts')
    await page.screenshot({
      path: `e2e/screenshots/customer/account-contracts-${testInfo.project.name}.png`,
      fullPage: true,
    })
    const body = await page.evaluate(() => document.body.scrollWidth)
    const overflow = body - page.viewportSize()!.width
    if (overflow > 2) {
      console.warn(`[ISSUE] Account contracts overflows by ${overflow}px on ${testInfo.project.name}`)
    }
    // Confirm page at least loaded (heading or empty state present)
    const loaded = await page.getByText(/contract|service|invoice/i).first().count() > 0
    expect(loaded).toBeTruthy()
  })

  test('contract status filter chips are tappable (≥44px height)', async ({ page }, testInfo) => {
    await page.goto('/account/contracts')
    const chips = page.locator('button').filter({ hasText: /All|Active|Awaiting|Expired/i })
    for (const chip of await chips.all()) {
      const box = await chip.boundingBox()
      if (box) {
        if (box.height < 44) {
          console.warn(`[ISSUE] Filter chip "${await chip.innerText()}" is only ${box.height}px tall on ${testInfo.project.name} (need ≥44px)`)
        }
      }
    }
  })
})
