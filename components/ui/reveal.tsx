'use client'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: React.ReactNode
  className?: string
  delayMs?: number
  as?: 'div' | 'li'
}

export function Reveal({ children, className, delayMs = 0, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLDivElement | HTMLLIElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const t = setTimeout(() => setVisible(true), delayMs)
          observer.disconnect()
          return () => clearTimeout(t)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -5% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delayMs])

  const Tag = as
  return (
    <Tag
      ref={ref as never}
      data-visible={visible}
      className={cn('hw-reveal', className)}
    >
      {children}
    </Tag>
  )
}
