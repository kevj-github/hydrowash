import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ServiceCardProps {
  icon: LucideIcon
  title: string
  description: string
  className?: string
  photoSrc?: string
  photoAlt?: string
  /** Urgency-weighted treatment: dark, wider, photo-and-content side by side. */
  featured?: boolean
  /** Small tag shown above the title on a featured card, e.g. "We come to you today". */
  tag?: string
}

export function ServiceCard({ icon: Icon, title, description, className, photoSrc, photoAlt, featured = false, tag }: ServiceCardProps) {
  if (featured) {
    return (
      <div className={cn(
        'group bg-primary rounded-2xl overflow-hidden grid sm:grid-cols-2',
        'transition-all duration-200 hover:shadow-xl hover:shadow-primary/20',
        className
      )}>
        {photoSrc && (
          <div className="relative h-52 sm:h-full w-full overflow-hidden bg-primary">
            <Image
              src={photoSrc}
              alt={photoAlt ?? title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </div>
        )}
        <div className="p-6 sm:p-8 flex flex-col justify-center">
          {tag && (
            <p className="text-sky-400 text-xs font-semibold uppercase tracking-widest mb-3">{tag}</p>
          )}
          <div className="w-11 h-11 rounded-xl bg-white/10 text-sky-300 flex items-center justify-center mb-4">
            <Icon size={22} strokeWidth={1.75} />
          </div>
          <h3 className="font-heading font-semibold text-white text-xl mb-2">{title}</h3>
          <p className="text-slate-300 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'group bg-white rounded-2xl border border-border overflow-hidden',
      'transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
      className
    )}>
      {photoSrc && (
        <div className="relative h-44 w-full overflow-hidden bg-muted">
          <Image
            src={photoSrc}
            alt={photoAlt ?? title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      )}
      <div className="p-6">
        <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
          <Icon size={22} strokeWidth={1.75} />
        </div>
        <h3 className="font-heading font-semibold text-primary text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
