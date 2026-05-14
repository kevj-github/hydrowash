import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { BookingWithRelations } from '@/lib/types'

export function DayBeforeReminder({ booking }: { booking: BookingWithRelations }) {
  return (
    <Html>
      <Head />
      <Preview>Reminder: your appointment is tomorrow</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Appointment Tomorrow</Heading>
          <Text>Hi {booking.customer.name},</Text>
          <Text>This is a reminder that your <strong>{booking.service_type.name}</strong> appointment is scheduled for tomorrow, <strong>{booking.confirmed_date}</strong>.</Text>
          <Text>Address: {booking.address}</Text>
          <Text>Please ensure access is available. See you tomorrow!</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
