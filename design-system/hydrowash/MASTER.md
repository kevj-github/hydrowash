# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** HydroWash
**Updated:** 2026-05-08
**Category:** Home Services / Aircon Booking

---

## Token Layer (Source of Truth)

Brand colors are now wired into shadcn CSS variables in `app/globals.css`. **Always use Tailwind semantic tokens** — never hardcode hex values.

| Token | Hex Equivalent | Tailwind Class |
|-------|---------------|----------------|
| `--primary` | `#0F172A` navy | `bg-primary`, `text-primary` |
| `--primary-foreground` | `#FFFFFF` | `text-primary-foreground` |
| `--accent` | `#0369A1` brand blue | `bg-accent`, `text-accent` |
| `--accent-foreground` | `#FFFFFF` | `text-accent-foreground` |
| `--background` | `#F8FAFC` | `bg-background` |
| `--foreground` | `#020617` | `text-foreground` |
| `--secondary` | `#334155` slate | `bg-secondary`, `text-secondary` |
| `--muted` | `#E8ECF1` | `bg-muted` |
| `--muted-foreground` | `#64748B` | `text-muted-foreground` |
| `--border` | `#E2E8F0` | `border-border` |
| `--ring` | `#0369A1` | (focus rings) |

### Typography

- **Heading Font:** Poppins → `font-heading` class or `h1–h6` tags
- **Body Font:** Open Sans → `font-body` class or default `body`
- Fonts loaded via `next/font/google` in `app/layout.tsx` — no Google Fonts CDN link needed

---

## Shared Primitive Components

Four layout primitives in `components/ui/`. Use these on all public pages for consistency.

### `Section` + `SectionInner`
```tsx
import { Section, SectionInner } from '@/components/ui/section'

<Section className="bg-white py-20">
  <SectionInner>
    {/* content — max-w-6xl, padded */}
  </SectionInner>
</Section>
```

### `SectionHeading`
```tsx
import { SectionHeading } from '@/components/ui/section-heading'

<SectionHeading
  label="Our Services"          // small uppercase label in accent color
  title="Everything your AC needs"
  subtitle="Optional subtext"
  align="center"                // "center" | "left"
  light                         // true for dark bg sections
/>
```

### `ServiceCard`
```tsx
import { ServiceCard } from '@/components/ui/service-card'
import { Wrench } from 'lucide-react'

<ServiceCard icon={Wrench} title="General Maintenance" description="..." />
```
- Hover: `shadow-lg` + `translateY(-4px)`, icon bg flips to accent
- Uses Lucide icons only — no emoji

### `StepItem`
```tsx
import { StepItem } from '@/components/ui/step-item'

<StepItem number={1} label="Choose your service" description="Optional sub-label" />
```

---

## Page Patterns

### Public Hero (dark)
```
bg-gradient-to-br from-[#0F172A] via-[#0C2340] to-[#0F172A]
+ dot-grid SVG texture (opacity-[0.06])
+ hero-sentinel div for scroll-aware navbar
```

### Content Section (light)
```
<Section className="bg-white py-20"> or bg-muted
```

### Auth Pages
Split-panel: dark navy left (40%) + white form right (60%). Mobile: left collapses to top banner.

---

## Animation Utilities

Defined in `globals.css`. Use on hero elements only:

| Class | Effect |
|-------|--------|
| `animate-fade-up` | Fade + slide up immediately |
| `animate-fade-up-delay-1` | 100ms delay |
| `animate-fade-up-delay-2` | 200ms delay |
| `animate-fade-up-delay-3` | 350ms delay |

All animations respect `prefers-reduced-motion`.

---

## Anti-Patterns (Do NOT Use)

- ❌ **Hardcoded hex values** — use `bg-accent`, `text-primary`, etc. instead of `#0369A1`, `#0F172A`
- ❌ **Emoji as icons** — use Lucide icons (`lucide-react`) exclusively
- ❌ **Missing `cursor-pointer`** — all clickable elements must have it
- ❌ **Layout-shifting hovers** — use `hover:-translate-y-1` not `hover:scale-105`
- ❌ **Low contrast text** — maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — always use `transition-all duration-200`
- ❌ **AI purple/pink gradients** — never

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No hardcoded hex colors — semantic tokens only
- [ ] No emoji used as icons
- [ ] All icons from `lucide-react`, consistent stroke width (`1.75` or `2`)
- [ ] `cursor-pointer` on all interactive elements (buttons, links, clickable divs)
- [ ] Hover states with `transition-all duration-200`
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected for animations
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
