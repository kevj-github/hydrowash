import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractServiceDue, sendContractExpiring } from '@/lib/email/send'
import { formatDueMonth } from '@/lib/contracts/service-dates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.hydrowash.services'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const todaySGT = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const todayMonth = todaySGT.slice(0, 7)
  const todayDay = parseInt(todaySGT.slice(8, 10))

  // ── F1: Quarterly service due reminders ──────────────────────────────────

  let remindersFlipped = 0
  let secondRemindersFlipped = 0

  if (todayDay === 1 || todayDay === 15) {
    const isSecond = todayDay === 15
    const { data: dueDates, error: fetchError } = await supabase
      .from('contract_service_dates')
      .select('id, contract_id, due_month, contracts!inner(customer_id, num_units, status, customer:profiles!contracts_customer_id_fkey(name))')
      .eq('due_month', todayMonth)
      .is('booking_id', null)
      .eq(isSecond ? 'second_reminder_sent' : 'reminder_sent', false)
      .eq('contracts.status', 'ACTIVE')

    if (fetchError) {
      console.error('[cron/contracts] fetch error:', fetchError.message)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (dueDates && dueDates.length > 0) {
      const ids = dueDates.map((d) => d.id)
      const { error: updateError } = await supabase
        .from('contract_service_dates')
        .update(isSecond ? { second_reminder_sent: true } : { reminder_sent: true })
        .in('id', ids)

      if (!updateError) {
        if (isSecond) secondRemindersFlipped = ids.length
        else remindersFlipped = ids.length

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
                dueDate: formatDueMonth(sd.due_month),
                // Deep-link to the specific contract this reminder is for —
                // a customer can have more than one contract.
                bookUrl: `${APP_URL}/book?contract=${sd.contract_id}`,
              },
              email
            ).catch(() => null)
          })
        )
      }
    }
  }

  // ── F2: Contract expiry reminders ────────────────────────────────────────

  const in30Days = new Date()
  in30Days.setDate(in30Days.getDate() + 30)
  const in30DaysStr = in30Days.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

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
    `[cron/contracts] done — service reminders: ${remindersFlipped}, second reminders: ${secondRemindersFlipped}, expiry emails: ${expiryEmailsSent}`
  )

  return NextResponse.json({
    ok: true,
    service_reminders_sent: remindersFlipped,
    second_reminders_sent: secondRemindersFlipped,
    expiry_emails_sent: expiryEmailsSent,
    run_at: new Date().toISOString(),
  })
}
