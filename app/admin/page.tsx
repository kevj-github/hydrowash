import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarCheck, ClipboardList, Clock, ArrowRight } from 'lucide-react'

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
    {
      label: 'Pending Bookings',
      value: pendingRes.count ?? 0,
      href: '/admin/bookings',
      color: 'text-amber-500',
      borderColor: 'border-l-amber-400',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      Icon: Clock,
    },
    {
      label: 'Approved Jobs Today',
      value: todayRes.count ?? 0,
      href: `/admin/schedule/${todayStr}`,
      color: 'text-accent',
      borderColor: 'border-l-accent',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
      Icon: CalendarCheck,
    },
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
            className={`bg-white rounded-xl border border-border border-l-4 ${s.borderColor} p-6 hover:shadow-md transition-all duration-200 cursor-pointer group flex items-center gap-4`}
          >
            <div className={`w-12 h-12 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
              <s.Icon size={22} className={s.iconColor} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-0.5">{s.label}</p>
              <p className={`font-heading font-bold text-3xl leading-none ${s.color}`}>{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/bookings"
          className="group bg-accent text-white rounded-xl p-6 hover:bg-accent/90 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} strokeWidth={1.75} />
              <h3 className="font-heading font-semibold text-lg">Manage Bookings</h3>
            </div>
            <ArrowRight size={16} strokeWidth={2} className="transition-transform duration-150 group-hover:translate-x-1" />
          </div>
          <p className="text-white/70 text-sm">Approve, reject, and cluster maintenance bookings</p>
        </Link>
        <Link
          href={`/admin/schedule/${todayStr}`}
          className="group bg-primary text-white rounded-xl p-6 hover:bg-primary/90 transition-all duration-200 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} strokeWidth={1.75} />
              <h3 className="font-heading font-semibold text-lg">Route Optimiser</h3>
            </div>
            <ArrowRight size={16} strokeWidth={2} className="transition-transform duration-150 group-hover:translate-x-1" />
          </div>
          <p className="text-slate-400 text-sm">Plan today&apos;s route and preview stop order</p>
        </Link>
      </div>

      {/* Alerts */}
      <div className="space-y-4">
        {serviceDueRows.length > 0 && (
          <section className="bg-white border border-border border-l-4 border-l-amber-400 rounded-xl p-5">
            <h2 className="font-heading font-semibold text-primary mb-3">
              Service Due This Month ({serviceDueRows.length})
            </h2>
            <ul className="divide-y divide-border">
              {serviceDueRows.map((row: any) => (
                <li key={row.id} className="flex items-center justify-between py-2 text-sm gap-3">
                  <span className="font-medium text-primary">{row.contract?.customer?.name ?? '—'}</span>
                  <span className="text-muted-foreground text-xs">{row.contract?.num_units} unit(s)</span>
                  {row.contract?.id ? (
                    <Link
                      href={`/admin/contracts/${row.contract.id}`}
                      className="ml-auto text-accent hover:underline text-xs font-medium flex items-center gap-0.5"
                    >
                      View <ArrowRight size={12} strokeWidth={2} />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {expiringContracts.length > 0 && (
          <section className="bg-white border border-border border-l-4 border-l-red-400 rounded-xl p-5">
            <h2 className="font-heading font-semibold text-primary mb-3">
              Contracts Expiring Soon ({expiringContracts.length})
            </h2>
            <ul className="divide-y divide-border">
              {expiringContracts.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm gap-3">
                  <span className="font-medium text-primary">{c.customer?.name ?? '—'}</span>
                  <span className="text-red-600 font-medium text-xs">Expires {c.end_date}</span>
                  <Link
                    href={`/admin/contracts/${c.id}`}
                    className="ml-auto text-accent hover:underline text-xs font-medium flex items-center gap-0.5"
                  >
                    View <ArrowRight size={12} strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
