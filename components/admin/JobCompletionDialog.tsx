'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toAcUnitDetails } from '@/lib/contracts/units'
import { buildJobDescription, buildJobRendered } from '@/lib/jobs/descriptions'
import { slotTimeRange } from '@/lib/booking/slots'
import type { BookingWithRelations, AcUnitDetail, ChecklistItem, AdditionalCharge } from '@/lib/types'

const TIME_RE = /^\d{2}:\d{2}$/
function toTimeInputValue(v: string | null | undefined): string {
  return v && TIME_RE.test(v) ? v : ''
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { item: 'Air Filter Cleaned', checked: false },
  { item: 'Coils Cleaned', checked: false },
  { item: 'Fan Cleaned', checked: false },
  { item: 'Area Cleaned', checked: false },
  { item: 'Drip Tray Cleaned', checked: false },
  { item: 'Drainage Pipe Cleaned', checked: false },
  { item: 'Body Checked', checked: false },
  { item: 'Screws Checked', checked: false },
]

interface Props {
  booking: BookingWithRelations
  onSuccess: () => void
}

export function JobCompletionDialog({ booking, onSuccess }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // Bumped after every successful save so the Preview link's URL always
  // changes — belt-and-braces against the PDF being served from any cache
  // (browser, proxy, or the OS-level PDF viewer some browsers open it in)
  // that might not honor the route's Cache-Control: no-store header.
  const [previewCacheBust, setPreviewCacheBust] = useState(0)
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [unitTypes, setUnitTypes] = useState<{ id: string; name: string }[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [staff, setStaff] = useState<{ id: string; label: string; is_default: boolean }[]>([])
  const loadedRef = useRef(false)

  // Step 1 fields
  const [attendedBy, setAttendedBy] = useState('')
  const [timeArrived, setTimeArrived] = useState('')
  const [timeCompleted, setTimeCompleted] = useState('')
  const [timeWarning, setTimeWarning] = useState<{ arrived: string | null; completed: string | null }>({ arrived: null, completed: null })
  const [acDetails, setAcDetails] = useState<AcUnitDetail[]>(() =>
    Array.from({ length: booking.num_units ?? 1 }, (_, i) => ({
      no: i + 1, brand: '', model: '', serial_no: '', location: '',
    }))
  )
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST)
  const [jobDescription, setJobDescription] = useState('')
  const [jobRendered, setJobRendered] = useState('')
  const [remarks, setRemarks] = useState('')

  // Step 2 fields
  const [basePrice, setBasePrice] = useState('')
  const [charges, setCharges] = useState<AdditionalCharge[]>([])

  function regenerateJobText() {
    const input = {
      serviceTypeName: booking.service_type?.name ?? '',
      category: booking.category,
      units: acDetails,
      numUnits: booking.num_units ?? acDetails.length,
      faultDescription: booking.fault_description,
    }
    setJobDescription(buildJobDescription(input))
    setJobRendered(buildJobRendered(input))
  }

  useEffect(() => {
    if (!open || loadedRef.current) return
    loadedRef.current = true

    async function load() {
      const [brandsRes, typesRes, locsRes, staffRes, jcRes] = await Promise.all([
        supabase.from('ac_brands').select('id, label').order('display_order'),
        supabase.from('ac_unit_types').select('id, label').order('display_order'),
        supabase.from('ac_unit_locations').select('id, label').order('display_order'),
        supabase.from('staff_members').select('id, label, is_default').eq('is_active', true).order('display_order'),
        supabase.from('job_completions').select('*').eq('booking_id', booking.id).maybeSingle(),
      ])
      if (brandsRes.data) setBrands(brandsRes.data.map(b => ({ id: b.id, name: b.label })))
      if (typesRes.data) setUnitTypes(typesRes.data.map(t => ({ id: t.id, name: t.label })))
      if (locsRes.data) setLocations(locsRes.data.map(l => ({ id: l.id, name: l.label })))
      const staffList = staffRes.data ?? []
      setStaff(staffList)

      const jc = jcRes.data
      if (jc) {
        // A completion already exists — hydrate from it and stop. Regenerating
        // defaults here would silently overwrite the admin's saved edits.
        setAttendedBy(jc.attended_by ?? '')
        setTimeArrived(toTimeInputValue(jc.time_arrived))
        setTimeCompleted(toTimeInputValue(jc.time_completed))
        setTimeWarning({
          arrived: jc.time_arrived && !TIME_RE.test(jc.time_arrived) ? jc.time_arrived : null,
          completed: jc.time_completed && !TIME_RE.test(jc.time_completed) ? jc.time_completed : null,
        })
        setAcDetails(jc.ac_details?.length ? jc.ac_details : acDetails)
        setChecklist(jc.checklist?.length ? jc.checklist : DEFAULT_CHECKLIST)
        setJobDescription(jc.job_description ?? '')
        setJobRendered(jc.job_rendered ?? '')
        setRemarks(jc.remarks ?? '')
        setBasePrice(jc.base_price_sgd != null ? String(jc.base_price_sgd) : '')
        setCharges(jc.additional_charges ?? [])
        return
      }

      // No completion yet — build sensible defaults.
      let units: AcUnitDetail[] = acDetails
      if (booking.contract_id) {
        const { data: contract } = await supabase
          .from('contracts').select('unit_details').eq('id', booking.contract_id).single()
        if (contract?.unit_details?.length) units = toAcUnitDetails(contract.unit_details)
      }
      if (units.every(u => !u.location)) {
        const { data: bul } = await supabase
          .from('booking_unit_locations')
          .select('ac_unit_locations(label)')
          .eq('booking_id', booking.id)
        const labels = (bul ?? [])
          .map((r) => (r as unknown as { ac_unit_locations: { label: string } | null }).ac_unit_locations?.label)
          .filter((l): l is string => !!l)
        const allLabels = [...labels, ...(booking.unit_location_others ?? [])]
        if (allLabels.length) {
          units = Array.from({ length: booking.num_units ?? allLabels.length }, (_, i) => ({
            no: i + 1, brand: '', model: '', serial_no: '', location: allLabels[i] ?? '',
          }))
        }
      }
      setAcDetails(units)

      setAttendedBy(staffList.find(s => s.is_default)?.label ?? '')

      if (booking.confirmed_slot) {
        const { start, end } = slotTimeRange(booking.confirmed_slot)
        setTimeArrived(start)
        setTimeCompleted(end)
      }

      const textInput = {
        serviceTypeName: booking.service_type?.name ?? '',
        category: booking.category,
        units,
        numUnits: booking.num_units ?? units.length,
        faultDescription: booking.fault_description,
      }
      setJobDescription(buildJobDescription(textInput))
      setJobRendered(buildJobRendered(textInput))
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function totalSgd() {
    const base = parseFloat(basePrice) || 0
    return base + charges.reduce((s, c) => s + (c.amount_sgd || 0), 0)
  }

  function buildPayload() {
    return {
      attended_by: attendedBy,
      time_arrived: timeArrived,
      time_completed: timeCompleted,
      ac_details: acDetails,
      checklist,
      job_description: jobDescription,
      job_rendered: jobRendered,
      remarks,
      additional_charges: charges,
      base_price_sgd: parseFloat(basePrice) || 0,
    }
  }

  async function handleSaveCompletion() {
    setSaving(true)
    setError('')
    // save_only: saves job_completions without marking the booking as COMPLETED yet
    const res = await fetch(`/api/bookings/${booking.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildPayload(), save_only: true }),
    })
    setSaving(false)
    if (res.ok) {
      setPreviewCacheBust(v => v + 1)
      setStep(3)
    } else {
      const body = await res.json()
      setError(body.error ?? 'Failed to save job data')
    }
  }

  async function handleSendWorkOrder() {
    setSending(true)
    setError('')
    // Mark booking COMPLETED (saves final data + triggers work_order_no DB trigger)
    const completeRes = await fetch(`/api/bookings/${booking.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    })
    if (!completeRes.ok) {
      const body = await completeRes.json()
      setSending(false)
      setError(body.error ?? 'Failed to mark job complete')
      return
    }
    // Send work order PDF + create invoice
    const sendRes = await fetch(`/api/bookings/${booking.id}/send-work-order`, { method: 'POST' })
    setSending(false)
    if (sendRes.ok) {
      setOpen(false)
      onSuccess()
    } else {
      const body = await sendRes.json()
      setError(body.error ?? 'Failed to send work order')
    }
  }

  function updateAc(i: number, field: keyof AcUnitDetail, value: string) {
    setAcDetails(prev => prev.map((u, idx) => idx === i ? { ...u, [field]: value } : u))
  }

  function toggleChecklist(i: number) {
    setChecklist(prev => prev.map((c, idx) => idx === i ? { ...c, checked: !c.checked } : c))
  }

  const allChecklistChecked = checklist.length > 0 && checklist.every(c => c.checked)

  function toggleSelectAllChecklist() {
    setChecklist(prev => prev.map(c => ({ ...c, checked: !allChecklistChecked })))
  }

  function addCharge() {
    setCharges(prev => [...prev, { description: '', amount_sgd: 0 }])
  }

  function updateCharge(i: number, field: keyof AdditionalCharge, value: string | number) {
    setCharges(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  const step1Missing = (() => {
    const missing: string[] = []
    if (!attendedBy.trim()) missing.push('attended by')
    if (!timeArrived.trim()) missing.push('time arrived')
    if (!timeCompleted.trim()) missing.push('time completed')
    const incomplete = acDetails.filter(u => !u.brand?.trim() || !u.model?.trim())
    if (incomplete.length > 0) {
      missing.push(`brand and model for ${incomplete.length} unit${incomplete.length > 1 ? 's' : ''}`)
    }
    return missing
  })()

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o)
      if (!o) {
        setStep(1)
        setError('')
        // Force the next open to re-fetch job_completions from the server
        // instead of reusing whatever was last loaded into this (persistent,
        // never-unmounted) dialog instance — otherwise reopening to make a
        // further edit shows stale data and can clobber a save made from
        // elsewhere (e.g. the Agenda popup's own copy of this dialog).
        loadedRef.current = false
      }
    }}>
      <DialogTrigger className={cn(buttonVariants({ size: 'sm' }), 'bg-accent hover:bg-accent/90 text-white')}>
        Complete Job
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Step 1 — Job Details'}
            {step === 2 && 'Step 2 — Pricing'}
            {step === 3 && 'Step 3 — Preview & Send'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="jc-attended-by">Attended By</Label>
                {(() => {
                  const staffLabels = staff.map(s => s.label)
                  const attendedIsOther = !!attendedBy && !staffLabels.includes(attendedBy)
                  return (
                    <>
                      <select
                        id="jc-attended-by"
                        aria-label="Attended by"
                        className="w-full h-9 border border-border rounded-md px-2 text-sm bg-transparent"
                        value={attendedIsOther ? '__other__' : attendedBy}
                        onChange={e => setAttendedBy(e.target.value === '__other__' ? '' : e.target.value)}
                      >
                        <option value="">—</option>
                        {staff.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                        <option value="__other__">Others</option>
                      </select>
                      {attendedIsOther && (
                        <Input className="h-8 text-sm" value={attendedBy} onChange={e => setAttendedBy(e.target.value)} placeholder="Enter name…" autoFocus />
                      )}
                    </>
                  )
                })()}
              </div>
              <div className="space-y-1">
                <Label htmlFor="jc-time-arrived">Time Arrived</Label>
                <Input id="jc-time-arrived" type="time" step={60} value={timeArrived} onChange={e => setTimeArrived(e.target.value)} />
                {timeWarning.arrived && (
                  <p className="text-[11px] text-amber-700">Previous value &quot;{timeWarning.arrived}&quot; wasn&apos;t a valid time — please re-enter.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="jc-time-completed">Time Completed</Label>
                <Input id="jc-time-completed" type="time" step={60} value={timeCompleted} onChange={e => setTimeCompleted(e.target.value)} />
                {timeWarning.completed && (
                  <p className="text-[11px] text-amber-700">Previous value &quot;{timeWarning.completed}&quot; wasn&apos;t a valid time — please re-enter.</p>
                )}
              </div>
            </div>

            {/* AC Details */}
            <div>
              <Label className="mb-2 block">A/C System Details</Label>

              {/* Desktop table */}
              <div className="hidden md:block border border-border rounded overflow-hidden text-xs">
                <div className="grid grid-cols-5 bg-primary text-white px-2 py-1.5 font-semibold">
                  <span>No</span><span>Brand</span><span>Model</span><span>Serial No</span><span>Location</span>
                </div>
                {acDetails.map((unit, i) => {
                  const brandNames = brands.map(b => b.name)
                  const typeNames = unitTypes.map(t => t.name)
                  const locationNames = locations.map(l => l.name)
                  const brandIsOther = !!unit.brand && !brandNames.includes(unit.brand)
                  const modelIsOther = !!unit.model && !typeNames.includes(unit.model)
                  const locationIsOther = !!unit.location && !locationNames.includes(unit.location)
                  return (
                    <div key={i} className="grid grid-cols-5 gap-1 px-2 py-2 border-t border-border items-start">
                      <span className="flex items-center pt-1">{i + 1}</span>
                      <div className="space-y-1">
                        <select aria-label={`Unit ${i + 1} brand`} className="w-full border border-border rounded px-1 py-0.5 text-xs" value={brandIsOther ? '__other__' : unit.brand} onChange={e => updateAc(i, 'brand', e.target.value === '__other__' ? '' : e.target.value)}>
                          <option value="">—</option>
                          {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {brandIsOther && <Input className="h-6 text-xs px-1" value={unit.brand} onChange={e => updateAc(i, 'brand', e.target.value)} placeholder="Specify brand…" autoFocus />}
                      </div>
                      <div className="space-y-1">
                        <select aria-label={`Unit ${i + 1} model`} className="w-full border border-border rounded px-1 py-0.5 text-xs" value={modelIsOther ? '__other__' : unit.model} onChange={e => updateAc(i, 'model', e.target.value === '__other__' ? '' : e.target.value)}>
                          <option value="">—</option>
                          {unitTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {modelIsOther && <Input className="h-6 text-xs px-1" value={unit.model} onChange={e => updateAc(i, 'model', e.target.value)} placeholder="Specify model…" autoFocus />}
                      </div>
                      <Input className="h-6 text-xs px-1" value={unit.serial_no} onChange={e => updateAc(i, 'serial_no', e.target.value)} placeholder="S/N" />
                      <div className="space-y-1">
                        <select aria-label={`Unit ${i + 1} location`} className="w-full border border-border rounded px-1 py-0.5 text-xs" value={locationIsOther ? '__other__' : unit.location} onChange={e => updateAc(i, 'location', e.target.value === '__other__' ? '' : e.target.value)}>
                          <option value="">—</option>
                          {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {locationIsOther && <Input className="h-6 text-xs px-1" value={unit.location} onChange={e => updateAc(i, 'location', e.target.value)} placeholder="Specify location…" autoFocus />}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mobile stacked cards */}
              <div className="md:hidden space-y-3">
                {acDetails.map((unit, i) => {
                  const brandNames = brands.map(b => b.name)
                  const typeNames = unitTypes.map(t => t.name)
                  const locationNames = locations.map(l => l.name)
                  const brandIsOther = !!unit.brand && !brandNames.includes(unit.brand)
                  const modelIsOther = !!unit.model && !typeNames.includes(unit.model)
                  const locationIsOther = !!unit.location && !locationNames.includes(unit.location)
                  return (
                    <div key={i} className="border border-border rounded-xl p-3 space-y-2 text-xs">
                      <p className="font-semibold text-muted-foreground">Unit {i + 1}</p>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Brand</span>
                        <select aria-label={`Unit ${i + 1} brand`} className="w-full border border-border rounded px-2 py-1 text-xs" value={brandIsOther ? '__other__' : unit.brand} onChange={e => updateAc(i, 'brand', e.target.value === '__other__' ? '' : e.target.value)}>
                          <option value="">—</option>
                          {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {brandIsOther && <Input className="h-8 text-xs" value={unit.brand} onChange={e => updateAc(i, 'brand', e.target.value)} placeholder="Specify brand…" />}
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Model</span>
                        <select aria-label={`Unit ${i + 1} model`} className="w-full border border-border rounded px-2 py-1 text-xs" value={modelIsOther ? '__other__' : unit.model} onChange={e => updateAc(i, 'model', e.target.value === '__other__' ? '' : e.target.value)}>
                          <option value="">—</option>
                          {unitTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {modelIsOther && <Input className="h-8 text-xs" value={unit.model} onChange={e => updateAc(i, 'model', e.target.value)} placeholder="Specify model…" />}
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Serial No</span>
                        <Input className="h-8 text-xs" value={unit.serial_no} onChange={e => updateAc(i, 'serial_no', e.target.value)} placeholder="S/N" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Location</span>
                        <select aria-label={`Unit ${i + 1} location`} className="w-full border border-border rounded px-2 py-1 text-xs" value={locationIsOther ? '__other__' : unit.location} onChange={e => updateAc(i, 'location', e.target.value === '__other__' ? '' : e.target.value)}>
                          <option value="">—</option>
                          {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {locationIsOther && <Input className="h-8 text-xs" value={unit.location} onChange={e => updateAc(i, 'location', e.target.value)} placeholder="Specify location…" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Checklist</Label>
                  <button
                    type="button"
                    onClick={toggleSelectAllChecklist}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {allChecklistChecked ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                {checklist.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
                    <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(i)} />
                    {item.item}
                  </label>
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="jc-job-description">Job Description</Label>
                    <button type="button" className="text-xs text-accent hover:underline cursor-pointer" onClick={regenerateJobText}>Regenerate</button>
                  </div>
                  <Textarea id="jc-job-description" rows={2} value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="jc-job-rendered">Job Rendered</Label>
                  <Textarea id="jc-job-rendered" rows={2} value={jobRendered} onChange={e => setJobRendered(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="jc-remarks">Remarks</Label>
                  <Textarea id="jc-remarks" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
              </div>
            </div>

            {step1Missing.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Still needed before you can price this job: {step1Missing.join(', ')}.
              </p>
            )}
            <Button
              onClick={() => setStep(2)}
              disabled={step1Missing.length > 0}
              className="w-full bg-accent hover:bg-accent/90 text-white"
            >
              Next: Pricing →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Base Price (SGD)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                placeholder="e.g. 200.00"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Additional Charges</Label>
                <Button variant="outline" size="sm" onClick={addCharge}>+ Add Charge</Button>
              </div>
              {charges.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input
                    className="flex-1"
                    placeholder="Description"
                    value={c.description}
                    onChange={e => updateCharge(i, 'description', e.target.value)}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={c.amount_sgd || ''}
                    onChange={e => updateCharge(i, 'amount_sgd', parseFloat(e.target.value) || 0)}
                  />
                  <Button variant="outline" size="sm" onClick={() => setCharges(prev => prev.filter((_, idx) => idx !== i))}>✕</Button>
                </div>
              ))}
            </div>

            <div className="bg-muted rounded-lg p-3 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">S${totalSgd().toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
              <Button
                className="flex-1 bg-accent hover:bg-accent/90 text-white"
                onClick={handleSaveCompletion}
                disabled={saving || !basePrice}
              >
                {saving ? 'Saving…' : 'Save & Preview PDF →'}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Preview the Work Order Report, then click &quot;Confirm &amp; Send&quot; to mark the job complete and email the customer.</p>
            <a
              href={`/api/bookings/${booking.id}/work-order-pdf?v=${previewCacheBust}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
            >
              Preview Work Order PDF ↗
            </a>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                ← Back to Pricing
              </Button>
              <Button
                className="flex-1 bg-accent hover:bg-accent/90 text-white"
                onClick={handleSendWorkOrder}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Confirm & Send to Customer'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
