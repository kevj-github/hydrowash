# Next Session — Resume Here

## Status
Phase 2 Subsystems H, A, B, C, D, E, F, G — **all complete** (2026-05-14). Migrations 001–019 applied to Supabase. `npm install` done. Clean build passes.

## Completed (full history)
- **Phase 1** — booking portal, admin dashboard, VRP optimizer, email templates, API routes, cron job
- **Phase 1 Bug-fix batch** — 11 issues fixed (2026-05-07)
- **Phase 1 QA session** — 6 code bugs fixed + 2 RLS migrations (2026-05-08)
- **Phase 1B** — contracts, invoices, dashboard widgets, customer view, daily cron (2026-05-08)
- **Phase 1C** — route optimiser redesign + technician/cars removal (2026-05-08)
- **Phase 1D** — admin bookings UX improvements + contract enhancements (2026-05-08)
- **Phase 1E** — full UI modernization across all pages (2026-05-08)
- **Phase 1F** — search, filters, and bidirectional map sync (2026-05-08)
- **Phase 2 Subsystem H** — landing page copy refresh (2026-05-14)
- **Phase 2 Subsystem A** — slot model + booking calendar + AC catalog + availability API (2026-05-14)
- **Phase 2 Subsystem B** — profile address at registration + account settings page (2026-05-14)
- **Phase 2 Subsystem C** — admin date/slot blocking UI (2026-05-14)
- **Phase 2 Subsystem D** — customer contract self-signup + admin activate flow (2026-05-14)
- **Phase 2 Subsystem E** — PayNow QR display on UNPAID invoices (2026-05-14)
- **Phase 2 Subsystem F** — automated reminder emails wired up (2026-05-14)
- **Phase 2 Subsystem G** — alternative slot suggestions on 409 conflict (2026-05-14)

## Phase 2 Subsystems D–G — what changed (2026-05-14)

### Migrations applied
- **018_contract_pending.sql** — `price_sgd` nullable; `PENDING_REVIEW` added to status check; `expiry_reminder_sent boolean` column added
- **019_contracts_customer_insert.sql** — RLS INSERT policy: customers can insert own PENDING_REVIEW contracts

### New source files
- `supabase/migrations/018_contract_pending.sql`
- `supabase/migrations/019_contracts_customer_insert.sql`
- `app/api/contracts/request/route.ts` — customer POST to create PENDING_REVIEW contract (no price, no service dates)
- `app/api/contracts/[id]/activate/route.ts` — admin PATCH: set price, start_date → ACTIVE; generate service dates; send ContractActivated email
- `app/api/availability/suggest/route.ts` — GET `?from&slot&days` → top-5 (date,slot) alternatives
- `lib/booking/slots.ts` — `isDayFullyBlocked`, `isSlotBlocked`, `getSlotsForDate`, `resolveContractTierPrice`
- `lib/utils/paynow.ts` — `buildPayNowPayload()` + `crc16ccitt()` (EMVCo SGQR)
- `lib/email/templates/ContractActivated.tsx`
- `lib/email/templates/ContractServiceDue.tsx`
- `lib/email/templates/ContractExpiring.tsx`

### Modified source files
- `lib/types.ts` — `ContractStatus` now includes `PENDING_REVIEW`; `Contract.price_sgd` is `number | null`; `Contract.expiry_reminder_sent boolean` added
- `lib/email/send.ts` — added `sendContractActivated`, `sendContractServiceDue`, `sendContractExpiring`
- `app/account/AccountContractsClient.tsx` — "Request Contract" dialog + PENDING_REVIEW display + PayNow dialog on UNPAID invoices
- `app/account/contracts/page.tsx` — fetches `app_settings` (pricing tiers + paynow_mobile) + profile address; passes all to client
- `app/admin/contracts/page.tsx` — PENDING_REVIEW filter pill; sort pending to top
- `app/admin/contracts/[id]/page.tsx` — amber banner for PENDING_REVIEW; Activate dialog + Reject button
- `components/admin/ContractCard.tsx` — PENDING_REVIEW badge; null guard on `price_sgd`
- `app/api/contracts/route.ts` — GET allowlist includes `PENDING_REVIEW`
- `app/api/cron/reminders/route.ts` — **BUG FIX**: query uses `booking_date` (was `confirmed_date`)
- `app/api/cron/contracts/route.ts` — fully rewritten: sends `ContractServiceDue` emails; sends `ContractExpiring` emails + sets `expiry_reminder_sent = true`
- `components/booking/BookingWizard.tsx` — 409 handler: fetches `/api/availability/suggest`, shows clickable date+slot pill suggestions
- `package.json` — added `qrcode.react: ^4.2.0`

## Owner still needs to supply (in Supabase app_settings)
- `paynow_mobile` → PayNow mobile number (required for E to work)
- `contract_pricing_tiers` → confirm pricing; customer-facing hint uses these
- `NEXT_PUBLIC_APP_URL` env var → needed by cron/contracts service-due email link (defaults to `https://hydrowash.sg`)

## Key gotchas (accumulated)

### Subsystem D
- `price_sgd` is nullable — guard everywhere: `contract.price_sgd != null ? ...toFixed(2) : 'TBD'`
- Service dates NOT generated at request time — only on admin activation
- Customer RLS INSERT requires `status = 'PENDING_REVIEW'` and `customer_id = auth.uid()` (migration 019)
- Admin activate uses `createAdminClient()` from `lib/supabase/admin.ts` (NOT `createClient` from same file)

### Subsystem E
- `qrcode.react` v4 exports `QRCodeSVG` (named export)
- `paynow_mobile` null → PayNow "Pay" button is hidden
- `buildPayNowPayload(mobile, amount, ref)` — reference capped at 25 chars; use `HW-${invoiceId.slice(-8).toUpperCase()}`

### Subsystem F
- Cron `reminders/route.ts` now uses `booking_date` (was `confirmed_date`) — critical bug fix
- Cron `contracts/route.ts` uses `expiry_reminder_sent` to prevent duplicate expiry emails (added in migration 018)
- Email failures wrapped in `.catch(() => null)` — cron continues even if one email fails

### Subsystem G
- Suggestions sorted: same slot first, then by date
- Clicking pill: updates `booking_date` + `time_slot`, clears error + suggestions, navigates to step 1
- Suggest API is unauthenticated (same as /api/availability)

### Subsystem B
- Profile address fields are nullable — guard everywhere with `profile?.address`
- Middleware fetches profile for every `/book` hit — lightweight query on a small table, acceptable
- Address at registration is saved only when `data.session` exists. Email-verify users add address in `/account/settings` after login.
- `AccountSettingsClient` uses `useSearchParams` → must be wrapped in `<Suspense>` in the server page

### Phase 2 / slot model
- `SLOT_LABELS` and `SLOT_KEYS` are in `lib/types.ts` — always import, never hardcode slot keys or labels
- `/api/availability` is unauthenticated (reads from server Supabase client) — fine, slot availability is public info
- Slot uniqueness: partial index allows REJECTED/COMPLETED bookings on the same (date, slot) — only PENDING + APPROVED count

### General (carried forward)
- **Never hardcode hex colors** — tokens only
- **Icons — `lucide-react` only**
- shadcn v4 `onValueChange` → `(value: string | null, event: Event) => void` — use `?? ''`
- shadcn v4 `SelectValue` does NOT auto-resolve label — provide children explicitly
- shadcn v4 `DialogTrigger` does NOT accept `asChild`
- `useSearchParams` requires `<Suspense>` in Next.js 15+
- Jest: `setupFilesAfterEnv`; VRP tests need `/** @jest-environment node */`
- `service_type_id` is NOT NULL — fault repair types are rows in `service_types`
- `service_types.description` is `NOT NULL DEFAULT ''` — send `''` not `null`
- `lib/supabase/admin.ts` exports `createAdminClient` (not `createClient`)
- Turbopack + Windows: touch dynamic route files after `npm run dev` to force HMR
- Custom combobox: `onMouseDown` + `e.preventDefault()` on dropdown items
- `isDragging` in admin sidebar is a `useRef<boolean>` — not state
- `AccountContractsClient` at `app/account/AccountContractsClient.tsx` — server page is just a data fetcher
