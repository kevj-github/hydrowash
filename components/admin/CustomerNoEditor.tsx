'use client'
import { useState } from 'react'
import { Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { regionForCustomerNo, REGION_LABELS } from '@/lib/customers/regions'
import { cn } from '@/lib/utils'

interface Props {
  customerId: string
  customerNo: number | null
  compact?: boolean
  onUpdated?: (newNo: number) => void
}

type Phase = 'idle' | 'editing' | 'confirming' | 'saving'

export function CustomerNoEditor({ customerId, customerNo, compact = false, onUpdated }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [value, setValue] = useState(String(customerNo ?? ''))
  const [displayNo, setDisplayNo] = useState(customerNo)
  const [conflict, setConflict] = useState<{ id: string; name: string; customer_no: number } | null>(null)
  const [error, setError] = useState('')

  function startEdit() {
    setValue(String(displayNo ?? ''))
    setConflict(null)
    setError('')
    setPhase('editing')
  }

  function cancel() {
    setPhase('idle')
    setConflict(null)
    setError('')
  }

  async function checkAndConfirm() {
    const parsed = parseInt(value, 10)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Enter a valid number.')
      return
    }
    if (parsed === displayNo) {
      setPhase('idle')
      return
    }
    setError('')
    const res = await fetch(`/api/admin/customers/${customerId}/customer-no`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_no: parsed }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Could not check that number.')
      return
    }
    if (json.conflict) {
      setConflict(json.conflictWith)
      return
    }
    setConflict(null)
    setPhase('confirming')
  }

  async function commit() {
    const parsed = parseInt(value, 10)
    setPhase('saving')
    const res = await fetch(`/api/admin/customers/${customerId}/customer-no`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_no: parsed, confirm: true }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to save.')
      setPhase('editing')
      return
    }
    setDisplayNo(parsed)
    setPhase('idle')
    onUpdated?.(parsed)
  }

  const region = regionForCustomerNo(displayNo)

  if (phase === 'idle') {
    return (
      <span className={cn('inline-flex items-center gap-1.5', compact ? 'text-sm' : 'text-base')}>
        <span className="font-medium">#{displayNo ?? '—'}</span>
        {region && <span className="text-xs text-muted-foreground">({REGION_LABELS[region]})</span>}
        <button
          type="button"
          onClick={startEdit}
          aria-label="Edit customer number"
          className="text-muted-foreground hover:text-accent cursor-pointer"
        >
          <Pencil size={compact ? 11 : 13} />
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        <Input
          type="number"
          value={value}
          onChange={e => { setValue(e.target.value); setConflict(null); setError('') }}
          className="h-7 w-24 text-sm"
          autoFocus
          disabled={phase === 'saving'}
        />
        {phase === 'confirming' ? (
          <>
            <button type="button" onClick={commit} className="text-green-700 hover:text-green-800 cursor-pointer" aria-label="Confirm">
              <Check size={15} />
            </button>
            <button type="button" onClick={cancel} className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label="Cancel">
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={checkAndConfirm}
              disabled={phase === 'saving'}
              className="text-xs text-accent hover:underline cursor-pointer disabled:opacity-50"
            >
              {phase === 'saving' ? 'Saving…' : 'Check'}
            </button>
            <button type="button" onClick={cancel} className="text-muted-foreground hover:text-destructive cursor-pointer" aria-label="Cancel">
              <X size={15} />
            </button>
          </>
        )}
      </span>
      {phase === 'confirming' && (
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center gap-1">
          <AlertTriangle size={12} /> Change #{displayNo ?? '—'} → #{value}?
        </span>
      )}
      {conflict && (
        <span className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1">
          #{value} is already used by {conflict.name}. Choose a different number.
        </span>
      )}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </span>
  )
}
