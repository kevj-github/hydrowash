'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ServiceDateRow from '@/components/admin/ServiceDateRow'
import InvoiceRow from '@/components/admin/InvoiceRow'
import {
  ContractWithDetails,
  ContractServiceDateWithBooking,
  InvoiceWithCustomer,
} from '@/lib/types'
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
import Link from 'next/link'

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [contract, setContract] = useState<ContractWithDetails | null>(null)
  const [serviceDates, setServiceDates] = useState<ContractServiceDateWithBooking[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([])
  const [availableBookings, setAvailableBookings] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Activate dialog state
  const [activateOpen, setActivateOpen] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activateForm, setActivateForm] = useState({
    price_sgd: '',
    start_date: '',
    notes: '',
  })

  // Cancel state
  const [cancelling, setCancelling] = useState(false)

  async function fetchData() {
    setLoading(true)

    const { data: contractData } = await supabase
      .from('contracts')
      .select(`
        *,
        customer:profiles!contracts_customer_id_fkey (id, name, phone),
        contract_service_dates (
          id, contract_id, due_date, reminder_sent, booking_id,
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
      // Pre-fill activate form from contract data
      setActivateForm(f => ({
        ...f,
        start_date: f.start_date || contractData.start_date,
        notes: f.notes || contractData.notes || '',
      }))
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

  useEffect(() => {
    fetchData()
  }, [id])

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

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    setActivating(true)
    const res = await fetch(`/api/contracts/${id}/activate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activateForm),
    })
    setActivating(false)
    if (res.ok) {
      setActivateOpen(false)
      fetchData()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this contract request?')) return
    setCancelling(true)
    const { error } = await supabase
      .from('contracts')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
    setCancelling(false)
    if (!error) {
      fetchData()
    } else {
      alert(`Error: ${error.message}`)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!contract) return <div className="p-8 text-red-600">Contract not found.</div>

  const statusColors: Record<string, string> = {
    PENDING_REVIEW: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-700',
  }

  const statusLabels: Record<string, string> = {
    PENDING_REVIEW: 'Pending Review',
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
  }

  const isPending = contract.status === 'PENDING_REVIEW'

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

      {/* Pending Review CTA */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800">Customer-requested contract</p>
            <p className="text-sm text-amber-700 mt-0.5">Review the details, set a price, and activate to generate the service schedule.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
              <DialogTrigger>
                <Button className="bg-green-600 text-white hover:bg-green-700">
                  Activate Contract
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Activate Contract</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleActivate} className="space-y-4 pt-2">
                  <div>
                    <Label>Price (SGD / year)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={activateForm.price_sgd}
                      onChange={e => setActivateForm(f => ({ ...f, price_sgd: e.target.value }))}
                      required
                      placeholder="e.g. 480.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Confirmed start date</Label>
                    <Input
                      type="date"
                      value={activateForm.start_date}
                      onChange={e => setActivateForm(f => ({ ...f, start_date: e.target.value }))}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Notes for customer (optional)</Label>
                    <Textarea
                      value={activateForm.notes}
                      onChange={e => setActivateForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={activating}
                    className="w-full bg-green-600 text-white hover:bg-green-700"
                  >
                    {activating ? 'Activating…' : 'Activate & Send Email'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Reject'}
            </Button>
          </div>
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
