import { createClient } from '@/lib/supabase/server'
import { SchedulePageClient } from './SchedulePageClient'

export default async function SchedulePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const supabase = await createClient()

  const [settingsRes, bookingsRes] = await Promise.all([
    supabase.from('app_settings').select('depot_lat,depot_lng').single(),
    supabase
      .from('bookings')
      .select('id, address, lat, lng, notes, time_slot, confirmed_slot, service_type:service_types(name, duration_minutes), customer:profiles(name, phone)')
      .eq('status', 'APPROVED')
      // A booking belongs to the day the admin CONFIRMED it for. booking_date is
      // only the customer's first preference, so filtering on it hid every job the
      // admin had moved — they showed on the day requested, not the day happening.
      .or(`confirmed_date.eq.${date},and(confirmed_date.is.null,booking_date.eq.${date})`),
  ])

  // The confirmed slot is what the day actually runs on.
  const bookings = (bookingsRes.data ?? []).map(b => ({
    ...b,
    time_slot: b.confirmed_slot ?? b.time_slot,
  }))

  return (
    <SchedulePageClient
      date={date}
      bookings={bookings as any}
      depotLatLng={settingsRes.data ? { lat: settingsRes.data.depot_lat, lng: settingsRes.data.depot_lng } : null}
    />
  )
}
