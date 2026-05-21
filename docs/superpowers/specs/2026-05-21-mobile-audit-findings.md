# Mobile Audit Findings
Date: 2026-05-21
Suite: 54 tests · 4 projects (mobile-customer 390px, tablet-customer 768px, mobile-admin 390px, tablet-admin 768px)
Result: **54/54 passed** (issues logged as warnings)

---

## Customer — Account / Bookings (`/account/bookings`)

### Issue 1: Horizontal overflow — 139px
- **Viewport:** 375px (mobile-customer)
- **Severity:** Critical
- **Detail:** `document.body.scrollWidth = 529px` vs viewport `390px`. The booking card layout extends horizontally beyond the screen. The "Reschedule / Cancel" button row in each card does not wrap — the buttons sit side-by-side and push the card past 390px.
- **Screenshot:** `e2e/screenshots/customer/account-bookings-mobile-customer.png`
- **Fix:** Stack Reschedule / Cancel buttons vertically on `<sm`. Already planned as P2-T13.

---

## Customer — Account / Contracts (`/account/contracts`)

### Issue 2: Horizontal overflow — 139px
- **Viewport:** 375px (mobile-customer)
- **Severity:** Critical
- **Detail:** Same 529px scrollWidth as bookings. The invoice table inside each contract card has fixed column widths that don't collapse on mobile.
- **Screenshot:** `e2e/screenshots/customer/account-contracts-mobile-customer.png`
- **Fix:** Collapse invoice table to card view at `<md`. Already planned as P2-T13.

### Issue 3: Filter chips below 44px tap target — 30px height
- **Viewport:** 375px and 768px (both viewports)
- **Severity:** High
- **Detail:** Status filter buttons ("ALL", "Active", "Awaiting Payment", "Expired") measure only **30px tall**. Apple HIG and Android Material guidelines require ≥44px for reliable touch. Users with larger fingers will frequently miss these chips.
- **Screenshot:** `e2e/screenshots/customer/account-contracts-mobile-customer.png`
- **Fix:** Add `min-h-[44px] py-2.5` to filter chip buttons in `AccountContractsClient.tsx`.

---

## Admin — Agenda (`/admin/agenda`)

### Issue 4: Horizontal overflow — 64px on 7-column week grid
- **Viewport:** 375px (mobile-admin)
- **Severity:** High
- **Detail:** `scrollWidth = 454px` vs `390px`. The 7-column week grid (1 slot-label column + 7 day columns) doesn't collapse to a single-day view on mobile. Columns overflow sideways; horizontal scrolling is the only way to see Mon–Sun.
- **Screenshot:** `e2e/screenshots/admin/agenda-mobile-admin.png`
- **Fix:** Day-list view on `<md`. Already planned as P2-T11.

---

## Admin — Bookings map (`/admin/bookings`)

### Issue 5: Map sidebar covers full screen on mobile
- **Viewport:** 375px (mobile-admin)
- **Severity:** High
- **Detail:** The draggable split-panel (map + sidebar) has no mobile breakpoint. On 390px the sidebar renders at its minimum 240px width while the map tries to occupy the remaining ~150px — both are unusable. No option to show cards-only.
- **Screenshot:** `e2e/screenshots/admin/bookings-maintenance-mobile-admin.png`
- **Fix:** Cards-only default + "Show Map" FAB on mobile. Already planned as P2-T7.

---

## Admin — Navigation

### Issue 6: Horizontal tab strip overflows on mobile
- **Viewport:** 375px (mobile-admin)
- **Severity:** High
- **Detail:** The admin nav is an `overflow-x-auto` horizontal tab strip with 8 items. On 390px, items clip to 2–3 chars wide and require horizontal scrolling to discover. The "Availability" and "Schedule" tabs are not reachable without knowing to scroll.
- **Screenshot:** `e2e/screenshots/admin/overview-mobile-admin.png`
- **Fix:** Bottom nav bar pattern on mobile. Already planned as P2-T4/T5.

---

## Customer — Navigation

### Issue 7: MobileNav uses hardcoded hex colours
- **Viewport:** 375px
- **Severity:** Medium
- **Detail:** `MobileNav.tsx` uses `bg-[#0F172A]` and `bg-[#0369A1]` instead of design tokens `bg-primary` and `bg-accent`. This breaks theming consistency and means future brand colour changes won't propagate.
- **Fix:** Replace hardcoded hex with `bg-primary` and `bg-accent`. Already planned as P2-T1.

---

## Customer — Booking Wizard (`/book`)

### Issue 8: SlotCalendar 7-column grid tight on mobile
- **Viewport:** 375px (mobile-customer)
- **Severity:** Medium
- **Detail:** The 7-column month grid renders correctly at 390px without overflow (`scrollWidth = 390px`). However, each calendar cell is ~45px wide — tap targets are at the bare minimum. Day cells don't show dates cleanly; misselection risk is high.
- **Screenshot:** `e2e/screenshots/customer/booking-calendar-mobile-customer.png`
- **Fix:** Week-strip view with large day buttons on `<md`. Already planned as P2-T6.

### Issue 9: StepScheduleLocation Places Autocomplete dropdown overflow risk
- **Viewport:** 375px
- **Severity:** Medium
- **Detail:** The Google Places autocomplete popup can extend beyond the viewport width. No `max-w-full overflow-hidden` wrapper observed on the input container.
- **Screenshot:** `e2e/screenshots/customer/booking-step1-mobile-customer.png`
- **Fix:** Add `w-full max-w-full overflow-hidden` to the autocomplete container. Already planned as P2-T13.

---

## Admin — JobCompletionDialog

### Issue 10: AC details table cramped on mobile
- **Viewport:** 375px
- **Severity:** Medium
- **Detail:** The JobCompletionDialog Step 1 AC details table has Brand / Model / Location columns that become very narrow at 390px. No responsive card-collapse. Dialog itself can exceed viewport height with no scrollable container.
- **Fix:** Stacked field pairs on `<md` + `max-h-[90dvh] overflow-y-auto` on dialog content. Already planned as P2-T9.

---

## Admin — Data Tables (Customers, Contracts, Invoices)

### Issue 11: Full-width tables on mobile — no collapse
- **Viewport:** 375px (mobile-admin)
- **Severity:** Medium
- **Detail:** `/admin/customers`, `/admin/contracts`, `/admin/invoices` render full-width table layouts. At 390px these tables get very cramped — some columns clip text. No overflow scroll is visible.
- **Screenshot:** `e2e/screenshots/admin/customers-list-mobile-admin.png`, `e2e/screenshots/admin/contracts-list-mobile-admin.png`, `e2e/screenshots/admin/invoices-list-mobile-admin.png`
- **Fix:** Card-stack view at `<md`. Already planned as P2-T10.

---

## Admin — Filter Bars (Contracts, Invoices, Customers)

### Issue 12: Filter inputs not accessible on mobile
- **Viewport:** 375px
- **Severity:** Medium
- **Detail:** Date-range pickers and text search inputs in the admin filter bars span full-width but are difficult to use with one hand on mobile. No collapse pattern — all inputs always visible.
- **Screenshot:** `e2e/screenshots/admin/contracts-filters-mobile-admin.png`
- **Fix:** "Filters" button collapses inputs into a bottom sheet on `<md`. Already planned as P2-T10b.

---

## All Dialogs

### Issue 13: Dialogs can exceed viewport height
- **Viewport:** 375px
- **Severity:** Medium
- **Detail:** `RescheduleDialog`, `CancelDialog`, `JobCompletionDialog` have no `max-h-[90dvh] overflow-y-auto` constraint. Dialogs with many fields can render taller than the screen with no visible scroll affordance.
- **Fix:** Add `max-h-[90dvh] overflow-y-auto` + sticky button footer. Already planned as P2-T8.

---

## Summary

| # | Page | Issue | Viewport | Severity |
|---|------|-------|----------|----------|
| 1 | `/account/bookings` | 139px horizontal overflow — button row | 375px | Critical |
| 2 | `/account/contracts` | 139px horizontal overflow — invoice table | 375px | Critical |
| 3 | `/account/contracts` | Filter chips 30px tall (need ≥44px) | both | High |
| 4 | `/admin/agenda` | 64px overflow — 7-col week grid | 375px | High |
| 5 | `/admin/bookings` | Map/sidebar unusable — no mobile breakpoint | 375px | High |
| 6 | Admin nav | Horizontal tab strip — items clip/hidden | 375px | High |
| 7 | `MobileNav.tsx` | Hardcoded hex colours | 375px | Medium |
| 8 | `/book` SlotCalendar | 45px cell tap targets — month grid | 375px | Medium |
| 9 | `/book` Step 1 | Places autocomplete overflow risk | 375px | Medium |
| 10 | JobCompletionDialog | AC table cramped + no height cap | 375px | Medium |
| 11 | Admin tables | No card-stack collapse on mobile | 375px | Medium |
| 12 | Admin filter bars | No collapse pattern on mobile | 375px | Medium |
| 13 | All dialogs | No `max-h` + overflow-y-auto | 375px | Medium |

All 13 issues are addressed in the Phase 2 UX Redesign plan (`2026-05-21-mobile-ux-redesign.md`).
