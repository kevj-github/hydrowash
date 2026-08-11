'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, InfoWindow } from '@react-google-maps/api'
import { useMapsLoaded } from '@/lib/hooks/useMapsLoaded'
import { SLOT_LABELS } from '@/lib/types'
import { COLORS } from '@/lib/design-tokens'
import type { BookingWithRelations, TimeSlot } from '@/lib/types'

const MAP_CENTER = { lat: 1.3521, lng: 103.8198 }
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

const PIN_COLOR: Record<string, string> = {
  PENDING: COLORS.WARNING,
  APPROVED: COLORS.ACCENT,
  REJECTED: COLORS.SLATE_400,
  COMPLETED: COLORS.SLATE_400,
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: COLORS.YELLOW_50, color: COLORS.ORANGE_900 },
  APPROVED: { bg: COLORS.BLUE_50, color: COLORS.BLUE_600 },
  REJECTED: { bg: '#F1F5F9', color: '#475569' },
  COMPLETED: { bg: COLORS.GREEN_50, color: COLORS.GREEN_700 },
}

interface Props {
  bookings: BookingWithRelations[]
  selected?: Set<string>
  onPinClick?: (id: string) => void
}

export function BookingsMap({ bookings, selected, onPinClick }: Props) {
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const isLoaded = useMapsLoaded(false)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  const onUnmount = useCallback(() => {
    markersRef.current.forEach(marker => {
      google.maps.event.clearInstanceListeners(marker)
      marker.map = null
    })
    markersRef.current = []
    mapRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    async function renderMarkers() {
      const map = mapRef.current
      if (!map || !window.google?.maps?.importLibrary) return

      const markerLib = await window.google.maps.importLibrary('marker') as google.maps.MarkerLibrary
      if (cancelled) return

      markersRef.current.forEach(marker => {
        google.maps.event.clearInstanceListeners(marker)
        marker.map = null
      })
      markersRef.current = []

      for (const b of bookings) {
        const pin = new markerLib.PinElement({
          background: selected?.has(b.id) ? COLORS.PRIMARY : PIN_COLOR[b.status] ?? COLORS.SLATE_400,
          borderColor: '#FFFFFF',
          glyphColor: '#FFFFFF',
          scale: selected?.has(b.id) ? 1.1 : 1,
        })

        const marker = new markerLib.AdvancedMarkerElement({
          map,
          position: { lat: b.lat, lng: b.lng },
          title: `${b.customer?.name ?? ''} — ${b.service_type?.name ?? ''}`,
          content: pin.element,
        })

        marker.addListener('click', () => {
          setActiveInfoId(prev => prev === b.id ? null : b.id)
          onPinClick?.(b.id)
        })
        markersRef.current.push(marker)
      }
    }

    renderMarkers()
    return () => {
      cancelled = true
    }
  }, [bookings, onPinClick, selected])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-600 text-sm rounded-xl">
        Loading map…
      </div>
    )
  }

  const activeBooking = activeInfoId ? bookings.find(b => b.id === activeInfoId) : null

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={MAP_CENTER}
      zoom={11}
      options={{
        mapId: MAP_ID,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={() => setActiveInfoId(null)}
    >
      {activeBooking && (
        <InfoWindow
          position={{ lat: activeBooking.lat, lng: activeBooking.lng }}
          onCloseClick={() => setActiveInfoId(null)}
          options={{ pixelOffset: new google.maps.Size(0, -12) }}
        >
          <div style={{ maxWidth: 220, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 1.5 }}>
            <p style={{ fontWeight: 700, color: COLORS.PRIMARY, marginBottom: 2 }}>{activeBooking.customer?.name}</p>
            <p style={{ color: COLORS.MUTED_FOREGROUND, marginBottom: 4 }}>{activeBooking.customer?.phone}</p>
            <p style={{ fontWeight: 600, color: COLORS.ACCENT, marginBottom: 2 }}>{activeBooking.service_type?.name}</p>
            <p style={{ color: '#475569', marginBottom: 2 }}>{activeBooking.address}, S{activeBooking.postal_code}</p>
            {(activeBooking.preferred_date_slots ?? []).map((ds: { date: string; slots: string[] }) => (
              <p key={ds.date} style={{ color: '#475569', marginBottom: 2 }}>
                {new Date(ds.date + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                {ds.slots.length > 0 && ` · ${ds.slots.map(s => SLOT_LABELS[s as TimeSlot] ?? s).join(', ')}`}
              </p>
            ))}
            {activeBooking.confirmed_date && (
              <p style={{ fontWeight: 600, color: COLORS.ACCENT, marginBottom: 4 }}>
                Confirmed: {activeBooking.confirmed_date}
              </p>
            )}
            <span style={{
              display: 'inline-block', padding: '1px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
              background: STATUS_BADGE[activeBooking.status]?.bg ?? '#F1F5F9',
              color: STATUS_BADGE[activeBooking.status]?.color ?? '#475569',
            }}>
              {STATUS_LABEL[activeBooking.status] ?? activeBooking.status}
            </span>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
