import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SLOT_LABELS } from '@/lib/types'
import type { TimeSlot } from '@/lib/types'
import { formatDueMonth } from '@/lib/contracts/service-dates'

const statusColor: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-slate-100 text-slate-700',
  UNPAID: 'bg-red-100 text-red-800',
  PAID: 'bg-green-100 text-green-800',
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [profileRes, bookingsRes, contractsRes, invoicesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('bookings')
      .select('*, service_type:service_types(name, category)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('contracts')
      .select('*, contract_service_dates(due_month, booking_id)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('invoices')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!profileRes.data) notFound()
  const profile = profileRes.data
  const bookings = bookingsRes.data ?? []
  const contracts = contractsRes.data ?? []
  const invoices = invoicesRes.data ?? []

  // Auth email
  const adminClient = createAdminClient()
  const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(id)

  const totalPaid = invoices
    .filter(i => i.status === 'PAID')
    .reduce((sum, i) => sum + parseFloat(i.amount_sgd), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="text-muted-foreground hover:text-primary text-sm">← Customers</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="font-heading font-bold text-xl text-primary">{profile.name}</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-accent/10 text-accent font-bold text-2xl flex items-center justify-center shrink-0">
            {profile.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 space-y-1 text-sm">
            <p className="font-heading font-bold text-primary text-lg leading-tight">{profile.name}</p>
            <p className="text-muted-foreground">{authUser?.email ?? '—'}</p>
            <p className="text-muted-foreground">{profile.phone}</p>
            {profile.address && <p className="text-muted-foreground">{profile.address}</p>}
            <p className="text-xs text-muted-foreground">Member since {new Date(profile.created_at).toLocaleDateString('en-SG')} · #{profile.customer_no ?? '—'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground mb-0.5">Total paid</p>
            <p className="text-2xl font-bold text-accent">S${totalPaid.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Bookings */}
      <section className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-semibold text-primary mb-4">Bookings ({bookings.length})</h2>
        {!bookings.length ? (
          <p className="text-sm text-muted-foreground">No bookings.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left pb-2">Date</th>
                <th className="text-left pb-2">Service</th>
                <th className="text-left pb-2">Slot</th>
                <th className="text-left pb-2">Status</th>
                <th className="text-left pb-2">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map(b => (
                <tr key={b.id}>
                  <td className="py-2 pr-3">{b.confirmed_date ?? b.booking_date}</td>
                  <td className="py-2 pr-3">{b.service_type?.name}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {SLOT_LABELS[b.confirmed_slot as TimeSlot ?? b.time_slot as TimeSlot] ?? '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-muted-foreground truncate max-w-[200px]">{b.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Contracts */}
      <section className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-semibold text-primary mb-4">Contracts ({contracts.length})</h2>
        {!contracts.length ? (
          <p className="text-sm text-muted-foreground">No contracts.</p>
        ) : (
          <div className="space-y-3">
            {contracts.map(c => {
              const nextDue = (c.contract_service_dates ?? [])
                .filter((sd: { booking_id: string | null; due_month: string }) => !sd.booking_id)
                .sort((a: { due_month: string }, b: { due_month: string }) => a.due_month.localeCompare(b.due_month))[0]
              return (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium text-primary">{c.num_units} units · {c.start_date} → {c.end_date}</p>
                    <p className="text-muted-foreground text-xs">
                      {c.price_sgd ? `S$${parseFloat(c.price_sgd).toFixed(2)}/year` : 'Price TBD'}
                      {nextDue ? ` · Next due: ${formatDueMonth(nextDue.due_month)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor[c.status]}`}>{c.status}</span>
                    <Link href={`/admin/contracts/${c.id}`} className="text-accent hover:underline text-xs">View →</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Invoices */}
      <section className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-semibold text-primary mb-4">Invoices ({invoices.length})</h2>
        {!invoices.length ? (
          <p className="text-sm text-muted-foreground">No invoices.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left pb-2">Work Order</th>
                <th className="text-left pb-2">Description</th>
                <th className="text-right pb-2">Amount</th>
                <th className="text-left pb-2">Status</th>
                <th className="text-left pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td className="py-2 pr-3 text-muted-foreground">{inv.work_order_no ?? '—'}</td>
                  <td className="py-2 pr-3">{inv.description ?? '—'}</td>
                  <td className="py-2 pr-3 text-right font-medium">S${parseFloat(inv.amount_sgd).toFixed(2)}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor[inv.status]}`}>{inv.status}</span>
                  </td>
                  <td className="py-2 text-muted-foreground">{new Date(inv.created_at).toLocaleDateString('en-SG')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
