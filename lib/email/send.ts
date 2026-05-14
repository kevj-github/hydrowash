import { Resend } from 'resend'
import type { BookingWithRelations } from '@/lib/types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.sg>'

export async function sendBookingReceived(booking: BookingWithRelations, email: string) {
  const { BookingReceived } = await import('./templates/BookingReceived')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Booking received — HydroWash',
    react: BookingReceived({ booking }),
  })
}

export async function sendBookingApproved(booking: BookingWithRelations, email: string) {
  const { BookingApproved } = await import('./templates/BookingApproved')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Booking confirmed — HydroWash',
    react: BookingApproved({ booking }),
  })
}

export async function sendBookingRejected(booking: BookingWithRelations, email: string) {
  const { BookingRejected } = await import('./templates/BookingRejected')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Booking update — HydroWash',
    react: BookingRejected({ booking }),
  })
}

export async function sendScheduleConfirmed(
  jobs: BookingWithRelations[],
  date: string,
  email: string,
) {
  const { ScheduleConfirmed } = await import('./templates/ScheduleConfirmed')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Schedule confirmed for ${date} — HydroWash`,
    react: ScheduleConfirmed({ jobs, date }),
  })
}

export async function sendDayBeforeReminder(booking: BookingWithRelations, email: string) {
  const { DayBeforeReminder } = await import('./templates/DayBeforeReminder')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reminder: your appointment is tomorrow — HydroWash',
    react: DayBeforeReminder({ booking }),
  })
}
