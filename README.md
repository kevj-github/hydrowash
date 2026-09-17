# HydroWash

Booking and operations platform for a real, operating aircon servicing company in Singapore. Customers self-serve bookings across three service categories; admins run approvals, route planning, contracts, and invoicing from one panel.

See [`PRODUCT.md`](./PRODUCT.md) for full product scope, roles, and constraints.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Supabase (Postgres, Auth, RLS)
- **UI:** Tailwind CSS, shadcn/ui, Base UI
- **Integrations:** Google Maps Platform (Places, Geocoding, Distance Matrix), Resend (email), React PDF (work orders), PayNow QR
- **Testing:** Jest + Testing Library (unit), Playwright (E2E)

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in Supabase, Google Maps, Resend, and cron secret values
npm run dev
```

App runs at `http://localhost:3000`.

### Required environment variables

See [`.env.example`](./.env.example) for the full list: Supabase project credentials, a Google Maps API key pair (client + server), a Resend API key, and a `CRON_SECRET` for securing `/api/cron/*` endpoints.

### Database

Schema and RLS policies live under [`supabase/migrations`](./supabase/migrations). Apply them with the Supabase CLI against your project.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Lint the codebase |
| `npx jest` | Run unit tests |
| `npx playwright test` | Run E2E tests (requires the dev server running and `.env.local` populated) |

## Project Structure

```
app/            Next.js routes — (public) marketing site, account, admin, auth, api
components/     Shared UI components
lib/            Domain logic: booking, contracts, customers, jobs, vrp (route optimiser),
                maps, pdf, email, supabase clients, hooks, types
supabase/       Database migrations
e2e/            Playwright end-to-end tests
docs/           Architecture, audits, and archived engineering records
design-system/  Brand and visual design authority
```

## Documentation

- [`PRODUCT.md`](./PRODUCT.md) — product scope, roles, positioning, constraints
- [`docs/archive/security`](./docs/archive/security) — security audit, remediation, and variant analysis records
- [`docs/archive/audits`](./docs/archive/audits) — UX audit findings
- [`design-system/`](./design-system) — brand and design guidelines
