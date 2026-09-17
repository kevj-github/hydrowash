# Variant analysis — 2026-08-31

Follow-up to `2026-08-31-security-audit.md`, using the Trail of Bits
`variant-analysis` skill. Hunts for other instances of the root causes found in
that audit.

| Field | Value |
|---|---|
| Codebase | hydrowash @ `fc61607` |
| Root causes swept | 4 |
| New variants found | 1 HIGH, 1 LOW |
| Root causes proven exhaustive | 2 (RC-C, RC-D) |

---

## RC-A — an ID from the request body is written without an ownership check

> A foreign key supplied by the client reaches an INSERT without verifying the
> caller owns the referenced row.

**Known instance:** `app/api/bookings/route.ts:154` — `contract_id: contract_id ?? null`

### Ladder

| Level | Pattern | Tool | Matches | TP | FP |
|---|---|---|---|---|---|
| 0 (calibration) | `contract_id: contract_id ?? null` | ripgrep | **2** | 1 | 1 |
| 1 | `^\s+[a-z_]+_id:\s*[a-zA-Z_]` in `app/api/**/route.ts` | ripgrep | 10 | 1 | 9 |

Calibration is worth noting: the level-0 pattern was supposed to match only the
known bug and matched **two** lines. The second, `app/api/invoices/route.ts:33`, is
the identical literal — a copy-paste sibling. It is *not* a vulnerability, because
that route is admin-only and an admin linking an invoice to any contract is the
intended behaviour. A copy-paste variant landing in a differently-privileged route
is exactly the case that makes level-0 calibration worth doing.

### Variant A1 — LOW — `service_type_id` accepted unvalidated

`app/api/bookings/route.ts:137`

```ts
service_type_id: body.service_type_id,
```

Neither checked against `body.category` nor for `active = true`. `service_types_read`
RLS exposes only active rows to customers, but the FK constraint is enforced by the
database regardless of RLS, so a customer who knows a retired service type's UUID can
book against it. Since `service_types.price_sgd` feeds the work-order base price, the
consequence is a job billed at a stale or withdrawn rate.

**Fix.** Look the service type up server-side and assert
`active = true AND category = body.category` before inserting.

---

## RC-B — a rule enforced only in the route handler, while RLS grants the write directly

> The Next.js route validates; the RLS policy behind it does not. Any customer with
> the anon key can skip the route entirely and write through PostgREST.

**Known instance:** the 24-hour cutoff in `reschedule/route.ts` and `cancel/route.ts`
vs `bookings_customer_update`.

### Sweep

Every customer-writable RLS policy compared against the route that guards it:

| Table | Policy | Guard in RLS | Verdict |
|---|---|---|---|
| `bookings` | `bookings_customer_update` (031) | status ∈ {PENDING, CANCELLED} | partial — audit finding 3 |
| `bookings` | `bookings_customer_insert` (002:42) | **`customer_id = auth.uid()` only** | **Variant B1 — HIGH** |
| `contracts` | `contracts_customer_insert` (019) | status + role pinned | clean |
| `booking_unit_locations` | `booking_locations_insert_own` (016:28) | `EXISTS(... customer_id = auth.uid())` | clean |
| `profiles` | `profiles_insert` (002:22) | `id = auth.uid()`, no role constraint | Variant B2 — informational |

### Variant B1 — HIGH — customers can self-approve a booking by INSERT

`supabase/migrations/002_rls.sql:42`

```sql
create policy "bookings_customer_insert" on bookings for insert
  with check (customer_id = auth.uid());
```

`status` is a plain column with `default 'PENDING'` (`001_schema.sql:51`) and a CHECK
constraint that permits `'APPROVED'`. The insert policy constrains only ownership.

**This is an incomplete fix.** Migration 031 closed exactly this vulnerability on the
UPDATE path — its own comment reads *"A customer could directly PATCH their booking to
status='APPROVED', set confirmed_date/confirmed_slot, or mark COMPLETED"* — and left
the INSERT path untouched. The same write is still reachable, one verb over.

A customer POSTs to PostgREST with the anon key and their own JWT:

```
POST /rest/v1/bookings
{ "customer_id": "<own uuid>", "status": "APPROVED",
  "confirmed_date": "2026-09-14", "confirmed_slot": "S10_12", ... }
```

Consequences, none of which require any further flaw:

1. **Self-scheduled confirmed work.** `/admin/schedule/[date]` and `/admin/agenda`
   both dispatch on APPROVED bookings, so the job enters the route plan without an
   admin ever seeing it.
2. **Blocked-slot bypass.** The `blocked_slots` full-day check lives only in
   `app/api/bookings/route.ts:104-116`. PostgREST does not run it.
3. **Slot-validation bypass.** The `validSlots` allowlist and the 5-date/3-slot caps
   are route-side only, so arbitrary `preferred_date_slots` JSON can be written.
4. **Denial of booking.** The unique index on `(confirmed_date, confirmed_slot) WHERE
   status = 'APPROVED'` becomes a weapon: inserting rows across all five slots for
   future dates makes those slots unavailable to every other customer *and*
   un-approvable by the admin.

**Fix.** Mirror 031 onto the INSERT policy:

```sql
DROP POLICY IF EXISTS "bookings_customer_insert" ON bookings;
CREATE POLICY "bookings_customer_insert" ON bookings FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND status = 'PENDING'
    AND confirmed_date IS NULL
    AND confirmed_slot IS NULL
  );
```

### Variant B2 — informational — `profiles_insert` has no role constraint

`supabase/migrations/002_rls.sql:22` — `with check (id = auth.uid())`. Not reachable:
`handle_new_user` creates the row inside the `auth.users` insert trigger, so the
primary key rejects any later self-insert. Worth pinning `role = 'customer'` anyway,
because it is the same "031 tightened UPDATE, not INSERT" shape as B1 — on the same
two tables. That pairing is the signature of the incomplete fix, not a coincidence.

---

## RC-C — customer-controlled text interpolated into a markup sink — EXHAUSTIVE

> Untrusted string reaches an HTML-parsing sink without escaping.

**Known instance:** `components/admin/RouteMap.tsx:96`

| Level | Pattern | Matches | New |
|---|---|---|---|
| 0 | `content: \`` in `RouteMap.tsx` | 1 | — |
| 1 | `content:\s*\`\|html:\s*\`\|setContent\(` across `app components lib` | 1 | 0 |
| 2 | `dangerouslySetInnerHTML\|innerHTML\|outerHTML\|insertAdjacentHTML\|document.write\|new Function\|eval(\|createContextualFragment` | 0 | 0 |

**RouteMap.tsx:96 is the only such sink in the codebase.** No other component
constructs markup from a string.

### Refuted: PDF filename → `Content-Disposition` header injection

`app/api/bookings/[id]/work-order-pdf/route.ts:107` interpolates a filename derived
from `booking.customer.name` into a quoted header value — a promising lead, since the
customer controls that name. It is **safe**: `lib/utils/pdf-filename.ts` runs every
part through `slugPart()`, which NFKD-normalizes, strips combining marks, lowercases,
and collapses everything outside `[a-z0-9]` to `-`. No quote, CR, or LF survives.
Recording it because a future refactor that drops `slugPart` reopens it.

---

## RC-D — SECURITY DEFINER without `search_path` — EXHAUSTIVE

Swept during the original audit: `grep -rn -i "security definer" supabase/migrations/`
returns 3 definitions. `handle_new_user` (005) is correct; `get_my_role()` and
`get_my_car_id()` (002:9, 002:14) are not, and both are already reported as audit
finding 2. No further instances.

---

## Recommendations

### Immediate
1. **Variant B1** — patch `bookings_customer_insert` (SQL above). This is the highest
   finding of either document alongside the RouteMap XSS, and it needs no exploit
   chain: an authenticated customer with the public anon key can do it today.
2. Re-audit every RLS policy 031 touched for the verb it did not cover.
3. **Variant A1** — validate `service_type_id` against category and `active`.

### Preventive
Add to CI so RC-B cannot regress — any customer-scoped INSERT/UPDATE policy whose
`WITH CHECK` names only `auth.uid()` and no status/role column:

```yaml
rules:
  - id: rls-insert-policy-without-status-guard
    languages: [generic]
    severity: ERROR
    message: >-
      Customer-writable RLS policy constrains ownership but not state. A client can
      write status/role/confirmed_* directly via PostgREST, bypassing the route
      handler. Pin the writable state in WITH CHECK.
    patterns:
      - pattern-regex: >-
          (?i)CREATE\s+POLICY[^;]*FOR\s+(INSERT|UPDATE)[^;]*WITH\s+CHECK\s*\(\s*[a-z_]*id\s*=\s*auth\.uid\(\)\s*\)
    paths:
      include: ['supabase/migrations/*.sql']
```

And for RC-C, pinning the sole known sink shape:

```yaml
  - id: maps-infowindow-html-interpolation
    languages: [typescript, javascript]
    severity: ERROR
    message: >-
      InfoWindow content built by string interpolation. Booking data is
      customer-controlled; use React children or textContent.
    pattern: new $NS.maps.InfoWindow({..., content: `...${$X}...`, ...})
```
