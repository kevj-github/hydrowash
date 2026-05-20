export function generateServiceDates(
  contractId: string,
  startDate: string
): { contract_id: string; due_date: string; reminder_sent: boolean; booking_id: null }[] {
  return [1, 2, 3, 4].map((n) => {
    const d = new Date(`${startDate}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 3 * n)
    return {
      contract_id: contractId,
      due_date: d.toISOString().split('T')[0],
      reminder_sent: false,
      booking_id: null,
    }
  })
}
