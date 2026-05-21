# Mobile QA + UX Redesign — Design Spec
Date: 2026-05-21

## Overview

Two-phase project:

- **Phase 1** — Install Playwright, write a full e2e test suite (mobile + tablet viewports), run it against the live dev server, capture screenshots, and produce a confirmed bug/issue list.
- **Phase 2** — Implement a comprehensive mobile UX redesign informed by the Phase 1 audit findings, applying consistent redesign principles across all customer-facing and admin pages.

---

## Phase 1 — Playwright Audit Suite

### Installation

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Add `e2e/` to `.gitignore` screenshots folder only (`e2e/screenshots/`). Commit test files.

### Config — `playwright.config.ts`

Two projects:
- `mobile-chrome` — 375×812 viewport (iPhone 14), `storageState` per test file
- `tablet` — 768×1024 viewport

`baseURL`: `http://localhost:3000`

`globalSetup`: `./e2e/auth.setup.ts`

Reporters: `list` (terminal) + `html` (saved to `playwright-report/`)

### Auth Setup — `e2e/auth.setup.ts`

Reads from `.env.local`:
- `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD`
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`

Logs in via UI form (`/auth/login`), saves storage state to:
- `e2e/.auth/customer.json`
- `e2e/.auth/admin.json`

All test files declare `dependencies: ['setup']` and use the appropriate `storageState`.

### Test Files

```
e2e/
  auth.setup.ts
  customer/
    landing.spec.ts          # hero, stat strip, nav, CTA buttons, MobileNav open/close
    booking-wizard.spec.ts   # full 3-step flow: service → schedule → review → submit
    account-bookings.spec.ts # booking history, empty state, reschedule/cancel dialogs
    account-contracts.spec.ts # contract list, filter chips, invoice rows, PDF link
  admin/
    overview.spec.ts         # stat cards, quick actions, alert banners
    bookings.spec.ts         # all 4 tabs, card actions, map (screenshot only on mobile)
    customers.spec.ts        # list search, customer detail page
    agenda.spec.ts           # week grid navigation, today button
    contracts.spec.ts        # list filters, create dialog, detail page
    invoices.spec.ts         # list filters, create dialog, mark paid
    settings.spec.ts         # service types, depot, company info, PayNow field
    schedule.spec.ts         # date picker, job selection (no VRP call in tests)
```

### Screenshot Strategy

Each spec captures `page.screenshot({ fullPage: true })` at:
1. Initial page load
2. After primary interaction (e.g. calendar open, dialog open, tab switch)
3. After error/edge state (e.g. empty state, validation error)

Screenshots saved to `e2e/screenshots/<role>/<spec>/<state>-<viewport>.png`.

### Audit Output

After running the suite, produce a markdown report:
`docs/superpowers/specs/2026-05-21-mobile-audit-findings.md`

Structure:
```
## [Page / Component]
- **Issue:** description
- **Viewport:** 375px / 768px / both
- **Severity:** Critical / High / Medium / Low
- **Screenshot:** path
```

---

## Phase 2 — Mobile UX Redesign

### Redesign Principles

Applied consistently across all fixes:

| Principle | Rule |
|---|---|
| Tap targets | All interactive elements ≥44×44px |
| Design tokens | Never hardcode hex — use `bg-accent`, `bg-primary`, etc. |
| Dialogs | `max-h-[90dvh] overflow-y-auto`; sticky footer for multi-step |
| Tables on mobile | Collapse to card-stack at `<md`; full table at `md:` and above |
| Calendars on mobile | Week strip (swipe) at `<md`; month grid at `md:` |
| Admin map on mobile | Cards-only default; floating "Show Map" → bottom sheet (50vh) |
| Navigation | Bottom nav bar pattern on mobile for both customer and admin |

---

### Customer Navigation

**Current:** `MobileNav` dropdown from hamburger in top navbar.

**New:** Add a sticky bottom nav bar (`<md` only) with 4 items:
- Home (`/`)
- Book Now (`/book`) — accent-coloured, prominent
- My Bookings (`/account/bookings`) — only when logged in
- Account (`/account/settings`) — only when logged in; shows Sign In link when guest

`MobileNav` hamburger retained for overflow items (Contracts & Invoices, Sign Out).

Fix: replace hardcoded `bg-[#0F172A]` and `bg-[#0369A1]` in `MobileNav.tsx` with `bg-primary` and `bg-accent`.

### Admin Navigation

**Current:** Horizontal `overflow-x-auto` tab strip — 8 items.

**New at `<768px`:** Bottom nav bar with 5 primary items + "More" sheet:
- Primary: Overview, Bookings, Customers, Contracts, Invoices
- More sheet: Agenda, Availability, Schedule, Settings

Full horizontal strip retained at `md:` and above (no change to desktop).

---

### SlotCalendar (Customer Booking + Reschedule)

**Current:** 7-column month grid — cramped at 375px (~45px cells).

**New at `<md`:**
- Week strip across top: 7 day buttons (Mon–Sun), horizontally scrollable
- Swipe left/right (or arrow buttons) to navigate weeks
- Selected date shows available time slots as large stacked chips below
- Month navigation retained as a header above the week strip

**At `md:` and above:** Existing month grid unchanged.

---

### Admin Agenda

**Current:** 7-column week grid (5 slot rows × 7 day cols) — same overflow problem as SlotCalendar.

**New at `<md`:**
- Day-list view: one column per selected day, scrollable vertically
- Day navigation: prev/next day buttons + date header
- Slot rows rendered as a vertical list for the selected day

**At `md:` and above:** Existing week grid unchanged.

---

### Admin Bookings (Map + Sidebar Split)

**Current:** Side-by-side split panel with draggable resize handle — zero responsive breakpoints. Broken on mobile.

**New at `<md`:**
- Default view: card list only (full width)
- Floating "Show Map" button (bottom-right FAB) opens map in a bottom sheet (`h-[50vh]`, slide-up animation)
- Bottom sheet has a close handle and a "Focus on selected booking" pin button
- Draggable resize handle hidden on mobile

**At `md:` and above:** Existing split panel unchanged.

---

### Dialogs

Applies to: `JobCompletionDialog`, `RescheduleDialog`, `CancelDialog`, contract set-price dialog, invoice create dialog.

**Changes:**
- Add `max-h-[90dvh] overflow-y-auto` to all dialog content containers
- Multi-step dialogs: navigation buttons (Back / Next / Submit) move to a sticky `border-t` footer pinned to bottom of dialog
- `JobCompletionDialog` AC details table: on `<md`, collapse to stacked field pairs (Label: Value) instead of table columns

---

### Admin Data Tables

Applies to: `admin/customers`, `admin/contracts`, `admin/invoices`, `admin/customers/[id]` sub-tables.

**At `<md`:** Each table row rendered as a card:
```
┌─────────────────────────────────┐
│ Name · #customer_no             │
│ Phone                           │
│ Bookings: 3  |  Total: $120     │
│ [Active Contract] [View →]      │
└─────────────────────────────────┘
```

**At `md:` and above:** Full table layout unchanged.

---

### Filter Bars

Applies to: `admin/contracts`, `admin/invoices`, `admin/customers`.

**At `<md`:** Collapse filter inputs behind a "Filters" button that opens a bottom sheet. Status pill filters remain visible inline. Date range pickers and text search move into the sheet.

---

### Booking Wizard — Other Mobile Fixes

- `StepScheduleLocation` Places Autocomplete: add `w-full max-w-full` + `overflow-hidden` to prevent dropdown overflow
- `UnitLocationPicker`: ensure `<Select>` dropdowns are full-width on mobile; "Others" free-text input gets `w-full`
- Step progress bar: at `<sm`, hide step labels (already `hidden sm:block`); shorten connector lines to `w-8`

---

### Admin Availability (Blocked Slots Calendar)

**Current:** Month grid calendar for blocking slots — same 7-column grid problem as SlotCalendar.

**New at `<md`:** Apply same week strip pattern as SlotCalendar — week navigation, selected day shows slot checkboxes below. Block/unblock actions remain available.

**At `md:` and above:** Existing month grid unchanged.

---

### Account Pages

- `account/bookings` — booking cards: stack action buttons (Reschedule / Cancel) below the card body at `<sm` (currently inline)
- `account/contracts` — invoice table inside contract: collapse to card view at `<md`

---

## Deliverables

| Phase | Deliverable |
|---|---|
| 1 | `playwright.config.ts` + `e2e/` test suite |
| 1 | `e2e/screenshots/` — full screenshot set at 375px + 768px |
| 1 | `docs/superpowers/specs/2026-05-21-mobile-audit-findings.md` |
| 2 | All UX changes implemented across customer + admin pages |
| 2 | Playwright suite re-run confirms no regressions |

---

## Out of Scope

- Admin pages are not made into full mobile apps — best-effort responsive only
- No native app / PWA changes
- No backend / API changes
- No new features beyond navigation patterns described above
