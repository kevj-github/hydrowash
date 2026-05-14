import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id: contractId } = await params

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

  const { service_date_id, booking_id }: { service_date_id: string; booking_id: string } =
    await req.json()

  if (!service_date_id || !booking_id) {
    return NextResponse.json({ error: 'Missing service_date_id or booking_id' }, { status: 400 })
  }

  const { data: dateRow } = await supabase
    .from('contract_service_dates')
    .select('id, contract_id')
    .eq('id', service_date_id)
    .eq('contract_id', contractId)
    .single()

  if (!dateRow) {
    return NextResponse.json({ error: 'Service date not found for this contract' }, { status: 404 })
  }

  const { error } = await supabase
    .from('contract_service_dates')
    .update({ booking_id })
    .eq('id', service_date_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
