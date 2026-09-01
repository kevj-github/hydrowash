import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingRescheduled } from '@/lib/email/send'

const VALID_SLOTS = ['S10_12', 'S13_15', 'S15_17', 'S17_19', 'S19_21']

function isBeforeCutoff(effectiveDate: string): boolean {
  const cutoff = new Date(`${effectiveDate}T00:00:00+08:00`)
  cutoff.setTime(cutoff.getTime() - 24 * 60 * 60 * 1000)
  return Date.now() < cutoff.getTime()
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
    return NextResponse.json({ error: 'Booking cannot be rescheduled' }, { status: 409 })
  }

  const effectiveDate =
    booking.status === 'APPROVED'
      ? booking.confirmed_date
      : booking.preferred_date_slots?.[0]?.date ?? booking.booking_date

  if (!effectiveDate || !isBeforeCutoff(effectiveDate)) {
    return NextResponse.json({ error: 'Reschedule cutoff has passed' }, { status: 403 })
  }

  const body = await req.json()
  const { preferred_date_slots } = body as {
    preferred_date_slots?: { date: string; slots: string[] }[]
  }

  if (!preferred_date_slots?.length) {
    return NextResponse.json({ error: 'preferred_date_slots is required' }, { status: 400 })
  }
  if (preferred_date_slots.length > 3) {
    return NextResponse.json({ error: 'Maximum 3 date preferences allowed' }, { status: 400 })
  }

  const sanitisedEntries = preferred_date_slots
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map(e => ({
      date: e.date,
      slots: (e.slots ?? []).filter(s => VALID_SLOTS.includes(s)).slice(0, 3),
    }))
    .filter(e => e.slots.length > 0)

  if (!sanitisedEntries.length) {
    return NextResponse.json({ error: 'At least one valid date with slots required' }, { status: 400 })
  }

  const booking_date = sanitisedEntries[0].date
  const preferred_slots = sanitisedEntries[0].slots
  const time_slot = preferred_slots[0]

  const { data: updated, error } = await supabase
    .from('bookings')
    .update({
      status: 'PENDING',
      confirmed_date: null,
      confirmed_slot: null,
      booking_date,
      time_slot,
      preferred_slots,
      preferred_date_slots: sanitisedEntries,
    })
    .eq('id', id)
    .select('*, customer:profiles(name,phone), service_type:service_types(name)')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  // If the booking was APPROVED it may have held a contract service date slot — free it
  // so another booking can occupy it until admin approves this one again.
  if (booking.contract_id && booking.status === 'APPROVED') {
    const adminClient = createAdminClient()
    await adminClient
      .from('contract_service_dates')
      .update({ booking_id: null })
      .eq('booking_id', id)
      .eq('contract_id', booking.contract_id)
  }

  const adminEmail = await getAdminEmail(supabase)
  if (adminEmail) {
    await sendBookingRescheduled(
      {
        customerName: profile.name ?? 'Customer',
        bookingId: updated.id,
        serviceType: updated.service_type?.name ?? 'Service',
        newDateSlots: sanitisedEntries.map(entry => ({
          date: new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-SG', {
            day: 'numeric', month: 'short', year: 'numeric',
          }),
          slots: entry.slots,
        })),
      },
      adminEmail
    ).catch(err =>
      console.error(`[bookings reschedule] Failed to send admin email to ${adminEmail}:`, err)
    )
  }

  return NextResponse.json({ booking: updated })
}
