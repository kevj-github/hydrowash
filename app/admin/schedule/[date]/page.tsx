import { createClient } from '@/lib/supabase/server'
import { SchedulePageClient } from './SchedulePageClient'

export default async function SchedulePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const supabase = await createClient()

  const [settingsRes, bookingsRes] = await Promise.all([
    supabase.from('app_settings').select('depot_lat,depot_lng').single(),
    supabase
      .from('bookings')
      .select('id, address, lat, lng, notes, time_slot, service_type:service_types(name, duration_minutes), customer:profiles(name, phone)')
      .eq('status', 'APPROVED')
      .eq('booking_date', date),
  ])

  return (
    <SchedulePageClient
      date={date}
      bookings={(bookingsRes.data ?? []) as any}
      depotLatLng={settingsRes.data ? { lat: settingsRes.data.depot_lat, lng: settingsRes.data.depot_lng } : null}
    />
  )
}
