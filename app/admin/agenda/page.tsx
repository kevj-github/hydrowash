import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SLOT_KEYS } from '@/lib/types'
import { AdminAgendaClient } from '@/components/admin/AdminAgendaClient'

function getMondayOf(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; status?: string }>
}) {
  const { week, status = 'approved' } = await searchParams
  const supabase = await createClient()

  const todayStr = new Date().toISOString().split('T')[0]
  const weekStart = getMondayOf(week ?? todayStr)
  const weekEnd = addDays(weekStart, 6)
  const weekStartStr = formatDate(weekStart)
  const weekEndStr = formatDate(weekEnd)

  const prevWeek = formatDate(addDays(weekStart, -7))
  const nextWeek = formatDate(addDays(weekStart, 7))

  let query = supabase
    .from('bookings')
    .select('id, confirmed_date, confirmed_slot, status, customer:profiles!bookings_customer_id_fkey(name), service_type:service_types(name)')
    .gte('confirmed_date', weekStartStr)
    .lte('confirmed_date', weekEndStr)
    .not('confirmed_date', 'is', null)
    .not('confirmed_slot', 'is', null)

  if (status === 'approved') {
    query = query.eq('status', 'APPROVED')
  } else {
    query = query.in('status', ['PENDING', 'APPROVED', 'COMPLETED'])
  }

  const { data: bookings } = await query

  // Build grid: slot → date → bookings[]
  type BookingRow = { id: string; confirmed_date: string; confirmed_slot: string; status: string; customer: { name: string } | null; service_type: { name: string } | null }
  const grid: Record<string, Record<string, BookingRow[]>> = {}
  for (const slot of SLOT_KEYS) {
    grid[slot] = {}
    for (let i = 0; i < 7; i++) {
      const d = formatDate(addDays(weekStart, i))
      grid[slot][d] = []
    }
  }
  for (const b of (bookings ?? []) as unknown as BookingRow[]) {
    if (b.confirmed_slot && b.confirmed_date && grid[b.confirmed_slot]?.[b.confirmed_date]) {
      grid[b.confirmed_slot][b.confirmed_date].push(b)
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dayStrings = days.map(d => formatDate(d))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-bold text-2xl text-primary">Agenda</h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Status toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden text-sm">
            <Link
              href={`/admin/agenda?week=${weekStartStr}&status=approved`}
              className={`px-3 py-1.5 ${status === 'approved' ? 'bg-accent text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Approved
            </Link>
            <Link
              href={`/admin/agenda?week=${weekStartStr}&status=all`}
              className={`px-3 py-1.5 ${status === 'all' ? 'bg-accent text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              All active
            </Link>
          </div>
          {/* Week nav */}
          <div className="flex items-center gap-1">
            <Link href={`/admin/agenda?week=${prevWeek}&status=${status}`} className="p-1.5 rounded hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="text-sm font-medium px-2 hidden sm:inline">
              {weekStart.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} –{' '}
              {weekEnd.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <Link href={`/admin/agenda?week=${nextWeek}&status=${status}`} className="p-1.5 rounded hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <Link href={`/admin/agenda?week=${getMondayOf(todayStr).toISOString().split('T')[0]}&status=${status}`} className="text-xs text-accent hover:underline">
            Today
          </Link>
        </div>
      </div>

      <AdminAgendaClient
        days={dayStrings}
        grid={grid}
        todayStr={todayStr}
        weekStartStr={weekStartStr}
        status={status}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
      />

      {!bookings?.length && (
        <p className="text-center text-muted-foreground text-sm mt-8">No bookings this week.</p>
      )}
    </div>
  )
}
