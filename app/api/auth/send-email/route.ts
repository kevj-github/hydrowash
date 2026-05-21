import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { Webhook } from 'svix'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Hook secret not configured' }, { status: 500 })

  const rawBody = await request.text()

  try {
    const wh = new Webhook(secret)
    wh.verify(rawBody, {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    })
  } catch {
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
