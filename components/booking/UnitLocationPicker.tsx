'use client'
import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { AcUnitLocation } from '@/lib/types'

export const OTHERS_VALUE = '__other__'

interface Props {
  numUnits: number
  value: string[]
  otherTexts: string[]
  onChange: (ids: string[]) => void
  onOtherTexts: (texts: string[]) => void
}

export function UnitLocationPicker({ numUnits, value, otherTexts, onChange, onOtherTexts }: Props) {
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

  function handleOtherText(index: number, text: string) {
    const next = [...otherTexts]
    next[index] = text
    onOtherTexts(next)
  }

  if (!numUnits || numUnits < 1) return null

  return (
    <div className="space-y-2">
      {Array.from({ length: numUnits }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground w-14 shrink-0">Unit {i + 1}</Label>
            <Select
              value={value[i] ?? ''}
              onValueChange={v => handleChange(i, v ?? '')}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select room…">
                  {value[i] === OTHERS_VALUE
                    ? 'Others'
                    : locations.find(l => l.id === value[i])?.label ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.label}
                  </SelectItem>
                ))}
                <SelectItem value={OTHERS_VALUE}>Others</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {value[i] === OTHERS_VALUE && (
            <div className="ml-[4.25rem]">
              <Input
                className="h-7 text-xs"
                placeholder="Enter room / location…"
                value={otherTexts[i] ?? ''}
                onChange={e => handleOtherText(i, e.target.value)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
