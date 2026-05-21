import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

export async function POST(request: NextRequest) {
  // Verify the shared secret Supabase sends in the Authorization header
  const authHeader = request.headers.get('authorization')
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { user, email_data } = body as {
    user: { email: string }
    email_data: {
      token: string
      token_hash: string
      redirect_to: string
      email_action_type: string
      site_url: string
    }
  }

  const { email_action_type, token_hash, site_url } = email_data
  const toEmail = user.email

  // Build the verification URL pointing to our own callback
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
    // For other types (invite, magic_link) fall through — Supabase will use its default
  } catch (err) {
    console.error('[auth/send-email] Resend error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({})
}
