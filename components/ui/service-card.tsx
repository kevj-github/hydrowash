import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ServiceCardProps {
  icon: LucideIcon
  code: string
  title: string
  description: string
  className?: string
  photoSrc?: string
  photoAlt?: string
}

/** An advisory-board row: index code, reading, photo revealed on hover — not a card grid. */
export function ServiceCard({ icon: Icon, code, title, description, className, photoSrc, photoAlt }: ServiceCardProps) {
  return (
    <div
      className={cn(
        'group relative grid grid-cols-[auto_1fr_auto] sm:grid-cols-[5rem_1fr_9rem] items-center gap-4 sm:gap-6',
        'border-t border-border py-6 sm:py-7 px-1 overflow-hidden transition-colors duration-300',
        className
      )}
    >
      {/* Amber signal fill sweeps in on hover — the "flagged" state */}
      <div className="absolute inset-0 bg-accent/[0.06] scale-x-0 origin-left transition-transform duration-500 ease-out group-hover:scale-x-100" aria-hidden />

      <span className="relative font-data text-xs sm:text-sm text-accent tabular-nums">{code}</span>

      <div className="relative flex items-start gap-3 min-w-0">
        <Icon size={20} strokeWidth={1.75} className="text-primary shrink-0 mt-1" />
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-2xl sm:text-3xl uppercase tracking-tight text-primary leading-none">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mt-2 max-w-lg font-body">
            {description}
          </p>
        </div>
      </div>

      {photoSrc && (
        <div className="relative hidden sm:block h-20 w-32 rounded-[var(--radius)] overflow-hidden shrink-0 grayscale group-hover:grayscale-0 transition-all duration-500">
          <Image
            src={photoSrc}
            alt={photoAlt ?? title}
            fill
            className="object-cover scale-110 group-hover:scale-100 transition-transform duration-500"
            sizes="128px"
          />
        </div>
      )}
    </div>
  )
}
