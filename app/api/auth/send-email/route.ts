import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

// Supabase signs Auth Hook requests as HS256 JWTs.
// Secret format: "v1,whsec_<base64-encoded key>"
function verifyHookSignature(authHeader: string | null): boolean {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret || !authHeader?.startsWith('Bearer ')) return false

  const token = authHeader.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [header, payload, signature] = parts
  const rawKey = secret.replace('v1,whsec_', '')
  const keyBytes = Buffer.from(rawKey, 'base64')

  const expected = crypto
    .createHmac('sha256', keyBytes)
    .update(`${header}.${payload}`)
    .digest('base64url')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!verifyHookSignature(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { user, email_data } = body as {
    user: { email: string }
    email_data: {
      token_hash: string
      redirect_to: string
      email_action_type: string
      site_url: string
    }
  }

  const { email_action_type, token_hash, site_url } = email_data
  const toEmail = user.email
  const confirmUrl = `${site_url}/auth/callback?token_hash=${token_hash}&type=${email_action_type}`

  try {
    if (email_action_type === 'signup' || email_action_type === 'email_change') {
      const { EmailConfirmation } = await import('@/lib/email/templates/EmailConfirmation')
      await resend.emails.send({
        from: FROM,
        to: toEmail,
        subject: 'Confirm your HydroWash account',
        react: EmailConfirmation({ confirmUrl }),
      })
    } else if (email_action_type === 'recovery') {
      const { PasswordReset } = await import('@/lib/email/templates/PasswordReset')
      await resend.emails.send({
        from: FROM,
        to: toEmail,
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
