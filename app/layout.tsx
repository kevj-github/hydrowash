import type { Metadata } from 'next'
import { Poppins, Open_Sans } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'HydroWash — Aircon Servicing Singapore',
  description: 'Professional aircon servicing, chemical wash, and fault repair in Singapore.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${openSans.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#020617] antialiased font-body overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}
