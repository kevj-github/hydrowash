import { createClient, getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountContractsClient } from '@/app/account/AccountContractsClient'

export default async function AccountContractsPage() {
  const supabase = await createClient()

  const user = await getAuthUser()
  if (!user) redirect('/auth/login')

  const [contractsRes, invoicesRes, profileRes, settingsRes] = await Promise.all([
    supabase
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
          due_month,
          reminder_sent,
          second_reminder_sent,
          booking_id
        )
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, amount_sgd, description, status, payment_method, paid_at, created_at, booking_id')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('address, unit_floor, building_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('app_settings')
      .select('contract_pricing_tiers, paynow_mobile')
      .single(),
  ])

  const activeContracts = contractsRes.data?.filter((c: any) => c.status === 'ACTIVE').length ?? 0

  return (
    <AccountContractsClient
      contracts={contractsRes.data ?? []}
      invoices={invoicesRes.data ?? []}
      profileAddress={profileRes.data?.address ?? null}
      profileUnitFloor={profileRes.data?.unit_floor ?? null}
      profileBuildingName={profileRes.data?.building_name ?? null}
      pricingTiers={settingsRes.data?.contract_pricing_tiers ?? []}
      paynowMobile={settingsRes.data?.paynow_mobile ?? null}
      activeContracts={activeContracts}
    />
  )
}
