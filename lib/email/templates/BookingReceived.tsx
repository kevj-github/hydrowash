import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { SLOT_LABELS } from '@/lib/types'
import type { BookingWithRelations, TimeSlot } from '@/lib/types'

export function BookingReceived({ booking }: { booking: BookingWithRelations }) {
  return (
    <Html>
      <Head />
      <Preview>Your booking has been received</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Booking Received</Heading>
          <Text>Hi {booking.customer.name},</Text>
          <Text>We have received your booking for <strong>{booking.service_type.name}</strong>.</Text>
          <Text>Address: {booking.address}</Text>
          <Text>Date: {booking.booking_date} · {SLOT_LABELS[booking.time_slot as TimeSlot] ?? booking.time_slot}</Text>
          <Text>We will review your booking and confirm a date shortly.</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
