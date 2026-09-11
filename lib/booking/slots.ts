import type { TimeSlot, ContractPricingTier } from '@/lib/types'

interface BlockedSlotRow {
  blocked_date: string
  slot: string | null
}

export function isDayFullyBlocked(date: string, blocks: BlockedSlotRow[]): boolean {
  return blocks.some((b) => b.blocked_date === date && b.slot === null)
}

export function isSlotBlocked(date: string, slot: TimeSlot, blocks: BlockedSlotRow[]): boolean {
  return blocks.some((b) => b.blocked_date === date && (b.slot === null || b.slot === slot))
}

export function getSlotsForDate(
  date: string,
  blocks: BlockedSlotRow[],
  bookedSlots: { booking_date: string; time_slot: string }[],
  allSlots: TimeSlot[]
): { slot: TimeSlot; available: boolean }[] {
  if (isDayFullyBlocked(date, blocks)) {
    return allSlots.map((slot) => ({ slot, available: false }))
  }
  return allSlots.map((slot) => ({
    slot,
    available:
      !isSlotBlocked(date, slot, blocks) &&
      !bookedSlots.some((b) => b.booking_date === date && b.time_slot === slot),
  }))
}

export function slotTimeRange(slot: TimeSlot): { start: string; end: string } {
  const [startHour, endHour] = slot.slice(1).split('_').map(Number)
  return {
    start: `${String(startHour).padStart(2, '0')}:00`,
    end: `${String(endHour).padStart(2, '0')}:00`,
  }
}

export function resolveContractTierPrice(
  tiers: ContractPricingTier[],
  numUnits: number
): number | null {
  const tier = tiers.find(
    (t) => numUnits >= t.min_units && (t.max_units === null || numUnits <= t.max_units)
  )
  if (!tier) return null
  if (tier.max_units === null) return tier.price_sgd * numUnits
  return tier.price_sgd
}
