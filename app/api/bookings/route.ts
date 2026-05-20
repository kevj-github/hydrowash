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
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .order('created_at', { ascending: false })

  if (!isAdmin || profile.role !== 'admin') {
    query.eq('customer_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
    await supabase.from('booking_unit_locations').insert(
      unit_location_ids.map((loc_id: string) => ({
        booking_id: booking.id,
        unit_location_id: loc_id,
      }))
    )
  }

  await sendBookingReceived(booking, user.email!).catch(err =>
    console.error(`[bookings POST] Failed to send confirmation email to ${user.email}:`, err)
  )

  return NextResponse.json(booking, { status: 201 })
}
