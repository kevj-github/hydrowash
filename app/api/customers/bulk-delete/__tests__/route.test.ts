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
