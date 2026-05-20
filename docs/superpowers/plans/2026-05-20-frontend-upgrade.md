# Frontend Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all public, customer, auth, and admin pages with richer visuals (Unsplash photos), two new landing sections (Why Choose Us + Testimonials), cleaner UX (progress bar, summary strips, empty states), and polished admin panels (active nav, stat strips, pill chips, avatar initials).

**Architecture:** UI-only changes — no new API routes, no schema changes. Each task modifies specific files independently. Photos load via `next/image` with declared dimensions to prevent CLS. Admin nav extracted to a client component for active-state highlighting.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS (semantic tokens), shadcn/ui, Lucide React, `next/image`

**Spec:** `docs/superpowers/specs/2026-05-20-frontend-upgrade-design.md`

---

## Photo Reference

Before starting, pick Unsplash photo URLs for each slot. Go to `unsplash.com`, search the suggested query, click a photo, click "Download free" → copy the URL from the address bar and append `?auto=format&fit=crop&w=1920&q=80`.

| Constant | Suggested search | Used in |
|---|---|---|
| `PHOTO_HERO` | `hvac technician working` | Landing hero bg |
| `PHOTO_SERVICE_MAINTENANCE` | `aircon cleaning chemical wash` | Service card |
| `PHOTO_SERVICE_FAULT` | `hvac repair technician` | Service card |
| `PHOTO_SERVICE_INSTALL` | `aircon installation new unit` | Service card |
| `PHOTO_WHY_US` | `professional technician apartment` | Why Choose Us section |
| `PHOTO_CTA` | `singapore apartment interior` | CTA section bg |
| `PHOTO_AUTH` | `aircon technician working indoors` | Auth left panel |

All are `https://images.unsplash.com/photo-XXXXXXXX?auto=format&fit=crop&w=1920&q=80`.

---

## Task 1: Enable Unsplash images in Next.js config

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add Unsplash remote pattern**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build passes**

```bash
cd /root/project/hydrowash && npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully` (or similar, no errors)

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: allow Unsplash images in next/image"
```

---

## Task 2: Add `prefers-reduced-motion` guard to globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Wrap existing animation keyframes in a motion media query**

Find the `@keyframes fade-up` block (and any other `@keyframes` animations) in `app/globals.css`. Wrap the keyframe definitions and their utility classes inside a `@media (prefers-reduced-motion: no-preference)` block:

```css
@media (prefers-reduced-motion: no-preference) {
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .animate-fade-up          { animation: fade-up 0.5s ease-out both; }
  .animate-fade-up-delay-1  { animation: fade-up 0.5s ease-out 0.1s both; }
  .animate-fade-up-delay-2  { animation: fade-up 0.5s ease-out 0.2s both; }
  .animate-fade-up-delay-3  { animation: fade-up 0.5s ease-out 0.35s both; }
}
```

If the file already has these inside a media query, skip this step.

- [ ] **Step 2: Build to check no regressions**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: respect prefers-reduced-motion for fade-up animations"
```

---

## Task 3: ServiceCard — add optional photo banner

**Files:**
- Modify: `components/ui/service-card.tsx`

- [ ] **Step 1: Add `photoSrc` + `photoAlt` props and photo banner**

```tsx
// components/ui/service-card.tsx
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ServiceCardProps {
  icon: LucideIcon
  title: string
  description: string
  className?: string
  photoSrc?: string
  photoAlt?: string
}

export function ServiceCard({ icon: Icon, title, description, className, photoSrc, photoAlt }: ServiceCardProps) {
  return (
    <div className={cn(
      'group bg-white rounded-2xl border border-border overflow-hidden',
      'transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
      className
    )}>
      {photoSrc && (
        <div className="relative h-44 w-full overflow-hidden">
          <Image
            src={photoSrc}
            alt={photoAlt ?? title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      )}
      <div className="p-6">
        <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
          <Icon size={22} strokeWidth={1.75} />
        </div>
        <h3 className="font-heading font-semibold text-primary text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/service-card.tsx
git commit -m "feat: add optional photo banner to ServiceCard"
```

---

## Task 4: Landing page — hero photo + stat strip icons

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Add photo imports and constants at top of file**

Add after the existing imports in `app/(public)/page.tsx`:

```tsx
import Image from 'next/image'
import { Wind, Wrench, Zap, Package, ArrowRight, CalendarCheck, Cpu, MapPin, ShieldCheck, FileText } from 'lucide-react'

// Replace these with your chosen Unsplash URLs (see plan Photo Reference table)
const PHOTO_HERO = 'https://images.unsplash.com/photo-1621905251189-08b45249ec76?auto=format&fit=crop&w=1920&q=80'
const PHOTO_SERVICE_MAINTENANCE = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'
const PHOTO_SERVICE_FAULT = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=800&q=80'
const PHOTO_SERVICE_INSTALL = 'https://images.unsplash.com/photo-1581092921461-7031e4bfb83e?auto=format&fit=crop&w=800&q=80'
const PHOTO_WHY_US = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80'
const PHOTO_CTA = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1920&q=80'
```

- [ ] **Step 2: Update `services` array to include photo props**

```tsx
const services = [
  {
    icon: Wrench,
    title: 'General Maintenance',
    description: 'Regular servicing, chemical wash, and overhaul to keep your AC running at peak efficiency year-round.',
    photoSrc: PHOTO_SERVICE_MAINTENANCE,
    photoAlt: 'Aircon maintenance and cleaning',
  },
  {
    icon: Zap,
    title: 'Fault Repair',
    description: 'Fast diagnosis and repair for all aircon faults — from water leaks to no cooling. We come to you.',
    photoSrc: PHOTO_SERVICE_FAULT,
    photoAlt: 'Aircon fault repair technician',
  },
  {
    icon: Package,
    title: 'Installation',
    description: 'Professional installation of new AC units with proper setup, testing, and post-install support.',
    photoSrc: PHOTO_SERVICE_INSTALL,
    photoAlt: 'New aircon unit installation',
  },
]
```

- [ ] **Step 3: Replace hero `<section>` with photo background version**

Replace the existing hero `<section>` (lines starting with `{/* Hero — dark navy */}`) with:

```tsx
{/* Hero — photo background */}
<section className="relative overflow-hidden bg-primary text-white">
  {/* Background photo */}
  <div className="absolute inset-0">
    <Image
      src={PHOTO_HERO}
      alt="HydroWash aircon technician at work"
      fill
      className="object-cover"
      priority
    />
    <div className="absolute inset-0 bg-primary/75" />
  </div>
  {/* Dot grid texture */}
  <div
    className="absolute inset-0 opacity-[0.06]"
    style={{
      backgroundImage: 'radial-gradient(circle, #93C5FD 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }}
    aria-hidden
  />
  <div id="hero-sentinel" className="absolute top-0 left-0 w-px h-px" aria-hidden />

  <SectionInner className="relative py-24 sm:py-32 text-center">
    <div className="animate-fade-up inline-flex items-center gap-2 bg-white/10 text-sky-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
      <Wind size={12} />
      Trusted for 5 years across Singapore
    </div>
    <h1 className="animate-fade-up-delay-1 font-heading font-bold text-4xl sm:text-6xl lg:text-7xl leading-tight mb-6">
      Hydrowash home
      <br />
      <span className="text-sky-400">aircon solution.</span>
    </h1>
    <p className="animate-fade-up-delay-2 text-slate-300 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-10">
      5 years of expert aircon servicing — maintenance,
      fault repair, and installation across Singapore.
    </p>
    <div className="animate-fade-up-delay-3 flex flex-col sm:flex-row gap-3 justify-center">
      <Link
        href={bookHref}
        className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30 cursor-pointer"
      >
        Book a Service
        <ArrowRight size={16} />
      </Link>
      {!user && (
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 cursor-pointer"
        >
          Sign In
        </Link>
      )}
    </div>
  </SectionInner>
</section>
```

- [ ] **Step 4: Replace stat strip with icon version**

Replace the existing stat strip `<section>` with:

```tsx
{/* Stat strip */}
<section className="bg-white border-b border-border">
  <SectionInner className="py-8">
    <div className="grid grid-cols-3 gap-4 text-center">
      <div className="flex flex-col items-center gap-1">
        <CalendarCheck size={22} className="text-accent mb-1" strokeWidth={1.75} />
        <p className="font-heading font-bold text-3xl text-primary">5+</p>
        <p className="text-sm text-muted-foreground">Years in service</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Cpu size={22} className="text-accent mb-1" strokeWidth={1.75} />
        <p className="font-heading font-bold text-3xl text-primary">All</p>
        <p className="text-sm text-muted-foreground">AC makes &amp; models</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <MapPin size={22} className="text-accent mb-1" strokeWidth={1.75} />
        <p className="font-heading font-bold text-3xl text-primary">SG</p>
        <p className="text-sm text-muted-foreground">Island-wide coverage</p>
      </div>
    </div>
  </SectionInner>
</section>
```

- [ ] **Step 5: Update ServiceCard usage to pass photo props**

In the Services section map, update `ServiceCard` to spread all props:

```tsx
{services.map(s => (
  <ServiceCard
    key={s.title}
    icon={s.icon}
    title={s.title}
    description={s.description}
    photoSrc={s.photoSrc}
    photoAlt={s.photoAlt}
  />
))}
```

- [ ] **Step 6: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add app/\(public\)/page.tsx
git commit -m "feat: landing hero photo bg + stat strip icons + service card photos"
```

---

## Task 5: Landing page — Why Choose Us section (new)

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Add `whyFeatures` array constant near top of file (after `steps`)**

```tsx
const whyFeatures = [
  { icon: Zap,          label: 'Same-day availability',     desc: 'Book in the morning, we arrive the same day.' },
  { icon: Cpu,          label: 'All makes & models',         desc: 'Mitsubishi, Daikin, Panasonic, Samsung, and more.' },
  { icon: ShieldCheck,  label: 'Transparent pricing',        desc: 'Fixed rates, no hidden fees, ever.' },
  { icon: FileText,     label: '1-year maintenance contracts', desc: 'Quarterly servicing, fully managed for you.' },
]
```

- [ ] **Step 2: Insert Why Choose Us section after the Services section in the JSX**

Add the following between the Services `</Section>` closing tag and the How it works `<Section>`:

```tsx
{/* Why Choose Us */}
<Section className="bg-white py-20">
  <SectionInner>
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      {/* Photo */}
      <div className="relative h-80 lg:h-[440px] rounded-2xl overflow-hidden">
        <Image
          src={PHOTO_WHY_US}
          alt="Professional HydroWash technician"
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-primary/10 rounded-2xl" />
      </div>
      {/* Features */}
      <div>
        <SectionHeading
          label="Why choose us"
          title="Your AC in expert hands"
          subtitle="We've been keeping Singapore cool since 2019."
          align="left"
        />
        <ul className="space-y-5 mt-6">
          {whyFeatures.map(f => (
            <li key={f.label} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
                <f.icon size={18} strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-heading font-semibold text-primary text-base">{f.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </SectionInner>
</Section>
```

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/page.tsx
git commit -m "feat: add Why Choose Us section to landing page"
```

---

## Task 6: Landing page — Testimonials section + How It Works polish + CTA photo

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Add `testimonials` array constant near top of file**

```tsx
import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Jason T.',
    location: 'Jurong West',
    quote: 'Booked at 9am, technician arrived by noon. Chemical wash done perfectly. Highly recommend!',
  },
  {
    name: 'Priya S.',
    location: 'Bishan',
    quote: 'Finally an aircon company with transparent pricing. No surprise charges at all.',
  },
  {
    name: 'Wei Liang C.',
    location: 'Tampines',
    quote: 'Signed up for the annual contract. Best decision — no more chasing for servicing dates.',
  },
]
```

- [ ] **Step 2: Insert Testimonials section after Why Choose Us and before How It Works**

```tsx
{/* Testimonials */}
<Section className="bg-muted py-20">
  <SectionInner>
    <SectionHeading
      label="Reviews"
      title="What our customers say"
      subtitle="Real feedback from homeowners across Singapore."
    />
    <div className="grid sm:grid-cols-3 gap-6">
      {testimonials.map(t => (
        <div key={t.name} className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex gap-0.5 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
            ))}
          </div>
          <p className="text-sm text-foreground leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 text-accent font-semibold text-sm flex items-center justify-center shrink-0">
              {t.name[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.location}, Singapore</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </SectionInner>
</Section>
```

- [ ] **Step 3: Replace How It Works step items with larger circles**

Replace the existing How it works `<div className="flex flex-col sm:flex-row ...">` block:

```tsx
<div className="flex flex-col sm:flex-row items-center justify-center gap-0 max-w-2xl mx-auto">
  {steps.map((step, i) => (
    <div key={step.label} className="flex items-center">
      <div className="flex flex-col items-center text-center px-4">
        <div className="w-14 h-14 rounded-full bg-accent text-white font-heading font-bold text-xl flex items-center justify-center mb-3 shadow-md shadow-accent/20">
          {i + 1}
        </div>
        <p className="font-heading font-semibold text-primary text-base">{step.label}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-[140px]">{step.description}</p>
      </div>
      {i < steps.length - 1 && (
        <div className="hidden sm:block w-16 h-0.5 bg-accent/30 flex-shrink-0 mb-10" />
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 4: Add photo background to CTA section**

Replace the CTA `<Section className="bg-[#0F172A] py-20">` with:

```tsx
<Section className="relative py-20 overflow-hidden">
  <div className="absolute inset-0">
    <Image src={PHOTO_CTA} alt="" fill className="object-cover" aria-hidden />
    <div className="absolute inset-0 bg-primary/80" />
  </div>
  <SectionInner className="relative text-center">
    <SectionHeading
      label="Get started"
      title="Ready to book?"
      subtitle="Create an account in seconds and schedule your first service today."
      light
    />
    <Link
      href={bookHref}
      className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30 cursor-pointer"
    >
      Get Started
      <ArrowRight size={16} />
    </Link>
  </SectionInner>
</Section>
```

- [ ] **Step 5: Add `Star` to the Lucide import line at top of file**

The import line should now read:

```tsx
import { Wind, Wrench, Zap, Package, ArrowRight, CalendarCheck, Cpu, MapPin, ShieldCheck, FileText, Star } from 'lucide-react'
```

- [ ] **Step 6: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add app/\(public\)/page.tsx
git commit -m "feat: add testimonials, bigger how-it-works steps, photo CTA to landing page"
```

---

## Task 7: Auth pages — left panel photo

**Files:**
- Modify: `app/auth/login/page.tsx`
- Modify: `app/auth/register/page.tsx`

- [ ] **Step 1: Update login left panel to use photo**

In `app/auth/login/page.tsx`, add `import Image from 'next/image'` after the existing imports. Then replace the left panel `<div className="hidden md:flex md:w-2/5 bg-[#0F172A] ...">` with:

```tsx
{/* Left panel — photo */}
<div className="hidden md:flex md:w-2/5 flex-col items-center justify-center px-10 py-16 relative overflow-hidden">
  <Image
    src="https://images.unsplash.com/photo-1621905251189-08b45249ec76?auto=format&fit=crop&w=1200&q=80"
    alt="HydroWash aircon technician"
    fill
    className="object-cover"
    priority
  />
  <div className="absolute inset-0 bg-primary/70" />
  <div
    className="absolute inset-0 opacity-[0.05]"
    style={{
      backgroundImage: 'radial-gradient(circle, #93C5FD 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }}
    aria-hidden
  />
  <div className="relative text-center">
    <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
      <Wind size={28} className="text-sky-300" strokeWidth={1.75} />
    </div>
    <h1 className="font-heading font-bold text-3xl text-white mb-3">HydroWash</h1>
    <p className="text-slate-300 text-base leading-relaxed max-w-xs">
      Book aircon services online — just pick a date and we&apos;ll handle the rest.
    </p>
  </div>
</div>
```

Also add a "Back to home" link below the `<Suspense>` block in the right panel:

```tsx
<p className="text-xs text-center text-muted-foreground mt-6">
  <Link href="/" className="hover:underline cursor-pointer">← Back to home</Link>
</p>
```

- [ ] **Step 2: Apply the same photo panel to register page**

In `app/auth/register/page.tsx`, make the same changes to the left panel (photo + overlay + dot grid). The right-panel content differs (registration form) — only touch the left panel. Also add the "Back to home" link.

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add app/auth/login/page.tsx app/auth/register/page.tsx
git commit -m "feat: auth pages photo left panel + back to home link"
```

---

## Task 8: Booking wizard — progress bar redesign

**Files:**
- Modify: `components/booking/BookingWizard.tsx`

- [ ] **Step 1: Add `Check` to lucide imports and replace the step indicator**

In `BookingWizard.tsx`, add `import { Check } from 'lucide-react'` to the existing Lucide imports (or add a new import if there are none).

Find the current step indicator (it uses the `STEPS` array and `step` state — look for JSX that maps over `STEPS`). Replace it entirely with:

```tsx
{/* Progress bar */}
<div className="flex items-center justify-center mb-8">
  {STEPS.map((label, i) => (
    <div key={label} className="flex items-center">
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
          i < step
            ? 'bg-accent/20 text-accent'
            : i === step
            ? 'bg-accent text-white shadow-md shadow-accent/30'
            : 'bg-muted text-muted-foreground'
        }`}>
          {i < step ? <Check size={16} strokeWidth={2.5} /> : i + 1}
        </div>
        <span className={`text-xs mt-1.5 font-medium hidden sm:block ${i === step ? 'text-accent' : 'text-muted-foreground'}`}>
          {label}
        </span>
      </div>
      {i < STEPS.length - 1 && (
        <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors duration-200 ${i < step ? 'bg-accent' : 'bg-border'}`} />
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 2: Wrap each step's content in a card**

Find the section in `BookingWizard` JSX where each step's content is rendered (typically `{step === 0 && <StepServiceDetails ... />}` etc.). Wrap the entire step content area in:

```tsx
<div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
  {step === 0 && <StepServiceDetails ... />}
  {step === 1 && <StepScheduleLocation ... />}
  {step === 2 && <StepReview ... />}
</div>
```

- [ ] **Step 3: Make the submit button full-width with a loading spinner**

In `BookingWizard.tsx`, find the final step's submit button (in `StepReview` or at the bottom of the wizard). Ensure it uses:

```tsx
import { Loader2 } from 'lucide-react'

<Button
  type="submit"
  disabled={submitting}
  className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-semibold px-8 py-3 rounded-xl cursor-pointer disabled:opacity-70"
  onClick={handleSubmit}
>
  {submitting ? (
    <><Loader2 size={16} className="animate-spin mr-2" />Submitting…</>
  ) : (
    <>Confirm Booking <ArrowRight size={16} className="ml-2" /></>
  )}
</Button>
```

If `ArrowRight` isn't already imported in `BookingWizard.tsx`, add it to the Lucide import.

- [ ] **Step 4: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add components/booking/BookingWizard.tsx
git commit -m "feat: booking wizard numbered progress bar + step card + submit spinner"
```

---

## Task 9: SlotCalendar — selected date fill + today ring

**Files:**
- Modify: `components/booking/SlotCalendar.tsx`

- [ ] **Step 1: Update selected-date style**

In `SlotCalendar.tsx`, find where date cells are rendered (look for a `button` or `div` for each day that has conditional classes for `isSelected`). Update the selected date styling so selected dates use a filled background:

Find the class logic for selected dates (likely something like `border-accent` or `bg-accent/10`) and change to:

```tsx
// For a date that is selected (already in preferredDates list):
'bg-accent text-white font-semibold shadow-sm'

// For today's date (isToday check):
'ring-2 ring-accent/50 ring-offset-1'

// For a date that is neither selected nor today (default available):
'hover:bg-accent/10 hover:text-accent'
```

The exact variable names depend on the existing conditional logic. Read the component and apply these classes to the correct conditions.

- [ ] **Step 2: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add components/booking/SlotCalendar.tsx
git commit -m "feat: SlotCalendar filled selected-date style + today ring"
```

---

## Task 10: Account pages — summary strip + card polish + empty states

**Files:**
- Modify: `app/account/bookings/page.tsx`
- Modify: `app/account/contracts/page.tsx`

- [ ] **Step 1: Add summary strip to bookings page**

In `app/account/bookings/page.tsx`, add these imports:
```tsx
import { CalendarDays, Clock, CalendarOff } from 'lucide-react'
```

After fetching `bookings`, compute summary stats:
```tsx
const totalBookings = bookings?.length ?? 0
const upcomingBookings = bookings?.filter(b =>
  ['PENDING', 'APPROVED'].includes(b.status)
).length ?? 0
```

Add a summary strip before the page header `<div className="flex items-center justify-between mb-8">`:

```tsx
{/* Summary strip */}
<div className="flex gap-4 mb-6">
  <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-4 py-3">
    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
      <CalendarDays size={18} className="text-accent" strokeWidth={1.75} />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Total</p>
      <p className="font-heading font-bold text-lg text-primary leading-none">{totalBookings}</p>
    </div>
  </div>
  <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-4 py-3">
    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
      <Clock size={18} className="text-amber-500" strokeWidth={1.75} />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Upcoming</p>
      <p className="font-heading font-bold text-lg text-primary leading-none">{upcomingBookings}</p>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Replace empty state with illustrated block**

Replace the existing empty state:
```tsx
// OLD:
<div className="text-center py-20 text-muted-foreground">
  <p className="text-lg mb-2">No bookings yet</p>
  <Link href="/book" className="text-accent hover:underline text-sm cursor-pointer">
    Book your first service
  </Link>
</div>
```

With:
```tsx
<div className="text-center py-20">
  <CalendarOff size={48} className="text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
  <h3 className="font-heading font-semibold text-primary text-lg mb-1">No bookings yet</h3>
  <p className="text-muted-foreground text-sm mb-4">Schedule your first aircon service today.</p>
  <Link
    href="/book"
    className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer"
  >
    Book a Service
  </Link>
</div>
```

- [ ] **Step 3: Add status badge divider to booking cards**

In the booking card `canModify` actions block, add a top divider:

```tsx
{canModify(booking) && (
  <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
    <RescheduleDialog bookingId={booking.id} />
    <CancelDialog bookingId={booking.id} />
  </div>
)}
```

- [ ] **Step 4: Add summary strip + empty state to contracts page**

In `app/account/contracts/page.tsx`, import:
```tsx
import { FileText, CalendarCheck, FileX } from 'lucide-react'
```

After data is fetched (in the server component or after `AccountContractsClient` receives data), compute:
```tsx
const activeContracts = contracts?.filter(c => c.status === 'ACTIVE').length ?? 0
```

The contracts page delegates to `AccountContractsClient`. Pass `activeContracts` as a prop and render the summary strip at the top of `AccountContractsClient`. If the contracts list is empty, show:

```tsx
<div className="text-center py-20">
  <FileX size={48} className="text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
  <h3 className="font-heading font-semibold text-primary text-lg mb-1">No contracts yet</h3>
  <p className="text-muted-foreground text-sm mb-4">Contact us to set up a maintenance contract.</p>
</div>
```

- [ ] **Step 5: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add app/account/bookings/page.tsx app/account/contracts/page.tsx
git commit -m "feat: account pages summary strip, empty states, card action divider"
```

---

## Task 11: Admin — AdminNav client component with active states + icons

**Files:**
- Create: `components/admin/AdminNav.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Create `AdminNav.tsx`**

```tsx
// components/admin/AdminNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarCheck, Users, CalendarRange,
  CalendarOff, FileText, Receipt, Settings
} from 'lucide-react'

const navItems = [
  { href: '/admin',              label: 'Overview',     icon: LayoutDashboard },
  { href: '/admin/bookings',     label: 'Bookings',     icon: CalendarCheck },
  { href: '/admin/customers',    label: 'Customers',    icon: Users },
  { href: '/admin/agenda',       label: 'Agenda',       icon: CalendarRange },
  { href: '/admin/availability', label: 'Availability', icon: CalendarOff },
  { href: '/admin/contracts',    label: 'Contracts',    icon: FileText },
  { href: '/admin/invoices',     label: 'Invoices',     icon: Receipt },
  { href: '/admin/settings',     label: 'Settings',     icon: Settings },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
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

- [ ] **Step 2: Update `app/admin/layout.tsx` to use `AdminNav`**

Replace the inline `navItems` array and `nav` element with the new component:

```tsx
// app/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wind } from 'lucide-react'
import { AdminNav } from '@/components/admin/AdminNav'

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
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminNav.tsx app/admin/layout.tsx
git commit -m "feat: admin nav active states with icons via AdminNav client component"
```

---

## Task 12: Admin dashboard — stat card strip + alert card redesign

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Replace stat cards with icon+strip version**

In `app/admin/page.tsx`, update imports to add `ArrowRight`:

```tsx
import { CalendarCheck, ClipboardList, ArrowRight, AlertCircle, Clock } from 'lucide-react'
```

Replace the stat card render:

```tsx
{/* Stat cards */}
<div className="grid sm:grid-cols-2 gap-4 mb-6">
  {[
    { label: 'Pending Bookings', value: pendingRes.count ?? 0, href: '/admin/bookings', borderColor: 'border-l-amber-400', iconBg: 'bg-amber-50', iconColor: 'text-amber-500', Icon: Clock },
    { label: 'Approved Jobs Today', value: todayRes.count ?? 0, href: `/admin/schedule/${todayStr}`, borderColor: 'border-l-accent', iconBg: 'bg-accent/10', iconColor: 'text-accent', Icon: CalendarCheck },
  ].map(s => (
    <Link
      key={s.label}
      href={s.href}
      className={`group bg-white rounded-xl border border-border border-l-4 ${s.borderColor} p-5 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-4`}
    >
      <div className={`w-11 h-11 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
        <s.Icon size={20} className={s.iconColor} strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{s.label}</p>
        <p className="font-heading font-bold text-3xl text-primary leading-none mt-0.5">{s.value}</p>
      </div>
      <ArrowRight size={16} className="text-muted-foreground group-hover:translate-x-1 transition-transform duration-150" />
    </Link>
  ))}
</div>
```

- [ ] **Step 2: Add ArrowRight hover to quick action cards**

In the quick action cards, add `group-hover:translate-x-1 transition-transform duration-150` to the icon next to each heading:

```tsx
<div className="flex items-center gap-2 mb-2">
  <ClipboardList size={18} strokeWidth={1.75} />
  <h3 className="font-heading font-semibold text-lg">Manage Bookings</h3>
  <ArrowRight size={14} className="ml-auto opacity-60 group-hover:translate-x-1 transition-transform duration-150" />
</div>
```

Apply the same to the Route Optimiser card.

- [ ] **Step 3: Replace alert section styles**

Replace the amber full-background alert with a card style:

```tsx
{serviceDueRows.length > 0 && (
  <section className="bg-white border border-border border-l-4 border-l-amber-400 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-3">
      <AlertCircle size={16} className="text-amber-500" strokeWidth={2} />
      <h2 className="font-heading font-semibold text-primary">
        Service Due This Month ({serviceDueRows.length})
      </h2>
    </div>
    <ul className="space-y-2">
      {serviceDueRows.map((row: any) => (
        <li key={row.id} className="flex items-center justify-between text-sm">
          <span className="font-medium text-primary">{row.contract?.customer?.name ?? '—'}</span>
          <span className="text-muted-foreground">{row.due_date}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs">{row.contract?.num_units} unit(s)</span>
            <Link href={`/admin/contracts/${row.contract?.id}`} className="text-xs text-accent hover:underline cursor-pointer">View →</Link>
          </div>
        </li>
      ))}
    </ul>
  </section>
)}

{expiringContracts.length > 0 && (
  <section className="bg-white border border-border border-l-4 border-l-red-400 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-3">
      <AlertCircle size={16} className="text-red-500" strokeWidth={2} />
      <h2 className="font-heading font-semibold text-primary">
        Contracts Expiring Soon ({expiringContracts.length})
      </h2>
    </div>
    <ul className="space-y-2">
      {expiringContracts.map((c: any) => (
        <li key={c.id} className="flex items-center justify-between text-sm">
          <span className="font-medium text-primary">{c.customer?.name ?? '—'}</span>
          <span className="text-red-600 font-medium">Expires {c.end_date}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs">{c.num_units} unit(s)</span>
            <Link href={`/admin/contracts/${c.id}`} className="text-xs text-accent hover:underline cursor-pointer">View →</Link>
          </div>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 4: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: admin dashboard stat card strips + alert card style + arrow hovers"
```

---

## Task 13: Admin bookings — tab underline + pill filters + BookingCard status strip

**Files:**
- Modify: `app/admin/bookings/page.tsx` (or `AdminBookingsClient.tsx`)
- Modify: `components/admin/BookingCard.tsx`

- [ ] **Step 1: Update BookingCard with left status strip + pill badge**

In `components/admin/BookingCard.tsx`, add a `statusStrip` lookup and update the card wrapper:

```tsx
const statusStrip: Record<string, string> = {
  PENDING:   'border-l-amber-400',
  APPROVED:  'border-l-green-400',
  COMPLETED: 'border-l-slate-300',
  REJECTED:  'border-l-slate-300',
}

// In the return JSX, update the outer div:
<div
  className={`bg-white rounded-xl border border-l-4 p-4 transition-colors
    ${statusStrip[booking.status] ?? 'border-l-border'}
    ${highlighted ? 'border-accent bg-blue-50' : 'border-border'}
    ${onCardClick ? 'cursor-pointer' : ''}`}
  onClick={() => onCardClick?.()}
>
```

Status badges are already `rounded-full` — no change needed if they already use that class. If they use `rounded` instead of `rounded-full`, update to `rounded-full`.

- [ ] **Step 2: Update tab bar style in AdminBookingsClient**

In `app/admin/bookings/AdminBookingsClient.tsx` (or wherever tabs are rendered), find the active tab class. Replace background-highlight active style with underline style:

```tsx
// Active tab:
'border-b-2 border-accent text-accent font-semibold pb-2'

// Inactive tab:
'border-b-2 border-transparent text-muted-foreground hover:text-primary pb-2 transition-colors'
```

The tab bar container should have `border-b border-border` on the wrapping `div`.

- [ ] **Step 3: Update filter buttons to pill style**

Find filter toggle buttons (ALL/PENDING/APPROVED etc.) in `AdminBookingsClient.tsx`. Update their classes:

```tsx
// Active filter:
'rounded-full bg-accent text-white border border-accent text-xs font-medium px-3 py-1.5 cursor-pointer'

// Inactive filter:
'rounded-full border border-border text-muted-foreground hover:border-accent hover:text-accent text-xs font-medium px-3 py-1.5 transition-colors cursor-pointer'
```

- [ ] **Step 4: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/bookings/AdminBookingsClient.tsx components/admin/BookingCard.tsx
git commit -m "feat: admin bookings tab underline, pill filters, booking card status strip"
```

---

## Task 14: Admin contracts + invoices — count badge + alternating rows + pill chips

**Files:**
- Modify: `app/admin/contracts/page.tsx`
- Modify: `app/admin/invoices/page.tsx`

- [ ] **Step 1: Add count badge to contracts page heading**

In `app/admin/contracts/page.tsx`, find the `<h1>` or page title. Update to:

```tsx
<h1 className="font-heading font-bold text-2xl text-primary">
  Contracts
  <span className="text-muted-foreground font-normal text-lg ml-2">· {contracts?.length ?? 0}</span>
</h1>
```

- [ ] **Step 2: Add alternating row background to contract list rows**

In the contracts list, add `even:bg-muted/40 hover:bg-accent/5 transition-colors` to each row/card element. Wrap in a container that enables the alternating pattern:

```tsx
<div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
  {contracts.map((contract, i) => (
    <div
      key={contract.id}
      className={`p-4 transition-colors hover:bg-accent/5 ${i % 2 === 1 ? 'bg-muted/40' : 'bg-white'}`}
    >
      {/* existing contract row content */}
    </div>
  ))}
</div>
```

- [ ] **Step 3: Apply the same count badge + alternating rows to invoices page**

In `app/admin/invoices/page.tsx`, apply the same count badge pattern and alternating row pattern.

- [ ] **Step 4: Update status badge classes on both pages to `rounded-full`**

Search for status badge classes in both files. Ensure they use `rounded-full` (not `rounded` or `rounded-md`). Example for contracts:

```tsx
const contractStatusClass: Record<string, string> = {
  PENDING_REVIEW:    'bg-slate-100 text-slate-700',
  AWAITING_PAYMENT:  'bg-amber-100 text-amber-800',
  ACTIVE:            'bg-green-100 text-green-700',
  EXPIRED:           'bg-red-100 text-red-700',
  CANCELLED:         'bg-slate-100 text-slate-500',
}

// Badge usage:
<span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${contractStatusClass[c.status]}`}>
  {c.status.replace('_', ' ')}
</span>
```

- [ ] **Step 5: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add app/admin/contracts/page.tsx app/admin/invoices/page.tsx
git commit -m "feat: admin contracts + invoices count badges, alternating rows, pill badges"
```

---

## Task 15: Admin customers list + detail

**Files:**
- Modify: `app/admin/customers/page.tsx`
- Modify: `app/admin/customers/[id]/page.tsx`

- [ ] **Step 1: Add avatar initial circle to customers list**

In `app/admin/customers/page.tsx`, find where each customer row is rendered. Add an avatar before the name:

```tsx
<div className="flex items-center gap-3">
  <div className="w-8 h-8 rounded-full bg-accent/10 text-accent font-semibold text-sm flex items-center justify-center shrink-0 uppercase">
    {customer.name?.[0] ?? '?'}
  </div>
  <div>
    <p className="font-medium text-primary text-sm">{customer.name}</p>
    <p className="text-xs text-muted-foreground">{customer.phone}</p>
  </div>
</div>
```

- [ ] **Step 2: Make entire row clickable with hover state**

Wrap each customer row in a `<Link href={`/admin/customers/${customer.id}`}>` (or update the existing wrapper) and add:

```tsx
className="flex items-center ... hover:bg-accent/5 transition-colors cursor-pointer"
```

- [ ] **Step 3: Update active contract badge to pill style**

```tsx
<span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
  Active contract
</span>
```

- [ ] **Step 4: Update customer detail profile card**

In `app/admin/customers/[id]/page.tsx`, find the profile card section and update the avatar to be larger and Total Paid to be in accent colour:

```tsx
{/* Avatar */}
<div className="w-16 h-16 rounded-full bg-accent/10 text-accent font-bold text-2xl flex items-center justify-center uppercase shrink-0">
  {customer.name?.[0] ?? '?'}
</div>

{/* Total Paid value */}
<p className="font-heading font-bold text-2xl text-accent">
  S${totalPaid.toFixed(2)}
</p>
```

- [ ] **Step 5: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add app/admin/customers/page.tsx app/admin/customers/\[id\]/page.tsx
git commit -m "feat: admin customers avatar initials, row hover, accent total paid"
```

---

## Task 16: Admin agenda + settings polish

**Files:**
- Modify: `app/admin/agenda/page.tsx`
- Modify: `app/admin/settings/AdminSettingsClient.tsx`

- [ ] **Step 1: Update agenda booking chips**

In `app/admin/agenda/page.tsx`, find where booking chips are rendered in grid cells. Update the chip class:

```tsx
<Link
  href={`/admin/bookings`}
  className="block rounded-md bg-accent/10 text-accent text-xs px-2 py-0.5 font-medium hover:bg-accent/20 transition-colors truncate"
>
  {booking.customer?.name ?? '—'}
</Link>
```

- [ ] **Step 2: Highlight today's column header**

In the week column headers, find the header cell for each day. Add a check for today and apply accent styling:

```tsx
const isToday = dayStr === todayStr

<th className={`text-xs font-medium px-2 py-2 text-center rounded-t-md ${
  isToday ? 'bg-accent/10 text-accent font-semibold' : 'text-muted-foreground'
}`}>
  {/* day label */}
</th>
```

- [ ] **Step 3: Update slot row labels**

Find the slot row `<th>` or label cells and apply:

```tsx
className="text-xs text-muted-foreground text-right pr-3 py-2 whitespace-nowrap font-normal"
```

- [ ] **Step 4: Wrap settings sections in cards**

In `app/admin/settings/AdminSettingsClient.tsx`, find the three settings sections (service types, depot, company info). Wrap each in:

```tsx
<div className="bg-white rounded-xl border border-border p-6 mb-6">
  <h2 className="font-heading font-semibold text-lg text-primary mb-4">{sectionTitle}</h2>
  {/* existing section content */}
</div>
```

- [ ] **Step 5: Build to verify**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 6: Final full build + lint check**

```bash
npm run build && npm run lint 2>&1 | tail -20
```

Expected: no errors, lint warnings only for pre-existing issues.

- [ ] **Step 7: Commit**

```bash
git add app/admin/agenda/page.tsx app/admin/settings/AdminSettingsClient.tsx
git commit -m "feat: admin agenda chip style + today highlight + settings section cards"
```

---

## Summary

| Task | Scope | Files |
|---|---|---|
| 1 | Unsplash image config | `next.config.ts` |
| 2 | Reduced-motion guard | `app/globals.css` |
| 3 | ServiceCard photo prop | `components/ui/service-card.tsx` |
| 4 | Landing hero + stats | `app/(public)/page.tsx` |
| 5 | Landing Why Choose Us | `app/(public)/page.tsx` |
| 6 | Landing testimonials + How It Works + CTA | `app/(public)/page.tsx` |
| 7 | Auth photo panels | `app/auth/login/page.tsx`, `app/auth/register/page.tsx` |
| 8 | Booking progress bar | `components/booking/BookingWizard.tsx` |
| 9 | SlotCalendar styles | `components/booking/SlotCalendar.tsx` |
| 10 | Account summary strips + empty states | `app/account/bookings/page.tsx`, `app/account/contracts/page.tsx` |
| 11 | AdminNav client component | `components/admin/AdminNav.tsx`, `app/admin/layout.tsx` |
| 12 | Admin dashboard refresh | `app/admin/page.tsx` |
| 13 | Admin bookings tabs + chips + card strip | `AdminBookingsClient.tsx`, `BookingCard.tsx` |
| 14 | Contracts + invoices rows + badges | `app/admin/contracts/page.tsx`, `app/admin/invoices/page.tsx` |
| 15 | Customers avatars + detail | `app/admin/customers/page.tsx`, `app/admin/customers/[id]/page.tsx` |
| 16 | Agenda chips + settings cards | `app/admin/agenda/page.tsx`, `AdminSettingsClient.tsx` |
