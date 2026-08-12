import { createAdminClient } from '@/lib/supabase/admin'
import { sendDayBeforeReminder } from '@/lib/email/send'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .eq('status', 'APPROVED')
    // Remind for the date the booking is CONFIRMED for. Filtering on
    // booking_date (the customer's first preference) sent "your service is
    // tomorrow" on the wrong day for every booking the admin had moved, and
    // sent nothing on the real day.
    .or(`confirmed_date.eq.${tomorrowStr},and(confirmed_date.is.null,booking_date.eq.${tomorrowStr})`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all(
    (bookings ?? []).map(async (booking) => {
      const { data } = await supabase.auth.admin.getUserById(booking.customer_id)
      const email = data?.user?.email
      if (email) await sendDayBeforeReminder(booking, email).catch(() => null)
    })
  )

  return NextResponse.json({ sent: bookings?.length ?? 0 })
}
