import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  bookingId: string
  serviceType: string
  newDates: string[]
}

export function BookingRescheduled({ customerName, bookingId, serviceType, newDates }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Booking rescheduled — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Booking Rescheduled</Heading>
          <Text>Customer {customerName} has rescheduled booking #{bookingId} ({serviceType}).</Text>
          <Text>New preferred dates: {newDates.join(', ')}</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
