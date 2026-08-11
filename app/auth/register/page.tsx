'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import Image from 'next/image'
import { useMapsLoaded } from '@/lib/hooks/useMapsLoaded'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, CircleCheck } from 'lucide-react'
import Link from 'next/link'

const fields = [
  { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Tan' },
  { key: 'phone', label: 'Phone Number', type: 'text', placeholder: '+65 9123 4567' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
  { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
] as const

type FormKey = typeof fields[number]['key']

interface AddressData {
  address: string
  postal_code: string
  lat: number
  lng: number
}

export default function RegisterPage() {
  const [form, setForm] = useState<Record<FormKey, string>>({ name: '', phone: '', email: '', password: '' })
  const [addressData, setAddressData] = useState<AddressData | null>(null)
  const [unitFloor, setUnitFloor] = useState('')
  const [buildingName, setBuildingName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState('')
  const router = useRouter()
  const supabase = createClient()
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
      setAddressData({
        address: place.formatted_address ?? '',
        postal_code: postalComp?.short_name ?? '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
    return () => { window.google.maps.event.removeListener(listener) }
  }, [isLoaded])

  function set(field: FormKey) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name, phone: form.phone },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Sign up failed')
      setLoading(false)
      return
    }

    if ((data.user.identities ?? []).length === 0) {
      setError('An account with this email already exists. Please sign in instead.')
      setLoading(false)
      return
    }

    if (!data.session) {
      setVerifyEmail(form.email)
    } else {
      if (addressData) {
        await supabase.from('profiles').update({
          address: addressData.address,
          address_lat: addressData.lat,
          address_lng: addressData.lng,
          postal_code: addressData.postal_code,
          unit_floor: unitFloor || null,
          building_name: buildingName || null,
        }).eq('id', data.user.id)
      }
      router.push('/')
    }
    setLoading(false)
  }

  const leftPanel = (
    <div className="hidden md:flex md:w-2/5 flex-col items-center justify-center px-10 py-16 relative overflow-hidden hw-board-ground">
      <Image
        src="https://images.pexels.com/photos/6471913/pexels-photo-6471913.jpeg?auto=compress&cs=tinysrgb&w=1200"
        alt="HydroWash aircon technician"
        fill
        className="object-cover opacity-25"
        priority
      />
      <div className="absolute inset-0 bg-primary/70" />
      <div className="relative text-center">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span className="h-3 w-3 rounded-full bg-accent" aria-hidden />
          <h1 className="font-heading font-extrabold text-3xl text-primary-foreground uppercase tracking-tight">HydroWash</h1>
        </div>
        <p className="text-primary-foreground/70 text-base leading-relaxed max-w-xs font-body">
          Book aircon services online — just pick a date and we&apos;ll handle the rest.
        </p>
      </div>
    </div>
  )

  if (verifyEmail) {
    return (
      <div className="hw-world min-h-screen flex">
        {leftPanel}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
          <div className="w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <CircleCheck size={22} className="text-accent" />
            </div>
            <h2 className="font-heading font-bold text-3xl uppercase tracking-tight text-primary mb-3">Check your email</h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed font-body">
              We sent a verification link to{' '}
              <span className="font-semibold text-primary">{verifyEmail}</span>.
              Click the link to activate your account.
            </p>
            <p className="text-xs text-muted-foreground font-body">
              Did not receive it? Check your spam folder or{' '}
              <button
                className="text-accent hover:underline cursor-pointer"
                onClick={() => setVerifyEmail('')}
              >
                try again
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hw-world min-h-screen flex">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="lazyOnload"
      />
      {leftPanel}

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-8 md:hidden">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span className="font-heading font-extrabold text-lg text-primary uppercase tracking-tight">HydroWash</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-3xl uppercase tracking-tight text-primary mb-1">Create your account</h2>
            <p className="text-muted-foreground text-sm font-body">Start booking aircon services in minutes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-sm font-medium text-primary">
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={form[field.key]}
                  onChange={set(field.key)}
                  placeholder={field.placeholder}
                  required
                  className="h-11"
                />
              </div>
            ))}

            {/* Optional address fields */}
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-sm font-medium text-primary">
                Home Address{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional — needed to book)</span>
              </Label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="address"
                  ref={addressInputRef}
                  placeholder={isLoaded ? 'Start typing your address…' : 'Loading…'}
                  disabled={!isLoaded}
                  onChange={() => setAddressData(null)}
                  autoComplete="off"
                  className="h-11 pl-9"
                />
              </div>
              {addressData ? (
                <p className="text-xs text-green-700">✓ Address confirmed</p>
              ) : (
                <p className="text-xs text-muted-foreground">Select an address from the dropdown.</p>
              )}
            </div>

            {addressData && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-unit" className="text-sm font-medium text-primary">
                    Unit / Floor <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="reg-unit"
                    value={unitFloor}
                    onChange={e => setUnitFloor(e.target.value)}
                    placeholder="e.g. #04-05"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-building" className="text-sm font-medium text-primary">
                    Building Name <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="reg-building"
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

            <Button
              type="submit"
              className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-bold cursor-pointer mt-2"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-accent font-medium hover:underline cursor-pointer">
                Sign in
              </Link>
            </p>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-6">
            <Link href="/" className="hover:underline cursor-pointer">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
