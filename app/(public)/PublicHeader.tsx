'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wind } from 'lucide-react'
import { MobileNav } from './MobileNav'
import { LogoutButton } from './LogoutButton'

interface PublicHeaderProps {
  isLoggedIn: boolean
  isAdmin: boolean
}

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

  return (
    <header
      className={`sticky top-0 z-40 bg-primary border-b border-white/10 transition-all duration-300 ${
        scrolled ? 'bg-primary/95 backdrop-blur-md shadow-lg' : ''
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center transition-colors duration-200 group-hover:bg-accent/30">
            <Wind size={16} className="text-sky-300" strokeWidth={2} />
          </div>
          <span className="font-heading font-bold text-lg text-white tracking-tight">
            HydroWash
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm text-amber-400 hover:text-amber-300 font-semibold px-3 py-2 rounded-md hover:bg-white/10 transition-all duration-150"
                >
                  Admin Panel →
                </Link>
              )}
              <Link
                href="/account/bookings"
                className="text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-all duration-150"
              >
                My Bookings
              </Link>
              {!isAdmin && (
                <>
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
                </>
              )}
              <Link
                href="/book"
                className="text-sm bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-150 ml-2"
              >
                Book Now
              </Link>
              <div className="ml-1">
                <LogoutButton />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm text-slate-300 hover:text-white px-3 py-2 rounded-md hover:bg-white/10 transition-all duration-150"
              >
                Sign In
              </Link>
              <Link
                href="/book"
                className="text-sm bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-150 ml-2"
              >
                Book Now
              </Link>
            </>
          )}
        </nav>

        <MobileNav isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
      </div>
    </header>
  )
}
