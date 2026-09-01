import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/maps/geocode'
import { sendBookingReceived } from '@/lib/email/send'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = request.nextUrl.searchParams.get('admin') === '1'

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const query = supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd), contract_service_dates(id,due_month,contract_id)')
    .order('created_at', { ascending: false })

  if (!isAdmin || profile.role !== 'admin') {
    query.eq('customer_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build visitMap: bookingId → { visitNo, totalVisits } for linked service dates
  const visitMap: Record<string, { visitNo: number; totalVisits: number }> = {}
  const linkedContractIds = [...new Set(
    (data ?? [])
      .flatMap(b => (b.contract_service_dates ?? []).map((c: { contract_id: string }) => c.contract_id))
      .filter(Boolean)
  )]

  if (linkedContractIds.length > 0) {
    const { data: allCsds } = await supabase
      .from('contract_service_dates')
      .select('id, contract_id, due_month')
      .in('contract_id', linkedContractIds)
      .order('due_month', { ascending: true })

    const byContract = (allCsds ?? []).reduce<Record<string, { id: string }[]>>((acc, c) => {
      acc[c.contract_id] = acc[c.contract_id] ?? []
      acc[c.contract_id].push(c)
      return acc
    }, {})

    for (const b of data ?? []) {
      const csd = (b.contract_service_dates ?? [])[0] as { id: string; contract_id: string } | undefined
      if (!csd) continue
      const list = byContract[csd.contract_id] ?? []
      const idx = list.findIndex((c: { id: string }) => c.id === csd.id)
      if (idx >= 0) visitMap[b.id] = { visitNo: idx + 1, totalVisits: list.length }
    }
  }

  // Return object shape when admin=1 to include visitMap; plain array otherwise
  if (isAdmin && profile.role === 'admin') {
    return NextResponse.json({ bookings: data, visitMap })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { preferred_date_slots, unit_location_ids, unit_location_others, contract_id } = body as {
    preferred_date_slots?: { date: string; slots: string[] }[]
    unit_location_ids?: string[]
    unit_location_others?: string[]
    contract_id?: string
    [key: string]: unknown
  }

  const validSlots = ['S10_12', 'S13_15', 'S15_17', 'S17_19', 'S19_21']

  if (!preferred_date_slots?.length) {
    return NextResponse.json({ error: 'At least one date preference is required' }, { status: 400 })
  }
  if (preferred_date_slots.length > 5) {
    return NextResponse.json({ error: 'Maximum 5 date preferences allowed' }, { status: 400 })
  }

  const sanitisedEntries = preferred_date_slots
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map(e => ({
      date: e.date,
      slots: (e.slots ?? []).filter(s => validSlots.includes(s)).slice(0, 3),
    }))
    .filter(e => e.slots.length > 0)

  if (!sanitisedEntries.length) {
    return NextResponse.json({ error: 'At least one date with valid time slots required' }, { status: 400 })
  }

  for (const entry of sanitisedEntries) {
    const { data: blocked } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('blocked_date', entry.date)
      .is('slot', null)
      .maybeSingle()

    if (blocked) {
      return NextResponse.json(
        { error: `${entry.date} is not available for booking` },
        { status: 409 }
      )
    }
  }

  const booking_date = sanitisedEntries[0].date
  const slots = sanitisedEntries[0].slots
  const time_slot = slots[0]

  // The service type must exist, be active, and belong to the category the client
  // claims — otherwise a caller can book a withdrawn service and inherit its stale
  // price_sgd, which feeds the work-order total. Enforced again by a DB trigger in
  // migration 033; this check exists to return a useful 4xx instead of a 500.
  const { data: serviceType } = await supabase
    .from('service_types')
    .select('id')
    .eq('id', body.service_type_id)
    .eq('category', body.category)
    .eq('active', true)
    .maybeSingle()

  if (!serviceType) {
    return NextResponse.json(
      { error: 'Unknown or inactive service type for this category' },
      { status: 422 }
    )
  }

  // A contract may only be linked by the customer who owns it. Without this a
  // booking — and the invoice generated from it — can be billed against a third
  // party's contract. Also enforced by migration 033.
  if (contract_id) {
    const { data: ownedContract } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', contract_id)
      .eq('customer_id', user.id)
      .maybeSingle()

    if (!ownedContract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
  }

  // Use lat/lng from Places API if provided; fall back to geocoding
  let lat: number = body.lat
  let lng: number = body.lng
  if (!lat || !lng) {
    const geo = await geocodeAddress(`${body.address}, ${body.postal_code}, Singapore`)
    if (!geo) return NextResponse.json({ error: 'Could not geocode address' }, { status: 422 })
    lat = geo.lat
    lng = geo.lng
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: user.id,
      category: body.category,
      service_type_id: body.service_type_id,
      address: body.address,
      postal_code: body.postal_code ?? '',
      lat,
      lng,
      booking_date,
      time_slot,
      preferred_slots: slots,
      preferred_date_slots: sanitisedEntries,
      num_units: body.num_units ?? null,
      fault_description: body.fault_description ?? null,
      urgency: body.urgency ?? null,
      ac_brand: body.ac_brand ?? null,
      ac_model: body.ac_model ?? null,
      notes: body.notes ?? null,
      media_urls: body.media_urls ?? [],
      unit_location_others: unit_location_others ?? [],
      contract_id: contract_id ?? null,
    })
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Insert unit location join rows if provided
  if (unit_location_ids?.length && booking?.id) {
    const { error: locError } = await supabase.from('booking_unit_locations').insert(
      unit_location_ids.map((loc_id: string) => ({
        booking_id: booking.id,
        location_id: loc_id,
      }))
    )
    if (locError) {
      console.error('[bookings POST] Failed to insert unit locations:', locError)
      return NextResponse.json({ error: locError.message }, { status: 500 })
    }
  }

  await sendBookingReceived(booking, user.email!).catch(err =>
    console.error(`[bookings POST] Failed to send confirmation email to ${user.email}:`, err)
  )

  return NextResponse.json(booking, { status: 201 })
}
