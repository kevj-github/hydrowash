import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = ['MAINTENANCE', 'FAULT_REPAIR', 'INSTALLATION']

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, category, description, duration_minutes, price_sgd } = await req.json()

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: 'invalid category' }, { status: 400 })

  const { data, error } = await supabase.from('service_types').insert({
    name: name.trim(),
    category,
    description: description?.trim() ?? '',
    duration_minutes: duration_minutes ? Number(duration_minutes) : null,
    price_sgd: price_sgd ? Number(price_sgd) : null,
    active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, category, description, duration_minutes, price_sgd, active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: 'invalid category' }, { status: 400 })
    updates.category = category
  }
  if (description !== undefined) updates.description = description.trim()
  if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes ? Number(duration_minutes) : null
  if (price_sgd !== undefined) updates.price_sgd = price_sgd ? Number(price_sgd) : null
  if (active !== undefined) updates.active = active

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no fields to update' }, { status: 400 })

  const { data, error } = await supabase.from('service_types').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('service_types').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  return NextResponse.json({ ok: true })
}
