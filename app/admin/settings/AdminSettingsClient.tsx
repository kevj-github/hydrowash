'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { AppSettings, ServiceType, AcBrand, AcUnitType, AcUnitLocation } from '@/lib/types'

type CatalogItem = { id: string; label: string; display_order: number; is_active: boolean }

const TABLE_KIND: Record<'ac_brands' | 'ac_unit_types' | 'ac_unit_locations', string> = {
  ac_brands: 'brands',
  ac_unit_types: 'unit_types',
  ac_unit_locations: 'locations',
}

function CatalogSection({
  title,
  tableName,
  initialItems,
}: {
  title: string
  tableName: 'ac_brands' | 'ac_unit_types' | 'ac_unit_locations'
  initialItems: CatalogItem[]
}) {
  const kind = TABLE_KIND[tableName]
  const [items, setItems] = useState(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  function flash(m: string, isErr = false) {
    if (isErr) { setErr(m); setMsg('') } else { setMsg(m); setErr('') }
    setTimeout(() => { setMsg(''); setErr('') }, 4000)
  }

  async function addItem() {
    if (!newLabel.trim()) return
    const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.display_order)) + 1 : 1
    const res = await fetch(`/api/admin/ac-catalog?kind=${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), display_order: nextOrder }),
    })
    const json = await res.json()
    if (!res.ok) { flash('Error: ' + json.error, true); return }
    setItems(prev => [...prev, json as CatalogItem])
    setNewLabel('')
    setShowForm(false)
    flash('Added.')
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) return
    const res = await fetch(`/api/admin/ac-catalog?kind=${kind}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label: editLabel.trim() }),
    })
    const json = await res.json()
    if (!res.ok) { flash('Error: ' + json.error, true); return }
    setItems(prev => prev.map(i => i.id === id ? { ...i, label: editLabel.trim() } : i))
    setEditingId(null)
    flash('Saved.')
  }

  async function toggleActive(item: CatalogItem) {
    const res = await fetch(`/api/admin/ac-catalog?kind=${kind}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      flash('Error: ' + (json.error ?? 'could not update'), true)
      return
    }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  async function deleteItem(id: string) {
    const res = await fetch(`/api/admin/ac-catalog?kind=${kind}&id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      setConfirmDeleteId(null)
      flash(json.code === '23503' ? 'Cannot delete: referenced by existing data. Deactivate instead.' : 'Error: ' + json.error, true)
      return
    }
    setItems(prev => prev.filter(i => i.id !== id))
    setConfirmDeleteId(null)
    flash('Deleted.')
  }

  return (
    <section className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-primary">{title} ({items.length})</h2>
        <Button size="sm" onClick={() => { setShowForm(v => !v); setNewLabel('') }} className="bg-accent hover:bg-accent/90 text-white text-xs">
          {showForm ? 'Cancel' : '+ Add'}
        </Button>
      </div>
      {msg && <p className="text-sm text-green-700 mb-3">{msg}</p>}
      {err && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-3">{err}</p>}

      {showForm && (
        <div className="mb-4 flex gap-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Name…"
            className="h-8 text-sm"
            onKeyDown={e => e.key === 'Enter' && addItem()}
            autoFocus
          />
          <Button onClick={addItem} disabled={!newLabel.trim()} className="bg-accent hover:bg-accent/90 text-white text-sm h-8 shrink-0">Add</Button>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="border border-border rounded-lg overflow-hidden">
            {editingId === item.id ? (
              <div className="flex gap-2 p-2">
                <Input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  className="h-8 text-sm flex-1"
                  onKeyDown={e => e.key === 'Enter' && saveEdit(item.id)}
                  autoFocus
                />
                <Button onClick={() => saveEdit(item.id)} className="bg-accent hover:bg-accent/90 text-white text-xs h-8">Save</Button>
                <Button variant="outline" onClick={() => setEditingId(null)} className="text-xs h-8">Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2">
                <span className={`text-sm font-medium ${item.is_active ? 'text-primary' : 'text-muted-foreground line-through'}`}>
                  {item.label}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => { setEditingId(item.id); setEditLabel(item.label) }} className="text-xs h-7">Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(item)} className="text-xs h-7">
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  {confirmDeleteId === item.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => deleteItem(item.id)} className="text-xs h-7">Confirm</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)} className="text-xs h-7">Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(item.id)} className="text-xs h-7 text-red-600 hover:text-red-700 hover:border-red-300">Delete</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items yet.</p>}
      </div>
    </section>
  )
}

interface Props {
  initialSettings: AppSettings | null
  initialServiceTypes: ServiceType[]
  initialBrands: AcBrand[]
  initialUnitTypes: AcUnitType[]
  initialLocations: AcUnitLocation[]
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

export function AdminSettingsClient({ initialSettings, initialServiceTypes, initialBrands, initialUnitTypes, initialLocations }: Props) {
  const [settings, setSettings] = useState(initialSettings ?? {
    depot_address: '', depot_lat: 0, depot_lng: 0, company_name: 'HydroWash', contact_email: '',
    company_address: '404B Fernvale Lane, S792404', company_phone: '(+65) 8811 1105',
    company_email: 'hydrowash20@gmail.com', company_instagram: '@Hydrowash.sg',
    authorised_officer_name: 'Gilbert Chen', paynow_mobile: '',
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
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, depot_lat: lat, depot_lng: lng }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setMsg('Error: ' + (json.error ?? 'could not save settings'))
      setSaving(false)
      setTimeout(() => setMsg(''), 5000)
      return
    }
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
    const res = await fetch('/api/admin/service-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    const json = await res.json()
    if (!res.ok) { flashStError('Error: ' + json.error); return }
    setServiceTypes(prev => [...prev, json])
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
    const res = await fetch('/api/admin/service-types', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    })
    const json = await res.json()
    if (!res.ok) { flashStError('Error: ' + json.error); return }
    setServiceTypes(prev => prev.map(s => s.id === id ? json : s))
    setEditingId(null)
    flashStMsg('Saved.')
  }

  async function toggleServiceType(st: ServiceType) {
    const res = await fetch('/api/admin/service-types', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: st.id, active: !st.active }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      flashStError('Error: ' + (json.error ?? 'could not update'))
      return
    }
    setServiceTypes(prev => prev.map(s => s.id === st.id ? { ...s, active: !s.active } : s))
  }

  async function deleteServiceType(id: string) {
    const res = await fetch(`/api/admin/service-types?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      setConfirmDeleteId(null)
      if (json.code === '23503') {
        flashStError('Cannot delete: existing bookings use this service type. Deactivate it instead.')
      } else {
        flashStError('Error: ' + json.error)
      }
      return
    }
    setServiceTypes(prev => prev.filter(s => s.id !== id))
    setConfirmDeleteId(null)
    flashStMsg('Service type deleted.')
  }

  return (
    <div className="max-w-3xl space-y-8 pb-8">
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
            <Label>Company Address (shown on PDF documents)</Label>
            <Input value={settings.company_address ?? ''} onChange={e => setSettings(s => ({ ...s, company_address: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Company Phone (shown on PDF documents)</Label>
            <Input value={settings.company_phone ?? ''} onChange={e => setSettings(s => ({ ...s, company_phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Company Email (shown on PDF documents)</Label>
            <Input value={settings.company_email ?? ''} onChange={e => setSettings(s => ({ ...s, company_email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Instagram Handle (shown on PDF documents)</Label>
            <Input value={settings.company_instagram ?? ''} onChange={e => setSettings(s => ({ ...s, company_instagram: e.target.value }))} placeholder="@Hydrowash.sg" />
          </div>
          <div className="space-y-1.5">
            <Label>Authorised Officer Name (PDF signature)</Label>
            <Input value={settings.authorised_officer_name ?? ''} onChange={e => setSettings(s => ({ ...s, authorised_officer_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>PayNow Mobile Number (for QR code on invoices &amp; contracts)</Label>
            <Input value={settings.paynow_mobile ?? ''} onChange={e => setSettings(s => ({ ...s, paynow_mobile: e.target.value }))} placeholder="+6591234567" />
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

      <CatalogSection title="AC Brands" tableName="ac_brands" initialItems={initialBrands} />
      <CatalogSection title="AC Unit Types (Model)" tableName="ac_unit_types" initialItems={initialUnitTypes} />
      <CatalogSection title="Unit Locations" tableName="ac_unit_locations" initialItems={initialLocations} />
    </div>
  )
}
