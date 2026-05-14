'use client'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SLOT_KEYS, SLOT_LABELS } from '@/lib/types'
import type { TimeSlot } from '@/lib/types'

interface DayData {
  booked: TimeSlot[]
  blockedSlots: (TimeSlot | null)[]
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function AdminAvailabilityPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [byDate, setByDate] = useState<Record<string, DayData>>({})
  const [fetching, setFetching] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [blockEntireDay, setBlockEntireDay] = useState(false)
  const [checkedSlots, setCheckedSlots] = useState<Set<TimeSlot>>(new Set())
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })

  const fetchMonth = useCallback(async (y: number, m: number) => {
    setFetching(true)
    try {
      const res = await fetch(`/api/availability?month=${y}-${String(m).padStart(2, '0')}`)
      if (res.ok) {
        const json = await res.json()
        setByDate(json.byDate ?? {})
      }
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => { fetchMonth(year, month) }, [year, month, fetchMonth])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  function openDay(date: string) {
    const data = byDate[date]
    const blockedList = data?.blockedSlots ?? []
    const isFullDay = blockedList.includes(null)
    setSelectedDate(date)
    setBlockEntireDay(isFullDay)
    setCheckedSlots(new Set(blockedList.filter((s): s is TimeSlot => s !== null)))
    setReason('')
    setSaveError('')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!selectedDate) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/availability/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          blockEntireDay,
          slots: Array.from(checkedSlots),
          reason: reason.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setSaveError(body.error ?? 'Failed to save')
        return
      }
      setDialogOpen(false)
      fetchMonth(year, month)
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!selectedDate) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`/api/availability/block?date=${selectedDate}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        setSaveError(body.error ?? 'Failed to clear')
        return
      }
      setDialogOpen(false)
      fetchMonth(year, month)
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  function toggleSlot(slot: TimeSlot) {
    setCheckedSlots(prev => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  // Build calendar grid
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function getDayStatus(date: string): 'full' | 'partial' | 'available' {
    const data = byDate[date]
    if (!data) return 'available'
    if (data.blockedSlots.includes(null)) return 'full'
    if (data.blockedSlots.length > 0) return 'partial'
    return 'available'
  }

  const todayStr = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const selectedData = selectedDate ? byDate[selectedDate] : null
  const hasExistingBlocks = (selectedData?.blockedSlots.length ?? 0) > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary">Availability</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Block dates or time slots to prevent customer bookings</p>
        </div>
        <div className="flex items-center gap-2">
          {fetching && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted/60 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-heading font-semibold text-primary text-sm w-36 text-center">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted/60 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" /> Full day blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" /> Some slots blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-white border border-border inline-block" /> Available (click to block)
        </span>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="border-r border-b border-border/50 h-20" />
            }
            const date = isoDate(year, month, day)
            const status = getDayStatus(date)
            const isPast = date < todayStr
            const isToday = date === todayStr
            const data = byDate[date]
            const bookedCount = data?.booked.length ?? 0

            return (
              <button
                key={date}
                onClick={() => !isPast && openDay(date)}
                disabled={isPast}
                className={[
                  'border-r border-b border-border/50 h-20 p-2 text-left flex flex-col gap-1 transition-colors w-full',
                  isPast ? 'opacity-40 cursor-default' : 'hover:bg-muted/40 cursor-pointer',
                  status === 'full' ? 'bg-red-50' : status === 'partial' ? 'bg-amber-50' : '',
                ].join(' ')}
              >
                <span className={`text-sm font-semibold leading-none ${isToday ? 'text-accent' : 'text-primary'}`}>
                  {day}
                  {isToday && <span className="ml-1 text-[10px] font-normal text-accent">Today</span>}
                </span>
                {status === 'full' && (
                  <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full w-fit">
                    Full block
                  </span>
                )}
                {status === 'partial' && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full w-fit">
                    {data!.blockedSlots.length} slot{data!.blockedSlots.length !== 1 ? 's' : ''} blocked
                  </span>
                )}
                {bookedCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {bookedCount} booked
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day blocking dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-primary">
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-SG', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })
                : 'Block slots'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Block entire day toggle */}
            <button
              type="button"
              onClick={() => {
                setBlockEntireDay(prev => !prev)
                setCheckedSlots(new Set())
              }}
              className={[
                'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                blockEntireDay
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'border-border hover:bg-muted/40 text-primary',
              ].join(' ')}
            >
              <span className={[
                'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                blockEntireDay ? 'bg-red-500 border-red-500' : 'border-slate-300',
              ].join(' ')}>
                {blockEntireDay && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="font-semibold text-sm">Block entire day</span>
            </button>

            {/* Individual slots */}
            {!blockEntireDay && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Or block individual slots
                </p>
                {SLOT_KEYS.map(slot => {
                  const booked = selectedData?.booked.includes(slot) ?? false
                  const checked = checkedSlots.has(slot)
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => !booked && toggleSlot(slot)}
                      disabled={booked}
                      className={[
                        'w-full flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors text-left',
                        booked ? 'opacity-50 cursor-not-allowed border-border' : 'cursor-pointer',
                        checked && !booked ? 'bg-amber-50 border-amber-300' : 'border-border hover:bg-muted/40',
                      ].join(' ')}
                    >
                      <span className={[
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        checked ? 'bg-amber-500 border-amber-500' : 'border-slate-300',
                      ].join(' ')}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm text-primary flex-1">{SLOT_LABELS[slot]}</span>
                      {booked && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">booked</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Reason (optional)
              </Label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Public holiday"
                className="h-9 text-sm"
              />
            </div>

            {saveError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              {hasExistingBlocks && (
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-sm border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleClear}
                  disabled={saving}
                >
                  Clear all
                </Button>
              )}
              <Button
                className="flex-1 h-9 text-sm bg-accent hover:bg-accent/90 text-white"
                onClick={handleSave}
                disabled={saving || (!blockEntireDay && checkedSlots.size === 0)}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
