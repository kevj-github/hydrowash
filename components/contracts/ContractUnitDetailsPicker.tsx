'use client'
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AcUnitTypeIllustration } from '@/components/ui/AcUnitTypeIllustration'
import { createClient } from '@/lib/supabase/client'
import { normalizeUnitDetails } from '@/lib/contracts/units'
import { cn } from '@/lib/utils'
import type { AcUnitLocation, AcUnitType, AcBrand, ContractUnitDetail } from '@/lib/types'

const OTHERS_VALUE = '__other__'
const MAX_TILE_TYPES = 4

interface Props {
  numUnits: number
  value: ContractUnitDetail[]
  onChange?: (next: ContractUnitDetail[]) => void
  readOnly?: boolean
  showBrand?: boolean
  className?: string
}

export function ContractUnitDetailsPicker({
  numUnits, value, onChange, readOnly = false, showBrand = true, className,
}: Props) {
  const [locations, setLocations] = useState<AcUnitLocation[]>([])
  const [unitTypes, setUnitTypes] = useState<AcUnitType[]>([])
  const [brands, setBrands] = useState<AcBrand[]>([])

  useEffect(() => {
    if (readOnly) return
    const supabase = createClient()
    supabase.from('ac_unit_locations').select('*').eq('is_active', true).order('display_order')
      .then(({ data }) => setLocations(data ?? []))
    supabase.from('ac_unit_types').select('*').eq('is_active', true).order('display_order')
      .then(({ data }) => setUnitTypes(data ?? []))
    supabase.from('ac_brands').select('*').eq('is_active', true).order('display_order')
      .then(({ data }) => setBrands(data ?? []))
  }, [readOnly])

  useEffect(() => {
    if (readOnly || !onChange) return
    if (value.length !== numUnits) onChange(normalizeUnitDetails(value, numUnits))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numUnits])

  if (!numUnits || numUnits < 1) return null

  function update(index: number, patch: Partial<ContractUnitDetail>) {
    if (!onChange) return
    const next = value.map((u, i) => (i === index ? { ...u, ...patch } : u))
    onChange(next)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {readOnly && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Lock size={12} /> From your contract — contact us to change these details.
        </p>
      )}
      {Array.from({ length: numUnits }).map((_, i) => {
        const unit = value[i]
        if (!unit) return null
        return (
          <div key={i} className="rounded-xl border border-border p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Unit {i + 1}</p>

            {/* Location */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Location</Label>
              {readOnly ? (
                <p className="text-sm text-primary">{unit.location_label || '—'}</p>
              ) : (
                <>
                  <Select
                    value={unit.location_id ?? (unit.location_label ? OTHERS_VALUE : '')}
                    onValueChange={v => {
                      if (v === OTHERS_VALUE) update(i, { location_id: null, location_label: '' })
                      else {
                        const loc = locations.find(l => l.id === v)
                        update(i, { location_id: v ?? null, location_label: loc?.label ?? '' })
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue placeholder="Select room…">
                        {unit.location_id ? unit.location_label : (unit.location_label ? 'Others' : null)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.label}</SelectItem>
                      ))}
                      <SelectItem value={OTHERS_VALUE}>Others</SelectItem>
                    </SelectContent>
                  </Select>
                  {!unit.location_id && (
                    <Input
                      className="h-8 text-sm"
                      placeholder="Enter room / location…"
                      value={unit.location_label}
                      onChange={e => update(i, { location_label: e.target.value })}
                    />
                  )}
                </>
              )}
            </div>

            {/* Type — picture picker */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Unit Type</Label>
              {readOnly ? (
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-fit">
                  <AcUnitTypeIllustration label={unit.unit_type_label} size={32} className="text-accent" />
                  <span className="text-sm text-primary">{unit.unit_type_label || '—'}</span>
                </div>
              ) : unitTypes.length <= MAX_TILE_TYPES ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={`Unit ${i + 1} type`}>
                  {unitTypes.map(t => {
                    const selected = unit.unit_type_id === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => update(i, { unit_type_id: t.id, unit_type_label: t.label })}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors cursor-pointer',
                          selected
                            ? 'border-accent bg-accent/5 text-accent ring-1 ring-accent/30'
                            : 'border-border text-muted-foreground hover:border-accent/50'
                        )}
                      >
                        <AcUnitTypeIllustration label={t.label} size={40} />
                        <span className="text-[11px] font-medium leading-tight text-center">{t.label}</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!unit.unit_type_id && unit.unit_type_label !== ''}
                    onClick={() => update(i, { unit_type_id: null, unit_type_label: '' })}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 transition-colors cursor-pointer',
                      !unit.unit_type_id && unit.unit_type_label !== ''
                        ? 'border-accent bg-accent/5 text-accent ring-1 ring-accent/30'
                        : 'border-border text-muted-foreground hover:border-accent/50'
                    )}
                  >
                    <span className="text-[11px] font-medium">Others</span>
                  </button>
                </div>
              ) : (
                <Select
                  value={unit.unit_type_id ?? (unit.unit_type_label ? OTHERS_VALUE : '')}
                  onValueChange={v => {
                    if (v === OTHERS_VALUE) update(i, { unit_type_id: null, unit_type_label: '' })
                    else {
                      const t = unitTypes.find(t => t.id === v)
                      update(i, { unit_type_id: v ?? null, unit_type_label: t?.label ?? '' })
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-sm w-full">
                    <SelectValue placeholder="Select type…">
                      {unit.unit_type_id ? unit.unit_type_label : (unit.unit_type_label ? 'Others' : null)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {unitTypes.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                    <SelectItem value={OTHERS_VALUE}>Others</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {!readOnly && !unit.unit_type_id && (
                <Input
                  className="h-8 text-sm"
                  placeholder="Enter unit type…"
                  value={unit.unit_type_label}
                  onChange={e => update(i, { unit_type_label: e.target.value })}
                />
              )}
            </div>

            {/* Brand — optional */}
            {showBrand && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Brand <span className="font-normal">(optional)</span>
                </Label>
                {readOnly ? (
                  <p className="text-sm text-primary">{unit.brand_label || '—'}</p>
                ) : (
                  <>
                    <Select
                      value={unit.brand_id ?? (unit.brand_label ? OTHERS_VALUE : '')}
                      onValueChange={v => {
                        if (v === OTHERS_VALUE) update(i, { brand_id: null, brand_label: '' })
                        else if (!v) update(i, { brand_id: null, brand_label: '' })
                        else {
                          const b = brands.find(b => b.id === v)
                          update(i, { brand_id: v, brand_label: b?.label ?? '' })
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm w-full">
                        <SelectValue placeholder="Not sure / skip">
                          {unit.brand_id ? unit.brand_label : (unit.brand_label ? 'Others' : null)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Not sure / skip</SelectItem>
                        {brands.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                        ))}
                        <SelectItem value={OTHERS_VALUE}>Others</SelectItem>
                      </SelectContent>
                    </Select>
                    {!unit.brand_id && unit.brand_label !== '' && (
                      <Input
                        className="h-8 text-sm"
                        placeholder="Enter brand…"
                        value={unit.brand_label}
                        onChange={e => update(i, { brand_label: e.target.value })}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
