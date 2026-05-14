import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/maps/geocode'
import { sendBookingReceived } from '@/lib/email/send'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = request.nextUrl.searchParams.get('admin') === '1'

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const query = supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .order('created_at', { ascending: false })

  if (!isAdmin || profile?.role !== 'admin') {
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
      earliest_date: body.earliest_date,
      latest_date: body.latest_date,
      preferred_slot: body.preferred_slot || null,
      num_units: body.num_units ?? null,
      fault_description: body.fault_description ?? null,
      urgency: body.urgency ?? null,
      ac_brand: body.ac_brand ?? null,
      ac_model: body.ac_model ?? null,
      room_type: body.room_type ?? null,
      notes: body.notes ?? null,
      media_urls: body.media_urls ?? [],
    })
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (profile?.email || user.email) {
    await sendBookingReceived(booking, user.email!).catch(() => null)
  }

  return NextResponse.json(booking, { status: 201 })
}
