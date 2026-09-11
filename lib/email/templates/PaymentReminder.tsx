import { Body, Container, Head, Heading, Html, Img, Preview, Text, Section, Hr } from '@react-email/components'

interface Props {
  customerName: string
  amountSgd: number
  serviceLabel?: string
  serviceDate?: string
  paynowQrDataUrl?: string
  paynowMobile?: string
  referenceId?: string
}

export function PaymentReminder({
  customerName, amountSgd, serviceLabel, serviceDate, paynowQrDataUrl, paynowMobile, referenceId,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{`Payment reminder — S$${amountSgd.toFixed(2)} outstanding — HydroWash`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Payment Reminder</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            This is a friendly reminder that you have an outstanding balance with HydroWash
            {serviceLabel ? <> for <strong>{serviceLabel}</strong>{serviceDate ? ` (${serviceDate})` : ''}</> : null}.
          </Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>
            Amount due: S${amountSgd.toFixed(2)}
          </Text>
          {paynowQrDataUrl && paynowMobile && (
            <>
              <Hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />
              <Section>
                <Text style={{ fontWeight: 'bold', fontSize: 14 }}>Payment via PayNow</Text>
                <Text>Scan the QR code below or transfer to <strong>{paynowMobile}</strong></Text>
                {referenceId && <Text style={{ color: '#64748b', fontSize: 12 }}>Reference: {referenceId}</Text>}
                <Img
                  src={paynowQrDataUrl}
                  width={200}
                  height={200}
                  alt="PayNow QR Code"
                  style={{ display: 'block', margin: '12px 0' }}
                />
              </Section>
            </>
          )}
          <Hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />
          <Text>Please contact us if you have already made this payment or have any questions.</Text>
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
