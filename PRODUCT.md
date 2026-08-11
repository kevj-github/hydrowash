# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS + shadcn/ui, Supabase (Postgres/Auth/RLS). Existing codebase — not a choice made during this session.

## Users

- **Customers:** Singapore homeowners who need aircon servicing (maintenance, fault repair, or new installation). They book online, choosing among up to 5 preferred dates × 3 time slots, and manage bookings/contracts/invoices from an account area.
- **Admin (owner/operator):** manages bookings, approves/rejects requests, runs a route optimiser for technician scheduling, manages 1-year maintenance contracts and invoices. Out of scope for this redesign (public pages only).

## Product Purpose

Lets Singapore homeowners book residential aircon service (cleaning/chemical wash, fault repair, or new unit installation) entirely online, and keeps them serviced over time via 1-year maintenance contracts with quarterly reminders — so the customer never has to remember to re-book.

## Positioning

Reliability through proactive contracts, not just one-off booking convenience. The 1-year maintenance contract + quarterly service reminders mean Hydrowash keeps a customer's aircon serviced on schedule without the customer having to think about it again — a mechanism a purely transactional "book a slot" competitor doesn't offer.

## Operating Context

- Customers arrive from the public marketing/landing page, browse services, and go through a 3-step booking wizard (`(public)/book`).
- Three booking categories: MAINTENANCE (cleaning/chemical wash), FAULT_REPAIR (inspection first), INSTALLATION (new AC unit) — each with different approval flow but the same multi-date/multi-slot preference model.
- Logged-in customers see an account area (My Bookings, Contracts & Invoices, Settings) via the same public-shell navbar.
- Real logistics back this: route-optimised technician scheduling, work orders, PayNow QR invoicing — service is operationally real, not just marketing claims.

## Capabilities and Constraints

- Public surfaces in scope for this redesign: `(public)/page.tsx` (landing page), `(public)/PublicHeader.tsx` + `MobileNav.tsx` (nav shell), `(public)/book/page.tsx` (booking wizard), auth pages (login/register/reset) share the public shell.
- Admin dashboard and account-area *functionality* are out of scope — do not alter booking logic, RLS, API routes, or admin tooling.
- Time slots are a fixed enum (`S10_12` … `S19_21`) — cosmetic only, values are canonical and must not change.
- Existing shared primitives (`Section`, `SectionHeading`, `ServiceCard`, `StepItem` in `components/ui/`) may be restyled or replaced as part of the visual-world replacement, but must keep serving the same content/booking flow.

## Brand Commitments

- Name: Hydrowash. No pinned aesthetic, color, or typography commitment beyond what already exists in code — this session replaces the current navy/blue corporate look with a new visual world (user-confirmed: full visual world replacement, not refinement).
- Existing photography assets in repo root (`c1–c6.jpeg`, `d1–d3.jpeg`, `e1–e3.jpeg`, `f1–f3.jpeg`, `hero-check.jpeg`, `cta-photo.jpeg`, `why-us-photo.jpeg`, `candidate-hero*.jpeg`) are real product/service photos available for reuse.

## Evidence on Hand

- Real photography assets listed above (aircon units, technicians, service photos) — usable in the redesign.
- No testimonials, press, or case studies on hand; landing page previously removed a testimonials/reviews section (per CLAUDE.md file map) — do not reintroduce fabricated reviews.
- Existing design tokens and a documented design system (`design-system/hydrowash/MASTER.md`) describe the current (to-be-replaced) navy/blue system — treated as anti-reference evidence, not a constraint.

## Product Principles

1. Booking friction is the enemy — every public surface should visibly shorten the path from "I have a hot room" to a confirmed slot.
2. Reliability is the brand promise — the visual world should read as dependable and precise (real logistics, real technicians), not just decorative "clean tech."
3. Singapore heat/humidity context is real and usable creative material — the redesign can lean into that lived discomfort-to-relief narrative rather than generic SaaS abstraction.
4. Same functional truth, new expression — booking flow, categories, time slots, and account features must work identically after the redesign.

## Accessibility & Inclusion

No project-specific requirement beyond the existing checklist in `design-system/hydrowash/MASTER.md` (4.5:1 contrast minimum, visible focus states, `prefers-reduced-motion` respected). Carry these forward into the new visual world.
