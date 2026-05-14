import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString().split('T')[0]
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  const { data: dueDates, error: fetchError } = await supabase
    .from('contract_service_dates')
    .select('id')
    .gte('due_date', firstOfMonth)
    .lte('due_date', lastOfMonth)
    .is('booking_id', null)
    .eq('reminder_sent', false)

  if (fetchError) {
    console.error('[cron/contracts] fetch error:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let remindersFlipped = 0

  if (dueDates && dueDates.length > 0) {
    const ids = dueDates.map((d) => d.id)
    const { error: updateError } = await supabase
      .from('contract_service_dates')
      .update({ reminder_sent: true })
      .in('id', ids)

    if (updateError) {
      console.error('[cron/contracts] update error:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    remindersFlipped = ids.length
  }

  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const in30DaysStr = in30Days.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const { data: expiring, error: expiryError } = await supabase
    .from('contracts')
    .select('id, end_date, customer_id')
    .eq('status', 'ACTIVE')
    .lte('end_date', in30DaysStr)
    .gte('end_date', todayStr)

  if (expiryError) {
    console.error('[cron/contracts] expiry query error:', expiryError.message)
  }

  const expiringCount = expiring?.length ?? 0

  console.log(
    `[cron/contracts] done — reminders flipped: ${remindersFlipped}, expiring contracts: ${expiringCount}`
  )

  return NextResponse.json({
    ok: true,
    reminders_flipped: remindersFlipped,
    expiring_contracts: expiringCount,
    run_at: new Date().toISOString(),
  })
}
