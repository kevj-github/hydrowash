import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wind } from 'lucide-react'
import { AdminNav } from '@/components/admin/AdminNav'
import { AdminBottomNav } from '@/components/admin/AdminBottomNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-white border-b border-white/10 shrink-0">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
              <Wind size={14} className="text-sky-300" strokeWidth={2} />
            </div>
            <span className="font-heading font-bold text-base text-white">HydroWash</span>
            <span className="text-white/30 mx-2 text-sm hidden sm:block">|</span>
            <span className="text-slate-300 text-sm font-medium hidden sm:block">Admin</span>
          </div>
          {/* min-w-0 lets AdminNav's own overflow-x-auto actually engage. Without
              it the nav is a flex item sized to its content (845px), so at the
              768px tablet width it pushed the whole admin surface into a 1101px
              horizontal scroll instead of scrolling within itself. */}
          <div className="hidden md:flex min-w-0 flex-1 justify-end">
            <AdminNav />
          </div>
          <Link
            href="/"
            className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-all duration-150 shrink-0 hidden lg:block"
          >
            ← Site
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 pb-20 md:pb-8">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  )
}
