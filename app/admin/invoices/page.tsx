'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import InvoiceRow from '@/components/admin/InvoiceRow'
import { InvoiceWithCustomer, CreateInvoicePayload, PaymentMethod } from '@/lib/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { SlidersHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'PayNow', 'Bank Transfer', 'Other']

function MobileInvoiceCard({ invoice, onPaid }: { invoice: InvoiceWithCustomer; onPaid: () => void }) {
  const [open, setOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [submitting, setSubmitting] = useState(false)

  async function handleMarkPaid() {
    setSubmitting(true)
    const res = await fetch(`/api/invoices/${invoice.id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: paymentMethod }),
    })
    setSubmitting(false)
    if (res.ok) {
      setOpen(false)
      onPaid()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <div className="bg-white border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">{invoice.customer?.name ?? '—'}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>{invoice.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">{invoice.customer?.phone}</p>
      <p className="text-xs text-muted-foreground">{invoice.description}</p>
      {invoice.contract_id && (
        <p className="text-[10px] text-accent">Contract linked</p>
      )}
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm font-bold text-primary">S${Number(invoice.amount_sgd ?? 0).toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">Created {invoice.created_at.split('T')[0]}</p>
      </div>
      {invoice.paid_at && (
        <p className="text-xs text-muted-foreground">Paid {invoice.paid_at.split('T')[0]} · {invoice.payment_method}</p>
      )}
      <div className="flex gap-2 pt-1">
        {invoice.booking_id && (
          <a
            href={`/api/bookings/${invoice.booking_id}/work-order-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'text-xs flex-1')}
          >
            View PDF
          </a>
        )}
        {invoice.status === 'UNPAID' && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'text-green-700 border-green-300 hover:bg-green-50 text-xs flex-1')}>
              Mark Paid
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Mark Invoice as Paid</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {invoice.description} — S${Number(invoice.amount_sgd).toFixed(2)}
                </p>
                <div>
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select value={paymentMethod} onValueChange={v => setPaymentMethod((v ?? 'Cash') as PaymentMethod)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue>{paymentMethod}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleMarkPaid} disabled={submitting} className="w-full bg-green-600 text-white hover:bg-green-700">
                  {submitting ? 'Saving…' : 'Confirm Payment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

function AdminInvoicesContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const preselectedContractId = searchParams.get('contract_id') ?? ''

  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // List filters
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [paidFrom, setPaidFrom] = useState('')
  const [paidTo, setPaidTo] = useState('')

  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([])
  const [contracts, setContracts] = useState<{ id: string; label: string }[]>([])
  const [bookings, setBookings] = useState<{ id: string; label: string }[]>([])

  // Create dialog combobox state
  const [invoiceCustomerSearch, setInvoiceCustomerSearch] = useState('')
  const [invoiceComboOpen, setInvoiceComboOpen] = useState(false)
  const invoiceComboRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState<{
    customer_id: string
    booking_id: string
    contract_id: string
    amount_sgd: string
    description: string
  }>({
    customer_id: '',
    booking_id: '',
    contract_id: preselectedContractId,
    amount_sgd: '',
    description: '',
  })

  async function fetchInvoices() {
    setLoading(true)
    const res = await fetch('/api/invoices')
    const json = await res.json()
    setInvoices(json.invoices ?? [])
    setLoading(false)
  }

  async function fetchLookupData() {
    const [{ data: custs }, { data: conts }, { data: bkgs }] = await Promise.all([
      supabase.from('profiles').select('id, name, phone').eq('role', 'customer').order('name'),
      supabase
        .from('contracts')
        .select('id, customer_id, start_date, end_date')
        .eq('status', 'ACTIVE')
        .order('start_date', { ascending: false }),
      supabase
        .from('bookings')
        .select('id, address, confirmed_date, status')
        .in('status', ['APPROVED', 'COMPLETED'])
        .order('confirmed_date', { ascending: false })
        .limit(100),
    ])
    setCustomers(custs ?? [])
    setContracts(
      (conts ?? []).map((c) => ({
        id: c.id,
        label: `${c.start_date} → ${c.end_date} (${c.customer_id.slice(0, 6)}…)`,
      }))
    )
    setBookings(
      (bkgs ?? []).map((b) => ({
        id: b.id,
        label: `${b.confirmed_date ?? 'TBD'} — ${b.address}`,
      }))
    )
  }

  // Close combobox on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (invoiceComboRef.current && !invoiceComboRef.current.contains(e.target as Node)) {
        setInvoiceComboOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [])

  useEffect(() => {
    fetchLookupData()
  }, [])

  const filteredInvoiceCustomers = customers
    .filter(c =>
      !invoiceCustomerSearch ||
      c.name.toLowerCase().includes(invoiceCustomerSearch.toLowerCase()) ||
      c.phone.includes(invoiceCustomerSearch)
    )
    .slice(0, 8)

  const selectedInvoiceCustomer = customers.find(c => c.id === form.customer_id)

  const hasListFilters = invoiceSearch || createdFrom || createdTo || paidFrom || paidTo || statusFilter !== 'ALL'

  const filteredInvoices = invoices.filter(inv => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
    if (invoiceSearch) {
      const q = invoiceSearch.toLowerCase()
      if (!inv.customer.name.toLowerCase().includes(q) && !inv.customer.phone.includes(invoiceSearch)) return false
    }
    const created = inv.created_at.split('T')[0]
    if (createdFrom && created < createdFrom) return false
    if (createdTo && created > createdTo) return false
    if (paidFrom || paidTo) {
      const paid = inv.paid_at?.split('T')[0] ?? null
      if (!paid) return false
      if (paidFrom && paid < paidFrom) return false
      if (paidTo && paid > paidTo) return false
    }
    return true
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const payload: CreateInvoicePayload = {
      customer_id: form.customer_id,
      booking_id: form.booking_id || undefined,
      contract_id: form.contract_id || undefined,
      amount_sgd: parseFloat(form.amount_sgd),
      description: form.description,
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)

    if (res.ok) {
      setDialogOpen(false)
      setForm({ customer_id: '', booking_id: '', contract_id: '', amount_sgd: '', description: '' })
      setInvoiceCustomerSearch('')
      fetchInvoices()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-2xl text-primary">
          Invoices <span className="text-muted-foreground font-normal text-base">· {filteredInvoices.length}</span>
        </h1>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              setInvoiceCustomerSearch('')
              setInvoiceComboOpen(false)
            }
          }}
        >
          <DialogTrigger className={cn(buttonVariants(), 'bg-accent text-white hover:bg-accent/90')}>
            + New Invoice
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Customer search combobox */}
              <div>
                <Label>Customer</Label>
                <div ref={invoiceComboRef} className="relative mt-1">
                  <input
                    type="text"
                    placeholder="Search by name or phone…"
                    value={invoiceComboOpen ? invoiceCustomerSearch : selectedInvoiceCustomer ? `${selectedInvoiceCustomer.name} (${selectedInvoiceCustomer.phone})` : ''}
                    onFocus={() => {
                      setInvoiceComboOpen(true)
                      setInvoiceCustomerSearch('')
                    }}
                    onChange={e => setInvoiceCustomerSearch(e.target.value)}
                    required={!form.customer_id}
                    className="w-full h-9 px-3 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                  {invoiceComboOpen && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-md border border-border shadow-lg max-h-48 overflow-y-auto">
                      {filteredInvoiceCustomers.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-400">No customers found.</p>
                      ) : (
                        filteredInvoiceCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                              form.customer_id === c.id ? 'bg-blue-50 text-accent' : 'text-[#0F172A]'
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setForm(f => ({ ...f, customer_id: c.id }))
                              setInvoiceComboOpen(false)
                              setInvoiceCustomerSearch('')
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
                {form.customer_id && !invoiceComboOpen && (
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-600 mt-1 underline"
                    onClick={() => {
                      setForm(f => ({ ...f, customer_id: '' }))
                      setInvoiceCustomerSearch('')
                    }}
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <div>
                <Label>Link to Contract (optional)</Label>
                <Select
                  value={form.contract_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, contract_id: v ?? '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None">
                      {form.contract_id
                        ? contracts.find((c) => c.id === form.contract_id)?.label ?? 'None'
                        : 'None'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Link to Booking (optional)</Label>
                <Select
                  value={form.booking_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, booking_id: v ?? '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None">
                      {form.booking_id
                        ? bookings.find((b) => b.id === form.booking_id)?.label ?? 'None'
                        : 'None'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {bookings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount (SGD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount_sgd}
                  onChange={(e) => setForm((f) => ({ ...f, amount_sgd: e.target.value }))}
                  required
                  placeholder="e.g. 120.00"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                  placeholder="e.g. General Cleaning × 3 units"
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || !form.customer_id}
                className="w-full bg-accent text-white hover:bg-accent/90"
              >
                {submitting ? 'Saving…' : 'Create Invoice'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* List filters */}
      <div className="space-y-3 bg-white border border-border rounded-xl p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search by customer name or phone…"
            value={invoiceSearch}
            onChange={e => setInvoiceSearch(e.target.value)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Created date</p>
            <div className="flex gap-1 items-center">
              <Input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} className="h-8 text-xs flex-1" />
              <span className="text-xs text-slate-400">–</span>
              <Input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Paid date</p>
            <div className="flex gap-1 items-center">
              <Input type="date" value={paidFrom} onChange={e => setPaidFrom(e.target.value)} className="h-8 text-xs flex-1" />
              <span className="text-xs text-slate-400">–</span>
              <Input type="date" value={paidTo} onChange={e => setPaidTo(e.target.value)} className="h-8 text-xs flex-1" />
            </div>
          </div>
        </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {['ALL', 'UNPAID', 'PAID'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  statusFilter === s
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-muted-foreground border-border hover:border-accent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {hasListFilters && (
            <button
              onClick={() => { setInvoiceSearch(''); setCreatedFrom(''); setCreatedTo(''); setPaidFrom(''); setPaidTo(''); setStatusFilter('ALL') }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filteredInvoices.length === 0 ? (
        <p className="text-muted-foreground">No invoices found.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Created</th>
                  <th className="py-2 px-3">Paid</th>
                  <th className="py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv, idx) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    onPaid={fetchInvoices}
                    showCustomer
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/40'}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filteredInvoices.map(inv => (
              <MobileInvoiceCard key={inv.id} invoice={inv} onPaid={fetchInvoices} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function AdminInvoicesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <AdminInvoicesContent />
    </Suspense>
  )
}
