import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWorkOrderPdf } from '@/lib/pdf/generate'
import type { WorkOrderProps } from '@/lib/pdf/WorkOrderTemplate'

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

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, service_type:service_types(name, category), customer:profiles!bookings_customer_id_fkey(name, phone, customer_no)')
    .eq('id', id)
    .single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  if (profile.role !== 'admin' && booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: jc } = await supabase
    .from('job_completions').select('*').eq('booking_id', id).single()
  if (!jc) return NextResponse.json({ error: 'Job completion not found' }, { status: 404 })

  const { data: settings } = await supabase
    .from('app_settings')
    .select('company_address, company_phone, company_email')
    .single()

  const adminClient = createAdminClient()
  const { data: { user: customerUser } } = await adminClient.auth.admin.getUserById(booking.customer_id)

  // Determine if linked to a contract service date
  const { data: linkedCsd } = await supabase
    .from('contract_service_dates')
    .select('id, contract_id, contracts(num_units)')
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

  const props: WorkOrderProps = {
    workOrderNo: booking.work_order_no ?? 0,
    customerName: booking.customer?.name ?? customerUser?.email ?? 'Customer',
    customerNo: booking.customer?.customer_no ?? 0,
    contactNo: booking.customer?.phone ?? customerUser?.phone ?? '',
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
    totalSgd: parseFloat(jc.total_sgd) || 0,
    company: {
      address: settings?.company_address ?? '404B Fernvale Lane, S792404',
      phone: settings?.company_phone ?? '(+65) 8811 1105',
      email: settings?.company_email ?? 'hydrowash20@gmail.com',
    },
  }

  const buf = await generateWorkOrderPdf(props)

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="work-order-${booking.work_order_no ?? id}.pdf"`,
    },
  })
}
