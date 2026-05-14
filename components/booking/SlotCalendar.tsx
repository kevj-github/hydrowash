'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SLOT_LABELS, SLOT_KEYS } from '@/lib/types'
import type { TimeSlot } from '@/lib/types'

interface DayAvail {
  booked: TimeSlot[]
  blockedSlots: (TimeSlot | null)[]
}

interface Props {
  selectedDate?: string
  selectedSlot?: TimeSlot
  onChange: (date: string, slot: TimeSlot) => void
}

function toYearMonth(d: Date): string {
  return d.toISOString().slice(0, 7)
}

export function SlotCalendar({ selectedDate, selectedSlot, onChange }: Props) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({})
  const [loading, setLoading] = useState(false)
  const [pickedDate, setPickedDate] = useState<string | null>(selectedDate ?? null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/availability?month=${month}`)
      .then(r => r.json())
      .then(d => setAvailability(d.byDate ?? {}))
      .finally(() => setLoading(false))
  }, [month])

  const [year, mon] = month.split('-').map(Number)
  const firstDay = new Date(year, mon - 1, 1)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const startDow = firstDay.getDay()

  function isDayFullyBlocked(date: string): boolean {
    return availability[date]?.blockedSlots.includes(null) ?? false
  }

  function getSlotState(date: string, slot: TimeSlot): 'available' | 'booked' | 'blocked' {
    const avail = availability[date]
    if (!avail) return 'available'
    if (avail.blockedSlots.includes(null) || avail.blockedSlots.includes(slot)) return 'blocked'
    if (avail.booked.includes(slot)) return 'booked'
    return 'available'
  }

  const days: Array<{ date: string; inMonth: boolean }> = []
  for (let i = 0; i < startDow; i++) days.push({ date: '', inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date, inMonth: true })
  }

  const monthName = firstDay.toLocaleString('en-SG', { month: 'long', year: 'numeric' })

  function prevMonth() {
    const d = new Date(year, mon - 2, 1)
    setMonth(toYearMonth(d))
  }
  function nextMonth() {
    const d = new Date(year, mon, 1)
    setMonth(toYearMonth(d))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-muted text-primary">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-primary">{monthName}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-muted text-primary">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d.inMonth) return <div key={i} />
          const isPast = d.date < todayStr
          const fullyBlocked = isDayFullyBlocked(d.date)
          const isSelected = pickedDate === d.date
          const disabled = isPast || fullyBlocked
          return (
            <button
              key={d.date}
              disabled={disabled}
              onClick={() => setPickedDate(d.date)}
              className={`
                rounded-lg text-xs py-1.5 font-medium transition-colors
                ${disabled ? 'text-muted-foreground opacity-40 cursor-not-allowed' : ''}
                ${isSelected && !disabled ? 'bg-accent text-white' : ''}
                ${!isSelected && !disabled ? 'hover:bg-muted text-primary' : ''}
              `}
            >
              {d.date.slice(8)}
            </button>
          )
        })}
      </div>

      {pickedDate && pickedDate >= todayStr && !isDayFullyBlocked(pickedDate) && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-medium text-primary">
            {new Date(pickedDate + 'T00:00:00').toLocaleDateString('en-SG', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          {SLOT_KEYS.map(slot => {
            const state = getSlotState(pickedDate, slot)
            const isActive = selectedDate === pickedDate && selectedSlot === slot
            return (
              <button
                key={slot}
                disabled={state !== 'available'}
                onClick={() => onChange(pickedDate, slot)}
                className={`
                  w-full text-xs px-3 py-2 rounded-lg border font-medium transition-colors text-left
                  ${isActive ? 'bg-accent text-white border-accent' : ''}
                  ${state === 'available' && !isActive ? 'border-border text-primary hover:bg-muted/60' : ''}
                  ${state !== 'available' ? 'bg-slate-50 text-muted-foreground border-border cursor-not-allowed opacity-60' : ''}
                `}
              >
                {SLOT_LABELS[slot]}
                {state === 'booked' && <span className="ml-2 text-[10px]">Booked</span>}
                {state === 'blocked' && <span className="ml-2 text-[10px]">Unavailable</span>}
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground text-center">Loading availability…</p>
      )}
    </div>
  )
}
