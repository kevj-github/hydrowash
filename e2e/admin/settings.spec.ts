import { test, expect } from '@playwright/test'

test.describe('Admin settings', () => {
  test('page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/settings')
    await page.screenshot({ path: `e2e/screenshots/admin/settings-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
