import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ServiceCardProps {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}

export function ServiceCard({ icon: Icon, title, description, className }: ServiceCardProps) {
  return (
    <div className={cn(
      'group bg-white rounded-2xl border border-border p-6',
      'transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
      className
    )}>
      <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h3 className="font-heading font-semibold text-primary text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}
