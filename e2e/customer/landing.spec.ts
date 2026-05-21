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
    await expect(page.getByRole('link', { name: /Book a Service|Book Now/i }).first()).toBeVisible()
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
    // MobileNav panel should be visible (nav element with Sign In link appears in the panel)
    const mobilePanel = page.locator('[data-mobile-nav], nav[class*="mobile"], [class*="MobileNav"]').first()
    const panelVisible = await mobilePanel.count() > 0
    if (!panelVisible) {
      // Fallback: just check close button is there
      await expect(page.getByRole('button', { name: /close menu/i })).toBeVisible()
    }
    await page.getByRole('button', { name: /close menu/i }).click()
    // Close button should disappear
    await expect(page.getByRole('button', { name: /close menu/i })).not.toBeVisible()
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
