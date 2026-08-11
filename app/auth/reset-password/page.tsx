'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    if (!token_hash || type !== 'recovery') {
      setError('Invalid or expired reset link. Please request a new one.')
      setVerifying(false)
      return
    }
    supabase.auth.verifyOtp({ token_hash, type: 'recovery' }).then(({ error }) => {
      if (error) setError('This reset link has expired or already been used. Please request a new one.')
      setVerifying(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2000)
  }

  return (
    <div className="hw-world min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <span className="font-heading font-extrabold text-lg text-primary uppercase tracking-tight">HydroWash</span>
        </div>
        <div className="mb-8 text-center">
          <h2 className="font-heading font-bold text-3xl uppercase tracking-tight text-primary mb-1">Set new password</h2>
          <p className="text-muted-foreground text-sm font-body">Choose a new password for your account</p>
        </div>
        {verifying ? (
          <p className="text-sm text-muted-foreground text-center">Verifying reset link…</p>
        ) : done ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-3 text-center">
            Password updated! Redirecting to sign-in…
          </p>
        ) : error && !password ? (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-3 text-center">
            {error}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-primary">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm font-medium text-primary">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
                className="h-11"
              />
            </div>
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
              {loading ? 'Updating…' : 'Update Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

import { Suspense } from 'react'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
