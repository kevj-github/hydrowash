import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateInvoicePayload } from '@/lib/types'

export async function POST(req: NextRequest) {
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

  const body: CreateInvoicePayload = await req.json()
  const { customer_id, booking_id, contract_id, amount_sgd, description } = body

  if (!customer_id || !amount_sgd || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      customer_id,
      booking_id: booking_id ?? null,
      contract_id: contract_id ?? null,
      amount_sgd,
      description,
      status: 'UNPAID',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoice }, { status: 201 })
}

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const customerId = searchParams.get('customer_id')
  const contractId = searchParams.get('contract_id')

  let query = supabase
    .from('invoices')
    .select(`
      *,
      customer:profiles!invoices_customer_id_fkey (id, name, phone)
    `)
    .order('created_at', { ascending: false })

  if (status && ['UNPAID', 'PAID'].includes(status)) {
    query = query.eq('status', status)
  }
  if (customerId) {
    query = query.eq('customer_id', customerId)
  }
  if (contractId) {
    query = query.eq('contract_id', contractId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoices: data })
}
