'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface MobileNavProps {
  isLoggedIn: boolean
  isAdmin?: boolean
}

export function MobileNav({ isLoggedIn, isAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="text-primary-foreground p-2 hover:bg-white/10 transition-colors cursor-pointer"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-16 left-0 right-0 bg-primary border-t border-white/10 shadow-xl shadow-black/30 z-50 px-4 py-4 flex flex-col gap-1">
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="text-xs font-data uppercase tracking-[0.1em] text-secondary hover:text-secondary/80 hover:bg-white/10 transition-colors px-3 py-2.5 font-semibold cursor-pointer"
                >
                  Admin Panel
                </Link>
              )}
              <Link
                href="/account/bookings"
                onClick={() => setOpen(false)}
                className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10 transition-colors px-3 py-2.5 cursor-pointer"
              >
                My Bookings
              </Link>
              {!isAdmin && (
                <>
                  <Link
                    href="/account/contracts"
                    onClick={() => setOpen(false)}
                    className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10 transition-colors px-3 py-2.5 cursor-pointer"
                  >
                    Contracts &amp; Invoices
                  </Link>
                  <Link
                    href="/account/settings"
                    onClick={() => setOpen(false)}
                    className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10 transition-colors px-3 py-2.5 cursor-pointer"
                  >
                    Settings
                  </Link>
                </>
              )}
              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="text-xs font-data uppercase tracking-[0.1em] text-accent-foreground bg-accent hover:bg-accent/90 transition-colors px-3 py-2.5 font-bold mt-1 cursor-pointer"
              >
                Book Now
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10 transition-colors px-3 py-2.5 text-left cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/10 transition-colors px-3 py-2.5 cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="text-xs font-data uppercase tracking-[0.1em] text-accent-foreground bg-accent hover:bg-accent/90 transition-colors px-3 py-2.5 font-bold mt-1 cursor-pointer"
              >
                Book Now
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
