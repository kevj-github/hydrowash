/** @jest-environment node */
import { regionForPostalCode, regionForCustomerNo } from '../regions'

describe('regionForPostalCode', () => {
  it('resolves Central sectors (01-10, 14-37)', () => {
    expect(regionForPostalCode('018956')).toBe('CENTRAL') // sector 01
    expect(regionForPostalCode('238859')).toBe('CENTRAL') // sector 23 (Orchard)
    expect(regionForPostalCode('310123')).toBe('CENTRAL') // sector 31 (Balestier)
  })

  it('resolves East sectors (38-52, 81)', () => {
    expect(regionForPostalCode('390123')).toBe('EAST')
    expect(regionForPostalCode('520123')).toBe('EAST')
    expect(regionForPostalCode('819123')).toBe('EAST')
  })

  it('resolves North sectors (72-78)', () => {
    expect(regionForPostalCode('730123')).toBe('NORTH')
    expect(regionForPostalCode('760123')).toBe('NORTH')
  })

  it('resolves North-East sectors (53-57, 79-80, 82)', () => {
    expect(regionForPostalCode('530123')).toBe('NORTH_EAST')
    expect(regionForPostalCode('790123')).toBe('NORTH_EAST')
    expect(regionForPostalCode('820123')).toBe('NORTH_EAST')
  })

  it('resolves West sectors (11-13, 58-71)', () => {
    expect(regionForPostalCode('120123')).toBe('WEST')
    expect(regionForPostalCode('640123')).toBe('WEST')
  })

  it('falls back to Unclassified for missing, short, or unmapped postal codes', () => {
    expect(regionForPostalCode(null)).toBe('UNCLASSIFIED')
    expect(regionForPostalCode('')).toBe('UNCLASSIFIED')
    expect(regionForPostalCode('7')).toBe('UNCLASSIFIED')
    expect(regionForPostalCode('999999')).toBe('UNCLASSIFIED') // sector 99, out of range
  })
})

describe('regionForCustomerNo', () => {
  it('derives region from the number band', () => {
    expect(regionForCustomerNo(1005)).toBe('CENTRAL')
    expect(regionForCustomerNo(2999)).toBe('EAST')
    expect(regionForCustomerNo(5001)).toBe('WEST')
    expect(regionForCustomerNo(9000)).toBe('UNCLASSIFIED')
  })

  it('returns null for legacy pre-region numbers', () => {
    expect(regionForCustomerNo(1)).toBeNull()
    expect(regionForCustomerNo(42)).toBeNull()
    expect(regionForCustomerNo(999)).toBeNull()
    expect(regionForCustomerNo(null)).toBeNull()
  })
})
