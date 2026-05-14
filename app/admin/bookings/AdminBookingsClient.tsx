'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BookingCard } from '@/components/admin/BookingCard'
import { SLOT_LABELS } from '@/lib/types'
import type { BookingWithRelations, TimeSlot } from '@/lib/types'

const BookingsMap = dynamic(
  () => import('@/components/admin/BookingsMap').then(m => ({ default: m.BookingsMap })),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">Loading map…</div> }
)

type Tab = 'MAINTENANCE' | 'FAULT_REPAIR' | 'INSTALLATION' | 'ALL'
type StatusFilter = 'PENDING' | 'ACTIVE' | 'PAST'

const TABS: { id: Tab; label: string }[] = [
  { id: 'MAINTENANCE', label: 'Maintenance' },
  { id: 'FAULT_REPAIR', label: 'Fault Repair' },
  { id: 'INSTALLATION', label: 'Installation' },
  { id: 'ALL', label: 'All' },
]

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'PENDING', label: 'Pending Confirmation' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'PAST', label: 'Past' },
]

interface Props {
  initialBookings: BookingWithRelations[]
}

export function AdminBookingsClient({ initialBookings }: Props) {
  const [bookings, setBookings] = useState(initialBookings)
  const [activeTab, setActiveTab] = useState<Tab>('MAINTENANCE')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING')
  const [refreshKey, setRefreshKey] = useState(0)

  // Maintenance bulk-approve state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmedDate, setConfirmedDate] = useState('')
  const [approving, setApproving] = useState(false)
  const [approveResult, setApproveResult] = useState<{ approved: number; excluded: { id: string; customer: string }[] } | null>(null)

  // Pin-click selection for Fault Repair / Installation
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  // Fault Repair filters
  const [frSearch, setFrSearch] = useState('')
  const [frDateFrom, setFrDateFrom] = useState('')
  const [frStatus, setFrStatus] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL')

  // Installation filters
  const [instSearch, setInstSearch] = useState('')
  const [instDateFrom, setInstDateFrom] = useState('')
  const [instStatus, setInstStatus] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL')

  // All tab filters
  const [allSearch, setAllSearch] = useState('')

  // Draggable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/bookings?admin=1')
    if (res.ok) {
      setBookings(await res.json())
    } else {
      setRefreshKey(k => k + 1)
    }
  }, [])

  // Category-filtered lists — FAULT_REPAIR and INSTALLATION exclude past jobs
  const maintenance = bookings.filter(b => b.category === 'MAINTENANCE')
  const faultRepair = bookings
    .filter(b => b.category === 'FAULT_REPAIR' && b.status !== 'COMPLETED' && b.status !== 'REJECTED')
    .sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      return (order[a.urgency as keyof typeof order] ?? 3) - (order[b.urgency as keyof typeof order] ?? 3)
    })
  const installation = bookings.filter(
    b => b.category === 'INSTALLATION' && b.status !== 'COMPLETED' && b.status !== 'REJECTED'
  )

  // Filtered lists for sidebar
  const faultRepairFiltered = faultRepair.filter(b => {
    if (frSearch && !b.customer.name.toLowerCase().includes(frSearch.toLowerCase())) return false
    if (frDateFrom && b.booking_date && b.booking_date < frDateFrom) return false
    if (frStatus !== 'ALL' && b.status !== frStatus) return false
    return true
  })

  const installationFiltered = installation.filter(b => {
    if (instSearch && !b.customer.name.toLowerCase().includes(instSearch.toLowerCase())) return false
    if (instDateFrom && b.booking_date && b.booking_date < instDateFrom) return false
    if (instStatus !== 'ALL' && b.status !== instStatus) return false
    return true
  })

  // Map pins for the current tab
  const mapBookings = (() => {
    if (activeTab === 'MAINTENANCE') return maintenance.filter(b => b.status === 'PENDING')
    if (activeTab === 'FAULT_REPAIR') return faultRepairFiltered
    if (activeTab === 'INSTALLATION') return installationFiltered
    if (statusFilter === 'PENDING') return bookings.filter(b => b.status === 'PENDING')
    if (statusFilter === 'ACTIVE') return bookings.filter(b => b.status === 'APPROVED')
    return bookings.filter(b => b.status === 'COMPLETED' || b.status === 'REJECTED')
  })()

  // Maintenance bulk-approve
  const pendingMaintenance = maintenance.filter(b => b.status === 'PENDING')

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    setSelectedJobId(null)
  }

  async function handleBulkApprove() {
    if (!confirmedDate || selected.size === 0) return
    setApproving(true)
    setApproveResult(null)
    try {
      const res = await fetch('/api/bookings/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_ids: Array.from(selected), confirmed_date: confirmedDate }),
      })
      const data = await res.json()
      setApproveResult(data)
      setSelected(new Set())
      setConfirmedDate('')
    } catch {
      setApproveResult(null)
    } finally {
      setApproving(false)
      refresh()
    }
  }

  const pendingCount = (list: BookingWithRelations[]) => list.filter(b => b.status === 'PENDING').length

  // ALL tab filtered list
  const allFiltered = (() => {
    let list: BookingWithRelations[]
    if (statusFilter === 'PENDING') list = bookings.filter(b => b.status === 'PENDING')
    else if (statusFilter === 'ACTIVE') list = bookings.filter(b => b.status === 'APPROVED')
    else list = bookings.filter(b => b.status === 'COMPLETED' || b.status === 'REJECTED')
    if (allSearch) {
      const q = allSearch.toLowerCase()
      list = list.filter(b => b.customer.name.toLowerCase().includes(q) || b.customer.phone.includes(allSearch))
    }
    return list
  })()

  // Scroll to card when pin clicked
  useEffect(() => {
    if (!selectedJobId) return
    const el = document.querySelector(`[data-job-id="${selectedJobId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selectedJobId])

  // Drag-to-resize sidebar
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = rect.right - e.clientX
      setSidebarWidth(Math.max(240, Math.min(600, newWidth)))
    }
    function onMouseUp() {
      isDragging.current = false
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div key={refreshKey} className="flex flex-col h-[calc(100vh-10rem)]">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
        strategy="lazyOnload"
      />
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading font-bold text-2xl text-primary">Bookings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 shrink-0">
        {TABS.map(tab => {
          const src = tab.id === 'MAINTENANCE' ? maintenance : tab.id === 'FAULT_REPAIR' ? faultRepair : tab.id === 'INSTALLATION' ? installation : bookings
          const pending = pendingCount(src)
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {pending > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {pending}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Map + Drag handle + Sidebar */}
      <div ref={containerRef} className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border min-w-0">
          <BookingsMap
            bookings={mapBookings}
            selected={activeTab === 'MAINTENANCE' ? selected : selectedJobId ? new Set([selectedJobId]) : undefined}
            onPinClick={
              activeTab === 'MAINTENANCE'
                ? toggleSelect
                : (id) => setSelectedJobId(prev => prev === id ? null : id)
            }
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={(e) => { isDragging.current = true; e.preventDefault() }}
          className="w-1.5 mx-1 cursor-col-resize bg-slate-200 hover:bg-accent transition-colors shrink-0 rounded-full self-stretch"
        />

        {/* Sidebar */}
        <div style={{ width: sidebarWidth }} className="flex flex-col gap-3 overflow-hidden shrink-0">

          {/* ── MAINTENANCE sidebar ── */}
          {activeTab === 'MAINTENANCE' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary">
                  {selected.size} of {pendingMaintenance.length} selected
                </p>
                <button
                  onClick={() => setSelected(new Set(pendingMaintenance.map(b => b.id)))}
                  className="text-xs text-accent underline"
                >
                  Select all
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Confirmed Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={confirmedDate}
                  onChange={e => setConfirmedDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <Button
                onClick={handleBulkApprove}
                disabled={approving || selected.size === 0 || !confirmedDate}
                className="bg-accent hover:bg-accent/90 text-white text-sm shrink-0"
              >
                {approving ? 'Approving…' : `Approve ${selected.size} Booking${selected.size !== 1 ? 's' : ''}`}
              </Button>

              {approveResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs shrink-0">
                  <p className="font-semibold text-green-800">{approveResult.approved} approved ✓</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 mt-1">
                {pendingMaintenance.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No pending maintenance bookings.</p>
                ) : (
                  pendingMaintenance.map(b => (
                    <button
                      key={b.id}
                      onClick={() => toggleSelect(b.id)}
                      className={`w-full text-left rounded-lg border p-3 text-xs transition-colors ${
                        selected.has(b.id)
                          ? 'border-accent bg-blue-50'
                          : 'border-border bg-white hover:bg-muted/40'
                      }`}
                    >
                      <p className="font-semibold text-primary">{b.customer?.name}</p>
                      <p className="text-muted-foreground">{b.address}</p>
                      <p className="text-muted-foreground mt-0.5">{b.booking_date} · {SLOT_LABELS[b.time_slot as TimeSlot] ?? b.time_slot}</p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── FAULT REPAIR sidebar ── */}
          {activeTab === 'FAULT_REPAIR' && (
            <>
              <div className="space-y-2 shrink-0">
                <Input
                  placeholder="Search customer…"
                  value={frSearch}
                  onChange={e => setFrSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-1.5 items-center">
                  <Input
                    type="date"
                    value={frDateFrom}
                    onChange={e => setFrDateFrom(e.target.value)}
                    className="h-8 text-xs flex-1"
                    title="Show bookings with window ending on or after this date"
                  />
                  {frDateFrom && (
                    <button onClick={() => setFrDateFrom('')} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">✕</button>
                  )}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFrStatus(s)}
                      className={`flex-1 text-xs py-1 rounded border font-medium transition-colors ${
                        frStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {faultRepairFiltered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No fault repair bookings.</p>
                ) : (
                  faultRepairFiltered.map(b => (
                    <div key={b.id} data-job-id={b.id}>
                      <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} />
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── INSTALLATION sidebar ── */}
          {activeTab === 'INSTALLATION' && (
            <>
              <div className="space-y-2 shrink-0">
                <Input
                  placeholder="Search customer…"
                  value={instSearch}
                  onChange={e => setInstSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-1.5 items-center">
                  <Input
                    type="date"
                    value={instDateFrom}
                    onChange={e => setInstDateFrom(e.target.value)}
                    className="h-8 text-xs flex-1"
                    title="Show bookings with window ending on or after this date"
                  />
                  {instDateFrom && (
                    <button onClick={() => setInstDateFrom('')} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">✕</button>
                  )}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setInstStatus(s)}
                      className={`flex-1 text-xs py-1 rounded border font-medium transition-colors ${
                        instStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {installationFiltered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No installation bookings.</p>
                ) : (
                  installationFiltered.map(b => (
                    <div key={b.id} data-job-id={b.id}>
                      <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} />
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── ALL sidebar ── */}
          {activeTab === 'ALL' && (
            <>
              <div className="space-y-2 shrink-0">
                <Input
                  placeholder="Search customer…"
                  value={allSearch}
                  onChange={e => setAllSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-1">
                  {STATUS_FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                        statusFilter === f.id
                          ? 'bg-accent text-white border-accent'
                          : 'border-border text-slate-500 hover:bg-muted/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {allFiltered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No bookings here.</p>
                ) : (
                  allFiltered.map(b => (
                    <div key={b.id} data-job-id={b.id}>
                      <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} />
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
