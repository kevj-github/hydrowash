import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingCancelled } from '@/lib/email/send'

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000

function isBeforeCutoff(effectiveDate: string): boolean {
  const cutoff = new Date(`${effectiveDate}T00:00:00+08:00`)
  cutoff.setTime(cutoff.getTime() - 24 * 60 * 60 * 1000)
  return new Date(Date.now() + SGT_OFFSET_MS) < cutoff
}

async function getAdminEmail(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: settings } = await supabase
    .from('app_settings')
    .select('contact_email')
    .single()
  return settings?.contact_email ?? process.env.ADMIN_EMAIL ?? null
}

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
    .select('role,name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, service_type:service_types(name)')
    .eq('id', id)
    .eq('customer_id', user.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  if (!['PENDING', 'APPROVED'].includes(booking.status)) {
    return NextResponse.json({ error: 'Booking cannot be cancelled' }, { status: 409 })
  }

  const effectiveDate =
    booking.status === 'APPROVED'
      ? booking.confirmed_date
      : booking.preferred_date_slots?.[0]?.date ?? booking.booking_date

  if (!effectiveDate || !isBeforeCutoff(effectiveDate)) {
    return NextResponse.json({ error: 'Cancellation cutoff has passed' }, { status: 403 })
  }

  const body = await req.json()
  const { reason } = body as { reason?: string }

  const { data: updated, error } = await supabase
    .from('bookings')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancelled_reason: reason ?? null,
    })
    .eq('id', id)
    .select('*, customer:profiles(name,phone), service_type:service_types(name)')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  // Free the contract service date slot if this booking was linked to one.
  if (booking.contract_id) {
    const adminClient = createAdminClient()
    await adminClient
      .from('contract_service_dates')
      .update({ booking_id: null })
      .eq('booking_id', id)
      .eq('contract_id', booking.contract_id)
  }

  const adminEmail = await getAdminEmail(supabase)
  if (adminEmail) {
    await sendBookingCancelled(
      {
        customerName: profile.name ?? 'Customer',
        bookingId: updated.id,
        serviceType: updated.service_type?.name ?? 'Service',
        reason: reason ?? undefined,
      },
      adminEmail
    ).catch(err =>
      console.error(`[bookings cancel] Failed to send admin email to ${adminEmail}:`, err)
    )
  }

  return NextResponse.json({ booking: updated })
}
