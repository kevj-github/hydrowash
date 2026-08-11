import Link from 'next/link'
import { Wind } from 'lucide-react'
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
    <>
      <PublicHeader isLoggedIn={!!user} isAdmin={isAdmin} />
      {/* pb-24 clears the 57px fixed CustomerBottomNav with room to spare —
          pb-14 (56px) left page-bottom actions partly under it. */}
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <CustomerBottomNav isLoggedIn={!!user} />
      <footer className="bg-primary border-t border-white/10 text-slate-300 py-12 mt-auto mb-14 md:mb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Wind size={14} className="text-sky-300" strokeWidth={2} />
                </div>
                <span className="font-heading font-bold text-white text-base">HydroWash</span>
              </div>
              <p className="text-sm leading-relaxed">
                Professional aircon servicing across Singapore. Book online in minutes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-300 mb-3">Services</p>
                {/* Links are inline-flex with min-h-11 below md so each footer link is a
                    44px tap target; spacing collapses to 0 there to keep the footer compact,
                    and desktop keeps the original 19px rows with space-y-2. */}
                <ul className="space-y-0 md:space-y-2 text-sm">
                  <li><Link href="/book" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">General Maintenance</Link></li>
                  <li><Link href="/book" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">Fault Repair</Link></li>
                  <li><Link href="/book" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">Installation</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-300 mb-3">Account</p>
                <ul className="space-y-0 md:space-y-2 text-sm">
                  {user ? (
                    <>
                      <li><Link href="/account/bookings" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">My Bookings</Link></li>
                      <li><Link href="/account/contracts" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">Contracts &amp; Invoices</Link></li>
                      <li><Link href="/account/settings" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">Settings</Link></li>
                    </>
                  ) : (
                    <>
                      <li><Link href="/auth/login" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">Sign In</Link></li>
                      <li><Link href="/auth/register" className="inline-flex items-center min-h-11 md:min-h-0 hover:text-white transition-colors cursor-pointer">Register</Link></li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-10 pt-6 text-xs text-slate-300 text-center">
            © {new Date().getFullYear()} HydroWash. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  )
}
