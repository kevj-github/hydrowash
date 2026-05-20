import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

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

  const body = await req.json()
  const { price_sgd, start_date, notes } = body

  if (!price_sgd || !start_date) {
    return NextResponse.json({ error: 'price_sgd and start_date are required' }, { status: 400 })
  }

  const priceNum = parseFloat(price_sgd)
  if (isNaN(priceNum) || priceNum <= 0) {
    return NextResponse.json({ error: 'price_sgd must be a positive number' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (existing.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'Contract must be in PENDING_REVIEW status' }, { status: 409 })
  }

  const endDateObj = new Date(`${start_date}T00:00:00Z`)
  endDateObj.setUTCFullYear(endDateObj.getUTCFullYear() + 1)
  const end_date = endDateObj.toISOString().split('T')[0]

  const { data: contract, error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'AWAITING_PAYMENT',
      price_sgd: priceNum,
      start_date,
      end_date,
      notes: notes ?? existing.notes,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !contract) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  // Email is sent separately via POST /api/contracts/[id]/send-contract-pdf after admin previews PDF
  return NextResponse.json({ contract })
}
