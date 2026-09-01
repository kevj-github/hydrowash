'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarCheck, Users, CalendarRange,
  CalendarOff, FileText, Receipt, Settings
} from 'lucide-react'

const navItems = [
  { href: '/admin',              label: 'Overview',     icon: LayoutDashboard },
  { href: '/admin/bookings',     label: 'Bookings',     icon: CalendarCheck },
  { href: '/admin/customers',    label: 'Customers',    icon: Users },
  { href: '/admin/agenda',       label: 'Agenda',       icon: CalendarRange },
  { href: '/admin/availability', label: 'Availability', icon: CalendarOff },
  { href: '/admin/contracts',    label: 'Contracts',    icon: FileText },
  { href: '/admin/invoices',     label: 'Invoices',     icon: Receipt },
  { href: '/admin/settings',     label: 'Settings',     icon: Settings },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto min-w-0">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-all duration-150 whitespace-nowrap ${
              isActive
                ? 'bg-white/15 text-white font-medium'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon size={14} strokeWidth={2} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
