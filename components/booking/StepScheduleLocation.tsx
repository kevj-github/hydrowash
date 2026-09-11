'use client'
import { useEffect, useRef, useState } from 'react'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { Home, MapPin, Pencil, Lock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SlotCalendar } from './SlotCalendar'
import type { PreferredDateSlot } from '@/lib/types'

type LocationPreset = 'home' | 'current' | 'other'

interface StepData {
  preferred_date_slots: PreferredDateSlot[]
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
  profileAddress?: { address: string; postal_code: string; lat: number; lng: number; unit_floor?: string; building_name?: string } | null
  contractAddress?: string
  contractAllowedMonth?: string | null
}

export function StepScheduleLocation({ data, onChange, profileAddress, contractAddress, contractAllowedMonth }: Props) {
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Default the preset pill to match how `data.address` got here: if it's
  // the customer's profile/home address (prefilled from a past booking, or
  // freshly applied below when there's no past booking), select "Home"; if
  // it's some other prefilled address, select "Other" (never leave the
  // pills on "Other" by default when the customer actually has a home
  // address on file — see PRODUCT feedback on booking-memory defaults).
  const [preset, setPreset] = useState<LocationPreset>(() => {
    if (contractAddress) return 'other'
    if (data.address && profileAddress && data.address === profileAddress.address) return 'home'
    if (data.address) return 'other'
    if (profileAddress) return 'home'
    return 'other'
  })
  const [geoLoading, setGeoLoading] = useState(false)
  const [contractGeoLoading, setContractGeoLoading] = useState(false)

  // No past booking to prefill from, but the customer has a saved home
  // address — apply it automatically instead of leaving location blank
  // under the (already-selected) "Home" pill.
  useEffect(() => {
    if (contractAddress) return
    if (data.address) return
    if (!profileAddress) return
    applyHome()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-geocode contract address when it changes
  useEffect(() => {
    if (!contractAddress) return
    // Only skip if lat/lng were already resolved for *this* contract address —
    // data.lat can be non-null from an unrelated past booking's prefill (or a
    // previously-linked contract), which must not be mistaken for "already
    // geocoded" and left in place instead of the linked contract's location.
    if (data.lat !== null && data.address === contractAddress) return
    setContractGeoLoading(true)
    fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: contractAddress }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(result => {
        if (result) {
          onChangeRef.current({
            address: contractAddress,
            lat: result.lat,
            lng: result.lng,
            postal_code: '',
          })
        }
      })
      .finally(() => setContractGeoLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress])

  function applyHome() {
    if (!profileAddress) return
    setPreset('home')
    onChange({
      address: profileAddress.address,
      postal_code: profileAddress.postal_code,
      lat: profileAddress.lat,
      lng: profileAddress.lng,
      unit_floor: profileAddress.unit_floor ?? '',
      building_name: profileAddress.building_name ?? '',
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

  return (
    <div className="space-y-6">
      {/* Slot calendar */}
      <div>
        <p className="text-sm font-medium text-primary mb-1">
          Pick your preferred dates &amp; time slots <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Choose up to 3 dates in total, with a time slot for each (e.g. 3 dates with 1 slot each, or fewer dates
          with multiple slots). We&apos;ll confirm one of your chosen date and slot combinations — offering a few
          options increases the chance we can book your first choice.
        </p>
        <SlotCalendar
          value={data.preferred_date_slots ?? []}
          onChange={(entries) => onChange({ preferred_date_slots: entries })}
          allowedMonth={contractAllowedMonth}
        />
        {data.preferred_date_slots?.some(e => e.slots.length > 0) && (
          <p className="text-xs text-green-700 mt-2">
            ✓ {data.preferred_date_slots.filter(e => e.slots.length > 0).length} date preference
            {data.preferred_date_slots.filter(e => e.slots.length > 0).length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-3 border-t border-border pt-5">
        <p className="text-sm font-medium text-primary">
          Service location <span className="text-red-500">*</span>
        </p>

        {contractAddress ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/30">
              <Lock className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs text-accent font-medium">Address fixed to contract location</span>
            </div>
            <div className="space-y-1.5">
              <Label>Contract Address</Label>
              <p className="text-sm text-primary font-medium">
                {contractGeoLoading ? 'Verifying address…' : contractAddress}
              </p>
              {data.lat ? (
                <p className="text-xs text-green-700">✓ Location confirmed</p>
              ) : contractGeoLoading ? null : (
                <p className="text-xs text-amber-600">Address could not be geocoded — booking may still proceed.</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {profileAddress && (
                <button
                  type="button"
                  onClick={applyHome}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2.5 min-h-[44px] rounded-full border font-medium transition-colors ${
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
                className={`flex items-center gap-1.5 text-xs px-3 py-2.5 min-h-[44px] rounded-full border font-medium transition-colors ${
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
                className={`flex items-center gap-1.5 text-xs px-3 py-2.5 min-h-[44px] rounded-full border font-medium transition-colors ${
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
                <div className="w-full max-w-full">
                  <AddressAutocomplete
                    placeholder="Start typing your address…"
                    defaultValue={data.address}
                    onResolved={resolved => {
                      onChangeRef.current(
                        resolved
                          ? {
                              address: resolved.address,
                              postal_code: resolved.postal_code,
                              lat: resolved.lat,
                              lng: resolved.lng,
                            }
                          : { address: '', postal_code: '', lat: null, lng: null }
                      )
                    }}
                  />
                </div>
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
          </>
        )}

        {/* Unit/floor, building, and access notes are already part of the
            contract's own address string once locked to a contract — showing
            them as separate editable fields here would suggest they still
            need filling in, so they're hidden in that case. */}
        {data.lat && !contractAddress && (
          <>
            <div className="space-y-1.5">
              <Label>Unit / Floor <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                value={data.unit_floor ?? ''}
                onChange={e => onChange({ unit_floor: e.target.value })}
                placeholder="e.g. #04-05"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Building Name <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                value={data.building_name ?? ''}
                onChange={e => onChange({ building_name: e.target.value })}
                placeholder="e.g. Watergate Condominium"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Landmark / Access Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                value={data.access_notes ?? ''}
                onChange={e => onChange({ access_notes: e.target.value })}
                placeholder="e.g. Gate code 1234, ring buzzer for unit"
                rows={2}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
