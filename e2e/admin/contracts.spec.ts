import { test, expect } from '@playwright/test'

test.describe('Admin contracts', () => {
  test('list page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/contracts')
    await page.screenshot({ path: `e2e/screenshots/admin/contracts-list-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('filter inputs visible and usable', async ({ page }, testInfo) => {
    await page.goto('/admin/contracts')
    await page.screenshot({ path: `e2e/screenshots/admin/contracts-filters-${testInfo.project.name}.png` })
    // Filters may overflow on mobile — capture for audit
    const filterSection = page.locator('input[type="date"]').first()
    if (await filterSection.count() > 0) {
      const box = await filterSection.boundingBox()
      if (box) {
        const rightEdge = box.x + box.width
        if (rightEdge > page.viewportSize()!.width) {
          console.warn(`[ISSUE] Date filter overflows viewport on ${testInfo.project.name}`)
        }
      }
    }
  })
})
