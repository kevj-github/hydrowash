# Learning Map — HydroWash

This is a plain-language guide to how this codebase fits together, written for a
human trying to build a mental model of it — not an instruction file for an
agent (that's `CLAUDE.md`). Updated as we explore more of the codebase together.

## Overview

HydroWash is a Next.js 16 web app for a Singapore aircon-servicing company.
Customers book services online (maintenance, fault repair, or new installation);
the owner runs everything through an admin dashboard — approving bookings,
optimizing technician routes on a map, managing 1-year maintenance contracts,
and tracking invoices. Supabase is both the database and the auth system, with
per-row access rules enforced in the database itself (see RLS below), not just
in app code.

## Learning Checklist

What we've actually walked through together vs. what's still just a name in
the file map below. Only check something off once it's been deliberately
covered — not just brushed against while doing something else. Update this
whenever we go through a new area.

**Covered**
- [x] Testing infrastructure (Jest unit/integration + Playwright e2e) — how
      they differ, what each catches, how to run them
- [x] Hard-delete + audit-log pattern — why no soft-deletes, how
      `admin_audit_log` records every delete
- [x] Core TS/JS fundamentals that came up along the way — general, not
      hydrowash-specific, so they live in `~/.claude/learning-notes.md`
      instead (object shorthand, reference types, type assertions, `enum` vs
      union types, IIFEs)

**Touched, not walked through deliberately** — seen only as a side effect of
fixing e2e tests, not explained start-to-finish yet:
- [ ] Booking wizard (3-step flow: Service → Schedule & Location → Review) —
      saw `StepServiceDetails.tsx` / `UnitLocationPicker.tsx`
- [ ] Admin bookings dashboard (4 category tabs, map, bulk select/delete) —
      saw `AdminBookingsClient.tsx`'s tab structure

**Not yet covered**
- [ ] Route optimiser — the VRP (nearest-neighbour routing) algorithm in
      `lib/vrp/optimizer.ts`, how it turns approved bookings into a route
- [ ] Contract lifecycle — PENDING_REVIEW → AWAITING_PAYMENT → ACTIVE →
      EXPIRED/CANCELLED, and the quarterly service-date generation
- [ ] Invoice management — creation, linking to bookings/contracts, mark-paid
- [ ] Admin customer 360 view — `admin/customers/[id]`
- [ ] Auth & RLS in practice — how login/roles/middleware actually enforce
      who can see what (we've only covered *why* RLS exists, not *how* it's
      wired up here)
- [ ] Email system — Resend + React Email templates
- [ ] PDF generation — contracts & work orders via `@react-pdf/renderer`
- [ ] Deployment — Vercel cron jobs, multi-domain setup, the auth webhook
      signature verification

## Module map

```
app/
  (public)/        landing page + the 3-step booking wizard customers use
  account/         customer self-service (their bookings, contracts, settings)
  admin/           admin dashboard (bookings, contracts, invoices, customers,
                   route-optimizer, agenda, settings)
  api/              route handlers — the backend logic behind both the public
                    wizard and the admin dashboard (bookings, contracts,
                    invoices, geocoding, cron jobs, etc.)

components/
  booking/         the booking wizard's steps (service, schedule, review)
  admin/           admin-only UI (BookingCard, maps, delete-confirm modal…)
  account/         customer-side dialogs (reschedule, cancel)
  ui/               shared primitives (buttons, selects, cards) — shadcn/ui

lib/
  supabase/        3 different Supabase clients: browser, server, and a
                    service-role "admin" client that bypasses RLS (server-only)
  booking/slots.ts  pure functions — no DB, no network — for slot availability
                    and contract pricing math
  vrp/               the route-optimization algorithm (nearest-neighbour VRP)
  email/, pdf/       Resend email templates, React-PDF document generation

e2e/                Playwright end-to-end tests (real browser, real server)
**/__tests__/       Jest unit/integration tests (no browser, run in Node)
```

**How a booking flows through this**: customer fills the wizard in `app/(public)/book`
→ `POST /api/bookings` validates + inserts → admin sees it in `/admin/bookings`
(fed by the same `bookings` table, filtered by category tab) → admin approves,
picking a `confirmed_date`/`confirmed_slot` → customer sees it reflected in
`/account/bookings`.

## Key patterns & why

- **Multi-date slot model** — customers pick up to 3 preferred date+slot
  combinations, admin confirms exactly one. *Why*: real scheduling conflicts
  need a human to resolve, so the system doesn't try to auto-assign a single
  slot and hope it doesn't collide.
- **RLS (Row Level Security) everywhere** — access rules like "customers can
  only see their own bookings" live as Postgres policies on the table itself,
  not just as `if` checks in API routes. *Why*: a bug in one route's auth
  check can't leak cross-user data if the database itself refuses the query.
- **Service-role Supabase client is server-only** (`lib/supabase/admin.ts`) —
  it bypasses RLS entirely. *Why it's dangerous*: if this client's key ever
  reached the browser, any visitor could read/write any row in the database.
  It's only ever imported in server-side code (API routes, cron jobs).
- **Hard deletes, not soft deletes** — deleting a booking/contract/invoice/
  customer actually removes the row, no "is_deleted" flag. *Why it's still
  safe*: every delete is logged to `admin_audit_log` (who, what, when) before
  the row disappears, so there's a paper trail without every query needing to
  filter out soft-deleted rows.
- **Two independent test layers** — Jest (pure logic + mocked routes, no
  browser) and Playwright (real browser, real server, real database). *Why*:
  different speed/fidelity tradeoffs — Jest is fast enough to run on every
  save, Playwright is the only way to catch "the button doesn't actually
  render right on tablet" bugs, which is exactly what we hit and fixed in the
  e2e suite.

## Glossary

Hydrowash-specific terms only — things that wouldn't mean the same thing (or
anything at all) in a different codebase. General programming/testing/tooling
concepts that came up along the way (Playwright, Jest, mocks, type
assertions, `enum` vs union types, etc.) live in `~/.claude/learning-notes.md`
instead, since they're portable and apply to any project, not just this one.

*(Nothing hydrowash-specific has come up yet beyond what's already covered in
Key patterns & why above — this section fills in as we go.)*
