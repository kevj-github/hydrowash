import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractActivated } from '@/lib/email/send'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { price_sgd, start_date, notes } = body

  if (!price_sgd || !start_date) {
    return NextResponse.json({ error: 'price_sgd and start_date are required' }, { status: 400 })
  }

  // Verify contract is in PENDING_REVIEW
  const { data: existing } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  if (existing.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'Contract is not pending review' }, { status: 409 })
  }

  const startDateObj = new Date(start_date)
  const endDateObj = new Date(startDateObj)
  endDateObj.setFullYear(endDateObj.getFullYear() + 1)
  const end_date = endDateObj.toISOString().split('T')[0]

  const { data: contract, error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'ACTIVE',
      price_sgd: parseFloat(price_sgd),
      start_date,
      end_date,
      notes: notes ?? existing.notes,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !contract) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  // Generate 4 quarterly service dates
  const serviceDates = [1, 2, 3, 4].map((n) => {
    const d = new Date(startDateObj)
    d.setMonth(d.getMonth() + 3 * n)
    return {
      contract_id: id,
      due_date: d.toISOString().split('T')[0],
      reminder_sent: false,
      booking_id: null,
    }
  })

  await supabase.from('contract_service_dates').insert(serviceDates)

  // Send activation email
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
          priceSgd: parseFloat(price_sgd),
          startDate: start_date,
          firstServiceDate: serviceDates[0].due_date,
        },
        customerUser.email
      )
    }
  } catch {
    // Email failure doesn't fail the activation
  }

  return NextResponse.json({ contract })
}
