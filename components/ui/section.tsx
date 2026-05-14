import { cn } from '@/lib/utils'

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export function Section({ className, children, ...props }: SectionProps) {
  return (
    <section className={cn('w-full', className)} {...props}>
      {children}
    </section>
  )
}

interface SectionInnerProps {
  className?: string
  children: React.ReactNode
}

export function SectionInner({ className, children }: SectionInnerProps) {
  return (
    <div className={cn('max-w-6xl mx-auto px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  )
}
