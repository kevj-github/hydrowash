# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Customers** — homeowners in Singapore who need aircon servicing: routine maintenance/cleaning (`MAINTENANCE`), a fault fixed (`FAULT_REPAIR`, e.g. water leaks, no cooling), or a new unit installed (`INSTALLATION`). They book online, choosing up to 5 preferred dates with up to 3 time slots each, track bookings/contracts/invoices, and can reschedule or cancel (24h SGT cutoff).
- **Admin (owner/operator)** — runs the business day to day: approves/rejects bookings, resolves date/slot conflicts, runs the route optimiser for job scheduling, manages 1-year maintenance contracts and quarterly service reminders, tracks invoices manually, and completes jobs (checklist + AC details + pricing → work order PDF + PayNow QR to customer).
- **Field technicians** — carry out the jobs in the field. They do not currently have system logins; they work off admin-issued work orders. Multiple staff/technician logins are a planned future capability, not yet built — do not assume technician-facing UI exists.

## Product Purpose

HydroWash is the online booking and operations platform for a real, currently operating aircon servicing company in Singapore. It lets customers self-serve booking across three service categories and lets the owner run the operational side — approvals, route planning, contracts, invoicing — without manual back-and-forth. Success is a booking flow customers complete unassisted, and an admin workflow efficient enough for one owner-operator to run field operations (approvals, routing, contracts, invoicing) without added staff overhead.

## Positioning

A neighboring generic "book a service" template could not truthfully copy: the multi-date/multi-slot preference model (customer offers up to 5 dates × 3 slots, admin resolves conflicts and confirms one), the geographic clustering + nearest-neighbour route optimiser for the admin's field day, and the built-in 1-year maintenance contract lifecycle (quarterly auto-generated service dates, reminders, PayNow-based invoicing/PDF generation) — these are operational mechanisms specific to running a real home-services business, not just a booking form.

## Operating Context

- Singapore market: addresses use Google Places Autocomplete + reverse geocoding biased to `region=sg`; all scheduling and cutoff logic is SGT-aware.
- PayNow (Singapore QR payment standard) is the payment collection method for contracts and invoices — no card/online payment processor is integrated.
- Field operations are real and physical: the admin's route optimiser output plans an actual technician's driving day; job completion capture (AC brand/model, checklist, additional charges) documents real site visits.
- The business currently claims **5 years of operating history** — this is a factual, evidence-backed claim from a real operating business, not placeholder marketing copy.

## Capabilities and Constraints

- Two enforced roles today: `customer` and `admin`, via `profiles.role` + Supabase RLS. A third role (field technician login) is a planned-but-unbuilt capability — do not design as if it exists until product truth confirms scope.
- Three booking categories (`MAINTENANCE`, `FAULT_REPAIR`, `INSTALLATION`) each with category-specific admin review (map-based for maintenance, urgency-sorted for fault repair, spec review for installation).
- Manual invoice tracking — no automated payment reconciliation; admin marks invoices paid by hand.
- No live customer support channel (chat/phone-in-app) is part of the product today.

## Brand Commitments

- Name: **HydroWash**. Category: Home Services / Aircon Booking, Singapore.
- Visual identity and voice are governed separately by `design-system/hydrowash/MASTER.md` (navy `#0F172A` / accent blue `#0369A1`, Poppins headings + Open Sans body) — that file remains the design authority; this document does not restate or override it.
- "5 years of expert aircon servicing" is a standing, factual brand claim tied to the real business's operating history.

## Evidence on Hand

- No real customer testimonials, reviews, or ratings exist yet. The landing page's testimonials/reviews section was deliberately removed for this reason. **Future work must not fabricate testimonials, star ratings, or customer quotes** — this absence is confirmed, not an oversight to "fill in."
- Landing page photography is stock imagery (Unsplash, verified IDs pinned in `CLAUDE.md`) standing in for real jobsite photos — not documented as customer-specific evidence.
- No press, case studies, or third-party proof assets are on hand.

## Product Principles

1. **The booking flow must stay self-serve.** Customers should never need to call or email to get a slot; conflict resolution is the admin's job, not the customer's.
2. **One owner-operator runs the whole operation.** Every admin-facing workflow (approvals, routing, contracts, invoicing, job completion) is scoped to be manageable by a single person, not a back-office team — until technician logins are actually built.
3. **Don't fabricate social proof.** No testimonials, reviews, or claims beyond the confirmed 5-year operating history until real evidence is supplied.
4. **Singapore-specific by default.** Address handling, payment method (PayNow), and time-slot/cutoff logic should assume SGT and local conventions, not be genericized for other markets.
5. **Real field operations, not a toy scheduler.** The route optimiser and job completion flow reflect an actual technician's day — treat correctness and usability here as operationally load-bearing, not decorative.
