import { createClient } from '@/lib/supabase/server'
import { AdminBookingsClient } from './AdminBookingsClient'

export default async function AdminBookingsPage() {
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .order('created_at', { ascending: false })

  return <AdminBookingsClient initialBookings={bookings ?? []} />
}
