import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SLOT_KEYS, TimeSlot } from '@/lib/types'
import { isDayFullyBlocked, isSlotBlocked } from '@/lib/booking/slots'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const wantedSlot = searchParams.get('slot') as TimeSlot | null
  const days = Math.min(parseInt(searchParams.get('days') ?? '14'), 30)

  if (!from || !wantedSlot || !SLOT_KEYS.includes(wantedSlot)) {
    return NextResponse.json({ error: 'from and slot are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Build candidate dates
  const fromDate = new Date(from)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const candidateDates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate)
    d.setDate(d.getDate() + i)
    if (d > today) {
      candidateDates.push(d.toISOString().split('T')[0])
    }
  }

  if (candidateDates.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  const firstDate = candidateDates[0]
  const lastDate = candidateDates[candidateDates.length - 1]

  // Fetch blocked slots for the date range
  const { data: blockedSlots } = await supabase
    .from('blocked_slots')
    .select('blocked_date, slot')
    .gte('blocked_date', firstDate)
    .lte('blocked_date', lastDate)

  // Fetch already-booked (date, slot) pairs
  const { data: bookedSlots } = await supabase
    .from('bookings')
    .select('booking_date, time_slot')
    .gte('booking_date', firstDate)
    .lte('booking_date', lastDate)
    .in('status', ['PENDING', 'APPROVED'])

  const blockedArr = blockedSlots ?? []
  const bookedSet = new Set(
    (bookedSlots ?? []).map((b) => `${b.booking_date}|${b.time_slot}`)
  )

  // Sort slots: preferred slot first, then others in order
  const orderedSlots: TimeSlot[] = [
    wantedSlot,
    ...SLOT_KEYS.filter((s) => s !== wantedSlot),
  ]

  const suggestions: { date: string; slot: TimeSlot }[] = []

  for (const date of candidateDates) {
    if (isDayFullyBlocked(date, blockedArr)) continue
    for (const slot of orderedSlots) {
      if (isSlotBlocked(date, slot, blockedArr)) continue
      if (bookedSet.has(`${date}|${slot}`)) continue
      suggestions.push({ date, slot })
      if (suggestions.length >= 5) break
    }
    if (suggestions.length >= 5) break
  }

  return NextResponse.json({ suggestions })
}
