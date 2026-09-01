import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const rawNext = searchParams.get('next') ?? '/'
  // Resolve against this origin rather than prefix-matching: a `startsWith('/')`
  // check lets `/\evil.com` through, which browsers normalise to a protocol-relative
  // URL. This route carries recovery token_hash values, so an off-origin redirect
  // leaks them. Same check as app/auth/login/page.tsx.
  let next = '/'
  try {
    const parsed = new URL(rawNext, origin)
    if (parsed.origin === origin) next = `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {}

  const supabase = await createClient()

  if (code) {
    // PKCE flow (OAuth, magic link)
    await supabase.auth.exchangeCodeForSession(code)
  } else if (token_hash && type) {
    if (type === 'recovery') {
      // Pass token_hash to the page so the browser calls verifyOtp client-side,
      // establishing the session in the browser's cookie store (not the server's).
      return NextResponse.redirect(
        `${origin}/auth/reset-password?token_hash=${token_hash}&type=recovery`,
      )
    }
    // Token hash flow for other types (email confirmation etc.)
    await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
  }

  return NextResponse.redirect(`${origin}${next}`)
}
