'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SLOT_LABELS, SLOT_KEYS } from '@/lib/types'
import type { TimeSlot } from '@/lib/types'

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000
const MAX_SLOTS = 3

const SLOT_START_HOUR: Record<TimeSlot, number> = {
  S10_12: 10,
  S13_15: 13,
  S15_17: 15,
  S17_19: 17,
  S19_21: 19,
}

function getSGTDateStr(): string {
  return new Date(Date.now() + SGT_OFFSET_MS).toISOString().slice(0, 10)
}

function getSGTHour(): number {
  return new Date(Date.now() + SGT_OFFSET_MS).getUTCHours()
}

interface DayAvail {
  booked: TimeSlot[]
  blockedSlots: (TimeSlot | null)[]
}

interface Props {
  selectedDate?: string
  selectedSlots?: TimeSlot[]
  onChange: (date: string, slots: TimeSlot[]) => void
}

function toYearMonth(d: Date): string {
  return d.toISOString().slice(0, 7)
}

export function SlotCalendar({ selectedDate, selectedSlots = [], onChange }: Props) {
  const todaySGT = getSGTDateStr()
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({})
  const [loading, setLoading] = useState(false)
  const [pickedDate, setPickedDate] = useState<string | null>(selectedDate ?? null)
  const [pickedSlots, setPickedSlots] = useState<TimeSlot[]>(selectedSlots)

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

  function getSlotState(date: string, slot: TimeSlot): 'available' | 'booked' | 'blocked' | 'past' {
    if (date === todaySGT && getSGTHour() >= SLOT_START_HOUR[slot]) return 'past'
    const avail = availability[date]
    if (!avail) return 'available'
    if (avail.blockedSlots.includes(null) || avail.blockedSlots.includes(slot)) return 'blocked'
    if (avail.booked.includes(slot)) return 'booked'
    return 'available'
  }

  function toggleSlot(slot: TimeSlot) {
    let next: TimeSlot[]
    if (pickedSlots.includes(slot)) {
      next = pickedSlots.filter(s => s !== slot)
    } else if (pickedSlots.length < MAX_SLOTS) {
      next = [...pickedSlots, slot]
    } else {
      return
    }
    setPickedSlots(next)
    if (pickedDate) onChange(pickedDate, next)
  }

  function handleDateClick(date: string) {
    setPickedDate(date)
    setPickedSlots([])
    onChange(date, [])
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
          const isPast = d.date < todaySGT
          const fullyBlocked = isDayFullyBlocked(d.date)
          const isSelected = pickedDate === d.date
          const disabled = isPast || fullyBlocked
          return (
            <button
              key={d.date}
              disabled={disabled}
              onClick={() => handleDateClick(d.date)}
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

      {pickedDate && pickedDate >= todaySGT && !isDayFullyBlocked(pickedDate) && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-medium text-primary">
            {new Date(pickedDate + 'T00:00:00').toLocaleDateString('en-SG', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Select up to {MAX_SLOTS} available time slots ({pickedSlots.length}/{MAX_SLOTS} selected)
          </p>
          {SLOT_KEYS.map(slot => {
            const state = getSlotState(pickedDate, slot)
            const isActive = pickedSlots.includes(slot)
            const isDisabled = state !== 'available' || (!isActive && pickedSlots.length >= MAX_SLOTS)
            return (
              <button
                key={slot}
                disabled={isDisabled}
                onClick={() => toggleSlot(slot)}
                className={`
                  w-full text-xs px-3 py-2 rounded-lg border font-medium transition-colors text-left
                  ${isActive ? 'bg-accent text-white border-accent' : ''}
                  ${state === 'available' && !isActive && pickedSlots.length < MAX_SLOTS
                    ? 'border-border text-primary hover:bg-muted/60'
                    : ''}
                  ${isDisabled && !isActive ? 'bg-slate-50 text-muted-foreground border-border cursor-not-allowed opacity-60' : ''}
                `}
              >
                {SLOT_LABELS[slot]}
                {state === 'booked' && <span className="ml-2 text-[10px]">Taken</span>}
                {state === 'blocked' && <span className="ml-2 text-[10px]">Unavailable</span>}
                {state === 'past' && <span className="ml-2 text-[10px]">Passed</span>}
                {state === 'available' && !isActive && pickedSlots.length >= MAX_SLOTS && (
                  <span className="ml-2 text-[10px] text-muted-foreground">(max reached)</span>
                )}
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
