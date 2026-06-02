import { createClient } from '@/lib/supabase/server'
import { AdminSettingsClient } from './AdminSettingsClient'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const [settingsRes, serviceTypesRes, brandsRes, unitTypesRes, locationsRes] = await Promise.all([
    supabase.from('app_settings').select('*').single(),
    supabase.from('service_types').select('*').order('category').order('name'),
    supabase.from('ac_brands').select('*').order('display_order'),
    supabase.from('ac_unit_types').select('*').order('display_order'),
    supabase.from('ac_unit_locations').select('*').order('display_order'),
  ])

  return (
    <AdminSettingsClient
      initialSettings={settingsRes.data}
      initialServiceTypes={serviceTypesRes.data ?? []}
      initialBrands={brandsRes.data ?? []}
      initialUnitTypes={unitTypesRes.data ?? []}
      initialLocations={locationsRes.data ?? []}
    />
  )
}
