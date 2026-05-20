import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  numUnits: number
  preferredMonth: string
  address?: string
}

export function ContractRequestReceived({ customerName, numUnits, preferredMonth, address }: Props) {
  return (
    <Html>
      <Head />
      <Preview>We received your maintenance contract request — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Contract Request Received</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            We&apos;ve received your request for a 1-year maintenance contract for{' '}
            <strong>{numUnits} unit{numUnits !== 1 ? 's' : ''}</strong>
            {address ? ` at ${address}` : ''}.
          </Text>
          <Text>
            Preferred start: <strong>{preferredMonth}</strong>
          </Text>
          <Text>
            Our team will review your request and send you the pricing shortly. Once you confirm
            payment, your contract will be activated and your service schedule will be generated.
          </Text>
          <Text>
            If you have any questions, feel free to reply to this email.
          </Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
