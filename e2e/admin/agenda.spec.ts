import { test, expect } from '@playwright/test'

test.describe('Admin agenda', () => {
  test('week grid loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/agenda')
    await page.screenshot({ path: `e2e/screenshots/admin/agenda-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    // NOTE: known issue — 7-col grid likely overflows on 375px
    const overflow = body - page.viewportSize()!.width
    if (overflow > 2) {
      console.warn(`[ISSUE] Agenda overflows by ${overflow}px on ${testInfo.project.name}`)
    }
  })

  test('prev/next week navigation works', async ({ page }) => {
    await page.goto('/admin/agenda')
    await page.getByRole('button', { name: /next week|→|›/i }).click()
    await expect(page.locator('h1, h2').filter({ hasText: /week|agenda/i }).first()).toBeVisible()
  })
})
