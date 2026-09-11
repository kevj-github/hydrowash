import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractRequestReceived } from '@/lib/email/send'
import { sanitizeUnitDetails, isUnitDetailsComplete, normalizeUnitDetails } from '@/lib/contracts/units'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { num_units, address, preferred_month, notes, unit_details } = body

  if (!num_units || !preferred_month) {
    return NextResponse.json({ error: 'num_units and preferred_month are required' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}$/.test(preferred_month)) {
    return NextResponse.json({ error: 'preferred_month must be YYYY-MM' }, { status: 400 })
  }

  const normalizedUnitDetails = normalizeUnitDetails(unit_details, num_units)
  const hasUnitDetails = (unit_details?.length ?? 0) > 0
  if (hasUnitDetails && !isUnitDetailsComplete(normalizedUnitDetails, num_units)) {
    return NextResponse.json({ error: 'unit_details must have one complete entry per unit' }, { status: 400 })
  }
  const sanitizedUnitDetails = hasUnitDetails
    ? await sanitizeUnitDetails(supabase, unit_details, num_units)
    : []

  // preferred_month is YYYY-MM — start_date is first day of that month
  const start_date = `${preferred_month}-01`
  const endDateObj = new Date(`${start_date}T00:00:00Z`)
  endDateObj.setUTCFullYear(endDateObj.getUTCFullYear() + 1)
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
      unit_details: sanitizedUnitDetails,
      status: 'PENDING_REVIEW',
    })
    .select()
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  try {
    const { data: customerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const preferredMonthLabel = new Date(`${preferred_month}-01T00:00:00Z`)
      .toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })

    await sendContractRequestReceived(
      {
        customerName: customerProfile?.name ?? 'Customer',
        numUnits: num_units,
        preferredMonth: preferredMonthLabel,
        address: address || undefined,
      },
      user.email!
    )
  } catch {
    // Email failure does not fail the request
  }

  return NextResponse.json({ contract_id: contract.id }, { status: 201 })
}
