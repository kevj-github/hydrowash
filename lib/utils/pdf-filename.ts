function slugPart(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'unknown'
}

function toIsoDate(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}$/)?.[0]
  if (dateOnly) return dateOnly
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

export function buildServiceReportPdfFilename(input: {
  customerName?: string | null
  bookingType?: string | null
  bookingDate?: string | null
}): string {
  const customer = slugPart(input.customerName ?? '')
  const bookingType = slugPart(input.bookingType ?? '')
  const bookingDate = toIsoDate(input.bookingDate)
  return `hydrowash-${customer}-${bookingType}-${bookingDate}.pdf`
}

export function buildContractPdfFilename(input: {
  customerName?: string | null
  startDate?: string | null
}): string {
  const customer = slugPart(input.customerName ?? '')
  const startDate = toIsoDate(input.startDate)
  return `hydrowash-contract-${customer}-${startDate}.pdf`
}
