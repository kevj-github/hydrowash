'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wind } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Wind size={16} className="text-accent" strokeWidth={2} />
          </div>
          <span className="font-heading font-bold text-lg text-primary">HydroWash</span>
        </div>
        <div className="mb-8 text-center">
          <h2 className="font-heading font-bold text-2xl text-primary mb-1">Set new password</h2>
          <p className="text-muted-foreground text-sm">Choose a new password for your account</p>
        </div>
        {done ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-3 text-center">
            Password updated! Redirecting to sign-in…
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
              className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg cursor-pointer"
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
