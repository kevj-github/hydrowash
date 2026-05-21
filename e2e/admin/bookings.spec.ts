import { test, expect } from '@playwright/test'

test.describe('Admin bookings', () => {
  test('loads and map renders (or card list on mobile)', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.waitForTimeout(2000) // wait for map script
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-maintenance-${testInfo.project.name}.png`,
      fullPage: true,
    })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('fault repair tab renders', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: /Fault Repair/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-fault-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })

  test('installation tab renders', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: /Installation/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-install-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })

  test('all tab renders', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: /^All$/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-all-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })
})
