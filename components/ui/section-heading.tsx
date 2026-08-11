import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  /** @deprecated eyebrow labels are a banned pattern in the hw-world — no longer rendered */
  label?: string
  title: string
  subtitle?: string
  align?: 'center' | 'left'
  className?: string
  light?: boolean
}

export function SectionHeading({
  title,
  subtitle,
  align = 'center',
  className,
  light = false,
}: SectionHeadingProps) {
  return (
    <div className={cn('mb-12', align === 'center' && 'text-center', className)}>
      <h2 className={cn(
        'font-heading font-bold text-4xl sm:text-5xl leading-[0.95] tracking-tight uppercase',
        light ? 'text-primary-foreground' : 'text-primary'
      )}>
        {title}
      </h2>
      {subtitle && (
        <p className={cn(
          'mt-4 text-lg max-w-2xl font-body',
          align === 'center' && 'mx-auto',
          light ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
