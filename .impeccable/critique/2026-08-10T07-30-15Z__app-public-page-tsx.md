---
target: the public page
total_score: 13
max_score: 24
na_heuristics: 5,7,9,10
p0_count: 0
p1_count: 2
timestamp: 2026-08-10T07-30-15Z
slug: app-public-page-tsx
---
Method: dual-agent (A: a7d2eaf0775aefc0a · B: ac7a44a064a511ee9)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | No loading placeholder for below-fold photos; only real status feedback is the scroll-aware header transition. |
| 2 | Match System / Real World | 1/4 | "Same-day availability" likely overstates the actual admin-approval booking model; "5 years" (badge/hero/stat-strip) contradicts "since 2019" in Why Choose Us (7 years as of today, 2026-08-10) — the page's own trust claim doesn't agree with itself. |
| 3 | User Control and Freedom | 3/4 | Sign In / Book Now reachable from header, mobile bottom nav, and hamburger at all times; no dead ends observed. |
| 4 | Consistency and Standards | 2/4 | Three different labels for one action: "Book a Service" (hero), "Book Now" (header/bottom nav), "Get Started" (closing CTA) — confirmed in both desktop and mobile screenshots. |
| 5 | Error Prevention | n/a | No forms or user input exist on this static landing page. |
| 6 | Recognition Rather Than Recall | 3/4 | Icon + label pairing throughout (services, why-choose-us, process steps) keeps recall burden low. |
| 7 | Flexibility and Efficiency | n/a | Persuade-mode marketing page; no power-user path applies. |
| 8 | Aesthetic and Minimalist Design | 2/4 | The "5 years" claim is repeated three times (badge, hero subhead, stat strip) before any second distinct proof point appears — redundant emphasis, not reinforcement. |
| 9 | Error Recovery | n/a | No error states exist on this page to evaluate. |
| 10 | Help and Documentation | n/a | Not applicable to a marketing landing page. |
| **Total** | | **13/24** | **Acceptable (54%)** |

Four heuristics (5, 7, 9, 10) scored n/a — no forms, no power-user path, no error states, and help/documentation don't apply to a static Persuade-mode page. Renormalized band: 50%+ = Acceptable, 70%+ = Good. 13/24 sits just above the Acceptable floor.

## Design Specificity Verdict

**LLM assessment**: This page could be re-skinned as a plumber, pest-control, or cleaning company site in under ten minutes — swap "AC" for "pipes" and the hero, three ServiceCards, "Why Choose Us" list, and 3-step process would all still read naturally. Nothing on the page surfaces what PRODUCT.md itself calls the actual differentiator: the multi-date/multi-slot preference booking model, the route-optimized field operation, or the 1-year contract lifecycle with quarterly auto-scheduling. "Pick a date & slot" flattens a genuinely novel booking mechanic (5 dates × 3 slots, admin-resolved) into the same generic copy every home-services template uses. The Singapore signal is label-only ("SG," "across Singapore") with no HDB/condo-specific cues or visual motif that couldn't be swapped for another vertical's stock photos.

**Deterministic scan**: `detect.mjs` ran clean — 0 findings across `page.tsx`, `PublicHeader.tsx`, `MobileNav.tsx`, and the four shared UI primitives. No mechanical anti-pattern (hardcoded hex, emoji-as-icon, missing `cursor-pointer`, etc.) was flagged. `CustomerBottomNav.tsx` was not included in this scan pass — worth a follow-up run since it wasn't covered here.

**Visual evidence**: No `[Human]`-tab overlay was created this run — Assessment B used direct Playwright screenshots and console/network inspection instead of the detect.js browser injection flow. Console was clean (0 app errors/warnings; only dev-tooling HMR logs), all 32 network requests (fonts, JS, CSS, 4 optimized photos) returned 200/304, and computed contrast ratios all pass WCAG AA (worst case ≈5.5:1 on muted-foreground body copy against white cards, hero text against dark navy ≈13–20:1).

**Corrected finding**: Assessment A's design review flagged the fixed mobile bottom nav as clipping the stat-strip and other mid-page content. Assessment B's actual browser evidence (full-page and scroll-to-bottom screenshots, DOM coordinate check) does **not** confirm this — footer content renders fully visible above the nav with a clear gap. The only real overlap found was a Next.js dev-mode build-indicator toast sitting over the nav's Home tab, which is a dev-only artifact and won't exist in production. This finding is downgraded out of the priority list below; see Minor Observations for what to still verify.

## Overall Impression

Competent, clean, on-brand execution of a completely generic home-services template. Nothing is broken — no console errors, no failed requests, no contrast failures, and the scroll-aware header and mobile bottom nav are genuinely well-built micro-interactions. But the page does the minimum a booking-site template does and stops there: it doesn't argue for HydroWash specifically, and it contains a factual self-contradiction ("5 years" vs "since 2019") that undermines the one concrete trust claim PRODUCT.md confirms is real. The single biggest opportunity is turning the actual operational differentiators (multi-date/slot booking, route-optimized service, contract lifecycle) into landing-page proof instead of leaving them invisible below the API layer.

## What's Working

1. **Scroll-aware sticky header** (`PublicHeader.tsx`, IntersectionObserver off a hero sentinel) — smooth backdrop-blur transition on scroll rather than an instant snap, correctly following the design system's "no instant state changes" rule.
2. **Persistent mobile bottom nav with Book Now in accent color** — survives scroll position and stays thumb-reachable, a strong conversion path for a one-handed mobile visitor.
3. **Auth-aware CTA routing** (`bookHref = user ? '/book' : '/auth/login?redirect=/book'`) — correctly threads intent through login so a returning customer isn't dropped back to a blank state after signing in.

## Priority Issues

**[P1] "Same-day availability" claim may overstate the real booking mechanism**
- **Why it matters**: PRODUCT.md and the booking flow describe customers offering up to 5 preferred dates with admin-resolved conflicts — not an instant same-day guarantee. A visitor with a broken AC who takes this literally and doesn't get same-day service will feel misled at the worst possible moment.
- **Fix**: Confirm with the business whether same-day is a real, currently-honored SLA. If not, replace with an accurate urgency claim ("Fast response for urgent repairs") that the actual booking flow can deliver.
- **Suggested command**: `/impeccable clarify`

**[P1] "5 years" trust claim contradicts itself on the same page**
- **Why it matters**: The badge, hero subhead, and stat strip all say "5 years," but the Why Choose Us subtitle says "We've been keeping Singapore cool since 2019" — as of today (2026-08-10) that's 7 years, not 5. PRODUCT.md confirms "5 years" as a real, factual claim; this internal inconsistency turns a genuine trust asset into a spotted error for anyone who reads past the hero, and a stress-testing visitor (Riley) will notice immediately.
- **Fix**: Reconcile the two numbers — either update "since 2019" to the correct founding year, or update all "5 years" instances to the correct current tenure.
- **Suggested command**: `/impeccable clarify`

**[P2] Redundant CTA vocabulary for the single core action**
- **Why it matters**: "Book a Service" (hero), "Book Now" (header/mobile nav), and "Get Started" (closing CTA) are three different labels for the identical action, confirmed in both desktop and mobile screenshots. Nielsen's consistency heuristic: a first-time visitor has to re-verify each new label leads to the same place instead of pattern-matching once and trusting it everywhere.
- **Fix**: Standardize on one verb-first label (e.g., "Book a Service") across hero, header, mobile nav, and closing CTA.
- **Suggested command**: `/impeccable distill`

**[P2] Landing page copy carries no product-specific differentiation**
- **Why it matters**: The mechanics PRODUCT.md calls out as genuinely hard to copy — multi-date/slot preference booking, route-optimized field operations, the contract lifecycle — never surface in the page's copy or structure. Right now the page reads as interchangeable with any home-services competitor's template, which is a missed trust and conversion opportunity, not just a cosmetic gap.
- **Fix**: Reframe "How it works" (or add a module) to name the actual mechanic — e.g., "Offer up to 5 dates, we lock in the one that works" — turning an operational detail into a stated advantage.
- **Suggested command**: `/impeccable shape`

**[P3] Below-fold photos may flash an empty box before loading**
- **Why it matters**: Minor, but visible on slower mobile connections — exactly the scenario of someone checking a broken AC on their phone in the field.
- **Fix**: Add `placeholder="blur"`/`blurDataURL` or a skeleton matching the image aspect ratio for the below-fold `next/image` photos.
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Jordan (confused first-timer)**
- Clicks "Book a Service" with no idea whether that leads to a form, a call, or an account. Unauthenticated visitors land on `/auth/login?redirect=/book` with zero on-page warning that signup comes first.
- Has to reconcile three different CTA labels ("Book a Service," "Book Now," "Get Started") as the same action before trusting any of them.
- "Same-day availability" primes an expectation that "We confirm & arrive" (step 3 of How It Works) — implying a separate, later confirmation event — doesn't match.

**Casey (distracted mobile user)**
- Two overlapping navigation systems — the top-right hamburger and the fixed bottom tab bar — both offer Sign In and Book Now, more surface area to parse than a one-handed, in-a-hurry skim needs.
- Scanning quickly for "my AC broke, help," Casey finds Fault Repair visually identical in size and weight to Maintenance and Installation — nothing pulls the urgent case toward it faster than the calmer options.
- (Corrected from initial LLM read: the stat strip is *not* clipped by the fixed bottom nav in actual browser testing — that specific red flag doesn't hold up.)

## Minor Observations

- Hero photo is heavily overlaid (`bg-primary/75`) to the point of being unrecognizable as aircon-specific at a glance — could be any trade-services hero shot.
- "Why Choose Us" photo alt text ("Professional HydroWash technician") is accurate but the shot itself is a faceless, cropped hands-on-unit image — emotionally distant for a trust-building section.
- Footer service links (General Maintenance / Fault Repair / Installation) all route to the same generic `/book` rather than pre-selecting that category — a low-effort personalization opportunity.
- `CustomerBottomNav.tsx` wasn't included in this run's detector scan; worth a follow-up pass.
- Worth a manual keyboard-tab pass to confirm visible focus rings on hero/header links against the dark background — not verified this run.

## Questions to Consider

- If the multi-date/slot booking and route-optimized field operation are the things a competitor can't copy, why does none of that reach the landing page — is this a deliberate simplicity bet, or has marketing just never caught up with product?
- Is "Same-day availability" a real, currently-honored SLA, or copy that predates the admin-approval booking model — and who signs off on claims like this before they ship?
- Given a fixed bottom nav, a hamburger menu, and a sticky header CTA all point at overlapping destinations, was that layered for redundant discoverability on purpose, or did three navigation patterns accrete independently?
