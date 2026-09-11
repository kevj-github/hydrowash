import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  description: string
  amountSgd: number
  paymentMethod: string
  paidDate: string
  serviceLabel?: string
  serviceDate?: string
}

export function PaymentReceived({
  customerName, description, amountSgd, paymentMethod, paidDate, serviceLabel, serviceDate,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Payment received — {description} — HydroWash</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Payment Received</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            We&apos;ve received your payment for <strong>{description}</strong>. Thank you!
          </Text>
          {serviceLabel && (
            <Text>
              Service: <strong>{serviceLabel}</strong>{serviceDate ? ` (${serviceDate})` : ''}
            </Text>
          )}
          <Text>
            Amount: <strong>S${amountSgd.toFixed(2)}</strong>
          </Text>
          <Text>
            Payment method: <strong>{paymentMethod}</strong>
          </Text>
          <Text>
            Date received: <strong>{paidDate}</strong>
          </Text>
          <Text>
            Please contact us if you have any questions about this payment.
          </Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
