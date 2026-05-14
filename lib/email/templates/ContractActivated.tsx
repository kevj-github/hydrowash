import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  numUnits: number
  priceSgd: number
  startDate: string
  firstServiceDate: string
}

export function ContractActivated({ customerName, numUnits, priceSgd, startDate, firstServiceDate }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your maintenance contract is now active — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Your Contract is Active</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            Your annual maintenance contract for <strong>{numUnits} unit{numUnits !== 1 ? 's' : ''}</strong> has been activated.
          </Text>
          <Text>
            Price: <strong>S${priceSgd.toFixed(2)} / year</strong>
          </Text>
          <Text>
            Contract start: <strong>{startDate}</strong>
          </Text>
          <Text>
            Your first service visit is due: <strong>{firstServiceDate}</strong>
          </Text>
          <Text>
            We will send you a reminder when your service visit is approaching. You can book your slot at any time from your account.
          </Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
