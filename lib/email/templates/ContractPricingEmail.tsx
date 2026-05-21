import { Body, Container, Head, Heading, Html, Img, Preview, Text } from '@react-email/components'

interface Props {
  customerName: string
  numUnits: number
  priceSgd: number
  startDate: string
  endDate: string
  address?: string
  paynowQrDataUrl?: string
  paynowMobile?: string
  referenceId?: string
}

export function ContractPricingEmail({
  customerName,
  numUnits,
  priceSgd,
  startDate,
  endDate,
  address,
  paynowQrDataUrl,
  paynowMobile,
  referenceId,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your HydroWash contract pricing — S${priceSgd.toFixed(2)}/year</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Contract Pricing Ready</Heading>
          <Text>Hi {customerName},</Text>
          <Text>
            Your annual maintenance contract for{' '}
            <strong>{numUnits} unit{numUnits !== 1 ? 's' : ''}</strong>
            {address ? ` at ${address}` : ''} has been reviewed.
          </Text>

          <Container style={{ background: '#f1f5f9', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
            <Text style={{ margin: 0, fontWeight: 'bold', fontSize: 20, color: '#0369a1' }}>
              S${priceSgd.toFixed(2)} / year
            </Text>
            <Text style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              Contract period: {startDate} → {endDate}
            </Text>
          </Container>

          {paynowMobile && (
            <>
              <Text style={{ fontWeight: 'bold' }}>Pay via PayNow</Text>
              <Text>
                Scan the QR code below with your banking app, or send{' '}
                <strong>S${priceSgd.toFixed(2)}</strong> to{' '}
                <strong>{paynowMobile}</strong>{referenceId ? <> with reference <strong>{referenceId}</strong></> : ''}.
              </Text>
              {paynowQrDataUrl && (
                <Img
                  src={paynowQrDataUrl}
                  alt="PayNow QR Code"
                  width={200}
                  height={200}
                  style={{ display: 'block', margin: '16px auto' }}
                />
              )}
              {referenceId && (
                <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center' as const }}>
                  Reference: {referenceId}
                </Text>
              )}
            </>
          )}

          <Text>
            Once we confirm your payment, your contract will be activated and your quarterly
            service schedule will be generated. You will receive a confirmation email.
          </Text>

          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
