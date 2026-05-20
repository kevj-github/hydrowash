export function generateServiceDates(
  contractId: string,
  startDate: string
): {
  contract_id: string
  due_date: string
  due_month: string
  reminder_sent: boolean
  second_reminder_sent: boolean
  booking_id: null
}[] {
  return [1, 2, 3, 4].map((n) => {
    const d = new Date(`${startDate}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 3 * n)
    const due_date = d.toISOString().split('T')[0]
    const due_month = due_date.slice(0, 7)
    return {
      contract_id: contractId,
      due_date,
      due_month,
      reminder_sent: false,
      second_reminder_sent: false,
      booking_id: null,
    }
  })
}

export function formatDueMonth(due_month: string): string {
  const [year, month] = due_month.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleString('en-SG', { month: 'short', year: 'numeric' })
}
