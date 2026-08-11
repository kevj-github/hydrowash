---
name: HydroWash — Feels-Like Board
description: Booking Hydrowash reads like Singapore's own heat-advisory board — near-black ground, amber-orange signal, resolving into relief.
colors:
  ink: "#1a1410"
  paper: "#f3ede1"
  paper-muted: "#e9dfc9"
  brown-muted: "#6b5a3f"
  near-black: "#17120d"
  signal-amber: "#ff6a2b"
  warning-yellow: "#ffb703"
  border-tan: "#ddd0b3"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.02em"
    textTransform: "uppercase"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontVariantNumeric: "tabular-nums"
  body:
    fontFamily: "Work Sans, sans-serif"
    fontWeight: 400
rounded:
  base: "0.3rem"
components:
  button-primary:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.near-black}"
    rounded: "{rounded.base}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.signal-amber}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.base}"
    padding: "14px 28px"
---

# Design System: HydroWash — Feels-Like Board

## Overview

**Creative North Star: "The Advisory Board"**

Booking an aircon service reads like checking Singapore's own heat-advisory display, not filling out a corporate SaaS form. The public surface (landing page, nav, booking wizard, auth) opens on a near-black instrument-panel ground with a huge tabular "Feels like 41°" readout, then resolves — through copy, color, and state — into a cool, confirmed booking. The mechanism is escalation and resolution: WATCH → WARNING → CONFIRMED, not "step 1 of 3."

This world replaces an earlier generic navy/corporate-blue booking-site look (`design-system/hydrowash/MASTER.md`, superseded). That system is anti-reference only — the category default this redesign refuses.

**Key characteristics:**
- Near-black "board" ground for hero/dark chrome, warm paper ground for reading sections — never the reverse.
- One committed signal color (amber-orange) carries CTAs, live-state dots, and active chips; warning-yellow is a secondary escalation tone used sparingly.
- Data and readouts (temperatures, codes, timestamps, nav labels) are set in tabular mono; headlines are condensed, bold, uppercase; body copy is a plain humanist sans.
- Low border-radius throughout (instrument-panel, not soft SaaS pills).
- No eyebrow/kicker labels above headings — the heading carries its own weight.
- Services present as an advisory-board row list (code + reading + photo), never a same-size icon-card grid.

## Colors

Near-black and warm paper are the two grounds; amber-orange is the one committed signal color running through CTAs, live dots, and active states.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#1a1410` | Body text on paper grounds |
| `paper` | `#f3ede1` | Light-section background |
| `paper-muted` | `#e9dfc9` | Alternate light-section background (Why Choose Us) |
| `brown-muted` | `#6b5a3f` | Secondary text on paper — tinted from the ink hue, never gray |
| `near-black` | `#17120d` | Nav, footer, hero "board" ground |
| `signal-amber` | `#ff6a2b` | CTAs, live-signal dot, active chips, ticker strip, links-on-dark |
| `warning-yellow` | `#ffb703` | Secondary escalation tone (e.g. "Warning" level chip) — used sparingly |
| `border-tan` | `#ddd0b3` | Hairline borders and rules on paper grounds |

All body/placeholder text on both grounds measures ≥4.5:1 contrast (verified: ink-on-paper 15.6:1, brown-muted-on-paper 5.7:1, near-black-on-amber 6.5:1, paper-on-near-black 16:1).

## Typography

- **Display** — Barlow Condensed, bold/extrabold, uppercase, tight tracking. Signage/transit register: section titles, service names, hero headline. Chosen for the advisory/departure-board world, not a default.
- **Data** — IBM Plex Mono, tabular numerals. Reserved for genuine data/measurement: the hero "Feels like 41°" readout, service codes (`M–01`), nav labels, level chips, timestamps. Never used as generic "technical" decoration elsewhere.
- **Body** — Work Sans, regular/medium. All paragraph copy, descriptions, form labels.

## Layout

- Public pages use `Section` / `SectionInner` (max-w-6xl, standard page padding) — unchanged container primitives.
- Section rhythm: py-20 to py-28 on desktop, generous vertical space between sections; more space above a heading than below it.
- Services render as a bordered row list (`ServiceCard`), not a card grid — each row is index code / icon+title+description / photo, full-width, divided by hairline rules.
- "How it resolves" renders as 3 escalation-level chips (`StepItem`) with connecting arrows, not numbered circles.
- Mobile: ticker strip hides below `sm`; bottom tab bar (`CustomerBottomNav`) remains fixed; header collapses to hamburger (`MobileNav`).

## Elevation & Depth

Flat by design — the board metaphor has no drop shadows or glass. Depth comes from ground-color contrast (near-black vs. warm paper) and the amber signal color, not shadows. The one exception: `shadow-xl shadow-black/20` on the sticky header when scrolled, purely to separate it from scrolling content.

## Shapes

Low, consistent radius (`--radius: 0.3rem` inside `.hw-world`) — instrument-panel, not soft SaaS pills. Circular treatment is reserved for the live-signal dot and the booking-wizard step badges (numeral only, not a full ring).

## Components

- **Buttons**: solid amber (`bg-accent`) with near-black text for primary actions; bordered/transparent for secondary, on the appropriate ground. Bold weight, low radius, `hover:-translate-y-0.5`.
- **ServiceCard** (advisory row): mono index code, icon + condensed uppercase title + body description, photo thumbnail (grayscale, colorizes on hover) — not an icon-card.
- **StepItem** (escalation chip): a small uppercase mono chip naming the level (Watch/Warning/Confirmed) above a condensed headline and description.
- **SectionHeading**: no eyebrow/kicker. Condensed uppercase title, optional body subtitle. `light` variant for dark grounds.
- **Reveal**: scroll-triggered fade+rise (`hw-reveal` / IntersectionObserver, `rootMargin: -5%`), one moment per element, `prefers-reduced-motion` disables it entirely (content stays visible).
- **PublicHeader**: two-tier — amber ticker strip (factual, real product claims only) over a near-black nav bar with a pulsing live-signal dot.

## Do's and Don'ts

**Do**
- Use `font-data` (mono) only for genuine data: numerals, codes, timestamps, nav labels.
- Keep the amber signal color to CTAs, live indicators, and active/confirmed states — it's the "signal," not a general accent.
- Scope all of this to `.hw-world` (public routes + auth pages). Admin and account-area chrome are untouched.

**Don't**
- Don't reintroduce eyebrow/kicker labels above headings.
- Don't render services as same-size icon+heading+text cards — use the advisory-row pattern.
- Don't use emoji or Unicode glyphs as icons — Lucide only.
- Don't hardcode hex colors in components — use the semantic tokens above.
