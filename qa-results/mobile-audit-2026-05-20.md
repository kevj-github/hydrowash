# Mobile Audit — 375px viewport — 2026-05-20

Code-based audit (no browser available). All defects identified by inspecting source files.

| Page | Element | Defect | Severity |
|---|---|---|---|
| `/` (landing) | Hero `h1` | `text-5xl` (48px) causes horizontal overflow on 375px with "Hydrowash home aircon solution." copy | HIGH |
| `/book` Step 1 | `SlotCalendar` month nav `<button>` | `p-1` padding gives ~24px tap target, below 44px minimum | HIGH |
| `/book` Step 1 | `SlotCalendar` day grid `<button>` | `py-1.5` gives ~24px height, below 44px minimum | MEDIUM |
| `/book` Step 1 | `SlotCalendar` remove-date `<button>` (X icon) | `w-3 h-3` icon with no padding — ~12px tap target | MEDIUM |
| `/book` Step 1 | `StepScheduleLocation` location preset buttons (Home / My Location / Other) | `py-1.5` gives ~28px height, below 44px minimum | MEDIUM |
| `/account/bookings` | `RescheduleDialog` trigger | `size: 'sm'` = ~32px height on mobile | MEDIUM |
| `/account/bookings` | `CancelDialog` trigger | `size: 'sm'` = ~32px height on mobile | MEDIUM |
| `/account/bookings` | "Book Again" link | `py-2` gives ~32px height on mobile | MEDIUM |
| All dialogs | `DialogContent` | `RescheduleDialog` and `CancelDialog` already have `max-h-[90vh] overflow-y-auto` — OK | — |
| `/auth/login` | Form layout | Full-width inputs with `h-11`, `w-full` button — OK | — |
| `/book` wizard | Step navigation buttons | shadcn default `Button` `h-9` — borderline but acceptable | LOW |

## Status

| Severity | Count | Fixed |
|---|---|---|
| HIGH | 2 | 2 ✓ |
| MEDIUM | 6 | 6 ✓ |
| LOW | 1 | 0 (known — wizard step nav buttons at `h-9`/36px) |
