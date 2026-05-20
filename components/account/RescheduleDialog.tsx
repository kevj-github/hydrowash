'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlotCalendar } from '@/components/booking/SlotCalendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PreferredDateSlot } from '@/lib/types'

interface Props {
  bookingId: string
  onSuccess?: () => void
}

export function RescheduleDialog({ bookingId, onSuccess }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [entries, setEntries] = useState<PreferredDateSlot[]>([])
  const [error, setError] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_date_slots: entries }),
    })
    setSaving(false)
    if (res.ok) {
      setOpen(false)
      if (onSuccess) onSuccess()
      else router.refresh()
    } else {
      const body = await res.json()
      setError(body.error ?? 'Unable to reschedule booking.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-primary')}>
        Reschedule
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SlotCalendar value={entries} onChange={setEntries} />
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={saving || entries.length === 0}
            className="w-full bg-accent text-white hover:bg-accent/90"
          >
            {saving ? 'Saving…' : 'Confirm Reschedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
