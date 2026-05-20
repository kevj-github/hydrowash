# Subsystem L — Mobile + QA Polish

> Execute after Subsystems I, M, K, J are complete.

**Goal:** Audit every customer-facing page on mobile (≤640px viewport), document defects, fix them. Minimum bar: no horizontal scroll, tap targets ≥44px, all forms usable on mobile, modals fit viewport.

**Conventions:** See `CLAUDE.md`. Use Chrome DevTools mobile emulation or Playwright for screenshots. No DB/API changes.

---

## Task 1 — Audit Pass

Use browser (Chrome DevTools → device toolbar, iPhone SE 375px width) on each page. Screenshot each and document defects.

**Pages to audit:**

| Page | Key checks |
|---|---|
| `/` (landing) | Hero text wraps cleanly, CTA buttons full-width, ServiceCard grid stacks, StepItem timeline readable |
| `/book` Step 0 | Service type selector usable, UnitLocationPicker dropdowns don't overflow |
| `/book` Step 1 | SlotCalendar full-width, slot pills tappable (≥44px), address autocomplete works, Places input not cut off |
| `/book` Step 2 | Review summary readable, submit button accessible |
| `/auth/login` + `/auth/register` | Forms full-width, labels visible, submit reachable |
| `/account/bookings` | Booking cards stack, Reschedule/Cancel/Book Again buttons tappable (from Subsystem I) |
| `/account/contracts` | Contract cards readable, invoice filter chips wrap correctly |
| `RescheduleDialog` | Dialog fits viewport, SlotCalendar inside dialog scrollable |
| `CancelDialog` | Fits viewport, textarea usable |

**Output:** `qa-results/mobile-audit-{date}.md` — one row per defect: `[Page] | [Element] | [Defect] | [Severity: low/med/high]`.

---

## Task 2 — Fix Pass

Fix all **high** defects. Fix **medium** defects unless they require major refactoring. Log **low** defects as known issues.

**Common fixes expected (based on existing codebase patterns):**

- `SlotCalendar` inside a Dialog: ensure `overflow-y-auto` on dialog content, calendar `max-h` set
- UnitLocationPicker on small screens: ensure Select triggers have `min-h-[44px]`
- Booking wizard step buttons: `w-full` on mobile, `sm:w-auto` on desktop
- Landing hero: check `text-4xl` → `text-2xl sm:text-4xl` if overflowing
- Places Autocomplete input: `w-full` + `max-w-full` container
- All Dialog components: add `sm:max-w-lg max-h-[90vh] overflow-y-auto` to DialogContent
- Tap targets: any `<button>` or `<a>` without explicit padding — add `min-h-[44px] min-w-[44px]`

---

## Task 3 — Verify

Re-audit all pages that had high/medium defects. Confirm fixed. Update `qa-results/mobile-audit-{date}.md` with resolved status.

---

## Acceptance Checks

- [ ] No horizontal scroll on any page at 375px viewport
- [ ] All form inputs and buttons reachable without zooming
- [ ] SlotCalendar fully visible and usable inside RescheduleDialog on mobile
- [ ] All modals/dialogs fit within viewport height (scroll if needed)
- [ ] `qa-results/mobile-audit-{date}.md` filed with all defects documented
