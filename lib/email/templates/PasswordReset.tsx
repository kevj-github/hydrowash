import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props {
  resetUrl: string
}

export function PasswordReset({ resetUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Reset your HydroWash password</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a', marginBottom: 8 }}>Reset your password</Heading>
          <Text style={{ color: '#475569' }}>
            We received a request to reset your HydroWash password. Click the button below to choose a new one.
          </Text>
          <Button
            href={resetUrl}
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
            Reset my password
          </Button>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 16 }}>
            Or copy this link into your browser:{' '}
            <span style={{ color: '#0369a1' }}>{resetUrl}</span>
          </Text>
          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 24 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
