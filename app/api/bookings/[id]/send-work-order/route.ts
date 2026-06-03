import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWorkOrderPdf } from '@/lib/pdf/generate'
import { sendWorkOrderReport } from '@/lib/email/send'
import { buildPayNowPayload } from '@/lib/utils/paynow'
import QRCode from 'qrcode'
import type { WorkOrderProps } from '@/lib/pdf/WorkOrderTemplate'

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

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, service_type:service_types(name, category), customer:profiles!bookings_customer_id_fkey(name, phone, customer_no)')
    .eq('id', id)
    .single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Booking must be COMPLETED' }, { status: 409 })
  }

  const { data: jc } = await supabase
    .from('job_completions').select('*').eq('booking_id', id).single()
  if (!jc) return NextResponse.json({ error: 'Job completion not found — complete the job first' }, { status: 404 })

  const { data: settings } = await supabase
    .from('app_settings')
    .select('paynow_mobile, company_address, company_phone, company_email')
    .single()

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(booking.customer_id)
  if (!customerUser?.email) {
    return NextResponse.json({ error: 'Customer email not found' }, { status: 422 })
  }

  // Determine contract link
  const { data: linkedCsd } = await supabase
    .from('contract_service_dates')
    .select('id, contract_id')
    .eq('booking_id', id)
    .maybeSingle()

  let visitNo: number | undefined
  let totalVisits = 4
  if (linkedCsd) {
    const { data: allCsds } = await supabase
      .from('contract_service_dates')
      .select('id, due_month')
      .eq('contract_id', linkedCsd.contract_id)
      .order('due_month', { ascending: true })
    const idx = allCsds?.findIndex((c: { id: string }) => c.id === linkedCsd.id) ?? -1
    visitNo = idx >= 0 ? idx + 1 : undefined
    totalVisits = allCsds?.length ?? 4
  }

  const date = new Date(jc.completed_at)
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  const totalSgd = parseFloat(jc.total_sgd) || 0

  const props: WorkOrderProps = {
    workOrderNo: booking.work_order_no ?? 0,
    customerName: booking.customer?.name ?? customerUser.email,
    customerNo: booking.customer?.customer_no ?? 0,
    contactNo: booking.customer?.phone ?? '',
    address: booking.address ?? '',
    date: dateStr,
    serviceType: linkedCsd ? 'Annual Contract' : 'AdHoc',
    visitNo,
    totalVisits: visitNo ? totalVisits : undefined,
    acDetails: jc.ac_details ?? [],
    checklist: jc.checklist ?? [],
    jobDescription: jc.job_description ?? '',
    jobRendered: jc.job_rendered ?? '',
    remarks: jc.remarks ?? '',
    attendedBy: jc.attended_by ?? '',
    timeArrived: jc.time_arrived ?? '',
    timeCompleted: jc.time_completed ?? '',
    additionalCharges: jc.additional_charges ?? [],
    basePriceSgd: parseFloat(jc.base_price_sgd) || 0,
    totalSgd,
    company: {
      address: settings?.company_address ?? '404B Fernvale Lane, S792404',
      phone: settings?.company_phone ?? '(+65) 8811 1105',
      email: settings?.company_email ?? 'hydrowash20@gmail.com',
    },
  }

  const pdfBuf = await generateWorkOrderPdf(props)

  // Upload to Storage
  const storagePath = `work-orders/${id}/work-order.pdf`
  await adminClient.storage
    .from('documents')
    .upload(storagePath, pdfBuf, { contentType: 'application/pdf', upsert: true })
    .catch(err => console.error('[send-work-order] Storage upload failed:', err))

  await supabase.from('job_completions').update({ pdf_url: storagePath }).eq('booking_id', id)

  // Generate PayNow QR — upload PNG to Storage so email clients can display it
  const referenceId = `WO-${booking.work_order_no ?? id.slice(0, 8).toUpperCase()}`
  let qrImageUrl = ''
  if (settings?.paynow_mobile) {
    const payload = buildPayNowPayload(settings.paynow_mobile, totalSgd, referenceId)
    const qrBuffer = await QRCode.toBuffer(payload, { width: 300, margin: 2 })
    const qrPath = `work-orders/${id}/qr.png`
    await adminClient.storage
      .from('documents')
      .upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true })
    const { data: signedData } = await adminClient.storage
      .from('documents')
      .createSignedUrl(qrPath, 60 * 60 * 24 * 365) // 1 year
    qrImageUrl = signedData?.signedUrl ?? ''
  }

  await sendWorkOrderReport(
    {
      customerName: booking.customer?.name ?? 'Customer',
      workOrderNo: booking.work_order_no ?? 0,
      date: dateStr,
      serviceType: linkedCsd ? 'Annual Contract' : 'AdHoc',
      address: booking.address ?? '',
      totalSgd,
      paynowQrDataUrl: qrImageUrl,
      paynowMobile: settings?.paynow_mobile ?? '',
      referenceId,
    },
    customerUser.email,
    pdfBuf
  )

  // Create invoice row
  await supabase.from('invoices').insert({
    customer_id: booking.customer_id,
    booking_id: id,
    contract_id: linkedCsd?.contract_id ?? null,
    amount_sgd: totalSgd,
    status: 'UNPAID',
    description: `Work Order #${booking.work_order_no ?? ''}`,
  })

  return NextResponse.json({ ok: true })
}
