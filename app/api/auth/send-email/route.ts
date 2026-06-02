import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

// Svix-format HMAC verification — tries multiple key encodings since Supabase's
// exact key derivation from the bearer token secret is not documented.
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
    // whsec_<base64> Svix format
    ...(secret.startsWith('whsec_') ? [Buffer.from(secret.slice(7), 'base64')] : []),
    Buffer.from(secret, 'utf8'),
    Buffer.from(secret, 'base64'),
    Buffer.from(secret, 'hex'),
  ]

  return candidates.some(key => {
    try {
      const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64')
      return webhookSig.split(' ').some(part => {
        const [version, b64] = part.split(',')
        return version === 'v1' && b64 === expected
      })
    } catch {
      return false
    }
  })
}

export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Hook secret not configured' }, { status: 500 })

  // Read body first (needed for HMAC verification)
  const rawBody = await request.text()

  // Auth method 1: URL query token — requires Supabase hook URL to be:
  //   https://www.hydrowash.services/api/auth/send-email?token=<SUPABASE_AUTH_HOOK_SECRET>
  // This is immune to Vercel's proxy stripping the Authorization header.
  const urlToken = request.nextUrl.searchParams.get('token')

  // Auth method 2: Svix-format webhook signature that Supabase sends on every hook call
  const webhookId = request.headers.get('webhook-id')
  const webhookTimestamp = request.headers.get('webhook-timestamp')
  const webhookSig = request.headers.get('webhook-signature')
  const sigValid = !!(webhookId && webhookTimestamp && webhookSig &&
    verifyWebhookSignature(secret, webhookId, webhookTimestamp, rawBody, webhookSig))

  if (urlToken !== secret && !sigValid) {
    console.log('[auth/send-email] Auth failed:', {
      urlToken: urlToken ? 'present-wrong' : 'absent',
      sigValid,
      webhookId,
      webhookTimestamp,
      hasSig: !!webhookSig,
    })
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
