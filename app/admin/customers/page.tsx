import { createClient } from '@/lib/supabase/server'
import { AdminCustomersClient } from './AdminCustomersClient'

export default async function AdminCustomersPage() {
  const supabase = await createClient()

  // Search and location filtering both happen client-side now (real-time,
  // no Enter/submit needed) — fetch the full customer list once.
  const { data: customers } = await supabase
    .from('profiles')
    .select('id, name, phone, customer_no, created_at, address, postal_code')
    .eq('role', 'customer')
    .order('name', { ascending: true })

  const ids = (customers ?? []).map(c => c.id)
  const [bookingCountsRes, invoiceTotalsRes, contractsRes, completedBookingsRes] = await Promise.all([
    ids.length
      ? supabase.from('bookings').select('customer_id').in('customer_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('invoices').select('customer_id, amount_sgd').in('customer_id', ids).eq('status', 'PAID')
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('contracts').select('customer_id, status').in('customer_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('bookings').select('customer_id, confirmed_date, booking_date').in('customer_id', ids).eq('status', 'COMPLETED')
      : Promise.resolve({ data: [] }),
  ])

  const bookingCounts = (bookingCountsRes.data ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.customer_id] = (acc[b.customer_id] ?? 0) + 1
    return acc
  }, {})

  const invoiceTotals = (invoiceTotalsRes.data ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.customer_id] = (acc[i.customer_id] ?? 0) + parseFloat(i.amount_sgd)
    return acc
  }, {})

  const activeContractIds = (contractsRes.data ?? [])
    .filter(c => c.status === 'ACTIVE')
    .map(c => c.customer_id)

  // Most recent COMPLETED booking date per customer — prefer confirmed_date
  // (the date the job actually happened) over booking_date, same fallback
  // used throughout the app (e.g. cancellation/reschedule cutoff checks).
  const lastCompletedService = (completedBookingsRes.data ?? []).reduce<Record<string, string>>((acc, b) => {
    const effectiveDate = b.confirmed_date ?? b.booking_date
    if (!effectiveDate) return acc
    if (!acc[b.customer_id] || effectiveDate > acc[b.customer_id]) acc[b.customer_id] = effectiveDate
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-bold text-2xl text-primary">Customers</h1>
        <span className="text-sm text-muted-foreground">{customers?.length ?? 0} customers</span>
      </div>

      <AdminCustomersClient
        customers={customers ?? []}
        bookingCounts={bookingCounts}
        invoiceTotals={invoiceTotals}
        activeContractIds={activeContractIds}
        lastCompletedService={lastCompletedService}
      />
    </div>
  )
}
