# Admin Hard Delete (Customers, Contracts, Invoices, Bookings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin permanently (hard) delete customers, contracts, invoices, and bookings — individually or via multi-select bulk delete — from all four admin list pages, with a confirmation modal and an audit trail.

**Architecture:** One migration adds a missing cascade FK and an `admin_audit_log` table. Four `POST .../bulk-delete` API routes (admin-only) do the actual deletes via the service-role client and write one audit row per batch; `DELETE /api/contracts/[id]` is simplified to always hard-delete. A shared `ConfirmDeleteModal` + `Checkbox` component pair is reused across all four admin list pages, each of which gains selection state, a bulk-action bar, and a per-row delete affordance that calls the same modal/endpoint with a single id.

**Tech Stack:** Next.js 16 App Router route handlers, Supabase (Postgres + Auth + RLS, service-role client for the actual deletes), `@base-ui/react` primitives (already used for Dialog/Select in this repo), Jest for route-handler unit tests, Playwright for the e2e delete flow.

**Spec:** `docs/superpowers/specs/2026-09-09-admin-hard-delete-design.md`

## Global Constraints

- Hard delete only — no soft delete / recovery / trash bin.
- Every delete route/endpoint: verify session (`401` if none) then `profiles.role === 'admin'` (`403` otherwise), matching the exact pattern in `app/api/bookings/bulk-approve/route.ts`.
- Every delete route uses `createAdminClient()` (service role, from `lib/supabase/admin.ts`) for the actual delete and the audit-log write.
- Every delete route returns `{ succeeded: string[], failed: { id: string; error: string }[] }` — never a single all-or-nothing error for a batch.
- Customer delete removes the Supabase Auth account too (`supabaseAdmin.auth.admin.deleteUser(id)`), which cascades to `profiles` → `contracts`/`invoices`/`bookings`.
- Bulk-delete confirmation is a modal showing item count + a short preview list (not type-to-confirm, not a bare "are you sure").
- Dependent-count warnings (bookings/contracts/invoices about to cascade) are shown only for customer deletes; contract/booking cascades (service dates, job completions, unlinked invoices) are silent.
- No new npm dependencies — `@base-ui/react` (already a dependency) supplies the checkbox primitive.

---

### Task 1: Migration — cascade FK + audit log table

**Files:**
- Create: `supabase/migrations/035_admin_hard_delete.sql`

**Interfaces:**
- Produces: `admin_audit_log` table (columns: `id uuid`, `admin_id uuid`, `action text`, `entity_type text`, `entity_ids uuid[]`, `summary jsonb`, `created_at timestamptz`) that Task 2's `logAdminDelete` helper writes to.
- Produces: `bookings.customer_id` FK now `ON DELETE CASCADE` (was implicit `NO ACTION`).

This repo applies migrations by hand via the Supabase dashboard SQL editor (see `CLAUDE.md` — "Migrations: create supabase/migrations/0NN_name.sql → apply via Supabase dashboard SQL editor"), so there's no automated test for this step. Verification is a manual SQL check after applying.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 035: Admin hard delete support
-- 1. bookings.customer_id currently has no ON DELETE action (defaults to
--    RESTRICT), so deleting a customer profile with any booking fails
--    outright. contracts.customer_id and invoices.customer_id already
--    cascade (migration 003) — bring bookings in line so a customer delete
--    cleanly cascades to all their data.
-- 2. admin_audit_log records every admin hard-delete (who, what, when,
--    a snapshot of what was removed) since the data itself is unrecoverable.

ALTER TABLE bookings DROP CONSTRAINT bookings_customer_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL DEFAULT 'DELETE',
  entity_type text NOT NULL CHECK (entity_type IN ('customer','contract','invoice','booking')),
  entity_ids uuid[] NOT NULL,
  summary jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON admin_audit_log
  FOR SELECT
  USING (get_my_role() = 'admin');

CREATE INDEX admin_audit_log_entity_type_idx ON admin_audit_log(entity_type);
CREATE INDEX admin_audit_log_created_at_idx ON admin_audit_log(created_at);
```

- [ ] **Step 2: Apply the migration**

Open the Supabase dashboard SQL editor for this project and run the contents of `supabase/migrations/035_admin_hard_delete.sql`.

- [ ] **Step 3: Verify the FK change**

Run in the SQL editor:

```sql
SELECT confdeltype FROM pg_constraint WHERE conname = 'bookings_customer_id_fkey';
```

Expected: `c` (cascade). Also confirm the table exists: `SELECT * FROM admin_audit_log LIMIT 1;` should return an empty result with no error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/035_admin_hard_delete.sql
git commit -m "$(cat <<'EOF'
feat(db): cascade bookings.customer_id delete + add admin_audit_log

Deleting a customer previously failed if they had any bookings (no
cascade). Also adds admin_audit_log for the upcoming admin hard-delete
feature.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 2: Shared audit-log helper

**Files:**
- Create: `lib/admin/audit-log.ts`
- Test: `lib/admin/__tests__/audit-log.test.ts`

**Interfaces:**
- Consumes: a Supabase client shaped like `{ from(table: string): { insert(row: object): Promise<{ error: { message: string } | null }> } }` (the real service-role client from `lib/supabase/admin.ts` satisfies this).
- Produces: `logAdminDelete(supabaseAdmin: SupabaseClient, adminId: string, entityType: 'customer' | 'contract' | 'invoice' | 'booking', rows: { id: string; label: string }[]): Promise<void>` — every `bulk-delete` route (Tasks 4–7) and the rewritten `DELETE /api/contracts/[id]` (Task 6) call this after a successful delete. Throws if the insert fails (callers don't need to handle a return value — a thrown audit-log error is caught by the route's own try/catch and reported, matching "never silently succeed without logging").

- [ ] **Step 1: Write the failing test**

```ts
// lib/admin/__tests__/audit-log.test.ts
import { logAdminDelete } from '@/lib/admin/audit-log'

function makeMockClient(insertResult: { error: { message: string } | null }) {
  const insert = jest.fn().mockResolvedValue(insertResult)
  const from = jest.fn().mockReturnValue({ insert })
  return { client: { from } as unknown as Parameters<typeof logAdminDelete>[0], insert, from }
}

describe('logAdminDelete', () => {
  it('inserts one row into admin_audit_log with entity_ids and summary', async () => {
    const { client, insert, from } = makeMockClient({ error: null })

    await logAdminDelete(client, 'admin-1', 'booking', [
      { id: 'b1', label: 'Jane Tan — Chemical Wash — 2026-09-10' },
      { id: 'b2', label: 'John Lee — Filter Cleaning — 2026-09-11' },
    ])

    expect(from).toHaveBeenCalledWith('admin_audit_log')
    expect(insert).toHaveBeenCalledWith({
      admin_id: 'admin-1',
      action: 'DELETE',
      entity_type: 'booking',
      entity_ids: ['b1', 'b2'],
      summary: [
        { id: 'b1', label: 'Jane Tan — Chemical Wash — 2026-09-10' },
        { id: 'b2', label: 'John Lee — Filter Cleaning — 2026-09-11' },
      ],
    })
  })

  it('throws when the insert fails', async () => {
    const { client } = makeMockClient({ error: { message: 'db down' } })

    await expect(
      logAdminDelete(client, 'admin-1', 'invoice', [{ id: 'i1', label: 'S$50.00' }])
    ).rejects.toThrow('db down')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/admin/__tests__/audit-log.test.ts`
Expected: FAIL with "Cannot find module '@/lib/admin/audit-log'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/admin/audit-log.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminAuditEntityType = 'customer' | 'contract' | 'invoice' | 'booking'

export interface AdminAuditRow {
  id: string
  label: string
}

export async function logAdminDelete(
  supabaseAdmin: SupabaseClient,
  adminId: string,
  entityType: AdminAuditEntityType,
  rows: AdminAuditRow[],
): Promise<void> {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'DELETE',
    entity_type: entityType,
    entity_ids: rows.map(r => r.id),
    summary: rows,
  })

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/admin/__tests__/audit-log.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/admin/audit-log.ts lib/admin/__tests__/audit-log.test.ts
git commit -m "$(cat <<'EOF'
feat(admin): add logAdminDelete audit-log helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 3: Test helper for mocking Supabase route clients

**Files:**
- Create: `lib/testing/supabase-route-mock.ts`

**Interfaces:**
- Produces: `createMockSupabaseServerClient({ user, role }: { user: { id: string } | null; role?: string })` → an object shaped like the return of `await createClient()` (`lib/supabase/server.ts`), supporting `.auth.getUser()` and `.from('profiles').select('role').eq('id', ...).single()`. Used by every route test in Tasks 4–7 to simulate the auth/role guard.
- Produces: `createMockSupabaseAdminClient(tables: Record<string, { selectResult?: unknown; deleteResult?: { error: { message: string } | null } }>)` → an object shaped like `createAdminClient()` (`lib/supabase/admin.ts`), with a chainable `.from(table).select().eq().in().single()` / `.delete().in()` / `.insert()` that resolve based on the `tables` map keyed by table name. Used by every route test in Tasks 4–7 to simulate the actual delete + audit write.

This is a test-only utility (not shipped), so no test-of-the-test is written — its correctness is proven by the route tests in Tasks 4–7 that consume it.

- [ ] **Step 1: Write the helper**

```ts
// lib/testing/supabase-route-mock.ts
// Test-only helpers for mocking the two Supabase client shapes used by
// admin API routes: the session-scoped client from lib/supabase/server.ts
// (auth + role check) and the service-role client from lib/supabase/admin.ts
// (the actual delete + audit-log insert).

type ChainResult = { data: unknown; error: { message: string } | null }

function makeChain(result: ChainResult) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'eq', 'in', 'delete', 'update', 'insert', 'order']
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  chain.single = jest.fn().mockResolvedValue(result)
  // Chains that don't end in .single() (e.g. .select().in(...)) are awaited
  // directly — make the chain itself thenable so `await query` resolves too.
  ;(chain as unknown as { then: unknown }).then = (
    resolve: (v: ChainResult) => void
  ) => resolve(result)
  return chain
}

export function createMockSupabaseServerClient(opts: {
  user: { id: string } | null
  role?: string
}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: opts.user } }),
    },
    from: jest.fn().mockReturnValue(
      makeChain({ data: opts.user ? { role: opts.role ?? 'admin' } : null, error: null })
    ),
  }
}

export function createMockSupabaseAdminClient(
  tables: Record<string, ChainResult>,
  authAdmin?: { deleteUser: jest.Mock }
) {
  return {
    from: jest.fn((table: string) => makeChain(tables[table] ?? { data: null, error: null })),
    auth: { admin: authAdmin ?? { deleteUser: jest.fn() } },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/testing/supabase-route-mock.ts
git commit -m "$(cat <<'EOF'
test: add shared Supabase mock helpers for admin route tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 4: `POST /api/bookings/bulk-delete`

**Files:**
- Create: `app/api/bookings/bulk-delete/route.ts`
- Test: `app/api/bookings/bulk-delete/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `logAdminDelete` from Task 2, `createMockSupabaseServerClient`/`createMockSupabaseAdminClient` from Task 3 (test only).
- Produces: `POST` handler at `/api/bookings/bulk-delete` accepting `{ ids: string[] }`, returning `{ succeeded: string[], failed: { id: string; error: string }[] }` (200), `{ error: string }` (401/403/400). Consumed by the Bookings UI in Task 9.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/bookings/bulk-delete/__tests__/route.test.ts
/** @jest-environment node */
import { POST } from '@/app/api/bookings/bulk-delete/route'
import { NextRequest } from 'next/server'
import {
  createMockSupabaseServerClient,
  createMockSupabaseAdminClient,
} from '@/lib/testing/supabase-route-mock'

const mockServerClient = createMockSupabaseServerClient({ user: { id: 'admin-1' } })
const mockAdminClient = createMockSupabaseAdminClient({
  bookings: {
    data: [
      { id: 'b1', customer: { name: 'Jane Tan' }, service_type: { name: 'Chemical Wash' }, booking_date: '2026-09-10' },
    ],
    error: null,
  },
  admin_audit_log: { data: null, error: null },
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockServerClient)),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/bookings/bulk-delete', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/bookings/bulk-delete', () => {
  it('returns 401 when not authenticated', async () => {
    mockServerClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(makeRequest({ ids: ['b1'] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when ids is missing or empty', async () => {
    const res = await POST(makeRequest({ ids: [] }))
    expect(res.status).toBe(400)
  })

  it('deletes the given bookings and logs the audit entry', async () => {
    const res = await POST(makeRequest({ ids: ['b1'] }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.succeeded).toEqual(['b1'])
    expect(body.failed).toEqual([])
    expect(mockAdminClient.from).toHaveBeenCalledWith('bookings')
    expect(mockAdminClient.from).toHaveBeenCalledWith('admin_audit_log')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/bookings/bulk-delete -v`
Expected: FAIL with "Cannot find module '@/app/api/bookings/bulk-delete/route'"

- [ ] **Step 3: Write the implementation**

```ts
// app/api/bookings/bulk-delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminDelete } from '@/lib/admin/audit-log'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ids }: { ids: string[] } = await request.json()
  if (!ids?.length) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: bookings } = await adminClient
    .from('bookings')
    .select('id, customer:profiles(name), service_type:service_types(name), booking_date')
    .in('id', ids)

  const rows = (bookings ?? []) as {
    id: string
    customer: { name: string } | null
    service_type: { name: string } | null
    booking_date: string | null
  }[]

  const { error: deleteError } = await adminClient.from('bookings').delete().in('id', ids)

  if (deleteError) {
    return NextResponse.json({
      succeeded: [],
      failed: ids.map(id => ({ id, error: deleteError.message })),
    }, { status: 200 })
  }

  await logAdminDelete(
    adminClient,
    user.id,
    'booking',
    rows.map(r => ({
      id: r.id,
      label: `${r.customer?.name ?? 'Unknown'} — ${r.service_type?.name ?? 'Unknown'} — ${r.booking_date ?? ''}`,
    }))
  )

  return NextResponse.json({ succeeded: ids, failed: [] })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/bookings/bulk-delete -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/bookings/bulk-delete/route.ts app/api/bookings/bulk-delete/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add POST /api/bookings/bulk-delete

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 5: `POST /api/invoices/bulk-delete`

**Files:**
- Create: `app/api/invoices/bulk-delete/route.ts`
- Test: `app/api/invoices/bulk-delete/__tests__/route.test.ts`

**Interfaces:**
- Consumes: same as Task 4.
- Produces: `POST` handler at `/api/invoices/bulk-delete`, same request/response shape as Task 4. Consumed by the Invoices UI in Task 11.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/invoices/bulk-delete/__tests__/route.test.ts
/** @jest-environment node */
import { POST } from '@/app/api/invoices/bulk-delete/route'
import { NextRequest } from 'next/server'
import {
  createMockSupabaseServerClient,
  createMockSupabaseAdminClient,
} from '@/lib/testing/supabase-route-mock'

const mockServerClient = createMockSupabaseServerClient({ user: { id: 'admin-1' } })
const mockAdminClient = createMockSupabaseAdminClient({
  invoices: {
    data: [{ id: 'i1', customer: { name: 'Jane Tan' }, amount_sgd: 50, status: 'UNPAID' }],
    error: null,
  },
  admin_audit_log: { data: null, error: null },
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockServerClient)),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/invoices/bulk-delete', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/invoices/bulk-delete', () => {
  it('returns 403 for a non-admin', async () => {
    mockServerClient.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'customer' }, error: null }) }) }),
    })
    const res = await POST(makeRequest({ ids: ['i1'] }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when ids is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('deletes the given invoices and logs the audit entry', async () => {
    const res = await POST(makeRequest({ ids: ['i1'] }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.succeeded).toEqual(['i1'])
    expect(mockAdminClient.from).toHaveBeenCalledWith('invoices')
    expect(mockAdminClient.from).toHaveBeenCalledWith('admin_audit_log')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/invoices/bulk-delete -v`
Expected: FAIL with "Cannot find module '@/app/api/invoices/bulk-delete/route'"

- [ ] **Step 3: Write the implementation**

```ts
// app/api/invoices/bulk-delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminDelete } from '@/lib/admin/audit-log'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ids }: { ids: string[] } = await request.json()
  if (!ids?.length) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: invoices } = await adminClient
    .from('invoices')
    .select('id, customer:profiles(name), amount_sgd, status')
    .in('id', ids)

  const rows = (invoices ?? []) as {
    id: string
    customer: { name: string } | null
    amount_sgd: number
    status: string
  }[]

  const { error: deleteError } = await adminClient.from('invoices').delete().in('id', ids)

  if (deleteError) {
    return NextResponse.json({
      succeeded: [],
      failed: ids.map(id => ({ id, error: deleteError.message })),
    }, { status: 200 })
  }

  await logAdminDelete(
    adminClient,
    user.id,
    'invoice',
    rows.map(r => ({
      id: r.id,
      label: `${r.customer?.name ?? 'Unknown'} — S$${Number(r.amount_sgd).toFixed(2)} — ${r.status}`,
    }))
  )

  return NextResponse.json({ succeeded: ids, failed: [] })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/invoices/bulk-delete -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/invoices/bulk-delete/route.ts app/api/invoices/bulk-delete/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add POST /api/invoices/bulk-delete

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 6: `POST /api/contracts/bulk-delete` + rewrite `DELETE /api/contracts/[id]`

**Files:**
- Create: `app/api/contracts/bulk-delete/route.ts`
- Test: `app/api/contracts/bulk-delete/__tests__/route.test.ts`
- Modify: `app/api/contracts/[id]/route.ts` (the `DELETE` handler, lines 52–93)
- Modify: `app/admin/contracts/[id]/page.tsx:213-227` (`handleDelete`)

**Interfaces:**
- Consumes: same as Task 4.
- Produces: `POST /api/contracts/bulk-delete` (same shape as Task 4/5), consumed by the Contracts UI in Task 10. `DELETE /api/contracts/[id]` now always returns `{ deleted: true }` on success (previously could also return `{ cancelled: true }`).

- [ ] **Step 1: Write the failing test for bulk-delete**

```ts
// app/api/contracts/bulk-delete/__tests__/route.test.ts
/** @jest-environment node */
import { POST } from '@/app/api/contracts/bulk-delete/route'
import { NextRequest } from 'next/server'
import {
  createMockSupabaseServerClient,
  createMockSupabaseAdminClient,
} from '@/lib/testing/supabase-route-mock'

const mockServerClient = createMockSupabaseServerClient({ user: { id: 'admin-1' } })
const mockAdminClient = createMockSupabaseAdminClient({
  contracts: {
    data: [{ id: 'c1', customer: { name: 'Jane Tan' }, status: 'ACTIVE', start_date: '2026-01-01', end_date: '2027-01-01' }],
    error: null,
  },
  admin_audit_log: { data: null, error: null },
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockServerClient)),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/contracts/bulk-delete', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/contracts/bulk-delete', () => {
  it('returns 400 when ids is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('hard-deletes contracts regardless of status and logs the audit entry', async () => {
    const res = await POST(makeRequest({ ids: ['c1'] }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.succeeded).toEqual(['c1'])
    expect(mockAdminClient.from).toHaveBeenCalledWith('contracts')
    expect(mockAdminClient.from).toHaveBeenCalledWith('admin_audit_log')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/contracts/bulk-delete -v`
Expected: FAIL with "Cannot find module '@/app/api/contracts/bulk-delete/route'"

- [ ] **Step 3: Write the bulk-delete implementation**

```ts
// app/api/contracts/bulk-delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminDelete } from '@/lib/admin/audit-log'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ids }: { ids: string[] } = await request.json()
  if (!ids?.length) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: contracts } = await adminClient
    .from('contracts')
    .select('id, customer:profiles(name), status, start_date, end_date')
    .in('id', ids)

  const rows = (contracts ?? []) as {
    id: string
    customer: { name: string } | null
    status: string
    start_date: string
    end_date: string
  }[]

  const { error: deleteError } = await adminClient.from('contracts').delete().in('id', ids)

  if (deleteError) {
    return NextResponse.json({
      succeeded: [],
      failed: ids.map(id => ({ id, error: deleteError.message })),
    }, { status: 200 })
  }

  await logAdminDelete(
    adminClient,
    user.id,
    'contract',
    rows.map(r => ({
      id: r.id,
      label: `${r.customer?.name ?? 'Unknown'} — ${r.status} — ${r.start_date} to ${r.end_date}`,
    }))
  )

  return NextResponse.json({ succeeded: ids, failed: [] })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/contracts/bulk-delete -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Rewrite the single-contract `DELETE` handler**

In `app/api/contracts/[id]/route.ts`, replace the entire `DELETE` function (lines 52–93) with:

```ts
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createAdminClient()

  const { data: existing } = await adminClient
    .from('contracts')
    .select('id, customer:profiles(name), status, start_date, end_date')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  const { error } = await adminClient.from('contracts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminDelete(adminClient, user.id, 'contract', [{
    id: existing.id,
    label: `${existing.customer?.name ?? 'Unknown'} — ${existing.status} — ${existing.start_date} to ${existing.end_date}`,
  }])

  return NextResponse.json({ deleted: true })
}
```

Add the two new imports at the top of the file, alongside the existing `import { createClient } from '@/lib/supabase/server'`:

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminDelete } from '@/lib/admin/audit-log'
```

- [ ] **Step 6: Simplify the caller in the contract detail page**

In `app/admin/contracts/[id]/page.tsx`, replace `handleDelete` (lines 213–227) with:

```ts
  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteOpen(false)
    if (res.ok) {
      router.push('/admin/contracts')
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }
```

- [ ] **Step 7: Run the full contracts test suite**

Run: `npx jest app/api/contracts -v`
Expected: PASS (all contract route tests, including the new bulk-delete tests)

- [ ] **Step 8: Commit**

```bash
git add app/api/contracts/bulk-delete/route.ts app/api/contracts/bulk-delete/__tests__/route.test.ts app/api/contracts/\[id\]/route.ts app/admin/contracts/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(api): add contracts bulk-delete; always hard-delete on single DELETE

DELETE /api/contracts/[id] previously cancelled a non-CANCELLED contract
and only hard-deleted on a second call. It now always hard-deletes
immediately, matching the new bulk-delete behavior and the admin's
explicit choice to remove a record.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 7: `POST /api/customers/bulk-delete`

**Files:**
- Create: `app/api/customers/bulk-delete/route.ts`
- Test: `app/api/customers/bulk-delete/__tests__/route.test.ts`

**Interfaces:**
- Consumes: same as Task 4, plus `adminClient.auth.admin.deleteUser(id)`.
- Produces: `POST /api/customers/bulk-delete` `{ ids: string[] }` → `{ succeeded: string[], failed: { id: string; error: string }[] }`. Consumed by the Customers UI in Task 12. Unlike Tasks 4–6, this deletes via `auth.admin.deleteUser` per id (not a single batched `.delete().in()`), since each is a separate Auth Admin API call — processed with `Promise.allSettled` so one failure doesn't block the rest.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/customers/bulk-delete/__tests__/route.test.ts
/** @jest-environment node */
import { POST } from '@/app/api/customers/bulk-delete/route'
import { NextRequest } from 'next/server'
import {
  createMockSupabaseServerClient,
  createMockSupabaseAdminClient,
} from '@/lib/testing/supabase-route-mock'

const mockServerClient = createMockSupabaseServerClient({ user: { id: 'admin-1' } })
const deleteUser = jest.fn().mockResolvedValue({ error: null })
const mockAdminClient = createMockSupabaseAdminClient(
  {
    profiles: {
      data: [{ id: 'cust-1', name: 'Jane Tan', phone: '91234567', customer_no: 5 }],
      error: null,
    },
    admin_audit_log: { data: null, error: null },
  },
  { deleteUser }
)

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockServerClient)),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => mockAdminClient),
}))

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/customers/bulk-delete', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/customers/bulk-delete', () => {
  it('returns 400 when ids is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('calls auth.admin.deleteUser for each id and logs the audit entry', async () => {
    const res = await POST(makeRequest({ ids: ['cust-1'] }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(deleteUser).toHaveBeenCalledWith('cust-1')
    expect(body.succeeded).toEqual(['cust-1'])
    expect(body.failed).toEqual([])
    expect(mockAdminClient.from).toHaveBeenCalledWith('admin_audit_log')
  })

  it('reports per-id failures without failing the whole batch', async () => {
    deleteUser.mockResolvedValueOnce({ error: { message: 'user not found' } })
    const res = await POST(makeRequest({ ids: ['cust-1'] }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.succeeded).toEqual([])
    expect(body.failed).toEqual([{ id: 'cust-1', error: 'user not found' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/customers/bulk-delete -v`
Expected: FAIL with "Cannot find module '@/app/api/customers/bulk-delete/route'"

- [ ] **Step 3: Write the implementation**

```ts
// app/api/customers/bulk-delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminDelete } from '@/lib/admin/audit-log'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ids }: { ids: string[] } = await request.json()
  if (!ids?.length) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: customers } = await adminClient
    .from('profiles')
    .select('id, name, phone, customer_no')
    .in('id', ids)

  const rows = (customers ?? []) as { id: string; name: string; phone: string; customer_no: number }[]
  const labelById = new Map(rows.map(r => [r.id, `${r.name} — ${r.phone} — #${r.customer_no}`]))

  const results = await Promise.allSettled(
    ids.map(async id => {
      const { error } = await adminClient.auth.admin.deleteUser(id)
      if (error) throw new Error(error.message)
      return id
    })
  )

  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') succeeded.push(ids[i])
    else failed.push({ id: ids[i], error: result.reason instanceof Error ? result.reason.message : 'Delete failed' })
  })

  if (succeeded.length > 0) {
    await logAdminDelete(
      adminClient,
      user.id,
      'customer',
      succeeded.map(id => ({ id, label: labelById.get(id) ?? id }))
    )
  }

  return NextResponse.json({ succeeded, failed })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/customers/bulk-delete -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/customers/bulk-delete/route.ts app/api/customers/bulk-delete/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add POST /api/customers/bulk-delete

Deletes via auth.admin.deleteUser per id (cascades profiles → contracts
/ invoices / bookings per migration 035), processed with
Promise.allSettled so one failure doesn't block the rest of the batch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 8: Shared UI — `Checkbox` primitive + `ConfirmDeleteModal`

**Files:**
- Create: `components/ui/checkbox.tsx`
- Create: `components/admin/ConfirmDeleteModal.tsx`

**Interfaces:**
- Produces: `<Checkbox checked={boolean} onCheckedChange={(checked: boolean) => void} aria-label={string} />` — used by Tasks 9–12 on every row/card and in bulk-select-all controls.
- Produces: `<ConfirmDeleteModal open={boolean} onOpenChange={(open: boolean) => void} title={string} items={{ id: string; label: string }[]} warning={string | undefined} onConfirm={() => Promise<void>} />` — used by Tasks 9–12 for both single and bulk delete. Internally: disables the confirm button and shows a spinner while `onConfirm` is in flight; catches a thrown error from `onConfirm` and displays it inline without closing; on success, calls `onOpenChange(false)`.

No dedicated test — this repo has no React component test infrastructure (only Jest unit tests for pure functions/route handlers and Playwright for e2e), so verification for both components is manual (Step 3) plus the e2e test in Task 13 that exercises `ConfirmDeleteModal` end-to-end.

- [ ] **Step 1: Write the `Checkbox` component**

```tsx
// components/ui/checkbox.tsx
"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-border bg-white shadow-xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-accent/30 data-[checked]:bg-accent data-[checked]:border-accent data-[checked]:text-white disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
```

- [ ] **Step 2: Write the `ConfirmDeleteModal` component**

```tsx
// components/admin/ConfirmDeleteModal.tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  items: { id: string; label: string }[]
  warning?: string
  onConfirm: () => Promise<void>
}

export function ConfirmDeleteModal({ open, onOpenChange, title, items, warning, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This will permanently delete {items.length} {items.length === 1 ? 'item' : 'items'}. This cannot be undone.
          </p>
          <ul className="max-h-40 overflow-y-auto text-sm space-y-1 border border-border rounded-lg p-2 bg-muted/40">
            {items.map(item => (
              <li key={item.id} className="truncate">{item.label}</li>
            ))}
          </ul>
          {warning && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{warning}</p>
          )}
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
          )}
          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? 'Deleting…' : `Delete ${items.length === 1 ? 'Item' : `${items.length} Items`}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Manually verify both components compile and render**

Run: `npm run build`
Expected: build succeeds with no type errors from the two new files (they aren't imported anywhere yet, so this only checks they're syntactically/type valid in isolation — full interactive verification happens once Tasks 9–12 wire them in).

- [ ] **Step 4: Commit**

```bash
git add components/ui/checkbox.tsx components/admin/ConfirmDeleteModal.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add Checkbox primitive + ConfirmDeleteModal

Shared across the four admin list pages for single and bulk delete.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 9: Bookings UI — multi-select + delete

**Files:**
- Modify: `components/admin/BookingCard.tsx`
- Modify: `app/admin/bookings/AdminBookingsClient.tsx`

**Interfaces:**
- Consumes: `Checkbox` and `ConfirmDeleteModal` from Task 8; `POST /api/bookings/bulk-delete` from Task 4.
- Produces: `BookingCard` gains `selected: boolean` and `onToggleSelect: () => void` props (both required — every call site in `AdminBookingsClient` is updated in this task).

- [ ] **Step 1: Add selection + delete affordances to `BookingCard`**

In `components/admin/BookingCard.tsx`, add the import and extend `Props`:

```ts
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'
```

```ts
interface Props {
  booking: BookingWithRelations
  onUpdate: () => void
  highlighted?: boolean
  onCardClick?: () => void
  contractVisitInfo?: { visitNo: number; totalVisits: number }
  selected: boolean
  onToggleSelect: () => void
  onDeleteClick: () => void
}
```

Update the function signature (line 40):

```ts
export function BookingCard({ booking, onUpdate, highlighted, onCardClick, contractVisitInfo, selected, onToggleSelect, onDeleteClick }: Props) {
```

Replace the top row (lines 74–94) to add the checkbox and a delete button next to the existing badges:

```tsx
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2">
          <div onClick={e => e.stopPropagation()} className="pt-0.5">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select booking for ${booking.customer.name}`} />
          </div>
          <div>
            <p className="font-heading font-semibold text-primary text-sm">{booking.customer.name}</p>
            <p className="text-xs text-slate-500">{booking.customer.phone}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 justify-end items-start">
          {booking.contract_id && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              Contract{contractVisitInfo ? ` · Visit ${contractVisitInfo.visitNo}/${contractVisitInfo.totalVisits}` : ''}
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[booking.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {booking.status}
          </span>
          {booking.urgency && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgencyColor[booking.urgency]}`}>
              {booking.urgency}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDeleteClick() }}
            aria-label={`Delete booking for ${booking.customer.name}`}
            className="text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
```

- [ ] **Step 2: Add selection state, delete modal, and bulk-action bar to `AdminBookingsClient`**

In `app/admin/bookings/AdminBookingsClient.tsx`, add imports:

```ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { ConfirmDeleteModal } from '@/components/admin/ConfirmDeleteModal'
import { Checkbox } from '@/components/ui/checkbox'
```

(Replace the existing `import { useState, useCallback, useRef, useEffect } from 'react'` on line 2 with the line above — adds `useMemo`.)

Add state right after `const [selectedJobId, setSelectedJobId] = useState<string | null>(null)` (line 43):

```ts
  // Multi-select delete (independent of pin-click selection above)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [singleDeleteBooking, setSingleDeleteBooking] = useState<BookingWithRelations | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
```

Update `switchTab` (line 131) to clear selection when the tab changes:

```ts
  function switchTab(tab: Tab) {
    setActiveTab(tab)
    setSelectedJobId(null)
    setSelectedIds(new Set())
  }
```

Add a computed "active list" and delete-modal item list right after `allFiltered` is defined (after line 149):

```ts
  const activeList = activeTab === 'MAINTENANCE' ? maintenanceFiltered
    : activeTab === 'FAULT_REPAIR' ? faultRepairFiltered
    : activeTab === 'INSTALLATION' ? installationFiltered
    : allFiltered

  const allVisibleSelected = activeList.length > 0 && activeList.every(b => selectedIds.has(b.id))

  function toggleSelectAllVisible() {
    setSelectedIds(prev => {
      if (allVisibleSelected) return new Set()
      return new Set(activeList.map(b => b.id))
    })
  }

  const deleteModalItems = useMemo(() => {
    if (singleDeleteBooking) {
      return [{ id: singleDeleteBooking.id, label: `${singleDeleteBooking.customer.name} — ${singleDeleteBooking.service_type.name}` }]
    }
    return bookings
      .filter(b => selectedIds.has(b.id))
      .map(b => ({ id: b.id, label: `${b.customer.name} — ${b.service_type.name}` }))
  }, [singleDeleteBooking, selectedIds, bookings])

  async function handleConfirmDelete() {
    const ids = singleDeleteBooking ? [singleDeleteBooking.id] : Array.from(selectedIds)
    const res = await fetch('/api/bookings/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Delete failed')
    }
    const body = await res.json()
    if (body.failed?.length) {
      throw new Error(`${body.failed.length} of ${ids.length} bookings could not be deleted`)
    }
    setSingleDeleteBooking(null)
    setSelectedIds(new Set())
    await refresh()
  }
```

Add the bulk-action bar and modal right after the Tabs block (after line 220, before the `{/* ── Mobile: card list + Show Map FAB ── */}` comment on line 222):

```tsx
      {/* Bulk-select action bar — shared across mobile/desktop layouts */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible bookings" />
          Select all
        </label>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
          >
            Delete {selectedIds.size} Selected
          </button>
        )}
      </div>

      <ConfirmDeleteModal
        open={deleteModalOpen || !!singleDeleteBooking}
        onOpenChange={(open) => { if (!open) { setDeleteModalOpen(false); setSingleDeleteBooking(null) } }}
        title={singleDeleteBooking ? 'Delete Booking' : `Delete ${selectedIds.size} Bookings`}
        items={deleteModalItems}
        onConfirm={handleConfirmDelete}
      />
```

- [ ] **Step 3: Wire `selected`/`onToggleSelect`/`onDeleteClick` into every `BookingCard` call site**

There are 8 call sites (4 tabs × mobile/desktop). In each, change:

```tsx
<BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
```

to:

```tsx
<BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} selected={selectedIds.has(b.id)} onToggleSelect={() => toggleSelect(b.id)} onDeleteClick={() => setSingleDeleteBooking(b)} />
```

(Lines 271, 298, 325, 347, 433, 484, 535, 575 — same text, applied 8 times.)

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, log in as admin, go to `/admin/bookings`.
- Check a few booking cards' checkboxes → confirm the bulk bar shows "Delete N Selected".
- Click it → confirm the modal lists the selected bookings' customer/service labels.
- Confirm → bookings disappear from the list and the bulk bar resets.
- Click the trash icon on a single card → confirm the modal shows just that one booking, and confirming it deletes only that booking.
- Confirm clicking a card (not the checkbox) still highlights the map pin as before (checkbox click must not trigger `onCardClick`).

- [ ] **Step 5: Commit**

```bash
git add components/admin/BookingCard.tsx app/admin/bookings/AdminBookingsClient.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add multi-select + delete to bookings admin page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 10: Contracts UI — multi-select + delete

**Files:**
- Modify: `components/admin/ContractCard.tsx`
- Modify: `app/admin/contracts/page.tsx`

**Interfaces:**
- Consumes: `Checkbox` and `ConfirmDeleteModal` from Task 8; `POST /api/contracts/bulk-delete` from Task 6.
- Produces: `ContractCard` gains `selected: boolean`, `onToggleSelect: () => void`, `onDeleteClick: () => void` props.

- [ ] **Step 1: Add selection + delete affordances to `ContractCard`**

In `components/admin/ContractCard.tsx`, add imports:

```ts
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'
```

Extend `Props` (line 10):

```ts
interface Props {
  contract: ContractWithCustomer & { contract_service_dates: ContractServiceDate[] }
  isOverdue?: boolean
  selected: boolean
  onToggleSelect: () => void
  onDeleteClick: () => void
}
```

Update the function signature (line 35):

```ts
export default function ContractCard({ contract, isOverdue, selected, onToggleSelect, onDeleteClick }: Props) {
```

Replace the header row (lines 59–82) to add the checkbox and delete button:

```tsx
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className="pt-0.5">
              <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select contract for ${contract.customer.name}`} />
            </div>
            <div>
              <p className="font-semibold text-primary">{contract.customer.name}</p>
              <p className="text-sm text-muted-foreground">{contract.customer.phone}</p>
              {contract.address && (
                <p className="text-xs text-muted-foreground mt-0.5">{contract.address}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 justify-end items-start">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status]}`}>
              {statusLabels[contract.status] ?? contract.status}
            </span>
            {dueBadge && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">Service Due</Badge>
            )}
            {isOverdue && (
              <Badge className="bg-destructive text-destructive-foreground text-xs">Overdue</Badge>
            )}
            {expiringSoon && (
              <Badge className="bg-red-100 text-red-700 text-xs">Expiring Soon</Badge>
            )}
            <button
              onClick={onDeleteClick}
              aria-label={`Delete contract for ${contract.customer.name}`}
              className="text-slate-400 hover:text-red-600 transition-colors ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
```

- [ ] **Step 2: Add selection state, delete modal, and bulk-action bar to the contracts page**

In `app/admin/contracts/page.tsx`, add imports:

```ts
import { useMemo } from 'react'
import { ConfirmDeleteModal } from '@/components/admin/ConfirmDeleteModal'
import { Checkbox } from '@/components/ui/checkbox'
```

(Add `useMemo` to the existing `import { useEffect, useRef, useState } from 'react'` on line 3.)

Add state near the other `useState` declarations (after `const [filtersOpen, setFiltersOpen] = useState(false)` on line 54):

```ts
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [singleDeleteContract, setSingleDeleteContract] = useState<ContractRow | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
```

Find where `filteredContracts` is computed (the array rendered by the two `ContractCard` loops) and add right after its definition:

```ts
  const allVisibleSelected = filteredContracts.length > 0 && filteredContracts.every(c => selectedIds.has(c.id))

  function toggleSelectAllVisible() {
    setSelectedIds(prev => allVisibleSelected ? new Set() : new Set(filteredContracts.map(c => c.id)))
  }

  const deleteModalItems = useMemo(() => {
    if (singleDeleteContract) {
      return [{ id: singleDeleteContract.id, label: `${singleDeleteContract.customer.name} — ${singleDeleteContract.status}` }]
    }
    return contracts
      .filter(c => selectedIds.has(c.id))
      .map(c => ({ id: c.id, label: `${c.customer.name} — ${c.status}` }))
  }, [singleDeleteContract, selectedIds, contracts])

  async function handleConfirmDelete() {
    const ids = singleDeleteContract ? [singleDeleteContract.id] : Array.from(selectedIds)
    const res = await fetch('/api/contracts/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Delete failed')
    }
    const body = await res.json()
    if (body.failed?.length) {
      throw new Error(`${body.failed.length} of ${ids.length} contracts could not be deleted`)
    }
    setSingleDeleteContract(null)
    setSelectedIds(new Set())
    fetchContracts() // existing refresh function used elsewhere in this file after create/edit
  }
```

(If the existing refresh function in this file is named differently than `fetchContracts`, use its actual name — check the function passed to the create-contract dialog's `onSuccess`/`onOpenChange` handler in this same file and reuse it here.)

Add the bulk-action bar just before the "Desktop: 2-col grid" comment (before line ~554), and the modal right after the closing `)}` of the `filteredContracts.length === 0 ... : (...)` block:

```tsx
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible contracts" />
            Select all
          </label>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
            >
              Delete {selectedIds.size} Selected
            </button>
          )}
        </div>
```

```tsx
        <ConfirmDeleteModal
          open={deleteModalOpen || !!singleDeleteContract}
          onOpenChange={(open) => { if (!open) { setDeleteModalOpen(false); setSingleDeleteContract(null) } }}
          title={singleDeleteContract ? 'Delete Contract' : `Delete ${selectedIds.size} Contracts`}
          items={deleteModalItems}
          onConfirm={handleConfirmDelete}
        />
```

- [ ] **Step 3: Wire `selected`/`onToggleSelect`/`onDeleteClick` into both `ContractCard` call sites**

Change both occurrences of:

```tsx
<ContractCard key={c.id} contract={c} isOverdue={c.isOverdue} />
```

to:

```tsx
<ContractCard key={c.id} contract={c} isOverdue={c.isOverdue} selected={selectedIds.has(c.id)} onToggleSelect={() => toggleSelect(c.id)} onDeleteClick={() => setSingleDeleteContract(c)} />
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, go to `/admin/contracts`. Select several contracts (any status, including ACTIVE) → bulk delete → confirm they're gone regardless of status (no more cancel-first step). Single-delete via trash icon on one card. Also open a contract's detail page and confirm the existing "Delete Contract" button there still hard-deletes immediately (Task 6 already changed the route; this just re-confirms end to end).

- [ ] **Step 5: Commit**

```bash
git add components/admin/ContractCard.tsx app/admin/contracts/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add multi-select + delete to contracts admin page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 11: Invoices UI — multi-select + delete

**Files:**
- Modify: `components/admin/InvoiceRow.tsx`
- Modify: `app/admin/invoices/page.tsx` (both the desktop table and the file-local `MobileInvoiceCard`)

**Interfaces:**
- Consumes: `Checkbox` and `ConfirmDeleteModal` from Task 8; `POST /api/invoices/bulk-delete` from Task 5.
- Produces: `InvoiceRow` gains `selected: boolean`, `onToggleSelect: () => void`, `onDeleteClick: () => void` props. `MobileInvoiceCard` (file-local) gains the same three props.

- [ ] **Step 1: Add selection + delete affordances to `InvoiceRow`**

In `components/admin/InvoiceRow.tsx`, add imports:

```ts
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'
```

Extend `Props` (line 23) and the function signature (line 32):

```ts
interface Props {
  invoice: InvoiceWithCustomer
  onPaid: () => void
  showCustomer?: boolean
  className?: string
  selected: boolean
  onToggleSelect: () => void
  onDeleteClick: () => void
}
```

```ts
export default function InvoiceRow({ invoice, onPaid, showCustomer = false, className, selected, onToggleSelect, onDeleteClick }: Props) {
```

Add a checkbox `<td>` right after the opening `<tr>` (before line 56's `showCustomer` block):

```tsx
      <td className="py-2 px-3 w-8">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select invoice ${invoice.description}`} />
      </td>
```

Add a delete button inside the last `<td>`'s action `<div>` (the `flex gap-1.5 flex-wrap` div at line 80), as the first child:

```tsx
        <div className="flex gap-1.5 flex-wrap items-center">
          <button
            onClick={onDeleteClick}
            aria-label={`Delete invoice ${invoice.description}`}
            className="text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        {invoice.booking_id && (
```

(Keep the rest of that block unchanged — this just adds the button before the existing `{invoice.booking_id && (...)}` line, inside the same wrapping `<div>`.)

- [ ] **Step 2: Add selection + delete affordances to `MobileInvoiceCard`**

In `app/admin/invoices/page.tsx`, update `MobileInvoiceCard`'s props (line 31):

```ts
function MobileInvoiceCard({ invoice, onPaid, selected, onToggleSelect, onDeleteClick }: {
  invoice: InvoiceWithCustomer
  onPaid: () => void
  selected: boolean
  onToggleSelect: () => void
  onDeleteClick: () => void
}) {
```

Add the checkbox + delete button to its header row (lines 55–60):

```tsx
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select invoice ${invoice.description}`} />
          <p className="text-sm font-semibold text-primary">{invoice.customer?.name ?? '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>{invoice.status}</span>
          <button onClick={onDeleteClick} aria-label={`Delete invoice ${invoice.description}`} className="text-slate-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
```

Add the same import line as Step 1 (`Checkbox`, `Trash2`) to this file's top-level imports.

- [ ] **Step 3: Add selection state, delete modal, and bulk-action bar to `AdminInvoicesContent`**

Add imports:

```ts
import { ConfirmDeleteModal } from '@/components/admin/ConfirmDeleteModal'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'
```

(Add `useMemo` to the existing `import { Suspense, useEffect, useRef, useState } from 'react'` on line 3.)

Add state near the other `useState` declarations in `AdminInvoicesContent` (after `const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])` on line 127):

```ts
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [singleDeleteInvoice, setSingleDeleteInvoice] = useState<InvoiceWithCustomer | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
```

Right after `filteredInvoices` is computed (used by both render loops at lines 532/547), add:

```ts
  const allVisibleSelected = filteredInvoices.length > 0 && filteredInvoices.every(i => selectedIds.has(i.id))

  function toggleSelectAllVisible() {
    setSelectedIds(prev => allVisibleSelected ? new Set() : new Set(filteredInvoices.map(i => i.id)))
  }

  const deleteModalItems = useMemo(() => {
    if (singleDeleteInvoice) {
      return [{ id: singleDeleteInvoice.id, label: `${singleDeleteInvoice.customer?.name ?? 'Unknown'} — S$${Number(singleDeleteInvoice.amount_sgd).toFixed(2)}` }]
    }
    return invoices
      .filter(i => selectedIds.has(i.id))
      .map(i => ({ id: i.id, label: `${i.customer?.name ?? 'Unknown'} — S$${Number(i.amount_sgd).toFixed(2)}` }))
  }, [singleDeleteInvoice, selectedIds, invoices])

  async function handleConfirmDelete() {
    const ids = singleDeleteInvoice ? [singleDeleteInvoice.id] : Array.from(selectedIds)
    const res = await fetch('/api/invoices/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Delete failed')
    }
    const body = await res.json()
    if (body.failed?.length) {
      throw new Error(`${body.failed.length} of ${ids.length} invoices could not be deleted`)
    }
    setSingleDeleteInvoice(null)
    setSelectedIds(new Set())
    fetchInvoices()
  }
```

Add the bulk-action bar right before the `{loading ? (` block (before line 511), and the modal right after that block's closing `)}` (after line 552):

```tsx
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible invoices" />
          Select all
        </label>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
          >
            Delete {selectedIds.size} Selected
          </button>
        )}
      </div>
```

```tsx
      <ConfirmDeleteModal
        open={deleteModalOpen || !!singleDeleteInvoice}
        onOpenChange={(open) => { if (!open) { setDeleteModalOpen(false); setSingleDeleteInvoice(null) } }}
        title={singleDeleteInvoice ? 'Delete Invoice' : `Delete ${selectedIds.size} Invoices`}
        items={deleteModalItems}
        onConfirm={handleConfirmDelete}
      />
```

- [ ] **Step 4: Wire the new props into both render loops**

Add a `<th>` for the checkbox column right before `<th className="py-2 px-3">Customer</th>` (line 522):

```tsx
                  <th className="py-2 px-3 w-8">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible invoices" />
                  </th>
```

Update the desktop `InvoiceRow` call site (lines 533–539):

```tsx
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    onPaid={fetchInvoices}
                    showCustomer
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/40'}
                    selected={selectedIds.has(inv.id)}
                    onToggleSelect={() => toggleSelect(inv.id)}
                    onDeleteClick={() => setSingleDeleteInvoice(inv)}
                  />
```

Update the mobile `MobileInvoiceCard` call site (line 548):

```tsx
              <MobileInvoiceCard key={inv.id} invoice={inv} onPaid={fetchInvoices} selected={selectedIds.has(inv.id)} onToggleSelect={() => toggleSelect(inv.id)} onDeleteClick={() => setSingleDeleteInvoice(inv)} />
```

- [ ] **Step 5: Manually verify**

Run: `npm run dev`, go to `/admin/invoices`. Verify checkbox column appears in the desktop table without breaking column alignment, bulk-select-all works, single delete via trash icon works on both desktop rows and mobile cards, and "Mark Paid" still works unaffected.

- [ ] **Step 6: Commit**

```bash
git add components/admin/InvoiceRow.tsx app/admin/invoices/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add multi-select + delete to invoices admin page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 12: Customers UI — split into server + client, add multi-select + delete

**Files:**
- Modify: `app/admin/customers/page.tsx` (becomes a thin Server Component)
- Create: `app/admin/customers/AdminCustomersClient.tsx`

**Interfaces:**
- Consumes: `Checkbox` and `ConfirmDeleteModal` from Task 8; `POST /api/customers/bulk-delete` from Task 7.
- Produces: `AdminCustomersClient` component with props `{ customers: { id: string; name: string; phone: string; customer_no: number | null }[]; bookingCounts: Record<string, number>; invoiceTotals: Record<string, number>; activeContractIds: string[] }` — mirrors the existing `AdminBookingsClient` server/client split pattern (`app/admin/bookings/page.tsx` → `AdminBookingsClient`).

- [ ] **Step 1: Extract the interactive table into `AdminCustomersClient`**

Create `app/admin/customers/AdminCustomersClient.tsx` with the full interactive body (everything currently in `page.tsx` from the "Table" section onward), plus selection state, dependent-count lookup, and delete wiring:

```tsx
// app/admin/customers/AdminCustomersClient.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDeleteModal } from '@/components/admin/ConfirmDeleteModal'
import { Trash2 } from 'lucide-react'

interface CustomerRow {
  id: string
  name: string
  phone: string
  customer_no: number | null
}

interface Props {
  customers: CustomerRow[]
  bookingCounts: Record<string, number>
  invoiceTotals: Record<string, number>
  activeContractIds: string[]
}

export function AdminCustomersClient({ customers, bookingCounts, invoiceTotals, activeContractIds }: Props) {
  const supabase = createClient()
  const activeContracts = useMemo(() => new Set(activeContractIds), [activeContractIds])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [singleDeleteCustomer, setSingleDeleteCustomer] = useState<CustomerRow | null>(null)
  const [dependentCounts, setDependentCounts] = useState<{ bookings: number; contracts: number; invoices: number } | null>(null)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id))

  function toggleSelectAllVisible() {
    setSelectedIds(prev => allVisibleSelected ? new Set() : new Set(customers.map(c => c.id)))
  }

  const deleteModalItems = useMemo(() => {
    if (singleDeleteCustomer) {
      return [{ id: singleDeleteCustomer.id, label: `${singleDeleteCustomer.name} — ${singleDeleteCustomer.phone}` }]
    }
    return customers
      .filter(c => selectedIds.has(c.id))
      .map(c => ({ id: c.id, label: `${c.name} — ${c.phone}` }))
  }, [singleDeleteCustomer, selectedIds, customers])

  async function loadDependentCounts(ids: string[]) {
    const [bookingsRes, contractsRes, invoicesRes] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).in('customer_id', ids),
      supabase.from('contracts').select('id', { count: 'exact', head: true }).in('customer_id', ids),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).in('customer_id', ids),
    ])
    setDependentCounts({
      bookings: bookingsRes.count ?? 0,
      contracts: contractsRes.count ?? 0,
      invoices: invoicesRes.count ?? 0,
    })
  }

  async function openSingleDelete(customer: CustomerRow) {
    setSingleDeleteCustomer(customer)
    await loadDependentCounts([customer.id])
  }

  async function openBulkDelete() {
    setDeleteModalOpen(true)
    await loadDependentCounts(Array.from(selectedIds))
  }

  const warning = dependentCounts && (dependentCounts.bookings + dependentCounts.contracts + dependentCounts.invoices > 0)
    ? `This will also permanently delete ${dependentCounts.bookings} booking${dependentCounts.bookings === 1 ? '' : 's'}, ${dependentCounts.contracts} contract${dependentCounts.contracts === 1 ? '' : 's'}, and ${dependentCounts.invoices} invoice${dependentCounts.invoices === 1 ? '' : 's'}.`
    : undefined

  async function handleConfirmDelete() {
    const ids = singleDeleteCustomer ? [singleDeleteCustomer.id] : Array.from(selectedIds)
    const res = await fetch('/api/customers/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Delete failed')
    }
    const body = await res.json()
    if (body.failed?.length) {
      throw new Error(`${body.failed.length} of ${ids.length} customers could not be deleted`)
    }
    setSingleDeleteCustomer(null)
    setSelectedIds(new Set())
    setDependentCounts(null)
    window.location.reload()
  }

  if (!customers.length) {
    return <p className="text-muted-foreground text-sm">No customers found.</p>
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible customers" />
          Select all
        </label>
        {selectedIds.size > 0 && (
          <button
            onClick={openBulkDelete}
            className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
          >
            Delete {selectedIds.size} Selected
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 w-8">
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} aria-label="Select all visible customers" />
              </th>
              <th className="text-left px-4 py-3">No.</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-right px-4 py-3">Bookings</th>
              <th className="text-right px-4 py-3">Total Paid</th>
              <th className="text-center px-4 py-3">Contract</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-accent/5 transition-colors">
                <td className="px-4 py-3">
                  <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} aria-label={`Select ${c.name}`} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.customer_no ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-accent/10 text-accent font-semibold text-sm flex items-center justify-center shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:text-accent">
                      {c.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                <td className="px-4 py-3 text-right">{bookingCounts[c.id] ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  {invoiceTotals[c.id] ? `S$${invoiceTotals[c.id].toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {activeContracts.has(c.id) ? (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">Active</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/customers/${c.id}`} className="text-accent hover:underline text-xs font-medium">
                      View →
                    </Link>
                    <button onClick={() => openSingleDelete(c)} aria-label={`Delete ${c.name}`} className="text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {customers.map(c => (
          <div key={c.id} className="bg-white border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} aria-label={`Select ${c.name}`} />
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm shrink-0">
                  {c.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeContracts.has(c.id) && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Contract</span>
                )}
                <button onClick={() => openSingleDelete(c)} aria-label={`Delete ${c.name}`} className="text-slate-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{bookingCounts[c.id] ?? 0} bookings</span>
              <span>Total {invoiceTotals[c.id] ? `S$${invoiceTotals[c.id].toFixed(2)}` : '—'}</span>
            </div>
            <Link href={`/admin/customers/${c.id}`} className="block text-xs text-accent font-medium">View →</Link>
          </div>
        ))}
      </div>

      <ConfirmDeleteModal
        open={deleteModalOpen || !!singleDeleteCustomer}
        onOpenChange={(open) => { if (!open) { setDeleteModalOpen(false); setSingleDeleteCustomer(null); setDependentCounts(null) } }}
        title={singleDeleteCustomer ? 'Delete Customer' : `Delete ${selectedIds.size} Customers`}
        items={deleteModalItems}
        warning={warning}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
```

- [ ] **Step 2: Shrink `page.tsx` to a data-fetching Server Component**

Replace `app/admin/customers/page.tsx` entirely with:

```tsx
// app/admin/customers/page.tsx
import { createClient } from '@/lib/supabase/server'
import { Search } from 'lucide-react'
import { AdminCustomersClient } from './AdminCustomersClient'

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select('id, name, phone, customer_no, created_at')
    .eq('role', 'customer')
    .order('name', { ascending: true })

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data: customers } = await query

  const ids = (customers ?? []).map(c => c.id)
  const [bookingCountsRes, invoiceTotalsRes, contractsRes] = await Promise.all([
    ids.length
      ? supabase.from('bookings').select('customer_id').in('customer_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('invoices').select('customer_id, amount_sgd').in('customer_id', ids).eq('status', 'PAID')
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('contracts').select('customer_id, status').in('customer_id', ids)
      : Promise.resolve({ data: [] }),
  ])

  const bookingCounts = (bookingCountsRes.data ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.customer_id] = (acc[b.customer_id] ?? 0) + 1
    return acc
  }, {})

  const invoiceTotals = (invoiceTotalsRes.data ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.customer_id] = (acc[i.customer_id] ?? 0) + parseFloat(i.amount_sgd)
    return acc
  }, {})

  const activeContractIds = (contractsRes.data ?? [])
    .filter(c => c.status === 'ACTIVE')
    .map(c => c.customer_id)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-bold text-2xl text-primary">Customers</h1>
        <span className="text-sm text-muted-foreground">{customers?.length ?? 0} customers</span>
      </div>

      <form method="GET" className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </form>

      <AdminCustomersClient
        customers={customers ?? []}
        bookingCounts={bookingCounts}
        invoiceTotals={invoiceTotals}
        activeContractIds={activeContractIds}
      />
    </div>
  )
}
```

(This drops the unused `createAdminClient` and `Link` imports from the original file — `Link` is now only used inside `AdminCustomersClient`, and `createAdminClient` was never actually used in the original either.)

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, go to `/admin/customers`. Confirm the list renders identically to before (search still works via the server-side `q` param). Select a customer with bookings/contracts/invoices → single-delete → confirm the modal shows the dependent-count warning line → confirm → customer and all their data are gone, and they can no longer log in (check `/auth/login` with their credentials). Try bulk-selecting multiple customers and deleting together.

- [ ] **Step 4: Commit**

```bash
git add app/admin/customers/page.tsx app/admin/customers/AdminCustomersClient.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add multi-select + delete to customers admin page

Splits the customers page into a server data-fetcher and a client
component (mirroring the existing admin/bookings split) so it can hold
selection state, dependent-count lookups, and the delete flow.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

### Task 13: e2e delete flow

**Files:**
- Create: `e2e/admin/delete-flows.spec.ts`

**Interfaces:**
- Consumes: `e2e/.auth/admin.json` storage state (already produced by `e2e/auth.setup.ts`); the `mobile-admin`/`tablet-admin` Playwright projects already `testMatch: '**/admin/**'`, so this file is picked up automatically.

- [ ] **Step 1: Write the e2e spec**

```ts
// e2e/admin/delete-flows.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Admin hard delete', () => {
  test('bulk-select and delete bookings', async ({ page }) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: 'All' }).click()

    const firstCheckbox = page.locator('[data-slot="checkbox"]').first()
    await firstCheckbox.click()

    await expect(page.getByRole('button', { name: /Delete \d+ Selected/ })).toBeVisible()
    await page.getByRole('button', { name: /Delete \d+ Selected/ }).click()

    await expect(page.getByRole('button', { name: /Delete (\d+ )?Items?/ })).toBeVisible()
    await page.getByRole('button', { name: /Delete (\d+ )?Items?/ }).click()

    await expect(page.getByRole('button', { name: /Delete \d+ Selected/ })).not.toBeVisible()
  })

  test('delete a single invoice via the row trash icon', async ({ page }) => {
    await page.goto('/admin/invoices')
    const rowCountBefore = await page.locator('table tbody tr').count()
    if (rowCountBefore === 0) test.skip()

    // InvoiceRow (desktop table) and MobileInvoiceCard share the same
    // aria-label; only one is visible per viewport, so scope to :visible
    // rather than relying on DOM order.
    await page.locator('button[aria-label^="Delete invoice"]:visible').first().click()
    await page.getByRole('button', { name: 'Delete Item' }).click()

    await expect(page.locator('table tbody tr')).toHaveCount(rowCountBefore - 1)
  })
})
```

- [ ] **Step 2: Run the e2e spec**

Run: `npx playwright test e2e/admin/delete-flows.spec.ts --project=mobile-admin`
Expected: PASS (2 tests) — this requires a running dev server and seeded admin test data per this repo's existing Playwright setup (see `playwright.config.ts` / `e2e/auth.setup.ts`); run against a non-production Supabase project, since this test permanently deletes rows.

- [ ] **Step 3: Commit**

```bash
git add e2e/admin/delete-flows.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add admin bulk-delete + single-delete flow coverage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ei8QUZa9jhqWyiVn6HJNAS
EOF
)"
```

---

## Post-plan checklist

- [ ] Update `CLAUDE.md`'s file map and "Key flows" section to mention the new `bulk-delete` routes, `ConfirmDeleteModal`, `Checkbox`, and the changed `DELETE /api/contracts/[id]` behavior (this repo's CLAUDE.md is kept current with each shipped feature — see its "Feature completeness" / "Last updated" convention).
- [ ] Run `npm run lint` and `npx jest` once all tasks are complete to confirm nothing else broke.
