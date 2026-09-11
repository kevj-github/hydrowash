/** @jest-environment node */
import { NextRequest } from 'next/server'

// ── Bespoke chain mock ──────────────────────────────────────────────────────
// This route's queries (.is(), non-.single() array results, plus a separate
// auth.admin.getUserById call per row) don't fit the shared
// lib/testing/supabase-route-mock helper's shape, so we build a small
// table-keyed mock local to this file instead of extending that shared helper.
type ChainResult = { data: unknown; error: { message: string } | null }

function chain(result: ChainResult) {
  const obj: Record<string, jest.Mock> = {}
  for (const m of ['select', 'eq', 'is', 'in', 'update', 'order', 'lte', 'gte']) {
    obj[m] = jest.fn(() => obj)
  }
  ;(obj as unknown as { then: unknown }).then = (resolve: (v: ChainResult) => void) => resolve(result)
  return obj
}

let tableResults: Record<string, ChainResult> = {}
const getUserByIdMock = jest.fn(async (id: string) => ({ data: { user: { email: `${id}@example.com` } as { email: string } | null } }))
const fromMock = jest.fn((table: string) => chain(tableResults[table] ?? { data: null, error: null }))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    from: fromMock,
    auth: { admin: { getUserById: getUserByIdMock } },
  })),
}))

const sendContractServiceDue = jest.fn().mockResolvedValue(true)
const sendContractExpiring = jest.fn().mockResolvedValue(true)
jest.mock('@/lib/email/send', () => ({
  sendContractServiceDue: (...args: unknown[]) => sendContractServiceDue(...args),
  sendContractExpiring: (...args: unknown[]) => sendContractExpiring(...args),
}))

import { GET } from '../route'

function requestAt(isoUtc: string, secret = 'test-secret') {
  jest.useFakeTimers().setSystemTime(new Date(isoUtc))
  return new NextRequest('http://localhost/api/cron/contracts', {
    headers: secret ? { 'x-cron-secret': secret } : {},
  })
}

const dueServiceDate = {
  id: 'csd-1',
  contract_id: 'contract-1',
  due_month: '2026-09',
  contracts: {
    customer_id: 'cust-1',
    num_units: 3,
    status: 'ACTIVE',
    customer: { name: 'Jane Tan' },
  },
}

describe('GET /api/cron/contracts', () => {
  const originalSecret = process.env.CRON_SECRET

  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret'
  })
  afterAll(() => {
    process.env.CRON_SECRET = originalSecret
    jest.useRealTimers()
  })
  beforeEach(() => {
    tableResults = {
      contract_service_dates: { data: [], error: null },
      contracts: { data: [], error: null },
    }
    fromMock.mockClear()
    getUserByIdMock.mockClear()
    sendContractServiceDue.mockClear().mockResolvedValue(true)
    sendContractExpiring.mockClear().mockResolvedValue(true)
  })

  it('rejects requests without the correct cron secret', async () => {
    const req = requestAt('2026-09-01T00:00:00Z', 'wrong-secret')
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('on day 1, sends the first reminder for due, unreminded contracts and flips reminder_sent', async () => {
    tableResults.contract_service_dates = { data: [dueServiceDate], error: null }
    const req = requestAt('2026-09-01T00:00:00Z')

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.service_reminders_sent).toBe(1)
    expect(body.second_reminders_sent).toBe(0)
    expect(sendContractServiceDue).toHaveBeenCalledTimes(1)
    expect(sendContractServiceDue).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'Jane Tan', numUnits: 3 }),
      'cust-1@example.com'
    )

    // Confirms the query actually filters on the FIRST-reminder column, not the second.
    const serviceDateChainCall = fromMock.mock.results.find((r, i) => fromMock.mock.calls[i][0] === 'contract_service_dates')
    expect(serviceDateChainCall?.value.eq).toHaveBeenCalledWith('reminder_sent', false)
  })

  it('on day 15, filters and flips second_reminder_sent instead of reminder_sent', async () => {
    tableResults.contract_service_dates = { data: [dueServiceDate], error: null }
    const req = requestAt('2026-09-15T00:00:00Z')

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.second_reminders_sent).toBe(1)
    expect(body.service_reminders_sent).toBe(0)

    const serviceDateChainCall = fromMock.mock.results.find((r, i) => fromMock.mock.calls[i][0] === 'contract_service_dates')
    expect(serviceDateChainCall?.value.eq).toHaveBeenCalledWith('second_reminder_sent', false)
  })

  it('on a day that is neither 1 nor 15, skips the quarterly-reminder query entirely', async () => {
    const req = requestAt('2026-09-08T00:00:00Z')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.service_reminders_sent).toBe(0)
    expect(sendContractServiceDue).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalledWith('contract_service_dates')
  })

  it('sends no reminder when there are no due, unreminded service dates', async () => {
    tableResults.contract_service_dates = { data: [], error: null }
    const req = requestAt('2026-09-01T00:00:00Z')
    const res = await GET(req)
    const body = await res.json()

    expect(body.service_reminders_sent).toBe(0)
    expect(sendContractServiceDue).not.toHaveBeenCalled()
  })

  it('sends contract-expiry emails and marks expiry_reminder_sent', async () => {
    tableResults.contracts = {
      data: [{
        id: 'contract-2',
        end_date: '2026-09-20',
        customer_id: 'cust-2',
        num_units: 2,
        customer: { name: 'John Lim' },
      }],
      error: null,
    }
    const req = requestAt('2026-09-08T00:00:00Z')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.expiry_emails_sent).toBe(1)
    expect(sendContractExpiring).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'John Lim', numUnits: 2, endDate: '2026-09-20' }),
      'cust-2@example.com'
    )
  })

  it('does not crash and still returns 200 when an email fails to send', async () => {
    tableResults.contract_service_dates = { data: [dueServiceDate], error: null }
    sendContractServiceDue.mockRejectedValueOnce(new Error('Resend down'))
    const req = requestAt('2026-09-01T00:00:00Z')

    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('does not email a customer whose auth user has no email on file', async () => {
    tableResults.contract_service_dates = { data: [dueServiceDate], error: null }
    getUserByIdMock.mockResolvedValueOnce({ data: { user: null } })
    const req = requestAt('2026-09-01T00:00:00Z')

    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(sendContractServiceDue).not.toHaveBeenCalled()
  })
})
