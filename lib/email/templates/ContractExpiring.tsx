import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  numUnits: number
  endDate: string
}

export function ContractExpiring({ customerName, numUnits, endDate }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your maintenance contract expires soon — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Your Contract Expires Soon</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            Your annual maintenance contract for <strong>{numUnits} unit{numUnits !== 1 ? 's' : ''}</strong> expires on <strong>{endDate}</strong>.
          </Text>
          <Text>
            To continue receiving quarterly servicing without interruption, please contact us to renew your contract.
          </Text>
          <Text>Reply to this email or WhatsApp us to discuss renewal options.</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
