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
