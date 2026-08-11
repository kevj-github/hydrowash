import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingApproved } from '@/lib/email/send'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { booking_ids, confirmed_date, confirmed_slot }: {
    booking_ids: string[]
    confirmed_date: string
    confirmed_slot?: string
  } = await request.json()

  if (!booking_ids?.length || !confirmed_date) {
    return NextResponse.json({ error: 'booking_ids and confirmed_date required' }, { status: 400 })
  }

  // Fetch PENDING bookings — no date-range validation needed (slot model)
  const { data: bookings, error: fetchError } = await supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .in('id', booking_ids)
    .eq('status', 'PENDING')

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  // Only one APPROVED booking can hold a given (confirmed_date, confirmed_slot) —
  // bookings_confirmed_slot_unique. Applying one slot to several bookings therefore
  // always violates it, and the failure used to be swallowed: the route reported
  // success and emailed customers about approvals that never happened.
  if (confirmed_slot && bookings.length > 1) {
    return NextResponse.json({
      error: 'Only one booking can hold a given date and time slot. Omit confirmed_slot to bulk-approve on the date alone, or approve these bookings individually.',
      eligible: bookings.length,
    }, { status: 409 })
  }

  let approvedIds: string[] = []
  if (bookings.length > 0) {
    const updatePayload: Record<string, string | null> = { status: 'APPROVED', confirmed_date }
    if (confirmed_slot) updatePayload.confirmed_slot = confirmed_slot

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update(updatePayload)
      .in('id', bookings.map(b => b.id))
      .select('id')

    if (updateError) {
      console.error('[bulk-approve] update failed:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
    approvedIds = (updated ?? []).map(b => b.id)
  }

  // Email only the customers whose booking actually changed status.
  const adminClient = createAdminClient()
  await Promise.all(
    bookings.filter(b => approvedIds.includes(b.id)).map(async (booking) => {
      const { data } = await adminClient.auth.admin.getUserById(booking.customer_id)
      const email = data?.user?.email
      if (email) await sendBookingApproved(booking, email).catch(err =>
        console.error(`[bulk-approve] Failed to send email to ${email}:`, err)
      )
    })
  )

  return NextResponse.json({ approved: approvedIds.length, excluded: [] })
}
