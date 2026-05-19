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

  const { booking_date, preferred_slots, unit_location_ids } = body

  if (!booking_date || !preferred_slots?.length) {
    return NextResponse.json({ error: 'booking_date and preferred_slots are required' }, { status: 400 })
  }

  const validSlots = ['S10_12', 'S13_15', 'S15_17', 'S17_19', 'S19_21']
  const slots: string[] = preferred_slots.filter((s: string) => validSlots.includes(s)).slice(0, 3)
  if (!slots.length) {
    return NextResponse.json({ error: 'At least one valid time slot required' }, { status: 400 })
  }

  // Check for full-day block on the requested date
  const { data: blocked } = await supabase
    .from('blocked_slots')
    .select('id')
    .eq('blocked_date', booking_date)
    .is('slot', null)
    .maybeSingle()

  if (blocked) {
    return NextResponse.json({ error: 'That date is not available' }, { status: 409 })
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
      time_slot: slots[0],        // first preference (backward compat)
      preferred_slots: slots,
      num_units: body.num_units ?? null,
      fault_description: body.fault_description ?? null,
      urgency: body.urgency ?? null,
      ac_brand: body.ac_brand ?? null,
      ac_model: body.ac_model ?? null,
      notes: body.notes ?? null,
      media_urls: body.media_urls ?? [],
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
