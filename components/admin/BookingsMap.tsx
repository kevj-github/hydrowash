'use client'
import { useCallback, useState } from 'react'
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useMapsLoaded } from '@/lib/hooks/useMapsLoaded'
import type { BookingWithRelations } from '@/lib/types'

const MAP_CENTER = { lat: 1.3521, lng: 103.8198 }

const PIN_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  APPROVED: '#0369A1',
  REJECTED: '#94A3B8',
  COMPLETED: '#94A3B8',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#FEF3C7', color: '#92400E' },
  APPROVED: { bg: '#DBEAFE', color: '#1E40AF' },
  REJECTED: { bg: '#F1F5F9', color: '#475569' },
  COMPLETED: { bg: '#DCFCE7', color: '#166534' },
}

interface Props {
  bookings: BookingWithRelations[]
  selected?: Set<string>
  onPinClick?: (id: string) => void
}

export function BookingsMap({ bookings, selected, onPinClick }: Props) {
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null)
  const isLoaded = useMapsLoaded()

  const onLoad = useCallback((_map: google.maps.Map) => {}, [])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-sm rounded-xl">
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
      onLoad={onLoad}
      onClick={() => setActiveInfoId(null)}
    >
      {bookings.map(b => (
        <Marker
          key={b.id}
          position={{ lat: b.lat, lng: b.lng }}
          title={`${b.customer?.name ?? ''} — ${b.service_type?.name ?? ''}`}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: selected?.has(b.id) ? '#0F172A' : PIN_COLOR[b.status] ?? '#94A3B8',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          }}
          onClick={() => {
            setActiveInfoId(prev => prev === b.id ? null : b.id)
            onPinClick?.(b.id)
          }}
        />
      ))}

      {activeBooking && (
        <InfoWindow
          position={{ lat: activeBooking.lat, lng: activeBooking.lng }}
          onCloseClick={() => setActiveInfoId(null)}
          options={{ pixelOffset: new google.maps.Size(0, -12) }}
        >
          <div style={{ maxWidth: 220, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 1.5 }}>
            <p style={{ fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{activeBooking.customer?.name}</p>
            <p style={{ color: '#64748B', marginBottom: 4 }}>{activeBooking.customer?.phone}</p>
            <p style={{ fontWeight: 600, color: '#0369A1', marginBottom: 2 }}>{activeBooking.service_type?.name}</p>
            <p style={{ color: '#475569', marginBottom: 2 }}>{activeBooking.address}, S{activeBooking.postal_code}</p>
            <p style={{ color: '#475569', marginBottom: 4 }}>
              {activeBooking.booking_date ?? '—'}
              {activeBooking.time_slot ? ` · ${activeBooking.time_slot}` : ''}
            </p>
            {activeBooking.confirmed_date && (
              <p style={{ fontWeight: 600, color: '#0369A1', marginBottom: 4 }}>
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
