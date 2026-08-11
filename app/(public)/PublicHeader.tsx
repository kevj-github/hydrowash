'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MobileNav } from './MobileNav'
import { LogoutButton } from './LogoutButton'

interface PublicHeaderProps {
  isLoggedIn: boolean
  isAdmin: boolean
}

const TICKER_ITEMS = [
  'ISLAND-WIDE COVERAGE',
  'ALL MAKES & MODELS',
  '1-YEAR MAINTENANCE CONTRACTS',
  'SAME-DAY AVAILABILITY',
]

export function PublicHeader({ isLoggedIn, isAdmin }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    )
    const sentinel = document.getElementById('hero-sentinel')
    if (sentinel) observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const tickerLine = TICKER_ITEMS.join('   •   ') + '   •   '

  return (
    <header className={`sticky top-0 z-40 transition-shadow duration-300 ${scrolled ? 'shadow-xl shadow-black/20' : ''}`}>
      {/* Advisory ticker strip */}
      <div className="hidden sm:block bg-accent text-accent-foreground overflow-hidden h-7">
        <div className="flex items-center h-full whitespace-nowrap font-data text-[11px] font-semibold tracking-[0.12em] hw-ticker-track motion-reduce:animate-none">
          <span className="px-4">{tickerLine}{tickerLine}</span>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-primary border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <span className="relative flex h-2.5 w-2.5">
              <span className="hw-signal-dot absolute inline-flex h-full w-full rounded-full bg-accent motion-reduce:animate-none" />
            </span>
            <span className="font-heading font-extrabold text-xl text-primary-foreground uppercase tracking-tight">
              HydroWash
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {isLoggedIn ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-xs font-data uppercase tracking-[0.1em] text-secondary hover:text-secondary/80 font-semibold px-3 py-2 transition-colors cursor-pointer"
                  >
                    Admin Panel
                  </Link>
                )}
                <Link
                  href="/account/bookings"
                  className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground px-3 py-2 transition-colors cursor-pointer"
                >
                  My Bookings
                </Link>
                {!isAdmin && (
                  <>
                    <Link
                      href="/account/contracts"
                      className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground px-3 py-2 transition-colors cursor-pointer"
                    >
                      Contracts
                    </Link>
                    <Link
                      href="/account/settings"
                      className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground px-3 py-2 transition-colors cursor-pointer"
                    >
                      Settings
                    </Link>
                  </>
                )}
                <Link
                  href="/book"
                  className="text-xs font-data uppercase tracking-[0.1em] bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2.5 font-bold transition-colors ml-2 cursor-pointer"
                >
                  Book Now
                </Link>
                <div className="ml-2">
                  <LogoutButton />
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-xs font-data uppercase tracking-[0.1em] text-primary-foreground/60 hover:text-primary-foreground px-3 py-2 transition-colors cursor-pointer"
                >
                  Sign In
                </Link>
                <Link
                  href="/book"
                  className="text-xs font-data uppercase tracking-[0.1em] bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2.5 font-bold transition-colors ml-2 cursor-pointer"
                >
                  Book Now
                </Link>
              </>
            )}
          </nav>

          <MobileNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  )
}
