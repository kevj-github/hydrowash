import { cn } from '@/lib/utils'

interface StepItemProps {
  number: number
  label: string
  description?: string
  done?: boolean
  className?: string
}

export function StepItem({ number, label, description, done = false, className }: StepItemProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center font-heading font-bold text-lg border-2 transition-colors duration-200 mb-3',
        done
          ? 'bg-accent border-accent text-white'
          : 'bg-white border-accent text-accent'
      )}>
        {number}
      </div>
      <p className="font-heading font-semibold text-primary text-sm">{label}</p>
      {description && (
        <p className="text-muted-foreground text-xs mt-1 max-w-[120px]">{description}</p>
      )}
    </div>
  )
}
