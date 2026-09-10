import { test, expect } from '@playwright/test'

test.describe('Admin hard delete', () => {
  test('bulk-select and delete bookings', async ({ page }) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: 'All' }).click()

    const firstCheckbox = page.locator('[data-slot="checkbox"]').first()
    await firstCheckbox.click()

    await expect(page.getByRole('button', { name: /Delete \d+ Selected/ })).toBeVisible()
    await page.getByRole('button', { name: /Delete \d+ Selected/ }).click()

    await expect(page.getByRole('button', { name: /Delete (\d+ )?Items?/ })).toBeVisible()
    await page.getByRole('button', { name: /Delete (\d+ )?Items?/ }).click()

    await expect(page.getByRole('button', { name: /Delete \d+ Selected/ })).not.toBeVisible()
  })

  test('delete a single invoice via the row trash icon', async ({ page }) => {
    await page.goto('/admin/invoices')
    const rowCountBefore = await page.locator('table tbody tr').count()
    if (rowCountBefore === 0) test.skip()

    // InvoiceRow (desktop table) and MobileInvoiceCard share the same
    // aria-label; only one is visible per viewport, so scope to :visible
    // rather than relying on DOM order.
    await page.locator('button[aria-label^="Delete invoice"]:visible').first().click()
    await page.getByRole('button', { name: 'Delete Item' }).click()

    await expect(page.locator('table tbody tr')).toHaveCount(rowCountBefore - 1)
  })
})
