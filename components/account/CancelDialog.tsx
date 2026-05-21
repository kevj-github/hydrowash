'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Props {
  bookingId: string
  onSuccess?: () => void
}

export function CancelDialog({ bookingId, onSuccess }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  async function handleCancel() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || undefined }),
    })
    setSaving(false)
    if (res.ok) {
      setOpen(false)
      if (onSuccess) onSuccess()
      else router.refresh()
    } else {
      const body = await res.json()
      setError(body.error ?? 'Unable to cancel booking.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'border-red-300 text-red-600 hover:bg-red-50 min-h-[44px]')}>
        Cancel
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Optional reason for cancellation"
            rows={3}
          />
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Keep Booking
            </Button>
            <Button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {saving ? 'Cancelling…' : 'Confirm Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
