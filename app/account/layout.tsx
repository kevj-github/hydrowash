import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wind } from 'lucide-react'
import { LogoutButton } from '@/app/(public)/LogoutButton'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/account/bookings')

  return (
    <>
      <header className="sticky top-0 z-40 bg-primary border-b border-white/10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
              <Wind size={14} className="text-sky-300" strokeWidth={2} />
            </div>
            <span className="font-heading font-bold text-lg text-white tracking-tight">HydroWash</span>
          </Link>
          <nav className="flex items-center gap-1">
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
      <main className="flex-1 min-h-screen bg-background">
        {children}
      </main>
    </>
  )
}
