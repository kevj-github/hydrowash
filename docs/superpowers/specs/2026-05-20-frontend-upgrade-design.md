# Frontend Upgrade Design Spec
**Date:** 2026-05-20  
**Scope:** All public and customer-facing pages  
**Goal:** More visual appeal (photos, richer sections) + cleaner UX (spacing, hierarchy, interactions)  
**Constraint:** Keep existing navy (#0F172A) + blue (#0369A1) brand, Poppins + Open Sans fonts, Tailwind semantic tokens

---

## Design System

- **Pattern:** Trust & Authority + Conversion-Optimised
- **Colors:** Unchanged — existing CSS variables (`--primary`, `--accent`, `--background`, `--muted`, etc.)
- **Typography:** Unchanged — Poppins (`font-heading`) + Open Sans (body)
- **Icons:** Lucide only, consistent 2px stroke
- **Photos:** Unsplash stock photos (aircon technician, service work, interiors). Load via `next/image` with `width`/`height` set to prevent CLS. Use `priority` on hero image only.
- **Animations:** CSS only. Duration 150–300ms. `ease-out` for enter, `ease-in` for exit. Respect `prefers-reduced-motion`.
- **Touch targets:** Minimum 44px on all interactive elements.

---

## Page 1: Landing Page (`/`)

### Section order (revised)
1. Hero
2. Stat strip
3. Services
4. Why Choose Us *(new)*
5. Testimonials *(new)*
6. How It Works
7. CTA

### Hero
- Background: full-bleed Unsplash photo of an aircon technician at work, loaded via `next/image` with `fill` + `object-cover`, `priority={true}`.
- Dark overlay: `bg-primary/75` div on top of image.
- Dot-grid texture: retained, sits above overlay at `opacity-[0.06]`.
- Layout: unchanged (centered text, heading, subheading, CTA buttons).
- Hero photo Unsplash query: `"aircon technician singapore"` or `"hvac technician working"`.

### Stat strip
- Add a Lucide icon above each stat number (`CalendarCheck`, `Cpu`, `MapPin`).
- Increase number size to `text-4xl`.
- Subtle `animate-fade-up` on mount.

### Services section
- `ServiceCard` gets a photo banner at top: `<div className="relative h-40 w-full overflow-hidden rounded-t-xl">` with `next/image`.
- Photo sits above the existing icon + title + description.
- Photo queries per card: `"aircon maintenance cleaning"`, `"hvac fault repair"`, `"aircon installation"`.
- Cards become taller; `rounded-t-none` on the inner content area to join the photo flush.

### Why Choose Us *(new section)*
- Light background (`bg-white`).
- Desktop: two-column split — photo left (60%), feature list right (40%).
- Mobile: photo stacks above feature list.
- Photo: `"aircon technician professional singapore"` from Unsplash.
- Feature list: 4 items with Lucide icon + bold label + short description:
  1. `Zap` — Same-day availability — Book in the morning, we arrive the same day.
  2. `Cpu` — All makes & models — Mitsubishi, Daikin, Panasonic, Samsung, and more.
  3. `ShieldCheck` — Transparent pricing — Fixed rates, no hidden fees.
  4. `FileText` — 1-year maintenance contracts — Quarterly servicing, managed for you.

### Testimonials *(new section)*
- Muted background (`bg-muted`).
- 3 static quote cards in a 3-column grid (1 column mobile, 3 desktop).
- Each card: white background, rounded-xl, shadow-sm, star row (5 filled `Star` icons in amber), quote text, customer name, location tag (e.g. "Tampines, Singapore").
- Sample content (placeholder names/quotes — owner to replace with real reviews):
  - "Booked at 9am, technician arrived by noon. Chemical wash done perfectly. Highly recommend!" — Jason T., Jurong West
  - "Finally an aircon company with transparent pricing. No surprise charges at all." — Priya S., Bishan
  - "Signed up for the annual contract. Best decision — no more chasing for servicing dates." — Wei Liang C., Tampines

### How It Works
- Increase numbered circle size to `w-14 h-14`, bold `text-xl` number, accent background (`bg-accent text-white`).
- Connector line: thicker (`h-0.5`), accent-colored (`bg-accent/30`).
- Bolder step label (`font-semibold text-lg`), more vertical space between sections.

### CTA section
- Add a background photo behind the dark navy: Unsplash `"singapore apartment aircon"`, with `bg-primary/80` overlay.
- Layout unchanged.

---

## Page 2: Auth Pages (`/auth/login` + `/auth/register`)

### Left panel
- Replace solid dark navy with a full-bleed Unsplash photo: `"aircon technician working apartment"`.
- Overlay: `bg-primary/70` so the photo shows through but text remains legible.
- Existing left-panel content (logo, tagline) stays on top of the overlay.
- Mobile: left panel collapses to a top banner (existing behaviour), now shows the photo too.

### Right panel (form)
- Increase input height to `h-12` (44px minimum touch target).
- Labels move above inputs (already correct); increase `font-medium` weight on labels.
- Submit button: full-width, `py-3`, loading spinner during async — disable button while submitting.
- Add "Back to home" link below the form for easy escape.

---

## Page 3: Booking Wizard (`/book`)

### Progress bar
- Replace current step indicator with: numbered circles (`w-8 h-8`) connected by a horizontal line.
- Active step: `bg-accent text-white`. Completed step: `bg-accent/20 text-accent` with a `Check` icon replacing the number. Upcoming: `bg-muted text-muted-foreground`.
- Component: inline in `BookingWizard.tsx`, no separate file needed.

### Step cards
- Wrap each step's content in a `rounded-2xl border border-border bg-white shadow-sm p-6` card for visual containment.
- Increase vertical spacing between field groups from `gap-4` to `gap-6`.

### SlotCalendar
- Selected date: filled `bg-accent text-white rounded-full` (not just border).
- Today's date: subtle `ring-2 ring-accent/40` indicator.

### Submit button
- Full-width on mobile.
- Show `Loader2` spinner (Lucide, `animate-spin`) and disable on submit.

---

## Page 4: Account Pages (`/account/bookings`, `/account/contracts`)

### Summary strip (new, top of each page)
- `bg-white border-b border-border py-6`.
- `/account/bookings`: 2 stat chips — Total Bookings (`CalendarDays` icon) + Upcoming (`Clock` icon).
- `/account/contracts`: 2 stat chips — Active Contracts (`FileText` icon) + Next Service Due (`CalendarCheck` icon).
- Stats computed from the data already fetched by the page's server component.

### Booking / contract cards
- Increase card padding from `p-4` to `p-5`.
- Status badge: use `rounded-full` pill style with per-status color (existing logic, just pill-ified).
- Action buttons (Reschedule, Cancel, View PDF): right-aligned, visually separated by a `border-t border-border mt-4 pt-4` divider from the card body.

### Empty states
- Replace blank tables/lists with a centered block: Lucide icon (`CalendarOff` or `FileX`, `size={48}`, `text-muted-foreground`), heading "No bookings yet", short description, and a CTA link to `/book`.

---

## Unsplash Photo Strategy

All photos use `next/image` for optimisation. Query strings are suggestions; final URLs to be confirmed by searching `unsplash.com`.

| Location | Query | `next/image` props |
|---|---|---|
| Hero background | `hvac technician working` | `fill`, `object-cover`, `priority` |
| Service card — Maintenance | `aircon cleaning chemical wash` | `width={400} height={160}`, `object-cover` |
| Service card — Fault Repair | `hvac repair technician` | `width={400} height={160}`, `object-cover` |
| Service card — Installation | `aircon installation new unit` | `width={400} height={160}`, `object-cover` |
| Why Choose Us | `professional technician apartment` | `fill`, `object-cover` |
| CTA background | `singapore apartment interior` | `fill`, `object-cover` |
| Auth left panel | `aircon technician working` | `fill`, `object-cover` |

All non-hero images use `loading="lazy"` (Next.js default). Declare `width`/`height` or use `fill` + a sized parent to prevent CLS.

---

## Accessibility & Performance Checklist

- All `next/image` photo elements: descriptive `alt` text.
- Contrast: all text on photo overlays uses white on `bg-primary/70+` — meets 4.5:1.
- Touch targets: all buttons/links `min-h-[44px]`.
- Animations: wrapped in `@media (prefers-reduced-motion: no-preference)` in `globals.css`.
- No hardcoded hex values — semantic tokens only.
- No new Google Fonts CDN links — existing `next/font/google` setup.

---

---

## Page 5: Admin Panels (`/admin/*`)

### Goal
Cleaner UX and better data density — no photos. Focus on active states, visual hierarchy, and scannability.

### Navigation (`app/admin/layout.tsx`)
- Extract nav links into a `AdminNav` client component that uses `usePathname` to highlight the active link.
- Active link style: `bg-white/15 text-white font-medium rounded-md`.
- Add a Lucide icon beside each label: `LayoutDashboard` (Overview), `CalendarCheck` (Bookings), `Users` (Customers), `CalendarRange` (Agenda), `CalendarOff` (Availability), `FileText` (Contracts), `Receipt` (Invoices), `Settings` (Settings).

### Dashboard (`app/admin/page.tsx`)
- Stat cards: add icon in `bg-accent/10 text-accent` circle left-side, `border-l-4 border-accent` / `border-l-4 border-amber-400` left strip by stat type.
- Quick action cards: add `ArrowRight` icon; `group-hover:translate-x-1 transition-transform` on hover.
- Alert sections (Service Due / Expiring Contracts): replace full amber/red background with `bg-white border border-border border-l-4 border-l-amber-400` / `border-l-red-400` card style. Each row gets a `→` link to the relevant contract detail page.

### Bookings (`app/admin/bookings/page.tsx` + `components/admin/BookingCard.tsx`)
- Tab bar: active tab uses `border-b-2 border-accent text-accent font-semibold` underline — remove background highlight style.
- Filter chips: `rounded-full border` pill style; active chip: `bg-accent text-white border-accent`.
- `BookingCard`: add `border-l-4` left strip with status colour — amber (PENDING), green (APPROVED), slate (COMPLETED/REJECTED). Status badge: `rounded-full` pill.

### Contracts (`app/admin/contracts/page.tsx`) + Invoices (`app/admin/invoices/page.tsx`)
- Page title: add count badge — `<span className="text-muted-foreground font-normal text-base">· {count}</span>` next to heading.
- Filter chips: same pill style as bookings.
- List rows: `bg-white` / `bg-muted/40` alternating; `hover:bg-accent/5 transition-colors`.
- Status badges: `rounded-full` pill, consistent across both pages.

### Customers (`app/admin/customers/page.tsx`)
- Each row: avatar initial circle — `w-8 h-8 rounded-full bg-accent/10 text-accent font-semibold text-sm flex items-center justify-center` showing first letter of name.
- Row hover: `hover:bg-accent/5 cursor-pointer`; entire row links to customer detail.
- Active contract badge: `rounded-full bg-green-100 text-green-700 text-xs px-2 py-0.5`.

### Customer Detail (`app/admin/customers/[id]/page.tsx`)
- Profile card: larger avatar circle (`w-16 h-16`, `text-2xl`), name + phone + email grouped in a `bg-white rounded-xl border border-border p-6` card. `Total Paid` value in `text-accent font-bold text-2xl`.

### Agenda (`app/admin/agenda/page.tsx`)
- Booking chips in cells: `rounded-md bg-accent/10 text-accent text-xs px-2 py-0.5 font-medium`.
- Today's column header: `bg-accent/10 font-semibold text-accent rounded-t-md`.
- Slot row labels: `text-xs text-muted-foreground text-right pr-2`.

### Settings (`app/admin/settings/page.tsx`)
- Wrap each settings group (service types, depot, company info) in a `bg-white rounded-xl border border-border p-6 mb-6` card with a `font-heading font-semibold text-lg mb-4` heading.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `app/(public)/page.tsx` | Photo hero, stat icons, Why Choose Us, Testimonials, updated How It Works, photo CTA |
| `components/ui/service-card.tsx` | Add optional `photoSrc` + `photoAlt` props; render photo banner at top |
| `app/auth/login/page.tsx` | Left panel photo, form polish |
| `app/auth/register/page.tsx` | Left panel photo, form polish |
| `components/booking/BookingWizard.tsx` | New progress bar, step card wrapper |
| `components/booking/SlotCalendar.tsx` | Selected date style, today indicator |
| `app/account/bookings/page.tsx` | Summary strip, card polish, empty state |
| `app/account/contracts/page.tsx` | Summary strip, card polish, empty state |
| `app/globals.css` | Add `prefers-reduced-motion` guard if not already present |
| `app/admin/layout.tsx` + `components/admin/AdminNav.tsx` (new) | Extract nav to client component with active state + icons |
| `app/admin/page.tsx` | Stat card icons/strip, quick action hover, alert card style |
| `app/admin/bookings/page.tsx` | Underline tab bar, pill filter chips |
| `components/admin/BookingCard.tsx` | Left status strip, pill badge |
| `app/admin/contracts/page.tsx` | Count badge, pill chips, alternating rows |
| `app/admin/invoices/page.tsx` | Count badge, pill chips, alternating rows |
| `app/admin/customers/page.tsx` | Avatar initials, row hover, pill badges |
| `app/admin/customers/[id]/page.tsx` | Larger avatar, accent total paid |
| `app/admin/agenda/page.tsx` | Chip style, today column highlight, slot label style |
| `app/admin/settings/page.tsx` | Wrap sections in cards |
