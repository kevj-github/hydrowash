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
