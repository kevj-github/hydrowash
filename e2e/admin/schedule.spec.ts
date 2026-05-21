import { test, expect } from '@playwright/test'

test.describe('Admin schedule (route optimiser)', () => {
  test('date redirect works', async ({ page }, testInfo) => {
    const today = new Date().toISOString().slice(0, 10)
    await page.goto(`/admin/schedule/${today}`)
    await page.screenshot({ path: `e2e/screenshots/admin/schedule-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
