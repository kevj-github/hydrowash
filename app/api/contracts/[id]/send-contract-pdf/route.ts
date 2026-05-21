import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateContractPdf } from '@/lib/pdf/generate'
import { formatDueMonth } from '@/lib/contracts/service-dates'
import { sendContractPricing } from '@/lib/email/send'
import { buildPayNowPayload } from '@/lib/utils/paynow'
import QRCode from 'qrcode'

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

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, contract_service_dates(due_month), customer:profiles!contracts_customer_id_fkey(name, phone)')
    .eq('id', id)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  if (contract.status !== 'AWAITING_PAYMENT') {
    return NextResponse.json({ error: 'Contract must be in AWAITING_PAYMENT status' }, { status: 409 })
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('paynow_mobile, company_address, company_phone, company_email, company_instagram, authorised_officer_name')
    .single()

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(contract.customer_id)

  if (!customerUser?.email) {
    return NextResponse.json({ error: 'Customer email not found' }, { status: 422 })
  }

  const serviceDueMonths = (contract.contract_service_dates ?? [])
    .map((sd: { due_month: string }) => formatDueMonth(sd.due_month))

  const today = new Date()
  const issuedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
  const priceNum = parseFloat(contract.price_sgd)

  const pdfBuf = await generateContractPdf({
    customerName: contract.customer?.name ?? customerUser.email,
    contactNo: contract.customer?.phone ?? '',
    address: contract.address ?? '',
    numUnits: contract.num_units,
    unitType: 'Wall Mounted Unit',
    totalAmountSgd: priceNum,
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

  // Upload PDF to Supabase Storage
  const storagePath = `contracts/${id}/contract.pdf`
  const { error: uploadError } = await adminClient.storage
    .from('documents')
    .upload(storagePath, pdfBuf, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    console.error('[send-contract-pdf] Storage upload failed:', uploadError)
    // Non-fatal — continue with email
  }

  // Generate PayNow QR (optional — only if paynow_mobile is configured)
  let qrDataUrl: string | undefined
  let referenceId: string | undefined
  if (settings?.paynow_mobile) {
    referenceId = `CONTRACT-${id.slice(0, 8).toUpperCase()}`
    const payload = buildPayNowPayload(settings.paynow_mobile, priceNum, referenceId)
    qrDataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 })
  }

  await sendContractPricing(
    {
      customerName: contract.customer?.name ?? 'Customer',
      numUnits: contract.num_units,
      priceSgd: priceNum,
      startDate: contract.start_date,
      endDate: contract.end_date,
      address: contract.address ?? undefined,
      paynowQrDataUrl: qrDataUrl,
      paynowMobile: settings?.paynow_mobile ?? undefined,
      referenceId,
    },
    customerUser.email,
    pdfBuf
  )

  return NextResponse.json({ ok: true })
}
