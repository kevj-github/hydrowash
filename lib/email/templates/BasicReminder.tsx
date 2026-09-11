import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  bookUrl: string
}

export function BasicReminder({ customerName, bookUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>A friendly reminder from HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Just a Friendly Reminder</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            This is a quick reminder from HydroWash. If you&apos;re due for an aircon service, have an outstanding
            booking to schedule, or just have a question for us, we&apos;re here to help.
          </Text>
          <Button
            href={bookUrl}
            style={{
              backgroundColor: '#0369a1', color: '#ffffff', fontSize: 16, fontWeight: 600,
              padding: '14px 32px', borderRadius: 8, textAlign: 'center', display: 'block',
            }}
          >
            Book Now
          </Button>
          <Text>Thank you for being a HydroWash customer.</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
