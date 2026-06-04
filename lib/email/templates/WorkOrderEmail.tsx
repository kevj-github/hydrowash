import { Body, Container, Head, Heading, Html, Img, Preview, Text, Section, Hr } from '@react-email/components'

interface Props {
  customerName: string
  workOrderNo: number
  date: string
  serviceType: string
  address: string
  totalSgd: number
  paynowQrDataUrl: string
  paynowMobile: string
  referenceId: string
}

export function WorkOrderEmail({
  customerName, date, serviceType, address,
  totalSgd, paynowQrDataUrl, paynowMobile, referenceId,
}: Props) {
  const formattedDate = (() => {
    try {
      return new Date(date + 'T00:00:00Z').toLocaleDateString('en-SG', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      })
    } catch { return date }
  })()

  return (
    <Html>
      <Head />
      <Preview>{`Your aircon service is complete — S$${totalSgd.toFixed(2)} due`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 520, margin: '40px auto', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          <Section style={{ background: '#0f172a', padding: '16px 24px' }}>
            <Heading style={{ color: '#ffffff', margin: 0, fontSize: 20 }}>HydroWash</Heading>
            <Text style={{ color: '#93c5fd', margin: '2px 0 0', fontSize: 11 }}>Aircon Service</Text>
          </Section>
          <Section style={{ padding: '24px' }}>
            <Heading style={{ color: '#0f172a', fontSize: 18 }}>Aircon Service Report</Heading>
            <Text>Dear {customerName},</Text>
            <Text>Thank you for using HydroWash. Your service has been completed. Please find the service report attached.</Text>
            <Hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />
            <Text style={{ margin: '4px 0' }}><strong>Date:</strong> {formattedDate}</Text>
            <Text style={{ margin: '4px 0' }}><strong>Service:</strong> {serviceType}</Text>
            <Text style={{ margin: '4px 0' }}><strong>Address:</strong> {address}</Text>
            <Text style={{ margin: '4px 0', fontSize: 16, color: '#0f172a', fontWeight: 'bold' }}>Total: S${totalSgd.toFixed(2)}</Text>
            <Hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />
            <Text style={{ fontWeight: 'bold', fontSize: 14 }}>Payment via PayNow</Text>
            <Text>Scan the QR code below or transfer to <strong>{paynowMobile}</strong></Text>
            <Text style={{ color: '#64748b', fontSize: 12 }}>Reference: {referenceId}</Text>
            <Img
              src={paynowQrDataUrl}
              width={200}
              height={200}
              alt="PayNow QR Code"
              style={{ display: 'block', margin: '12px 0' }}
            />
            <Hr style={{ borderColor: '#e2e8f0', margin: '16px 0' }} />
            <Text style={{ color: '#64748b', fontSize: 12 }}>
              Questions? Contact Gilbert at (+65) 8811 1105 or follow us @Hydrowash.sg
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
