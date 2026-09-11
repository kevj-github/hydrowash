import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!booking) return NextResponse.json({ booking: null, unit_location_ids: [] })

  const { data: unitLocations } = await supabase
    .from('booking_unit_locations')
    .select('location_id')
    .eq('booking_id', booking.id)

  return NextResponse.json({
    booking,
    unit_location_ids: (unitLocations ?? []).map((row: { location_id: string }) => row.location_id),
  })
}
