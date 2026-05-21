import { test, expect } from '@playwright/test'

test.describe('Admin overview', () => {
  test('loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin')
    await page.screenshot({
      path: `e2e/screenshots/admin/overview-${testInfo.project.name}.png`,
      fullPage: true,
    })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('stat cards visible', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })
})
