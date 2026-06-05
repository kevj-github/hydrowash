'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SLOT_KEYS, SLOT_LABELS } from '@/lib/types'
import type { TimeSlot } from '@/lib/types'

type BookingRow = {
  id: string
  confirmed_date: string
  confirmed_slot: string
  status: string
  customer: { name: string } | null
  service_type: { name: string } | null
}

interface Props {
  days: string[]
  grid: Record<string, Record<string, BookingRow[]>>
  todayStr: string
  weekStartStr: string
  status: string
  prevWeek: string
  nextWeek: string
}

export function AdminAgendaClient({ days, grid, todayStr, weekStartStr, status, prevWeek, nextWeek }: Props) {
  const [selectedDay, setSelectedDay] = useState<string>(
    days.includes(todayStr) ? todayStr : (days[0] ?? todayStr)
  )

  function prevDay() {
    setSelectedDay(d => {
      const nd = new Date(d + 'T00:00:00Z')
      nd.setUTCDate(nd.getUTCDate() - 1)
      return nd.toISOString().slice(0, 10)
    })
  }
  function nextDay() {
    setSelectedDay(d => {
      const nd = new Date(d + 'T00:00:00Z')
      nd.setUTCDate(nd.getUTCDate() + 1)
      return nd.toISOString().slice(0, 10)
    })
  }

  return (
    <>
      {/* ── Mobile day-list (< md) ── */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevDay} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted">
            <ChevronLeft className="w-5 h-5 text-primary" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-primary text-sm">
              {new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            {selectedDay === todayStr && (
              <span className="text-xs text-accent font-medium">Today</span>
            )}
          </div>
          <button onClick={nextDay} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted">
            <ChevronRight className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="space-y-2">
          {SLOT_KEYS.map(slot => {
            const cellBookings = grid[slot]?.[selectedDay] ?? []
            return (
              <div key={slot} className="border border-border rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{SLOT_LABELS[slot as TimeSlot]}</p>
                {cellBookings.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">No bookings</p>
                ) : (
                  <div className="space-y-1">
                    {cellBookings.map(b => (
                      <Link
                        key={b.id}
                        href="/admin/bookings"
                        className="block text-xs bg-accent/10 text-accent rounded-md px-2 py-1 font-medium truncate"
                        title={`${b.customer?.name} · ${b.service_type?.name}`}
                      >
                        {b.customer?.name ?? 'Customer'}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Desktop week grid (≥ md) ── */}
      <div className="hidden md:block bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-3 w-28 text-muted-foreground text-xs font-medium">Slot</th>
              {days.map(dateStr => {
                const isToday = dateStr === todayStr
                const d = new Date(dateStr + 'T00:00:00Z')
                return (
                  <th key={dateStr} className={`px-3 py-3 text-center text-xs font-medium ${isToday ? 'bg-accent/10 text-accent rounded-t-md font-semibold' : 'text-muted-foreground'}`}>
                    <span className="block">{d.toLocaleDateString('en-SG', { weekday: 'short', timeZone: 'UTC' })}</span>
                    <span className={`text-sm font-bold ${isToday ? 'text-accent' : 'text-primary'}`}>
                      {d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {SLOT_KEYS.map(slot => (
              <tr key={slot} className="border-b border-border last:border-0">
                <td className="pr-2 py-3 text-xs text-muted-foreground text-right whitespace-nowrap align-top pl-3">
                  {SLOT_LABELS[slot as TimeSlot]}
                </td>
                {days.map(dateStr => {
                  const cellBookings = grid[slot]?.[dateStr] ?? []
                  const isToday = dateStr === todayStr
                  return (
                    <td key={dateStr} className={`px-2 py-2 align-top border-l border-border ${isToday ? 'bg-accent/5' : ''}`}>
                      {cellBookings.length === 0 ? (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      ) : (
                        <div className="space-y-1">
                          {cellBookings.map(b => (
                            <Link
                              key={b.id}
                              href="/admin/bookings"
                              className="block text-xs bg-accent/10 text-accent rounded-md px-2 py-0.5 font-medium hover:bg-accent/20 transition-colors truncate"
                              title={`${b.customer?.name} · ${b.service_type?.name}`}
                            >
                              {b.customer?.name ?? 'Customer'}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
