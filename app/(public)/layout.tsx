import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PublicHeader } from './PublicHeader'
import { CustomerBottomNav } from '@/components/ui/CustomerBottomNav'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isAdmin = profile?.role === 'admin'
  }

  return (
    <div className="hw-world contents">
      <PublicHeader isLoggedIn={!!user} isAdmin={isAdmin} />
      <main className="flex-1 pb-14 md:pb-0 bg-background">{children}</main>
      <CustomerBottomNav isLoggedIn={!!user} />
      <footer className="bg-primary border-t border-white/10 text-primary-foreground/60 py-14 mt-auto mb-14 md:mb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between gap-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                <span className="font-heading font-extrabold text-primary-foreground text-lg uppercase tracking-tight">HydroWash</span>
              </div>
              <p className="text-sm leading-relaxed font-body">
                Professional aircon servicing across Singapore. Book online in minutes, stay covered year-round.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-10">
              <div>
                <p className="text-xs font-data font-semibold uppercase tracking-[0.15em] text-primary-foreground/40 mb-4">Services</p>
                <ul className="space-y-2.5 text-sm font-body">
                  <li><Link href="/book" className="hover:text-accent transition-colors cursor-pointer">General Maintenance</Link></li>
                  <li><Link href="/book" className="hover:text-accent transition-colors cursor-pointer">Fault Repair</Link></li>
                  <li><Link href="/book" className="hover:text-accent transition-colors cursor-pointer">Installation</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-data font-semibold uppercase tracking-[0.15em] text-primary-foreground/40 mb-4">Account</p>
                <ul className="space-y-2.5 text-sm font-body">
                  <li><Link href="/auth/login" className="hover:text-accent transition-colors cursor-pointer">Sign In</Link></li>
                  <li><Link href="/auth/register" className="hover:text-accent transition-colors cursor-pointer">Register</Link></li>
                  <li><Link href="/account/bookings" className="hover:text-accent transition-colors cursor-pointer">My Bookings</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-10 pt-6 text-xs font-data text-primary-foreground/40 text-center">
            © {new Date().getFullYear()} HydroWash. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
