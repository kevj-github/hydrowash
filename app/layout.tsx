import type { Metadata } from 'next'
import { Poppins, Open_Sans, Barlow_Condensed, Work_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const openSans = Open_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

// Public-surface ("Feels-Like Board") type system — scoped under .hw-world, see globals.css
const barlowCondensed = Barlow_Condensed({
  variable: '--font-display-hw',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})

const workSans = Work_Sans({
  variable: '--font-body-hw',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-data-hw',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HydroWash — Aircon Servicing Singapore',
  description: 'Professional aircon servicing, chemical wash, and fault repair in Singapore.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${openSans.variable} ${barlowCondensed.variable} ${workSans.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#020617] antialiased font-body overflow-x-hidden">
        {/*
          THESIS: Booking Hydrowash service reads like checking Singapore's own heat-advisory
            board, not a corporate SaaS form — the category default this refuses.
          OWN-WORLD: Near-black ground (#17120d) + amber-orange signal (#ff6a2b) + warm paper
            (#f3ede1); Barlow Condensed display, IBM Plex Mono for readouts/data, Work Sans body;
            low-radius instrument-panel chrome; advisory ticker strip, escalation-level chips.
          STORY: Visitor sees today's heat reading resolve into relief, understands Hydrowash
            keeps solving it via 1-year contracts (not one-off), and books in minutes.
          FIRST VIEWPORT: Full-bleed near-black hero — huge tabular "FEELS LIKE 41°" readout,
            power-on flicker-in, resolving to a cool confirmed-slot CTA row below it.
          FORM: Feels-Like Board — grounded direction #5 of 7, seed key 638ba3bf.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
            review, the verdict, and DESIGN.md.
        */}
        {children}
      </body>
    </html>
  )
}
