// app/api/admin/ac-catalog/route.ts
// Admin CRUD for ac_unit_types, ac_brands, ac_unit_locations and staff_members.
// Query param: ?kind=unit_types | brands | locations | staff
// GET    → list all (active + inactive); staff kind is admin-only, the rest are public
// POST   → create { label, display_order?, is_default? } — is_default only meaningful for staff
// PATCH  → update { id, label?, display_order?, is_active?, is_default? }
// DELETE → hard delete { id } (only if no invoices reference it — enforce at app layer)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type CatalogKind = 'unit_types' | 'brands' | 'locations' | 'staff'
type CatalogTable = 'ac_unit_types' | 'ac_brands' | 'ac_unit_locations' | 'staff_members'
const TABLE_MAP: Record<CatalogKind, CatalogTable> = {
  unit_types: 'ac_unit_types',
  brands: 'ac_brands',
  locations: 'ac_unit_locations',
  staff: 'staff_members',
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

function resolveTable(req: Request): { table: CatalogTable; error?: string } {
  const kind = new URL(req.url).searchParams.get('kind') as CatalogKind | null
  if (!kind || !TABLE_MAP[kind]) {
    return { table: 'ac_unit_types', error: 'kind must be unit_types, brands, locations or staff' }
  }
  return { table: TABLE_MAP[kind] }
}

export async function GET(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  // staff_members is admin-only data (RLS also enforces this, but an explicit
  // 403 is clearer than a silently empty list for the other three catalogs).
  if (table === 'staff_members' && !await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const activeOnly = new URL(req.url).searchParams.get('active') === 'true'
  let query = supabase.from(table).select('*').order('display_order')
  if (activeOnly) query = query.eq('is_active', true)
  const { data } = await query
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { label, display_order, is_default } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 })
  // A partial unique index enforces at most one is_default=true row — clear the
  // existing default first so setting a new one never conflicts with it.
  if (is_default) await supabase.from(table).update({ is_default: false }).eq('is_default', true)
  const { data, error: dbError } = await supabase
    .from(table)
    .insert({ label: label.trim(), display_order: display_order ?? 99, ...(is_default !== undefined && { is_default }) })
    .select()
    .single()
  if (dbError) return NextResponse.json({ error: dbError.message, code: dbError.code }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, label, display_order, is_active, is_default } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (is_default === true) await supabase.from(table).update({ is_default: false }).eq('is_default', true)
  const updates: Record<string, unknown> = {}
  if (label !== undefined) updates.label = label.trim()
  if (display_order !== undefined) updates.display_order = display_order
  if (is_active !== undefined) updates.is_active = is_active
  if (is_default !== undefined) updates.is_default = is_default
  const { error: dbError } = await supabase.from(table).update(updates).eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message, code: dbError.code }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { table, error } = resolveTable(req)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error: dbError } = await supabase.from(table).delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message, code: dbError.code }, { status: 500 })
  return NextResponse.json({ ok: true })
}
