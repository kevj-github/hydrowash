'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JobCompletionDialog } from '@/components/admin/JobCompletionDialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'
import { SLOT_LABELS, SLOT_KEYS } from '@/lib/types'
import type { BookingWithRelations, TimeSlot } from '@/lib/types'

interface Props {
  booking: BookingWithRelations
  onUpdate: () => void
  highlighted?: boolean
  onCardClick?: () => void
  contractVisitInfo?: { visitNo: number; totalVisits: number }
  selected: boolean
  onToggleSelect: () => void
  onDeleteClick: () => void
}

const urgencyColor: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-green-100 text-green-800',
}

const statusColor: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-slate-100 text-slate-600',
}

const statusBorderStrip: Record<string, string> = {
  PENDING: 'border-l-amber-400',
  APPROVED: 'border-l-green-500',
  COMPLETED: 'border-l-slate-300',
  REJECTED: 'border-l-slate-300',
  CANCELLED: 'border-l-slate-300',
}

export function BookingCard({ booking, onUpdate, highlighted, onCardClick, contractVisitInfo, selected, onToggleSelect, onDeleteClick }: Props) {
  const [confirmedDate, setConfirmedDate] = useState(booking.confirmed_date ?? '')
  const [confirmedSlot, setConfirmedSlot] = useState<string>(booking.confirmed_slot ?? '')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  const preferredDateSlots = booking.preferred_date_slots ?? []

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    try {
      await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          confirmed_date: confirmedDate || undefined,
          confirmed_slot: confirmedSlot || undefined,
          rejection_reason: rejectionReason || undefined,
        }),
      })
    } finally {
      setLoading(null)
      setShowReject(false)
      onUpdate()
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border border-l-4 p-4 transition-colors ${statusBorderStrip[booking.status] ?? 'border-l-slate-300'} ${highlighted ? 'border-accent bg-blue-50' : 'border-border'} ${onCardClick ? 'cursor-pointer' : ''}`}
      onClick={() => onCardClick?.()}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2">
          <div onClick={e => e.stopPropagation()} className="pt-0.5">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select booking for ${booking.customer.name}`} />
          </div>
          <div>
            <p className="font-heading font-semibold text-primary text-sm">{booking.customer.name}</p>
            <p className="text-xs text-slate-500">{booking.customer.phone}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 justify-end items-start">
          {booking.contract_id && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              Contract{contractVisitInfo ? ` · Visit ${contractVisitInfo.visitNo}/${contractVisitInfo.totalVisits}` : ''}
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[booking.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {booking.status}
          </span>
          {booking.urgency && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgencyColor[booking.urgency]}`}>
              {booking.urgency}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDeleteClick() }}
            aria-label={`Delete booking for ${booking.customer.name}`}
            className="text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-sm font-medium text-accent mb-1">{booking.service_type.name}</p>
      <p className="text-xs text-slate-500 mb-1">{booking.address}, S{booking.postal_code}</p>

      {preferredDateSlots.length > 0 && (
        <div className="mb-1 space-y-0.5">
          <p className="text-xs text-slate-500">Preferred:</p>
          {preferredDateSlots.map(ds => (
            <div key={ds.date} className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-slate-600 font-medium">
                {new Date(ds.date + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {ds.slots.map(s => (
                <span key={s} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {SLOT_LABELS[s as TimeSlot]}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {booking.confirmed_date && (
        <p className="text-xs font-semibold text-accent mb-2">
          Confirmed: {booking.confirmed_date}
          {booking.confirmed_slot ? ` · ${SLOT_LABELS[booking.confirmed_slot as TimeSlot] ?? booking.confirmed_slot}` : ''}
        </p>
      )}

      {booking.fault_description && (
        <p className="text-xs bg-slate-50 rounded p-2 mb-3 text-slate-600">{booking.fault_description}</p>
      )}

      {booking.status === 'PENDING' && (
        <div className="space-y-2" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Confirmed Date</Label>
              <Input
                type="date"
                value={confirmedDate}
                defaultValue={booking.booking_date ?? ''}
                onChange={e => setConfirmedDate(e.target.value)}
                className="h-7 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Confirmed Slot</Label>
              <Select value={confirmedSlot} onValueChange={v => setConfirmedSlot(v ?? '')}>
                <SelectTrigger className="h-7 text-xs mt-1">
                  <SelectValue placeholder="Pick slot…">
                    {confirmedSlot ? (SLOT_LABELS[confirmedSlot as TimeSlot] ?? confirmedSlot) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SLOT_KEYS.map(s => (
                    <SelectItem key={s} value={s}>{SLOT_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-accent hover:bg-accent/90 text-white text-xs"
              onClick={() => act('approve')}
              disabled={!confirmedDate || !confirmedSlot || !!loading}
            >
              {loading === 'approve' ? '…' : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setShowReject(v => !v)}
              disabled={!!loading}
            >
              Reject
            </Button>
          </div>
          {showReject && (
            <div className="space-y-1.5">
              <Input
                placeholder="Reason (optional)"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="text-xs h-7"
              />
              <Button
                size="sm"
                className="w-full bg-red-600 hover:bg-red-700 text-white text-xs"
                onClick={() => act('reject')}
                disabled={!!loading}
              >
                {loading === 'reject' ? '…' : 'Confirm Rejection'}
              </Button>
            </div>
          )}
        </div>
      )}

      {booking.status === 'APPROVED' && (
        <div onClick={e => e.stopPropagation()}>
          <JobCompletionDialog booking={booking} onSuccess={onUpdate} />
        </div>
      )}
    </div>
  )
}
