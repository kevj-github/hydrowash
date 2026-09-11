'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import Image from 'next/image'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Wind } from 'lucide-react'
import Link from 'next/link'

const fields = [
  { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Tan', autoComplete: 'name' },
  { key: 'phone', label: 'Phone Number', type: 'text', placeholder: '+65 9123 4567', autoComplete: 'tel' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', autoComplete: 'email' },
  { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
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
  function set(field: FormKey) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addressData) {
      setError('Home address is required — please select an address from the dropdown suggestions.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          phone: form.phone,
          address: addressData.address,
          address_lat: addressData.lat,
          address_lng: addressData.lng,
          postal_code: addressData.postal_code,
          unit_floor: unitFloor || null,
          building_name: buildingName || null,
        },
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
      router.push('/')
    }
    setLoading(false)
  }

  const leftPanel = (
    <div className="hidden md:flex md:w-2/5 flex-col items-center justify-center px-10 py-16 relative overflow-hidden">
      <Image
        src="https://images.pexels.com/photos/6471913/pexels-photo-6471913.jpeg?auto=compress&cs=tinysrgb&w=1200"
        alt="HydroWash aircon technician"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-primary/70" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, #93C5FD 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div className="relative text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
          <Wind size={28} className="text-sky-300" strokeWidth={1.75} />
        </div>
        <h1 className="font-heading font-bold text-3xl text-white mb-3">HydroWash</h1>
        <p className="text-slate-300 text-base leading-relaxed max-w-xs">
          Book aircon services online — just pick a date and we&apos;ll handle the rest.
        </p>
      </div>
    </div>
  )

  if (verifyEmail) {
    return (
      <div className="min-h-screen flex">
        {leftPanel}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
          <div className="w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Wind size={22} className="text-accent" />
            </div>
            <h2 className="font-heading font-bold text-2xl text-primary mb-3">Check your email</h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              We sent a verification link to{' '}
              <span className="font-semibold text-primary">{verifyEmail}</span>.
              Click the link to activate your account.
            </p>
            <p className="text-xs text-muted-foreground">
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
    <div className="min-h-screen flex">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
        strategy="lazyOnload"
      />
      {leftPanel}

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 md:hidden">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Wind size={16} className="text-accent" strokeWidth={2} />
          </div>
          <span className="font-heading font-bold text-lg text-primary">HydroWash</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-2xl text-primary mb-1">Create your account</h2>
            <p className="text-muted-foreground text-sm">Start booking aircon services in minutes</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key} className="text-sm font-medium text-primary">
                  {field.label}
                </Label>
                {field.type === 'password' ? (
                  <PasswordInput
                    id={field.key}
                    value={form[field.key]}
                    onChange={set(field.key)}
                    placeholder={field.placeholder}
                    required
                    autoComplete={field.autoComplete}
                    className="h-11"
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={form[field.key]}
                    onChange={set(field.key)}
                    placeholder={field.placeholder}
                    required
                    autoComplete={field.autoComplete}
                    className="h-11"
                  />
                )}
              </div>
            ))}

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
                onResolved={setAddressData}
              />
              {addressData ? (
                <p className="text-xs text-green-700">
                  ✓ Address confirmed{addressData.postal_code ? `: Singapore ${addressData.postal_code}` : ''}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Select an address from the dropdown suggestions.</p>
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
              className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg cursor-pointer mt-2"
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
