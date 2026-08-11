import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED = [
  'depot_address', 'depot_lat', 'depot_lng',
  'company_name', 'contact_email',
  'company_address', 'company_phone', 'company_email',
  'company_instagram', 'authorised_officer_name', 'paynow_mobile',
] as const

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const { error } = await supabase.from('app_settings').update(updates).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })

  return NextResponse.json({ ok: true })
}
