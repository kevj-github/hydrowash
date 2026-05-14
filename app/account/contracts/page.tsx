import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountContractsClient } from '@/app/account/AccountContractsClient'

export default async function AccountContractsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      id,
      num_units,
      price_sgd,
      start_date,
      end_date,
      service_interval_months,
      notes,
      status,
      contract_service_dates (
        id,
        due_date,
        reminder_sent,
        booking_id
      )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, amount_sgd, description, status, payment_method, paid_at, created_at')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AccountContractsClient
      contracts={contracts ?? []}
      invoices={invoices ?? []}
    />
  )
}
