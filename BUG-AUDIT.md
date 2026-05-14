# Bug Audit Report — Hydrowash

**Audit Date:** 2026-05-14  
**Scope:** Full codebase review for logical, security, and data integrity issues  

---

## CRITICAL BUGS

### 1. **OLD SCHEMA COLUMNS IN `/api/bookings/route.ts` (POST)**
**Location:** `app/api/bookings/route.ts:49-66`  
**Severity:** CRITICAL  
**Issue:**  
The POST endpoint is trying to insert old Phase 1 columns that no longer exist:
- `earliest_date` (line 57)
- `latest_date` (line 58)
- `preferred_slot` (line 59)
- `room_type` (line 65)

These were dropped in migration `010_phase2_slot_model.sql` and replaced with `booking_date` and `time_slot`. The new slot model also uses `booking_unit_locations` join table, not `num_units` directly.

**Expected columns for POST:**
- `booking_date` (date, NOT NULL)
- `time_slot` (TimeSlot enum, NOT NULL)
- `unit_location_ids[]` (array of location IDs for the join table)

**Impact:** Booking creation will FAIL with unknown column errors.

---

### 2. **Route Optimizer Fallback for Missing time_slot**
**Location:** `app/api/optimize/route.ts:50`  
**Severity:** HIGH  
**Issue:**  
```typescript
timeSlot: (b.time_slot ?? 'S10_12') as TimeSlot,
```

Silently defaults to `S10_12` if `time_slot` is null. Since `time_slot` is NOT NULL in the schema, this suggests either:
- Data validation is weak upstream
- There's a mismatch between what's being fetched and what's expected

**Better approach:** Throw an error if time_slot is missing, rather than silently defaulting.

---

### 3. **Middleware Authorization Check is INCOMPLETE**
**Location:** `middleware.ts:12`  
**Severity:** HIGH  
**Issue:**  
```typescript
if (!isAdmin || profile?.role !== 'admin')
```

This is a logical AND but should be OR. Current logic:
- `isAdmin=true` AND `profile.role !== 'admin'` → only returns error if admin param exists AND role is not admin
- Allows non-admin users through if `isAdmin=1` param is NOT provided

Should be:
```typescript
if (isAdmin && profile?.role !== 'admin')  // Only fail if admin param is set AND not actually admin
```

Actually, the whole check is backwards. Should check:
```typescript
if (!isAdmin || profile?.role !== 'admin') 
```
is checking: "if NOT requesting admin data OR not admin role" which is correct.

Wait, re-reading: **ACTUALLY CORRECT** as written. But confusing.

---

### 4. **Cron Contract Route — Wrong Auth Header**
**Location:** `app/api/cron/contracts/route.ts:8`  
**Severity:** CRITICAL  
**Issue:**  
```typescript
const authHeader = req.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
```

But Vercel cron sends `x-cron-secret` header, not `Authorization`.  
Compare with `app/api/cron/reminders/route.ts:5` which correctly uses:
```typescript
const secret = request.headers.get('x-cron-secret')
```

**Impact:** Cron job will ALWAYS fail with 401.

---

### 5. **Missing Null Check Before Accessing `existing.notes`**
**Location:** `app/api/contracts/[id]/activate/route.ts:58`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
notes: notes ?? existing.notes,
```

If contract exists with `notes = null` and `notes` param is not provided, this passes `null` (correct). But there's no check that `existing` exists before accessing `.notes`.

At line 37-40, we check `if (!existing)` and return 404, so this is actually **safe**. ✓

---

## HIGH PRIORITY BUGS

### 6. **PayNow QR CRC Implementation — Potential Encoding Issue**
**Location:** `lib/utils/paynow.ts:23-35`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
function crc16ccitt(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8  // <- Assumes UTF-8 encoding
```

Uses `charCodeAt()` which may not handle all UTF-8 correctly for non-ASCII characters. While merchant name "HydroWash" is ASCII, reference field (line 62) could have UTF-8 if future use includes Chinese characters or accents.

**Better:** Use `TextEncoder` for proper UTF-8:
```typescript
const encoded = new TextEncoder().encode(data)
```

---

### 7. **Distance Matrix API — All Locations in Single Request (Size Limit)**
**Location:** `lib/maps/distance-matrix.ts:11-13`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
const coords = locations.map(l => `${l.lat},${l.lng}`).join('|')
```

Distance Matrix API has size limits (~5000 chars URL). With many locations (e.g., 50+ bookings), this could exceed limits.

**Impact:** VRP optimization silently fails on large route days.

**Fix:** Batch requests or check URL length before sending.

---

### 8. **Contract Service Dates Auto-Generation — Timezone Issue**
**Location:** `app/api/contracts/route.ts:52-61`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
const serviceDates = [1, 2, 3, 4].map((n) => {
  const d = new Date(startDateObj)
  d.setMonth(d.getMonth() + 3 * n)
  return {
    due_date: d.toISOString().split('T')[0],  // <- Converts to UTC ISO, then takes date
```

If `start_date` is "2026-05-15" (local time intent), `new Date()` could interpret as UTC, causing due dates to shift.

**Better:** Use a date-only string manipulation library instead of Date object:
```typescript
const d = new Date(`${start_date}T00:00:00Z`)  // Explicit UTC
```

**Also in:** `app/api/contracts/[id]/activate/route.ts:71`

---

### 9. **Blocking Admin Check — Race Condition on Profile Query**
**Location:** `middleware.ts:21-24` (repeated in many API routes)  
**Severity:** MEDIUM  
**Issue:**  
Multiple sequential calls to `profiles.select('role')` without any caching or transaction isolation:
```typescript
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
```

If profile is deleted between auth check and this query, `.single()` throws. Should handle null case:
```typescript
const { data: profile, error } = await supabase...
if (error || !profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

**Affected files:**
- `app/api/bookings/[id]/route.ts:13-14`
- `app/api/bookings/bulk-approve/route.ts:11-13`
- `app/api/optimize/route.ts:11-13`
- AND 10+ others

---

### 10. **Email Send Error Silencing**
**Location:** `app/api/bookings/[id]/route.ts:51-53`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
await sendBookingApproved(booking, email).catch(() => null)
```

Silently swallows ALL errors (network, invalid email, API key missing, etc.). Admin never knows emails failed.

**Better:** Log errors:
```typescript
.catch(err => {
  console.error(`Failed to send email to ${email}:`, err)
})
```

**Affected:** All email sending throughout codebase.

---

### 11. **Geocode Address Missing Singapore Context**
**Location:** `app/api/bookings/route.ts:41`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
const geo = await geocodeAddress(`${body.address}, ${body.postal_code}, Singapore`)
```

Passes formatted string to geocoding. But `lib/maps/geocode.ts` doesn't add any region constraint. Should use Google's `region` parameter:

Currently:
```typescript
const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
```

Should be:
```typescript
const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=sg&key=${key}`
```

**Note:** Reverse geocode (`app/api/geocode/reverse/route.ts:16`) DOES include `&region=sg` ✓

---

### 12. **Contract Request — Missing Validation for start_date Format**
**Location:** `app/api/contracts/request/route.ts:20`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
const start_date = `${preferred_month}-01`
const startDateObj = new Date(start_date)
```

No validation that `preferred_month` matches `YYYY-MM` format. Invalid input like "2026-13" or "2026-5" will be silently accepted.

**Better:**
```typescript
if (!/^\d{4}-\d{2}$/.test(preferred_month)) {
  return NextResponse.json({ error: 'preferred_month must be YYYY-MM' }, { status: 400 })
}
```

---

### 13. **VRP Optimizer — Edge Case with Single Job**
**Location:** `lib/vrp/optimizer.ts:56-96`  
**Severity:** LOW  
**Issue:**  
If only 1 job exists, line 88 logic:
```typescript
travelFromPrevMinutes: sequenceOrder === 2 ? travel : travel,
```

This always sets `travelFromPrevMinutes = travel`, even for first job (sequenceOrder=1). First job should have travel time from depot (correct), but comment suggests this was a debugging artifact.

**Better:** Either remove the ternary or clarify intent:
```typescript
travelFromPrevMinutes: travel,  // Always includes depot travel
```

---

## MEDIUM PRIORITY ISSUES

### 14. **Suggestion API — Incorrect Date Comparison**
**Location:** `app/api/availability/suggest/route.ts:22`  
**Severity:** MEDIUM  
**Issue:**  
```typescript
for (let i = 0; i < days; i++) {
  const d = new Date(fromDate)
  d.setDate(d.getDate() + i)
  if (d > today) {  // <- String comparison doesn't work; need date comparison
    candidateDates.push(d.toISOString().split('T')[0])
  }
}
```

Compares Date objects which works, but then mixes string comparisons later:
```typescript
if (isDayFullyBlocked(date, blockedArr))  // date is string
```

And in `lib/booking/slots.ts:9`:
```typescript
return blocks.some((b) => b.blocked_date === date && b.slot === null)  // String compare — OK
```

Actually CORRECT as is, but confusing mixing Date and string logic.

---

### 15. **Missing .eq('is_active', true) in AC Catalog GET**
**Location:** `app/api/admin/ac-catalog/route.ts:33`  
**Severity:** LOW  
**Issue:**  
```typescript
export async function GET(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  const { data } = await supabase.from(table).select('*').order('display_order')
```

Returns BOTH active and inactive catalog items. Booking form UI will show disabled/deleted types.

**Better:** Add filter for client-facing requests, allow unfiltered for admin.

---

### 16. **AccountSettingsClient — Missing Error Boundary**
**Location:** `app/account/settings/AccountSettingsClient.tsx` (partial view)  
**Severity:** LOW  
**Issue:** Not seen in audit, but likely issue given other error handling patterns.

---

### 17. **Next.js 16 — Potential Async Params Usage Issue**
**Location:** Multiple route files  
**Issue:** Using `params: Promise<{...}>` pattern which requires Next.js 15.1.1+. Verify tsconfig/package.json Next.js version.

---

## SECURITY CONCERNS

### 18. **Profile Role Check — Should Use RLS Not Application Logic**
**Location:** Nearly all API routes  
**Severity:** MEDIUM  
**Recommendation:**  
Instead of checking role in application code, rely on Supabase RLS policies. Codebase already has RLS but double-checks in API layer. This is redundant if RLS is comprehensive.

---

### 19. **Admin Query Parameter Exposure**
**Location:** `app/api/bookings/route.ts:11`  
**Severity:** LOW  
**Issue:**  
```typescript
const isAdmin = request.nextUrl.searchParams.get('admin') === '1'
```

Exposes `?admin=1` parameter. Should be removed if handled via RLS. If kept for UX, ensure RLS prevents non-admins from seeing all bookings.

---

## RECOMMENDATIONS SUMMARY

| Priority | Bug | File | Fix Effort |
|----------|-----|------|-----------|
| 🔴 CRITICAL | Old schema columns in booking POST | `app/api/bookings/route.ts` | High |
| 🔴 CRITICAL | Wrong cron auth header | `app/api/cron/contracts/route.ts` | Low |
| 🟠 HIGH | Time slot defaulting | `app/api/optimize/route.ts` | Low |
| 🟠 HIGH | Profile null check missing (multiple files) | Various API routes | Medium |
| 🟡 MEDIUM | PayNow UTF-8 encoding | `lib/utils/paynow.ts` | Low |
| 🟡 MEDIUM | Distance Matrix size limits | `lib/maps/distance-matrix.ts` | Medium |
| 🟡 MEDIUM | Timezone in contract dates | `app/api/contracts/route.ts` | Low |
| 🟡 MEDIUM | Email error silencing | Throughout | Low |
| 🟡 MEDIUM | Geocode missing region param | `lib/maps/geocode.ts` | Low |
| 🟡 MEDIUM | Contract month validation missing | `app/api/contracts/request/route.ts` | Low |
| 🟢 LOW | Catalog returns inactive items | `app/api/admin/ac-catalog/route.ts` | Low |
| 🟢 LOW | VRP optimizer ternary confusing | `lib/vrp/optimizer.ts` | Low |

---

## NEXT STEPS FOR OTHER AI

1. **Start with CRITICAL bugs** — booking creation and cron emails are broken
2. **Then HIGH priority** — auth checks and data validation
3. **Test after each fix** with relevant API endpoints
4. **Run Jest tests** to ensure no regressions

