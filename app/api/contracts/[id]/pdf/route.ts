import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateContractPdf } from '@/lib/pdf/generate'
import { formatDueMonth, previewServiceDueMonths } from '@/lib/contracts/service-dates'
import { contractUnitSummary } from '@/lib/contracts/units'
import { buildContractPdfFilename } from '@/lib/utils/pdf-filename'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, contract_service_dates(due_month), customer:profiles!contracts_customer_id_fkey(name, phone)')
    .eq('id', id)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (profile.role !== 'admin' && contract.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('company_address, company_phone, company_email, company_instagram, authorised_officer_name')
    .single()

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(contract.customer_id)

  const contractServiceDates = (contract.contract_service_dates ?? []) as { due_month: string }[]
  const serviceDueMonths = contractServiceDates.length > 0
    ? contractServiceDates.map(sd => formatDueMonth(sd.due_month))
    : contract.start_date ? previewServiceDueMonths(contract.start_date) : []

  const today = new Date()
  const issuedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

  const buf = await generateContractPdf({
    customerName: contract.customer?.name ?? customerUser?.email ?? 'Customer',
    contactNo: contract.customer?.phone ?? customerUser?.phone ?? '',
    address: contract.address ?? '',
    numUnits: contract.num_units,
    unitType: 'Wall Mounted Unit',
    unitSummary: contractUnitSummary(contract.unit_details ?? [], contract.num_units),
    totalAmountSgd: contract.price_sgd ? parseFloat(contract.price_sgd) : 0,
    serviceDueMonths,
    issuedDate,
    company: {
      address: settings?.company_address ?? '404B Fernvale Lane, S792404',
      phone: settings?.company_phone ?? '(+65) 8811 1105',
      email: settings?.company_email ?? 'hydrowash20@gmail.com',
      instagram: settings?.company_instagram ?? '@Hydrowash.sg',
      officerName: settings?.authorised_officer_name ?? 'Gilbert Chen',
    },
  })

  const pdfFilename = buildContractPdfFilename({ customerName: contract.customer?.name, startDate: contract.start_date })

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdfFilename}"`,
    },
  })
}
