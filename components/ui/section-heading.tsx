import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  label?: string
  title: string
  subtitle?: string
  align?: 'center' | 'left'
  className?: string
  light?: boolean
}

export function SectionHeading({
  label,
  title,
  subtitle,
  align = 'center',
  className,
  light = false,
}: SectionHeadingProps) {
  return (
    <div className={cn('mb-12', align === 'center' && 'text-center', className)}>
      {label && (
        <p className={cn(
          'text-xs font-semibold uppercase tracking-widest mb-3',
          light ? 'text-sky-300' : 'text-accent'
        )}>
          {label}
        </p>
      )}
      <h2 className={cn(
        'font-heading font-bold text-3xl sm:text-4xl leading-tight',
        light ? 'text-white' : 'text-primary'
      )}>
        {title}
      </h2>
      {subtitle && (
        <p className={cn(
          'mt-4 text-lg max-w-2xl',
          align === 'center' && 'mx-auto',
          light ? 'text-slate-300' : 'text-muted-foreground'
        )}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
