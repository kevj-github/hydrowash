'use client'
import { useEffect, useRef } from 'react'
import { useMapsLoaded } from '@/lib/hooks/useMapsLoaded'

export interface ResolvedAddress {
  address: string
  postal_code: string
  lat: number
  lng: number
}

interface Props {
  /** Applied to the underlying Google input so <Label htmlFor> still works. */
  id?: string
  placeholder?: string
  /** Pre-fills the field (e.g. an address already on the profile). */
  defaultValue?: string
  /** Fires with the resolved place, or null when the user edits the text again. */
  onResolved: (address: ResolvedAddress | null) => void
}

/**
 * Singapore address picker built on google.maps.places.PlaceAutocompleteElement.
 *
 * Replaces google.maps.places.Autocomplete, which Google closed to new
 * customers on 2025-03-01. The element renders and positions its own dropdown,
 * so it can no longer cover the surrounding form's primary action the way the
 * old detached .pac-container did.
 */
export function AddressAutocomplete({ id, placeholder, defaultValue, onResolved }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const isLoaded = useMapsLoaded()

  // Keep the latest callback without re-creating the element on every render.
  const onResolvedRef = useRef(onResolved)
  onResolvedRef.current = onResolved

  useEffect(() => {
    const host = hostRef.current
    if (!isLoaded || !host) return

    const el = new window.google.maps.places.PlaceAutocompleteElement({
      includedRegionCodes: ['sg'],
      requestedRegion: 'sg',
    })
    if (id) el.id = id
    if (placeholder) el.placeholder = placeholder
    if (defaultValue) el.value = defaultValue
    el.className = 'hw-place-autocomplete'

    async function handleSelect(event: google.maps.places.PlacePredictionSelectEvent) {
      const place = event.placePrediction.toPlace()
      await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] })
      const loc = place.location
      if (!loc) return
      const postal = place.addressComponents?.find(c => c.types.includes('postal_code'))
      onResolvedRef.current({
        address: place.formattedAddress ?? '',
        // Street-level results carry no postal_code component; callers must
        // tolerate '' rather than render a dangling label.
        postal_code: postal?.shortText ?? '',
        lat: loc.lat(),
        lng: loc.lng(),
      })
    }

    // Typing after a selection invalidates it — the caller should re-require a pick.
    function handleInput() {
      onResolvedRef.current(null)
    }

    el.addEventListener('gmp-select', handleSelect)
    el.addEventListener('input', handleInput)
    host.replaceChildren(el)

    return () => {
      // Only addEventListener is covered by PlaceAutocompleteElementEventMap.
      el.removeEventListener('gmp-select', handleSelect as unknown as EventListener)
      el.removeEventListener('input', handleInput)
      host.replaceChildren()
    }
    // defaultValue/placeholder are initial-render concerns only; re-running would
    // wipe whatever the user has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, id])

  if (!isLoaded) {
    return (
      <div className="h-11 w-full rounded-md border border-border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground">
        Loading address search…
      </div>
    )
  }

  return <div ref={hostRef} className="hw-place-autocomplete-host w-full" />
}
