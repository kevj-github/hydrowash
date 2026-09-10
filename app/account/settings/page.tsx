import { Suspense } from 'react'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountSettingsClient from './AccountSettingsClient'

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/auth/login?redirect=/account/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, address, address_lat, address_lng, postal_code, unit_floor, building_name')
    .eq('id', user.id)
    .single()

  return (
    <Suspense>
      <AccountSettingsClient profile={profile ?? { name: '', phone: '', address: null, address_lat: null, address_lng: null, postal_code: null, unit_floor: null, building_name: null }} />
    </Suspense>
  )
}
