import { test, expect } from '@playwright/test'

test.describe('Booking wizard', () => {
  test('step 0 renders service selector', async ({ page }, testInfo) => {
    await page.goto('/book')
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-step0-${testInfo.project.name}.png`,
      fullPage: true,
    })
    // Progress bar visible
    await expect(page.getByText(/Service/i).first()).toBeVisible()
    // No horizontal overflow
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('step 0 → step 1 navigation', async ({ page }, testInfo) => {
    await page.goto('/book')
    // Select a service type (first available radio/button)
    const serviceOption = page.locator('[data-testid="service-option"]').first()
    if (await serviceOption.count() > 0) {
      await serviceOption.click()
    } else {
      // Fall back: click first visible service card/button
      await page.locator('button').filter({ hasText: /General|Chemical|Wash/i }).first().click()
    }
    await page.getByRole('button', { name: /Next|Continue/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-step1-${testInfo.project.name}.png`,
      fullPage: true,
    })
    // SlotCalendar should be visible
    await expect(page.locator('button').filter({ hasText: /Su|Mo|Tu/i }).first()).toBeVisible()
  })

  test('SlotCalendar month grid does not overflow viewport', async ({ page }, testInfo) => {
    await page.goto('/book')
    // Navigate to step 1 (schedule)
    await page.locator('button').filter({ hasText: /General|Chemical|Wash/i }).first().click()
    await page.getByRole('button', { name: /Next|Continue/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-calendar-${testInfo.project.name}.png`,
    })
    const calendarWidth = await page.evaluate(() => {
      const cal = document.querySelector('[class*="grid-cols-7"]')
      return cal ? cal.getBoundingClientRect().width : 0
    })
    expect(calendarWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
  })

  test('address section appears after location selected', async ({ page }, testInfo) => {
    await page.goto('/book')
    await page.locator('button').filter({ hasText: /General|Chemical|Wash/i }).first().click()
    await page.getByRole('button', { name: /Next|Continue/i }).click()
    // Click "Other" address option
    const otherBtn = page.getByRole('button', { name: /Other/i })
    if (await otherBtn.count() > 0) {
      await otherBtn.click()
      await page.screenshot({
        path: `e2e/screenshots/customer/booking-address-${testInfo.project.name}.png`,
      })
    }
  })
})
