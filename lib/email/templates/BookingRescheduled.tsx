import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { SLOT_LABELS } from '@/lib/types'
import type { TimeSlot } from '@/lib/types'

interface Props {
  customerName: string
  bookingId: string
  serviceType: string
  newDateSlots: { date: string; slots: string[] }[]
}

export function BookingRescheduled({ customerName, bookingId, serviceType, newDateSlots }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Booking rescheduled — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Booking Rescheduled</Heading>
          <Text>Customer {customerName} has rescheduled booking #{bookingId} ({serviceType}).</Text>
          <Text style={{ marginBottom: 4 }}>New preferred dates and times:</Text>
          {newDateSlots.map((ds, i) => (
            <Text key={i} style={{ margin: '2px 0', paddingLeft: 12 }}>
              {ds.date} — {ds.slots.map(s => SLOT_LABELS[s as TimeSlot] ?? s).join(', ')}
            </Text>
          ))}
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
