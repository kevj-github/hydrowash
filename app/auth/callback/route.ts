import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  if (code) {
    // PKCE flow (OAuth, magic link)
    await supabase.auth.exchangeCodeForSession(code)
  } else if (token_hash && type) {
    // Token hash flow (email confirmation, password reset)
    await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
  }

  return NextResponse.redirect(`${origin}${next}`)
}
