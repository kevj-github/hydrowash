import { cn } from '@/lib/utils'

interface StepItemProps {
  number: number
  level: string
  label: string
  description?: string
  done?: boolean
  className?: string
}

const LEVEL_STYLES = [
  'bg-muted text-muted-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-accent text-accent-foreground',
]

/** An escalation-level chip (WATCH → WARNING → CONFIRMED), not a numbered circle. */
export function StepItem({ number, level, label, description, className }: StepItemProps) {
  const style = LEVEL_STYLES[Math.min(number - 1, LEVEL_STYLES.length - 1)]
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <span className={cn('font-data text-xs font-semibold uppercase tracking-[0.15em] px-2.5 py-1 w-fit', style)}>
        {level}
      </span>
      <p className="font-heading font-bold text-2xl uppercase tracking-tight text-primary leading-none">{label}</p>
      {description && (
        <p className="text-muted-foreground text-sm leading-relaxed font-body">{description}</p>
      )}
    </div>
  )
}
