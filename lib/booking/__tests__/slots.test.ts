/** @jest-environment node */
import {
  isDayFullyBlocked,
  isSlotBlocked,
  getSlotsForDate,
  resolveContractTierPrice,
  slotTimeRange,
} from '../slots'
import { SLOT_KEYS } from '@/lib/types'
import type { TimeSlot, ContractPricingTier } from '@/lib/types'

const DATE = '2026-09-10'
const OTHER_DATE = '2026-09-11'

describe('isDayFullyBlocked', () => {
  it('is true only when the block has a null slot (whole-day block)', () => {
    expect(isDayFullyBlocked(DATE, [{ blocked_date: DATE, slot: null }])).toBe(true)
  })

  it('is false when only individual slots on that day are blocked', () => {
    expect(isDayFullyBlocked(DATE, [{ blocked_date: DATE, slot: 'S10_12' }])).toBe(false)
  })

  it('does not leak a whole-day block onto other dates', () => {
    expect(isDayFullyBlocked(OTHER_DATE, [{ blocked_date: DATE, slot: null }])).toBe(false)
  })

  it('is false with no blocks at all', () => {
    expect(isDayFullyBlocked(DATE, [])).toBe(false)
  })
})

describe('isSlotBlocked', () => {
  it('blocks a specific slot', () => {
    expect(isSlotBlocked(DATE, 'S10_12', [{ blocked_date: DATE, slot: 'S10_12' }])).toBe(true)
  })

  it('leaves other slots on that day open', () => {
    expect(isSlotBlocked(DATE, 'S13_15', [{ blocked_date: DATE, slot: 'S10_12' }])).toBe(false)
  })

  it('treats a whole-day block as blocking every slot', () => {
    for (const slot of SLOT_KEYS) {
      expect(isSlotBlocked(DATE, slot, [{ blocked_date: DATE, slot: null }])).toBe(true)
    }
  })

  it('is scoped to the date', () => {
    expect(isSlotBlocked(OTHER_DATE, 'S10_12', [{ blocked_date: DATE, slot: 'S10_12' }])).toBe(false)
  })
})

describe('getSlotsForDate', () => {
  it('returns every slot unavailable when the day is fully blocked', () => {
    const result = getSlotsForDate(DATE, [{ blocked_date: DATE, slot: null }], [], SLOT_KEYS)
    expect(result).toHaveLength(SLOT_KEYS.length)
    expect(result.every(r => r.available === false)).toBe(true)
  })

  it('returns every slot available on a clear day', () => {
    const result = getSlotsForDate(DATE, [], [], SLOT_KEYS)
    expect(result.every(r => r.available === true)).toBe(true)
  })

  it('marks a booked slot unavailable and leaves the rest open', () => {
    const result = getSlotsForDate(DATE, [], [{ booking_date: DATE, time_slot: 'S13_15' }], SLOT_KEYS)
    expect(result.find(r => r.slot === 'S13_15')?.available).toBe(false)
    expect(result.filter(r => r.available)).toHaveLength(SLOT_KEYS.length - 1)
  })

  it('ignores bookings on other dates', () => {
    const result = getSlotsForDate(DATE, [], [{ booking_date: OTHER_DATE, time_slot: 'S13_15' }], SLOT_KEYS)
    expect(result.every(r => r.available === true)).toBe(true)
  })

  it('combines a slot block and a booking on the same day', () => {
    const result = getSlotsForDate(
      DATE,
      [{ blocked_date: DATE, slot: 'S10_12' }],
      [{ booking_date: DATE, time_slot: 'S15_17' }],
      SLOT_KEYS
    )
    const unavailable = result.filter(r => !r.available).map(r => r.slot)
    expect(unavailable.sort()).toEqual(['S10_12', 'S15_17'])
  })

  it('preserves the order of the slots it is given', () => {
    const result = getSlotsForDate(DATE, [], [], SLOT_KEYS)
    expect(result.map(r => r.slot)).toEqual(SLOT_KEYS)
  })

  it('is driven entirely by the slot list passed in', () => {
    const subset: TimeSlot[] = ['S10_12', 'S19_21']
    expect(getSlotsForDate(DATE, [], [], subset).map(r => r.slot)).toEqual(subset)
  })
})

describe('resolveContractTierPrice', () => {
  // Mirrors the documented shape: banded tiers, with an optional final
  // per-unit tier where max_units is null.
  const tiers: ContractPricingTier[] = [
    { min_units: 1, max_units: 2, price_sgd: 300 },
    { min_units: 3, max_units: 5, price_sgd: 500 },
    { min_units: 6, max_units: null, price_sgd: 90 },
  ]

  it('returns the flat band price inside a bounded tier', () => {
    expect(resolveContractTierPrice(tiers, 1)).toBe(300)
    expect(resolveContractTierPrice(tiers, 2)).toBe(300)
    expect(resolveContractTierPrice(tiers, 3)).toBe(500)
    expect(resolveContractTierPrice(tiers, 5)).toBe(500)
  })

  it('multiplies by unit count in the open-ended tier', () => {
    expect(resolveContractTierPrice(tiers, 6)).toBe(540)
    expect(resolveContractTierPrice(tiers, 10)).toBe(900)
  })

  it('is inclusive at both band boundaries', () => {
    // 2 and 3 sit either side of the first boundary; neither may fall through.
    expect(resolveContractTierPrice(tiers, 2)).toBe(300)
    expect(resolveContractTierPrice(tiers, 3)).toBe(500)
  })

  it('returns null when no tier matches, so callers can show "TBD"', () => {
    expect(resolveContractTierPrice(tiers, 0)).toBeNull()
    expect(resolveContractTierPrice([], 4)).toBeNull()
  })

  it('returns null below the lowest tier rather than guessing the cheapest band', () => {
    const from3: ContractPricingTier[] = [{ min_units: 3, max_units: 5, price_sgd: 500 }]
    expect(resolveContractTierPrice(from3, 1)).toBeNull()
  })

  it('takes the first matching tier when bands overlap', () => {
    const overlapping: ContractPricingTier[] = [
      { min_units: 1, max_units: 5, price_sgd: 400 },
      { min_units: 3, max_units: 8, price_sgd: 700 },
    ]
    expect(resolveContractTierPrice(overlapping, 4)).toBe(400)
  })

  it('handles a single per-unit tier covering everything', () => {
    const perUnit: ContractPricingTier[] = [{ min_units: 1, max_units: null, price_sgd: 120 }]
    expect(resolveContractTierPrice(perUnit, 1)).toBe(120)
    expect(resolveContractTierPrice(perUnit, 4)).toBe(480)
  })
})

describe('slotTimeRange', () => {
  it('derives start/end clock times from the slot key', () => {
    expect(slotTimeRange('S10_12')).toEqual({ start: '10:00', end: '12:00' })
    expect(slotTimeRange('S19_21')).toEqual({ start: '19:00', end: '21:00' })
  })

  it('covers every canonical slot key', () => {
    for (const slot of SLOT_KEYS) {
      const { start, end } = slotTimeRange(slot)
      expect(start).toMatch(/^\d{2}:00$/)
      expect(end).toMatch(/^\d{2}:00$/)
    }
  })
})
