'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { AppSettings, ServiceType } from '@/lib/types'

interface Props {
  initialSettings: AppSettings | null
  initialServiceTypes: ServiceType[]
}

const CATEGORIES = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'FAULT_REPAIR', label: 'Fault Repair' },
  { value: 'INSTALLATION', label: 'Installation' },
]

const categoryColor: Record<string, string> = {
  MAINTENANCE: 'bg-blue-100 text-blue-700',
  FAULT_REPAIR: 'bg-amber-100 text-amber-700',
  INSTALLATION: 'bg-green-100 text-green-700',
}

interface ServiceTypeForm {
  name: string
  category: string
  description: string
  duration_minutes: string
  price_sgd: string
}

const emptyForm: ServiceTypeForm = { name: '', category: 'MAINTENANCE', description: '', duration_minutes: '', price_sgd: '' }

export function AdminSettingsClient({ initialSettings, initialServiceTypes }: Props) {
  const supabase = createClient()
  const [settings, setSettings] = useState(initialSettings ?? {
    depot_address: '', depot_lat: 0, depot_lng: 0, company_name: 'HydroWash', contact_email: '',
  })
  const [serviceTypes, setServiceTypes] = useState(initialServiceTypes)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Service type form state
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState<ServiceTypeForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ServiceTypeForm>(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [stMsg, setStMsg] = useState('')
  const [stError, setStError] = useState('')

  async function saveSettings() {
    setSaving(true)
    const geoRes = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: settings.depot_address + ', Singapore' }),
    })
    let lat = settings.depot_lat, lng = settings.depot_lng
    if (geoRes.ok) {
      const geo = await geoRes.json()
      lat = geo.lat; lng = geo.lng
    }
    await supabase.from('app_settings').update({ ...settings, depot_lat: lat, depot_lng: lng }).eq('id', 1)
    setSettings(s => ({ ...s, depot_lat: lat, depot_lng: lng }))
    setMsg('Settings saved.')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  function flashStMsg(m: string) {
    setStError('')
    setStMsg(m)
    setTimeout(() => setStMsg(''), 4000)
  }

  function flashStError(m: string) {
    setStMsg('')
    setStError(m)
    setTimeout(() => setStError(''), 6000)
  }

  async function createServiceType() {
    if (!newForm.name.trim() || !newForm.category) return
    const { data, error } = await supabase.from('service_types').insert({
      name: newForm.name.trim(),
      category: newForm.category,
      description: newForm.description.trim(),
      duration_minutes: newForm.duration_minutes ? Number(newForm.duration_minutes) : null,
      price_sgd: newForm.price_sgd ? Number(newForm.price_sgd) : null,
      active: true,
    }).select().single()
    if (error) { flashStError('Error: ' + error.message); return }
    setServiceTypes(prev => [...prev, data])
    setNewForm(emptyForm)
    setShowNewForm(false)
    flashStMsg('Service type created.')
  }

  function startEdit(st: ServiceType) {
    setEditingId(st.id)
    setEditForm({
      name: st.name,
      category: st.category,
      description: st.description ?? '',
      duration_minutes: st.duration_minutes?.toString() ?? '',
      price_sgd: st.price_sgd?.toString() ?? '',
    })
  }

  async function saveEdit(id: string) {
    const { data, error } = await supabase.from('service_types').update({
      name: editForm.name.trim(),
      category: editForm.category,
      description: editForm.description.trim(),
      duration_minutes: editForm.duration_minutes ? Number(editForm.duration_minutes) : null,
      price_sgd: editForm.price_sgd ? Number(editForm.price_sgd) : null,
    }).eq('id', id).select().single()
    if (error) { flashStError('Error: ' + error.message); return }
    setServiceTypes(prev => prev.map(s => s.id === id ? data : s))
    setEditingId(null)
    flashStMsg('Saved.')
  }

  async function toggleServiceType(st: ServiceType) {
    await supabase.from('service_types').update({ active: !st.active }).eq('id', st.id)
    setServiceTypes(prev => prev.map(s => s.id === st.id ? { ...s, active: !s.active } : s))
  }

  async function deleteServiceType(id: string) {
    const { error } = await supabase.from('service_types').delete().eq('id', id)
    if (error) {
      setConfirmDeleteId(null)
      if (error.code === '23503') {
        flashStError('Cannot delete: existing bookings use this service type. Deactivate it instead.')
      } else {
        flashStError('Error: ' + error.message)
      }
      return
    }
    setServiceTypes(prev => prev.filter(s => s.id !== id))
    setConfirmDeleteId(null)
    flashStMsg('Service type deleted.')
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-heading font-bold text-2xl text-primary">Settings</h1>

      {/* Depot */}
      <section className="bg-white rounded-xl border border-border p-6">
        <h2 className="font-heading font-semibold text-primary mb-4">Company & Depot</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input value={settings.company_name} onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Email</Label>
            <Input type="email" value={settings.contact_email} onChange={e => setSettings(s => ({ ...s, contact_email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Depot Address (used as VRP start point)</Label>
            <Input
              value={settings.depot_address}
              onChange={e => setSettings(s => ({ ...s, depot_address: e.target.value }))}
              placeholder="e.g. 123 Woodlands Ave 1, Singapore 730123"
            />
            {settings.depot_lat !== 0 && (
              <p className="text-xs text-green-700">Geocoded: {settings.depot_lat.toFixed(5)}, {settings.depot_lng.toFixed(5)}</p>
            )}
          </div>
          <Button onClick={saveSettings} disabled={saving} className="bg-accent hover:bg-accent/90 text-white">
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
          {msg && <p className="text-sm text-green-700">{msg}</p>}
        </div>
      </section>

      {/* Service Types — full CRUD */}
      <section className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-primary">Service Types ({serviceTypes.length})</h2>
          <Button
            size="sm"
            onClick={() => { setShowNewForm(v => !v); setNewForm(emptyForm) }}
            className="bg-accent hover:bg-accent/90 text-white text-xs"
          >
            {showNewForm ? 'Cancel' : '+ New Service Type'}
          </Button>
        </div>

        {stMsg && <p className="text-sm text-green-700 mb-3">{stMsg}</p>}
        {stError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-3">{stError}</p>}

        {/* New service type form */}
        {showNewForm && (
          <div className="mb-5 p-4 border border-border rounded-lg bg-muted/40 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Service Type</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chemical Wash" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <Select value={newForm.category} onValueChange={v => setNewForm(f => ({ ...f, category: v ?? 'MAINTENANCE' }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue>{CATEGORIES.find(c => c.value === newForm.category)?.label ?? newForm.category}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Price (SGD)</Label>
                <Input type="number" min={0} step={0.01} value={newForm.price_sgd} onChange={e => setNewForm(f => ({ ...f, price_sgd: e.target.value }))} placeholder="e.g. 80" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duration (min)</Label>
                <Input type="number" min={0} value={newForm.duration_minutes} onChange={e => setNewForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="e.g. 60" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description shown to customers" rows={2} className="text-sm" />
            </div>
            <Button onClick={createServiceType} disabled={!newForm.name.trim()} className="bg-accent hover:bg-accent/90 text-white text-sm">
              Create Service Type
            </Button>
          </div>
        )}

        {/* Existing service types */}
        <div className="space-y-2">
          {serviceTypes.map(st => (
            <div key={st.id} className="border border-border rounded-lg overflow-hidden">
              {editingId === st.id ? (
                <div className="p-4 bg-muted/40 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name *</Label>
                      <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Category *</Label>
                      <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v ?? f.category }))}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue>{CATEGORIES.find(c => c.value === editForm.category)?.label ?? editForm.category}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Price (SGD)</Label>
                      <Input type="number" min={0} step={0.01} value={editForm.price_sgd} onChange={e => setEditForm(f => ({ ...f, price_sgd: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Duration (min)</Label>
                      <Input type="number" min={0} value={editForm.duration_minutes} onChange={e => setEditForm(f => ({ ...f, duration_minutes: e.target.value }))} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} className="text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveEdit(st.id)} disabled={!editForm.name.trim()} className="bg-accent hover:bg-accent/90 text-white text-sm">Save</Button>
                    <Button variant="outline" onClick={() => setEditingId(null)} className="text-sm">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${categoryColor[st.category] ?? ''}`}>
                      {CATEGORIES.find(c => c.value === st.category)?.label ?? st.category}
                    </span>
                    <span className={`text-sm font-medium truncate ${st.active ? 'text-primary' : 'text-muted-foreground line-through'}`}>
                      {st.name}
                    </span>
                    {st.price_sgd && (
                      <span className="text-xs text-accent shrink-0">S${Number(st.price_sgd).toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => startEdit(st)} className="text-xs">Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleServiceType(st)} className="text-xs">
                      {st.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    {confirmDeleteId === st.id ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => deleteServiceType(st.id)} className="text-xs">Confirm</Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)} className="text-xs">Cancel</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(st.id)} className="text-xs text-red-600 hover:text-red-700 hover:border-red-300">Delete</Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
