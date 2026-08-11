'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, FileText, User } from 'lucide-react'

interface CustomerBottomNavProps {
  isLoggedIn: boolean
}

export function CustomerBottomNav({ isLoggedIn }: CustomerBottomNavProps) {
  const pathname = usePathname()

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')
      ? 'text-accent'
      : 'text-slate-400 hover:text-white'

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-primary border-t border-white/10 flex items-stretch">
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${active('/')}`}
      >
        <Home size={20} strokeWidth={1.75} />
        <span className="text-[10px] font-medium leading-none">Home</span>
      </Link>

      <Link
        href={isLoggedIn ? '/book' : '/auth/login?redirect=/book'}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] bg-accent text-white transition-colors"
      >
        <CalendarDays size={20} strokeWidth={1.75} />
        <span className="text-[10px] font-medium leading-none">Book Now</span>
      </Link>

      {isLoggedIn ? (
        <>
          <Link
            href="/account/bookings"
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${active('/account/bookings')}`}
          >
            <FileText size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-medium leading-none">Bookings</span>
          </Link>
          <Link
            href="/account/settings"
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${active('/account/settings')}`}
          >
            <User size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-medium leading-none">Account</span>
          </Link>
        </>
      ) : (
        <Link
          href="/auth/login"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${active('/auth/login')}`}
        >
          <User size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-medium leading-none">Sign In</span>
        </Link>
      )}
    </nav>
  )
}
