import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountSettingsClient from './AccountSettingsClient'

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/account/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, address, address_lat, address_lng, postal_code')
    .eq('id', user.id)
    .single()

  return (
    <Suspense>
      <AccountSettingsClient profile={profile ?? { name: '', phone: '', address: null, address_lat: null, address_lng: null, postal_code: null }} />
    </Suspense>
  )
}
