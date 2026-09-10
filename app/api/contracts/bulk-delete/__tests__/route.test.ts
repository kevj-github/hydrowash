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
