import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  bookingId: string
  serviceType: string
  reason?: string
}

export function BookingCancelled({ customerName, bookingId, serviceType, reason }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Booking cancelled — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Booking Cancelled</Heading>
          <Text>Customer {customerName} has cancelled booking #{bookingId} ({serviceType}).</Text>
          <Text>Reason: {reason || 'None provided'}</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
