'use client'
import { useEffect, useState } from 'react'
import { SLOT_LABELS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import type { ServiceType, PreferredDateSlot } from '@/lib/types'

const CATEGORY_LABELS: Record<string, string> = {
  MAINTENANCE: 'General maintenance',
  FAULT_REPAIR: 'Fault repair',
  INSTALLATION: 'Installation',
}

interface BookingData {
  service_type_id: string
  category: string
  preferred_date_slots: PreferredDateSlot[]
  address: string
  postal_code: string
  unit_floor?: string
  building_name?: string
  access_notes?: string
  num_units?: number
  unit_location_ids?: string[]
  unit_location_others?: string[]
  fault_description?: string
  urgency?: string
  ac_brand?: string
  ac_model?: string
  notes?: string
  media_urls?: string[]
}

interface Props {
  data: BookingData
  serviceTypes: ServiceType[]
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
    </div>
  )
}

export function StepReview({ data, serviceTypes }: Props) {
  const service = serviceTypes.find(s => s.id === data.service_type_id)
  const categoryLabel = CATEGORY_LABELS[data.category] ?? data.category

  // Room labels aren't carried in booking data — resolve the ids so the customer
  // can verify the rooms they were required to pick before submitting.
  const [roomLabels, setRoomLabels] = useState<string[]>([])
  const ids = (data.unit_location_ids ?? []).join(',')
  useEffect(() => {
    const idList = ids ? ids.split(',') : []
    if (idList.length === 0) return
    let cancelled = false
    createClient()
      .from('ac_unit_locations')
      .select('id,label')
      .in('id', idList)
      .then(({ data: rows }) => {
        if (cancelled) return
        const byId = new Map((rows ?? []).map(r => [r.id as string, r.label as string]))
        setRoomLabels(idList.map(id => byId.get(id)).filter((l): l is string => !!l))
      })
    return () => { cancelled = true }
  }, [ids])

  const allRooms = [
    ...(ids ? roomLabels : []),
    ...(data.unit_location_others ?? []).filter(Boolean),
  ]

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Please review your booking details before submitting.</p>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h3 className="font-heading font-semibold text-sm text-primary mb-3">Service</h3>
        <Row label="Service" value={service?.name} />
        {/* Category is dropped when it just restates the service name
            ("General Maintenance" / "General maintenance"); it still earns its
            row for fault repairs, where the service name is the fault itself. */}
        {categoryLabel.toLowerCase() !== (service?.name ?? '').toLowerCase() && (
          <Row label="Category" value={categoryLabel} />
        )}
        {/* Maintenance has no fixed price; say so rather than showing nothing —
            the customer was otherwise committing to a home visit blind. */}
        {service && (
          <Row
            label="Price"
            value={service.price_sgd != null
              ? `S$${Number(service.price_sgd).toFixed(2)}`
              : 'Quoted after on-site inspection'}
          />
        )}
        {data.num_units && <Row label="Units" value={data.num_units} />}
        {allRooms.length > 0 && <Row label="Rooms" value={allRooms.join(', ')} />}
        {data.fault_description && <Row label="Fault" value={data.fault_description} />}
        {data.urgency && <Row label="Urgency" value={data.urgency} />}
        {data.ac_brand && <Row label="Brand" value={data.ac_brand} />}
        {data.ac_model && <Row label="Model" value={data.ac_model} />}
        {data.notes && <Row label="Notes" value={data.notes} />}
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h3 className="font-heading font-semibold text-sm text-primary mb-3">Schedule</h3>
        {(data.preferred_date_slots ?? []).length === 0 && (
          <p className="text-sm text-slate-400">No dates selected.</p>
        )}
        {(data.preferred_date_slots ?? []).map((entry) => (
          <div key={entry.date} className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm font-medium text-slate-800">
              {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-SG', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
            <span className="text-sm text-slate-500 text-right">
              {entry.slots.length > 0 ? entry.slots.map(s => SLOT_LABELS[s]).join(', ') : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h3 className="font-heading font-semibold text-sm text-primary mb-3">Location</h3>
        <Row label="Address" value={data.address} />
        {data.postal_code && <Row label="Postal Code" value={data.postal_code} />}
        {data.unit_floor && <Row label="Unit / Floor" value={data.unit_floor} />}
        {data.building_name && <Row label="Building" value={data.building_name} />}
        {data.access_notes && <Row label="Access Notes" value={data.access_notes} />}
      </div>

      {data.media_urls && data.media_urls.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <h3 className="font-heading font-semibold text-sm text-primary mb-3">Attachments</h3>
          <p className="text-sm text-slate-600">{data.media_urls.length} file{data.media_urls.length !== 1 ? 's' : ''} attached</p>
        </div>
      )}
    </div>
  )
}
