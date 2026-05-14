import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { TimeSlot } from '@/lib/types'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

// POST — replace all blocks for a date
// Body: { date: string, blockEntireDay: boolean, slots: TimeSlot[], reason?: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { date, blockEntireDay, slots, reason } = body as {
    date: string
    blockEntireDay: boolean
    slots: TimeSlot[]
    reason?: string
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }

  // Delete all existing blocks for this date
  const { error: delError } = await supabase
    .from('blocked_slots')
    .delete()
    .eq('blocked_date', date)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  if (!blockEntireDay && (!slots || slots.length === 0)) {
    return NextResponse.json({ success: true })
  }

  const rows: { blocked_date: string; slot: string | null; reason: string | null }[] = blockEntireDay
    ? [{ blocked_date: date, slot: null, reason: reason ?? null }]
    : slots.map((slot: string) => ({ blocked_date: date, slot, reason: reason ?? null }))

  const { error: insertError } = await supabase.from('blocked_slots').insert(rows)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE — clear all blocks for a date
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const date = request.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date param required' }, { status: 400 })

  const { error } = await supabase.from('blocked_slots').delete().eq('blocked_date', date)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
