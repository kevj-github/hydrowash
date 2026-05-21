import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

// Supabase Auth Hooks use Svix webhook signing.
// Secret format: "v1,whsec_<base64-encoded key>"
// Signature is HMAC-SHA256 of "${svix-id}.${svix-timestamp}.${raw-body}"
function verifySvixSignature(rawBody: string, headers: Headers, secret: string): boolean {
  const msgId = headers.get('svix-id')
  const msgTimestamp = headers.get('svix-timestamp')
  const msgSignature = headers.get('svix-signature')
  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Reject requests older than 5 minutes
  const ts = parseInt(msgTimestamp, 10)
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false

  const rawKey = secret.replace(/^v1,whsec_/, '')
  const keyBytes = Buffer.from(rawKey, 'base64')
  const toSign = `${msgId}.${msgTimestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', keyBytes).update(toSign).digest('base64')

  // svix-signature can be multiple space-separated "v1,<sig>" values
  for (const part of msgSignature.split(' ')) {
    const sigValue = part.replace(/^v1,/, '')
    try {
      if (crypto.timingSafeEqual(Buffer.from(sigValue), Buffer.from(expected))) return true
    } catch {
      // buffers different length — not a match
    }
  }
  return false
}

export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Hook secret not configured' }, { status: 500 })

  const rawBody = await request.text()
  if (!verifySvixSignature(rawBody, request.headers, secret)) {
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

  const { email_action_type, token_hash, site_url } = email_data
  const confirmUrl = `${site_url}/auth/callback?token_hash=${token_hash}&type=${email_action_type}`

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
