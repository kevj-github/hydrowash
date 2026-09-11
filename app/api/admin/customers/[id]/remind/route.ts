import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBasicReminder } from '@/lib/email/send'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: customerProfile } = await supabase
    .from('profiles').select('name').eq('id', id).single()
  if (!customerProfile) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(id)
  if (!customerUser?.email) {
    return NextResponse.json({ error: 'Customer has no email on file' }, { status: 422 })
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.hydrowash.services'
  await sendBasicReminder({ customerName: customerProfile.name, bookUrl: `${APP_URL}/book` }, customerUser.email)

  return NextResponse.json({ ok: true })
}
