'use client'

import { ContractServiceDateWithBooking } from '@/lib/types'
import { formatDueMonth } from '@/lib/contracts/service-dates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
  const todayMonth = new Date().toISOString().slice(0, 7)
  const isPast = serviceDate.due_month < todayMonth

  async function handleLink() {
    const bookingId = prompt(
      'Enter booking ID to link (or pick from the list):\n' +
        availableBookings.map((b) => `${b.label}: ${b.id}`).join('\n')
    )
    if (bookingId) {
      await onLink(serviceDate.id, bookingId.trim())
    }
  }

  return (
    <tr className="border-b border-gray-100 text-sm">
      <td className="py-2 px-3 text-gray-500">Visit {index + 1}</td>
      <td className="py-2 px-3 font-medium">{formatDueMonth(serviceDate.due_month)}</td>
      <td className="py-2 px-3">
        {serviceDate.booking ? (
          <span className="text-green-700">Linked: {serviceDate.booking.id.slice(0, 8)}…</span>
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
          <Badge className="bg-blue-100 text-blue-700">Reminder shown</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        {!serviceDate.booking_id && (
          <Button size="sm" variant="outline" onClick={handleLink}>
            Link Booking
          </Button>
        )}
      </td>
    </tr>
  )
}
