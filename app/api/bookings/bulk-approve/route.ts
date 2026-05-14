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

  const { booking_ids, confirmed_date }: { booking_ids: string[]; confirmed_date: string } =
    await request.json()

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

  // All fetched PENDING bookings are eligible — slot already captures the date
  if (bookings.length > 0) {
    await supabase
      .from('bookings')
      .update({ status: 'APPROVED', confirmed_date })
      .in('id', bookings.map(b => b.id))
  }

  const adminClient = createAdminClient()
  await Promise.all(
    bookings.map(async (booking) => {
      const { data } = await adminClient.auth.admin.getUserById(booking.customer_id)
      const email = data?.user?.email
      if (email) await sendBookingApproved(booking, email).catch(err =>
        console.error(`[bulk-approve] Failed to send email to ${email}:`, err)
      )
    })
  )

  return NextResponse.json({ approved: bookings.length, excluded: [] })
}
