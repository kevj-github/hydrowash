'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import { Input } from '@/components/ui/input'
import { BookingCard } from '@/components/admin/BookingCard'
import type { BookingWithRelations } from '@/lib/types'

const BookingsMap = dynamic(
  () => import('@/components/admin/BookingsMap').then(m => ({ default: m.BookingsMap })),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 text-sm">Loading map…</div> }
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
  initialVisitMap?: Record<string, { visitNo: number; totalVisits: number }>
}

export function AdminBookingsClient({ initialBookings, initialVisitMap = {} }: Props) {
  const [bookings, setBookings] = useState(initialBookings)
  const [visitMap, setVisitMap] = useState<Record<string, { visitNo: number; totalVisits: number }>>(initialVisitMap)
  const [activeTab, setActiveTab] = useState<Tab>('MAINTENANCE')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING')
  const [refreshKey, setRefreshKey] = useState(0)

  // Pin-click selection for all tabs
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  // Maintenance filters
  const [maintSearch, setMaintSearch] = useState('')
  const [maintDateFrom, setMaintDateFrom] = useState('')
  const [maintStatus, setMaintStatus] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL')

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

  // Draggable sidebar (desktop)
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mobile map bottom sheet
  const [mapSheetOpen, setMapSheetOpen] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/bookings?admin=1')
    if (res.ok) {
      const body = await res.json()
      setBookings(body.bookings ?? body)
      if (body.visitMap) setVisitMap(body.visitMap)
    } else {
      setRefreshKey(k => k + 1)
    }
  }, [])

  // Category-filtered lists — FAULT_REPAIR and INSTALLATION exclude past jobs
  const maintenance = bookings.filter(
    b => b.category === 'MAINTENANCE' && b.status !== 'COMPLETED' && b.status !== 'REJECTED'
  )
  const faultRepair = bookings
    .filter(b => b.category === 'FAULT_REPAIR' && b.status !== 'COMPLETED' && b.status !== 'REJECTED')
    .sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
      return (order[a.urgency as keyof typeof order] ?? 3) - (order[b.urgency as keyof typeof order] ?? 3)
    })
  const installation = bookings.filter(
    b => b.category === 'INSTALLATION' && b.status !== 'COMPLETED' && b.status !== 'REJECTED'
  )

  const maintenanceFiltered = maintenance.filter(b => {
    if (maintSearch && !b.customer.name.toLowerCase().includes(maintSearch.toLowerCase())) return false
    if (maintDateFrom && b.booking_date && b.booking_date < maintDateFrom) return false
    if (maintStatus !== 'ALL' && b.status !== maintStatus) return false
    return true
  })

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
    if (activeTab === 'MAINTENANCE') return maintenanceFiltered
    if (activeTab === 'FAULT_REPAIR') return faultRepairFiltered
    if (activeTab === 'INSTALLATION') return installationFiltered
    if (statusFilter === 'PENDING') return bookings.filter(b => b.status === 'PENDING')
    if (statusFilter === 'ACTIVE') return bookings.filter(b => b.status === 'APPROVED')
    return bookings.filter(b => b.status === 'COMPLETED' || b.status === 'REJECTED')
  })()

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    setSelectedJobId(null)
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

  // Scroll to card when pin clicked.
  // Every booking renders twice — once in the mobile bottom sheet, once in the
  // desktop sidebar — so querySelector can (and did) return the hidden copy and
  // scroll nothing. Pick the copy that is actually laid out.
  useEffect(() => {
    if (!selectedJobId) return
    const matches = Array.from(document.querySelectorAll(`[data-job-id="${selectedJobId}"]`))
    const el = matches.find(n => (n as HTMLElement).offsetParent !== null) ?? matches[0]
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
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&loading=async`}
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
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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

      {/* ── Mobile: card list + Show Map FAB ── */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 relative">
        {/* Mobile map bottom sheet backdrop */}
        {mapSheetOpen && (
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMapSheetOpen(false)} />
        )}
        {/* Mobile map bottom sheet */}
        {mapSheetOpen && (
          <div className="fixed bottom-14 left-0 right-0 z-50 h-[50vh] rounded-t-2xl overflow-hidden border-t border-border bg-white">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-300" />
            <div className="w-full h-full pt-4">
              <BookingsMap
                bookings={mapBookings}
                selected={selectedJobId ? new Set([selectedJobId]) : undefined}
                onPinClick={(id) => setSelectedJobId(prev => prev === id ? null : id)}
              />
            </div>
            <button
              onClick={() => setMapSheetOpen(false)}
              className="absolute top-3 right-3 text-xs bg-white border border-border rounded-lg px-3 py-1.5 text-primary font-medium shadow-sm"
            >
              Close
            </button>
          </div>
        )}

        {/* Card list (full width on mobile) */}
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 pb-20">
          {activeTab === 'MAINTENANCE' && (
            <>
              <div className="space-y-2 shrink-0">
                <Input placeholder="Search customer…" value={maintSearch} onChange={e => setMaintSearch(e.target.value)} className="h-8 text-xs" />
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground shrink-0">From</span>
                  <Input type="date" value={maintDateFrom} onChange={e => setMaintDateFrom(e.target.value)} className="h-8 text-xs flex-1" aria-label="Show bookings with window ending on or after this date" />
                  {maintDateFrom && <button onClick={() => setMaintDateFrom('')} aria-label="Clear date filter" className="text-xs text-slate-600 hover:text-slate-900 shrink-0">✕</button>}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button key={s} onClick={() => setMaintStatus(s)} className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${maintStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {maintenanceFiltered.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No maintenance bookings.</p>
                  : maintenanceFiltered.map(b => (
                      <div key={b.id} data-job-id={b.id}>
                        <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
                      </div>
                    ))
                }
              </div>
            </>
          )}
          {activeTab === 'FAULT_REPAIR' && (
            <>
              <div className="space-y-2 shrink-0">
                <Input placeholder="Search customer…" value={frSearch} onChange={e => setFrSearch(e.target.value)} className="h-8 text-xs" />
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground shrink-0">From</span>
                  <Input type="date" value={frDateFrom} onChange={e => setFrDateFrom(e.target.value)} className="h-8 text-xs flex-1" aria-label="Show bookings with window ending on or after this date" />
                  {frDateFrom && <button onClick={() => setFrDateFrom('')} aria-label="Clear date filter" className="text-xs text-slate-600 hover:text-slate-900 shrink-0">✕</button>}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button key={s} onClick={() => setFrStatus(s)} className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${frStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {faultRepairFiltered.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No fault repair bookings.</p>
                  : faultRepairFiltered.map(b => (
                      <div key={b.id} data-job-id={b.id}>
                        <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
                      </div>
                    ))
                }
              </div>
            </>
          )}
          {activeTab === 'INSTALLATION' && (
            <>
              <div className="space-y-2 shrink-0">
                <Input placeholder="Search customer…" value={instSearch} onChange={e => setInstSearch(e.target.value)} className="h-8 text-xs" />
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground shrink-0">From</span>
                  <Input type="date" value={instDateFrom} onChange={e => setInstDateFrom(e.target.value)} className="h-8 text-xs flex-1" aria-label="Show bookings with window ending on or after this date" />
                  {instDateFrom && <button onClick={() => setInstDateFrom('')} aria-label="Clear date filter" className="text-xs text-slate-600 hover:text-slate-900 shrink-0">✕</button>}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button key={s} onClick={() => setInstStatus(s)} className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${instStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {installationFiltered.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No installation bookings.</p>
                  : installationFiltered.map(b => (
                      <div key={b.id} data-job-id={b.id}>
                        <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
                      </div>
                    ))
                }
              </div>
            </>
          )}
          {activeTab === 'ALL' && (
            <>
              <div className="space-y-2 shrink-0">
                <Input placeholder="Search customer…" value={allSearch} onChange={e => setAllSearch(e.target.value)} className="h-8 text-xs" />
                <div className="flex gap-1">
                  {STATUS_FILTERS.map(f => (
                    <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${statusFilter === f.id ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {allFiltered.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No bookings here.</p>
                  : allFiltered.map(b => (
                      <div key={b.id} data-job-id={b.id}>
                        <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
                      </div>
                    ))
                }
              </div>
            </>
          )}
        </div>

        {/* Show Map FAB */}
        <button
          onClick={() => setMapSheetOpen(o => !o)}
          className="fixed bottom-20 right-4 z-30 bg-accent text-white rounded-full px-4 py-3 text-sm font-semibold shadow-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {mapSheetOpen ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      {/* ── Desktop: map + drag handle + sidebar ── */}
      <div ref={containerRef} className="hidden md:flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border min-w-0">
          <BookingsMap
            bookings={mapBookings}
            selected={selectedJobId ? new Set([selectedJobId]) : undefined}
            onPinClick={(id) => setSelectedJobId(prev => prev === id ? null : id)}
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
              <div className="space-y-2 shrink-0">
                <Input
                  placeholder="Search customer…"
                  value={maintSearch}
                  onChange={e => setMaintSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground shrink-0">From</span>
                  <Input
                    type="date"
                    value={maintDateFrom}
                    onChange={e => setMaintDateFrom(e.target.value)}
                    className="h-8 text-xs flex-1"
                    aria-label="Show bookings with window ending on or after this date"
                  />
                  {maintDateFrom && (
                    <button onClick={() => setMaintDateFrom('')} aria-label="Clear date filter" className="text-xs text-slate-600 hover:text-slate-900 shrink-0">✕</button>
                  )}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setMaintStatus(s)}
                      className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${
                        maintStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {maintenanceFiltered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No maintenance bookings.</p>
                ) : (
                  maintenanceFiltered.map(b => (
                    <div key={b.id} data-job-id={b.id}>
                      <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
                    </div>
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
                  <span className="text-xs text-muted-foreground shrink-0">From</span>
                  <Input
                    type="date"
                    value={frDateFrom}
                    onChange={e => setFrDateFrom(e.target.value)}
                    className="h-8 text-xs flex-1"
                    aria-label="Show bookings with window ending on or after this date"
                  />
                  {frDateFrom && (
                    <button onClick={() => setFrDateFrom('')} aria-label="Clear date filter" className="text-xs text-slate-600 hover:text-slate-900 shrink-0">✕</button>
                  )}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFrStatus(s)}
                      className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${
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
                      <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
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
                  <span className="text-xs text-muted-foreground shrink-0">From</span>
                  <Input
                    type="date"
                    value={instDateFrom}
                    onChange={e => setInstDateFrom(e.target.value)}
                    className="h-8 text-xs flex-1"
                    aria-label="Show bookings with window ending on or after this date"
                  />
                  {instDateFrom && (
                    <button onClick={() => setInstDateFrom('')} aria-label="Clear date filter" className="text-xs text-slate-600 hover:text-slate-900 shrink-0">✕</button>
                  )}
                </div>
                <div className="flex gap-1">
                  {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setInstStatus(s)}
                      className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${
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
                      <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
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
                      <BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} contractVisitInfo={visitMap[b.id]} />
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
