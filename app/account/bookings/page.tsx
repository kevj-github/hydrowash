import { createClient, getAuthUser } from '@/lib/supabase/server'
import Link from 'next/link'
import { SLOT_LABELS } from '@/lib/types'
import type { BookingWithRelations, TimeSlot } from '@/lib/types'
import { RescheduleDialog } from '@/components/account/RescheduleDialog'
import { CancelDialog } from '@/components/account/CancelDialog'
import { CalendarDays, Clock, CalendarOff } from 'lucide-react'

const statusColor: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-slate-100 text-slate-700',
}

function canModify(booking: BookingWithRelations): boolean {
  if (!['PENDING', 'APPROVED'].includes(booking.status)) return false
  const effectiveDate = booking.confirmed_date ?? booking.preferred_date_slots?.[0]?.date ?? booking.booking_date
  const cutoff = new Date(`${effectiveDate}T00:00:00+08:00`)
  cutoff.setTime(cutoff.getTime() - 24 * 60 * 60 * 1000)
  return new Date() < cutoff
}

export default async function AccountBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams
  const supabase = await createClient()
  const user = await getAuthUser()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd), contract_service_dates(id,due_month,contract_id)')
    .eq('customer_id', user!.id)
    .order('created_at', { ascending: false })

  // Compute contract visit numbers server-side
  const visitMap: Record<string, { visitNo: number; totalVisits: number }> = {}
  const linkedContractIds = [...new Set(
    (bookings ?? [])
      .flatMap(b => (b.contract_service_dates ?? []).map((c: { contract_id: string }) => c.contract_id))
      .filter(Boolean)
  )]
  if (linkedContractIds.length > 0) {
    const { data: allCsds } = await supabase
      .from('contract_service_dates')
      .select('id, contract_id, due_month')
      .in('contract_id', linkedContractIds)
      .order('due_month', { ascending: true })
    const byContract = (allCsds ?? []).reduce<Record<string, { id: string }[]>>((acc, c) => {
      acc[c.contract_id] = acc[c.contract_id] ?? []
      acc[c.contract_id].push(c)
      return acc
    }, {})
    for (const b of bookings ?? []) {
      const csd = (b.contract_service_dates ?? [])[0] as { id: string; contract_id: string } | undefined
      if (!csd) continue
      const list = byContract[csd.contract_id] ?? []
      const idx = list.findIndex((c: { id: string }) => c.id === csd.id)
      if (idx >= 0) visitMap[b.id] = { visitNo: idx + 1, totalVisits: list.length }
    }
  }

  const totalBookings = bookings?.length ?? 0
  const upcomingBookings = bookings?.filter(b =>
    ['PENDING', 'APPROVED'].includes(b.status)
  ).length ?? 0

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Summary strip */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <CalendarDays size={18} className="text-accent" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-heading font-bold text-lg text-primary leading-none">{totalBookings}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <Clock size={18} className="text-amber-500" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Upcoming</p>
            <p className="font-heading font-bold text-lg text-primary leading-none">{upcomingBookings}</p>
          </div>
        </div>
      </div>
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
        <div className="text-center py-20">
          <CalendarOff size={48} className="text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="font-heading font-semibold text-primary text-lg mb-1">No bookings yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Schedule your first aircon service today.</p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer"
          >
            Book a Service
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
                <div className="flex flex-wrap gap-1 justify-end">
                  {booking.contract_id && (() => {
                    const vi = visitMap[booking.id]
                    return (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap bg-indigo-100 text-indigo-800">
                        Contract{vi ? ` · Visit ${vi.visitNo}/${vi.totalVisits}` : ''}
                      </span>
                    )
                  })()}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColor[booking.status]}`}>
                    {booking.status}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {booking.confirmed_date ? (
                  <p className="text-green-700 font-medium">
                    Confirmed: {booking.confirmed_date}
                    {booking.confirmed_slot ? ` · ${SLOT_LABELS[booking.confirmed_slot as TimeSlot] ?? booking.confirmed_slot}` : ''}
                  </p>
                ) : (
                  <div>
                    <p className="font-medium text-slate-600 mb-0.5">Preferred dates:</p>
                    {(booking.preferred_date_slots ?? []).map(ds => (
                      <p key={ds.date}>
                        {new Date(ds.date + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {ds.slots.length > 0 && ` · ${ds.slots.map(s => SLOT_LABELS[s as TimeSlot] ?? s).join(', ')}`}
                      </p>
                    ))}
                  </div>
                )}
                {booking.rejection_reason && (
                  <p className="text-red-600">Reason: {booking.rejection_reason}</p>
                )}
              </div>
              {canModify(booking) && (
                <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row gap-2">
                  <RescheduleDialog bookingId={booking.id} />
                  <CancelDialog bookingId={booking.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
