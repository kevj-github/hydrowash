import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { TimeSlot } from '@/lib/types'

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
  }

  const [year, mon] = month.split('-').map(Number)
  const monthStart = `${month}-01`
  const nextMonthStart = new Date(year, mon, 1).toISOString().slice(0, 10)

  const supabase = await createClient()

  const [bookingsRes, blocksRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('booking_date, time_slot')
      .gte('booking_date', monthStart)
      .lt('booking_date', nextMonthStart)
      .in('status', ['PENDING', 'APPROVED']),
    supabase
      .from('blocked_slots')
      .select('blocked_date, slot')
      .gte('blocked_date', monthStart)
      .lt('blocked_date', nextMonthStart),
  ])

  const byDate: Record<string, { booked: TimeSlot[]; blockedSlots: (TimeSlot | null)[] }> = {}

  function getOrCreate(date: string) {
    if (!byDate[date]) byDate[date] = { booked: [], blockedSlots: [] }
    return byDate[date]
  }

  for (const b of bookingsRes.data ?? []) {
    if (b.booking_date && b.time_slot) {
      getOrCreate(b.booking_date).booked.push(b.time_slot as TimeSlot)
    }
  }

  for (const bl of blocksRes.data ?? []) {
    if (bl.blocked_date) {
      getOrCreate(bl.blocked_date).blockedSlots.push(bl.slot as TimeSlot | null)
    }
  }

  return NextResponse.json({ month, byDate })
}
