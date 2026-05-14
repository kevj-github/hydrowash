import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MarkInvoicePaidPayload } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

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

  const { payment_method }: MarkInvoicePaidPayload = await req.json()

  const validMethods = ['Cash', 'PayNow', 'Bank Transfer', 'Other']
  if (!payment_method || !validMethods.includes(payment_method)) {
    return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update({
      status: 'PAID',
      payment_method,
      paid_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoice })
}
