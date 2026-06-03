import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, phone, address, address_lat, address_lng, postal_code, unit_floor, building_name } = body

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      name: name.trim(),
      phone: phone.trim(),
      address,
      address_lat,
      address_lng,
      postal_code,
      unit_floor: unit_floor?.trim() || null,
      building_name: building_name?.trim() || null,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
