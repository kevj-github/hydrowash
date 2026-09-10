import { getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wind } from 'lucide-react'
import { LogoutButton } from '@/app/(public)/LogoutButton'
import { CustomerBottomNav } from '@/components/ui/CustomerBottomNav'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/auth/login?redirect=/account/bookings')

  return (
    <div className="overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-primary border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center transition-colors duration-200 group-hover:bg-accent/30">
              <Wind size={16} className="text-sky-300" strokeWidth={2} />
            </div>
            <span className="font-heading font-bold text-lg text-white tracking-tight">HydroWash</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/account/bookings"
              className="text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-all duration-150"
            >
              My Bookings
            </Link>
            <Link
              href="/account/contracts"
              className="text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-all duration-150"
            >
              Contracts &amp; Invoices
            </Link>
            <Link
              href="/account/settings"
              className="text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-all duration-150"
            >
              Settings
            </Link>
            <Link
              href="/book"
              className="text-sm bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-150 ml-2 cursor-pointer"
            >
              Book Now
            </Link>
            <div className="ml-1">
              <LogoutButton />
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1 min-h-screen bg-background pb-14 md:pb-0">
        {children}
      </main>
      <CustomerBottomNav isLoggedIn={true} />
    </div>
  )
}
