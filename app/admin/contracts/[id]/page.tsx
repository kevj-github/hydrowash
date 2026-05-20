'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ServiceDateRow from '@/components/admin/ServiceDateRow'
import InvoiceRow from '@/components/admin/InvoiceRow'
import {
  ContractWithDetails,
  ContractServiceDateWithBooking,
  InvoiceWithCustomer,
} from '@/lib/types'
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
import Link from 'next/link'

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [contract, setContract] = useState<ContractWithDetails | null>(null)
  const [serviceDates, setServiceDates] = useState<ContractServiceDateWithBooking[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])
  const [availableBookings, setAvailableBookings] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [setPriceOpen, setSetPriceOpen] = useState(false)
  const [settingPrice, setSettingPrice] = useState(false)
  const [setPriceForm, setSetPriceForm] = useState({ price_sgd: '', start_date: '', notes: '' })
  const [setPriceSaved, setSetPriceSaved] = useState(false)
  const [sendingPdf, setSendingPdf] = useState(false)

  const [markingPaid, setMarkingPaid] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    price_sgd: '',
    notes: '',
    address: '',
    start_date: '',
    end_date: '',
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function fetchData() {
    setLoading(true)
    const { data: contractData } = await supabase
      .from('contracts')
      .select(`
        *,
        customer:profiles!contracts_customer_id_fkey (id, name, phone),
        contract_service_dates (
          id, contract_id, due_date, due_month, reminder_sent, second_reminder_sent, booking_id,
          booking:bookings!contract_service_dates_booking_id_fkey (
            id, status, confirmed_date, address
          )
        ),
        invoices (
          id, customer_id, booking_id, contract_id, amount_sgd,
          description, status, payment_method, paid_at, created_at
        )
      `)
      .eq('id', id)
      .single()

    if (contractData) {
      setContract(contractData as ContractWithDetails)
      setServiceDates(
        (contractData.contract_service_dates ?? []).sort(
          (a: ContractServiceDateWithBooking, b: ContractServiceDateWithBooking) =>
            a.due_date.localeCompare(b.due_date)
        )
      )
      setInvoices(contractData.invoices ?? [])
      setSetPriceForm(f => ({
        ...f,
        start_date: f.start_date || contractData.start_date,
        notes: f.notes || contractData.notes || '',
      }))
      setEditForm({
        price_sgd: contractData.price_sgd != null ? String(contractData.price_sgd) : '',
        notes: contractData.notes || '',
        address: contractData.address || '',
        start_date: contractData.start_date,
        end_date: contractData.end_date,
      })
    }

    if (contractData?.customer_id) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, address, confirmed_date, status')
        .eq('customer_id', contractData.customer_id)
        .in('status', ['APPROVED', 'COMPLETED'])
        .order('confirmed_date', { ascending: false })

      setAvailableBookings(
        (bookings ?? []).map((b) => ({
          id: b.id,
          label: `${b.confirmed_date ?? 'TBD'} — ${b.address}`,
        }))
      )
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  async function handleLinkBooking(serviceDateId: string, bookingId: string) {
    const res = await fetch(`/api/contracts/${id}/link-booking`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_date_id: serviceDateId, booking_id: bookingId }),
    })
    if (res.ok) {
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleSetPrice(e: React.FormEvent) {
    e.preventDefault()
    setSettingPrice(true)
    const res = await fetch(`/api/contracts/${id}/set-price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setPriceForm),
    })
    setSettingPrice(false)
    if (res.ok) {
      setSetPriceSaved(true)
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleSendContractPdf() {
    setSendingPdf(true)
    const res = await fetch(`/api/contracts/${id}/send-contract-pdf`, { method: 'POST' })
    setSendingPdf(false)
    if (res.ok) {
      setSetPriceOpen(false)
      setSetPriceSaved(false)
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleMarkPaid() {
    if (!confirm('Mark this contract as paid and activate it? This will generate the service schedule and notify the customer.')) return
    setMarkingPaid(true)
    const res = await fetch(`/api/contracts/${id}/mark-paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setMarkingPaid(false)
    if (res.ok) {
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditing(true)
    const body: Record<string, string | number> = {}
    if (editForm.price_sgd) body.price_sgd = parseFloat(editForm.price_sgd)
    if (editForm.notes !== undefined) body.notes = editForm.notes
    if (editForm.address !== undefined) body.address = editForm.address
    if (editForm.start_date) body.start_date = editForm.start_date
    if (editForm.end_date) body.end_date = editForm.end_date

    const res = await fetch(`/api/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditing(false)
    if (res.ok) {
      setEditOpen(false)
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteOpen(false)
    if (res.ok) {
      const body = await res.json()
      if (body.deleted) {
        router.push('/admin/contracts')
      } else {
        fetchData()
      }
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!contract) return <div className="p-8 text-red-600">Contract not found.</div>

  const statusColors: Record<string, string> = {
    PENDING_REVIEW: 'bg-amber-100 text-amber-800',
    AWAITING_PAYMENT: 'bg-orange-100 text-orange-800',
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  const statusLabels: Record<string, string> = {
    PENDING_REVIEW: 'Pending Review',
    AWAITING_PAYMENT: 'Awaiting Payment',
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  }

  const isPending = contract.status === 'PENDING_REVIEW'
  const isAwaitingPayment = contract.status === 'AWAITING_PAYMENT'
  const isEditable = contract.status !== 'CANCELLED'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/contracts">
          <Button variant="ghost" size="sm">&larr; Back</Button>
        </Link>
        <h1 className="font-heading text-2xl font-bold text-primary">
          Contract — {contract.customer.name}
        </h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[contract.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {statusLabels[contract.status] ?? contract.status}
        </span>
      </div>

      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800">Customer-requested contract</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Review the details and set a price. An email with PayNow QR will be sent to the customer.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={setPriceOpen} onOpenChange={(o) => { setSetPriceOpen(o); if (!o) setSetPriceSaved(false) }}>
              <DialogTrigger className={cn(buttonVariants(), 'bg-green-600 text-white hover:bg-green-700')}>
                Set Price
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{setPriceSaved ? 'Preview & Send Contract' : 'Set Contract Price'}</DialogTitle>
                </DialogHeader>
                {!setPriceSaved ? (
                  <form onSubmit={handleSetPrice} className="space-y-4 pt-2">
                    <div>
                      <Label>Price (SGD / year)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={setPriceForm.price_sgd}
                        onChange={e => setSetPriceForm(f => ({ ...f, price_sgd: e.target.value }))}
                        required
                        placeholder="e.g. 480.00"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Confirmed start date</Label>
                      <Input
                        type="date"
                        value={setPriceForm.start_date}
                        onChange={e => setSetPriceForm(f => ({ ...f, start_date: e.target.value }))}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Notes for customer (optional)</Label>
                      <Textarea
                        value={setPriceForm.notes}
                        onChange={e => setSetPriceForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                    <Button type="submit" disabled={settingPrice} className="w-full bg-green-600 text-white hover:bg-green-700">
                      {settingPrice ? 'Saving…' : 'Save & Preview PDF'}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">Price saved. Preview the contract PDF before sending to the customer.</p>
                    <a
                      href={`/api/contracts/${id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
                    >
                      Preview Contract PDF ↗
                    </a>
                    <Button
                      onClick={handleSendContractPdf}
                      disabled={sendingPdf}
                      className="w-full bg-green-600 text-white hover:bg-green-700"
                    >
                      {sendingPdf ? 'Sending…' : 'Confirm & Send to Customer'}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => { setDeleteOpen(true) }}
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {isAwaitingPayment && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-orange-800">Awaiting payment</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Contract sent to customer. Mark as paid once you confirm the transfer.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href={`/api/contracts/${id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Preview PDF ↗
            </a>
            <Button
              variant="outline"
              onClick={handleSendContractPdf}
              disabled={sendingPdf}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {sendingPdf ? 'Sending…' : 'Resend Contract Email'}
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={markingPaid}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {markingPaid ? 'Activating…' : 'Mark Paid & Activate'}
            </Button>
          </div>
        </div>
      )}

      {isEditable && (
        <div className="flex gap-2 flex-wrap">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'text-primary')}>
              Edit Contract
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Contract</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4 pt-2">
                <div>
                  <Label>Price (SGD / year)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.price_sgd}
                    onChange={e => setEditForm(f => ({ ...f, price_sgd: e.target.value }))}
                    placeholder="e.g. 480.00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={editForm.address}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Service address (optional)"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={editForm.start_date}
                    onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={editForm.end_date}
                    onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={editing}
                  className="w-full bg-accent text-white hover:bg-accent/90"
                >
                  {editing ? 'Saving…' : 'Save Changes'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'border-red-300 text-red-600 hover:bg-red-50')}>
              {contract.status === 'CANCELLED' ? 'Delete' : 'Deactivate'}
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>
                  {contract.status === 'CANCELLED' ? 'Delete Contract?' : 'Deactivate Contract?'}
                </DialogTitle>
              </DialogHeader>
              <div className="pt-2 space-y-4">
                <p className="text-sm text-gray-600">
                  {contract.status === 'CANCELLED'
                    ? 'This will permanently delete the contract and all associated service dates.'
                    : 'This will cancel the contract. The customer will no longer have an active maintenance plan.'}
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    {deleting ? 'Processing…' : contract.status === 'CANCELLED' ? 'Delete' : 'Deactivate'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <section className="bg-white border rounded-xl p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-primary mb-3">Contract Terms</h2>
        <div className="grid grid-cols-2 gap-y-1 gap-x-4">
          <span className="text-gray-500">Customer</span>
          <span>{contract.customer.name} · {contract.customer.phone}</span>
          <span className="text-gray-500">Units</span>
          <span>{contract.num_units}</span>
          <span className="text-gray-500">Price</span>
          <span>{contract.price_sgd != null ? `S$${Number(contract.price_sgd).toFixed(2)} / year` : 'TBD'}</span>
          <span className="text-gray-500">Period</span>
          <span>{contract.start_date} → {contract.end_date}</span>
          <span className="text-gray-500">Service interval</span>
          <span>Every {contract.service_interval_months} months</span>
          {contract.address && (
            <>
              <span className="text-gray-500">Address</span>
              <span>{contract.address}</span>
            </>
          )}
          {contract.notes && (
            <>
              <span className="text-gray-500">Notes</span>
              <span>{contract.notes}</span>
            </>
          )}
        </div>
      </section>

      {serviceDates.length > 0 && (
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold text-primary mb-3">Service Schedule</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-200">
                <th className="py-1 px-3">Visit</th>
                <th className="py-1 px-3">Due Date</th>
                <th className="py-1 px-3">Booking</th>
                <th className="py-1 px-3">Status</th>
                <th className="py-1 px-3">Reminder</th>
                <th className="py-1 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {serviceDates.map((sd, i) => (
                <ServiceDateRow
                  key={sd.id}
                  index={i}
                  serviceDate={sd}
                  contractId={id}
                  availableBookings={availableBookings}
                  onLink={handleLinkBooking}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-primary">Invoices</h2>
          <Link href={`/admin/invoices?contract_id=${id}`}>
            <Button size="sm" variant="outline">+ New Invoice</Button>
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400">No invoices yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-200">
                <th className="py-1 px-3">Description</th>
                <th className="py-1 px-3">Amount</th>
                <th className="py-1 px-3">Status</th>
                <th className="py-1 px-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv as InvoiceWithCustomer}
                  onPaid={() => fetchData()}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
