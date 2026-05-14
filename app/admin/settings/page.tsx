import { createClient } from '@/lib/supabase/server'
import { AdminSettingsClient } from './AdminSettingsClient'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const [settingsRes, serviceTypesRes] = await Promise.all([
    supabase.from('app_settings').select('*').single(),
    supabase.from('service_types').select('*').order('category').order('name'),
  ])

  return (
    <AdminSettingsClient
      initialSettings={settingsRes.data}
      initialServiceTypes={serviceTypesRes.data ?? []}
    />
  )
}
