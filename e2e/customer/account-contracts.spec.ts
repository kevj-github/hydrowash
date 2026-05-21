import { test, expect } from '@playwright/test'

test.describe('Account contracts', () => {
  test('page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/account/contracts')
    await page.screenshot({
      path: `e2e/screenshots/customer/account-contracts-${testInfo.project.name}.png`,
      fullPage: true,
    })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('contract status filter chips are tappable (≥44px height)', async ({ page }) => {
    await page.goto('/account/contracts')
    const chips = page.locator('button').filter({ hasText: /All|Active|Awaiting|Expired/i })
    for (const chip of await chips.all()) {
      const box = await chip.boundingBox()
      if (box) expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })
})
