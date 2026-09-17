# Remediation — 2026-08-31

Fixes for the findings in `2026-08-31-security-audit.md`,
`2026-08-31-variant-analysis.md` and `2026-08-31-codeql-analysis.md`, applied in the
recommended order (HIGH tier first).

## Status

| # | Finding | Severity | Fix | State |
|---|---|---|---|---|
| B1 | Self-approve booking by INSERT | HIGH | `033` §3 | **APPLIED + verified** |
| 1 | Stored XSS → admin session | HIGH | `RouteMap.tsx` | **fixed in code** |
| 2 | `get_my_role()` mutable `search_path` | MEDIUM | `033` §1 | **APPLIED + verified** |
| 3 | Route rules not mirrored in RLS | MEDIUM | `033` §5 | **APPLIED + verified** |
| 4 | `contract_id` ownership unchecked | MEDIUM | `bookings/route.ts` + `033` §6 | **fixed in code** |
| A1 | `service_type_id` unvalidated | LOW | `bookings/route.ts` + `033` §6 | **fixed in code** |
| 5 | No CSP | LOW | `next.config.ts` | **fixed in code**, partial — see below |
| 6 | Weak redirect check in callback | LOW | `callback/route.ts` | **fixed in code** |
| B2 | `profiles_insert` no role constraint | INFO | `033` §4 | **APPLIED + verified** |
| — | Dormant technician policies | INFO | `033` §2 | already gone (008 cascaded) |
| 7 | No rate limiting | LOW | platform config | **not done — needs your consoles** |

Verification run: `npx tsc --noEmit` clean, `npx jest` 29/29 passing,
`npx eslint --max-warnings=0` clean, `npm run build` succeeds.

Finding 1 additionally verified with the custom CodeQL query, as a controlled
before/after using the same query and toolchain minutes apart:

| Database | `codeql/custom/InfoWindowHtml.ql` |
|---|---|
| pre-patch (full tree) | **1 result** — `RouteMap.tsx:96` |
| post-patch (`components/`) | **0 results** |

The pre-patch run was repeated *after* the fix as a negative control, confirming the
empty result is the patch and not a broken query or a bad database.

---

## ✅ APPLIED to production — 2026-09-01

Migrations `033` and `034` were applied to project `qasbovdxswjrtxouxejh` (HydroWash)
via the Supabase MCP server. The project was auto-paused and had to resume first;
during the resume the schema reads empty, which is a half-restored instance and not a
finding.

**Pre-flight (no drift).** The live schema matched the migration files exactly:
`bookings_customer_insert` WITH CHECK was `(customer_id = auth.uid())` — confirming B1
against the real database, not just the files — while `bookings_customer_update` and
`profiles_update` already carried 031's fixes, confirming the "tightened UPDATE, missed
INSERT" diagnosis. `get_my_role` had `proconfig = (none)`. `get_my_car_id`,
`bookings_tech_read` and `profiles_tech_read` were already absent, so 033 §2 was a no-op.

**Verification against live data** (3 customers, 31 bookings, 5 contracts, 10 invoices):

| Test | Result |
|---|---|
| 6 structural checks (search_path, both policies, both triggers, no tech policies) | all **PASS** |
| B1 probe — customer inserts `status='APPROVED'` + confirmed slot | **`42501` RLS violation** ✅ |
| Control — same insert as `PENDING` | **succeeds** ✅ |
| A1 probe — `service_type_id` from wrong category | **rejected by trigger** ✅ |
| Finding 3 probe — customer sets `confirmed_date`/`confirmed_slot` | **rejected by trigger** ✅ |
| Data integrity — bookings before/after | **31 → 31, 0 probe rows** ✅ |

Every probe ran inside `BEGIN … ROLLBACK`; nothing was written.

### Migration 034 — advisor follow-up

Supabase's security advisor, run immediately after 033, went from **11 warnings to 3**.
It surfaced two things:

- **A gap the original audit missed:** `assign_customer_no` and `assign_work_order_no`
  also had a mutable `search_path`. The audit's sweep grepped for `SECURITY DEFINER`
  and these two are SECURITY INVOKER, so they never appeared. Lower risk for exactly
  that reason — they run with the caller's privileges — but now pinned.
- **Two warnings 033 introduced:** the new trigger functions are SECURITY DEFINER and
  carried the default PUBLIC EXECUTE grant. Revoked, along with the same redundant
  grants on `handle_new_user` and the `assign_*` pair.

**`get_my_role` deliberately still shows 2 warnings.** The advisor wants EXECUTE
revoked, but it is the only non-trigger function in the set and every admin RLS policy
calls it. Policy expressions evaluate with the querying user's privileges, so revoking
from `authenticated` would break every admin policy, and revoking from `anon` would
break the public `service_types` listing. Its `search_path` — the actual vulnerability —
is pinned. Leaving the grant is correct; the linter's advice does not fit this usage.

The third remaining warning, **leaked-password protection disabled**, is an Auth
dashboard toggle (Authentication → Policies). Worth enabling; I cannot set it via SQL.

## Original pre-application notes

`supabase/migrations/033_security_hardening_round2.sql` exists on disk only. Per
`CLAUDE.md`, migrations are applied by hand in the Supabase dashboard SQL editor.
**Until you paste and run it there, B1 — the highest-severity finding — is still
exploitable in production.** The file is wrapped in `BEGIN`/`COMMIT`, so it applies
atomically or not at all.

I could not execute this SQL: there is no database reachable from this environment, so
the migration is reasoned-about but **unexecuted**. Apply it to a staging/branch project
first. The specific thing to smoke-test is that ordinary customer flows still work,
because a wrong `WITH CHECK` on the insert policy would break all booking creation:

1. Customer creates a booking through `/book` → succeeds.
2. Customer reschedules a booking >24h out → succeeds.
3. Customer cancels a booking >24h out → succeeds.
4. Admin approves a booking (sets `confirmed_date` + `confirmed_slot`) → succeeds.
5. Admin completes a booking → `work_order_no` still auto-assigns.

Then confirm the hole is closed — as a logged-in customer, against PostgREST directly:

```bash
curl -X POST "$SUPABASE_URL/rest/v1/bookings" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"<own-uuid>","status":"APPROVED","confirmed_date":"2026-12-01",
       "confirmed_slot":"S10_12","category":"MAINTENANCE","service_type_id":"<id>",
       "address":"x","postal_code":"1","lat":1.3,"lng":103.8,
       "booking_date":"2026-12-01","time_slot":"S10_12"}'
```

Before `033` this returns `201`. After, it must return a `42501` RLS violation.

---

## What changed, by finding

### B1 + B2 — state pinned in the INSERT policies (`033` §3, §4)

`bookings_customer_insert` now requires `status = 'PENDING'` and null
`confirmed_date`/`confirmed_slot`/`work_order_no`. `profiles_insert` now requires
`role = 'customer'` unless the caller is already an admin. At signup `get_my_role()`
is NULL, so the `OR` falls through to the `role = 'customer'` arm and normal
registration is unaffected.

### 1 — XSS fixed at the sink (`components/admin/RouteMap.tsx`)

The InfoWindow content is now built as DOM nodes via a `buildStopInfoContent()` helper
whose `infoLine()` assigns through `textContent`. No HTML string is constructed, so
`customerName`, `address` and `notes` cannot escape their element regardless of what
the customer types. This matches how `BookingsMap.tsx` already renders its InfoWindow.

### 2 — `search_path` pinned (`033` §1)

`get_my_role()` is recreated with `SET search_path = public, pg_temp`. Behaviour is
unchanged; it can no longer be redirected to a shadowed `profiles`.

### 3 — route rules mirrored into the database (`033` §5)

RLS is row-level and cannot express column immutability or a time cutoff, so this is a
`BEFORE UPDATE` trigger that returns early for admins and otherwise enforces:
`customer_id`, `category`, `service_type_id`, `contract_id`, `work_order_no` and
`rejection_reason` are immutable; `confirmed_date`/`confirmed_slot` may be cleared but
never set; and the 24-hour cutoff computed from
`COALESCE(confirmed_date, preferred_date_slots[0].date, booking_date)`.

**Deliberate discrepancy.** The trigger implements a true 24-hour cutoff. The route
handler is stricter: `isBeforeCutoff()` compares `new Date(Date.now() + SGT_OFFSET_MS)`
— now shifted 8 hours forward — against an already-absolute cutoff instant, so it
actually demands ~32 hours of lead time. I mirrored the *intent* rather than replicate
that skew, because the trigger is a backstop and a stricter database than route would
reject legitimate requests the UI has already accepted. **This means the 8-hour skew is
a real pre-existing product bug**: customers get less rescheduling freedom than the
24-hour policy promises. It is not a security issue and I did not change it — fixing it
changes customer-visible behaviour, so it is your call.

### 4 + A1 — referenced rows validated (`bookings/route.ts` + `033` §6)

The POST handler now verifies the service type is active and matches the claimed
category, and that any `contract_id` belongs to the caller. A `BEFORE INSERT` trigger
enforces the same two rules plus the full-day `blocked_slots` check, so the PostgREST
path cannot skip them. The route checks exist to return `422`/`404` instead of a
trigger-raised `500`.

### 5 — CSP added (`next.config.ts`) — partial, read this

A `Content-Security-Policy` header is now set, with `default-src 'self'`,
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`,
and a `connect-src` allowlist limited to the Maps and Supabase origins.

**It carries `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, so it does not stop
script injection.** Next.js App Router emits inline hydration scripts and the Google
Maps loader injects its own script tags; neither carries a nonce today. What the policy
does buy is a ceiling on exfiltration destinations, a ban on plugins and framing, and
protection of the base URL and form targets. The XSS itself is fixed at the sink, which
is the actual control. A nonce-based policy is the proper follow-up and needs browser
testing against the Maps loader — I did not attempt it here because I cannot run a
browser in this environment.

Hosts were verified against the codebase rather than guessed: fonts are self-hosted by
`next/font/google` at build time, and Unsplash/Pexels images are proxied through
`next/image`, so neither needs an entry.

### 6 — redirect validated by origin (`callback/route.ts`)

Replaced the `startsWith('/') && !startsWith('//')` prefix test with `new URL(rawNext,
origin)` and an `origin` equality check, then reassembles from
`pathname + search + hash`. This is the same check `app/auth/login/page.tsx` already
used, and it rejects the `/\evil.com` backslash form the prefix test allowed.

---

## Not done: finding 7, rate limiting

This one needs access to consoles I do not have, and I am not going to ship a
code-level limiter in its place: an in-memory counter in a serverless function is
per-instance and resets constantly, which would give the appearance of a control
without the substance.

Two steps, both in dashboards:

1. **Google Cloud Console** → APIs & Services → the server-side key behind
   `GOOGLE_MAPS_API_KEY` → set a daily quota cap on the Geocoding API, and restrict the
   key to the Geocoding and Distance Matrix APIs only. This bounds the billing damage
   from `/api/geocode/reverse`, which is intentionally unauthenticated so the "My
   Location" button works for logged-out visitors.
2. **Vercel** → project → Firewall → add a rate-limit rule on `/api/geocode/reverse`,
   `/api/availability*` and `/api/bookings` (e.g. 20 req/min per IP). These are the
   unauthenticated or cheap-to-spam surfaces.

## Also outstanding (housekeeping, not security)

- `playwright-report/` and the 128 `.playwright-mcp/*.log` files are committed. They
  contain no secrets (checked), but they produced 65 of CodeQL's 70 raw findings and
  should be gitignored and removed from the index.
- Three unused locals flagged by CodeQL: `app/admin/customers/page.tsx:2`,
  `app/api/contracts/route.ts:29`, `components/admin/ContractCard.tsx:39`.
