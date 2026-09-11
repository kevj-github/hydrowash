import type { ContractUnitDetail, AcUnitDetail } from '@/lib/types'
import type { createClient } from '@/lib/supabase/server'

const OTHERS = null

export function normalizeUnitDetails(value: unknown, numUnits: number): ContractUnitDetail[] {
  const arr = Array.isArray(value) ? (value as Partial<ContractUnitDetail>[]) : []
  return Array.from({ length: Math.max(numUnits, 0) }, (_, i) => {
    const existing = arr[i]
    return {
      no: i + 1,
      location_id: existing?.location_id ?? OTHERS,
      location_label: existing?.location_label ?? '',
      unit_type_id: existing?.unit_type_id ?? OTHERS,
      unit_type_label: existing?.unit_type_label ?? '',
      brand_id: existing?.brand_id ?? OTHERS,
      brand_label: existing?.brand_label ?? '',
    }
  })
}

export function isUnitDetailsComplete(units: ContractUnitDetail[], numUnits: number): boolean {
  if (units.length !== numUnits || numUnits === 0) return false
  return units.every((u) => u.location_label.trim() !== '' && u.unit_type_label.trim() !== '')
}

export function summarizeUnitTypes(units: ContractUnitDetail[]): string {
  if (units.length === 0) return ''
  const counts = new Map<string, number>()
  for (const u of units) {
    const label = u.unit_type_label.trim() || 'Unit'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, count]) => `${count}x ${label}`)
    .join(', ')
}

export function contractUnitSummary(units: ContractUnitDetail[], numUnits: number): string {
  return summarizeUnitTypes(units) || `${numUnits}x Wall Mounted Unit`
}

export function toAcUnitDetails(units: ContractUnitDetail[]): AcUnitDetail[] {
  return units.map((u) => ({
    no: u.no,
    brand: u.brand_label,
    model: u.unit_type_label,
    serial_no: '',
    location: u.location_label,
  }))
}

interface CatalogRow {
  id: string
  label: string
}

/**
 * Re-resolves every non-null id against its catalog table and overwrites the
 * client-supplied label from the DB row, so a tampered label never reaches a
 * PDF or the database. An id that no longer resolves is dropped (kept as
 * free text). Trims and caps free-text labels; forces `no` to be sequential.
 */
export async function sanitizeUnitDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raw: unknown,
  numUnits: number
): Promise<ContractUnitDetail[]> {
  const normalized = normalizeUnitDetails(raw, numUnits)
  if (normalized.length === 0) return []

  const locationIds = normalized.map((u) => u.location_id).filter((id): id is string => !!id)
  const typeIds = normalized.map((u) => u.unit_type_id).filter((id): id is string => !!id)
  const brandIds = normalized.map((u) => u.brand_id).filter((id): id is string => !!id)

  const [locations, types, brands] = await Promise.all([
    locationIds.length
      ? supabase.from('ac_unit_locations').select('id, label').in('id', locationIds)
      : Promise.resolve({ data: [] as CatalogRow[] }),
    typeIds.length
      ? supabase.from('ac_unit_types').select('id, label').in('id', typeIds)
      : Promise.resolve({ data: [] as CatalogRow[] }),
    brandIds.length
      ? supabase.from('ac_brands').select('id, label').in('id', brandIds)
      : Promise.resolve({ data: [] as CatalogRow[] }),
  ])

  const locationMap = new Map((locations.data ?? []).map((r: CatalogRow) => [r.id, r.label]))
  const typeMap = new Map((types.data ?? []).map((r: CatalogRow) => [r.id, r.label]))
  const brandMap = new Map((brands.data ?? []).map((r: CatalogRow) => [r.id, r.label]))

  const cap = (s: string) => s.trim().slice(0, 100)

  return normalized.map((u, i) => {
    const resolvedLocation = u.location_id ? locationMap.get(u.location_id) : undefined
    const resolvedType = u.unit_type_id ? typeMap.get(u.unit_type_id) : undefined
    const resolvedBrand = u.brand_id ? brandMap.get(u.brand_id) : undefined
    return {
      no: i + 1,
      location_id: resolvedLocation ? u.location_id : null,
      location_label: resolvedLocation ?? cap(u.location_label),
      unit_type_id: resolvedType ? u.unit_type_id : null,
      unit_type_label: resolvedType ?? cap(u.unit_type_label),
      brand_id: resolvedBrand ? u.brand_id : null,
      brand_label: resolvedBrand ?? cap(u.brand_label),
    }
  })
}
