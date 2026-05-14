import { createClient } from '@/lib/supabase/server'
import { BookingWizard } from '@/components/booking/BookingWizard'
import { SectionHeading } from '@/components/ui/section-heading'

export default async function BookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [serviceTypesRes, profileRes] = await Promise.all([
    supabase.from('service_types').select('*').eq('active', true).order('category'),
    user
      ? supabase.from('profiles').select('address, address_lat, address_lng, postal_code').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const profile = profileRes.data
  const profileAddress =
    profile?.address && profile.address_lat
      ? {
          address: profile.address,
          postal_code: profile.postal_code ?? '',
          lat: profile.address_lat,
          lng: profile.address_lng!,
        }
      : null

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <SectionHeading
          label="Book a Service"
          title="Schedule Your Visit"
          subtitle="Complete the steps below to submit your booking request."
          align="center"
          className="mb-10"
        />
        <BookingWizard serviceTypes={serviceTypesRes.data ?? []} profileAddress={profileAddress} />
      </div>
    </div>
  )
}
