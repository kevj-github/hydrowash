import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { SLOT_LABELS } from '@/lib/types'
import type { BookingWithRelations, TimeSlot } from '@/lib/types'

const statusColor: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
}

export default async function AccountBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .eq('customer_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary">My Bookings</h1>
          <p className="text-muted-foreground text-sm mt-1">Track all your service bookings.</p>
        </div>
        <Link
          href="/book"
          className="bg-accent hover:bg-accent/90 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer"
        >
          New Booking
        </Link>
      </div>

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800 text-sm">
          Booking submitted! We will review and confirm your date shortly.
        </div>
      )}

      {!bookings?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-2">No bookings yet</p>
          <Link href="/book" className="text-accent hover:underline text-sm cursor-pointer">
            Book your first service
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {(bookings as BookingWithRelations[]).map(booking => (
            <div
              key={booking.id}
              className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-heading font-semibold text-primary">
                    {booking.service_type.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{booking.address}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColor[booking.status]}`}>
                  {booking.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Date: {booking.booking_date} · {SLOT_LABELS[booking.time_slot as TimeSlot] ?? booking.time_slot}</span>
                {booking.confirmed_date && (
                  <span className="text-green-700 font-medium">Confirmed: {booking.confirmed_date}</span>
                )}
                {booking.rejection_reason && (
                  <span className="text-red-600">Reason: {booking.rejection_reason}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
