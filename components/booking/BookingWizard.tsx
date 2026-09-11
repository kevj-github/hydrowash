'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { Check, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StepServiceDetails } from './StepServiceDetails'
import { StepScheduleLocation } from './StepScheduleLocation'
import { StepReview } from './StepReview'
import type { ServiceType, PreferredDateSlot, ContractUnitDetail } from '@/lib/types'

interface Props {
  serviceTypes: ServiceType[]
  profileAddress?: { address: string; postal_code: string; lat: number; lng: number; unit_floor?: string; building_name?: string } | null
  repeatId?: string
  /** From a quarterly-reminder email's "Book Now" deep link (?contract=id) —
   *  forces MAINTENANCE category so StepServiceDetails' contract picker loads,
   *  then auto-selects this contract once it appears in that list. */
  preselectContractId?: string
}

const STEPS = ['Service', 'Schedule & Location', 'Review']

type BookingData = {
  service_type_id: string
  category: string
  preferred_date_slots: PreferredDateSlot[]
  unit_location_ids: string[]
  unit_location_others: string[]
  contract_id?: string
  contract_address?: string
  contract_unit_details?: ContractUnitDetail[]
  contract_next_due_month?: string | null
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


export function BookingWizard({ serviceTypes, profileAddress, repeatId, preselectContractId }: Props) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<BookingData>(() =>
    preselectContractId ? { ...initial, category: 'MAINTENANCE' } : initial
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [prefilled, setPrefilled] = useState(false)
  const router = useRouter()

  function update(updates: Partial<BookingData>) {
    setData(prev => ({ ...prev, ...updates }))
  }

  // Prefills from a specific past booking (?repeat=id, still supported for a
  // possible future "Book Again" link) or — when no repeatId is given — from
  // the customer's own most recent booking, so returning customers don't
  // have to re-type unit counts/locations/address every time. Deliberately
  // does NOT prefill contract_id even if the source booking was contract-linked
  // (the customer must re-choose linking explicitly), and always clears
  // preferred_date_slots (schedule is chosen fresh every time).
  useEffect(() => {
    if (prefilled) return
    let cancelled = false
    async function loadPrefill() {
      try {
        const url = repeatId ? `/api/bookings/${repeatId}` : '/api/bookings/last'
        const res = await fetch(url)
        if (!res.ok) { setPrefilled(true); return }
        const body = await res.json()
        const booking = body.booking
        if (!booking) { setPrefilled(true); return }
        if (cancelled) return
        const unitLocationIds = body.unit_location_ids ?? []
        // A ?contract= deep link commits this booking to MAINTENANCE — don't
        // let a prefilled service_type_id from a different-category past
        // booking silently mismatch the locked category (the customer picks
        // a specific MAINTENANCE service type themselves in that case).
        setData(prev => ({
          ...prev,
          service_type_id: preselectContractId ? '' : (booking.service_type_id ?? ''),
          category: preselectContractId ? 'MAINTENANCE' : (booking.category ?? ''),
          num_units: booking.num_units ?? undefined,
          unit_location_ids: unitLocationIds,
          unit_location_others: booking.unit_location_others ?? [],
          address: booking.address ?? '',
          postal_code: booking.postal_code ?? '',
          lat: booking.lat ?? null,
          lng: booking.lng ?? null,
          unit_floor: booking.unit_floor ?? '',
          building_name: booking.building_name ?? '',
          access_notes: booking.access_notes ?? '',
          ac_brand: booking.ac_brand ?? undefined,
          ac_model: booking.ac_model ?? undefined,
          preferred_date_slots: [],
        }))
        setStep(0)
        setPrefilled(true)
      } catch {
        setPrefilled(true)
      }
    }
    loadPrefill()
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
      const addressOk = !!data.address && (data.lat !== null || !!data.contract_address)
      return hasValidEntry && addressOk
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
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
        strategy="lazyOnload"
      />
      {/* Progress bar */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                i < step
                  ? 'bg-accent/20 text-accent'
                  : i === step
                  ? 'bg-accent text-white shadow-md shadow-accent/30'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check size={16} strokeWidth={2.5} /> : i + 1}
              </div>
              <span className={`text-xs mt-1.5 font-medium hidden sm:block ${i === step ? 'text-accent' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 sm:w-24 h-0.5 mx-1 sm:mx-2 mb-5 transition-colors duration-200 ${i < step ? 'bg-accent' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8 mb-6">
        <h2 className="font-heading font-semibold text-lg text-primary mb-5">{STEPS[step]}</h2>

        {step === 0 && <StepServiceDetails serviceTypes={serviceTypes} data={data} onChange={update} preselectContractId={preselectContractId} />}
        {step === 1 && <StepScheduleLocation data={data} onChange={update} profileAddress={profileAddress} contractAddress={data.contract_address} contractAllowedMonth={data.contract_next_due_month} />}
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
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="min-h-[44px] px-6"
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            className="bg-accent hover:bg-accent/90 text-white min-h-[44px] px-6"
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            disabled={submitting}
            className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-3 rounded-xl cursor-pointer disabled:opacity-70"
            onClick={handleSubmit}
          >
            {submitting ? (
              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Submitting…</span>
            ) : (
              <span className="flex items-center gap-2">Confirm Booking <ArrowRight size={16} /></span>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
