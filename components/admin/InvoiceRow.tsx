'use client'

import { useState } from 'react'
import { InvoiceWithCustomer, PaymentMethod } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

interface Props {
  invoice: InvoiceWithCustomer
  onPaid: () => void
  showCustomer?: boolean
  className?: string
}

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'PayNow', 'Bank Transfer', 'Other']

export default function InvoiceRow({ invoice, onPaid, showCustomer = false, className }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
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
      setDialogOpen(false)
      onPaid()
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  return (
    <tr className={cn('border-b border-border/50 text-sm hover:bg-accent/5 transition-colors', className)}>
      {showCustomer && (
        <td className="py-2 px-3 font-medium">{invoice.customer?.name ?? '—'}</td>
      )}
      <td className="py-2 px-3 max-w-xs truncate">{invoice.description}</td>
      <td className="py-2 px-3 font-medium">S${Number(invoice.amount_sgd).toFixed(2)}</td>
      <td className="py-2 px-3">
        {invoice.status === 'PAID' ? (
          <Badge className="bg-green-100 text-green-800">Paid</Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-800">Unpaid</Badge>
        )}
      </td>
      <td className="py-2 px-3 text-muted-foreground">
        {invoice.created_at.split('T')[0]}
      </td>
      <td className="py-2 px-3 text-muted-foreground">
        {invoice.paid_at ? invoice.paid_at.split('T')[0] : '—'}
      </td>
      <td className="py-2 px-3">
        <div className="flex gap-1.5 flex-wrap">
        {invoice.booking_id && (
          <a
            href={`/api/bookings/${invoice.booking_id}/work-order-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'text-xs')}
          >
            View PDF
          </a>
        )}
        {invoice.status === 'UNPAID' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'text-green-700 border-green-300 hover:bg-green-50')}>
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
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod((v ?? 'Cash') as PaymentMethod)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue>
                        {paymentMethod}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleMarkPaid}
                  disabled={submitting}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  {submitting ? 'Saving…' : 'Confirm Payment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {invoice.status === 'PAID' && (
          <span className="text-xs text-muted-foreground">{invoice.payment_method}</span>
        )}
        </div>
      </td>
    </tr>
  )
}
