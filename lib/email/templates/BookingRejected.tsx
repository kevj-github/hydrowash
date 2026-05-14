import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { BookingWithRelations } from '@/lib/types'

export function BookingRejected({ booking }: { booking: BookingWithRelations }) {
  return (
    <Html>
      <Head />
      <Preview>Update on your booking</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Booking Update</Heading>
          <Text>Hi {booking.customer.name},</Text>
          <Text>Unfortunately we are unable to proceed with your booking for <strong>{booking.service_type.name}</strong>.</Text>
          {booking.rejection_reason && (
            <Text>Reason: {booking.rejection_reason}</Text>
          )}
          <Text>Please contact us or submit a new booking if you would like to reschedule.</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
