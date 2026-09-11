'use client'
import { useState } from 'react'
import { Mail, Check } from 'lucide-react'

interface Props {
  url: string
  label?: string
  className?: string
}

export function RemindButton({ url, label = 'Remind', className }: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    setState('sending')
    try {
      const res = await fetch(url, { method: 'POST' })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 3000)
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={state === 'sending'}
      className={className ?? 'text-accent hover:underline text-xs font-medium flex items-center gap-0.5 disabled:opacity-50 cursor-pointer'}
    >
      {state === 'sent' ? (
        <>
          <Check size={12} strokeWidth={2} /> Sent
        </>
      ) : state === 'error' ? (
        'Failed — retry'
      ) : (
        <>
          <Mail size={12} strokeWidth={2} /> {state === 'sending' ? 'Sending…' : label}
        </>
      )}
    </button>
  )
}
