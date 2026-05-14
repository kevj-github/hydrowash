import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/maps/geocode'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { address } = await request.json()
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const result = await geocodeAddress(address)
  if (!result) return NextResponse.json({ error: 'Address not found' }, { status: 422 })

  return NextResponse.json(result)
}
