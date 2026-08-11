'use client'

import { useState } from 'react'
import { ContractServiceDateWithBooking } from '@/lib/types'
import { formatDueMonth } from '@/lib/contracts/service-dates'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  index: number
  serviceDate: ContractServiceDateWithBooking
  contractId: string
  availableBookings: { id: string; label: string }[]
  onLink: (serviceDateId: string, bookingId: string) => Promise<void>
}

export default function ServiceDateRow({
  index,
  serviceDate,
  availableBookings,
  onLink,
}: Props) {
  const [open, setOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  const todayMonth = new Date().toISOString().slice(0, 7)
  const isPast = serviceDate.due_month < todayMonth

  async function handleSelect(bookingId: string) {
    setLinking(true)
    await onLink(serviceDate.id, bookingId)
    setLinking(false)
    setOpen(false)
  }

  return (
    <tr className="border-b border-gray-100 text-sm">
      <td className="py-2 px-3 text-gray-500">Visit {index + 1}</td>
      <td className="py-2 px-3 font-medium">{formatDueMonth(serviceDate.due_month)}</td>
      <td className="py-2 px-3">
        {serviceDate.booking ? (
          <span className="text-green-700">
            {serviceDate.booking.confirmed_date ?? 'TBD'} — {serviceDate.booking.address?.split(',')[0]}
          </span>
        ) : (
          <span className={isPast ? 'text-red-600' : 'text-gray-400'}>
            {isPast ? 'Overdue — no booking' : 'Not yet booked'}
          </span>
        )}
      </td>
      <td className="py-2 px-3">
        {serviceDate.booking ? (
          <Badge className="bg-green-100 text-green-800">{serviceDate.booking.status}</Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-500">—</Badge>
        )}
      </td>
      <td className="py-2 px-3">
        {serviceDate.reminder_sent ? (
          <Badge className="bg-blue-100 text-blue-700">Reminder sent</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        {!serviceDate.booking_id && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Link Booking
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Link booking to Visit {index + 1}</DialogTitle>
              </DialogHeader>
              <div className="pt-2">
                {availableBookings.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No approved maintenance bookings found for this customer.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {availableBookings.map(b => (
                      <button
                        key={b.id}
                        disabled={linking}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleSelect(b.id)}
                        className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:bg-muted text-sm transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </td>
    </tr>
  )
}
