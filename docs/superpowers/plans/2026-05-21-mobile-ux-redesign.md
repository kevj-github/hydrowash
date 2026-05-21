# Mobile UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensively redesign the mobile experience for all customer and admin pages — fixing layout overflow, adding a bottom nav bar for both roles, converting the SlotCalendar to a mobile week-strip, making the admin booking map collapse to a bottom sheet, collapsing data tables to card views, and ensuring all dialogs scroll safely on small viewports.

**Architecture:** CSS-first approach — most changes use `md:` Tailwind breakpoints to show different layouts at mobile vs desktop. No new routing. Two new nav components (`CustomerBottomNav`, `AdminBottomNav`). `SlotCalendar` gains an inline mobile week-strip view via `hidden md:block` / `md:hidden` within the existing component. The admin bookings map uses a floating button + absolute-positioned bottom sheet (no new library dependency).

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, shadcn/ui v4, Lucide React, existing Supabase client

---

## Pre-flight: Confirm Findings

Before starting, review `docs/superpowers/specs/2026-05-21-mobile-audit-findings.md` (produced by Plan 1). Add any newly confirmed issues as additional steps to the relevant tasks below.

---

## Design Token Reference

Always use tokens, never hardcode hex:

| Token | Usage |
|---|---|
| `bg-primary` | `#0F172A` — dark navy |
| `bg-accent` | `#0369A1` — blue |
| `bg-background` | `#F8FAFC` — page background |
| `bg-muted` | `#E8ECF1` — section background |
| `text-muted-foreground` | `#64748B` |
| `border-border` | `#E2E8F0` |

---

## File Map

| Action | Path |
|---|---|
| Modify | `app/(public)/MobileNav.tsx` |
| Create | `components/ui/CustomerBottomNav.tsx` |
| Modify | `app/(public)/layout.tsx` |
| Create | `components/admin/AdminBottomNav.tsx` |
| Modify | `app/admin/layout.tsx` |
| Modify | `components/admin/AdminNav.tsx` |
| Modify | `components/booking/SlotCalendar.tsx` |
| Modify | `app/admin/bookings/AdminBookingsClient.tsx` |
| Modify | `components/admin/JobCompletionDialog.tsx` |
| Modify | `app/account/RescheduleDialog.tsx` |
| Modify | `app/account/CancelDialog.tsx` |
| Modify | `app/admin/customers/page.tsx` |
| Modify | `app/admin/contracts/page.tsx` |
| Modify | `app/admin/invoices/page.tsx` |
| Modify | `app/admin/agenda/page.tsx` |
| Modify | `app/admin/availability/page.tsx` |
| Modify | `components/booking/StepScheduleLocation.tsx` |
| Modify | `components/booking/BookingWizard.tsx` |
| Modify | `app/account/bookings/page.tsx` |

---

## Task 1: Fix MobileNav Design Token Violations

**Files:**
- Modify: `app/(public)/MobileNav.tsx`

The current `MobileNav` uses `bg-[#0F172A]` and `bg-[#0369A1]` — hardcoded hex that violates the design token rule.

- [ ] **Step 1: Replace hardcoded hex in `MobileNav.tsx`**

In `app/(public)/MobileNav.tsx`, replace:
```tsx
<div className="absolute top-16 left-0 right-0 bg-[#0F172A] border-t border-white/10 shadow-lg z-50 px-4 py-4 flex flex-col gap-1">
```
with:
```tsx
<div className="absolute top-16 left-0 right-0 bg-primary border-t border-white/10 shadow-lg z-50 px-4 py-4 flex flex-col gap-1">
```

Also replace:
```tsx
className="text-sm text-white bg-[#0369A1] hover:bg-[#0284C7] transition-colors px-3 py-2 rounded-md font-semibold mt-1"
```
with:
```tsx
className="text-sm text-white bg-accent hover:bg-accent/90 transition-colors px-3 py-2 rounded-md font-semibold mt-1"
```
(This pattern appears twice — once in the logged-in branch and once in the guest branch. Fix both.)

- [ ] **Step 2: Verify visually**

```bash
npm run dev
# Open http://localhost:3000 — hamburger menu should look identical to before
```

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/MobileNav.tsx
git commit -m "fix: replace hardcoded hex with design tokens in MobileNav"
```

---

## Task 2: Create CustomerBottomNav Component

**Files:**
- Create: `components/ui/CustomerBottomNav.tsx`

A sticky bottom navigation bar visible only on mobile (`md:hidden`). Shows: Home, Book Now (accent), My Bookings (when logged in), Account (when logged in). When the user is not logged in, shows: Home, Book Now, Sign In.

- [ ] **Step 1: Create `components/ui/CustomerBottomNav.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Wind, CalendarCheck, User, LogIn } from 'lucide-react'

interface Props {
  isLoggedIn: boolean
  isAdmin?: boolean
}

export function CustomerBottomNav({ isLoggedIn, isAdmin }: Props) {
  const pathname = usePathname()

  // Don't show bottom nav on admin pages or auth pages
  if (isAdmin) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border flex items-stretch h-16 safe-area-inset-bottom">
      <Link
        href="/"
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
          isActive('/') ? 'text-accent' : 'text-muted-foreground'
        }`}
      >
        <Home size={20} strokeWidth={isActive('/') ? 2.5 : 1.75} />
        <span>Home</span>
      </Link>

      <Link
        href={isLoggedIn ? '/book' : '/auth/login?redirect=/book'}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold bg-accent text-white"
      >
        <Wind size={20} strokeWidth={2} />
        <span>Book Now</span>
      </Link>

      {isLoggedIn ? (
        <>
          <Link
            href="/account/bookings"
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              isActive('/account/bookings') ? 'text-accent' : 'text-muted-foreground'
            }`}
          >
            <CalendarCheck size={20} strokeWidth={isActive('/account/bookings') ? 2.5 : 1.75} />
            <span>Bookings</span>
          </Link>
          <Link
            href="/account/settings"
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              isActive('/account/settings') ? 'text-accent' : 'text-muted-foreground'
            }`}
          >
            <User size={20} strokeWidth={isActive('/account/settings') ? 2.5 : 1.75} />
            <span>Account</span>
          </Link>
        </>
      ) : (
        <Link
          href="/auth/login"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
            isActive('/auth') ? 'text-accent' : 'text-muted-foreground'
          }`}
        >
          <LogIn size={20} strokeWidth={1.75} />
          <span>Sign In</span>
        </Link>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Add bottom padding to `app/globals.css` so page content doesn't hide behind the bar**

In `app/globals.css`, add inside the existing `:root` or at the end of the file:

```css
@media (max-width: 767px) {
  body {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

And in `app/(public)/layout.tsx` (next task), wrap `<main>` with `pb-16 md:pb-0` so content doesn't hide behind the bar.

- [ ] **Step 3: Commit**

```bash
git add components/ui/CustomerBottomNav.tsx app/globals.css
git commit -m "feat: create CustomerBottomNav for mobile"
```

---

## Task 3: Wire CustomerBottomNav into Public Layout

**Files:**
- Modify: `app/(public)/layout.tsx`

- [ ] **Step 1: Import and render `CustomerBottomNav` in public layout**

In `app/(public)/layout.tsx`:

```tsx
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
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <CustomerBottomNav isLoggedIn={!!user} isAdmin={isAdmin} />
      <footer className="bg-primary border-t border-white/10 text-slate-400 py-12 mt-auto">
        {/* ... existing footer content unchanged ... */}
      </footer>
    </>
  )
}
```

Keep the full footer content exactly as it was — only add the `pb-16 md:pb-0` to `<main>` and the `<CustomerBottomNav>` line above `<footer>`.

- [ ] **Step 2: Verify**

```bash
npm run dev
# At mobile width: bottom nav bar should appear with Home / Book Now / Bookings / Account
# At desktop: bottom nav should be hidden
```

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/layout.tsx
git commit -m "feat: wire CustomerBottomNav into public layout"
```

---

## Task 4: Create AdminBottomNav Component

**Files:**
- Create: `components/admin/AdminBottomNav.tsx`

Admin bottom nav shows 5 primary items on mobile. A "More" button opens an overlay sheet with the remaining items (Agenda, Availability, Schedule, Settings).

- [ ] **Step 1: Create `components/admin/AdminBottomNav.tsx`**

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarCheck, Users, FileText, Receipt,
  MoreHorizontal, CalendarRange, CalendarOff, MapPin, Settings, X
} from 'lucide-react'

const PRIMARY = [
  { href: '/admin',           label: 'Overview',   icon: LayoutDashboard },
  { href: '/admin/bookings',  label: 'Bookings',   icon: CalendarCheck },
  { href: '/admin/customers', label: 'Customers',  icon: Users },
  { href: '/admin/contracts', label: 'Contracts',  icon: FileText },
  { href: '/admin/invoices',  label: 'Invoices',   icon: Receipt },
]

const MORE = [
  { href: '/admin/agenda',       label: 'Agenda',       icon: CalendarRange },
  { href: '/admin/availability', label: 'Availability', icon: CalendarOff },
  { href: '/admin/schedule',     label: 'Schedule',     icon: MapPin },
  { href: '/admin/settings',     label: 'Settings',     icon: Settings },
]

export function AdminBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <>
      {/* Bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-primary border-t border-white/10 flex items-stretch h-16">
        {PRIMARY.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              isActive(href) ? 'text-white' : 'text-slate-400'
            }`}
          >
            <Icon size={18} strokeWidth={isActive(href) ? 2.5 : 1.75} />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-slate-400"
        >
          <MoreHorizontal size={18} strokeWidth={1.75} />
          <span className="text-[10px]">More</span>
        </button>
      </nav>

      {/* More overlay sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-primary rounded-t-2xl p-4 pb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-semibold text-sm">More</span>
              <button onClick={() => setMoreOpen(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MORE.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                    isActive(href) ? 'bg-white/20 text-white' : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Icon size={22} strokeWidth={1.75} />
                  <span className="text-xs">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/AdminBottomNav.tsx
git commit -m "feat: create AdminBottomNav for mobile"
```

---

## Task 5: Wire AdminBottomNav into Admin Layout

**Files:**
- Modify: `app/admin/layout.tsx`
- Modify: `components/admin/AdminNav.tsx`

- [ ] **Step 1: Hide `AdminNav` on mobile, show AdminBottomNav**

In `components/admin/AdminNav.tsx`, wrap the nav with `hidden md:flex`:

```tsx
export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-all duration-150 whitespace-nowrap ${
              isActive
                ? 'bg-white/15 text-white font-medium'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon size={14} strokeWidth={2} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Add `AdminBottomNav` and main padding to `app/admin/layout.tsx`**

```tsx
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
            <span className="text-slate-400 text-sm font-medium hidden sm:block">Admin</span>
          </div>
          <AdminNav />
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-300 px-3 py-1.5 rounded-md hover:bg-white/10 transition-all duration-150 shrink-0 hidden lg:block"
          >
            ← Site
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 pb-24 md:pb-8">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
# Admin pages at mobile: bottom bar with 5 items + More; top nav hidden
# Admin pages at desktop: top nav visible; bottom bar hidden
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx components/admin/AdminNav.tsx
git commit -m "feat: wire AdminBottomNav into admin layout, hide top nav on mobile"
```

---

## Task 6: SlotCalendar — Mobile Week-Strip View

**Files:**
- Modify: `components/booking/SlotCalendar.tsx`

Add a mobile-only week strip view (`md:hidden`) inside `SlotCalendar`. The existing month grid becomes `hidden md:block`. All selection state is shared between views.

The week strip shows:
- A header with `< Month Year >` navigation (same `prevMonth` / `nextMonth` — but also add `prevWeek` / `nextWeek` for week navigation)
- A row of 7 date buttons (Mon–Sun of `mobileWeekStart`)
- Below: if a date is selected, show its slot chips

- [ ] **Step 1: Add week navigation state to `SlotCalendar`**

At the top of the `SlotCalendar` function body, after the existing state declarations, add:

```tsx
// Mobile week strip state
const [mobileWeekStart, setMobileWeekStart] = useState<Date>(() => {
  const d = new Date()
  const dow = d.getDay() // 0=Sun
  d.setDate(d.getDate() - dow) // go to Sunday of current week
  return d
})

function prevWeek() {
  setMobileWeekStart(d => {
    const n = new Date(d)
    n.setDate(n.getDate() - 7)
    return n
  })
}
function nextWeek() {
  setMobileWeekStart(d => {
    const n = new Date(d)
    n.setDate(n.getDate() + 7)
    return n
  })
}

function getMobileWeekDays(): { date: string; label: string; dayName: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mobileWeekStart)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    return {
      date: dateStr,
      label: String(d.getDate()),
      dayName: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()],
    }
  })
}
```

- [ ] **Step 2: Add the mobile week-strip JSX**

In the `return (...)` of `SlotCalendar`, wrap the existing month grid with `hidden md:block`, then add a new `md:hidden` section before it. The full return becomes:

```tsx
return (
  <div className="space-y-4">
    {/* ── MOBILE WEEK STRIP (< md) ── */}
    <div className="md:hidden space-y-3">
      {/* Month + week navigation header */}
      <div className="flex items-center justify-between">
        <button onClick={prevWeek} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted text-primary">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-primary">{monthName}</span>
        <button onClick={nextWeek} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted text-primary">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Loading indicator */}
      {loading && <p className="text-xs text-muted-foreground text-center">Loading…</p>}

      {/* Max slots/dates warnings */}
      {totalSlots >= MAX_TOTAL_SLOTS && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Maximum {MAX_TOTAL_SLOTS} time slots selected.
        </p>
      )}

      {/* Week day buttons */}
      <div className="grid grid-cols-7 gap-1">
        {getMobileWeekDays().map(({ date, label, dayName }) => {
          const isSelected = value.some(e => e.date === date)
          const isFullyBlocked = isDayFullyBlocked(date)
          const isPast = date < todaySGT
          const isDisabled = isFullyBlocked || isPast
          const isToday = date === todaySGT

          return (
            <button
              key={date}
              disabled={isDisabled}
              onClick={() => !isDisabled && handleDateClick(date)}
              className={`flex flex-col items-center py-2 rounded-xl transition-colors ${
                isSelected
                  ? 'bg-accent text-white'
                  : isToday
                  ? 'ring-2 ring-accent/50 text-primary'
                  : isDisabled
                  ? 'text-muted-foreground opacity-40 cursor-not-allowed'
                  : 'text-primary hover:bg-muted'
              }`}
            >
              <span className="text-[10px] font-medium">{dayName}</span>
              <span className="text-sm font-bold">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Slot picker for active date */}
      {activeDate && (() => {
        const entry = value.find(e => e.date === activeDate)
        if (!entry) return null
        const dateLabel = new Date(activeDate + 'T00:00:00').toLocaleDateString('en-SG', {
          weekday: 'short', day: 'numeric', month: 'short'
        })
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">{dateLabel}</p>
              <button
                onClick={() => removeDate(activeDate)}
                className="text-xs text-slate-400 hover:text-red-500 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(SLOT_KEYS as TimeSlot[]).map(slot => {
                const state = getSlotState(activeDate, slot)
                const isChosen = entry.slots.includes(slot)
                return (
                  <button
                    key={slot}
                    disabled={state !== 'available' && !isChosen}
                    onClick={() => state === 'available' || isChosen ? toggleSlot(slot) : undefined}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-medium border transition-colors text-left ${
                      isChosen
                        ? 'bg-accent text-white border-accent'
                        : state === 'available'
                        ? 'bg-white text-primary border-border hover:border-accent'
                        : 'bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {SLOT_LABELS[slot]}
                    {state === 'booked' && <span className="ml-2 text-xs text-red-500">Booked</span>}
                    {state === 'blocked' && <span className="ml-2 text-xs text-slate-400">Blocked</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Selected dates summary */}
      {value.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Selected preferences:</p>
          {value.map((entry, i) => (
            <div key={entry.date} className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setActiveDate(entry.date)}
                className={`flex-1 text-left px-2 py-1 rounded-lg transition-colors ${
                  activeDate === entry.date ? 'bg-accent/10 text-accent font-medium' : 'text-primary hover:bg-muted'
                }`}
              >
                {i + 1}. {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}
                {entry.slots.length > 0 && ` · ${entry.slots.map(s => SLOT_LABELS[s]).join(', ')}`}
              </button>
              <button onClick={() => removeDate(entry.date)} className="text-slate-400 hover:text-red-500 p-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* ── DESKTOP MONTH GRID (≥ md) ── */}
    <div className="hidden md:block space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted text-primary">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-primary">{monthName}</span>
        <button onClick={nextMonth} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted text-primary">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {totalSlots >= MAX_TOTAL_SLOTS && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Maximum {MAX_TOTAL_SLOTS} time slots selected. You can still add more dates but no further slots.
        </p>
      )}
      {value.length >= MAX_DATES && totalSlots < MAX_TOTAL_SLOTS && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Maximum {MAX_DATES} date preferences reached.
        </p>
      )}

      {/* PASTE the existing grid, activeDate section, and selected dates section here exactly as they are in the current file */}
    </div>
  </div>
)
```

**Important:** The `{/* PASTE the existing grid... */}` comment must be replaced with the actual JSX. Read `components/booking/SlotCalendar.tsx` starting at the line that contains `<div className="grid grid-cols-7 gap-0.5 text-center">` through to the closing `</div>` of the entire existing return block (approximately lines 130–272). Paste that content verbatim inside the `hidden md:block` wrapper. The slot section below the grid (activeDateEntry chips and selected dates summary) should also be included in that block.

- [ ] **Step 3: Verify**

```bash
npm run dev
# At 375px: week strip renders, day buttons selectable, slot chips appear
# At 768px+: original month grid renders
```

- [ ] **Step 4: Commit**

```bash
git add components/booking/SlotCalendar.tsx
git commit -m "feat: add mobile week-strip view to SlotCalendar"
```

---

## Task 7: Admin Bookings — Map Bottom Sheet on Mobile

**Files:**
- Modify: `app/admin/bookings/AdminBookingsClient.tsx`

On `<md`, the map+sidebar split is replaced with: full-width card list + a floating "Map" button (bottom-right FAB) that opens the map in a fixed bottom sheet (50% height).

- [ ] **Step 1: Add mobile map sheet state**

In `AdminBookingsClient`, add this state after the existing `sidebarWidth` state:

```tsx
const [mapSheetOpen, setMapSheetOpen] = useState(false)
```

- [ ] **Step 2: Replace the map+drag+sidebar JSX block**

Find the existing `{/* Map + Drag handle + Sidebar */}` div and replace it entirely with:

```tsx
{/* ── DESKTOP: map + drag handle + sidebar (≥ md) ── */}
<div ref={containerRef} className="hidden md:flex flex-1 min-h-0">
  {/* Map */}
  <div className="flex-1 rounded-xl overflow-hidden border border-border min-w-0">
    <BookingsMap
      bookings={mapBookings}
      selected={selectedJobId ? new Set([selectedJobId]) : undefined}
      onPinClick={(id) => setSelectedJobId(prev => prev === id ? null : id)}
    />
  </div>
  {/* Drag handle */}
  <div
    onMouseDown={(e) => { isDragging.current = true; e.preventDefault() }}
    className="w-1.5 mx-1 cursor-col-resize bg-slate-200 hover:bg-accent transition-colors shrink-0 rounded-full self-stretch"
  />
  {/* Sidebar */}
  <div style={{ width: sidebarWidth }} className="flex flex-col gap-3 overflow-hidden shrink-0">
    {/* ── MAINTENANCE sidebar ── */}
    {activeTab === 'MAINTENANCE' && (
      <>
        <div className="space-y-2 shrink-0">
          <Input placeholder="Search customer…" value={maintSearch} onChange={e => setMaintSearch(e.target.value)} className="h-8 text-xs" />
          <div className="flex gap-1.5 items-center">
            <Input type="date" value={maintDateFrom} onChange={e => setMaintDateFrom(e.target.value)} className="h-8 text-xs flex-1" />
            {maintDateFrom && <button onClick={() => setMaintDateFrom('')} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">✕</button>}
          </div>
          <div className="flex gap-1">
            {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
              <button key={s} onClick={() => setMaintStatus(s)} className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${maintStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {maintenanceFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No maintenance bookings.</p> : maintenanceFiltered.map(b => (
            <div key={b.id} data-job-id={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} /></div>
          ))}
        </div>
      </>
    )}
    {activeTab === 'FAULT_REPAIR' && (
      <>
        <div className="space-y-2 shrink-0">
          <Input placeholder="Search customer…" value={frSearch} onChange={e => setFrSearch(e.target.value)} className="h-8 text-xs" />
          <div className="flex gap-1.5 items-center">
            <Input type="date" value={frDateFrom} onChange={e => setFrDateFrom(e.target.value)} className="h-8 text-xs flex-1" />
            {frDateFrom && <button onClick={() => setFrDateFrom('')} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">✕</button>}
          </div>
          <div className="flex gap-1">
            {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
              <button key={s} onClick={() => setFrStatus(s)} className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${frStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {faultRepairFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No fault repair bookings.</p> : faultRepairFiltered.map(b => (
            <div key={b.id} data-job-id={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} /></div>
          ))}
        </div>
      </>
    )}
    {activeTab === 'INSTALLATION' && (
      <>
        <div className="space-y-2 shrink-0">
          <Input placeholder="Search customer…" value={instSearch} onChange={e => setInstSearch(e.target.value)} className="h-8 text-xs" />
          <div className="flex gap-1.5 items-center">
            <Input type="date" value={instDateFrom} onChange={e => setInstDateFrom(e.target.value)} className="h-8 text-xs flex-1" />
            {instDateFrom && <button onClick={() => setInstDateFrom('')} className="text-xs text-slate-400 hover:text-slate-600 shrink-0">✕</button>}
          </div>
          <div className="flex gap-1">
            {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
              <button key={s} onClick={() => setInstStatus(s)} className={`flex-1 text-xs py-1 rounded-full border font-medium transition-colors ${instStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {installationFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No installation bookings.</p> : installationFiltered.map(b => (
            <div key={b.id} data-job-id={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} /></div>
          ))}
        </div>
      </>
    )}
    {activeTab === 'ALL' && (
      <>
        <div className="space-y-2 shrink-0">
          <Input placeholder="Search customer…" value={allSearch} onChange={e => setAllSearch(e.target.value)} className="h-8 text-xs" />
          <div className="flex gap-1">
            {STATUS_FILTERS.map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${statusFilter === f.id ? 'bg-accent text-white border-accent' : 'border-border text-slate-500 hover:bg-muted/40'}`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {allFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No bookings here.</p> : allFiltered.map(b => (
            <div key={b.id} data-job-id={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} /></div>
          ))}
        </div>
      </>
    )}
  </div>
</div>

{/* ── MOBILE: cards only (< md) ── */}
<div className="md:hidden flex flex-col gap-3 flex-1 overflow-y-auto">
  {activeTab === 'MAINTENANCE' && (
    <>
      <div className="space-y-2">
        <Input placeholder="Search customer…" value={maintSearch} onChange={e => setMaintSearch(e.target.value)} className="h-10 text-sm" />
        <div className="flex gap-1">
          {(['ALL', 'PENDING', 'APPROVED'] as const).map(s => (
            <button key={s} onClick={() => setMaintStatus(s)} className={`flex-1 text-xs py-2 rounded-full border font-medium transition-colors ${maintStatus === s ? 'bg-accent text-white border-accent' : 'border-border text-slate-500'}`}>{s}</button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {maintenanceFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No maintenance bookings.</p> : maintenanceFiltered.map(b => (
          <div key={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={selectedJobId === b.id} onCardClick={() => setSelectedJobId(b.id)} /></div>
        ))}
      </div>
    </>
  )}
  {activeTab === 'FAULT_REPAIR' && (
    <div className="space-y-3">
      {faultRepairFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No fault repair bookings.</p> : faultRepairFiltered.map(b => (
        <div key={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={false} onCardClick={() => setSelectedJobId(b.id)} /></div>
      ))}
    </div>
  )}
  {activeTab === 'INSTALLATION' && (
    <div className="space-y-3">
      {installationFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No installation bookings.</p> : installationFiltered.map(b => (
        <div key={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={false} onCardClick={() => setSelectedJobId(b.id)} /></div>
      ))}
    </div>
  )}
  {activeTab === 'ALL' && (
    <>
      <div className="flex gap-1">
        {STATUS_FILTERS.map(f => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-colors ${statusFilter === f.id ? 'bg-accent text-white border-accent' : 'border-border text-slate-500'}`}>{f.label}</button>
        ))}
      </div>
      <div className="space-y-3">
        {allFiltered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No bookings here.</p> : allFiltered.map(b => (
          <div key={b.id}><BookingCard booking={b} onUpdate={refresh} highlighted={false} onCardClick={() => setSelectedJobId(b.id)} /></div>
        ))}
      </div>
    </>
  )}
</div>

{/* ── MOBILE: floating Map FAB ── */}
<button
  onClick={() => setMapSheetOpen(true)}
  className="md:hidden fixed bottom-20 right-4 z-30 bg-accent text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-semibold"
>
  <MapPin size={16} />
  Map
</button>

{/* ── MOBILE: map bottom sheet ── */}
{mapSheetOpen && (
  <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
    <div className="absolute inset-0 bg-black/40" onClick={() => setMapSheetOpen(false)} />
    <div className="relative bg-white rounded-t-2xl" style={{ height: '50dvh' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm text-primary">Map View</span>
        <button onClick={() => setMapSheetOpen(false)} className="text-slate-400 p-1"><X size={18} /></button>
      </div>
      <div className="h-[calc(50dvh-3.5rem)]">
        <BookingsMap
          bookings={mapBookings}
          selected={selectedJobId ? new Set([selectedJobId]) : undefined}
          onPinClick={(id) => { setSelectedJobId(prev => prev === id ? null : id); setMapSheetOpen(false) }}
        />
      </div>
    </div>
  </div>
)}
```

Also add `MapPin` and `X` to the imports at the top of `AdminBookingsClient.tsx`:
```tsx
import { MapPin, X } from 'lucide-react'
```

- [ ] **Step 3: Verify**

```bash
npm run dev
# Mobile: cards list, floating Map button, bottom sheet opens with map
# Desktop: original split panel layout
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/bookings/AdminBookingsClient.tsx
git commit -m "feat: admin bookings map bottom sheet on mobile"
```

---

## Task 8: Dialog Improvements (max-h + sticky footer)

**Files:**
- Modify: `app/account/RescheduleDialog.tsx`
- Modify: `app/account/CancelDialog.tsx`

- [ ] **Step 1: Fix `RescheduleDialog` — add `max-h-[90dvh] overflow-y-auto`**

In `app/account/RescheduleDialog.tsx`, find the `DialogContent` element. Add `className="max-h-[90dvh] overflow-y-auto"`:

```tsx
<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
```

Also ensure the dialog footer (the Reschedule button) is inside the scrollable area — no changes needed if it's already inside `DialogContent`.

- [ ] **Step 2: Fix `CancelDialog`**

In `app/account/CancelDialog.tsx`, find the `DialogContent` element. Add:

```tsx
<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
```

- [ ] **Step 3: Commit**

```bash
git add app/account/RescheduleDialog.tsx app/account/CancelDialog.tsx
git commit -m "fix: dialogs max-h and overflow for mobile"
```

---

## Task 9: JobCompletionDialog — Mobile Fixes

**Files:**
- Modify: `components/admin/JobCompletionDialog.tsx`

Two changes:
1. Dialog content gets `max-h-[90dvh] overflow-y-auto`
2. AC details table collapses to stacked field pairs at `<md`

- [ ] **Step 1: Read current `JobCompletionDialog.tsx`**

Read the file to find: (a) the `DialogContent` element, (b) the AC details table structure.

- [ ] **Step 2: Add `max-h-[90dvh] overflow-y-auto` to `DialogContent`**

Find:
```tsx
<DialogContent className="...">
```
Add `max-h-[90dvh] overflow-y-auto` to its className. Keep all existing classes.

- [ ] **Step 3: Wrap AC table in responsive container**

Find the AC details `<table>` element. Wrap it with:

```tsx
{/* Desktop table */}
<div className="hidden md:block overflow-x-auto">
  <table className="...">
    {/* existing table content */}
  </table>
</div>

{/* Mobile stacked cards */}
<div className="md:hidden space-y-3">
  {acUnits.map((unit, i) => (
    <div key={i} className="border border-border rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Unit {i + 1}</p>
      {/* Brand */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted-foreground">Brand</span>
        {/* paste the brand select/input from the table cell */}
      </div>
      {/* Model (unit type) */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted-foreground">Model</span>
        {/* paste the model select/input from the table cell */}
      </div>
      {/* Location */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted-foreground">Location</span>
        {/* paste the location select/input from the table cell */}
      </div>
    </div>
  ))}
</div>
```

**Note:** After reading the file, replace the `{/* paste the ... */}` comments with the actual JSX from the corresponding table cells. The selects and inputs should be identical to the desktop version — only the layout changes.

- [ ] **Step 4: Commit**

```bash
git add components/admin/JobCompletionDialog.tsx
git commit -m "fix: JobCompletionDialog mobile layout and max-h"
```

---

## Task 10: Admin Data Tables — Card View on Mobile

**Files:**
- Modify: `app/admin/customers/page.tsx`
- Modify: `app/admin/contracts/page.tsx`
- Modify: `app/admin/invoices/page.tsx`

Each admin list page has a `<table>` that overflows at 375px. Wrap each table in `hidden md:block` and add a `md:hidden` card-stack alternative.

- [ ] **Step 1: Customers list — add mobile card view**

In `app/admin/customers/page.tsx`, find the `<table>` element. Wrap it:

```tsx
{/* Desktop table */}
<div className="hidden md:block overflow-x-auto">
  <table>...</table>
</div>

{/* Mobile card list */}
<div className="md:hidden space-y-3">
  {customers.map(c => (
    <div key={c.id} className="bg-white border border-border rounded-xl p-4 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
            {c.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.phone}</p>
          </div>
        </div>
        {c.has_active_contract && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Contract</span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span>{c.booking_count} bookings</span>
        <span>Total ${Number(c.total_paid ?? 0).toFixed(2)}</span>
      </div>
      <a href={`/admin/customers/${c.id}`} className="block text-xs text-accent font-medium pt-1">View →</a>
    </div>
  ))}
</div>
```

**Note:** The exact field names (`c.name`, `c.booking_count`, `c.total_paid`, `c.has_active_contract`) must match what the server component fetches. Read `app/admin/customers/page.tsx` first to confirm.

- [ ] **Step 2: Contracts list — add mobile card view**

In `app/admin/contracts/page.tsx`, wrap the contracts table in `hidden md:block`. Add `md:hidden` section below. Use `ContractCard` for the mobile view — it's already a card component:

```tsx
{/* Desktop table / grid (hide on mobile) */}
<div className="hidden md:block">
  {/* existing contracts list */}
</div>

{/* Mobile: ContractCard stack (already card-shaped — just ensure it's shown) */}
<div className="md:hidden space-y-3">
  {filteredContracts.map(c => (
    <ContractCard key={c.id} contract={c} />
  ))}
</div>
```

If the existing desktop view already uses `ContractCard`, check whether it's wrapped in a grid/table and if so move the card rendering to the mobile section.

- [ ] **Step 3: Invoices list — add mobile card view**

In `app/admin/invoices/page.tsx`, wrap the invoice table in `hidden md:block`. Add `md:hidden` section:

```tsx
{/* Desktop */}
<div className="hidden md:block">
  <table>...</table>
</div>

{/* Mobile */}
<div className="md:hidden space-y-3">
  {filteredInvoices.map(inv => (
    <div key={inv.id} className="bg-white border border-border rounded-xl p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">{inv.profiles?.name ?? '—'}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>{inv.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">{inv.profiles?.phone}</p>
      <p className="text-sm font-bold text-primary">${Number(inv.amount_sgd ?? 0).toFixed(2)}</p>
      {/* Include InvoiceRow mark-paid action if available */}
    </div>
  ))}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/customers/page.tsx app/admin/contracts/page.tsx app/admin/invoices/page.tsx
git commit -m "feat: mobile card views for admin list pages"
```

---

## Task 10b: Admin Filter Bars — Collapse on Mobile

**Files:**
- Modify: `app/admin/contracts/page.tsx`
- Modify: `app/admin/invoices/page.tsx`

Date-range inputs and text search fields are cramped at 375px. On mobile, hide the date filters behind a "Filters" toggle button. Status pill filters stay visible inline (they're compact enough).

- [ ] **Step 1: Add `filtersOpen` state and toggle to contracts page**

In `app/admin/contracts/page.tsx`, find where the filter bar is rendered (likely a `div` with multiple `Input[type="date"]` and a text search input). Add a `useState` for the filter panel:

```tsx
const [filtersOpen, setFiltersOpen] = useState(false)
```

Then replace the filter bar with:

```tsx
{/* Filter bar */}
<div className="space-y-2">
  {/* Search + filter toggle — always visible */}
  <div className="flex gap-2">
    <Input
      placeholder="Search name or phone…"
      value={search}
      onChange={e => setSearch(e.target.value)}
      className="flex-1 h-9 text-sm"
    />
    <button
      onClick={() => setFiltersOpen(o => !o)}
      className={`md:hidden flex items-center gap-1 px-3 h-9 rounded-lg border text-xs font-medium transition-colors ${
        filtersOpen ? 'bg-accent text-white border-accent' : 'border-border text-slate-500'
      }`}
    >
      <SlidersHorizontal size={13} />
      Filters
    </button>
  </div>

  {/* Date filters — always visible on desktop, toggle on mobile */}
  <div className={`${filtersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-2 flex-wrap`}>
    {/* paste the existing date-range inputs and status pills here */}
  </div>
</div>
```

Import `SlidersHorizontal` from `lucide-react`. Replace `{/* paste ... */}` with the actual filter inputs from the current contracts page.

- [ ] **Step 2: Apply same pattern to invoices page**

In `app/admin/invoices/page.tsx`, apply the same `filtersOpen` state + toggle button pattern. The structure is identical — `SlidersHorizontal` toggle hides/shows date filters on mobile.

- [ ] **Step 3: Commit**

```bash
git add app/admin/contracts/page.tsx app/admin/invoices/page.tsx
git commit -m "feat: collapsible filter bar on mobile for contracts and invoices"
```

---

## Task 11: Admin Agenda — Day-List View on Mobile

**Files:**
- Modify: `app/admin/agenda/page.tsx`

On `<md`, show one day at a time (the selected day) with all slots listed vertically. Add prev/next day navigation. At `md:` show the existing 7-column week grid.

- [ ] **Step 1: Add `selectedDay` state and day navigation**

In `app/admin/agenda/page.tsx`, inside the component, add:

```tsx
const [selectedDay, setSelectedDay] = useState<string>(weekDays[0]) // first day of current week

function prevDay() {
  setSelectedDay(d => {
    const nd = new Date(d + 'T00:00:00')
    nd.setDate(nd.getDate() - 1)
    return nd.toISOString().slice(0, 10)
  })
}
function nextDay() {
  setSelectedDay(d => {
    const nd = new Date(d + 'T00:00:00')
    nd.setDate(nd.getDate() + 1)
    return nd.toISOString().slice(0, 10)
  })
}
```

`weekDays` is the array of date strings for the current week — check the existing agenda code for how this is derived.

- [ ] **Step 2: Add mobile day-list JSX**

After the existing grid JSX (or wrapping it in `hidden md:block`), add:

```tsx
{/* Mobile day-list (< md) */}
<div className="md:hidden">
  {/* Day navigation */}
  <div className="flex items-center justify-between mb-4">
    <button onClick={prevDay} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted">
      <ChevronLeft className="w-5 h-5 text-primary" />
    </button>
    <div className="text-center">
      <p className="font-semibold text-primary text-sm">
        {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short' })}
      </p>
    </div>
    <button onClick={nextDay} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted">
      <ChevronRight className="w-5 h-5 text-primary" />
    </button>
  </div>

  {/* Slot rows for selected day */}
  <div className="space-y-2">
    {SLOT_KEYS.map(slot => {
      const bookingsForSlot = bookingsForDay(selectedDay, slot as TimeSlot) // use whatever accessor the existing code uses
      return (
        <div key={slot} className="border border-border rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">{SLOT_LABELS[slot as TimeSlot]}</p>
          {bookingsForSlot.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookings</p>
          ) : (
            <div className="space-y-1">
              {bookingsForSlot.map(b => (
                <a
                  key={b.id}
                  href="/admin/bookings"
                  className="block text-xs bg-accent/10 text-accent rounded-md px-2 py-1 font-medium truncate"
                >
                  {b.profiles?.name ?? 'Customer'}
                </a>
              ))}
            </div>
          )}
        </div>
      )
    })}
  </div>
</div>

{/* Desktop week grid (≥ md) — wrap existing grid */}
<div className="hidden md:block">
  {/* existing week grid JSX goes here */}
</div>
```

Import `ChevronLeft`, `ChevronRight` from `lucide-react` if not already imported.

- [ ] **Step 3: Commit**

```bash
git add app/admin/agenda/page.tsx
git commit -m "feat: admin agenda day-list view on mobile"
```

---

## Task 12: Admin Availability — Mobile-Friendly Calendar

**Files:**
- Modify: `app/admin/availability/page.tsx`

The availability page uses the same 7-column month grid as SlotCalendar. Apply the same `hidden md:block` / `md:hidden` pattern, but simpler (no slot selection state to share — just show a vertical slot list for the selected day).

- [ ] **Step 1: Wrap existing month grid in `hidden md:block`**

Find the main calendar grid `<div className="grid grid-cols-7 ...">` and wrap it:

```tsx
<div className="hidden md:block">
  {/* existing month grid */}
</div>
```

- [ ] **Step 2: Add mobile week strip**

Above the `hidden md:block` wrapper, add a mobile week strip using the same pattern as `SlotCalendar` Task 6, adapted for the availability context:

```tsx
<div className="md:hidden space-y-3">
  {/* Month navigation */}
  <div className="flex items-center justify-between">
    <button onClick={() => { setMonth(m => m === 1 ? 12 : m - 1); if (month === 1) setYear(y => y - 1) }}
      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted">
      <ChevronLeft className="w-4 h-4 text-primary" />
    </button>
    <span className="text-sm font-semibold text-primary">
      {new Date(year, month - 1, 1).toLocaleString('en-SG', { month: 'long', year: 'numeric' })}
    </span>
    <button onClick={() => { setMonth(m => m === 12 ? 1 : m + 1); if (month === 12) setYear(y => y + 1) }}
      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted">
      <ChevronRight className="w-4 h-4 text-primary" />
    </button>
  </div>

  {/* 7-day row for current week */}
  <div className="grid grid-cols-7 gap-1">
    {Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - d.getDay() + i)
      const dateStr = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
      const dayData = byDate[dateStr]
      const isBlocked = dayData?.blockedSlots.includes(null)
      return (
        <button
          key={dateStr}
          onClick={() => { setSelectedDate(dateStr); setDialogOpen(true) }}
          className={`flex flex-col items-center py-2 rounded-xl text-xs transition-colors ${
            isBlocked ? 'bg-red-100 text-red-700' : 'hover:bg-muted text-primary'
          }`}
        >
          <span className="text-[10px]">{['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]}</span>
          <span className="font-bold">{d.getDate()}</span>
          {dayData?.booked.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-0.5" />
          )}
        </button>
      )
    })}
  </div>

  <p className="text-xs text-muted-foreground text-center">Tap a day to manage blocked slots</p>
</div>
```

The existing block/unblock dialog (`dialogOpen`) already handles all slot management — no changes needed to the dialog itself.

- [ ] **Step 3: Commit**

```bash
git add app/admin/availability/page.tsx
git commit -m "feat: admin availability mobile-friendly week view"
```

---

## Task 13: Booking Wizard + Account Page Polish

**Files:**
- Modify: `components/booking/StepScheduleLocation.tsx`
- Modify: `components/booking/BookingWizard.tsx`
- Modify: `app/account/bookings/page.tsx`

- [ ] **Step 1: Fix Places Autocomplete overflow in `StepScheduleLocation.tsx`**

Find the Google Places Autocomplete input wrapper and ensure it has `w-full max-w-full overflow-hidden`:

```tsx
<div className="relative w-full max-w-full overflow-hidden">
  <input
    ref={inputRef}
    type="text"
    placeholder="Start typing your address…"
    className="w-full h-11 px-4 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
  />
</div>
```

Also ensure the `UnitLocationPicker` selects below it are `w-full`:
Find any `<Select>` inside `UnitLocationPicker.tsx` and confirm the trigger has `className="w-full"`. If not, add it.

- [ ] **Step 2: Fix booking wizard progress bar on small screens**

In `components/booking/BookingWizard.tsx`, find the connector line between steps:

```tsx
<div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 ...`} />
```

Change to:

```tsx
<div className={`w-8 sm:w-24 h-0.5 mx-1 sm:mx-2 mb-5 ...`} />
```

- [ ] **Step 3: Stack account booking action buttons on mobile**

In `app/account/bookings/page.tsx`, find where Reschedule and Cancel buttons are rendered inline. Wrap them with a responsive flex container:

```tsx
<div className="flex flex-col sm:flex-row gap-2 mt-3">
  {/* Reschedule button/dialog trigger */}
  {/* Cancel button/dialog trigger */}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add components/booking/StepScheduleLocation.tsx components/booking/BookingWizard.tsx app/account/bookings/page.tsx
git commit -m "fix: booking wizard overflow, step bar, and account booking button stacking"
```

---

## Task 14: Re-run Playwright Suite to Verify

- [ ] **Step 1: Run full Playwright suite**

```bash
npx playwright test --project=mobile-customer --project=tablet-customer --project=mobile-admin --project=tablet-admin
```

- [ ] **Step 2: Check for regressions**

All tests that passed in Plan 1's audit run should still pass. The overflow checks should now pass for pages that previously failed.

- [ ] **Step 3: Update findings doc with resolution status**

In `docs/superpowers/specs/2026-05-21-mobile-audit-findings.md`, mark each resolved issue with `✅ Fixed in Plan 2 Task N`.

- [ ] **Step 4: Final commit**

```bash
git add docs/superpowers/specs/2026-05-21-mobile-audit-findings.md
git commit -m "docs: mark resolved mobile issues after Phase 2 implementation"
```
