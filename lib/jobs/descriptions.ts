import type { AcUnitDetail, BookingCategory } from '@/lib/types'
import { summarizeUnitTypes } from '@/lib/contracts/units'
import type { ContractUnitDetail } from '@/lib/types'

interface JobTextInput {
  serviceTypeName: string
  category: BookingCategory
  units: AcUnitDetail[]
  numUnits: number
  faultDescription?: string | null
}

function unitSummaryFromAcDetails(units: AcUnitDetail[]): string {
  if (units.length === 0) return ''
  const asContractUnits: ContractUnitDetail[] = units.map((u) => ({
    no: u.no,
    location_id: null,
    location_label: u.location,
    unit_type_id: null,
    unit_type_label: u.model,
    brand_id: null,
    brand_label: u.brand,
  }))
  return summarizeUnitTypes(asContractUnits)
}

export function buildJobDescription(input: JobTextInput): string {
  const { serviceTypeName, category, units, numUnits, faultDescription } = input

  if (category === 'FAULT_REPAIR') {
    return faultDescription
      ? `${serviceTypeName} — ${faultDescription}`
      : serviceTypeName
  }

  const unitSummary = unitSummaryFromAcDetails(units)
  if (unitSummary) return `${serviceTypeName} of ${unitSummary}.`
  return `${serviceTypeName} of ${numUnits} unit(s).`
}

export function buildJobRendered(input: JobTextInput): string {
  const { serviceTypeName, category, units, faultDescription } = input

  if (category === 'FAULT_REPAIR') {
    return faultDescription
      ? `Attended to reported fault: ${faultDescription}. ${serviceTypeName} carried out; unit tested and working normally.`
      : `${serviceTypeName} carried out; unit tested and working normally.`
  }

  const unitSummary = unitSummaryFromAcDetails(units)
  if (unitSummary) {
    return `Completed ${serviceTypeName.toLowerCase()} of ${unitSummary}. All units tested and working normally.`
  }
  return `Completed ${serviceTypeName.toLowerCase()}. All units tested and working normally.`
}
