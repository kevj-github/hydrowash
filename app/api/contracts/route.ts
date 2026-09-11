import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateContractPayload } from '@/lib/types'
import { generateServiceDates } from '@/lib/contracts/service-dates'
import { sanitizeUnitDetails, isUnitDetailsComplete, normalizeUnitDetails } from '@/lib/contracts/units'

export async function POST(req: NextRequest) {
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

  const body: CreateContractPayload = await req.json()
  const { customer_id, num_units, price_sgd, start_date, address, notes, unit_details } = body

  if (!customer_id || !num_units || !price_sgd || !start_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const normalizedUnitDetails = normalizeUnitDetails(unit_details, num_units)
  const hasUnitDetails = (unit_details?.length ?? 0) > 0
  if (hasUnitDetails && !isUnitDetailsComplete(normalizedUnitDetails, num_units)) {
    return NextResponse.json({ error: 'unit_details must have one complete entry per unit' }, { status: 400 })
  }
  const sanitizedUnitDetails = hasUnitDetails
    ? await sanitizeUnitDetails(supabase, unit_details, num_units)
    : []

  const startDateObj = new Date(`${start_date}T00:00:00Z`)
  const endDateObj = new Date(`${start_date}T00:00:00Z`)
  endDateObj.setUTCFullYear(endDateObj.getUTCFullYear() + 1)
  const end_date = endDateObj.toISOString().split('T')[0]

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      customer_id,
      num_units,
      price_sgd,
      start_date,
      end_date,
      address: address ?? null,
      notes: notes ?? null,
      unit_details: sanitizedUnitDetails,
      status: 'ACTIVE',
    })
    .select()
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: contractError?.message ?? 'Insert failed' }, { status: 500 })
  }

  const serviceDates = generateServiceDates(contract.id, start_date)

  const { error: datesError } = await supabase
    .from('contract_service_dates')
    .insert(serviceDates)

  if (datesError) {
    await supabase.from('contracts').delete().eq('id', contract.id)
    return NextResponse.json({ error: datesError.message }, { status: 500 })
  }

  return NextResponse.json({ contract }, { status: 201 })
}

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('contracts')
    .select(`
      *,
      customer:profiles!contracts_customer_id_fkey (
        id, name, phone
      ),
      contract_service_dates (
        id, due_date, reminder_sent, booking_id
      )
    `)
    .order('created_at', { ascending: false })

  if (status && ['PENDING_REVIEW', 'AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ contracts: data })
}
