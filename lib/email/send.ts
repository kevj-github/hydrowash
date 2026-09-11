import { Resend } from 'resend'
import type { BookingWithRelations } from '@/lib/types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export async function sendBookingReceived(booking: BookingWithRelations, email: string) {
  const { BookingReceived } = await import('./templates/BookingReceived')
  // Nothing is confirmed yet at this stage — list every date the customer
  // offered as a preference (not just the first) so the subject reflects
  // what they actually chose, e.g. "26 Sep, 27 Sep".
  const dates = booking.preferred_date_slots?.length
    ? booking.preferred_date_slots.map(d => fmtDate(d.date)).join(', ')
    : fmtDate(booking.booking_date)
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${booking.service_type.name} booking (${dates}) has been received — HydroWash`,
    react: BookingReceived({ booking }),
  })
}

export async function sendBookingApproved(booking: BookingWithRelations, email: string) {
  const { BookingApproved } = await import('./templates/BookingApproved')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${booking.service_type.name} is confirmed for ${fmtDate(booking.confirmed_date ?? booking.booking_date)} — HydroWash`,
    react: BookingApproved({ booking }),
  })
}

export async function sendBookingRejected(booking: BookingWithRelations, email: string) {
  const { BookingRejected } = await import('./templates/BookingRejected')
  // Also reused for the admin "cancel an approved booking" flow (with
  // rejection_reason substituted for the cancel reason) — those bookings
  // have a confirmed_date, which is what actually got cancelled, so prefer
  // it over the customer's original preferred booking_date.
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Update on your ${booking.service_type.name} booking (${fmtDate(booking.confirmed_date ?? booking.booking_date)}) — HydroWash`,
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
    subject: `Reminder: your ${booking.service_type.name} tomorrow (${fmtDate(booking.confirmed_date ?? booking.booking_date)}) — HydroWash`,
    react: DayBeforeReminder({ booking }),
  })
}

export async function sendBookingRescheduled(
  data: { customerName: string; bookingId: string; serviceType: string; newDateSlots: { date: string; slots: string[] }[] },
  adminEmail: string
) {
  const { BookingRescheduled } = await import('./templates/BookingRescheduled')
  return resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `${data.customerName} rescheduled: ${data.serviceType} — HydroWash`,
    react: BookingRescheduled(data),
  })
}

export async function sendBookingCancelled(
  data: { customerName: string; bookingId: string; serviceType: string; reason?: string },
  adminEmail: string
) {
  const { BookingCancelled } = await import('./templates/BookingCancelled')
  return resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `${data.customerName} cancelled: ${data.serviceType} — HydroWash`,
    react: BookingCancelled(data),
  })
}

export async function sendContractServiceDue(
  data: { customerName: string; numUnits: number; dueDate: string; bookUrl: string },
  email: string
) {
  const { ContractServiceDue } = await import('./templates/ContractServiceDue')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your quarterly aircon service is due in ${data.dueDate} — HydroWash`,
    react: ContractServiceDue(data),
  })
}

export async function sendContractExpiring(
  data: { customerName: string; numUnits: number; endDate: string },
  email: string
) {
  const { ContractExpiring } = await import('./templates/ContractExpiring')
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your maintenance contract expires ${fmtDate(data.endDate)} — HydroWash`,
    react: ContractExpiring(data),
  })
}

export async function sendContractActivated(
  data: {
    customerName: string
    numUnits: number
    priceSgd: number
    startDate: string
    firstServiceDate: string
  },
  email: string
) {
  const { ContractActivated } = await import('./templates/ContractActivated')
  // Include the start date so activations for different contracts (e.g. two
  // properties for the same customer) don't collide/thread together in Gmail.
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your maintenance contract starting ${fmtDate(data.startDate)} is now active — HydroWash`,
    react: ContractActivated(data),
  })
}

export async function sendContractRequestReceived(
  data: {
    customerName: string
    numUnits: number
    preferredMonth: string
    address?: string
  },
  email: string
) {
  const { ContractRequestReceived } = await import('./templates/ContractRequestReceived')
  // Differentiate by the requested starting month so multiple contract
  // requests from the same customer don't collide/thread together in Gmail.
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Contract request received — starting ${data.preferredMonth} — HydroWash`,
    react: ContractRequestReceived(data),
  })
}

export async function sendContractPricing(
  data: {
    customerName: string
    numUnits: number
    priceSgd: number
    startDate: string
    endDate: string
    address?: string
    paynowQrDataUrl?: string
    paynowMobile?: string
    referenceId?: string
  },
  email: string,
  pdfBuffer?: Buffer
) {
  const { ContractPricingEmail } = await import('./templates/ContractPricingEmail')
  // Include the start date alongside the price — two requests with the same
  // price (a common case, e.g. same unit count) would otherwise collide.
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your HydroWash contract pricing (starting ${fmtDate(data.startDate)}) — S$${data.priceSgd.toFixed(2)}/year`,
    react: ContractPricingEmail(data),
    attachments: pdfBuffer
      ? [{ filename: 'HydroWash-Contract.pdf', content: pdfBuffer }]
      : [],
  })
}

export async function sendWorkOrderReport(
  data: {
    customerName: string
    date: string
    serviceType: string
    address: string
    totalSgd: number
    paynowQrDataUrl: string
    paynowMobile: string
    referenceId: string
    pdfFilename: string
  },
  customerEmail: string,
  pdfBuffer: Buffer
) {
  const { WorkOrderEmail } = await import('./templates/WorkOrderEmail')
  return resend.emails.send({
    from: FROM,
    to: customerEmail,
    subject: `${data.serviceType} on ${fmtDate(data.date)} — S$${data.totalSgd.toFixed(2)} due — HydroWash`,
    react: WorkOrderEmail(data),
    attachments: [{ filename: data.pdfFilename, content: pdfBuffer }],
  })
}

export async function sendBasicReminder(data: { customerName: string; bookUrl: string }, customerEmail: string) {
  const { BasicReminder } = await import('./templates/BasicReminder')
  return resend.emails.send({
    from: FROM,
    to: customerEmail,
    subject: `A friendly reminder from HydroWash`,
    react: BasicReminder(data),
  })
}

export async function sendPaymentReceived(
  data: {
    customerName: string
    description: string
    amountSgd: number
    paymentMethod: string
    paidDate: string
    serviceLabel?: string
    serviceDate?: string
  },
  customerEmail: string
) {
  const { PaymentReceived } = await import('./templates/PaymentReceived')
  // Prefer the resolved service type over the raw invoice description (often
  // just an internal "Work Order #N" label with no meaning to the customer).
  const subjectLabel = data.serviceLabel ?? data.description
  return resend.emails.send({
    from: FROM,
    to: customerEmail,
    subject: `Payment received — ${subjectLabel} — S$${data.amountSgd.toFixed(2)} — HydroWash`,
    react: PaymentReceived(data),
  })
}
