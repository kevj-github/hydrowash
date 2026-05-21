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
        className="text-white p-2 rounded-md hover:bg-white/10 transition-colors"
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
        <div className="absolute top-16 left-0 right-0 bg-primary border-t border-white/10 shadow-lg z-50 px-4 py-4 flex flex-col gap-1">
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="text-sm text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors px-3 py-2 rounded-md font-semibold"
                >
                  Admin Panel →
                </Link>
              )}
              <Link
                href="/account/bookings"
                onClick={() => setOpen(false)}
                className="text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors px-3 py-2 rounded-md"
              >
                My Bookings
              </Link>
              {!isAdmin && (
                <Link
                  href="/account/contracts"
                  onClick={() => setOpen(false)}
                  className="text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors px-3 py-2 rounded-md"
                >
                  Contracts &amp; Invoices
                </Link>
              )}
              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="text-sm text-white bg-accent hover:bg-accent/90 transition-colors px-3 py-2 rounded-md font-semibold mt-1"
              >
                Book Now
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors px-3 py-2 rounded-md text-left"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors px-3 py-2 rounded-md"
              >
                Sign In
              </Link>
              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="text-sm text-white bg-accent hover:bg-accent/90 transition-colors px-3 py-2 rounded-md font-semibold mt-1"
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
