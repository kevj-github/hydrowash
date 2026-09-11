import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPaymentReminder } from '@/lib/email/send'
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

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, booking:bookings(confirmed_date, booking_date, service_type:service_types(name))')
    .eq('id', id)
    .single()

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status !== 'UNPAID') {
    return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 })
  }

  const { data: customerProfile } = await supabase
    .from('profiles').select('name').eq('id', invoice.customer_id).single()

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(invoice.customer_id)
  if (!customerUser?.email) {
    return NextResponse.json({ error: 'Customer has no email on file' }, { status: 422 })
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('paynow_mobile')
    .single()

  const booking = invoice.booking as { confirmed_date: string | null; booking_date: string | null; service_type: { name: string } | null } | null
  const amountSgd = parseFloat(invoice.amount_sgd)

  let paynowQrDataUrl: string | undefined
  const referenceId = `INV-${id.slice(0, 8).toUpperCase()}`
  if (settings?.paynow_mobile) {
    const payload = buildPayNowPayload(settings.paynow_mobile, amountSgd, referenceId)
    // Generate as PNG buffer and upload to Storage — data URLs are blocked by email clients.
    const qrBuffer = await QRCode.toBuffer(payload, { width: 300, margin: 2 })
    const qrPath = `invoices/${id}/reminder-qr.png`
    await adminClient.storage
      .from('documents')
      .upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true })
    const { data: signedData } = await adminClient.storage
      .from('documents')
      .createSignedUrl(qrPath, 60 * 60 * 24 * 7) // 1 week — reminder emails are ad-hoc, not archived
    paynowQrDataUrl = signedData?.signedUrl
  }

  await sendPaymentReminder(
    {
      customerName: customerProfile?.name ?? 'Customer',
      amountSgd,
      serviceLabel: booking?.service_type?.name,
      serviceDate: (booking?.confirmed_date ?? booking?.booking_date) ?? undefined,
      paynowQrDataUrl,
      paynowMobile: settings?.paynow_mobile ?? undefined,
      referenceId,
    },
    customerUser.email
  )

  return NextResponse.json({ ok: true })
}
