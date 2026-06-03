import { createClient } from '@/lib/supabase/server'
import { AdminBookingsClient } from './AdminBookingsClient'

export default async function AdminBookingsPage() {
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, customer:profiles(name,phone), service_type:service_types(name,duration_minutes,price_sgd), contract_service_dates(id,due_month,contract_id)')
    .order('created_at', { ascending: false })

  // Compute visit numbers for bookings that are linked to contract service dates
  const linkedContractIds = [...new Set(
    (bookings ?? [])
      .flatMap(b => (b.contract_service_dates ?? []).map((csd: { contract_id: string }) => csd.contract_id))
      .filter(Boolean)
  )]

  let visitMap: Record<string, { visitNo: number; totalVisits: number }> = {}
  if (linkedContractIds.length > 0) {
    const { data: allCsds } = await supabase
      .from('contract_service_dates')
      .select('id, contract_id, due_month')
      .in('contract_id', linkedContractIds)
      .order('due_month', { ascending: true })

    const byContract = (allCsds ?? []).reduce<Record<string, { id: string; due_month: string }[]>>((acc, csd) => {
      acc[csd.contract_id] = acc[csd.contract_id] ?? []
      acc[csd.contract_id].push(csd)
      return acc
    }, {})

    for (const booking of bookings ?? []) {
      const csd = (booking.contract_service_dates ?? [])[0] as { id: string; contract_id: string } | undefined
      if (!csd) continue
      const list = byContract[csd.contract_id] ?? []
      const idx = list.findIndex((c: { id: string }) => c.id === csd.id)
      if (idx >= 0) visitMap[booking.id] = { visitNo: idx + 1, totalVisits: list.length }
    }
  }

  return <AdminBookingsClient initialBookings={bookings ?? []} initialVisitMap={visitMap} />
}
