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
