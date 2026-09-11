import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { customer_no, confirm } = await req.json() as { customer_no: number; confirm?: boolean }

  if (!Number.isInteger(customer_no) || customer_no < 0) {
    return NextResponse.json({ error: 'customer_no must be a positive integer' }, { status: 400 })
  }

  const { data: conflict } = await supabase
    .from('profiles')
    .select('id, name, customer_no')
    .eq('customer_no', customer_no)
    .neq('id', id)
    .maybeSingle()

  if (conflict) {
    return NextResponse.json({
      conflict: true,
      conflictWith: { id: conflict.id, name: conflict.name, customer_no: conflict.customer_no },
    })
  }

  if (!confirm) {
    // Preventive check only — no conflict found, but the admin still needs to
    // explicitly confirm before this is written.
    return NextResponse.json({ conflict: false })
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ customer_no })
    .eq('id', id)
    .select('id, customer_no')
    .single()

  if (error) {
    // Unique index race: someone else claimed this number between the check above and this write.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That number was just taken by another customer. Please try a different number.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, customer: updated })
}
