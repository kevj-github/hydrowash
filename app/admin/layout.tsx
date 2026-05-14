import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wind } from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/availability', label: 'Availability' },
  { href: '/admin/contracts', label: 'Contracts' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/settings', label: 'Settings' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-white border-b border-white/10 shrink-0">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
              <Wind size={14} className="text-sky-300" strokeWidth={2} />
            </div>
            <span className="font-heading font-bold text-base text-white">HydroWash</span>
            <span className="text-white/30 mx-2 text-sm">|</span>
            <span className="text-slate-400 text-sm font-medium">Admin</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-all duration-150"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-md hover:bg-white/10 transition-all duration-150 ml-2"
            >
              ← Public Site
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
