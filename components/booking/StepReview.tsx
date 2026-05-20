'use client'
import { SLOT_LABELS } from '@/lib/types'
import type { ServiceType, PreferredDateSlot } from '@/lib/types'

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

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Please review your booking details before submitting.</p>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h3 className="font-heading font-semibold text-sm text-primary mb-3">Service</h3>
        <Row label="Service" value={service?.name} />
        <Row label="Category" value={data.category} />
        {data.num_units && <Row label="Units" value={data.num_units} />}
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
        {(data.preferred_date_slots ?? []).map((entry, i) => (
          <div key={entry.date} className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500">
              {i === 0 ? 'First preference' : `Preference ${i + 1}`}
            </span>
            <span className="text-sm font-medium text-slate-800 text-right">
              {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-SG', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
              {entry.slots.length > 0 && (
                <> · {entry.slots.map(s => SLOT_LABELS[s]).join(', ')}</>
              )}
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
