'use client'
import { useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { UnitLocationPicker } from './UnitLocationPicker'
import type { ServiceType } from '@/lib/types'

const MAX_FILES = 5
const MAX_MB = 20
const ACCEPTED = 'image/*,video/*'

interface Props {
  serviceTypes: ServiceType[]
  data: {
    service_type_id: string
    category: string
    num_units?: number
    unit_location_ids?: string[]
    fault_description?: string
    urgency?: string
    ac_brand?: string
    ac_model?: string
    notes?: string
    media_urls?: string[]
  }
  onChange: (updates: Partial<Props['data']>) => void
}

const urgencyOptions = [
  { value: 'HIGH', label: 'High — not working at all' },
  { value: 'MEDIUM', label: 'Medium — partially working' },
  { value: 'LOW', label: 'Low — minor issue' },
]

export function StepServiceDetails({ serviceTypes, data, onChange }: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const maintenance = serviceTypes.filter(s => s.category === 'MAINTENANCE')
  const faultRepair = serviceTypes.filter(s => s.category === 'FAULT_REPAIR')
  const installation = serviceTypes.filter(s => s.category === 'INSTALLATION')

  const allGrouped = [
    ...(maintenance.length ? [{ label: 'Maintenance', items: maintenance }] : []),
    ...(faultRepair.length ? [{ label: 'Fault Repair', items: faultRepair }] : []),
    ...(installation.length ? [{ label: 'Installation', items: installation }] : []),
  ]

  const selected = serviceTypes.find(s => s.id === data.service_type_id)
  const existingUrls = data.media_urls ?? []

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_FILES - existingUrls.length
    if (remaining <= 0) {
      setUploadError(`Maximum ${MAX_FILES} files allowed.`)
      return
    }
    const toUpload = files.slice(0, remaining)
    const oversized = toUpload.filter(f => f.size > MAX_MB * 1024 * 1024)
    if (oversized.length) {
      setUploadError(`Files must be under ${MAX_MB} MB each.`)
      return
    }

    setUploading(true)
    setUploadError('')

    const { data: { user } } = await supabase.auth.getUser()
    const prefix = `${user?.id ?? 'anon'}/${Date.now()}`

    const uploaded: string[] = []
    for (const file of toUpload) {
      const path = `${prefix}/${file.name}`
      const { error } = await supabase.storage.from('booking-media').upload(path, file, { upsert: true })
      if (error) { setUploadError(`Upload failed: ${error.message}`); break }
      const { data: urlData } = supabase.storage.from('booking-media').getPublicUrl(path)
      uploaded.push(urlData.publicUrl)
    }

    onChange({ media_urls: [...existingUrls, ...uploaded] })
    setUploading(false)
    // Reset file input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(url: string) {
    onChange({ media_urls: existingUrls.filter(u => u !== url) })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Service Type <span className="text-red-500">*</span></Label>
        <Select
          value={data.service_type_id}
          onValueChange={id => {
            const s = serviceTypes.find(t => t.id === (id ?? ''))
            onChange({ service_type_id: id ?? '', category: s?.category ?? '' })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a service…">
              {selected
                ? `${selected.name}${selected.price_sgd ? ` — S$${Number(selected.price_sgd).toFixed(2)}` : ''}`
                : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allGrouped.map(group => (
              <div key={group.label}>
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {group.label}
                </div>
                {group.items.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.price_sgd ? ` — S$${Number(s.price_sgd).toFixed(2)}` : ''}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected?.category === 'MAINTENANCE' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Number of Units <span className="text-red-500">*</span></Label>
            <Input
              type="number" min={1} max={20}
              value={data.num_units ?? ''}
              onChange={e => onChange({ num_units: Number(e.target.value) })}
              placeholder="e.g. 3"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Locations</Label>
            <p className="text-xs text-muted-foreground">Select which rooms have AC units to be serviced.</p>
            <UnitLocationPicker
              value={data.unit_location_ids ?? []}
              onChange={ids => onChange({ unit_location_ids: ids })}
            />
          </div>
        </div>
      )}

      {selected?.category === 'FAULT_REPAIR' && (
        <>
          <div className="space-y-1.5">
            <Label>Describe the Fault <span className="text-red-500">*</span></Label>
            <Textarea
              value={data.fault_description ?? ''}
              onChange={e => onChange({ fault_description: e.target.value })}
              placeholder="e.g. unit not cooling, unusual noise from indoor unit…"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Urgency</Label>
            <Select value={data.urgency ?? ''} onValueChange={v => onChange({ urgency: v ?? '' })}>
              <SelectTrigger><SelectValue placeholder="Select urgency…" /></SelectTrigger>
              <SelectContent>
                {urgencyOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {selected?.category === 'INSTALLATION' && (
        <>
          <div className="space-y-1.5">
            <Label>AC Brand</Label>
            <Input
              value={data.ac_brand ?? ''}
              onChange={e => onChange({ ac_brand: e.target.value })}
              placeholder="e.g. Daikin, Mitsubishi, Panasonic…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>AC Model</Label>
            <Input
              value={data.ac_model ?? ''}
              onChange={e => onChange({ ac_model: e.target.value })}
              placeholder="e.g. FTKF35D"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Number of Units <span className="text-red-500">*</span></Label>
            <Input
              type="number" min={1} max={10}
              value={data.num_units ?? ''}
              onChange={e => onChange({ num_units: Number(e.target.value) })}
              placeholder="e.g. 1"
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label>Additional Notes</Label>
        <Textarea
          value={data.notes ?? ''}
          onChange={e => onChange({ notes: e.target.value })}
          placeholder="Any additional information for our team…"
          rows={2}
        />
      </div>

      {/* Media upload */}
      <div className="space-y-2">
        <Label>
          Photos / Videos
          <span className="ml-1.5 text-xs text-slate-400 font-normal">
            (up to {MAX_FILES} files, {MAX_MB} MB each)
          </span>
        </Label>

        {existingUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {existingUrls.map(url => {
              const isVideo = url.match(/\.(mp4|mov|avi|webm)(\?|$)/i)
              const filename = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'file')
              return (
                <div key={url} className="relative group rounded-lg border border-[#E2E8F0] overflow-hidden bg-slate-50 w-20 h-20 flex items-center justify-center">
                  {isVideo ? (
                    <span className="text-2xl">🎥</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={filename} className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(url)}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {existingUrls.length < MAX_FILES && (
          <>
            <label
              className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg px-4 py-3 text-sm cursor-pointer transition-colors
                ${uploading ? 'border-slate-200 text-slate-300' : 'border-[#E2E8F0] text-slate-500 hover:border-[#0369A1] hover:text-[#0369A1]'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                onChange={handleFileChange}
                disabled={uploading}
                className="sr-only"
              />
              {uploading ? 'Uploading…' : `Click to add photos or videos (${existingUrls.length}/${MAX_FILES})`}
            </label>
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          </>
        )}
      </div>
    </div>
  )
}
