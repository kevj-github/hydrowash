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
