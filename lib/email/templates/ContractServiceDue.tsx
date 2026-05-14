import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  numUnits: number
  dueDate: string
  bookUrl: string
}

export function ContractServiceDue({ customerName, numUnits, dueDate, bookUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your quarterly aircon service is due — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Service Visit Due This Month</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            Your quarterly aircon service for <strong>{numUnits} unit{numUnits !== 1 ? 's' : ''}</strong> is due this month (<strong>{dueDate}</strong>).
          </Text>
          <Text>
            Please book your service slot at your earliest convenience:{' '}
            <Link href={bookUrl} style={{ color: '#0369a1' }}>Book Now</Link>
          </Text>
          <Text>If you have any questions, please reply to this email.</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
