import { test, expect } from '@playwright/test'

test.describe('Account bookings', () => {
  test('page loads and shows bookings or empty state', async ({ page }, testInfo) => {
    await page.goto('/account/bookings')
    await page.screenshot({
      path: `e2e/screenshots/customer/account-bookings-${testInfo.project.name}.png`,
      fullPage: true,
    })
    // Either bookings list or empty state
    const hasBookings = await page.locator('[class*="border-l-4"]').count() > 0
    const hasEmpty = await page.getByText(/No bookings yet|no upcoming/i).count() > 0
    expect(hasBookings || hasEmpty).toBeTruthy()
    // No horizontal overflow
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('reschedule dialog opens without overflow', async ({ page }, testInfo) => {
    await page.goto('/account/bookings')
    const rescheduleBtn = page.getByRole('button', { name: /Reschedule/i }).first()
    if (await rescheduleBtn.count() === 0) return // skip if no reschedulable bookings
    await rescheduleBtn.click()
    await page.screenshot({
      path: `e2e/screenshots/customer/reschedule-dialog-${testInfo.project.name}.png`,
    })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const dialogBox = await dialog.boundingBox()
    const viewport = page.viewportSize()!
    if (dialogBox) {
      expect(dialogBox.height).toBeLessThanOrEqual(viewport.height)
    }
  })

  test('cancel dialog opens', async ({ page }, testInfo) => {
    await page.goto('/account/bookings')
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first()
    if (await cancelBtn.count() === 0) return
    await cancelBtn.click()
    await page.screenshot({
      path: `e2e/screenshots/customer/cancel-dialog-${testInfo.project.name}.png`,
    })
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
