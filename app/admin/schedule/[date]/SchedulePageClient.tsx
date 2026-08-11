'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { SLOT_LABELS } from '@/lib/types'
import type { RouteStop, TimeSlot } from '@/lib/types'

const RouteMap = dynamic(
  () => import('@/components/admin/RouteMap').then(m => m.RouteMap),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-slate-600 text-sm">Loading map…</div> }
)

interface LatLng { lat: number; lng: number }

interface Booking {
  id: string
  address: string
  lat: number
  lng: number
  notes: string | null
  time_slot: TimeSlot
  service_type: { name: string; duration_minutes: number | null } | null
  customer: { name: string; phone: string } | null
}

interface Props {
  date: string
  bookings: Booking[]
  depotLatLng: LatLng | null
}

const SLOT_COLOR: Record<TimeSlot, string> = {
  S10_12: 'bg-sky-100 text-sky-700',
  S13_15: 'bg-emerald-100 text-emerald-700',
  S15_17: 'bg-amber-100 text-amber-700',
  S17_19: 'bg-orange-100 text-orange-700',
  S19_21: 'bg-purple-100 text-purple-700',
}

export function SchedulePageClient({ date, bookings, depotLatLng }: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(bookings.map(b => b.id)))
  const [route, setRoute] = useState<RouteStop[] | null>(null)
  const [polyline, setPolyline] = useState<LatLng[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allSelected = selectedIds.size === bookings.length && bookings.length > 0

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(bookings.map(b => b.id)))
    setRoute(null)
    setPolyline([])
  }, [allSelected, bookings])

  const toggleOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setRoute(null)
    setPolyline([])
  }, [])

  async function runOptimizer() {
    setLoading(true)
    setError(null)
    setRoute(null)
    setPolyline([])
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedBookingIds: [...selectedIds] }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Optimisation failed')
      }
      const data = await res.json()
      setRoute(data.route)
      setPolyline(data.polyline)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-xl text-primary">Route Optimiser</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {bookings.length} approved job{bookings.length !== 1 ? 's' : ''} on {date}
          </p>
        </div>
        <input
          type="date"
          aria-label="Schedule date"
          value={date}
          onChange={e => router.push(`/admin/schedule/${e.target.value}`)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Body — two columns */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0" style={{ minHeight: '600px' }}>

        {/* Left — job list / route cards */}
        <div className="lg:w-96 flex flex-col gap-3 overflow-y-auto pr-1">
          {bookings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No approved jobs for this date.</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button onClick={toggleAll} className="text-xs text-accent hover:underline">
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
                <Button
                  size="sm"
                  onClick={runOptimizer}
                  disabled={selectedIds.size === 0 || loading}
                  className="bg-accent hover:bg-accent/90 text-white text-xs"
                >
                  {loading ? 'Optimising…' : `Optimise Route (${selectedIds.size})`}
                </Button>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
              )}

              {route ? (
                <>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Optimised stop order</p>
                  {route.map(stop => (
                    <div key={stop.bookingId} className="bg-white border border-border rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {stop.sequenceOrder}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-primary">
                            {stop.estimatedStart} – {stop.estimatedEnd}
                          </p>
                          {stop.travelFromPrevMinutes > 0 && (
                            <p className="text-xs text-muted-foreground">{stop.travelFromPrevMinutes} min drive from prev</p>
                          )}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${SLOT_COLOR[stop.timeSlot]}`}>
                          {SLOT_LABELS[stop.timeSlot]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-accent">{stop.serviceType}</p>
                      <p className="text-sm text-slate-700">{stop.customerName}</p>
                      <p className="text-xs text-muted-foreground">{stop.address}</p>
                      {stop.notes && (
                        <p className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2 text-amber-800">
                          {stop.notes}
                        </p>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => { setRoute(null); setPolyline([]) }}
                    className="text-xs text-muted-foreground hover:text-slate-600 text-center py-1"
                  >
                    ← Back to selection
                  </button>
                </>
              ) : (
                bookings.map(b => {
                  const checked = selectedIds.has(b.id)
                  return (
                    <label
                      key={b.id}
                      className={`flex items-start gap-3 bg-white border rounded-xl p-4 cursor-pointer transition-colors ${
                        checked ? 'border-accent' : 'border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(b.id)}
                        className="mt-0.5 accent-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-primary truncate">{b.customer?.name ?? '—'}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${SLOT_COLOR[b.time_slot]}`}>
                            {SLOT_LABELS[b.time_slot]}
                          </span>
                        </div>
                        <p className="text-xs text-accent">
                          {b.service_type?.name ?? '—'} · {b.service_type?.duration_minutes ?? '?'} min
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{b.address}</p>
                        {b.notes && (
                          <p className="text-xs text-amber-700 mt-1 truncate">{b.notes}</p>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </>
          )}
        </div>

        {/* Right — map */}
        <div className="flex-1 bg-muted rounded-xl overflow-hidden" style={{ minHeight: '400px' }}>
          {polyline.length >= 2 && route ? (
            <RouteMap polyline={polyline} route={route} apiKey={apiKey} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-16">
              <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-sm text-center px-4">
                Select jobs then click <strong>Optimise Route</strong> to see the map
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
