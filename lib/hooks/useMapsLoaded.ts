'use client'
import { useEffect, useState } from 'react'

// Polls window.google.maps instead of relying on the loader callback, which
// breaks under Turbopack HMR when the module is re-evaluated after the Maps
// script has already fired its callback. Polling is also required now that the
// script is loaded with `loading=async`: the script's own onload fires before
// the API surface is populated.
//
// `requirePlaces` must be true only for consumers of the Places library. Pages
// that load the script WITHOUT `&libraries=places` would otherwise wait forever
// — which is exactly what kept the /admin/bookings map stuck on "Loading map…".
export function useMapsLoaded(requirePlaces = true): boolean {
  const ready = () =>
    typeof window !== 'undefined' &&
    !!window.google?.maps &&
    (!requirePlaces || !!window.google.maps.places)

  const [isLoaded, setIsLoaded] = useState(ready)

  useEffect(() => {
    if (isLoaded) return
    const id = setInterval(() => {
      if (ready()) {
        setIsLoaded(true)
        clearInterval(id)
      }
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, requirePlaces])

  return isLoaded
}
