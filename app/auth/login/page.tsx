'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import Image from 'next/image'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const searchParams = useSearchParams()
  const passwordUpdated = searchParams.get('pw') === 'updated'
  const supabase = createClient()

  async function handleReset() {
    if (!email) { setError('Enter your email first'); return }
    setLoading(true)
    setError('')
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setResetSent(true)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const explicit = searchParams.get('redirect')
    // Resolve against current origin so /\evil.com and protocol-relative
    // bypasses are rejected — window.location.href follows any URL unlike router.push.
    let destination = '/'
    if (explicit) {
      try {
        const parsed = new URL(explicit, window.location.origin)
        if (parsed.origin === window.location.origin) destination = explicit
      } catch {}
    }
    // Hard redirect so the browser sends the newly-set auth cookies in the
    // next request — router.push fires before @supabase/ssr's onAuthStateChange
    // can write the session cookie, causing middleware to see no session.
    window.location.href = destination
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-primary">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="password" className="text-sm font-medium text-primary">Password</Label>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="text-xs text-accent hover:underline cursor-pointer disabled:opacity-50"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="h-11"
        />
      </div>
      {passwordUpdated && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Password updated. Please sign in with your new password.
        </p>
      )}
      {resetSent && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          If an account exists for that email, a reset link has been sent.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-bold cursor-pointer"
        disabled={loading}
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>
      <p className="text-sm text-center text-muted-foreground">
        No account?{' '}
        <Link href="/auth/register" className="text-accent font-medium hover:underline cursor-pointer">
          Create one
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="hw-world min-h-screen flex">
      {/* Left panel — advisory board */}
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

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-8 md:hidden">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span className="font-heading font-extrabold text-lg text-primary uppercase tracking-tight">HydroWash</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-3xl uppercase tracking-tight text-primary mb-1">Welcome back</h2>
            <p className="text-muted-foreground text-sm font-body">Sign in to manage your bookings</p>
          </div>
          <Suspense fallback={<div className="h-48" />}>
            <LoginForm />
          </Suspense>
          <p className="text-xs text-center text-muted-foreground mt-6 font-body">
            <Link href="/" className="hover:text-accent transition-colors cursor-pointer">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
