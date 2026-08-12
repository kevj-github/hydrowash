import { createClient } from '@/lib/supabase/server'
import { getDistanceMatrix } from '@/lib/maps/distance-matrix'
import { optimizeRoute } from '@/lib/vrp/optimizer'
import { NextRequest, NextResponse } from 'next/server'
import type { RouteStop, TimeSlot } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { selectedBookingIds }: { selectedBookingIds: string[] } = await request.json()
  if (!selectedBookingIds?.length) return NextResponse.json({ error: 'No bookings selected' }, { status: 400 })

  const [settingsRes, bookingsRes] = await Promise.all([
    supabase.from('app_settings').select('depot_lat,depot_lng').single(),
    supabase
      .from('bookings')
      .select('id, address, lat, lng, notes, time_slot, confirmed_slot, service_type:service_types(name, duration_minutes), customer:profiles(name)')
      .in('id', selectedBookingIds),
  ])

  if (settingsRes.error || !settingsRes.data) {
    return NextResponse.json({ error: 'Depot not configured' }, { status: 500 })
  }

  const depot = { lat: settingsRes.data.depot_lat, lng: settingsRes.data.depot_lng }
  const bookings = bookingsRes.data ?? []

  const ordered = selectedBookingIds
    .map(id => bookings.find((b: any) => b.id === id))
    .filter(Boolean) as typeof bookings

  const locations = [depot, ...ordered.map((b: any) => ({ lat: b.lat, lng: b.lng }))]

  let travelMatrix: number[][]
  try {
    travelMatrix = await getDistanceMatrix(locations)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Distance Matrix error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // The VRP's slot windows must use the slot the job is actually confirmed for,
  // not the customer's first preference.
  const effectiveSlot = (b: { confirmed_slot?: string | null; time_slot?: string | null }) =>
    b.confirmed_slot ?? b.time_slot

  const missingSlot = ordered.find((b: any) => !effectiveSlot(b))
  if (missingSlot) return NextResponse.json({ error: `Booking ${missingSlot.id} has no time_slot` }, { status: 422 })

  const jobs = ordered.map((b: any, i: number) => ({
    bookingId: b.id,
    locationIndex: i + 1,
    durationMinutes: (b.service_type as any)?.duration_minutes ?? 60,
    timeSlot: effectiveSlot(b) as TimeSlot,
  }))

  const vrpResult = optimizeRoute(jobs, travelMatrix)

  const route: RouteStop[] = vrpResult.map(stop => {
    const booking = ordered.find((b: any) => b.id === stop.bookingId) as any
    return {
      bookingId: stop.bookingId,
      sequenceOrder: stop.sequenceOrder,
      estimatedStart: stop.estimatedStart,
      estimatedEnd: stop.estimatedEnd,
      travelFromPrevMinutes: stop.travelFromPrevMinutes,
      lat: booking.lat,
      lng: booking.lng,
      customerName: (booking.customer as any)?.name ?? '',
      address: booking.address,
      serviceType: (booking.service_type as any)?.name ?? '',
      durationMinutes: (booking.service_type as any)?.duration_minutes ?? 60,
      timeSlot: effectiveSlot(booking) as TimeSlot,
      notes: booking.notes ?? null,
    }
  })

  const polyline = [depot, ...route.map(s => ({ lat: s.lat, lng: s.lng }))]

  return NextResponse.json({ route, polyline })
}
