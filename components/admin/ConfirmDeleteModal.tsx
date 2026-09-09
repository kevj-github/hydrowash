'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  items: { id: string; label: string }[]
  warning?: string
  onConfirm: () => Promise<void>
}

export function ConfirmDeleteModal({ open, onOpenChange, title, items, warning, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This will permanently delete {items.length} {items.length === 1 ? 'item' : 'items'}. This cannot be undone.
          </p>
          <ul className="max-h-40 overflow-y-auto text-sm space-y-1 border border-border rounded-lg p-2 bg-muted/40">
            {items.map(item => (
              <li key={item.id} className="truncate">{item.label}</li>
            ))}
          </ul>
          {warning && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{warning}</p>
          )}
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
          )}
          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? 'Deleting…' : `Delete ${items.length === 1 ? 'Item' : `${items.length} Items`}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
