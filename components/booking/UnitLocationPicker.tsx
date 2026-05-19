'use client'
import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { AcUnitLocation } from '@/lib/types'

interface Props {
  numUnits: number
  value: string[]
  onChange: (ids: string[]) => void
}

export function UnitLocationPicker({ numUnits, value, onChange }: Props) {
  const [locations, setLocations] = useState<AcUnitLocation[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('ac_unit_locations')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => setLocations(data ?? []))
  }, [])

  function handleChange(index: number, locationId: string) {
    const next = [...value]
    next[index] = locationId
    onChange(next)
  }

  if (!numUnits || numUnits < 1) return null

  return (
    <div className="space-y-2">
      {Array.from({ length: numUnits }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground w-14 shrink-0">Unit {i + 1}</Label>
          <Select
            value={value[i] ?? ''}
            onValueChange={v => handleChange(i, v ?? '')}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Select room…">
                {locations.find(l => l.id === value[i])?.label ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
