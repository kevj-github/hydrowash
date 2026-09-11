import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateContractPdf } from '@/lib/pdf/generate'
import { formatDueMonth, previewServiceDueMonths } from '@/lib/contracts/service-dates'
import { contractUnitSummary } from '@/lib/contracts/units'
import { sendContractPricing } from '@/lib/email/send'
import { buildPayNowPayload } from '@/lib/utils/paynow'
import QRCode from 'qrcode'

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

  const body = await req.json()
  const { price_sgd, start_date, notes } = body

  if (!price_sgd || !start_date) {
    return NextResponse.json({ error: 'price_sgd and start_date are required' }, { status: 400 })
  }

  const priceNum = parseFloat(price_sgd)
  if (isNaN(priceNum) || priceNum <= 0) {
    return NextResponse.json({ error: 'price_sgd must be a positive number' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  if (existing.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'Contract must be in PENDING_REVIEW status' }, { status: 409 })
  }

  const endDateObj = new Date(`${start_date}T00:00:00Z`)
  endDateObj.setUTCFullYear(endDateObj.getUTCFullYear() + 1)
  const end_date = endDateObj.toISOString().split('T')[0]

  const { data: contract, error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'AWAITING_PAYMENT',
      price_sgd: priceNum,
      start_date,
      end_date,
      notes: notes ?? existing.notes,
    })
    .eq('id', id)
    .select('*, contract_service_dates(due_month), customer:profiles!contracts_customer_id_fkey(name, phone)')
    .single()

  if (updateError || !contract) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  // Send PDF + email immediately
  try {
    const [settingsResult, adminClient] = await Promise.all([
      supabase
        .from('app_settings')
        .select('paynow_mobile, company_address, company_phone, company_email, company_instagram, authorised_officer_name')
        .single(),
      Promise.resolve(createAdminClient()),
    ])
    const settings = settingsResult.data

    const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(contract.customer_id)
    if (!customerUser?.email) {
      return NextResponse.json({ contract, emailSent: false })
    }

    const contractServiceDates = (contract.contract_service_dates ?? []) as { due_month: string }[]
    const serviceDueMonths = contractServiceDates.length > 0
      ? contractServiceDates.map(sd => formatDueMonth(sd.due_month))
      : previewServiceDueMonths(start_date)

    const today = new Date()
    const issuedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

    const pdfBuf = await generateContractPdf({
      customerName: contract.customer?.name ?? customerUser.email,
      contactNo: contract.customer?.phone ?? '',
      address: contract.address ?? '',
      numUnits: contract.num_units,
      unitType: 'Wall Mounted Unit',
      unitSummary: contractUnitSummary(contract.unit_details ?? [], contract.num_units),
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

    // Upload PDF to Storage
    const storagePath = `contracts/${id}/contract.pdf`
    await adminClient.storage
      .from('documents')
      .upload(storagePath, pdfBuf, { contentType: 'application/pdf', upsert: true })
      .catch(err => console.error('[set-price] Storage upload failed:', err))

    // Generate PayNow QR
    let qrImageUrl: string | undefined
    let referenceId: string | undefined
    if (settings?.paynow_mobile) {
      referenceId = `CONTRACT-${id.slice(0, 8).toUpperCase()}`
      const payload = buildPayNowPayload(settings.paynow_mobile, priceNum, referenceId)
      const qrBuffer = await QRCode.toBuffer(payload, { width: 300, margin: 2 })
      const qrPath = `contracts/${id}/qr.png`
      await adminClient.storage
        .from('documents')
        .upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true })
      const { data: signedData } = await adminClient.storage
        .from('documents')
        .createSignedUrl(qrPath, 60 * 60 * 24 * 365)
      qrImageUrl = signedData?.signedUrl
    }

    await sendContractPricing(
      {
        customerName: contract.customer?.name ?? 'Customer',
        numUnits: contract.num_units,
        priceSgd: priceNum,
        startDate: contract.start_date,
        endDate: contract.end_date,
        address: contract.address ?? undefined,
        paynowQrDataUrl: qrImageUrl,
        paynowMobile: settings?.paynow_mobile ?? undefined,
        referenceId,
      },
      customerUser.email,
      pdfBuf
    )

    return NextResponse.json({ contract, emailSent: true })
  } catch (err) {
    console.error('[set-price] Email/PDF send failed:', err)
    return NextResponse.json({ contract, emailSent: false })
  }
}
