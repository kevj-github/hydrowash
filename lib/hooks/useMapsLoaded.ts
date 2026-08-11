'use client'
import { useEffect, useState } from 'react'

// Readiness for the Google Maps JS API under `loading=async`.
//
// Presence checks are not sufficient: the async bootstrap defines
// `window.google.maps` well before the library is populated, so callers that
// touch `google.maps.SymbolPath`, `google.maps.Map` etc. crash if they only
// wait for the namespace. importLibrary() is the documented readiness signal.
//
// `requirePlaces` must be true only for consumers of the Places library. Pages
// that load the script WITHOUT `&libraries=places` would otherwise wait forever
// — which is what kept the /admin/bookings map stuck on "Loading map…".
export function useMapsLoaded(requirePlaces = true): boolean {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function wait() {
      // The <Script> tag that injects the API may not have run yet.
      for (let i = 0; i < 300 && !cancelled; i++) {
        if (typeof window.google?.maps?.importLibrary === 'function') break
        await new Promise(r => setTimeout(r, 100))
      }
      if (cancelled || typeof window.google?.maps?.importLibrary !== 'function') return
      try {
        await window.google.maps.importLibrary('maps')
        if (requirePlaces) await window.google.maps.importLibrary('places')
        if (!cancelled) setIsLoaded(true)
      } catch {
        // Library unavailable (e.g. places not enabled) — stay unloaded so the
        // caller keeps showing its fallback rather than crashing.
      }
    }

    wait()
    return () => { cancelled = true }
  }, [requirePlaces])

  return isLoaded
}
