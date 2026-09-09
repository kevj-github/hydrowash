# HydroWash — Admin Hard Delete (Customers, Contracts, Invoices, Bookings)

**Date:** 2026-09-09

---

## Context

The admin currently has no way to permanently remove a customer, contract, invoice, or booking from the database. Cancelled/rejected/completed records accumulate forever. Contracts have a partial exception: `DELETE /api/contracts/[id]` cancels a non-`CANCELLED` contract on first call and only hard-deletes on a second call against an already-`CANCELLED` contract — no other entity has any delete path at all.

This feature gives the admin full control to permanently remove records of their choosing, individually or in bulk, across all four admin list views (`/admin/customers`, `/admin/contracts`, `/admin/invoices`, `/admin/bookings`).

## Scope

**In scope:**
- Hard delete (permanent, irreversible) for customers, contracts, invoices, and bookings.
- Multi-select checkboxes + bulk delete on all four admin list pages, plus a per-row/card single-delete affordance using the same modal/endpoint.
- A shared confirmation modal showing a preview list of what's being deleted; for customers, also the counts of dependent bookings/contracts/invoices that will cascade.
- An audit log recording every admin delete (who, what, when, a snapshot of what was deleted).
- Changing `DELETE /api/contracts/[id]` to always hard-delete immediately (removing the old cancel-first two-step), so single and bulk contract delete behave identically.

**Out of scope:**
- Soft delete / recovery / trash-bin UI.
- Deleting other entity types (service types, AC catalog, blocked slots, app settings) — not requested.
- Changing anything about the existing "Cancel" status transitions that aren't part of delete (e.g. booking `CANCELLED` status via customer self-cancel stays as-is; contract status changes via PATCH stay as-is).

---

## Data model changes

**Migration `supabase/migrations/035_admin_hard_delete.sql`:**

1. Drop and recreate the `bookings.customer_id` foreign key with `ON DELETE CASCADE` (it currently has no action, i.e. `RESTRICT`, which today makes deleting a customer with any booking fail outright). `contracts.customer_id` and `invoices.customer_id` already cascade — this migration brings `bookings` in line so a customer delete cleanly removes all their data.

2. New table:

```sql
CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL DEFAULT 'DELETE',
  entity_type text NOT NULL CHECK (entity_type IN ('customer','contract','invoice','booking')),
  entity_ids uuid[] NOT NULL,
  summary jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON admin_audit_log
  FOR SELECT USING (get_my_role() = 'admin');
```

No `INSERT` policy — all writes happen through the service-role client from route handlers, which bypasses RLS.

**No changes needed for:**
- `contract_service_dates` — already `ON DELETE CASCADE` from `contracts`.
- `job_completions` — already `ON DELETE CASCADE` from `bookings`.
- `invoices.booking_id` / `invoices.contract_id` — already `ON DELETE SET NULL`; deleting a booking or contract just unlinks the invoice rather than deleting it (confirmed: cascade silently, no need to surface this in the confirmation UI).

---

## API layer

### Shared helper — `lib/admin/audit-log.ts`

```ts
logAdminDelete(supabaseAdmin, adminId, entityType, rows: { id: string; label: string }[]): Promise<void>
```
Inserts one `admin_audit_log` row per call (one row per batch, not per entity) with `entity_ids` = all ids and `summary` = the `{id, label}` array. Used by every delete route below.

### New/changed routes

All routes: verify session (`401` if none), verify `profiles.role === 'admin'` (`403` otherwise) — same pattern as `bulk-approve`. All actual deletes and audit writes use the service-role client (`lib/supabase/admin.ts`).

- **`POST /api/bookings/bulk-delete`** `{ ids: string[] }` — deletes rows from `bookings` (cascades `job_completions`, nulls linked `invoices.booking_id` / `contract_service_dates.booking_id`). Snapshot label: customer name + service type + date.
- **`POST /api/invoices/bulk-delete`** `{ ids: string[] }` — deletes rows from `invoices` directly, no dependents. Snapshot label: customer name + amount + status.
- **`POST /api/contracts/bulk-delete`** `{ ids: string[] }` — deletes rows from `contracts` (cascades `contract_service_dates`, nulls linked `invoices.contract_id` / `bookings.contract_id`). Snapshot label: customer name + status + date range.
- **`POST /api/customers/bulk-delete`** `{ ids: string[] }` — for each id, calls `supabaseAdmin.auth.admin.deleteUser(id)`, which cascades `profiles` → `contracts` / `invoices` / `bookings` (per the FK changes above) and removes the login. Before deleting, fetches per-customer counts of bookings/contracts/invoices (for the confirmation modal, called from the client before the delete request is even sent — see UI section). Snapshot label: customer name + phone + customer_no.
- **`DELETE /api/contracts/[id]`** — behavior change: drop the "cancel first, hard-delete second" logic. Always hard-deletes immediately (fetch snapshot → delete → audit log → `{ deleted: true }`). `app/admin/contracts/[id]/page.tsx`'s `handleDelete` already branches on `body.deleted`; since it's now always `true`, simplify it to always `router.push('/admin/contracts')` on success.

Partial failures (e.g. one `auth.admin.deleteUser` call fails mid-batch for customers): each route processes ids independently, collects `{ succeeded: string[], failed: { id, error }[] }`, and returns both in the response — never a single all-or-nothing error for the whole batch.

---

## UI / UX

### Shared component — `components/admin/ConfirmDeleteModal.tsx`

Props: `title`, `items: { id: string; label: string }[]` (rendered as a short preview list, scrollable if long), `warning?: string` (extra line — used only for customers' dependent-count message), `onConfirm: () => Promise<void>`. Shows a spinner while the delete request is in flight; on error, shows the error inline and stays open; on success, closes and the caller refreshes its list.

Used identically for single delete (`items` has 1 entry, no separate code path) and bulk delete.

### Per-page changes

- **Bookings** (`AdminBookingsClient.tsx` + `BookingCard.tsx`): add a `selected: Set<string>` state in the client component; `BookingCard` gets a checkbox (new `selected`/`onSelectToggle` props) and a trash icon that opens the modal for itself alone. A sticky bulk-action bar appears above the list once `selected.size > 0`: "N selected · Delete Selected" → opens the modal with all selected bookings' labels → `POST /api/bookings/bulk-delete`.
- **Contracts** (`app/admin/contracts/page.tsx` + `ContractCard.tsx`): same pattern — checkbox + trash icon on `ContractCard`, bulk bar in the page, calls `POST /api/contracts/bulk-delete`.
- **Invoices** (`app/admin/invoices/page.tsx` + `InvoiceRow.tsx`, including `MobileInvoiceCard`): same pattern, calls `POST /api/invoices/bulk-delete`.
- **Customers** (`app/admin/customers/page.tsx`): currently a Server Component with no client interactivity. Split into `app/admin/customers/page.tsx` (server: keeps the existing search-param query + data fetching) rendering a new `app/admin/customers/AdminCustomersClient.tsx` (client: receives the fetched rows as props, holds selection state, renders checkboxes + bulk bar) — mirrors the existing `admin/bookings/page.tsx` → `AdminBookingsClient.tsx` split. Before opening the confirm modal, the client fetches dependent counts (bookings/contracts/invoices) for the selected customer(s) via a small `GET` (or client-side Supabase count queries, consistent with how this page already fetches related data) and passes them into the modal's `warning` text, e.g. "This will also permanently delete 3 bookings, 1 contract, and 2 invoices."

All four pages keep their existing filters/search working unchanged — selection state is separate from filter state, and only currently-visible rows are selectable (selection isn't preserved across a search that removes a selected row from view — sane default, not called out further since it wasn't asked about).

---

## Error handling & testing

- Every route returns `{ succeeded: string[], failed: { id, error }[] }`; the UI shows a toast/alert summarizing failures (if any) and always refreshes the list afterward so it reflects true DB state.
- Unit tests (Jest) for each `bulk-delete` route: auth/role guard (401/403), successful delete + audit row written, partial-failure shape, and for customers specifically — dependent counts are correct and the cascade actually removes bookings/contracts/invoices (can be asserted against a test DB or mocked Supabase admin client per existing test conventions in this repo).
- Playwright e2e: select multiple bookings on `/admin/bookings` → delete → confirm they're gone; delete a customer with an active contract + booking → confirm cascade removes all three and the customer can no longer log in.
