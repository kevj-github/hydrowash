import { test, expect } from '@playwright/test'

test.describe('Admin invoices', () => {
  test('list page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/invoices')
    await page.screenshot({ path: `e2e/screenshots/admin/invoices-list-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
