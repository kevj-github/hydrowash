import { test, expect } from '@playwright/test'

test.describe('Admin customers', () => {
  test('list page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/customers')
    await page.screenshot({ path: `e2e/screenshots/admin/customers-list-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('customer detail page loads', async ({ page }, testInfo) => {
    await page.goto('/admin/customers')
    const viewLink = page.getByRole('link', { name: /View/i }).first()
    if (await viewLink.count() === 0) return
    await viewLink.click()
    await page.screenshot({ path: `e2e/screenshots/admin/customer-detail-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
