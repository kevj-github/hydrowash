'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { SLOT_LABELS, SLOT_KEYS } from '@/lib/types'
import type { TimeSlot, PreferredDateSlot } from '@/lib/types'

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000
const MAX_TOTAL_SLOTS = 3
const MAX_DATES = 5

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
  value: PreferredDateSlot[]
  onChange: (entries: PreferredDateSlot[]) => void
}

function toYearMonth(d: Date): string {
  return d.toISOString().slice(0, 7)
}

export function SlotCalendar({ value, onChange }: Props) {
  const todaySGT = getSGTDateStr()
  const [month, setMonth] = useState(() => toYearMonth(new Date()))
  const [availability, setAvailability] = useState<Record<string, DayAvail>>({})
  const [loading, setLoading] = useState(false)
  const [activeDate, setActiveDate] = useState<string | null>(
    value.length > 0 ? value[value.length - 1].date : null
  )

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

  function handleDateClick(date: string) {
    const exists = value.find(e => e.date === date)
    if (exists) {
      setActiveDate(date)
    } else if (value.length < MAX_DATES) {
      const next = [...value, { date, slots: [] }]
      onChange(next)
      setActiveDate(date)
    }
  }

  function removeDate(date: string) {
    const next = value.filter(e => e.date !== date)
    onChange(next)
    if (activeDate === date) {
      setActiveDate(next.length > 0 ? next[next.length - 1].date : null)
    }
  }

  const totalSlots = value.reduce((sum, e) => sum + e.slots.length, 0)

  function toggleSlot(slot: TimeSlot) {
    if (!activeDate) return
    const next = value.map(e => {
      if (e.date !== activeDate) return e
      const hasSlot = e.slots.includes(slot)
      if (hasSlot) {
        return { ...e, slots: e.slots.filter(s => s !== slot) }
      }
      if (totalSlots < MAX_TOTAL_SLOTS) {
        return { ...e, slots: [...e.slots, slot] }
      }
      return e
    })
    onChange(next)
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

  const activeDateEntry = activeDate ? value.find(e => e.date === activeDate) : null
  const activeSlots = activeDateEntry?.slots ?? []
  const slotsRemaining = MAX_TOTAL_SLOTS - totalSlots

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted text-primary">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-primary">{monthName}</span>
        <button onClick={nextMonth} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted text-primary">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {totalSlots >= MAX_TOTAL_SLOTS && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Maximum {MAX_TOTAL_SLOTS} time slots selected. You can still add more dates but no further slots.
        </p>
      )}
      {value.length >= MAX_DATES && totalSlots < MAX_TOTAL_SLOTS && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Maximum {MAX_DATES} date preferences reached.
        </p>
      )}

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d.inMonth) return <div key={i} />
          const isPast = d.date < todaySGT
          const fullyBlocked = isDayFullyBlocked(d.date)
          const isSelected = value.some(e => e.date === d.date)
          const isActive = d.date === activeDate
          const atMax = value.length >= MAX_DATES && !isSelected
          const disabled = isPast || fullyBlocked || atMax
          return (
            <button
              key={d.date}
              disabled={disabled}
              onClick={() => handleDateClick(d.date)}
              className={`
                rounded-lg text-xs py-2.5 font-medium transition-colors
                ${disabled ? 'text-muted-foreground opacity-40 cursor-not-allowed' : ''}
                ${isActive && !disabled ? 'bg-accent text-white ring-2 ring-accent ring-offset-1' : ''}
                ${isSelected && !isActive && !disabled ? 'bg-accent/20 text-accent border border-accent/40' : ''}
                ${!isSelected && !disabled ? 'hover:bg-muted text-primary' : ''}
              `}
            >
              {d.date.slice(8)}
            </button>
          )
        })}
      </div>

      {value.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-primary">Your preferred dates ({value.length}/{MAX_DATES}):</p>
          {value.map(entry => (
            <div
              key={entry.date}
              onClick={() => setActiveDate(entry.date)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors text-xs
                ${activeDate === entry.date ? 'border-accent bg-accent/5' : 'border-border hover:bg-muted/40'}`}
            >
              <div>
                <span className="font-medium text-primary">
                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-SG', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </span>
                {entry.slots.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    {entry.slots.map(s => SLOT_LABELS[s]).join(', ')}
                  </span>
                )}
                {entry.slots.length === 0 && (
                  <span className="ml-2 text-amber-600">No slots selected yet</span>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeDate(entry.date) }}
                className="ml-2 p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-red-500 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeDate && activeDate >= todaySGT && !isDayFullyBlocked(activeDate) && (
        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-medium text-primary">
            {new Date(activeDate + 'T00:00:00').toLocaleDateString('en-SG', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            Select up to {MAX_TOTAL_SLOTS} slots total ({totalSlots}/{MAX_TOTAL_SLOTS} selected)
          </p>
          {SLOT_KEYS.map(slot => {
            const state = getSlotState(activeDate, slot)
            const isActive = activeSlots.includes(slot)
            const isDisabled = state !== 'available' || (!isActive && slotsRemaining === 0)
            return (
              <button
                key={slot}
                disabled={isDisabled}
                onClick={() => toggleSlot(slot)}
                className={`
                  w-full text-xs px-3 py-2 rounded-lg border font-medium transition-colors text-left
                  ${isActive ? 'bg-accent text-white border-accent' : ''}
                  ${state === 'available' && !isActive && slotsRemaining > 0
                    ? 'border-border text-primary hover:bg-muted/60' : ''}
                  ${isDisabled && !isActive ? 'bg-slate-50 text-muted-foreground border-border cursor-not-allowed opacity-60' : ''}
                `}
              >
                {SLOT_LABELS[slot]}
                {state === 'booked' && <span className="ml-2 text-[10px]">Taken</span>}
                {state === 'blocked' && <span className="ml-2 text-[10px]">Unavailable</span>}
                {state === 'past' && <span className="ml-2 text-[10px]">Passed</span>}
                {state === 'available' && !isActive && slotsRemaining === 0 && (
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
