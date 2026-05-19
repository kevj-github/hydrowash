'use client'
import { useEffect, useRef, useState } from 'react'
import { useMapsLoaded } from '@/lib/hooks/useMapsLoaded'
import { Home, MapPin, Pencil } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SlotCalendar } from './SlotCalendar'
import { SLOT_LABELS } from '@/lib/types'
import type { TimeSlot } from '@/lib/types'

type LocationPreset = 'home' | 'current' | 'other'

interface StepData {
  booking_date: string
  preferred_slots: TimeSlot[]
  address: string
  postal_code: string
  lat: number | null
  lng: number | null
  unit_floor?: string
  building_name?: string
  access_notes?: string
}

interface Props {
  data: StepData
  onChange: (updates: Partial<StepData>) => void
  profileAddress?: { address: string; postal_code: string; lat: number; lng: number } | null
}

export function StepScheduleLocation({ data, onChange, profileAddress }: Props) {
  const isLoaded = useMapsLoaded()

  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const [preset, setPreset] = useState<LocationPreset>('other')
  const [geoLoading, setGeoLoading] = useState(false)

  useEffect(() => {
    if (!isLoaded || !inputRef.current || preset !== 'other') return
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'sg' },
      fields: ['formatted_address', 'geometry', 'address_components'],
    })
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      const postalComp = place.address_components?.find(c => c.types.includes('postal_code'))
      onChangeRef.current({
        address: place.formatted_address ?? '',
        postal_code: postalComp?.short_name ?? '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
    return () => { window.google.maps.event.removeListener(listener) }
  }, [isLoaded, preset])

  function applyHome() {
    if (!profileAddress) return
    setPreset('home')
    onChange({
      address: profileAddress.address,
      postal_code: profileAddress.postal_code,
      lat: profileAddress.lat,
      lng: profileAddress.lng,
    })
  }

  function applyCurrentLocation() {
    setPreset('current')
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const res = await fetch('/api/geocode/reverse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          })
          if (res.ok) {
            const { address, postalCode } = await res.json()
            onChange({ address, postal_code: postalCode ?? '', lat: pos.coords.latitude, lng: pos.coords.longitude })
          }
        } finally {
          setGeoLoading(false)
        }
      },
      () => { setGeoLoading(false); setPreset('other') }
    )
  }

  function handleInputChange() {
    if (data.lat !== null) {
      onChangeRef.current({ address: inputRef.current?.value ?? '', lat: null, lng: null, postal_code: '' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Slot calendar */}
      <div>
        <p className="text-sm font-medium text-primary mb-3">
          Pick a date &amp; time slot <span className="text-red-500">*</span>
        </p>
        <SlotCalendar
          selectedDate={data.booking_date || undefined}
          selectedSlots={data.preferred_slots ?? []}
          onChange={(date, slots) => onChange({ booking_date: date, preferred_slots: slots })}
        />
        {data.booking_date && data.preferred_slots?.length > 0 && (
          <p className="text-xs text-green-700 mt-2">
            ✓ {new Date(data.booking_date + 'T00:00:00').toLocaleDateString('en-SG', {
              day: 'numeric', month: 'short', year: 'numeric',
            })} · {data.preferred_slots.map(s => SLOT_LABELS[s]).join(', ')}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-3 border-t border-border pt-5">
        <p className="text-sm font-medium text-primary">
          Service location <span className="text-red-500">*</span>
        </p>

        <div className="flex gap-2 flex-wrap">
          {profileAddress && (
            <button
              type="button"
              onClick={applyHome}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                preset === 'home' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
              }`}
            >
              <Home className="w-3 h-3" />
              Home
            </button>
          )}
          <button
            type="button"
            onClick={applyCurrentLocation}
            disabled={geoLoading}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              preset === 'current' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
            }`}
          >
            <MapPin className="w-3 h-3" />
            {geoLoading ? 'Locating…' : 'My Location'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPreset('other')
              onChange({ address: '', postal_code: '', lat: null, lng: null })
            }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              preset === 'other' ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:bg-muted/60'
            }`}
          >
            <Pencil className="w-3 h-3" />
            Other
          </button>
        </div>

        {preset === 'other' && (
          <div className="space-y-1.5">
            <Label>Street Address <span className="text-red-500">*</span></Label>
            <Input
              ref={inputRef}
              defaultValue={data.address}
              placeholder={isLoaded ? 'Start typing your address…' : 'Loading…'}
              disabled={!isLoaded}
              onChange={handleInputChange}
              autoComplete="off"
            />
            {data.lat ? (
              <p className="text-xs text-green-700">✓ Location confirmed</p>
            ) : (
              <p className="text-xs text-slate-400">Select an address from the dropdown suggestions.</p>
            )}
          </div>
        )}

        {preset === 'home' && data.address && (
          <div className="space-y-1.5">
            <Label>Address</Label>
            <p className="text-sm text-primary font-medium">{data.address}</p>
          </div>
        )}

        {preset === 'current' && data.address && (
          <div className="space-y-1.5">
            <Label>Detected Address</Label>
            <p className="text-sm text-primary font-medium">{data.address}</p>
          </div>
        )}

        {data.lat && (
          <>
            <div className="space-y-1.5">
              <Label>Unit / Floor</Label>
              <Input
                value={data.unit_floor ?? ''}
                onChange={e => onChange({ unit_floor: e.target.value })}
                placeholder="e.g. #04-05"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Building Name</Label>
              <Input
                value={data.building_name ?? ''}
                onChange={e => onChange({ building_name: e.target.value })}
                placeholder="e.g. Watergate Condominium (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Landmark / Access Notes</Label>
              <Textarea
                value={data.access_notes ?? ''}
                onChange={e => onChange({ access_notes: e.target.value })}
                placeholder="e.g. Gate code 1234, ring buzzer for unit (optional)"
                rows={2}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
