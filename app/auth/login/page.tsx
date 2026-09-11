'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Wind } from 'lucide-react'
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
      // Supabase returns the developer-facing "Invalid login credentials";
      // give the customer something actionable instead.
      setError(
        error.message === 'Invalid login credentials'
          ? "That email and password don't match. Check your password, or create an account if you haven't yet."
          : error.message
      )
      setLoading(false)
      return
    }
    const explicit = searchParams.get('redirect')
    // Resolve against current origin so /\evil.com and protocol-relative
    // bypasses are rejected — window.location.href follows any URL unlike router.push.
    // Admins land on their dashboard rather than the marketing homepage.
    let destination = '/'
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.user.id).single()
      if (profile?.role === 'admin') destination = '/admin'
    }
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
          autoComplete="email"
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
        <PasswordInput
          id="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
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
        <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg cursor-pointer"
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
    <div className="min-h-screen flex">
      {/* Left panel — photo */}
      <aside className="hidden md:flex md:w-2/5 flex-col items-center justify-center px-10 py-16 relative overflow-hidden">
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
      </aside>

      {/* Right panel — white form */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 md:hidden">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Wind size={16} className="text-accent" strokeWidth={2} />
          </div>
          <span className="font-heading font-bold text-lg text-primary">HydroWash</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-heading font-bold text-2xl text-primary mb-1">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to manage your bookings</p>
          </div>
          <Suspense fallback={<div className="h-48" />}>
            <LoginForm />
          </Suspense>
          <p className="text-xs text-center text-muted-foreground mt-6">
            <Link href="/" className="hover:underline cursor-pointer">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
