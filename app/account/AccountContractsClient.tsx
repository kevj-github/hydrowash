'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface ServiceDate {
  id: string
  due_date: string
  reminder_sent: boolean
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
}

interface Props {
  contracts: Contract[]
  invoices: Invoice[]
  profileAddress: string | null
  pricingTiers: ContractPricingTier[]
  paynowMobile: string | null
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
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

export function AccountContractsClient({ contracts, invoices, profileAddress, pricingTiers, paynowMobile }: Props) {
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
  const [form, setForm] = useState({
    num_units: '',
    address: profileAddress ?? '',
    preferred_month: '',
    notes: '',
  })

  const today = new Date().toISOString().split('T')[0]

  const filteredContracts = contracts
    .filter(c => contractStatus === 'ALL' || c.status === contractStatus)
    // PENDING_REVIEW at the top
    .sort((a, b) => {
      if (a.status === 'PENDING_REVIEW' && b.status !== 'PENDING_REVIEW') return -1
      if (b.status === 'PENDING_REVIEW' && a.status !== 'PENDING_REVIEW') return 1
      return 0
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
        address: form.address || undefined,
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
        setForm({ num_units: '', address: profileAddress ?? '', preferred_month: '', notes: '' })
        // Reload to show the new pending contract
        window.location.reload()
      }, 1500)
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">

      {/* Contracts section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading font-bold text-2xl text-primary">My Contracts</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'ACTIVE', 'PENDING_REVIEW', 'EXPIRED', 'CANCELLED'].map(s => (
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
                if (!open) {
                  setSubmitted(false)
                  setForm({ num_units: '', address: profileAddress ?? '', preferred_month: '', notes: '' })
                }
              }}
            >
              <DialogTrigger>
                <Button size="sm" className="bg-accent text-white hover:bg-accent/90">
                  + Request Contract
                </Button>
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
                  <form onSubmit={handleRequest} className="space-y-4 pt-2">
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

                    <div>
                      <Label>Service address</Label>
                      <Input
                        type="text"
                        value={form.address}
                        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="e.g. 52 Jurong West Street 52, Singapore"
                        className="mt-1"
                      />
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
                      <Label>Notes (optional)</Label>
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
          <p className="text-muted-foreground">
            {contracts.length === 0
              ? 'You have no maintenance contracts yet. Request one to get started.'
              : 'No contracts match the selected filter.'}
          </p>
        ) : (
          <div className="space-y-6">
            {filteredContracts.map((contract) => {
              const sortedDates = [...(contract.contract_service_dates ?? [])].sort(
                (a, b) => a.due_date.localeCompare(b.due_date)
              )
              const isPending = contract.status === 'PENDING_REVIEW'
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
                            const isPast = sd.due_date < today
                            const isCompleted = !!sd.booking_id
                            return (
                              <tr key={sd.id} className="border-b border-border/50">
                                <td className="py-1.5 text-muted-foreground">Visit {i + 1}</td>
                                <td className="py-1.5 text-primary">{sd.due_date}</td>
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
