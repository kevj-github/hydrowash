import { test, expect } from '@playwright/test'

// Landing is public — override to use no auth
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Landing page', () => {
  test('hero and CTA visible at mobile', async ({ page }, testInfo) => {
    await page.goto('/')
    await page.screenshot({
      path: `e2e/screenshots/customer/landing-load-${testInfo.project.name}.png`,
      fullPage: true,
    })
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Book Now/i }).first()).toBeVisible()
  })

  test('MobileNav hamburger opens and closes', async ({ page }, testInfo) => {
    await page.goto('/')
    const hamburger = page.getByRole('button', { name: /open menu/i })
    // Only present on mobile — skip on tablet
    if (await hamburger.count() === 0) return
    await hamburger.click()
    await page.screenshot({
      path: `e2e/screenshots/customer/landing-nav-open-${testInfo.project.name}.png`,
    })
    await expect(page.getByRole('link', { name: /Sign In/i })).toBeVisible()
    await page.getByRole('button', { name: /close menu/i }).click()
    await expect(page.getByRole('link', { name: /Sign In/i })).not.toBeVisible()
  })

  test('service cards render without overflow', async ({ page }, testInfo) => {
    await page.goto('/')
    const body = await page.evaluate(() => document.body.scrollWidth)
    const viewport = page.viewportSize()!.width
    expect(body).toBeLessThanOrEqual(viewport + 2) // ≤2px tolerance
    await page.screenshot({
      path: `e2e/screenshots/customer/landing-services-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })
})
