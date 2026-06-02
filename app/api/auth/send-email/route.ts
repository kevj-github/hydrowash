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
): boolean {
  const ts = parseInt(webhookTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`

  const candidates: Buffer[] = [
    // Standard Webhooks / Svix whsec_<base64> format
    ...(secret.startsWith('whsec_') ? [Buffer.from(secret.slice(7), 'base64')] : []),
    Buffer.from(secret, 'utf8'),
    Buffer.from(secret, 'base64'),
    Buffer.from(secret, 'hex'),
  ]

  const receivedSigs = webhookSig.split(' ')
    .filter(p => p.startsWith('v1,'))
    .map(p => p.slice(3))

  for (const key of candidates) {
    try {
      const computed = crypto.createHmac('sha256', key).update(signedContent).digest('base64')
      if (receivedSigs.some(sig => sig.length === computed.length &&
          crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(computed)))) {
        return true
      }
    } catch { /* invalid key bytes for this encoding — skip */ }
  }
  return false
}

export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Hook secret not configured' }, { status: 500 })

  // Read body before verification (HMAC needs the raw payload)
  const rawBody = await request.text()

  const webhookId = request.headers.get('webhook-id')
  const webhookTimestamp = request.headers.get('webhook-timestamp')
  const webhookSig = request.headers.get('webhook-signature')

  if (!webhookId || !webhookTimestamp || !webhookSig ||
      !verifyWebhookSignature(secret, webhookId, webhookTimestamp, rawBody, webhookSig)) {
    // Log the received sig prefix to help diagnose key-format mismatches without
    // leaking the secret itself.
    const receivedPrefix = webhookSig ? webhookSig.slice(0, 12) + '…' : 'absent'
    console.log('[auth/send-email] Auth failed:', { webhookId, webhookTimestamp, receivedSigPrefix: receivedPrefix })
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
