'use client'

import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'
import { QRCodeSVG } from 'qrcode.react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ContractPricingTier } from '@/lib/types'
import { buildPayNowPayload } from '@/lib/utils/paynow'
import { formatDueMonth } from '@/lib/contracts/service-dates'
import { FileText, FileX, Home, MapPin, Pencil } from 'lucide-react'
import { useMapsLoaded } from '@/lib/hooks/useMapsLoaded'

interface ServiceDate {
  id: string
  due_date: string
  due_month: string
  reminder_sent: boolean
  second_reminder_sent: boolean
  booking_id: string | null
}

interface Contract {
  id: string
  num_units: number
  price_sgd: number | string | null
  start_date: string
  end_date: string
  service_interval_months: number
  notes: string | null
  status: string
  contract_service_dates: ServiceDate[]
}

interface Invoice {
  id: string
  amount_sgd: number | string
  description: string
  status: string
  payment_method: string | null
  paid_at: string | null
  created_at: string
  booking_id: string | null
}

interface Props {
  contracts: Contract[]
  invoices: Invoice[]
  profileAddress: string | null
  profileUnitFloor: string | null
  profileBuildingName: string | null
  pricingTiers: ContractPricingTier[]
  paynowMobile: string | null
  activeContracts: number
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
  AWAITING_PAYMENT: 'Awaiting Payment',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

function getPricingHint(tiers: ContractPricingTier[], numUnits: number): string | null {
  if (!tiers.length || !numUnits) return null
  const tier = tiers.find(t =>
    numUnits >= t.min_units && (t.max_units === null || numUnits <= t.max_units)
  )
  if (!tier) return null
  if (tier.max_units === null) {
    return `Estimated S$${(tier.price_sgd * numUnits).toFixed(2)}/year (S$${tier.price_sgd.toFixed(2)}/unit)`
  }
  return `Estimated S$${tier.price_sgd.toFixed(2)}/year for ${numUnits} unit${numUnits !== 1 ? 's' : ''}`
}

export function AccountContractsClient({ contracts, invoices, profileAddress, profileUnitFloor, profileBuildingName, pricingTiers, paynowMobile, activeContracts }: Props) {
  const [contractStatus, setContractStatus] = useState('ALL')
  const [invoiceStatus, setInvoiceStatus] = useState('ALL')
  const [invDateFrom, setInvDateFrom] = useState('')
  const [invDateTo, setInvDateTo] = useState('')

  // PayNow dialog state
  const [paynowInvoice, setPaynowInvoice] = useState<Invoice | null>(null)

  // Request dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ num_units: '', preferred_month: '', notes: '' })

  // Address picker state
  type Preset = 'home' | 'current' | 'other'
  const hasHome = !!profileAddress
  const [preset, setPreset] = useState<Preset>(hasHome ? 'home' : 'other')
  const [addressText, setAddressText] = useState(profileAddress ?? '')
  const [addressConfirmed, setAddressConfirmed] = useState(hasHome)
  const [unitFloor, setUnitFloor] = useState(profileUnitFloor ?? '')
  const [buildingName, setBuildingName] = useState(profileBuildingName ?? '')
  const [geoLoading, setGeoLoading] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const isLoaded = useMapsLoaded()

  useEffect(() => {
    if (!isLoaded || !addressInputRef.current || preset !== 'other') return
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      componentRestrictions: { country: 'sg' },
      fields: ['formatted_address'],
    })
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.formatted_address) return
      setAddressText(place.formatted_address)
      setAddressConfirmed(true)
    })
    return () => { window.google.maps.event.removeListener(listener) }
  }, [isLoaded, preset, dialogOpen])

  function applyHome() {
    setPreset('home')
    setAddressText(profileAddress ?? '')
    setAddressConfirmed(true)
    setUnitFloor(profileUnitFloor ?? '')
    setBuildingName(profileBuildingName ?? '')
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
            setAddressText(address ?? '')
            setAddressConfirmed(true)
          }
        } finally {
          setGeoLoading(false)
        }
      },
      () => { setGeoLoading(false); setPreset('other') }
    )
  }

  function resetDialog() {
    setForm({ num_units: '', preferred_month: '', notes: '' })
    setPreset(hasHome ? 'home' : 'other')
    setAddressText(profileAddress ?? '')
    setAddressConfirmed(hasHome)
    setUnitFloor(profileUnitFloor ?? '')
    setBuildingName(profileBuildingName ?? '')
  }

  function buildFullAddress(): string | undefined {
    if (!addressText) return undefined
    const prefix = [unitFloor.trim(), buildingName.trim()].filter(Boolean).join(', ')
    return prefix ? `${prefix}, ${addressText}` : addressText
  }

  const today = new Date().toISOString().slice(0, 7)

  const filteredContracts = contracts
    .filter(c => contractStatus === 'ALL' || c.status === contractStatus)
    // PENDING_REVIEW at the top
    .sort((a, b) => {
      const priority = (s: string) =>
        s === 'PENDING_REVIEW' ? 0 : s === 'AWAITING_PAYMENT' ? 1 : 2
      return priority(a.status) - priority(b.status)
    })

  const filteredInvoices = invoices.filter(inv => {
    if (invoiceStatus !== 'ALL' && inv.status !== invoiceStatus) return false
    const created = inv.created_at.split('T')[0]
    if (invDateFrom && created < invDateFrom) return false
    if (invDateTo && created > invDateTo) return false
    return true
  })

  const hasInvFilters = invoiceStatus !== 'ALL' || invDateFrom || invDateTo

  const numUnitsInt = parseInt(form.num_units) || 0
  const pricingHint = getPricingHint(pricingTiers, numUnitsInt)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch('/api/contracts/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        num_units: parseInt(form.num_units),
        address: buildFullAddress(),
        preferred_month: form.preferred_month,
        notes: form.notes || undefined,
      }),
    })

    setSubmitting(false)

    if (res.ok) {
      setSubmitted(true)
      setTimeout(() => {
        setDialogOpen(false)
        setSubmitted(false)
        resetDialog()
        window.location.reload()
      }, 1500)
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="lazyOnload"
      />

      {/* Summary strip */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText size={18} className="text-accent" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Contracts</p>
            <p className="font-heading font-bold text-lg text-primary leading-none">{activeContracts}</p>
          </div>
        </div>
      </div>

      {/* How contracts work */}
      <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5 space-y-3">
        <h2 className="font-heading font-semibold text-base text-primary">How maintenance contracts work</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-accent font-bold shrink-0">1.</span>
            <span><strong className="text-primary">Submit a request</strong> — fill in the number of AC units and your service address. We review it and send you a contract with the annual price.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent font-bold shrink-0">2.</span>
            <span><strong className="text-primary">Pay to activate</strong> — once you receive the contract PDF and PayNow QR, complete payment. We activate your contract and schedule 4 quarterly service visits over the year.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent font-bold shrink-0">3.</span>
            <span><strong className="text-primary">Quarterly reminders</strong> — we email you when each service visit is due so you can book at your preferred date and time. Simply link the booking to this contract.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-accent font-bold shrink-0">4.</span>
            <span><strong className="text-primary">1-year coverage</strong> — your contract covers all 4 scheduled general cleaning visits. Additional repairs or chemical washes are billed separately.</span>
          </li>
        </ul>
        {pricingTiers.length > 0 && (
          <div className="pt-2 border-t border-accent/20">
            <p className="text-xs font-medium text-primary mb-1.5">Estimated pricing</p>
            <div className="flex flex-wrap gap-2">
              {pricingTiers.map((tier, i) => (
                <span key={i} className="text-xs bg-white border border-accent/20 rounded-full px-3 py-1 text-accent">
                  {tier.max_units === null
                    ? `${tier.min_units}+ units — S$${tier.price_sgd.toFixed(2)}/unit/year`
                    : tier.min_units === tier.max_units
                    ? `${tier.min_units} unit${tier.min_units !== 1 ? 's' : ''} — S$${tier.price_sgd.toFixed(2)}/year`
                    : `${tier.min_units}–${tier.max_units} units — S$${tier.price_sgd.toFixed(2)}/year`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contracts section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading font-bold text-2xl text-primary">My Contracts</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'ACTIVE', 'PENDING_REVIEW', 'AWAITING_PAYMENT', 'EXPIRED', 'CANCELLED'].map(s => (
                <button
                  key={s}
                  onClick={() => setContractStatus(s)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    contractStatus === s
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-muted-foreground border-border hover:border-accent'
                  }`}
                >
                  {CONTRACT_STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>

            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open)
                if (!open) { setSubmitted(false); resetDialog() }
              }}
            >
              <DialogTrigger className={cn(buttonVariants({ size: 'sm' }), 'bg-accent text-white hover:bg-accent/90')}>
                + Request Contract
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Request a Maintenance Contract</DialogTitle>
                </DialogHeader>

                {submitted ? (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-green-700 font-medium">Request submitted!</p>
                    <p className="text-sm text-muted-foreground">We will review your request and activate your contract shortly.</p>
                  </div>
                ) : (
                  <form onSubmit={handleRequest} className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
                    <div>
                      <Label>Number of AC units</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={form.num_units}
                        onChange={e => setForm(f => ({ ...f, num_units: e.target.value }))}
                        required
                        placeholder="e.g. 4"
                        className="mt-1"
                      />
                      {pricingHint && (
                        <p className="text-xs text-accent mt-1">{pricingHint}</p>
                      )}
                    </div>

                    {/* Service address picker */}
                    <div className="space-y-2">
                      <Label>Service address <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                      <div className="flex gap-2 flex-wrap">
                        {hasHome && (
                          <button
                            type="button"
                            onClick={applyHome}
                            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border font-medium transition-colors ${
                              preset === 'home' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
                            }`}
                          >
                            <Home className="w-3 h-3" /> Home
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
                          onClick={() => { setPreset('other'); setAddressText(''); setAddressConfirmed(false) }}
                          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border font-medium transition-colors ${
                            preset === 'other' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
                          }`}
                        >
                          <Pencil className="w-3 h-3" /> Other
                        </button>
                      </div>

                      {preset === 'other' && (
                        <div className="space-y-1">
                          <input
                            ref={addressInputRef}
                            type="text"
                            placeholder={isLoaded ? 'Start typing your address…' : 'Loading…'}
                            disabled={!isLoaded}
                            onChange={() => setAddressConfirmed(false)}
                            autoComplete="off"
                            className="w-full h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                          />
                          {addressConfirmed
                            ? <p className="text-xs text-green-700">✓ Address confirmed</p>
                            : <p className="text-xs text-muted-foreground">Select from the dropdown suggestions.</p>
                          }
                        </div>
                      )}

                      {(preset === 'home' || preset === 'current') && addressText && (
                        <p className="text-sm text-primary font-medium">{addressText}</p>
                      )}

                      {addressConfirmed && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Unit / Floor <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input
                              value={unitFloor}
                              onChange={e => setUnitFloor(e.target.value)}
                              placeholder="e.g. #04-05"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Building Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input
                              value={buildingName}
                              onChange={e => setBuildingName(e.target.value)}
                              placeholder="e.g. Watergate Condominium"
                              className="h-9 text-sm"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <Label>Preferred start month</Label>
                      <Input
                        type="month"
                        value={form.preferred_month}
                        onChange={e => setForm(f => ({ ...f, preferred_month: e.target.value }))}
                        min={today.slice(0, 7)}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                      <Textarea
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Any special requirements or questions…"
                        rows={2}
                        className="mt-1"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-accent text-white hover:bg-accent/90"
                    >
                      {submitting ? 'Submitting…' : 'Submit Request'}
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="text-center py-20">
            <FileX size={48} className="text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
            <h3 className="font-heading font-semibold text-primary text-lg mb-1">No contracts yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Contact us to set up a maintenance contract.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredContracts.map((contract) => {
              const sortedDates = [...(contract.contract_service_dates ?? [])].sort(
                (a, b) => a.due_month.localeCompare(b.due_month)
              )
              const isPending = contract.status === 'PENDING_REVIEW'
              const isAwaitingPayment = contract.status === 'AWAITING_PAYMENT'
              return (
                <div key={contract.id} className={`bg-white border rounded-xl p-5 space-y-4 ${isPending ? 'border-amber-200' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-heading font-semibold text-primary">
                        {contract.num_units} unit{contract.num_units !== 1 ? 's' : ''}
                        {contract.price_sgd != null
                          ? ` — S$${Number(contract.price_sgd).toFixed(2)}/yr`
                          : ' — Price TBD'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contract.start_date} → {contract.end_date}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CONTRACT_STATUS_COLORS[contract.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
                    </span>
                  </div>

                  {isPending && (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Your request is under review. We will contact you to confirm the price and start date.
                    </p>
                  )}
                  {isAwaitingPayment && (
                    <div className="space-y-2">
                      <p className="text-sm text-orange-700 bg-orange-50 rounded-lg px-3 py-2">
                        Pricing has been confirmed. Please complete the PayNow transfer to activate your contract.
                      </p>
                      <a
                        href={`/api/contracts/${contract.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-accent underline"
                      >
                        View Contract PDF
                      </a>
                    </div>
                  )}
                  {contract.status === 'ACTIVE' && (
                    <a
                      href={`/api/contracts/${contract.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-accent underline"
                    >
                      View Contract PDF
                    </a>
                  )}

                  {contract.notes && (
                    <p className="text-sm text-muted-foreground italic">{contract.notes}</p>
                  )}

                  {sortedDates.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-primary mb-2">Service Schedule</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b border-border">
                            <th className="py-1 text-left font-medium">Visit</th>
                            <th className="py-1 text-left font-medium">Due Date</th>
                            <th className="py-1 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedDates.map((sd, i) => {
                            const isPast = sd.due_month < today
                            const isCompleted = !!sd.booking_id
                            return (
                              <tr key={sd.id} className="border-b border-border/50">
                                <td className="py-1.5 text-muted-foreground">Visit {i + 1}</td>
                                <td className="py-1.5 text-primary">{formatDueMonth(sd.due_month)}</td>
                                <td className="py-1.5">
                                  {isCompleted ? (
                                    <Badge className="bg-green-100 text-green-800 text-xs">Booked</Badge>
                                  ) : isPast ? (
                                    <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>
                                  ) : (
                                    <Badge className="bg-slate-100 text-slate-500 text-xs">Upcoming</Badge>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Invoices section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading font-bold text-xl text-primary">My Invoices</h2>
          <div className="flex flex-wrap gap-2 items-center">
            {['ALL', 'UNPAID', 'PAID'].map(s => (
              <button
                key={s}
                onClick={() => setInvoiceStatus(s)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  invoiceStatus === s
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-muted-foreground border-border hover:border-accent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice date range filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 items-center">
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={invDateFrom}
              onChange={e => setInvDateFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              value={invDateTo}
              onChange={e => setInvDateTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          {hasInvFilters && (
            <button
              onClick={() => { setInvoiceStatus('ALL'); setInvDateFrom(''); setInvDateTo('') }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear
            </button>
          )}
        </div>

        {filteredInvoices.length === 0 ? (
          <p className="text-muted-foreground">
            {invoices.length === 0 ? 'No invoices on record.' : 'No invoices match the selected filters.'}
          </p>
        ) : (
          <>
          <div className="bg-white border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium">Description</th>
                  <th className="py-2.5 px-3 font-medium">Amount</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium" />
                  {paynowMobile && <th className="py-2.5 px-3 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 max-w-xs truncate text-primary">{inv.description}</td>
                    <td className="py-2.5 px-3 font-medium text-primary">S${Number(inv.amount_sgd).toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      {inv.status === 'PAID' ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Paid {inv.payment_method ? `(${inv.payment_method})` : ''}
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 text-xs">Unpaid</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {inv.created_at.split('T')[0]}
                    </td>
                    <td className="py-2.5 px-3">
                      {inv.booking_id && (
                        <a
                          href={`/api/bookings/${inv.booking_id}/work-order-pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent underline hover:no-underline"
                        >
                          View PDF
                        </a>
                      )}
                    </td>
                    {paynowMobile && (
                      <td className="py-2.5 px-3">
                        {inv.status === 'UNPAID' && (
                          <button
                            onClick={() => setPaynowInvoice(inv)}
                            className="text-xs text-accent underline hover:no-underline"
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PayNow Dialog */}
          {paynowMobile && paynowInvoice && (
            <Dialog open={!!paynowInvoice} onOpenChange={(open) => { if (!open) setPaynowInvoice(null) }}>
              <DialogContent className="max-w-sm text-center">
                <DialogHeader>
                  <DialogTitle>Pay via PayNow</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {(() => {
                    const ref = `HW-${paynowInvoice.id.slice(-8).toUpperCase()}`
                    const amount = Number(paynowInvoice.amount_sgd)
                    const qrValue = buildPayNowPayload(paynowMobile, amount, ref)
                    return (
                      <>
                        <div className="flex justify-center">
                          <QRCodeSVG value={qrValue} size={180} />
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">PayNow number</p>
                          <p className="font-bold text-xl tracking-wider text-primary">{paynowMobile}</p>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-bold text-lg text-primary">S${amount.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">Reference</p>
                          <p className="font-mono font-semibold text-primary">{ref}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Open your banking app, scan the QR code, and transfer S${amount.toFixed(2)} with reference <strong>{ref}</strong>.
                        </p>
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => setPaynowInvoice(null)}
                        >
                          Done
                        </Button>
                      </>
                    )
                  })()}
                </div>
              </DialogContent>
            </Dialog>
          )}
          </>
        )}
      </div>
    </div>
  )
}
