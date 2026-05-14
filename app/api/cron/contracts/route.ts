import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractServiceDue, sendContractExpiring } from '@/lib/email/send'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hydrowash.sg'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  // ── F1: Quarterly service due reminders ──────────────────────────────────

  const { data: dueDates, error: fetchError } = await supabase
    .from('contract_service_dates')
    .select('id, contract_id, due_date, contracts(customer_id, num_units, customer:profiles!contracts_customer_id_fkey(name))')
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

    if (!updateError) {
      remindersFlipped = ids.length

      // Send service due emails
      await Promise.all(
        dueDates.map(async (sd) => {
          const contract = sd.contracts as unknown as {
            customer_id: string
            num_units: number
            customer: { name: string } | null
          } | null
          if (!contract) return
          const { data } = await supabase.auth.admin.getUserById(contract.customer_id)
          const email = data?.user?.email
          if (!email) return
          await sendContractServiceDue(
            {
              customerName: contract.customer?.name ?? 'Customer',
              numUnits: contract.num_units,
              dueDate: sd.due_date,
              bookUrl: `${APP_URL}/book`,
            },
            email
          ).catch(() => null)
        })
      )
    }
  }

  // ── F2: Contract expiry reminders ────────────────────────────────────────

  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const in30DaysStr = in30Days.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const { data: expiring, error: expiryError } = await supabase
    .from('contracts')
    .select('id, end_date, customer_id, num_units, customer:profiles!contracts_customer_id_fkey(name)')
    .eq('status', 'ACTIVE')
    .lte('end_date', in30DaysStr)
    .gte('end_date', todayStr)
    .eq('expiry_reminder_sent', false)

  if (expiryError) {
    console.error('[cron/contracts] expiry query error:', expiryError.message)
  }

  let expiryEmailsSent = 0

  if (expiring && expiring.length > 0) {
    await Promise.all(
      expiring.map(async (c) => {
        const contract = c as unknown as {
          id: string
          end_date: string
          customer_id: string
          num_units: number
          customer: { name: string } | null
        }
        const { data } = await supabase.auth.admin.getUserById(contract.customer_id)
        const email = data?.user?.email
        if (!email) return
        const sent = await sendContractExpiring(
          {
            customerName: contract.customer?.name ?? 'Customer',
            numUnits: contract.num_units,
            endDate: contract.end_date,
          },
          email
        ).catch(() => null)
        if (sent) {
          await supabase.from('contracts').update({ expiry_reminder_sent: true }).eq('id', contract.id)
          expiryEmailsSent++
        }
      })
    )
  }

  console.log(
    `[cron/contracts] done — service reminders: ${remindersFlipped}, expiry emails: ${expiryEmailsSent}`
  )

  return NextResponse.json({
    ok: true,
    service_reminders_sent: remindersFlipped,
    expiry_emails_sent: expiryEmailsSent,
    run_at: new Date().toISOString(),
  })
}
