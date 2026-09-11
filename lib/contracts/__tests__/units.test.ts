/** @jest-environment node */
import {
  normalizeUnitDetails,
  isUnitDetailsComplete,
  summarizeUnitTypes,
  contractUnitSummary,
  toAcUnitDetails,
} from '../units'
import type { ContractUnitDetail } from '@/lib/types'

function unit(overrides: Partial<ContractUnitDetail> = {}): ContractUnitDetail {
  return {
    no: 1,
    location_id: 'loc-1',
    location_label: 'Living Room',
    unit_type_id: 'type-1',
    unit_type_label: 'Wall Mounted',
    brand_id: null,
    brand_label: '',
    ...overrides,
  }
}

describe('normalizeUnitDetails', () => {
  it('pads a shorter array to numUnits with blank entries', () => {
    const result = normalizeUnitDetails([unit()], 3)
    expect(result).toHaveLength(3)
    expect(result[0].location_label).toBe('Living Room')
    expect(result[1].location_label).toBe('')
    expect(result[2].unit_type_label).toBe('')
  })

  it('truncates a longer array to numUnits', () => {
    const result = normalizeUnitDetails([unit({ no: 1 }), unit({ no: 2 }), unit({ no: 3 })], 2)
    expect(result).toHaveLength(2)
  })

  it('re-numbers `no` sequentially regardless of input', () => {
    const result = normalizeUnitDetails([unit({ no: 9 }), unit({ no: 9 })], 2)
    expect(result.map(u => u.no)).toEqual([1, 2])
  })

  it('returns an empty array for non-array input', () => {
    expect(normalizeUnitDetails(null, 2)).toHaveLength(2)
    expect(normalizeUnitDetails(undefined, 0)).toEqual([])
  })
})

describe('isUnitDetailsComplete', () => {
  it('is true when every unit has a location and type', () => {
    expect(isUnitDetailsComplete([unit(), unit({ no: 2 })], 2)).toBe(true)
  })

  it('is false when length does not match numUnits', () => {
    expect(isUnitDetailsComplete([unit()], 2)).toBe(false)
  })

  it('is false when a location or type is blank', () => {
    expect(isUnitDetailsComplete([unit({ location_label: '' })], 1)).toBe(false)
    expect(isUnitDetailsComplete([unit({ unit_type_label: '' })], 1)).toBe(false)
  })

  it('does not require brand', () => {
    expect(isUnitDetailsComplete([unit({ brand_label: '' })], 1)).toBe(true)
  })

  it('is false for zero units', () => {
    expect(isUnitDetailsComplete([], 0)).toBe(false)
  })
})

describe('summarizeUnitTypes', () => {
  it('groups by type preserving first-seen order', () => {
    const units = [
      unit({ no: 1, unit_type_label: 'Wall Mounted' }),
      unit({ no: 2, unit_type_label: 'Cassette Unit' }),
      unit({ no: 3, unit_type_label: 'Wall Mounted' }),
    ]
    expect(summarizeUnitTypes(units)).toBe('2x Wall Mounted, 1x Cassette Unit')
  })

  it('returns an empty string for no units', () => {
    expect(summarizeUnitTypes([])).toBe('')
  })
})

describe('contractUnitSummary', () => {
  it('falls back to the legacy hardcoded string when there is no unit data', () => {
    expect(contractUnitSummary([], 4)).toBe('4x Wall Mounted Unit')
  })

  it('uses the real summary when unit data exists', () => {
    expect(contractUnitSummary([unit()], 1)).toBe('1x Wall Mounted')
  })
})

describe('toAcUnitDetails', () => {
  it('maps contract unit fields onto the AcUnitDetail shape', () => {
    const result = toAcUnitDetails([unit({ brand_label: 'Daikin' })])
    expect(result[0]).toEqual({ no: 1, brand: 'Daikin', model: 'Wall Mounted', serial_no: '', location: 'Living Room' })
  })
})
