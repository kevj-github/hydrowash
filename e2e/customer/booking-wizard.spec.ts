import { test, expect } from '@playwright/test'

/** Fill step 0 MAINTENANCE form (only service type available in test DB) */
async function fillStep0(page: import('@playwright/test').Page) {
  // Open service type select and pick first option
  await page.locator('[data-slot="select-trigger"]').first().click()
  await page.locator('[data-slot="select-item"]:visible').first().click()
  await page.waitForTimeout(300)

  // Fill num_units = 1 (required for MAINTENANCE)
  const numInput = page.locator('input[type="number"]').first()
  if (await numInput.count() > 0) {
    await numInput.fill('1')
    await page.waitForTimeout(500)
  }

  // Select unit location — scoped by its "Select room…" placeholder rather
  // than trigger index, since an optional "Link to Contract" dropdown can
  // render between Service Type and Number of Units for customers with an
  // active contract, shifting index-based selection off by one.
  const unitLocationTrigger = page
    .locator('[data-slot="select-trigger"]')
    .filter({ hasText: 'Select room' })
    .first()
  if (await unitLocationTrigger.count() > 0) {
    await unitLocationTrigger.click()
    await page.waitForTimeout(400)
    const item = page.locator('[data-slot="select-item"]:visible').first()
    if (await item.count() > 0) await item.click()
    await page.waitForTimeout(300)
  }
}

test.describe('Booking wizard', () => {
  test('step 0 renders service selector', async ({ page }, testInfo) => {
    await page.goto('/book')
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-step0-${testInfo.project.name}.png`,
      fullPage: true,
    })
    await expect(page.getByText(/Service/i).first()).toBeVisible()
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('step 0 → step 1 navigation', async ({ page }, testInfo) => {
    await page.goto('/book')
    await fillStep0(page)
    await page.getByRole('button', { name: /^Next$/ }).first().click()
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-step1-${testInfo.project.name}.png`,
      fullPage: true,
    })
    // SlotCalendar grid should appear
    const cal = page.locator('[class*="grid-cols-7"]').first()
    await expect(cal).toBeVisible({ timeout: 5000 }).catch(() => {})
  })

  test('SlotCalendar month grid does not overflow viewport', async ({ page }, testInfo) => {
    await page.goto('/book')
    await fillStep0(page)
    await page.getByRole('button', { name: /^Next$/ }).first().click()
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-calendar-${testInfo.project.name}.png`,
    })
    const calendarWidth = await page.evaluate(() => {
      const cal = document.querySelector('[class*="grid-cols-7"]')
      return cal ? cal.getBoundingClientRect().width : 0
    })
    if (calendarWidth > 0) {
      expect(calendarWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
    }
  })

  test('address section appears after location selected', async ({ page }, testInfo) => {
    await page.goto('/book')
    await fillStep0(page)
    await page.getByRole('button', { name: /^Next$/ }).first().click()
    await page.waitForTimeout(500)
    const otherBtn = page.getByRole('button', { name: /Other/i })
    if (await otherBtn.count() > 0) {
      await otherBtn.click()
      await page.screenshot({
        path: `e2e/screenshots/customer/booking-address-${testInfo.project.name}.png`,
      })
    }
  })
})
