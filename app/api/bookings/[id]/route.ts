import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBookingApproved, sendBookingRejected } from '@/lib/email/send'
import { NextRequest, NextResponse } from 'next/server'
import type { BookingWithRelations } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .eq('customer_id', user.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const { data: unitLocations } = await supabase
    .from('booking_unit_locations')
    .select('location_id')
    .eq('booking_id', id)

  return NextResponse.json({
    booking,
    unit_location_ids: (unitLocations ?? []).map((row: { location_id: string }) => row.location_id),
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || !profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { action, confirmed_date, confirmed_slot, rejection_reason, cancel_reason } = body

  const updates: Record<string, string | null> = {}
  if (action === 'approve') {
    updates.status = 'APPROVED'
    if (confirmed_date) updates.confirmed_date = confirmed_date
    if (confirmed_slot) updates.confirmed_slot = confirmed_slot
  } else if (action === 'reject') {
    updates.status = 'REJECTED'
    if (rejection_reason) updates.rejection_reason = rejection_reason
  } else if (action === 'cancel') {
    const { data: current } = await supabase.from('bookings').select('status').eq('id', id).single()
    if (current?.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Only an approved booking can be cancelled this way' }, { status: 409 })
    }
    updates.status = 'CANCELLED'
    updates.cancelled_at = new Date().toISOString()
    updates.cancelled_by = user.id
    updates.cancelled_reason = cancel_reason ?? null
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const adminClient = createAdminClient()

  if (action === 'approve' && booking.contract_id) {
    // Link booking to the next unlinked service date slot now that admin has approved.
    const { data: nextCsd } = await adminClient
      .from('contract_service_dates')
      .select('id')
      .eq('contract_id', booking.contract_id)
      .is('booking_id', null)
      .order('due_month', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (nextCsd) {
      await adminClient
        .from('contract_service_dates')
        .update({ booking_id: booking.id })
        .eq('id', nextCsd.id)
    }
  } else if ((action === 'reject' || action === 'cancel') && booking.contract_id) {
    // Free the linked service date slot on rejection/cancellation.
    await adminClient
      .from('contract_service_dates')
      .update({ booking_id: null })
      .eq('booking_id', booking.id)
      .eq('contract_id', booking.contract_id)
  }

  const { data: authUser } = await adminClient.auth.admin.getUserById(booking.customer_id)
  const email = authUser?.user?.email

  if (email) {
    if (action === 'approve') {
      await sendBookingApproved(booking, email).catch(err =>
        console.error(`[bookings PATCH] Failed to send approved email to ${email}:`, err)
      )
    } else if (action === 'reject') {
      await sendBookingRejected(booking, email).catch(err =>
        console.error(`[bookings PATCH] Failed to send rejected email to ${email}:`, err)
      )
    } else if (action === 'cancel') {
      const cancelledBooking: BookingWithRelations = {
        ...booking,
        rejection_reason: cancel_reason ?? 'This booking has been cancelled by our team. Please contact us if you have any questions.',
      }
      await sendBookingRejected(cancelledBooking, email).catch(err =>
        console.error(`[bookings PATCH] Failed to send cancellation email to ${email}:`, err)
      )
    }
  }

  return NextResponse.json(booking)
}
