import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ exists: false }, { status: 400 })
  }

  const admin = createAdminClient()
  const { count } = await admin
    .schema('auth')
    .from('users')
    .select('id', { head: true, count: 'exact' })
    .eq('email', email.toLowerCase().trim())

  return NextResponse.json({ exists: (count ?? 0) > 0 })
}
