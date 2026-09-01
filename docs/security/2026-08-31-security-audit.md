# HydroWash security audit — 2026-08-31

Performed with the Trail of Bits Claude Code skills: `static-analysis:semgrep`
(scan pipeline) and `insecure-defaults:audit` (seed corpus, run manually — the
`Workflow` tool the skill's pipeline needs is not exposed in this build).

## What was run

| Tool | Scope | Result |
|---|---|---|
| Semgrep 1.175.0, OSS engine | `p/security-audit`, `p/secrets`, `p/owasp-top-ten`, `p/cwe-top-25`, `p/typescript`, `p/javascript`, `p/react`, `p/nextjs`, `p/nodejs` + Trail of Bits, elttam, Apiiro malicious-code rule repos | **0 findings** |
| Verification re-scan, all severities, no `--include` scoping | 140 files, all 84 `.tsx` confirmed covered | **0 findings** |
| insecure-defaults corpus (6 categories, 39 seed patterns) | all tracked `.ts/.tsx/.js/.sql/.json/.yml` | 4 matches, all benign |
| Manual review | 40 API routes, 10 RLS migrations, middleware, auth webhook, headers, git history | **7 findings** |

Semgrep artifacts: `static_analysis_semgrep_1/` (`scans.json`, `raw/`, `results/results.sarif`).

**Coverage caveats.** `p/nextjs` matched no files (`coveredNothing`). The `p/yaml`
scan **failed** — semgrep rejects a path matching both `--include` and `--exclude`;
YAML was not analysed. Semgrep Pro was unavailable (not logged in), so there is no
cross-file taint tracking. The zero-finding result is genuine, not a coverage
artifact — but it is a floor, not a clean bill of health: none of the seven findings
below have a registry rule, and the highest-severity one is invisible to Semgrep
because the sink is a Google Maps API option object rather than `innerHTML`.

---

## Findings

### 1. HIGH — Stored XSS in the route-optimiser map, admin session

`components/admin/RouteMap.tsx:96–103`

InfoWindow content is built by string interpolation of three customer-controlled
values, unescaped:

```ts
const infoWindow = new window.google.maps.InfoWindow({
  content: `
    <p ...>${stop.customerName}</p>
    <p ...>${stop.address}</p>
    ${stop.notes ? `<p ...>${stop.notes}</p>` : ''}
  </div>`,
})
```

`stop.customerName` is `profiles.name`, which the customer edits freely in Account
Settings. `stop.address` and `stop.notes` come from the booking wizard. All three
reach `/api/optimize` → `RouteStop` → this template.

**Path to exploit.** A customer sets their profile name (or booking access notes) to
an HTML payload, books a job, waits for approval. The admin opens
`/admin/schedule/[date]`, runs the optimiser and clicks the pin. The payload runs on
the app origin inside the admin's authenticated session — every admin API route
(`/api/bookings/[id]` approve, `/api/contracts/*`, `/api/invoices/*`) and every
customer record is then reachable. There is no CSP to contain it (finding 5).

Google's Maps JS API applies some sanitisation to string `content` in recent
versions, which may blunt the simplest `<script>` payload — treat that as a
mitigating factor of unknown strength, not as the control. The sibling component
`components/admin/BookingsMap.tsx:137` already does this correctly, rendering the
InfoWindow through React's `<InfoWindow>` child elements, which escapes.

**Fix.** Mirror `BookingsMap`: pass a DOM node built with `textContent`, or use the
React `<InfoWindow>` component. Never interpolate booking data into an HTML string.

---

### 2. MEDIUM — `get_my_role()` is SECURITY DEFINER with a mutable `search_path`

`supabase/migrations/002_rls.sql:9–17`

```sql
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;
```

No `SET search_path`. This function is the authorisation primitive for **every**
admin RLS policy in the schema — `profiles`, `bookings`, `contracts`, `invoices`,
`job_completions`, `blocked_slots`, `service_types`, the AC catalogs. It runs as its
owner (the migration superuser) with a caller-influenced `search_path`, so any role
able to create objects in a schema earlier on that path can shadow `profiles` and
make `get_my_role()` return `'admin'` for everyone.

This is Supabase linter rule `0011_function_search_path_mutable`. Note the codebase
already knows the fix: `handle_new_user` in `005_auto_create_profile.sql:7` correctly
declares `SECURITY DEFINER SET search_path = public`.

**Correction (added during remediation):** an earlier draft of this report claimed
`get_my_car_id()` (same file, line 14) shares the defect. It does not — migration 008
already contains `DROP FUNCTION IF EXISTS get_my_car_id()` along with the
`service_cars`/`scheduled_jobs` tables and the `profiles.service_car_id` column. Only
`get_my_role()` is affected. What migration 008 did *not* drop by name are the
`bookings_tech_read` and `profiles_tech_read` policies from 006/007, which reference
those now-absent objects; migration 033 drops them idempotently.

**Fix.** `ALTER FUNCTION get_my_role() SET search_path = public, pg_temp;` and drop
`get_my_car_id()`.

---

### 3. MEDIUM — RLS lets customers bypass the reschedule/cancel business rules

`supabase/migrations/031_security_rls_hardening.sql:29–35`

```sql
CREATE POLICY "bookings_customer_update" ON bookings FOR UPDATE
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid() AND status IN ('PENDING','CANCELLED'));
```

031 correctly stopped self-approval, but the policy still allows a customer to PATCH
any other column on their own booking directly through the Supabase REST API with
the anon key — no application route involved. The checks in
`app/api/bookings/[id]/reschedule/route.ts` and `.../cancel/route.ts` (24-hour SGT
cutoff, status allowlist, slot validation) exist only in the route handler and are
therefore advisory.

A customer can: reschedule or cancel inside the 24-hour cutoff; knock an APPROVED
booking back to PENDING at will, releasing the `(confirmed_date, confirmed_slot)`
unique-index hold; write arbitrary `preferred_date_slots` JSON bypassing the
`validSlots` allowlist; and set `contract_id` (see finding 4).

**Fix.** Narrow the `WITH CHECK` to the columns customers may legitimately change, or
move reschedule/cancel behind a `SECURITY DEFINER` RPC and revoke direct UPDATE.

---

### 4. MEDIUM — `contract_id` on a booking is never checked for ownership

`app/api/bookings/route.ts:154`

```ts
contract_id: contract_id ?? null,
```

The POST body's `contract_id` is written straight onto the booking with no check that
the contract belongs to the caller. Per the work-order flow, the generated invoice's
contract is resolved as `linkedCsd?.contract_id ?? booking.contract_id ?? null` — so
a booking pointed at someone else's contract results in an invoice and a service-date
consumption billed against that third party's contract.

Exploitability is limited by contract IDs being unguessable UUIDs, but a customer who
learns one (shared household, forwarded PDF, a previously-linked contract of their
own that was reassigned) can use it. Note that finding 3 gives a second write path to
the same column that skips this route entirely.

**Fix.** Before insert, `select id from contracts where id = :contract_id and
customer_id = :user.id and status = 'ACTIVE'`; reject otherwise. Add the equivalent
`WITH CHECK` to the RLS insert/update policies.

---

### 5. LOW — No Content-Security-Policy

`next.config.ts:3–9`

`securityHeaders` sets `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Cross-Origin-Opener-Policy` and `Permissions-Policy`, but no
`Content-Security-Policy`. Nothing constrains script execution or exfiltration
destinations, which is what turns finding 1 from a defaced popup into session
compromise.

**Fix.** Add a CSP. The app needs `https://maps.googleapis.com`,
`https://maps.gstatic.com`, `https://fonts.googleapis.com` and
`https://fonts.gstatic.com`; `*.supabase.co` in `connect-src`. Enforcing Trusted
Types would additionally neutralise finding 1 at the sink.

---

### 6. LOW — Weaker open-redirect check in the auth callback than on the login page

`app/auth/callback/route.ts:11`

```ts
const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
```

A prefix check misses backslash variants — `/\evil.com` and `/\/evil.com` pass, and
several browsers normalise the backslash to `/`, producing a protocol-relative
redirect off-origin. This matters more than usual here: the callback is where
password-recovery lands, so a redirect can carry the `token_hash` off-site.

`app/auth/login/page.tsx:59–63` already implements the correct check — parse against
the current origin and compare `parsed.origin`. Its own comment even names the
`/\evil.com` case. Apply the same logic in the callback.

---

### 7. LOW — Unauthenticated, unmetered Google Maps proxy

`app/api/geocode/reverse/route.ts:7`

The route is deliberately unauthenticated (documented in the file — the "My Location"
button is used by logged-out visitors) and its input is type-checked to numbers, so
there is no injection or SSRF. What is missing is a rate limit: anyone can drive
unbounded billable Geocoding API calls against `GOOGLE_MAPS_API_KEY`. The same
applies to `/api/availability` and `/api/availability/suggest`, and to the
unauthenticated booking-spam surface generally.

**Fix.** Rate-limit by IP at the edge (Vercel Firewall or `@vercel/firewall`), and
set a daily quota cap on the server-side Maps key in Google Cloud Console.

---

## Checked and found sound

- **Route authorisation.** All 40 API routes carry the correct guard. Admin routes
  consistently use `if (profileError || !profile || profile.role !== 'admin')`, not
  the optional-chained form. `/api/optimize` and `/api/bookings/bulk-approve` are
  admin-gated. `work-order-pdf` and `contracts/[id]/pdf` correctly allow
  `admin || owner`. No IDOR found — every per-customer query is scoped with
  `.eq('customer_id', user.id)`.
- **Mass assignment.** `POST /api/bookings` and `POST /api/contracts/request` insert
  explicit field allowlists; `customer_id` comes from the session, `status` and
  `price_sgd` are server-set. No `status`, `confirmed_date` or `work_order_no` is
  accepted from a request body.
- **Auth webhook** (`app/api/auth/send-email/route.ts`). Standard Webhooks HMAC-SHA256
  with a 300-second timestamp window, length-checked `timingSafeEqual`, fails closed
  when the secret is unset. Correct.
- **Cron auth.** Both cron routes compare `x-cron-secret` against `CRON_SECRET` and
  fail closed when the env var is missing.
- **Privilege escalation fixed in 031.** `profiles.role` self-escalation and booking
  self-approval are both properly closed. `contracts_customer_insert` (019) correctly
  pins `status = 'PENDING_REVIEW'` and `get_my_role() = 'customer'`.
- **Login redirect** (`app/auth/login/page.tsx:59`). Origin-compared, not prefix-checked.
- **Secrets.** No credentials in the tree or in git history — only `.env.example` was
  ever committed. `p/secrets` and `p/gitleaks`-class patterns: clean. The 128 tracked
  `.playwright-mcp/*.log` files contain only dev-server noise, no tokens (they are
  still repo clutter worth removing).
- **insecure-defaults corpus.** The only matches were env fallbacks to non-secrets:
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'`,
  `NEXT_PUBLIC_APP_URL ?? 'https://hydrowash.sg'`. No fallback secrets, no debug
  defaults, no weak crypto, no default credentials, no permissive access defaults.

## Informational

- `app_settings` is world-readable to `anon` (`002_rls.sql:64`, `using (true)`),
  exposing `paynow_mobile`, `depot_lat/lng` and `contract_pricing_tiers`. Company
  contact fields are already public on the site; the depot coordinates and PayNow
  number are the parts worth restricting to `authenticated`.
- Dormant `technician` RLS policies survive in `006_tech_bookings_rls.sql` and
  `007_tech_profiles_rls.sql` for a role the app no longer has. Not currently
  reachable — 031's `WITH CHECK` blocks writing `role = 'technician'` — but they
  should be dropped.
- `profiles_insert` (`002_rls.sql:22`) has `with check (id = auth.uid())` with no
  constraint on `role`. Unreachable in practice because `handle_new_user` creates the
  row first and the primary key blocks a second insert, but it is the one policy 031
  did not tighten alongside `profiles_update`.
- PayNow QR signed URLs are issued with a one-year expiry
  (`send-work-order/route.ts:131` and two others). They contain no secret beyond the
  PayNow payload already printed on the invoice, but a shorter TTL costs nothing.
