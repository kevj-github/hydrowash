// app/api/admin/ac-catalog/route.ts
// Admin CRUD for ac_unit_types and ac_brands.
// Query param: ?kind=unit_types | brands
// GET    → list all (active + inactive)
// POST   → create { label, display_order? }
// PATCH  → update { id, label?, display_order?, is_active? }
// DELETE → hard delete { id } (only if no invoices reference it — enforce at app layer)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type CatalogKind = 'unit_types' | 'brands'
const TABLE_MAP: Record<CatalogKind, 'ac_unit_types' | 'ac_brands'> = {
  unit_types: 'ac_unit_types',
  brands: 'ac_brands',
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

function resolveTable(req: Request): { table: 'ac_unit_types' | 'ac_brands'; error?: string } {
  const kind = new URL(req.url).searchParams.get('kind') as CatalogKind | null
  if (!kind || !TABLE_MAP[kind]) return { table: 'ac_unit_types', error: 'kind must be unit_types or brands' }
  return { table: TABLE_MAP[kind] }
}

export async function GET(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  const { data } = await supabase.from(table).select('*').order('display_order')
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { label, display_order } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 })
  const { data, error: dbError } = await supabase
    .from(table)
    .insert({ label: label.trim(), display_order: display_order ?? 99 })
    .select()
    .single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, label, display_order, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const updates: Record<string, unknown> = {}
  if (label !== undefined) updates.label = label.trim()
  if (display_order !== undefined) updates.display_order = display_order
  if (is_active !== undefined) updates.is_active = is_active
  const { error: dbError } = await supabase.from(table).update(updates).eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
