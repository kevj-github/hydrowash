'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, CalendarCheck, Users, FileText, Receipt,
  CalendarRange, CalendarOff, MapPin, Settings, MoreHorizontal, X
} from 'lucide-react'

const primary = [
  { href: '/admin',           label: 'Overview',  icon: LayoutDashboard },
  { href: '/admin/bookings',  label: 'Bookings',  icon: CalendarCheck },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/contracts', label: 'Contracts', icon: FileText },
  { href: '/admin/invoices',  label: 'Invoices',  icon: Receipt },
]

const more = [
  { href: '/admin/agenda',        label: 'Agenda',        icon: CalendarRange },
  { href: '/admin/availability',  label: 'Availability',  icon: CalendarOff },
  { href: '/admin/schedule',      label: 'Schedule',      icon: MapPin },
  { href: '/admin/settings',      label: 'Settings',      icon: Settings },
]

export function AdminBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const anyMoreActive = more.some(m => isActive(m.href))

  return (
    <>
      {/* More sheet backdrop */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 z-50 bg-primary border-t border-white/10 rounded-t-2xl px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-semibold text-sm">More</span>
            <button onClick={() => setMoreOpen(false)} className="text-slate-400 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {more.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors ${
                  isActive(href) ? 'bg-accent/20 text-accent' : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={20} strokeWidth={1.75} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-primary border-t border-white/10 flex items-stretch">
        {primary.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
              isActive(href) ? 'text-accent' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(o => !o)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
            anyMoreActive ? 'text-accent' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MoreHorizontal size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>
    </>
  )
}
