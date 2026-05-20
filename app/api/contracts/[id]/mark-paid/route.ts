import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractActivated } from '@/lib/email/send'
import { generateServiceDates } from '@/lib/contracts/service-dates'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (existing.status !== 'AWAITING_PAYMENT') {
    return NextResponse.json({ error: 'Contract must be in AWAITING_PAYMENT status' }, { status: 409 })
  }

  const { data: contract, error: updateError } = await supabase
    .from('contracts')
    .update({ status: 'ACTIVE' })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !contract) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  const serviceDates = generateServiceDates(id, existing.start_date)
  await supabase.from('contract_service_dates').insert(serviceDates)

  try {
    const adminSupabase = createAdminClient()
    const { data: { user: customerUser } } = await adminSupabase.auth.admin.getUserById(contract.customer_id)

    if (customerUser?.email) {
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', contract.customer_id)
        .single()

      await sendContractActivated(
        {
          customerName: customerProfile?.name ?? 'Customer',
          numUnits: contract.num_units,
          priceSgd: parseFloat(contract.price_sgd),
          startDate: existing.start_date,
          firstServiceDate: serviceDates[0].due_date,
        },
        customerUser.email
      )
    }
  } catch {
    // Email failure does not fail activation
  }

  return NextResponse.json({ contract })
}
