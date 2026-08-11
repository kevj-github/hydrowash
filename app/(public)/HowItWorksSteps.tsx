'use client'

import { useEffect, useRef, useState } from 'react'

interface Step {
  label: string
  description: string
}

const SAMPLE_SLOTS = ['Mon 10am', 'Wed 3pm', 'Fri 5pm']

type Phase = 'idle' | 'options' | 'confirmed'

export function HowItWorksSteps({ steps }: { steps: Step[] }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry.isIntersecting) return
        observer.disconnect()
        window.setTimeout(() => setPhase('options'), 400)
        window.setTimeout(() => setPhase('confirmed'), 1500)
      },
      { threshold: 0.4 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col sm:flex-row items-center justify-center gap-0 max-w-2xl mx-auto">
      {steps.map((step, i) => {
        const isSlotStep = i === 1
        const isConfirmStep = i === 2

        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center text-center px-4">
              <div className="relative mb-3">
                {isSlotStep && (
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {SAMPLE_SLOTS.map((slot, si) => (
                      <span
                        key={slot}
                        className="motion-reduce:transition-none! motion-reduce:opacity-0! whitespace-nowrap rounded-full border border-accent/30 bg-white px-2 py-0.5 text-[10px] font-medium text-accent shadow-sm transition-all"
                        style={{
                          transitionDuration: phase === 'confirmed' ? '450ms' : '400ms',
                          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                          transitionDelay: phase === 'options' ? `${si * 90}ms` : '0ms',
                          opacity: phase === 'idle' ? 0 : phase === 'confirmed' ? 0 : 1,
                          transform:
                            phase === 'idle'
                              ? `translateY(6px) scale(0.85)`
                              : phase === 'confirmed'
                                ? `translateY(-4px) scale(0.5)`
                                : `translateY(0) scale(1)`,
                        }}
                      >
                        {slot}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className="motion-reduce:transition-none! relative w-14 h-14 rounded-full bg-accent text-white font-heading font-bold text-xl flex items-center justify-center shadow-md shadow-accent/20 transition-transform"
                  style={{
                    transitionDuration: '500ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: isConfirmStep && phase === 'confirmed' ? 'scale(1.12)' : 'scale(1)',
                  }}
                >
                  {i + 1}
                </div>
              </div>
              <p className="font-heading font-semibold text-primary text-base max-w-[150px]">{step.label}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[150px]">{step.description}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="hidden sm:block w-16 h-0.5 bg-accent/30 flex-shrink-0 mb-10" />
            )}
          </div>
        )
      })}
    </div>
  )
}
