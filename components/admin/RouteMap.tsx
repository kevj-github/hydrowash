'use client'
import { useEffect, useRef, useState } from 'react'
import { COLORS } from '@/lib/design-tokens'
import type { RouteStop } from '@/lib/types'

interface LatLng { lat: number; lng: number }

interface Props {
  polyline: LatLng[]
  route: RouteStop[]
  apiKey: string
}

declare global {
  interface Window { google: typeof google }
}

export function RouteMap({ polyline, route, apiKey }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (ready) return
    let cancelled = false
    // Under `loading=async` the script's onload fires before google.maps is
    // populated, so awaiting importLibrary is the only safe readiness signal.
    async function waitForMaps() {
      for (let i = 0; i < 200 && !cancelled; i++) {
        if (window.google?.maps?.importLibrary) {
          await window.google.maps.importLibrary('maps')
          if (!cancelled) setReady(true)
          return
        }
        await new Promise(r => setTimeout(r, 100))
      }
    }
    if (!document.querySelector('script[data-gm-route]')) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`
      script.async = true
      script.setAttribute('data-gm-route', '1')
      document.head.appendChild(script)
    }
    waitForMaps()
    return () => { cancelled = true }
  }, [apiKey, ready])

  useEffect(() => {
    if (!ready || !ref.current || polyline.length < 2) return

    const centre = polyline[Math.floor(polyline.length / 2)]
    let cancelled = false
    let routeLine: google.maps.Polyline | null = null
    let markers: google.maps.marker.AdvancedMarkerElement[] = []

    async function renderMap() {
      const mapsLib = await window.google.maps.importLibrary('maps') as google.maps.MapsLibrary
      const markerLib = await window.google.maps.importLibrary('marker') as google.maps.MarkerLibrary
      if (cancelled || !ref.current) return

      const map = new mapsLib.Map(ref.current, {
        center: centre,
        zoom: 12,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      routeLine = new window.google.maps.Polyline({
        path: polyline,
        geodesic: true,
        strokeColor: COLORS.ACCENT,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map,
      })

      const depotPin = new markerLib.PinElement({
        background: COLORS.PRIMARY,
        borderColor: '#FFFFFF',
        glyphColor: '#FFFFFF',
        glyph: 'D',
      })
      markers.push(new markerLib.AdvancedMarkerElement({
        position: polyline[0],
        map,
        title: 'Depot (start)',
        content: depotPin.element,
      }))

      route.forEach(stop => {
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family:sans-serif;max-width:220px">
              <p style="font-weight:600;margin:0 0 2px">#${stop.sequenceOrder} · ${stop.estimatedStart}–${stop.estimatedEnd}</p>
              <p style="margin:0 0 2px;font-size:13px">${stop.customerName}</p>
              <p style="margin:0;font-size:12px;color:#64748b">${stop.address}</p>
              ${stop.notes ? `<p style="margin:4px 0 0;font-size:12px;color:#92400e;background:#fef3c7;padding:4px 6px;border-radius:4px">${stop.notes}</p>` : ''}
            </div>`,
        })

        const stopPin = new markerLib.PinElement({
          background: COLORS.ACCENT,
          borderColor: '#FFFFFF',
          glyphColor: '#FFFFFF',
          glyph: String(stop.sequenceOrder),
        })
        const marker = new markerLib.AdvancedMarkerElement({
          position: { lat: stop.lat, lng: stop.lng },
          map,
          title: `${stop.customerName} · ${stop.estimatedStart}`,
          content: stopPin.element,
        })

        marker.addListener('click', () => {
          infoWindow.open({ map, anchor: marker })
        })
        markers.push(marker)
      })

      const bounds = new window.google.maps.LatLngBounds()
      polyline.forEach(p => bounds.extend(p))
      map.fitBounds(bounds)
    }

    renderMap()

    return () => {
      cancelled = true
      if (routeLine) routeLine.setMap(null)
      markers.forEach(marker => {
        window.google.maps.event.clearInstanceListeners(marker)
        marker.map = null
      })
      markers = []
    }
  }, [ready, polyline, route])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-sm">
        Loading map…
      </div>
    )
  }

  return <div ref={ref} className="h-full w-full rounded-xl" />
}
