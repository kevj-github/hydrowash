'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface ProfileData {
  name: string
  phone: string
  address: string | null
  address_lat: number | null
  address_lng: number | null
  postal_code: string | null
  unit_floor: string | null
  building_name: string | null
}

interface Props {
  profile: ProfileData
}

export default function AccountSettingsClient({ profile }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reasonAddress = searchParams.get('reason') === 'address'
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwSaving(true)
    setPwError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwError(error.message)
      setPwSaving(false)
      return
    }
    // Sign out so the new session token takes effect cleanly, then redirect to login
    await supabase.auth.signOut()
    router.push('/auth/login?pw=updated')
  }

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
  const [unitFloor, setUnitFloor] = useState(profile.unit_floor ?? '')
  const [buildingName, setBuildingName] = useState(profile.building_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')


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
          unit_floor: unitFloor || null,
          building_name: buildingName || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Failed to save')
        return
      }
      setSaved(true)
      if (reasonAddress && addressData) {
        // Hard navigation: the App Router client cache still holds the /book
        // prefetch that 307'd back here while the profile had no address, so
        // router.push would replay that stale redirect.
        setTimeout(() => { window.location.href = '/book' }, 1200)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const opt = <span className="ml-1 text-muted-foreground font-normal text-xs">(optional)</span>

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
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
          <Input id="name" value={name} onChange={e => setName(e.target.value)} required className="h-11" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-primary">Phone Number</Label>
          <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} required className="h-11" />
        </div>

        <div className="space-y-1.5">
          <div className="space-y-0.5">
            <Label htmlFor="address" className="text-sm font-medium text-primary">
              Home Address <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">Required before you can book a service</p>
          </div>
          <AddressAutocomplete
            id="address"
            placeholder="Start typing your address…"
            defaultValue={profile.address ?? ''}
            onResolved={resolved => {
              setAddressData(resolved)
              if (resolved) setAddressDisplay(resolved.address)
            }}
          />
          {addressData ? (
            <p className="text-xs text-green-700">
              ✓ Address confirmed{addressData.postal_code ? `: Singapore ${addressData.postal_code}` : ''}
            </p>
          ) : addressDisplay ? (
            <p className="text-xs text-slate-400">Select an address from the dropdown suggestions.</p>
          ) : null}
        </div>

        {addressData && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="unit_floor" className="text-sm font-medium text-primary">
                Unit / Floor {opt}
              </Label>
              <Input
                id="unit_floor"
                value={unitFloor}
                onChange={e => setUnitFloor(e.target.value)}
                placeholder="e.g. #04-05"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="building_name" className="text-sm font-medium text-primary">
                Building Name {opt}
              </Label>
              <Input
                id="building_name"
                value={buildingName}
                onChange={e => setBuildingName(e.target.value)}
                placeholder="e.g. Watergate Condominium"
                className="h-11"
              />
            </div>
          </>
        )}

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
      <h2 className="font-heading font-semibold text-lg text-primary mt-10 mb-1">Change Password</h2>
      <p className="text-muted-foreground text-sm mb-4">Update your account password</p>

      <form onSubmit={handleChangePassword} className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="new_password" className="text-sm font-medium text-primary">New Password</Label>
          <PasswordInput
            id="new_password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm_password" className="text-sm font-medium text-primary">Confirm Password</Label>
          <PasswordInput
            id="confirm_password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            required
            className="h-11"
          />
        </div>
        {pwError && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {pwError}
          </p>
        )}
        <Button
          type="submit"
          disabled={pwSaving}
          className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg"
        >
          {pwSaving ? 'Updating…' : 'Update Password'}
        </Button>
      </form>
    </div>
  )
}
