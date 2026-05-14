import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingApproved, sendBookingRejected } from '@/lib/email/send'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { action, confirmed_date, rejection_reason } = body

  const updates: Record<string, string> = {}
  if (action === 'approve') {
    updates.status = 'APPROVED'
    if (confirmed_date) updates.confirmed_date = confirmed_date
  } else if (action === 'reject') {
    updates.status = 'REJECTED'
    if (rejection_reason) updates.rejection_reason = rejection_reason
  } else if (action === 'complete') {
    updates.status = 'COMPLETED'
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const adminClient = createAdminClient()
  const { data: authUser } = await adminClient.auth.admin.getUserById(booking.customer_id)
  const email = authUser?.user?.email

  if (email) {
    if (action === 'approve') {
      await sendBookingApproved(booking, email).catch(() => null)
    } else if (action === 'reject') {
      await sendBookingRejected(booking, email).catch(() => null)
    }
  }

  return NextResponse.json(booking)
}
