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
