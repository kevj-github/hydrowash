import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  confirmUrl: string
}

export function EmailConfirmation({ confirmUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your HydroWash account</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a', marginBottom: 8 }}>Confirm your email</Heading>
          <Text style={{ color: '#475569' }}>
            Thanks for signing up with HydroWash! Click the button below to verify your email address and activate your account.
          </Text>
          <Button
            href={confirmUrl}
            style={{
              display: 'inline-block',
              background: '#0369a1',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: 6,
              fontWeight: 600,
              textDecoration: 'none',
              marginTop: 8,
              marginBottom: 16,
            }}
          >
            Confirm my account
          </Button>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            This link expires in 24 hours. If you did not create an account, you can safely ignore this email.
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 16 }}>
            Or copy this link into your browser:{' '}
            <span style={{ color: '#0369a1' }}>{confirmUrl}</span>
          </Text>
          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 24 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
