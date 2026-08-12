# HydroWash — UX Audit: Customer Booking Flow

**Date:** 2026-08-11 · **Target:** https://www.hydrowash.services (production) · **Auditor:** Claude Code (`ux-audit`)

```
═══════════════════════════════════════════════════════════
VERDICT: FAIL

Persona: SG HDB resident, mid-30s, phone-in-hand, aircon just started
         leaking, low patience, first-time user (never used this site)

Surfaces audited: 7 / 9 customer-facing routes
  /  ·  /services  ·  /auth/login  ·  /auth/register
  /account/settings  ·  /book  ·  /account/bookings
  Not audited: /account/contracts, /auth/reset-password
  Out of scope this pass: all 11 /admin routes

Hard Gates:
  console errors      0 reportable (1 allowlisted: expected Supabase 400
                        on a deliberate wrong-password login)
  console warnings    2 on EVERY Maps-bearing page  ← RED (H-4)
  network 5xx         0
  403/404 on auth     0
  layout collapse     0  (375 / 768 / 1440 — no horizontal overflow anywhere)
  axe Critical        0
  axe Serious         0   (moderate only: 2 on auth pages)

Performance (on /): LCP 1448ms · CLS 0 · TTFB 44ms · FCP 1448ms
                    thresholds 4.0s / 0.25 / 500ms — GREEN

Findings:
  Critical: 1     High: 4     Medium: 13     Low: 4

TOP 5 (impact x ease):
  1. C-1  Room selections silently discarded on every maintenance booking
          — mandatory input, 100% loss since launch, one-word fix
  2. H-1  "Installation" advertised on the landing page but not bookable
  3. H-2  Google Places dropdown fully covers the Save button
  4. H-3  Address auto-return to /book is dead on the first-time path
  5. H-4  Two console warnings on every Maps page (deprecated Places widget)
═══════════════════════════════════════════════════════════
```

---

## CRITICAL

### C-1 — Every maintenance booking silently discards the room selections

| | |
|---|---|
| **Layer** | Architecture / Feedback |
| **Severity** | Critical |
| **Surface** | `/book` step 1 → POST `/api/bookings` · 1440×900 and 375×812 |
| **Persona** | Any customer booking maintenance |

**Reproduce**
1. Sign in as a customer with an address on file, go to `/book`.
2. Service Type → "General Maintanance". Number of Units → `2`.
3. Two **required** room dropdowns appear ("Unit Locations \*"). Pick *Master Bedroom* and *Living Room*. `Next` stays disabled until both are set.
4. Complete steps 2–3 and press **Confirm Booking**.
5. Query the join table for the new booking.

**Observed** — Booking is created (HTTP 201), UI shows success. `booking_unit_locations` for that booking is `[]`. The whole table is empty:

```
GET /rest/v1/booking_unit_locations?select=id   →  200  []
GET /rest/v1/bookings?category=eq.MAINTENANCE   →  200  [ ...many rows, num_units 1–8,
                                                           earliest 2026-05-14 ]
```

**Expected** — One join row per selected unit location.

**Root cause** — Column-name mismatch plus an unchecked error:

- Schema `supabase/migrations/011_phase2_ac_locations.sql:18` → column is **`location_id`**
- API `app/api/bookings/route.ts:168` → inserts **`unit_location_id`**
- `app/api/bookings/route.ts:165` → `await supabase.from(...).insert(...)` with **no `{ error }` destructure and no check**, so the failure is swallowed and the route still returns 201.

Confirmed independently: PostgREST rejects the column by name —
`"column booking_unit_locations_1.unit_location_id does not exist"` (code `42703`).

**Impact** — The customer is *forced* to specify which rooms have AC units, and that data has never once been stored since launch (May 2026). The technician arrives without knowing which rooms to service. Note `unit_location_others` (the free-text "Others" labels) *is* stored on the booking row, so the data loss is silent and partial — which is why it has gone unnoticed.

**Smallest possible patch** — `app/api/bookings/route.ts:164-171`:

```ts
if (unit_location_ids?.length && booking?.id) {
  const { error: locError } = await supabase.from('booking_unit_locations').insert(
    unit_location_ids.map((loc_id: string) => ({
      booking_id: booking.id,
      location_id: loc_id,          // was: unit_location_id
    }))
  )
  if (locError) {
    console.error('[bookings POST] unit location insert failed:', locError)
    return NextResponse.json({ error: locError.message }, { status: 500 })
  }
}
```

Backfill is not possible — the selections were never transmitted to storage.

---

## HIGH

### H-1 — "Installation" is advertised everywhere but cannot be booked

| | |
|---|---|
| **Layer** | Architecture | **Severity** | High |
| **Surface** | `/` ServiceCard grid, footer "SERVICES" list, `/book` step 1 |

**Reproduce** — From the landing page click the **Installation** service card (or the footer "Installation" link) → lands on `/book` → open the Service Type dropdown.

**Observed** — Exactly two options: `General Maintanance`, `Fault Repair — S$100.00`. No installation option. DB confirms only 2 active `service_types` rows, neither with `category = 'INSTALLATION'`.

**Expected** — Either an Installation service type exists, or it is not advertised.

**Evidence** — `service_types?select=*` returns 2 rows (`MAINTENANCE`, `FAULT_REPAIR`).

**Persona cost** — The one service with the highest ticket value is a dead end. The user has already signed in and reached step 1 before discovering it.

**Smallest possible patch** — Insert the missing row via `/admin/settings`:
`INSERT INTO service_types (name, category, description, active) VALUES ('AC Installation', 'INSTALLATION', '', true);`
If installation is deliberately quote-only, remove the ServiceCard and footer link and replace with a "Request a quote" contact route instead.

### H-2 — Google Places dropdown completely covers the Save button

| | |
|---|---|
| **Layer** | Interaction | **Severity** | High |
| **Surface** | `/account/settings` · 1440×900 (worse on mobile) |

**Reproduce**
1. `/account/settings` with an empty address.
2. Type `Blk 123 Ang Mo Kio Ave 3` into Home Address.
3. Without dismissing the suggestions, aim for **Save Changes**.

**Observed** — `.pac-container` spans y 367→541; the button spans y 409→453. Overlap = 44px vertical × 428px horizontal = **100% of the button**. `document.elementFromPoint()` at the button's centre returns a `.pac-item` — *"Johnson Eatery 332 Ang Mo Kio"*. Playwright refused the click: `<div class="pac-item"> … intercepts pointer events`.

**Expected** — Save is reachable, or the dropdown is positioned so it cannot cover the form's primary action.

**Evidence** — `05-pac-covers-save-button.png` (the blue Save button is entirely hidden).

**Impact** — Clicking "Save" silently selects a *wrong address*. The saved address drives geocoding, the admin map, and route optimisation — a technician gets dispatched to a restaurant instead of the customer's flat.

**Smallest possible patch** — In `AccountSettingsClient.tsx`, add bottom margin below the address group so the 174px-tall dropdown clears the button (`mb-44` on the address field wrapper), or render the pac container into a portal with collision detection. Cheapest robust fix: move **Save Changes** above the address block, or add `scroll-margin` + close the dropdown on `blur` before the button becomes reachable.

### H-3 — Address auto-return to `/book` is dead on the only path that uses it

| | |
|---|---|
| **Layer** | Interaction / Architecture | **Severity** | High |
| **Surface** | `/account/settings?reason=address` → `/book` |

**Reproduce (Path A — the real first-time journey)**
1. Register, skip the "(optional)" address. Sign in.
2. Click **Book Now** → middleware redirects to `/account/settings?reason=address`.
3. Enter an address, pick a suggestion, **Save Changes**.
4. Poll `location.pathname`.

**Observed** — `"Profile saved successfully."` appears; 6 seconds later still on `/account/settings`. Reproduced twice, including a clean replay after nulling the profile address:

```
0ms /account/settings   …   5500ms /account/settings
final: /account/settings?reason=address   saved: true
```

**Path B (control)** — reload `/account/settings?reason=address` with an address *already* stored, press Save → redirect to `/book` fires correctly. So the code path works; it fails specifically on first-time state.

**Expected** — `app/account/settings/AccountSettingsClient.tsx:123` intends `setTimeout(() => router.push('/book'), 1200)`.

**Suspected mechanism** — The Next.js App Router client cache holds the earlier `/book` prefetch that responded `307` while the profile had no address. My first network capture shows exactly that: `GET /book?_rsc=… => [307]`. `router.push('/book')` replays the cached redirect straight back to settings. A hard navigation bypasses the cache, which is why Path B and a manual `goto('/book')` both succeed.

**Smallest possible patch** — `AccountSettingsClient.tsx:123`:

```ts
if (reasonAddress && addressData) {
  setTimeout(() => { window.location.href = '/book' }, 1200)
}
```

This is the convention CLAUDE.md already mandates for post-login redirects ("use `window.location.href`, not `router.push`") — the same class of bug, one file over. `router.refresh()` before `router.push` would also clear the cache.

**Persona cost** — The user is stranded on a settings page having just done what they were told, with no visible route back to booking. The wizard is three clicks away and unsignposted.

### H-4 — Two console warnings on every Maps-bearing page (hard gate)

| | |
|---|---|
| **Layer** | Architecture | **Severity** | High (hard gate: warnings > 0) |
| **Surface** | `/auth/register`, `/account/settings`, `/book` |

**Observed**
```
[WARNING] Google Maps JavaScript API has been loaded directly without
          loading=async. This can result in suboptimal performance.
[WARNING] As of March 1st, 2025, google.maps.places.Autocomplete is not
          available to new customers. Please use PlaceAutocompleteElement
          instead.
```

The second is a live forward-compatibility risk: the entire address-capture path — registration, account settings, and booking step 2 — is built on a widget Google has closed to new customers and will only bug-fix for major regressions.

**Smallest possible patch** — Short term, add `&loading=async` to the script URL in `AccountSettingsClient.tsx:136` (and the equivalent in `app/auth/register/page.tsx` and `StepScheduleLocation`), which clears warning 1. Warning 2 needs a migration to `PlaceAutocompleteElement`; schedule it, and note the migration touches all three surfaces plus the `.pac-container` positioning in H-2 (both fixes land in the same place).

---

## MEDIUM

| ID | Finding | Surface | Detail |
|---|---|---|---|
| M-1 | **"General Maintanance" misspelled in production** | `/book` dropdown, `/account/bookings`, review step | `service_types.name` is literally `General Maintanance`. The footer and landing page spell it correctly, so the *data* is wrong, not the copy. Row `335a44d5-…`; editable from `/admin/settings`. Appears on the primary revenue path. |
| M-2 | **Address labelled "(optional)" but hard-required to book** | `/auth/register`, `/account/settings` | Register says `(optional — needed to book)`. Settings shows the amber banner *"Please add your home address before booking"* directly above the helper *"Used for quick booking (optional)"* — contradiction visible in one glance. `middleware.ts:49-55` hard-blocks `/book` without it. My persona skipped it *because* it said optional. Fix: drop "(optional)", mark it required, and make it a required field at registration. |
| M-3 | **"✓ Address confirmed:" renders with an empty value** | `/account/settings` | `AccountSettingsClient.tsx:185` renders `✓ Address confirmed: {addressData.postal_code}`. Street-level Places results return no `postal_code` component, so line 83 falls back to `''`. Rendered DOM: `<p class="text-xs text-green-700">✓ Address confirmed: </p>`. DB after save: `postal_code: ""`. A green tick reads as success while the SG postal code — the key input for geographic clustering and route optimisation — is silently blank. Fix: fall back to `formatted_address`, or reverse-geocode lat/lng for the postal code, and don't render a bare colon. |
| M-4 | **Calendar days stay clickable at the 3-slot cap and silently do nothing** | `/book` step 2 | With 3 slots chosen, slot buttons correctly disable and show "(max reached)" plus a clear notice. But days 11–31 remain enabled; clicking day 20 does nothing at all — still "✓ 1 date preference selected". CLAUDE.md claims "Both conditions now disable calendar day cells"; shipped behaviour disables neither. Fix: apply the existing `totalSlots >= MAX_TOTAL_SLOTS` gate to the day-cell `disabled` prop in `SlotCalendar.tsx`. |
| M-5 | **`num_units` not clamped — 99 renders 99 dropdowns** | `/book` step 1 | Input has `min=1 max=20`, but React doesn't clamp. Typing `99` renders 99 room dropdowns and grows the page to 5190px. `validity.rangeOverflow` is true, but the wizard uses a Next button rather than native submit so nothing surfaces it, and no inline message states the limit. Fix: clamp in the change handler and show "Maximum 20 units". |
| M-6 | **Review step omits the room locations** | `/book` step 3 | The review lists Service, Category, Units, Schedule, Address, Unit/Floor, Access Notes — but not the rooms the user was *required* to select. Independent of C-1: even once saving is fixed, the user can't verify this before submitting. |
| M-7 | **Raw enum "Category MAINTENANCE" shown to customers** | `/book` step 3 | First-time-user lens: internal vocabulary leaking into customer-facing UI. Fix: map to "General maintenance", or drop the row entirely — the service name already conveys it. |
| M-8 | **No price shown for maintenance** | `/book` | Fault Repair displays `S$100.00`; General Maintanance shows nothing (`price_sgd: null`) and no price appears at review or on submission. The customer commits to a home visit with no idea of cost. Fix: set a price or an explicit "Quoted after inspection" label. |
| M-9 | **Login error not announced to assistive tech** | `/auth/login` | Error `<p>` has `role=null`, `aria-live=null`, and no live-region ancestor — screen-reader users get no signal that sign-in failed. Copy is also raw Supabase text: *"Invalid login credentials"*. Fix: `role="alert"`, and rewrite to "That email and password don't match. Check your password or create an account." |
| M-10 | **Footer offers "Sign In" / "Register" to signed-in users** | all authenticated pages | `PublicHeader` is auth-aware; the footer is not. A logged-in customer sees Sign In and Register in the Account column. |
| M-11 | **Touch targets below 44px on the primary mobile flow** | `/book` @375 | Service Type combobox `293×32`; **Back** `54×32`; **Next** `54×32`; a calendar nav arrow at `40×40`. My persona books one-handed on a phone. |
| M-12 | **"Next" collides with the fixed mobile bottom nav** | `/book` @375×812 | `CustomerBottomNav` (`md:hidden fixed bottom-0 z-50`) starts at y=755; Next spans 731→763 — the bottom **8px of a 32px button** is covered, leaving a 24px effective tap area. Fix: add `pb-24` to the wizard's bottom action row (or `padding-bottom` on the page shell under `md`). |
| M-13 | **axe: no `main` landmark on auth pages** | `/auth/login`, `/auth/register` | `landmark-one-main` (1 node) + `region` (9 nodes), both *moderate*. Landing page is clean (0 violations). Below the Critical/Serious hard gate but trivially fixable — wrap the auth card in `<main>`. |

## LOW

| ID | Finding | Detail |
|---|---|---|
| L-1 | **No `autocomplete` on auth inputs** | `/auth/login` `#email` `#password`, `/auth/register` `#name` `#phone` `#email` `#password` all have `autocomplete=""`. Chrome DevTools itself logs *'Input elements should have autocomplete attributes (suggested: "current-password")'*. Blocks password-manager autofill for a phone-first audience. Add `email`, `current-password`, `new-password`, `name`, `tel`. |
| L-2 | **Calendar day buttons expose no date context** | Accessible names are bare `"01"`, `"11"` — no weekday, month or year. Add `aria-label="Friday, 15 August 2026"`. |
| L-3 | **Slot toggles lack `aria-pressed`** | The 5 time-slot buttons are toggles with `aria-pressed: null`; AT users can't tell which are selected. The visible "(max reached)" text and disabled state are handled well — only the selected-state semantics are missing. |
| L-4 | **`Fault Repair.duration_minutes` is `null`** | The VRP route optimiser consumes duration. Maintenance has `60`; Fault Repair has `null`. Admin-side, out of this pass's scope, but flagged as a data-integrity risk to scheduling. |

---

## What passed (with proof)

- **Round-trip workflow integrity (Scenario 10) — PASS.** Submitting the booking redirected to `/account/bookings?success=1`, showed *"Booking submitted! We will review and confirm your date shortly."*, listed the booking as `PENDING` with the correct date and all three slots, and updated the header counters to "Total 1 / Upcoming 1" — all without a manual reload. Reschedule and Cancel affordances were present immediately.
- **Booking data integrity (except rooms) — PASS.** Persisted row: `booking_date 2026-08-15`, `time_slot S10_12`, `preferred_slots [S10_12,S13_15,S15_17]`, `preferred_date_slots` correct, `num_units 2`, address composed as `"#12-34, 123 Ang Mo Kio Ave 3, Singapore"`, `lat/lng` populated, `status PENDING`.
- **SGT past-date blocking — PASS.** On 11 Aug, calendar days 01–10 were `disabled`, 11–31 enabled.
- **3-slot cap — PASS (messaging).** At 3 slots the remaining slots disabled with an inline "(max reached)" suffix and the notice *"Maximum 3 time slots reached — remove a slot to add more."* (The day-cell half of the gate is M-4.)
- **Performance — PASS.** `/` LCP 1448ms, CLS 0, TTFB 44ms, 34 resources.
- **Responsive integrity — PASS.** No horizontal overflow at 375, 768 or 1440 on `/`, `/book`, or `/account/bookings` (`scrollWidth === innerWidth` at every width).
- **axe on `/` — PASS.** Zero violations of any impact.
- **Enter-to-submit on login — PASS.** Pressing Enter in the password field submits the form.
- **Home address preset — PASS.** Correctly prefilled `123 Ang Mo Kio Ave 3, Singapore` into booking step 2.
- **Reactive unit dropdowns — PASS.** Changing Number of Units re-renders exactly N room dropdowns; `Next` stays disabled until every unit has a room.

---

## Perfection roadmap

**Quick wins (24–48h)**
C-1 (one-word column fix + error check) · M-1 typo · M-2 "(optional)" copy · M-3 empty colon · M-7 raw enum · M-10 footer · M-12 `pb-24` · M-13 `<main>` · L-1 autocomplete attrs · H-4 part one (`&loading=async`)

**Structural (1–2 weeks)**
H-1 Installation service (product decision first) · H-2 Places dropdown collision · H-3 hard-navigation redirect · M-4 day-cell gate · M-5 clamp · M-6 review completeness · M-11 touch targets

**Advanced (post-launch)**
H-4 part two — migrate to `PlaceAutocompleteElement` across register / settings / booking (folds in H-2) · M-8 pricing model · L-2/L-3 calendar and slot ARIA semantics

---

## Method, coverage and caveats

**Interaction Manifest (abridged; all times UTC 2026-08-11)**

```
05:27:44  navigate /                          → 200, title OK
05:42:05  axe.run on /                        → 0 violations
05:42:47  navigate /services                  → 307 → /auth/login?redirect=/book
05:43:20  typed bad creds into #email/#password, pressed Enter
05:43:45  observed "Invalid login credentials" + allowlisted 400
05:44:37  navigate /auth/register
05:45:10  filled name/phone/email/password, clicked Create Account
05:45:27  observed "Check your email" verification gate
05:46:14  logged in as customer → redirected to /
05:46:44  clicked header Book Now → bounced to /account/settings?reason=address
05:47:30  typed address (slowly), pac dropdown opened with 5 items
05:48:00  measured pac/button overlap → 100% of Save covered
05:48:25  selected suggestion, filled #12-34, Save → "Profile saved successfully."
05:50:15  Save again, polled location 5s → no redirect (H-3, run 1)
05:51:54  reset profile to null, replayed Path A → no redirect (H-3, run 2)
05:53:09  /book: opened service dropdown → 2 options only (H-1)
05:54:16  selected service, set units=2 → 2 room dropdowns rendered
05:55:00  units=99 → 99 dropdowns, page 5190px (M-5)
05:55:52  selected Master Bedroom + Living Room
05:56:53  selected 15 Aug, then 3 slots → cap messaging correct
05:57:37  clicked day 20 at cap → silent no-op (M-4)
05:58:05  Home preset → address prefilled
05:58:54  Confirm Booking → /account/bookings?success=1, PENDING listed
05:59:30  DB verify → booking_unit_locations [] (C-1)
06:00:51  resized 375x812, re-ran layout + touch-target detection
06:01:20  measured Next vs fixed bottom nav → 8px covered (M-12)
06:02:00  cleanup: booking, profile, auth user deleted
```

Screenshots: 7 (`01-landing-1440`, `02-login-error-1440`, `03-register-before-submit`, `04-settings-address-contradiction`, `05-pac-covers-save-button`, `06-review-step`, `07-book-375`) in `/root/.claude/jobs/54577361/tmp/audit/`.

**Test data cleanup — complete.** Booking `cd62307c…`, profile and auth user `260fc60b…` (`otherofacc+uxaudit@gmail.com`) all deleted; `bookings?notes=like.*UXAUDIT*` returns `[]`. One real email was sent to the admin address by the booking-received handler at 05:58:54.

**Coverage gaps — stated plainly, not papered over:**
- **7 screenshots for 7 routes.** The skill's plausibility bar is 2× routes (14). Visual evidence is thinner than the standard; DOM/geometry probes and DB queries carry most of the proof instead.
- **Scenarios not run:** 4 (Returning User), 6 (Heavy Data — needs a 500-row seed), 7 (Destructive Confidence — would require cancelling/deleting against live data), 8 (Second User / role), 9 (Lifecycle position), 11 (Data seasoning). Scenarios 1, 2 (partial), 3, 5 (partial) and 10 were exercised.
- **Stress recipes not run:** reduced-motion, offline, print, high-contrast, i18n, 3G throttle, and the real-flavour data battery (apostrophes/accents/RTL, XSS canaries, oversized uploads) — the last is a notable gap given step 1 accepts 5 × 20MB file uploads that I never exercised.
- **Not audited:** `/account/contracts`, `/auth/reset-password`, and the entire admin surface (11 routes), per the agreed scope.
- **Self-critique pass was done in-context, not by a fresh sub-agent** (agent spawning is not enabled in this session). Drafted 26 → kept 22 → dropped 4: the hidden shadcn UUID input (verified `aria-hidden`/`tabindex=-1`/clipped — not a real defect), two "Deprecated API for given entry type" warnings traced to my own `getEntriesByType` instrumentation, and the Supabase `400` on a deliberate wrong-password login (expected browser resource-load noise, allowlisted). An in-context critique is structurally weaker than a fresh reviewer — treat the Medium/Low tier as less pruned than the Critical/High tier.

---

## Hold this in your hands

This one feels like a well-made cabinet with a drawer that doesn't connect to anything. The craft is genuinely there — the calendar's slot cap explains itself in plain language, the past-date blocking is timezone-correct, the booking round-trip lands you back on your bookings list with the counters already updated and no jarring reload, nothing overflows at 375px, and the landing page paints in under a second and a half with zero layout shift. Somebody cared. But the app asks you, insistently and with red asterisks, which rooms your aircon units are in — and then throws the answer away, every time, and has done since May. That single fact reframes the rest: the polish is real but it's surface, and nobody has walked the whole path with a stopwatch and a database query open. Add the "optional" field you can't book without, the Save button hiding under Google's own dropdown, and the Installation service advertised on the front page but absent from the only place you could buy it, and the pattern is clear — the seams between the screens are where this breaks, not the screens themselves. Would I want to hold it? Nearly. Fix C-1 this afternoon and the cabinet's drawer connects; fix the four Highs and I'd be glad to hand it to a customer.

---

# Phase 7 — Fix and verify (2026-08-11, same session)

Branch: `fix/ux-audit-2026-08-11`. Re-walked on `localhost:3000` against the **same production
Supabase project**, with a fresh pre-confirmed test customer (`customer_no 18`), then deleted.

## Verified fixed

| ID | Fix | Verification |
|---|---|---|
| **C-1** | `location_id` (was `unit_location_id`) + `{ error }` now checked and surfaced as 500 — `app/api/bookings/route.ts:164-176`. Same column bug fixed on the **read** path at `app/api/bookings/[id]/route.ts:25-33`, which feeds the `?repeat=[id]` prefill. | Booked 2 units (Master Bedroom, Living Room) → `booking_unit_locations` returned 2 rows resolving to exactly those labels. Previously `[]`. |
| **H-3** | `window.location.href = '/book'` replaces `router.push` — `AccountSettingsClient.tsx:122-127`. | Replayed the true first-time path (fresh user, `address: null`) → after Save, polled `location.pathname` for 4s: `/book` at 0ms. Previously stuck on `/account/settings` for 6s. |
| **M-1** | `service_types.name` corrected to "General Maintenance" (data fix, applied to production DB). | Dropdown now reads `General Maintenance`. |
| **M-2** | Address label is now `Home Address *` with helper "Required before you can book a service"; register helper reworded to "add it now, or you'll be asked before your first booking". | `optionalStillPresent: false`. |
| **M-3** | `✓ Address confirmed{postal_code ? ': Singapore ' + postal_code : ''}` — no dangling colon. | Rendered `"✓ Address confirmed"` for a street-level Place with no postal code. |
| **M-4** | Day-cell `atMax` now includes `totalSlots >= MAX_TOTAL_SLOTS`, matching the desktop grid at line 186 — `SlotCalendar.tsx:246`. | At the 3-slot cap only the selected day 15 stays enabled; day 20 is `disabled`, `opacity 0.4`, `cursor: not-allowed`. Previously all 21 days enabled and clicking was a silent no-op. |
| **M-5** | `num_units` clamped to 1–20 in the change handler + "Up to 20 units per booking." hint. | Typing `99` yields value `20` and 20 room dropdowns. Previously 99 dropdowns / 5190px page. |
| **M-6** | Review resolves `unit_location_ids` → labels via `ac_unit_locations` and shows a **Rooms** row (incl. "Others" free text). | Review shows `Rooms Master Bedroom, Living Room`. |
| **M-7** | `CATEGORY_LABELS` maps the raw enum. | Review shows `Category General maintenance` (was `MAINTENANCE`). |
| **M-9** | `role="alert"` on the login error + human copy replacing Supabase's string. | `role: "alert"`, `inLiveRegion: true`, text "That email and password don't match. Check your password, or create an account if you haven't yet." |
| **M-10** | Footer Account column branches on `user`. | Signed in: My Bookings / Contracts & Invoices / Settings. Signed out: Sign In / Register. |
| **M-12** | `<main>` padding `pb-14` → `pb-24` (nav is 57px; 56px was 1px short). | Next button overlap with the fixed bottom nav: **0px** (was 8px). |
| **M-13** | `<main>` + `<aside>` landmarks on the login page. | `/auth/login` axe: **0 violations** (was 2 rules / 10 nodes). |
| **L-1** | `autoComplete` added: login `email` / `current-password`; register `name` / `tel` / `email` / `new-password`. | Verified on the DOM. |
| **H-4a** | `&loading=async` added to all 7 Maps JS loads (5 customer + 2 admin). | Clears the "loaded directly without loading=async" warning. |
| *bonus* | Footer copyright was `text-slate-400`, violating CLAUDE.md's own documented WCAG-AA rule for the navy footer. Now `text-slate-300`. | Verified `text-slate-300`. |

## Still open (deliberately not attempted this pass)

- **H-1 Installation not bookable** — needs a product decision (add the service type vs. remove the advertising). One-line DB insert either way, but not mine to choose.
- **H-2 Places dropdown covers Save** — structural; best fixed together with the `PlaceAutocompleteElement` migration rather than patched twice.
- **H-4b** — the deprecated `places.Autocomplete` widget itself. Still warns; still the long pole.
- **M-8** pricing, **M-11** touch targets (32px controls), **L-2/L-3** calendar/slot ARIA, **L-4** null `duration_minutes`.
- Cosmetic follow-up introduced by M-7: review now reads "Service: General Maintenance / Category: General maintenance" — near-duplicate. Consider dropping the Category row.

## Gates after fixes

```
npx tsc --noEmit         clean
npx eslint <14 changed>  clean (0 errors, 1 pre-existing unused-var warning)
npm run build            succeeds
npx jest lib/            3 suites, 21 tests passed
```

`npx jest` at the repo root reports 36 failing suites — these are Playwright `e2e/*.spec.ts` files
inside `.claude/worktrees/hydrowash-public-redesign/` being picked up by the Jest matcher.
Pre-existing config issue, unrelated to these changes; the real unit suites all pass.

**Test data:** both audit customers and their bookings deleted. `booking_unit_locations` back to `[]`,
`profiles?name=like.ZZ*` returns `[]`. Two real "booking received" emails reached the admin address
(05:58 and 06:38 UTC).

---

# Phase 8 — Admin surface audit + Places migration attempt (2026-08-11)

## H-2 / H-4b — migration written, BLOCKED on a Google Cloud setting

Branch `chore/places-api-new-migration` (commit `c0f6c9e`), deliberately kept OFF
`fix/ux-audit-2026-08-11` because **deploying it as-is would break address entry
everywhere**.

All 5 legacy `places.Autocomplete` call sites (register, account settings, booking
step 2, customer contract request, admin contract create) were consolidated into one
`<AddressAutocomplete>` component using `PlaceAutocompleteElement`.

Verified locally:
- The Google Maps deprecation warning and the `loading=async` warning are both **gone**
  (console on /auth/register: 0 errors, 1 warning — an unrelated Next.js `sizes` hint).
- The element renders correctly configured: `included-region-codes="sg"`, `requested-region="sg"`,
  48px tall.

**Blocker:** every keystroke returns

```
403  Places API (New) has not been used in project 866927000260 before or it is disabled.
     https://places.googleapis.com/$rpc/google.maps.places.v1.Places/AutocompletePlaces
```

`PlaceAutocompleteElement` calls `places.googleapis.com` (Places API **New**); the legacy
widget used the old Places API, which is the one enabled on the project. Enable it at
https://console.developers.google.com/apis/api/places.googleapis.com/overview?project=866927000260
(note: Places API New has its own pricing), then the branch needs a re-verify before merge.

**Also discovered:** the widget uses a **closed shadow root**. Playwright cannot see or
drive its inner input, and the field does not appear in Playwright's ARIA snapshot. Any
e2e coverage of address entry needs a different approach. Whether real screen readers
expose it (they normally do for closed shadow content) was NOT independently verified —
that check should happen before merge.

## M-11 / L-2 / L-3 — fixed and verified (commit `b94871e`)

- `SelectTrigger` was `h-8` (32px) app-wide → now `h-11` under `md`, `h-8` from `md` up,
  so admin desktop density is unchanged. Measured: 293x44 at 375px, 446x32 at 1440px.
- Wizard Back/Next 54x32 → `min-h-[44px] px-6`.
- Calendar day cells → `min-h-[44px]`; measured 62x44.
- Day buttons gained `aria-label` ("Saturday, 15 August 2026") and `aria-pressed`.
- Slot toggles gained `aria-pressed`; verified exactly one `true` after selecting 13:00–15:00.

Still under 44px on mobile (lower priority, not fixed): the HydroWash logo link (32px),
one 40px icon button, and inline footer text links (19px).

## NEW — Admin surface audit (first pass ever; 8 of 11 routes)

Audited as the real admin account, read-only (no approve/reject/delete against live data).

| Route | axe Critical | axe Serious | Overflow |
|---|---|---|---|
| `/admin` | — | color-contrast:2, heading-order:1 (moderate) | none |
| `/admin/bookings` | — | color-contrast:2, label-title-only:1 | none |
| `/admin/agenda` | — | color-contrast:1, **link-name:2** | none |
| `/admin/customers` | — | color-contrast:1 | none |
| `/admin/invoices` | **label:4** | color-contrast:1 | none |
| `/admin/contracts` | **label:4** | color-contrast:1 | none |
| `/admin/settings` | **label:6** | color-contrast:1 | none |
| `/admin/availability` | **button-name:2** | color-contrast:1 | none |

Not reached: `/admin/contracts/[id]`, `/admin/customers/[id]`, `/admin/schedule/[date]`.

### A-1 — Unlabelled form inputs across admin (Critical, hard gate)
14 inputs with no accessible label at all: 4 on `/admin/invoices`, 4 on `/admin/contracts`,
6 on `/admin/settings`. On invoices/contracts these are the `<input type="date">` range
filters (created-from/to, paid-from/to, start/expiry/next-due) — a screen reader announces
four identical "date" fields with no way to tell which is which.
Fix: `<Label htmlFor>` or `aria-label` on each. These are base-ui generated ids
(`#base-ui-_R_6d9bn5rl5rlb_`), so the label must be wired explicitly.

### A-2 — Icon-only buttons and links with no accessible name (Critical/Serious)
`button-name:2` on `/admin/availability` (calendar prev/next chevrons) and `link-name:2`
on `/admin/agenda`. Keyboard/screen-reader users get "button" / "link" with no purpose.
Fix: `aria-label="Previous month"` etc.

### A-3 — "← Site" link fails contrast on EVERY admin page (Serious, hard gate)
`.text-slate-500` on the dark navy admin bar: **4.15:1**, needs 4.5:1
(`#62748e` on `#020b16`). Present on all 8 audited routes — one shared component.
This is the same class of bug as the footer `text-slate-400` fixed in `85f573d`, and
CLAUDE.md already documents the rule ("use text-slate-300 on bg-primary"). The admin bar
never got the memo. One-line fix, clears a hard gate on 8 routes at once.

### A-4 — `/admin` dashboard card subtitle fails contrast (Serious)
`.text-white/70` on `bg-accent`: **4.03:1** (`#b3d0e2` on `#00629d`), e.g. "Approve, reject,
and cluster maintenance". Fix: `text-white/85` or solid white.

### A-5 — Admin lands on the marketing page after sign-in (Medium)
Signing in as `role: admin` redirects to `/`, the public landing page, not `/admin`.
The owner's first action every session is a manual nav. `app/auth/login/page.tsx`
resolves `destination` from `?redirect` else `/`; it never branches on role.

## Coverage still outstanding after this pass

- `/account/contracts`, `/auth/reset-password` — still unaudited.
- `/admin/contracts/[id]`, `/admin/customers/[id]`, `/admin/schedule/[date]` — not reached.
- The admin pass was **static-quality only** (axe, contrast, overflow). No interaction
  testing: approve/reject, bulk approve, the route optimiser, JobCompletionDialog's 3-step
  work-order flow, PDF generation, or mark-paid were all left untouched because they mutate
  live business records and send real customer emails. That is the largest remaining gap
  and needs either a staging database or explicit permission to write to production.
- File-upload battery on booking step 1 (5 x 20MB) — still never exercised.
- Scenarios 4, 6, 7, 8, 9, 11 — still not run.

---

# Phase 9 — Places unblocked + admin remediation (2026-08-11)

## H-2 / H-4b — RESOLVED and merged

Places API (New) was enabled on project 866927000260. Re-verified on `/auth/register`:
**0 console errors** (was 40x 403), typing returns predictions, and keyboard selection
(ArrowDown + Enter) resolves the place — "✓ Address confirmed" renders and the
Unit/Floor + Building Name fields reveal, proving `gmp-select` → `toPlace()` →
`fetchFields` works end to end. Keyboard operability is a bonus a11y win over the
old widget. Merged to `fix/ux-audit-2026-08-11` as `b1b79cc`.

Still open on this: the widget's **closed shadow root** means Playwright cannot drive
the inner input, so address entry remains un-coverable by e2e tests, and whether real
screen readers expose the field was still not independently verified.

## Admin remediation — all Critical/Serious cleared (commit `c6f4080`)

| Route | Before (Crit / Serious) | After |
|---|---|---|
| `/admin` | 0 / color-contrast:2 | 0 / 0 (1 moderate heading-order remains) |
| `/admin/bookings` | 0 / color-contrast:2, label-title-only:1 | **0 / 0** |
| `/admin/agenda` | 0 / color-contrast:1, link-name:2 | **0 / 0** |
| `/admin/customers` | 0 / color-contrast:1 | **0 / 0** |
| `/admin/invoices` | **label:4** / color-contrast:1 | **0 / 0** |
| `/admin/contracts` | **label:4** / color-contrast:1 | **0 / 0** |
| `/admin/settings` | **label:6** / color-contrast:1 | **0 / 0** |
| `/admin/availability` | **button-name:2** / color-contrast:1 | **0 / 0** |

A-1 (14 unlabelled inputs), A-2 (icon-only buttons/links), A-3 ("← Site" at 4.15:1 on
every page), A-4 (dashboard subtitles), A-5 (admin landing on the marketing homepage —
now lands on `/admin`) are all fixed and verified. A extra find during remediation:
"Loading map…" placeholders were `text-slate-400` on `bg-slate-100` = **2.4:1** in four
components; now `text-slate-600`.

Gates: `tsc --noEmit` clean · `npm run build` succeeds · `npx jest lib/` 21/21.
The 4 remaining eslint errors in touched admin files (`set-state-in-effect` x3,
`no-explicit-any` x2) were confirmed pre-existing by linting `main`'s version.

## Remaining open after Phase 9

**Findings not fixed**
- M-8 no price shown for maintenance bookings.
- L-4 `Fault Repair.duration_minutes` is null and feeds the VRP optimiser.
- `/admin` moderate `heading-order` (h3 before h2).
- Sub-44px targets on mobile: HydroWash logo link (32px), one 40px icon button,
  inline footer text links (19px).
- Cosmetic: booking review reads "Service: General Maintenance / Category: General
  maintenance" — near-duplicate since the M-7 fix.

**Never audited**
- `/account/contracts`, `/auth/reset-password`.
- `/admin/contracts/[id]`, `/admin/customers/[id]`, `/admin/schedule/[date]`.
- **All admin write flows** — approve/reject, bulk approve, route optimiser,
  JobCompletionDialog's 3-step work order, PDF generation, mark-paid. These mutate live
  business records and email real customers; they need a staging database or explicit
  permission to write to production. This is the single largest remaining gap.
- File-upload battery on booking step 1 (5 x 20MB).
- Scenarios 4 (returning user), 6 (heavy data), 7 (destructive confidence),
  8 (second user / role), 9 (lifecycle position), 11 (data seasoning).

---

# Phase 10 — Admin write flows (production, authorised)

Run against the live database with permission. To avoid emailing real customers,
a dedicated test customer (`otherofacc+uxaudit@gmail.com`, `customer_no` assigned
at seed) and 4 test bookings were created; every write below targeted only those
records. All deleted afterwards — `profiles?name=like.ZZ*`, `bookings?notes=like.*UXAUDIT*`
and the test invoice all return `[]`.

## Flows verified WORKING

| Flow | Evidence |
|---|---|
| **Approve booking** | Set confirmed date + slot → Approve. DB: `status APPROVED`, `confirmed_date 2026-08-19`, `confirmed_slot S15_17`. |
| **Job completion, 3-step** | Step 1 → 2 → 3 traversed; `save_only` at step 2 wrote `job_completions` without changing booking status (as designed). |
| **Work order send** | "Confirm & Send" → `status COMPLETED`, `work_order_no 11` auto-assigned by the DB trigger, PDF generated, customer emailed with no errors. |
| **Auto-invoice on completion** | Invoice created: S$150, `UNPAID`, description "Work Order #11", `contract_id null`. |
| **Mark invoice paid** | Dialog → Confirm Payment. DB: `status PAID`, `payment_method Cash`, `paid_at` stamped. |
| **Route optimiser** | 2 approved jobs, distinct coordinates → `POST /api/optimize` 200 → optimised stop order rendered with per-leg drive times ("19 min drive from prev"). |

## NEW findings

### B-1 — /admin/bookings map never rendered at all (High, pre-existing)
After 5s on the page: `hasMaps: true`, `hasPlaces: false`, no `.gm-style` canvas,
"Loading map…" still on screen. `useMapsLoaded()` waits for `google.maps.places`,
but `AdminBookingsClient` loads the script without `&libraries=places`. The entire
maintenance map — pin↔card sync, InfoWindow popups, geographic clustering, all
documented as working in CLAUDE.md — was unreachable. **Fixed** (`813fc3a`):
`useMapsLoaded(requirePlaces = true)`, BookingsMap passes `false`. Verified: canvas
renders with 73 map elements.

### B-2 — Route optimiser crashed (High, REGRESSION I introduced, now fixed)
`window.google.maps.Map is not a constructor`. Adding `&loading=async` in `85f573d`
made the script's `onload` fire before the API surface exists, and RouteMap set
`ready` on `onload`. **Fixed** (`813fc3a`): awaits `google.maps.importLibrary('maps')`.
Verified working. Worth noting the audit itself caused this and the audit caught it —
any `loading=async` change needs a map render check, not just a console check.

### B-3 — Work order Step 1 has NO validation (High)
"Next: Pricing" is enabled with every Step-1 field blank. A complete work order can be
generated, marked COMPLETED, invoiced and **emailed to the customer** with:
`attended_by: ""`, `time_arrived: ""`, `time_completed: ""`, both AC units
`{brand:"", model:"", location:"", serial_no:""}`, and every checklist item `false`.
Only the base price gates progress (Step 2's button is correctly disabled without it).
Verified end to end — that exact blank work order was sent and invoiced for S$150.
Fix: require `attended_by`, times, and per-unit brand/model before allowing Step 1 → 2.

### B-4 — axe Critical inside JobCompletionDialog (Critical)
`label:3` and `select-name:6`. The per-unit Brand / Model / Location dropdowns (2 units
x 3 selects) have no accessible names, plus 3 unlabelled inputs. This is the densest
data-entry surface in the product and was not covered by the Phase 9 sweep because it
only exists inside an open dialog. NOT FIXED.

### B-5 — axe Critical on /admin/schedule/[date] (Critical)
`label:1` — the date picker input. NOT FIXED.

### B-6 — Booking cards render twice with independent state (Low)
Each booking renders in both the desktop sidebar and the mobile bottom sheet, so
`[data-job-id]` matches two nodes and `document.querySelector` hits the hidden one.
Setting the confirmed date on one copy does not reflect in the other. Harmless for
users (only one is visible) but it breaks `scrollIntoView` pin↔card sync targeting and
makes the surface hard to test.

## Still not done

- **Reject booking** and **bulk approve** — not exercised.
- **Contract lifecycle** — create → set price → PDF + email → mark paid → activate:
  not exercised.
- `/admin/contracts/[id]`, `/admin/customers/[id]` — still unaudited.
- `/account/contracts`, `/auth/reset-password` — still unaudited.
- File-upload battery (5 x 20MB) on booking step 1 — still never exercised.
- Scenarios 4, 6, 7, 8, 9, 11.

---

# Phase 11 — Remediation of the admin write-flow findings (commit `a36d9bd`)

| ID | Fix | Verification |
|---|---|---|
| **B-3** | "Next: Pricing" gated on `attended_by`, both times, and brand+model per unit, with an inline list of what's missing. | Button `disabled: true`; message reads "Still needed before you can price this job: attended by, time arrived, time completed, brand and model for 2 units." |
| **B-4** | `aria-label` on all 6 per-unit selects (mobile + desktop layouts); `htmlFor`/`id` on Attended By / Time Arrived / Time Completed and the Job Description / Job Rendered / Remarks textareas. | JobCompletionDialog axe: **0 Critical, 0 Serious, 0 Moderate** (was label:3 + select-name:6). |
| **B-5** | `aria-label="Schedule date"` on the `/admin/schedule/[date]` date picker. | — |

## Second-order bug found and fixed during this pass

The Phase 10 fix to `useMapsLoaded` gated on the *presence* of `window.google.maps`.
Under `loading=async` that namespace exists before the library is populated, so
`BookingsMap` crashed on `google.maps.SymbolPath.CIRCLE` and took the entire
`/admin/bookings` route down with "This page couldn't load" — worse than the original
symptom. `useMapsLoaded` now awaits `importLibrary('maps')` (and `'places'` when
required), matching the RouteMap fix. Verified: page renders, map canvas present,
0 console errors.

Worth recording as a pattern: **every `loading=async` change needs a rendered-map
check.** Three separate bugs in this area (B-1, B-2, and this one) all passed a
console-only or presence-only check and still failed in the browser.

Gates: `tsc --noEmit` clean · `npm run build` succeeds · `npx jest lib/` 21/21.
Test data removed — `profiles?name=like.ZZ*`, `bookings?notes=like.*UXAUDIT*` and the
test invoices all return `[]`.

## Open after Phase 11

- **B-6** booking cards render twice with independent state (Low).
- **Reject booking**, **bulk approve**, and the full **contract lifecycle**
  (create → set price → PDF + email → mark paid → activate) — still not exercised.
- `/admin/contracts/[id]`, `/admin/customers/[id]`, `/account/contracts`,
  `/auth/reset-password` — still unaudited.
- File-upload battery (5 x 20MB) on booking step 1 — still never exercised.
- Scenarios 4, 6, 7, 8, 9, 11.
- M-8 (no price shown for maintenance), L-4 (`Fault Repair.duration_minutes` null),
  `/admin` moderate `heading-order`, sub-44px logo/footer links.

---

# Phase 12 — Contract lifecycle + final unaudited routes (commit `6b5e9e2`)

## Contract lifecycle — verified working end to end

Exercised against production with a seeded test customer (deleted afterwards).

| Step | Result |
|---|---|
| PENDING_REVIEW contract | Renders with "Price TBD", Set Price / Reject / Edit / Deactivate actions |
| **Set Price** (S$480) | → `AWAITING_PAYMENT`, `price_sgd 480`, `start_date` saved. Contract PDF + PayNow QR generated and emailed in the same request; no server errors. |
| **Mark Paid & Activate** | Confirms via native dialog → `ACTIVE`, and **4 quarterly `contract_service_dates` generated at correct 3-month intervals** (2026-11, 2027-02, 2027-05, 2027-08) with `second_reminder_sent false`. |

The `?` guard on `price_sgd` renders "TBD" correctly for PENDING_REVIEW, as documented.

## Findings fixed

### C-7 — "Set Price" button failed contrast (Serious)
White on `bg-green-600` = **3.24:1**. This is the primary action on the money path.
Raised to `green-700/800`, and applied to every `bg-green-600` action button in the
app (`/admin/invoices`, `InvoiceRow`) so the money actions stay consistent.

### C-8 — Set Price dialog: label:2 (Critical)
Price and confirmed-start-date inputs unlabelled. Added `htmlFor`/`id` (plus notes).

### C-9 — /auth/reset-password had no landmarks, no h1, and unreadable errors
No `<main>`, the visible heading was an `h2` so the page had no `h1`, `region:3`,
and the error text failed contrast. Wrapped in `<main>`, promoted to `h1`, darkened
to `red-800`, and added `role="alert"` to both error states — a user whose reset link
has expired now gets that announced rather than silently rendered.

### C-10 — /account/contracts: label:2 + 4x contrast (Critical/Serious)
Invoice date-range filters unlabelled; "Upcoming" badge slate-500 on slate-100.

### Also
`text-gray-400` table headers and the "No invoices yet." empty state on the contract
detail page were 2.6:1 → `text-gray-600`.

## Route coverage — final state

Every route in the app now reports **0 Critical / 0 Serious** under axe:

Public/customer: `/`, `/auth/login`, `/auth/register`, `/auth/reset-password`,
`/book`, `/account/bookings`, `/account/contracts`, `/account/settings`
Admin: `/admin`, `/admin/bookings`, `/admin/agenda`, `/admin/availability`,
`/admin/customers`, `/admin/customers/[id]`, `/admin/contracts`,
`/admin/contracts/[id]`, `/admin/invoices`, `/admin/settings`,
`/admin/schedule/[date]`
Dialogs: JobCompletionDialog, Set Price dialog, Mark Paid dialog

Only remaining axe finding anywhere: `/admin` `heading-order` (moderate, h3 before h2).

## Still open

- **Reject booking** and **bulk approve** — the last two untested admin writes.
- **B-6** booking cards render twice with independent state (Low).
- File-upload battery (5 x 20MB) on booking step 1 — never exercised.
- Scenarios 4 (returning user), 6 (heavy data), 7 (destructive confidence),
  8 (second user / role), 9 (lifecycle position), 11 (data seasoning).
- M-8 (no price shown for maintenance bookings), L-4 (`Fault Repair.duration_minutes`
  null feeds the VRP), `/admin` heading-order, sub-44px logo and footer links.
- Closed-shadow-DOM address widget remains undrivable by Playwright — address entry
  cannot be covered by e2e tests.

---

# Phase 13 — Last untested write flows + the file-upload battery

Run on `localhost:3000` against the production Supabase project, as the real admin and a
seeded test customer (`otherofacc+uxaudit13@gmail.com`, 3 PENDING bookings). All deleted
afterwards.

## D-1 — Bulk approve reported success while approving nothing, and emailed customers anyway (CRITICAL)

| | |
|---|---|
| **Layer** | Architecture / Feedback |
| **Severity** | Critical |
| **Surface** | `POST /api/bookings/bulk-approve` |

**Reproduce**
1. Seed two PENDING maintenance bookings.
2. `POST /api/bookings/bulk-approve` with both ids, `confirmed_date: '2026-08-27'`,
   `confirmed_slot: 'S10_12'` — i.e. the normal "approve this batch onto one slot" call.
3. Query the bookings.

**Observed** — `200 {"approved":2,"excluded":[]}`. Both bookings still `PENDING`,
`confirmed_date` still `null`. Approval emails were dispatched to the customer regardless.

**Root cause** — Identical in shape to C-1, the Critical that opened this audit: an
unchecked write. `bookings_confirmed_slot_unique` allows only one APPROVED booking per
`(confirmed_date, confirmed_slot)`, so applying one slot to several bookings always
violates it. Reproduced directly against PostgREST:

```
PATCH bookings?id=in.(...)  →  409
23505  duplicate key value violates unique constraint "bookings_confirmed_slot_unique"
       Key (confirmed_date, confirmed_slot)=(2026-08-27, S10_12) already exists.
```

The route never destructured `{ error }` from the update, then reported
`approved: bookings.length` — the number it *intended* to approve — and emailed every
customer in the batch. The customer is told a date is confirmed that the admin's own
dashboard still shows as pending.

**Fixed** — `app/api/bookings/bulk-approve/route.ts`: the slot+multi-booking combination
now fails fast with a 409 and an actionable message; the update destructures and checks
`error`; `approved` counts rows actually returned by `.select('id')`; emails are sent only
to customers whose booking id came back from the update.

**Verified** — collision call → `409 "Only one booking can hold a given date and time slot…"`,
nothing mutated, no emails. Valid call (date only, no slot) → `200 {"approved":2}` and both
rows genuinely `APPROVED` with `confirmed_date 2026-08-27`.

Worth noting this endpoint has **no UI caller** — CLAUDE.md documents "No bulk-approve" on
the Maintenance tab. It is live and reachable, so it was worth fixing, but nobody would
have found this through the app.

## D-2 — Photo uploads failed for ordinary filenames (High)

**Reproduce** — `/book` step 1 → attach a photo named `façade's photo #1 [50%].jpg`.

**Observed** — `Upload failed: Invalid key: 7f7ea188…/1786453826674/façade's photo` — the raw
Supabase Storage error, surfaced to the customer, with no guidance and nothing uploaded.
The storage key was built as `${prefix}/${file.name}`, and Storage rejects apostrophes,
accents and most punctuation. Any photo off a phone with a name like `Mum's aircon.jpg` or
`café.jpg` fails.

**Fixed** — the key is now derived (`${i}-${random}.${sanitised-ext}`) instead of trusting
the filename; collisions are impossible too. **Verified** — the same file uploads cleanly.

## D-3 — Files past the 5-file cap were dropped in total silence (Medium)

Selecting 6 photos uploaded 5. No message, no counter change, nothing — the 6th simply
never existed. `files.slice(0, remaining)` with no notice.

**Fixed** — "Only the first N files were added — maximum 5."

**Second-order bug found while verifying the fix:** the message still didn't appear. The
upload error `<p>` was rendered *inside* the `{existingUrls.length < MAX_FILES && (…)}`
block, so the picker — and the error region with it — unmounts at exactly the cap where
the message fires. The pre-existing `Maximum 5 files allowed.` error at the top of the
handler was therefore **unreachable code**: it could only fire in a state where its own
renderer was unmounted. Moved the message outside the block and gave it `role="alert"`.
**Verified**: 6 files → 5 thumbs + visible "Only the first 5 files were added — maximum 5."

## D-4 — One oversized file discarded the whole selection (Medium)

Attaching a valid photo alongside a 21 MB one rejected **both**, with
"Files must be under 20 MB each." and no indication which file was the problem.

**Fixed** — oversized files are filtered out by name, the valid ones still upload.
**Verified** — 3 files in (bad name, 21 MB, valid) → 2 uploaded, message reads
`big21.jpg — over 20 MB, not added.`

## Findings from the previous phases now closed

| ID | Fix | Verification |
|---|---|---|
| **M-8** | Maintenance had no price anywhere. Service dropdown now reads "General Maintenance — quoted on site"; the review step gained a **Price** row. | Dropdown and review both verified; review shows `Price / Quoted after on-site inspection`. |
| **L-4** | `Fault Repair.duration_minutes` was `null` and fed the VRP (which silently defaulted to 60). Set to 60 explicitly in production. | `duration_minutes: 60`. |
| **B-6** | The pin↔card scroll used `document.querySelector`, which returned whichever of the two copies (mobile sheet / desktop sidebar) came first — often the hidden one. Now picks the copy that is actually laid out. | Confirmed 2 copies exist, `visible: [false, true]`; the fix selects index 1. The duplication itself remains — deduping means restructuring both layouts. |
| **`/admin` heading-order** | The two quick-action cards were `h3` directly under the page `h1`. Now `h2`. | `/admin` axe: **0 violations of any impact** — the last axe finding anywhere in the app. |
| **Sub-44px targets** | Header logo link `min-h-11`; footer links `inline-flex min-h-11` below `md`, spacing collapsed to keep the footer compact. | @375: logo 145x44, all 6 footer links 44px tall, no horizontal overflow. @1440: links back to 20px rows, footer height unchanged at 282px. |
| **Cosmetic (from M-7)** | Review read "Service: General Maintenance / Category: General maintenance". Category is now dropped when it merely restates the service name, and kept where it earns its place (fault repairs). | Review shows Service, Price, Units, Rooms — no duplicate. |

## Flows verified working (not previously exercised)

- **Reject booking** — the Reject button reveals a reason field and a separate "Confirm
  Rejection" button, so it is a genuine two-step destructive confirm (Scenario 7 passes
  here). DB after: `status REJECTED`, reason stored verbatim. The card left the PENDING-filtered
  list without a reload.
- **Bulk approve** — see D-1. Now correct on both the collision and the valid path.
- **Admin post-login destination** — still lands on `/admin` (A-5 holding).
- **Admin maps** — `/admin/bookings` map canvas renders (B-1/B-2 fixes holding).

## NEW — still open

### D-5 — `google.maps.Marker` deprecation warning on every admin map page (High, hard gate)

```
[WARNING] As of February 21st, 2024, google.maps.Marker is deprecated.
          Please use google.maps.marker.AdvancedMarkerElement instead.
```

Console warnings must be 0, so this fails the gate. **Not fixed, deliberately.** The
migration needs a Map ID provisioned in Google Cloud (`AdvancedMarkerElement` will not
render without one) and means dropping `@react-google-maps/api`'s `<Marker>` wrapper in
`BookingsMap` plus the two `new google.maps.Marker` call sites and `SymbolPath.CIRCLE`
icons in `RouteMap`. That is the same shape as the H-4b blocker — an owner-side console
setting first, then a branch of its own. Three separate bugs in this area (B-1, B-2, and
the Phase 11 second-order one) all passed a console-only check and still failed in the
browser, so this one should not be rushed at the end of a session.

Mitigating: Google states Marker is *not* scheduled for discontinuation and will keep
receiving bug fixes for major regressions — unlike `places.Autocomplete`, which was closed
to new customers and was the reason H-4b was urgent.

## Gates after fixes

```
npx tsc --noEmit         clean
npx eslint <7 changed>   2 errors + 1 warning — all confirmed pre-existing by linting
                         the stashed HEAD version of the same files (no new issues)
npm run build            succeeds
npx jest lib/            3 suites, 21 tests passed
```

**Test data removed and verified empty:** `bookings?notes=like.*UXAUDIT*` → `[]`,
`profiles?name=like.ZZ*` → `[]`, no auth user matching `uxaudit`, and the `booking-media`
storage bucket root lists `[]` (no orphaned uploads from the battery). Emails that really
went out: one rejection and two approvals, all to the test address.

## Open after Phase 13

- **D-5** `google.maps.Marker` migration (needs a Google Cloud Map ID first).
- **B-6** the underlying duplicate render of every booking card (the sync bug it caused is
  fixed; the duplication is not).
- Scenarios 4 (returning user), 6 (heavy data), 7 (destructive confidence — partially
  covered now via Reject), 8 (second user / role), 9 (lifecycle position), 11 (data seasoning).
- Closed-shadow-DOM address widget still undrivable by Playwright.
- `/admin/bookings` reject/approve still send real customer email — there is no staging
  database, so every write test costs a real send.

---

# Phase 14 — Marker deprecation migration (2026-08-12)

Follow-up implementation pass to close D-5 at code level.

## D-5 — `google.maps.Marker` deprecated warning (High, hard gate)

**Implemented**
- `components/admin/BookingsMap.tsx`
  - Replaced `<Marker>` usage with `google.maps.marker.AdvancedMarkerElement`.
  - Added `PinElement` styling for status and selected states.
  - Added marker lifecycle cleanup (`clearInstanceListeners`, `marker.map = null`) to prevent stale handlers across re-renders.
  - Set map options with `mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'`.
- `components/admin/RouteMap.tsx`
  - Replaced both `new google.maps.Marker(...)` call sites with `AdvancedMarkerElement`.
  - Replaced SymbolPath circle icons with `PinElement` glyph pins (`D` for depot, sequence numbers for stops).
  - Upgraded route map initialisation to `importLibrary('maps')` + `importLibrary('marker')` before render.
  - Added cleanup for polyline and advanced marker listeners.

**Supporting change**
- Added `lib/design-tokens.ts` and reused it in both map components for shared map colours.

**Verification run**
- `npx tsc --noEmit` ✅
- `npx eslint components/admin/BookingsMap.tsx components/admin/RouteMap.tsx lib/design-tokens.ts` ✅
- `npm run build` ✅

**Notes**
- This closes the deprecated Marker API usage in source.
- For production styling parity and predictable marker rendering, set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` in env; code falls back to `DEMO_MAP_ID` when absent.

---

# Phase 15 — B-6 structural dedupe fix (2026-08-12)

## B-6 — Booking cards rendered twice with independent state (now fixed)

**Root issue**
- `AdminBookingsClient` mounted both mobile and desktop card trees at once and hid one via CSS (`md:hidden` / `hidden md:flex`).
- Every `BookingCard` therefore had two live instances, each with its own local state.

**Implemented**
- `app/admin/bookings/AdminBookingsClient.tsx`
  - Added viewport-mode tracking via `matchMedia('(min-width: 768px)')`.
  - Render only one tree at a time:
    - mobile tree when `< 768px`
    - desktop tree when `>= 768px`
  - Simplified pin→card scroll target selection to a single match now that duplicates are removed.

**Verification run**
- `npx tsc --noEmit` ✅
- `npx eslint app/admin/bookings/AdminBookingsClient.tsx` ✅
- `npm run build` ✅

This closes the underlying duplication, not just the scroll workaround.

---

# Phase 15 — Review of the Copilot-authored fixes (2026-08-12)

Phases 13–14 were done on branches. `fix/ux-audit-2026-08-11` was merged to `main`, but
`chore/advanced-markers` (Phase 14) **was not** — the marker migration was re-implemented
independently instead. This phase reviewed what landed and repaired the gaps.

## What landed correctly

- All Phase 13 fixes are present on `main` (bulk-approve guard, upload sanitisation and
  notices, price labels, touch targets, heading order).
- **B-6 is genuinely fixed** — `d46e693` deduped the card render trees. Verified live:
  5 cards, 0 duplicated `data-job-id`. Better than my Phase 13 patch, which only worked
  around the symptom by picking the visible copy.
- The marker migration uses `PinElement`, which is nicer than the raw div I had used, and
  handles the Map ID with the same `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'` fallback.

## F-1 — Admin bookings map rendered ZERO pins (Critical, shipped on main)

**Observed** — `/admin/bookings` with 5 bookings on screen: `gmp-advanced-marker` count **0**.
Map canvas present, console clean, no pins at all. The entire maintenance map — clustering,
pin↔card sync, InfoWindow — was dead again.

**Root cause** — the map instance was stored in a **ref**:

```ts
const mapRef = useRef<google.maps.Map | null>(null)
const onLoad = useCallback((map) => { mapRef.current = map }, [])
useEffect(() => { if (!mapRef.current) return; /* render markers */ },
          [bookings, onPinClick, selected])
```

Ref assignment triggers no render, so the effect ran once — before `onLoad`, while
`isLoaded` was still false and `<GoogleMap>` was not even mounted — bailed out, and never
re-ran. This is the fourth incarnation of the same bug family as B-1 and B-2.

**Fixed** — the map instance is `useState`, with `map` added to the dependency array.
Verified: **5 markers, 5 pins**, correct titles.

## F-2 — Three more deprecation warnings (High, hard gate)

Each only appeared after the previous one was cleared, so they had to be peeled off in
sequence — and each one fails the console gate on its own.

| Warning | Fix |
|---|---|
| `<gmp-advanced-marker>: Please use addEventListener('gmp-click', …)` | `gmp-click` + `gmpClickable: true` in both maps |
| `<gmp-pin>: The 'element' property is deprecated. Please use the PinElement directly.` | pass `pin` as `content`, not `pin.element` (3 sites) |
| `<gmp-pin>: The 'glyph' property is deprecated. Please use 'glyphSrc' or 'glyphText'` | `glyphText` for the depot `D` and the numbered stops |

**Verified** — `/admin/bookings` and `/admin/schedule/[date]` both **0 errors / 0 warnings**.
Keyboard Enter on a focused pin opens the InfoWindow with real data.

## E-1 and E-2 re-applied

Neither Phase 14 fix reached `main`, so both were re-applied and re-verified here:

- **E-1** route map collapsed to `732x0` — `min-h-[400px]`. Now `732x400` with the depot
  pin, numbered stops 1/2/3, polyline and drive times (12 / 9 / 23 min) all visible.
  Screenshot: `15-route-map-pins.png`.
- **E-2** confirmed-date scheduling across `/admin/schedule/[date]`, `/api/optimize` and
  `/api/cron/reminders`. Verified with three bookings whose preferred dates were 1–3 Sep
  and confirmed date 10 Sep: the optimiser now lists all three on **10 Sep** with their
  confirmed slots. Before the fix they appeared on 1/2/3 Sep and 10 Sep showed nothing.

## H-1 — CLOSED at last (the original High from Phase 1)

Migration `032_add_installation_service.sql` existed on an unmerged branch (`aa24cb6`) and
had **never been applied** — `service_types` still held only 2 rows, so the Installation
card on the landing page remained a dead end, exactly as first reported.

Cherry-picked into `main` and applied to production (the migration's `WHERE NOT EXISTS`
guard was mirrored in the insert). `service_types` now has `AC Installation` /
`INSTALLATION` / 180 min / no fixed price.

**Verified** — the booking dropdown reads *"AC Installation — quoted on site"* (M-8's label
applying to it), and selecting it renders the installation branch: AC Brand, AC Model,
Number of Units, notes and uploads.

## Gates

```
npx tsc --noEmit         clean
npx eslint <5 changed>   11 errors — identical to the stashed baseline (no new issues)
npm run build            succeeds
npx jest lib/            3 suites, 21 tests passed
```

Test data removed and verified: no `uxaudit` auth users, `bookings?notes=like.*UXAUDIT*`
`[]`, `profiles?name=like.ZZ*` `[]`. No customer emails sent — approvals were written
directly to the database.

## Open after Phase 15

- **Provision a production Google Maps Map ID** and set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
  Both maps still run on `DEMO_MAP_ID`, which is rate-limited and unsupported in production.
  This is the one item that genuinely needs the owner.
- `chore/advanced-markers` is now redundant — `main` carries a better version of everything
  on it. Safe to delete.
- Scenarios 4, 6, 8, 9, 11 remain unrun; the closed-shadow-DOM address widget remains
  undrivable by Playwright.

**Pattern worth keeping:** every Google Maps change in this codebase has broken something
that a console check and a "canvas present" check both passed. Four times now. The check
that actually works is: count the markers, measure the box, click a pin.
