import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAdminDelete } from '@/lib/admin/audit-log'
import { sanitizeUnitDetails, isUnitDetailsComplete, normalizeUnitDetails } from '@/lib/contracts/units'

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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  const allowed = ['price_sgd', 'notes', 'address', 'start_date', 'end_date', 'num_units', 'unit_details'] as const
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body && body[key] !== undefined) {
      if (key === 'price_sgd') updates[key] = parseFloat(body[key])
      else if (key === 'num_units') updates[key] = parseInt(body[key])
      else if (key !== 'unit_details') updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  if ('unit_details' in body && body.unit_details !== undefined) {
    const effectiveNumUnits = (updates.num_units as number | undefined)
      ?? (await supabase.from('contracts').select('num_units').eq('id', id).single()).data?.num_units
      ?? 0
    const normalized = normalizeUnitDetails(body.unit_details, effectiveNumUnits)
    const hasUnitDetails = (body.unit_details?.length ?? 0) > 0
    if (hasUnitDetails && !isUnitDetailsComplete(normalized, effectiveNumUnits)) {
      return NextResponse.json({ error: 'unit_details must have one complete entry per unit' }, { status: 400 })
    }
    updates.unit_details = hasUnitDetails
      ? await sanitizeUnitDetails(supabase, body.unit_details, effectiveNumUnits)
      : []
  } else if ('num_units' in updates) {
    // num_units changed without an accompanying unit_details update — clear any
    // existing per-unit details rather than leave them mismatched (CHECK
    // constraint requires unit_details.length to be 0 or exactly num_units).
    const { data: current } = await supabase.from('contracts').select('unit_details, num_units').eq('id', id).single()
    const existingLen = Array.isArray(current?.unit_details) ? current.unit_details.length : 0
    if (existingLen > 0 && existingLen !== updates.num_units) {
      updates.unit_details = []
    }
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ contract })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

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

  const adminClient = createAdminClient()

  const { data: existingData } = await adminClient
    .from('contracts')
    .select('id, customer:profiles(name), status, start_date, end_date')
    .eq('id', id)
    .single()

  const existing = existingData as {
    id: string
    customer: { name: string } | null
    status: string
    start_date: string
    end_date: string
  } | null

  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  const { error } = await adminClient.from('contracts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminDelete(adminClient, user.id, 'contract', [{
    id: existing.id,
    label: `${existing.customer?.name ?? 'Unknown'} — ${existing.status} — ${existing.start_date} to ${existing.end_date}`,
  }])

  return NextResponse.json({ deleted: true })
}
