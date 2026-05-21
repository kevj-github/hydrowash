'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { BookingWithRelations, AcUnitDetail, ChecklistItem, AdditionalCharge } from '@/lib/types'

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
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [unitTypes, setUnitTypes] = useState<{ id: string; name: string }[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  // Step 1 fields
  const [attendedBy, setAttendedBy] = useState('')
  const [timeArrived, setTimeArrived] = useState('')
  const [timeCompleted, setTimeCompleted] = useState('')
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

  useEffect(() => {
    supabase.from('ac_brands').select('id, name').then(({ data }) => { if (data) setBrands(data) })
    supabase.from('ac_unit_types').select('id, name').then(({ data }) => { if (data) setUnitTypes(data) })
    supabase.from('ac_unit_locations').select('id, name').then(({ data }) => { if (data) setLocations(data) })
  }, [])

  function totalSgd() {
    const base = parseFloat(basePrice) || 0
    return base + charges.reduce((s, c) => s + (c.amount_sgd || 0), 0)
  }

  async function handleSaveCompletion() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/bookings/${booking.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    })
    setSaving(false)
    if (res.ok) {
      setStep(3)
    } else {
      const body = await res.json()
      setError(body.error ?? 'Failed to save completion')
    }
  }

  async function handleSendWorkOrder() {
    setSending(true)
    setError('')
    const res = await fetch(`/api/bookings/${booking.id}/send-work-order`, { method: 'POST' })
    setSending(false)
    if (res.ok) {
      setOpen(false)
      onSuccess()
    } else {
      const body = await res.json()
      setError(body.error ?? 'Failed to send work order')
    }
  }

  function updateAc(i: number, field: keyof AcUnitDetail, value: string) {
    setAcDetails(prev => prev.map((u, idx) => idx === i ? { ...u, [field]: value } : u))
  }

  function toggleChecklist(i: number) {
    setChecklist(prev => prev.map((c, idx) => idx === i ? { ...c, checked: !c.checked } : c))
  }

  function addCharge() {
    setCharges(prev => [...prev, { description: '', amount_sgd: 0 }])
  }

  function updateCharge(i: number, field: keyof AdditionalCharge, value: string | number) {
    setCharges(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setStep(1); setError('') } }}>
      <DialogTrigger className={cn(buttonVariants({ size: 'sm' }), 'bg-accent hover:bg-accent/90 text-white')}>
        Complete Job
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <Label>Attended By</Label>
                <Input value={attendedBy} onChange={e => setAttendedBy(e.target.value)} placeholder="e.g. Gilbert" />
              </div>
              <div className="space-y-1">
                <Label>Time Arrived</Label>
                <Input value={timeArrived} onChange={e => setTimeArrived(e.target.value)} placeholder="14:00" />
              </div>
              <div className="space-y-1">
                <Label>Time Completed</Label>
                <Input value={timeCompleted} onChange={e => setTimeCompleted(e.target.value)} placeholder="16:00" />
              </div>
            </div>

            {/* AC Details */}
            <div>
              <Label className="mb-2 block">A/C System Details</Label>
              <div className="border border-border rounded overflow-hidden text-xs">
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

                      {/* Brand */}
                      <div className="space-y-1">
                        <select
                          className="w-full border border-border rounded px-1 py-0.5 text-xs"
                          value={brandIsOther ? '__other__' : unit.brand}
                          onChange={e => updateAc(i, 'brand', e.target.value === '__other__' ? '' : e.target.value)}
                        >
                          <option value="">—</option>
                          {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {brandIsOther && (
                          <Input className="h-6 text-xs px-1" value={unit.brand} onChange={e => updateAc(i, 'brand', e.target.value)} placeholder="Specify brand…" autoFocus />
                        )}
                      </div>

                      {/* Model (unit type) */}
                      <div className="space-y-1">
                        <select
                          className="w-full border border-border rounded px-1 py-0.5 text-xs"
                          value={modelIsOther ? '__other__' : unit.model}
                          onChange={e => updateAc(i, 'model', e.target.value === '__other__' ? '' : e.target.value)}
                        >
                          <option value="">—</option>
                          {unitTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {modelIsOther && (
                          <Input className="h-6 text-xs px-1" value={unit.model} onChange={e => updateAc(i, 'model', e.target.value)} placeholder="Specify model…" autoFocus />
                        )}
                      </div>

                      {/* Serial No — plain text */}
                      <Input className="h-6 text-xs px-1" value={unit.serial_no} onChange={e => updateAc(i, 'serial_no', e.target.value)} placeholder="S/N" />

                      {/* Location */}
                      <div className="space-y-1">
                        <select
                          className="w-full border border-border rounded px-1 py-0.5 text-xs"
                          value={locationIsOther ? '__other__' : unit.location}
                          onChange={e => updateAc(i, 'location', e.target.value === '__other__' ? '' : e.target.value)}
                        >
                          <option value="">—</option>
                          {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                          <option value="__other__">Others</option>
                        </select>
                        {locationIsOther && (
                          <Input className="h-6 text-xs px-1" value={unit.location} onChange={e => updateAc(i, 'location', e.target.value)} placeholder="Specify location…" autoFocus />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Checklist</Label>
                {checklist.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
                    <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(i)} />
                    {item.item}
                  </label>
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Job Description</Label>
                  <Textarea rows={2} value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Job Rendered</Label>
                  <Textarea rows={2} value={jobRendered} onChange={e => setJobRendered(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Remarks</Label>
                  <Textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full bg-accent hover:bg-accent/90 text-white">
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
            <p className="text-sm text-muted-foreground">Job marked complete. Preview the Work Order Report before sending to the customer.</p>
            <a
              href={`/api/bookings/${booking.id}/work-order-pdf`}
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
