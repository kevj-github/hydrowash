import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

// Svix / Standard Webhooks format: HMAC-SHA256(key, "{id}.{timestamp}.{body}")
// Supabase auth hooks sign every request this way. Vercel strips the Authorization
// header, so this webhook signature is our only verification path.
// We try multiple key encodings because Supabase's exact key derivation from the
// bearer token secret is not documented.
function verifyWebhookSignature(
  secret: string,
  webhookId: string,
  webhookTimestamp: string,
  rawBody: string,
  webhookSig: string,
): { ok: boolean; diagnostics: string } {
  const ts = parseInt(webhookTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return { ok: false, diagnostics: 'stale-timestamp' }
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`

  // Supabase exposes the hook secret as "v1,whsec_<base64>" in the dashboard.
  // The signing key is base64_decode(part after stripping the prefix).
  const b64Part = secret.startsWith('v1,whsec_') ? secret.slice(9)
    : secret.startsWith('whsec_') ? secret.slice(7)
    : secret

  const candidateKeys: Array<{ label: string; key: Buffer }> = [
    { label: 'v1whsec', key: Buffer.from(b64Part, 'base64') },
    { label: 'utf8', key: Buffer.from(secret, 'utf8') },
  ]

  const receivedSigs = webhookSig.split(' ')
    .filter(p => p.startsWith('v1,'))
    .map(p => p.slice(3))

  const computed: string[] = []

  for (const { label, key } of candidateKeys) {
    try {
      const sig = crypto.createHmac('sha256', key).update(signedContent).digest('base64')
      computed.push(`${label}=${sig.slice(0, 8)}`)
      if (receivedSigs.some(r => r.length === sig.length &&
          crypto.timingSafeEqual(Buffer.from(r), Buffer.from(sig)))) {
        return { ok: true, diagnostics: `matched:${label}` }
      }
    } catch { computed.push(`${label}=invalid`) }
  }

  const receivedPrefix = receivedSigs[0]?.slice(0, 8) ?? '?'
  return { ok: false, diagnostics: `received=${receivedPrefix} computed=[${computed.join(', ')}]` }
}

export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Hook secret not configured' }, { status: 500 })

  // Read body before verification (HMAC needs the raw payload)
  const rawBody = await request.text()

  const webhookId = request.headers.get('webhook-id')
  const webhookTimestamp = request.headers.get('webhook-timestamp')
  const webhookSig = request.headers.get('webhook-signature')

  if (!webhookId || !webhookTimestamp || !webhookSig) {
    console.log('[auth/send-email] Auth failed: missing webhook headers')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ok, diagnostics } = verifyWebhookSignature(secret, webhookId, webhookTimestamp, rawBody, webhookSig)
  if (!ok) {
    console.log('[auth/send-email] Auth failed:', diagnostics)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user, email_data } = JSON.parse(rawBody) as {
    user: { email: string }
    email_data: {
      token_hash: string
      redirect_to: string
      email_action_type: string
      site_url: string
    }
  }

  const { email_action_type, token_hash, redirect_to, site_url } = email_data
  // Use the origin from redirect_to so pre-prod signups link back to pre-prod,
  // not the production site_url
  const appOrigin = redirect_to ? new URL(redirect_to).origin : site_url
  const confirmUrl = `${appOrigin}/auth/callback?token_hash=${token_hash}&type=${email_action_type}`

  try {
    if (email_action_type === 'signup' || email_action_type === 'email_change') {
      const { EmailConfirmation } = await import('@/lib/email/templates/EmailConfirmation')
      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: 'Confirm your HydroWash account',
        react: EmailConfirmation({ confirmUrl }),
      })
    } else if (email_action_type === 'recovery') {
      const { PasswordReset } = await import('@/lib/email/templates/PasswordReset')
      await resend.emails.send({
        from: FROM,
        to: user.email,
        subject: 'Reset your HydroWash password',
        react: PasswordReset({ resetUrl: confirmUrl }),
      })
    }
  } catch (err) {
    console.error('[auth/send-email] Resend error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({})
}
