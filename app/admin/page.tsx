import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarCheck, ClipboardList } from 'lucide-react'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0]
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const in30DaysStr = in30Days.toISOString().split('T')[0]

  const [pendingRes, todayRes, serviceDueRes, expiringRes] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact' }).eq('status', 'PENDING'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('status', 'APPROVED')
      .eq('confirmed_date', todayStr),
    supabase
      .from('contract_service_dates')
      .select(`
        id,
        due_date,
        contract:contracts!contract_service_dates_contract_id_fkey (
          id,
          num_units,
          customer:profiles!contracts_customer_id_fkey (
            id, name, phone
          )
        )
      `)
      .gte('due_date', firstOfMonth)
      .lte('due_date', lastOfMonth)
      .is('booking_id', null)
      .order('due_date'),
    supabase
      .from('contracts')
      .select(`
        id,
        end_date,
        num_units,
        customer:profiles!contracts_customer_id_fkey (
          id, name, phone
        )
      `)
      .eq('status', 'ACTIVE')
      .lte('end_date', in30DaysStr)
      .gte('end_date', todayStr)
      .order('end_date'),
  ])

  const stats = [
    { label: 'Pending Bookings', value: pendingRes.count ?? 0, href: '/admin/bookings', color: 'text-amber-500' },
    { label: 'Approved Jobs Today', value: todayRes.count ?? 0, href: `/admin/schedule/${todayStr}`, color: 'text-accent' },
  ]

  const serviceDueRows = serviceDueRes.data ?? []
  const expiringContracts = expiringRes.data ?? []

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-primary">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {today.toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {stats.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white rounded-xl border border-border p-6 hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
            <p className={`font-heading font-bold text-3xl ${s.color}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/bookings"
          className="group bg-accent text-white rounded-xl p-6 hover:bg-accent/90 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={18} strokeWidth={1.75} />
            <h3 className="font-heading font-semibold text-lg">Manage Bookings</h3>
          </div>
          <p className="text-white/70 text-sm">Approve, reject, and cluster maintenance bookings</p>
        </Link>
        <Link
          href={`/admin/schedule/${todayStr}`}
          className="group bg-primary text-white rounded-xl p-6 hover:bg-primary/90 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck size={18} strokeWidth={1.75} />
            <h3 className="font-heading font-semibold text-lg">Route Optimiser</h3>
          </div>
          <p className="text-slate-400 text-sm">Plan today&apos;s route and preview stop order</p>
        </Link>
      </div>

      {/* Alerts */}
      <div className="space-y-4">
        {serviceDueRows.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h2 className="font-heading font-semibold text-amber-900 mb-3">
              Service Due This Month ({serviceDueRows.length})
            </h2>
            <ul className="space-y-2">
              {serviceDueRows.map((row: any) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-amber-900">{row.contract?.customer?.name ?? '—'}</span>
                  <span className="text-amber-700">{row.due_date}</span>
                  <span className="text-amber-600 text-xs">{row.contract?.num_units} unit(s)</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {expiringContracts.length > 0 && (
          <section className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h2 className="font-heading font-semibold text-red-900 mb-3">
              Contracts Expiring Soon ({expiringContracts.length})
            </h2>
            <ul className="space-y-2">
              {expiringContracts.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-red-900">{c.customer?.name ?? '—'}</span>
                  <span className="text-red-700 font-medium">Expires {c.end_date}</span>
                  <span className="text-red-600 text-xs">{c.num_units} unit(s)</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
