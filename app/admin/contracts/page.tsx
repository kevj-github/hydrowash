'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'
import ContractCard from '@/components/admin/ContractCard'
import { ContractWithCustomer, ContractServiceDate, CreateContractPayload } from '@/lib/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Home, MapPin, Pencil, SlidersHorizontal } from 'lucide-react'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'

type LocationPreset = 'home' | 'current' | 'other'

type ContractRow = ContractWithCustomer & { contract_service_dates: ContractServiceDate[] }

type CustomerOption = {
  id: string
  name: string
  phone: string
  address: string | null
  address_lat: number | null
  address_lng: number | null
  postal_code: string | null
}

export default function AdminContractsPage() {
  const supabase = createClient()

  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)

  // List filters
  const [search, setSearch] = useState('')
  const [startFrom, setStartFrom] = useState('')
  const [startTo, setStartTo] = useState('')
  const [endFrom, setEndFrom] = useState('')
  const [endTo, setEndTo] = useState('')
  const [serviceDueFrom, setServiceDueFrom] = useState('')
  const [serviceDueTo, setServiceDueTo] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [customers, setCustomers] = useState<CustomerOption[]>([])

  // Combobox state
  const [customerSearch, setCustomerSearch] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  // Address picker state
  const [preset, setPreset] = useState<LocationPreset>('other')
  const [geoLoading, setGeoLoading] = useState(false)
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const onChangeAddressRef = useRef<(addr: string) => void>(() => {})

  const [form, setForm] = useState<{
    customer_id: string
    num_units: string
    price_sgd: string
    start_date: string
    address: string
    notes: string
  }>({
    customer_id: '',
    num_units: '',
    price_sgd: '',
    start_date: '',
    address: '',
    notes: '',
  })

  // Keep ref in sync so autocomplete listener always sees latest setter
  useEffect(() => {
    onChangeAddressRef.current = (addr: string) => {
      setForm(f => ({ ...f, address: addr }))
      setAddressConfirmed(true)
    }
  })

  async function fetchContracts() {
    setLoading(true)
    const res = await fetch('/api/contracts')
    const json = await res.json()
    setContracts(json.contracts ?? [])
    setLoading(false)
  }

  async function fetchCustomers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, phone, address, address_lat, address_lng, postal_code')
      .eq('role', 'customer')
      .order('name')
    setCustomers((data ?? []) as CustomerOption[])
  }

  useEffect(() => {
    fetchContracts()
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Close combobox on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function applyHome() {
    if (!selectedCustomer?.address) return
    setPreset('home')
    setAddressConfirmed(true)
    setForm(f => ({ ...f, address: selectedCustomer.address! }))
  }

  function applyCurrentLocation() {
    setPreset('current')
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const res = await fetch('/api/geocode/reverse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          })
          if (res.ok) {
            const { address } = await res.json()
            setForm(f => ({ ...f, address }))
            setAddressConfirmed(true)
          }
        } finally {
          setGeoLoading(false)
        }
      },
      () => { setGeoLoading(false); setPreset('other') }
    )
  }

  const endDatePreview = form.start_date
    ? (() => {
        const d = new Date(form.start_date)
        d.setFullYear(d.getFullYear() + 1)
        return d.toISOString().split('T')[0]
      })()
    : '—'

  const selectedCustomer = customers.find(c => c.id === form.customer_id) ?? null

  const filteredCustomers = customers
    .filter(c =>
      !customerSearch ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
    )
    .slice(0, 8)

  const hasFilters = search || startFrom || startTo || endFrom || endTo || serviceDueFrom || serviceDueTo || statusFilter !== 'ALL'

  const filteredContracts = contracts
    .filter(c => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.customer.name.toLowerCase().includes(q) && !c.customer.phone.includes(search)) return false
      }
      if (startFrom && c.start_date < startFrom) return false
      if (startTo && c.start_date > startTo) return false
      if (endFrom && c.end_date < endFrom) return false
      if (endTo && c.end_date > endTo) return false
      if (serviceDueFrom || serviceDueTo) {
        const fromMonth = serviceDueFrom ? serviceDueFrom.slice(0, 7) : null
        const toMonth = serviceDueTo ? serviceDueTo.slice(0, 7) : null
        const nextDue = (c.contract_service_dates ?? [])
          .filter((sd: { booking_id: string | null; due_month: string }) => !sd.booking_id)
          .map((sd: { due_month: string }) => sd.due_month)
          .sort()[0] ?? null
        if (!nextDue) return false
        if (fromMonth && nextDue < fromMonth) return false
        if (toMonth && nextDue > toMonth) return false
      }
      return true
    })
    .map((c) => {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const isOverdue = (c.contract_service_dates ?? []).some(
        (sd: { due_month: string; booking_id: string | null }) =>
          !sd.booking_id && sd.due_month < currentMonth
      )
      return { ...c, isOverdue }
    })
    .sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (b.isOverdue && !a.isOverdue) return 1
      const priority = (s: string) =>
        s === 'PENDING_REVIEW' ? 0 : s === 'AWAITING_PAYMENT' ? 1 : 2
      return priority(a.status) - priority(b.status)
    })

  function resetForm() {
    setForm({ customer_id: '', num_units: '', price_sgd: '', start_date: '', address: '', notes: '' })
    setCustomerSearch('')
    setPreset('other')
    setAddressConfirmed(false)
    setGeoLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const payload: CreateContractPayload = {
      customer_id: form.customer_id,
      num_units: parseInt(form.num_units),
      price_sgd: parseFloat(form.price_sgd),
      start_date: form.start_date,
      address: form.address || undefined,
      notes: form.notes || undefined,
    }

    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)

    if (res.ok) {
      setDialogOpen(false)
      resetForm()
      fetchContracts()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
        strategy="afterInteractive"
      />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-bold text-2xl text-primary">
            Contracts <span className="text-muted-foreground font-normal text-base">· {filteredContracts.length}</span>
          </h1>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) {
                resetForm()
                setComboOpen(false)
              }
            }}
          >
            <DialogTrigger className={cn(buttonVariants(), 'bg-accent text-white hover:bg-accent/90')}>
              + New Contract
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Contract</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Customer search combobox */}
                <div>
                  <Label>Customer</Label>
                  <div ref={comboRef} className="relative mt-1">
                    <input
                      type="text"
                      placeholder="Search by name or phone…"
                      value={comboOpen ? customerSearch : selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : ''}
                      onFocus={() => {
                        setComboOpen(true)
                        setCustomerSearch('')
                      }}
                      onChange={e => setCustomerSearch(e.target.value)}
                      required={!form.customer_id}
                      className="w-full h-9 px-3 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    />
                    {comboOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-md border border-border shadow-lg max-h-48 overflow-y-auto">
                        {filteredCustomers.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-slate-400">No customers found.</p>
                        ) : (
                          filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                form.customer_id === c.id ? 'bg-blue-50 text-accent' : 'text-[#0F172A]'
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setForm(f => ({ ...f, customer_id: c.id, address: '' }))
                                setPreset('other')
                                setAddressConfirmed(false)
                                setComboOpen(false)
                                setCustomerSearch('')
                              }}
                            >
                              {c.name}{' '}
                              <span className="text-slate-400 text-xs">{c.phone}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {form.customer_id && !comboOpen && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600 mt-1 underline"
                      onClick={() => {
                        setForm(f => ({ ...f, customer_id: '', address: '' }))
                        setPreset('other')
                        setAddressConfirmed(false)
                        setCustomerSearch('')
                      }}
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Number of Units</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.num_units}
                      onChange={(e) => setForm((f) => ({ ...f, num_units: e.target.value }))}
                      required
                      placeholder="e.g. 4"
                    />
                  </div>
                  <div>
                    <Label>Price (SGD)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price_sgd}
                      onChange={(e) => setForm((f) => ({ ...f, price_sgd: e.target.value }))}
                      required
                      placeholder="e.g. 480.00"
                    />
                  </div>
                </div>

                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    required
                  />
                  {form.start_date && (
                    <p className="text-xs text-muted-foreground mt-1">End date: {endDatePreview}</p>
                  )}
                </div>

                {/* Address picker */}
                <div className="space-y-2">
                  <Label>Service Address (optional)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedCustomer?.address && (
                      <button
                        type="button"
                        onClick={applyHome}
                        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border font-medium transition-colors ${
                          preset === 'home' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
                        }`}
                      >
                        <Home className="w-3 h-3" />
                        Customer Home
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={applyCurrentLocation}
                      disabled={geoLoading}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border font-medium transition-colors ${
                        preset === 'current' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      {geoLoading ? 'Locating…' : 'My Location'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreset('other')
                        setForm(f => ({ ...f, address: '' }))
                        setAddressConfirmed(false)
                      }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border font-medium transition-colors ${
                        preset === 'other' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
                      }`}
                    >
                      <Pencil className="w-3 h-3" />
                      Other
                    </button>
                  </div>

                  {preset === 'other' && (
                    <div className="space-y-1">
                      <AddressAutocomplete
                        placeholder="Start typing an address…"
                        defaultValue={form.address}
                        onResolved={resolved => {
                          onChangeAddressRef.current(resolved?.address ?? '')
                          setAddressConfirmed(!!resolved)
                        }}
                      />
                      {addressConfirmed ? (
                        <p className="text-xs text-green-700">✓ Address confirmed</p>
                      ) : (
                        <p className="text-xs text-slate-400">Select an address from the dropdown, or leave blank.</p>
                      )}
                    </div>
                  )}

                  {(preset === 'home' || preset === 'current') && form.address && (
                    <p className="text-sm text-primary font-medium">{form.address}</p>
                  )}
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Includes chemical wash in June"
                    rows={2}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !form.customer_id}
                  className="w-full bg-accent text-white hover:bg-accent/90"
                >
                  {submitting ? 'Saving…' : 'Create Contract'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="space-y-3 bg-white border border-border rounded-xl p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by customer name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`md:hidden flex items-center gap-1 px-3 h-8 rounded-lg border text-xs font-medium transition-colors ${
                filtersOpen ? 'bg-accent text-white border-accent' : 'border-border text-slate-500'
              }`}
            >
              <SlidersHorizontal size={13} />
              Filters
            </button>
          </div>
          <div className={`${filtersOpen ? 'flex' : 'hidden'} md:block flex-col gap-3`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Start date</p>
              <div className="flex gap-1 items-center">
                <Input type="date" aria-label="Start date from" value={startFrom} onChange={e => setStartFrom(e.target.value)} className="h-8 text-xs flex-1" placeholder="From" />
                <span className="text-xs text-slate-400">–</span>
                <Input type="date" aria-label="Start date to" value={startTo} onChange={e => setStartTo(e.target.value)} className="h-8 text-xs flex-1" placeholder="To" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Expiry date</p>
              <div className="flex gap-1 items-center">
                <Input type="date" aria-label="Expiry date from" value={endFrom} onChange={e => setEndFrom(e.target.value)} className="h-8 text-xs flex-1" />
                <span className="text-xs text-slate-400">–</span>
                <Input type="date" aria-label="Expiry date to" value={endTo} onChange={e => setEndTo(e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Next service due</p>
              <div className="flex gap-1 items-center">
                <Input type="date" aria-label="Next service due from" value={serviceDueFrom} onChange={e => setServiceDueFrom(e.target.value)} className="h-8 text-xs flex-1" />
                <span className="text-xs text-slate-400">–</span>
                <Input type="date" aria-label="Next service due to" value={serviceDueTo} onChange={e => setServiceDueTo(e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>
          </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'PENDING_REVIEW', 'AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    statusFilter === s
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-muted-foreground border-border hover:border-accent'
                  }`}
                >
                  {s === 'PENDING_REVIEW' ? 'Pending Review' : s === 'AWAITING_PAYMENT' ? 'Awaiting Payment' : s}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setStartFrom(''); setStartTo(''); setEndFrom(''); setEndTo(''); setServiceDueFrom(''); setServiceDueTo(''); setStatusFilter('ALL') }}
                className="text-xs text-slate-400 hover:text-slate-600 underline shrink-0"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : filteredContracts.length === 0 ? (
          <p className="text-muted-foreground">No contracts found.</p>
        ) : (
          <>
            {/* Desktop: 2-col grid */}
            <div className="hidden sm:grid gap-4 sm:grid-cols-2">
              {filteredContracts.map((c) => (
                <ContractCard key={c.id} contract={c} isOverdue={c.isOverdue} />
              ))}
            </div>
            {/* Mobile: single column */}
            <div className="sm:hidden space-y-3">
              {filteredContracts.map((c) => (
                <ContractCard key={c.id} contract={c} isOverdue={c.isOverdue} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
