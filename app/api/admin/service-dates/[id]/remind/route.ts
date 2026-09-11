import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendContractServiceDue } from '@/lib/email/send'
import { formatDueMonth } from '@/lib/contracts/service-dates'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: serviceDate } = await supabase
    .from('contract_service_dates')
    .select('id, contract_id, due_month, contracts!inner(customer_id, num_units, customer:profiles!contracts_customer_id_fkey(name))')
    .eq('id', id)
    .single()

  if (!serviceDate) return NextResponse.json({ error: 'Service date not found' }, { status: 404 })

  const contract = serviceDate.contracts as unknown as {
    customer_id: string
    num_units: number
    customer: { name: string } | null
  }

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(contract.customer_id)
  if (!customerUser?.email) {
    return NextResponse.json({ error: 'Customer has no email on file' }, { status: 422 })
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.hydrowash.services'
  // Deep-link straight to the contract that triggered this reminder — a
  // customer can have more than one contract, so a bare /book link would
  // leave them to figure out (or re-select) which one this visit is for.
  await sendContractServiceDue(
    {
      customerName: contract.customer?.name ?? 'Customer',
      numUnits: contract.num_units,
      dueDate: formatDueMonth(serviceDate.due_month),
      bookUrl: `${APP_URL}/book?contract=${serviceDate.contract_id}`,
    },
    customerUser.email
  )

  return NextResponse.json({ ok: true })
}
