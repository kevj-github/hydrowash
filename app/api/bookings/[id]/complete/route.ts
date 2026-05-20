import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AcUnitDetail, ChecklistItem, AdditionalCharge } from '@/lib/types'

export async function POST(
  req: NextRequest,
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
    .from('bookings').select('*').eq('id', id).single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Only APPROVED bookings can be completed' }, { status: 409 })
  }

  const body = await req.json() as {
    attended_by: string
    time_arrived: string
    time_completed: string
    ac_details: AcUnitDetail[]
    checklist: ChecklistItem[]
    job_description?: string
    job_rendered?: string
    remarks?: string
    additional_charges?: AdditionalCharge[]
    base_price_sgd: number
  }

  const additionalCharges = body.additional_charges ?? []
  const total_sgd = body.base_price_sgd + additionalCharges.reduce((sum, c) => sum + c.amount_sgd, 0)

  // Update booking status + attended_by (work_order_no auto-assigned by bigserial on first update if NULL)
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: 'COMPLETED', attended_by: body.attended_by })
    .eq('id', id)
  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 })
  }

  // Upsert job_completions
  const { data: jobCompletion, error: jcError } = await supabase
    .from('job_completions')
    .upsert({
      booking_id: id,
      completed_by: user.id,
      attended_by: body.attended_by,
      time_arrived: body.time_arrived,
      time_completed: body.time_completed,
      ac_details: body.ac_details,
      checklist: body.checklist,
      job_description: body.job_description ?? '',
      job_rendered: body.job_rendered ?? '',
      remarks: body.remarks ?? '',
      additional_charges: additionalCharges,
      base_price_sgd: body.base_price_sgd,
      total_sgd,
    }, { onConflict: 'booking_id' })
    .select()
    .single()

  if (jcError) {
    return NextResponse.json({ error: jcError.message }, { status: 500 })
  }

  return NextResponse.json({ jobCompletion })
}
