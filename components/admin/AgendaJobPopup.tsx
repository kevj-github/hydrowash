'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JobCompletionDialog } from '@/components/admin/JobCompletionDialog'
import { SLOT_LABELS } from '@/lib/types'
import type { BookingWithRelations, TimeSlot } from '@/lib/types'

interface Props {
  booking: BookingWithRelations
  onClose: () => void
  onUpdated: () => void
}

const statusColor: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

export function AgendaJobPopup({ booking, onClose, onUpdated }: Props) {
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  async function confirmCancel() {
    setCancelling(true)
    try {
      await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancel_reason: cancelReason || undefined }),
      })
    } finally {
      setCancelling(false)
      onUpdated()
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{booking.customer?.name ?? 'Customer'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[booking.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {booking.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium text-primary text-right">{booking.service_type?.name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Date / Slot</span>
            <span className="font-medium text-primary text-right">
              {booking.confirmed_date ?? '—'}
              {booking.confirmed_slot ? ` · ${SLOT_LABELS[booking.confirmed_slot as TimeSlot] ?? booking.confirmed_slot}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium text-primary">{booking.customer?.phone ?? '—'}</span>
          </div>
          {booking.address && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground shrink-0">Address</span>
              <span className="font-medium text-primary text-right">{booking.address}</span>
            </div>
          )}
          {booking.num_units && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Units</span>
              <span className="font-medium text-primary">{booking.num_units}</span>
            </div>
          )}
          {booking.fault_description && (
            <div className="bg-slate-50 rounded p-2 text-slate-600 text-xs">{booking.fault_description}</div>
          )}
          {booking.notes && (
            <div className="bg-slate-50 rounded p-2 text-slate-600 text-xs">{booking.notes}</div>
          )}
        </div>

        {booking.status === 'APPROVED' && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex gap-2">
              <div className="flex-1">
                <JobCompletionDialog booking={booking} onSuccess={onUpdated} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setShowCancel(v => !v)}
                disabled={cancelling}
              >
                Cancel
              </Button>
            </div>
            {showCancel && (
              <div className="space-y-1.5">
                <Input
                  placeholder="Reason (optional)"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="text-xs h-7"
                />
                <Button
                  size="sm"
                  className="w-full bg-red-600 hover:bg-red-700 text-white text-xs"
                  onClick={confirmCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
