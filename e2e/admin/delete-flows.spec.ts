import { test, expect } from '@playwright/test'

test.describe('Admin hard delete', () => {
  test('bulk-select and delete bookings', async ({ page }) => {
    await page.goto('/admin/bookings')
    // Anchored + case-sensitive regex avoids matching "Installation" (contains
    // "all") or the uppercase "ALL" status-filter pill, and tolerates the
    // pending-count badge suffix ("All 1") on the tab label.
    await page.getByRole('button', { name: /^All(\s|$)/ }).click()

    // Scoped by aria-label, not generic [data-slot="checkbox"] position — the
    // desktop/tablet layout also renders a "Show map view" toggle and a
    // "Select all visible bookings" checkbox earlier in the DOM, which
    // .first() would grab instead of an actual booking row.
    const firstCheckbox = page.getByRole('checkbox', { name: /^Select booking for/ }).first()
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
