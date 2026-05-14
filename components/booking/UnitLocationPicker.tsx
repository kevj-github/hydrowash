'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AcUnitLocation } from '@/lib/types'

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
}

export function UnitLocationPicker({ value, onChange }: Props) {
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

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  if (!locations.length) {
    return <p className="text-xs text-muted-foreground">Loading locations…</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {locations.map(loc => {
        const active = value.includes(loc.id)
        return (
          <button
            key={loc.id}
            type="button"
            onClick={() => toggle(loc.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'bg-accent text-white border-accent'
                : 'border-border text-primary hover:bg-muted/60'
            }`}
          >
            {loc.label}
          </button>
        )
      })}
    </div>
  )
}
