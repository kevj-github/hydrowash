import { createClient } from '@/lib/supabase/server'
import { BookingWizard } from '@/components/booking/BookingWizard'
import { SectionHeading } from '@/components/ui/section-heading'

export default async function BookPage() {
  const supabase = await createClient()
  const { data: serviceTypes } = await supabase
    .from('service_types')
    .select('*')
    .eq('active', true)
    .order('category')

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
        <BookingWizard serviceTypes={serviceTypes ?? []} />
      </div>
    </div>
  )
}
