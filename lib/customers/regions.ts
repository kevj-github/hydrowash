// Mirrors supabase/migrations/040_region_customer_numbering.sql — keep in sync.
// Used for display only (region badges); actual assignment happens in the DB
// trigger, which is the source of truth.

export type CustomerRegion = 'CENTRAL' | 'EAST' | 'NORTH' | 'NORTH_EAST' | 'WEST' | 'UNCLASSIFIED'

export const REGION_LABELS: Record<CustomerRegion, string> = {
  CENTRAL: 'Central',
  EAST: 'East',
  NORTH: 'North',
  NORTH_EAST: 'North-East',
  WEST: 'West',
  UNCLASSIFIED: 'Unclassified',
}

export const REGION_BANDS: Record<CustomerRegion, number> = {
  CENTRAL: 1000,
  EAST: 2000,
  NORTH: 3000,
  NORTH_EAST: 4000,
  WEST: 5000,
  UNCLASSIFIED: 9000,
}

/** Region a given postal code's sector would resolve to. Mirrors resolve_customer_region() in SQL. */
export function regionForPostalCode(postal: string | null | undefined): CustomerRegion {
  if (!postal || postal.trim().length < 2) return 'UNCLASSIFIED'
  const sector = parseInt(postal.trim().slice(0, 2), 10)
  if (Number.isNaN(sector)) return 'UNCLASSIFIED'
  if (sector >= 1 && sector <= 10) return 'CENTRAL'
  if (sector >= 11 && sector <= 13) return 'WEST'
  if (sector >= 14 && sector <= 37) return 'CENTRAL'
  if (sector >= 38 && sector <= 52) return 'EAST'
  if (sector >= 53 && sector <= 57) return 'NORTH_EAST'
  if (sector >= 58 && sector <= 71) return 'WEST'
  if (sector >= 72 && sector <= 78) return 'NORTH'
  if (sector >= 79 && sector <= 80) return 'NORTH_EAST'
  if (sector === 81) return 'EAST'
  if (sector === 82) return 'NORTH_EAST'
  return 'UNCLASSIFIED'
}

/** Region implied by an already-assigned customer_no's band (1000s/2000s/...). Legacy small numbers (pre-region scheme) return null. */
export function regionForCustomerNo(customerNo: number | null | undefined): CustomerRegion | null {
  if (customerNo == null || customerNo < 1000) return null
  const band = Math.floor(customerNo / 1000) * 1000
  const entry = (Object.entries(REGION_BANDS) as [CustomerRegion, number][]).find(([, b]) => b === band)
  return entry ? entry[0] : null
}
