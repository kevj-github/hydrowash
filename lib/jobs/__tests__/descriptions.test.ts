/** @jest-environment node */
import { buildJobDescription, buildJobRendered } from '../descriptions'
import type { AcUnitDetail } from '@/lib/types'

const units: AcUnitDetail[] = [
  { no: 1, brand: 'Daikin', model: 'Wall Mounted', serial_no: '', location: 'Living Room' },
  { no: 2, brand: '', model: 'Wall Mounted', serial_no: '', location: 'Master Bedroom' },
  { no: 3, brand: '', model: 'Cassette Unit', serial_no: '', location: 'Kitchen' },
]

describe('buildJobDescription', () => {
  it('summarizes unit types for MAINTENANCE bookings', () => {
    const result = buildJobDescription({
      serviceTypeName: 'General Cleaning', category: 'MAINTENANCE', units, numUnits: 3,
    })
    expect(result).toBe('General Cleaning of 2x Wall Mounted, 1x Cassette Unit.')
  })

  it('falls back to a unit count when there is no unit data', () => {
    const result = buildJobDescription({
      serviceTypeName: 'General Cleaning', category: 'MAINTENANCE', units: [], numUnits: 2,
    })
    expect(result).toBe('General Cleaning of 2 unit(s).')
  })

  it('includes the fault description for FAULT_REPAIR', () => {
    const result = buildJobDescription({
      serviceTypeName: 'AC Not Cooling', category: 'FAULT_REPAIR', units: [], numUnits: 1,
      faultDescription: 'Unit blowing warm air',
    })
    expect(result).toBe('AC Not Cooling — Unit blowing warm air')
  })

  it('falls back to just the service type name when no fault description', () => {
    const result = buildJobDescription({
      serviceTypeName: 'AC Not Cooling', category: 'FAULT_REPAIR', units: [], numUnits: 1,
    })
    expect(result).toBe('AC Not Cooling')
  })
})

describe('buildJobRendered', () => {
  it('describes completed work for MAINTENANCE bookings', () => {
    const result = buildJobRendered({
      serviceTypeName: 'General Cleaning', category: 'MAINTENANCE', units, numUnits: 3,
    })
    expect(result).toBe('Completed general cleaning of 2x Wall Mounted, 1x Cassette Unit. All units tested and working normally.')
  })

  it('references the reported fault for FAULT_REPAIR', () => {
    const result = buildJobRendered({
      serviceTypeName: 'AC Not Cooling', category: 'FAULT_REPAIR', units: [], numUnits: 1,
      faultDescription: 'Unit blowing warm air',
    })
    expect(result).toBe('Attended to reported fault: Unit blowing warm air. AC Not Cooling carried out; unit tested and working normally.')
  })
})
