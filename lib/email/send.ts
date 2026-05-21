import { Resend } from 'resend'
import type { BookingWithRelations } from '@/lib/types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HydroWash <noreply@hydrowash.services>'

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

export async function sendBookingRescheduled(
  data: { customerName: string; bookingId: string; serviceType: string; newDates: string[] },
  adminEmail: string
) {
  const { BookingRescheduled } = await import('./templates/BookingRescheduled')
  return resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Booking rescheduled — #${data.bookingId}`,
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
    subject: `Booking cancelled — #${data.bookingId}`,
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
    subject: 'Your quarterly aircon service is due — HydroWash',
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
    subject: 'Your maintenance contract expires soon — HydroWash',
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
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your maintenance contract is now active — HydroWash',
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
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Contract request received — HydroWash',
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
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your HydroWash contract pricing — S$${data.priceSgd.toFixed(2)}/year`,
    react: ContractPricingEmail(data),
    attachments: pdfBuffer
      ? [{ filename: 'HydroWash-Contract.pdf', content: pdfBuffer }]
      : [],
  })
}

export async function sendWorkOrderReport(
  data: {
    customerName: string
    workOrderNo: number
    date: string
    serviceType: string
    address: string
    totalSgd: number
    paynowQrDataUrl: string
    paynowMobile: string
    referenceId: string
  },
  customerEmail: string,
  pdfBuffer: Buffer
) {
  const { WorkOrderEmail } = await import('./templates/WorkOrderEmail')
  return resend.emails.send({
    from: FROM,
    to: customerEmail,
    subject: `Your HydroWash Work Order #${data.workOrderNo} — S$${data.totalSgd.toFixed(2)} due`,
    react: WorkOrderEmail(data),
    attachments: [{ filename: `work-order-${data.workOrderNo}.pdf`, content: pdfBuffer }],
  })
}
