'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import { useMapsLoaded } from '@/lib/hooks/useMapsLoaded'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, CheckCircle2, AlertCircle } from 'lucide-react'

interface ProfileData {
  name: string
  phone: string
  address: string | null
  address_lat: number | null
  address_lng: number | null
  postal_code: string | null
}

interface Props {
  profile: ProfileData
}

export default function AccountSettingsClient({ profile }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reasonAddress = searchParams.get('reason') === 'address'

  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [addressDisplay, setAddressDisplay] = useState(profile.address ?? '')
  const [addressData, setAddressData] = useState<{
    address: string; postal_code: string; lat: number; lng: number
  } | null>(
    profile.address && profile.address_lat
      ? { address: profile.address, postal_code: profile.postal_code ?? '', lat: profile.address_lat, lng: profile.address_lng! }
      : null
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const addressInputRef = useRef<HTMLInputElement>(null)

  const isLoaded = useMapsLoaded()

  useEffect(() => {
    if (!isLoaded || !addressInputRef.current) return
    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      componentRestrictions: { country: 'sg' },
      fields: ['formatted_address', 'geometry', 'address_components'],
    })
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry?.location) return
      const postalComp = place.address_components?.find(c => c.types.includes('postal_code'))
      const resolved = {
        address: place.formatted_address ?? '',
        postal_code: postalComp?.short_name ?? '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      }
      setAddressData(resolved)
      setAddressDisplay(resolved.address)
    })
    return () => { window.google.maps.event.removeListener(listener) }
  }, [isLoaded])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          address: addressData?.address ?? null,
          address_lat: addressData?.lat ?? null,
          address_lng: addressData?.lng ?? null,
          postal_code: addressData?.postal_code ?? null,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Failed to save')
        return
      }
      setSaved(true)
      if (reasonAddress && addressData) {
        setTimeout(() => router.push('/book'), 1200)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="lazyOnload"
      />
      <h1 className="font-heading font-bold text-2xl text-primary mb-1">Account Settings</h1>
      <p className="text-muted-foreground text-sm mb-6">Update your profile details</p>

      {reasonAddress && !addressData && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Please add your home address before booking. We use it to pre-fill your service location.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-primary">Full Name</Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-primary">Phone Number</Label>
          <Input
            id="phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address" className="text-sm font-medium text-primary">
            Home Address
            <span className="ml-1 text-muted-foreground font-normal text-xs">(used for quick booking)</span>
          </Label>
          <div className="relative">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="address"
              ref={addressInputRef}
              value={addressDisplay}
              onChange={e => {
                setAddressDisplay(e.target.value)
                if (addressData) setAddressData(null)
              }}
              placeholder={isLoaded ? 'Start typing your address…' : 'Loading…'}
              disabled={!isLoaded}
              autoComplete="off"
              className="h-11 pl-9"
            />
          </div>
          {addressData ? (
            <p className="text-xs text-green-700">✓ Address confirmed: {addressData.postal_code}</p>
          ) : addressDisplay ? (
            <p className="text-xs text-slate-400">Select an address from the dropdown suggestions.</p>
          ) : null}
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {saved && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 size={15} />
            Profile saved successfully.
          </div>
        )}

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </div>
  )
}
