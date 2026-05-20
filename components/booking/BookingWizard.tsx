'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { StepServiceDetails } from './StepServiceDetails'
import { StepScheduleLocation } from './StepScheduleLocation'
import { StepReview } from './StepReview'
import type { ServiceType, PreferredDateSlot } from '@/lib/types'

interface Props {
  serviceTypes: ServiceType[]
  profileAddress?: { address: string; postal_code: string; lat: number; lng: number } | null
  repeatId?: string
}

const STEPS = ['Service', 'Schedule & Location', 'Review']

type BookingData = {
  service_type_id: string
  category: string
  preferred_date_slots: PreferredDateSlot[]
  unit_location_ids: string[]
  unit_location_others: string[]
  contract_id?: string
  address: string
  postal_code: string
  lat: number | null
  lng: number | null
  unit_floor?: string
  building_name?: string
  access_notes?: string
  num_units?: number
  fault_description?: string
  urgency?: string
  ac_brand?: string
  ac_model?: string
  notes?: string
  media_urls?: string[]
}

const OTHERS_VALUE = '__other__'

const initial: BookingData = {
  service_type_id: '',
  category: '',
  preferred_date_slots: [],
  unit_location_ids: [],
  unit_location_others: [],
  address: '',
  postal_code: '',
  lat: null,
  lng: null,
  media_urls: [],
}


export function BookingWizard({ serviceTypes, profileAddress, repeatId }: Props) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<BookingData>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [prefilled, setPrefilled] = useState(false)
  const router = useRouter()

  function update(updates: Partial<BookingData>) {
    setData(prev => ({ ...prev, ...updates }))
  }

  useEffect(() => {
    if (!repeatId || prefilled) return
    let cancelled = false
    async function loadRepeat() {
      try {
        const res = await fetch(`/api/bookings/${repeatId}`)
        if (!res.ok) return
        const body = await res.json()
        if (cancelled) return
        const booking = body.booking
        const unitLocationIds = body.unit_location_ids ?? []
        setData(prev => ({
          ...prev,
          service_type_id: booking.service_type_id ?? '',
          category: booking.category ?? '',
          num_units: booking.num_units ?? undefined,
          unit_location_ids: unitLocationIds,
          address: booking.address ?? '',
          postal_code: booking.postal_code ?? '',
          lat: booking.lat ?? null,
          lng: booking.lng ?? null,
          unit_floor: booking.unit_floor ?? '',
          building_name: booking.building_name ?? '',
          access_notes: booking.access_notes ?? '',
          preferred_date_slots: [],
        }))
        setStep(0)
        setPrefilled(true)
      } catch {
        // ignore prefill errors
      }
    }
    loadRepeat()
    return () => { cancelled = true }
  }, [repeatId, prefilled])

  function canNext(): boolean {
    if (step === 0) {
      if (!data.service_type_id || !data.category) return false
      if (data.category === 'MAINTENANCE') {
        if (!data.num_units) return false
        const locs = data.unit_location_ids ?? []
        const others = data.unit_location_others ?? []
        if (locs.length < data.num_units) return false
        if (locs.some((id, i) => !id || (id === OTHERS_VALUE && !others[i]?.trim()))) return false
      }
      if (data.category === 'FAULT_REPAIR' && !data.fault_description?.trim()) return false
      if (data.category === 'INSTALLATION' && !data.num_units) return false
      return true
    }
    if (step === 1) {
      const hasValidEntry = data.preferred_date_slots.some(e => e.slots.length > 0)
      return hasValidEntry && !!data.address && data.lat !== null
    }
    return true
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const addressParts = [data.unit_floor, data.building_name, data.address].filter(Boolean)
      const fullAddress = addressParts.join(', ')
      const combinedNotes = [data.access_notes, data.notes].filter(Boolean).join(' | ')

      const firstEntry = data.preferred_date_slots[0]
      const booking_date = firstEntry?.date ?? ''
      const preferred_slots = firstEntry?.slots ?? []
      const time_slot = preferred_slots[0] ?? ''

      const unit_location_ids = (data.unit_location_ids ?? []).filter(id => id !== OTHERS_VALUE)

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          unit_location_ids,
          address: fullAddress || data.address,
          notes: combinedNotes || undefined,
          booking_date,
          preferred_slots,
          time_slot,
          preferred_date_slots: data.preferred_date_slots,
          contract_id: data.contract_id || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Submission failed. Please try again.')
        return
      }
      router.push('/account/bookings?success=1')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="lazyOnload"
      />
      {/* Progress */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-accent' : 'text-slate-400'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors
                ${i < step ? 'bg-accent border-accent text-white'
                  : i === step ? 'border-accent text-accent'
                  : 'border-slate-300 text-slate-400'}`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className="hidden sm:block text-xs font-medium">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-px w-8 sm:w-16 ${i < step ? 'bg-accent' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm mb-6">
        <h2 className="font-heading font-semibold text-lg text-primary mb-5">{STEPS[step]}</h2>

        {step === 0 && <StepServiceDetails serviceTypes={serviceTypes} data={data} onChange={update} />}
        {step === 1 && <StepScheduleLocation data={data} onChange={update} profileAddress={profileAddress} />}
        {step === 2 && <StepReview data={data} serviceTypes={serviceTypes} />}
      </div>

      {error && (
        <div className="mb-4">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            className="bg-accent hover:bg-accent/90 text-white"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-accent hover:bg-accent/90 text-white"
          >
            {submitting ? 'Submitting…' : 'Submit Booking'}
          </Button>
        )}
      </div>
    </div>
  )
}
