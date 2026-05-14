import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { BookingWithRelations } from '@/lib/types'

export function ScheduleConfirmed({
  jobs,
  date,
}: {
  jobs: BookingWithRelations[]
  date: string
}) {
  return (
    <Html>
      <Head />
      <Preview>Schedule confirmed for {date}</Preview>
      <Body style={{ fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <Container style={{ maxWidth: 480, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 8 }}>
          <Heading style={{ color: '#0f172a' }}>Schedule Confirmed — {date}</Heading>
          <Text>The following jobs have been scheduled:</Text>
          {jobs.map((job, i) => (
            <Text key={job.id}>
              {i + 1}. {job.customer.name} — {job.service_type.name} — {job.address}
            </Text>
          ))}
          <Text style={{ color: '#64748b', fontSize: 12 }}>HydroWash · Singapore</Text>
        </Container>
      </Body>
    </Html>
  )
}
