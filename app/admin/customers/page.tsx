import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Search } from 'lucide-react'

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select('id, name, phone, customer_no, created_at')
    .eq('role', 'customer')
    .order('name', { ascending: true })

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data: customers } = await query

  // Fetch booking counts + paid invoice totals
  const ids = (customers ?? []).map(c => c.id)
  const [bookingCountsRes, invoiceTotalsRes, contractsRes] = await Promise.all([
    ids.length
      ? supabase.from('bookings').select('customer_id').in('customer_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('invoices').select('customer_id, amount_sgd').in('customer_id', ids).eq('status', 'PAID')
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('contracts').select('customer_id, status').in('customer_id', ids)
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

  const activeContracts = new Set(
    (contractsRes.data ?? []).filter(c => c.status === 'ACTIVE').map(c => c.customer_id)
  )

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-bold text-2xl text-primary">Customers</h1>
        <span className="text-sm text-muted-foreground">{customers?.length ?? 0} customers</span>
      </div>

      {/* Search */}
      <form method="GET" className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </form>

      {/* Table */}
      {!customers?.length ? (
        <p className="text-muted-foreground text-sm">No customers found.</p>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">No.</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-right px-4 py-3">Bookings</th>
                <th className="text-right px-4 py-3">Total Paid</th>
                <th className="text-center px-4 py-3">Contract</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{c.customer_no ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-primary">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                  <td className="px-4 py-3 text-right">{bookingCounts[c.id] ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    {invoiceTotals[c.id] ? `S$${invoiceTotals[c.id].toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {activeContracts.has(c.id) ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">Active</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="text-accent hover:underline text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
