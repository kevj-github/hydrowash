import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPaymentReceived } from '@/lib/email/send'
import { MarkInvoicePaidPayload } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

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

  const { payment_method }: MarkInvoicePaidPayload = await req.json()

  const validMethods = ['Cash', 'PayNow', 'Bank Transfer', 'Other']
  if (!payment_method || !validMethods.includes(payment_method)) {
    return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update({
      status: 'PAID',
      payment_method,
      paid_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, booking:bookings(confirmed_date, booking_date, service_type:service_types(name))')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: customerProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', invoice.customer_id)
    .single()

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(invoice.customer_id)

  if (customerUser?.email) {
    const booking = invoice.booking as { confirmed_date: string | null; booking_date: string | null; service_type: { name: string } | null } | null
    const paidAt = new Date(invoice.paid_at)
    await sendPaymentReceived(
      {
        customerName: customerProfile?.name ?? 'Customer',
        description: invoice.description,
        amountSgd: parseFloat(invoice.amount_sgd),
        paymentMethod: payment_method,
        paidDate: paidAt.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
        serviceLabel: booking?.service_type?.name,
        serviceDate: (booking?.confirmed_date ?? booking?.booking_date) ?? undefined,
      },
      customerUser.email
    ).catch(err => console.error(`[invoices pay] Failed to send payment-received email to ${customerUser.email}:`, err))
  }

  return NextResponse.json({ invoice })
}
