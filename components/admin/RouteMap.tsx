'use client'
import { useEffect, useRef, useState } from 'react'
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
  const mapRef = useRef<google.maps.Map | null>(null)
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.google?.maps)

  useEffect(() => {
    if (ready) return
    const existing = document.querySelector('script[data-gm-route]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
      script.async = true
      script.setAttribute('data-gm-route', '1')
      script.onload = () => setReady(true)
      document.head.appendChild(script)
    } else {
      existing.addEventListener('load', () => setReady(true))
    }
  }, [apiKey, ready])

  useEffect(() => {
    if (!ready || !ref.current || polyline.length < 2) return

    const centre = polyline[Math.floor(polyline.length / 2)]
    const map = new window.google.maps.Map(ref.current, {
      center: centre,
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    mapRef.current = map

    // Draw polyline
    new window.google.maps.Polyline({
      path: polyline,
      geodesic: true,
      strokeColor: '#0369A1',
      strokeOpacity: 0.85,
      strokeWeight: 3,
      map,
    })

    // Depot marker
    new window.google.maps.Marker({
      position: polyline[0],
      map,
      label: { text: 'D', color: '#fff', fontWeight: 'bold', fontSize: '12px' },
      title: 'Depot (start)',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: '#0F172A',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    })

    // Stop markers with info windows
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

      const marker = new window.google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map,
        label: { text: String(stop.sequenceOrder), color: '#fff', fontWeight: 'bold', fontSize: '12px' },
        title: `${stop.customerName} · ${stop.estimatedStart}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#0369A1',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      })

      marker.addListener('click', () => {
        infoWindow.open(map, marker)
      })
    })

    // Fit bounds
    const bounds = new window.google.maps.LatLngBounds()
    polyline.forEach(p => bounds.extend(p))
    map.fitBounds(bounds)
  }, [ready, polyline, route])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        Loading map…
      </div>
    )
  }

  return <div ref={ref} className="h-full w-full rounded-xl" />
}
