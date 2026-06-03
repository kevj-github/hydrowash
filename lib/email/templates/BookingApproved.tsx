import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { BookingWithRelations } from '@/lib/types'
import { SLOT_LABELS } from '@/lib/types'

export function BookingApproved({ booking }: { booking: BookingWithRelations }) {
  const slotLabel = booking.confirmed_slot ? (SLOT_LABELS[booking.confirmed_slot] ?? booking.confirmed_slot) : '—'
  return (
    <Html>
      <Head />
      <Preview>Your booking is confirmed</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Booking Confirmed</Heading>
          <Text>Hi {booking.customer.name},</Text>
          <Text>Your booking for <strong>{booking.service_type.name}</strong> has been confirmed.</Text>
          <Text>Date: <strong>{booking.confirmed_date}</strong></Text>
          <Text>Time: <strong>{slotLabel}</strong></Text>
          <Text>Address: {booking.address}</Text>
          {booking.contract_id && (
            <Text style={{ color: '#3730a3', background: '#eef2ff', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
              This visit is part of your annual maintenance contract.
            </Text>
          )}
          <Text>Our team will be in touch on the day. Thank you for choosing HydroWash.</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
