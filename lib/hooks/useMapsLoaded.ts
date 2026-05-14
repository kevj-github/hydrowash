'use client'
import { useEffect, useState } from 'react'

// Polls window.google.maps.places instead of relying on the loader callback,
// which breaks under Turbopack HMR when the module is re-evaluated after the
// Maps script has already fired its callback.
export function useMapsLoaded(): boolean {
  const [isLoaded, setIsLoaded] = useState(
    () => typeof window !== 'undefined' && !!window.google?.maps?.places
  )

  useEffect(() => {
    if (isLoaded) return
    const id = setInterval(() => {
      if (window.google?.maps?.places) {
        setIsLoaded(true)
        clearInterval(id)
      }
    }, 100)
    return () => clearInterval(id)
  }, [isLoaded])

  return isLoaded
}
