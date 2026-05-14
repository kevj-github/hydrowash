import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { num_units, address, preferred_month, notes } = body

  if (!num_units || !preferred_month) {
    return NextResponse.json({ error: 'num_units and preferred_month are required' }, { status: 400 })
  }

  // preferred_month is YYYY-MM — start_date is first day of that month
  const start_date = `${preferred_month}-01`
  const startDateObj = new Date(start_date)
  const endDateObj = new Date(startDateObj)
  endDateObj.setFullYear(endDateObj.getFullYear() + 1)
  const end_date = endDateObj.toISOString().split('T')[0]

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({
      customer_id: user.id,
      num_units,
      price_sgd: null,
      start_date,
      end_date,
      address: address || null,
      notes: notes || null,
      status: 'PENDING_REVIEW',
    })
    .select()
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({ contract_id: contract.id }, { status: 201 })
}
