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
