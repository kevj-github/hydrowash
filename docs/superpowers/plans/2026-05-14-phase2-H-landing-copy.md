# Phase 2-H: Landing Page Copy Refresh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `app/(public)/page.tsx` with Hydrowash's new tagline, 5-year trust signal, and slot-based booking language, matching the roadmap's Phase 2 identity.

**Architecture:** Single-file edit to the landing page server component. All design-system tokens and shared primitives remain unchanged.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, shadcn/ui tokens, Lucide React, existing shared primitives (`Section`, `SectionInner`, `SectionHeading`, `ServiceCard`, `StepItem`).

---

### Task 1: Update hero trust label, headline, subheading, and steps

**Files:**
- Modify: `app/(public)/page.tsx` (full file rewrite of content only — layout/classes stay)

- [ ] **Step 1: Update the trust label badge**

Change line 58 from:
```tsx
Singapore&apos;s trusted aircon service
```
to:
```tsx
Trusted for 5 years across Singapore
```

- [ ] **Step 2: Replace the H1 headline**

Change lines 63-66 from:
```tsx
Book your aircon service
<br />
<span className="text-sky-400">online in minutes.</span>
```
to:
```tsx
Hydrowash home
<br />
<span className="text-sky-400">aircon solution.</span>
```

- [ ] **Step 3: Replace the subheading**

Change lines 69-72 from:
```tsx
Select a service, pick your preferred dates,
and we&apos;ll confirm a slot that works for you.
```
to:
```tsx
5 years of expert aircon servicing — maintenance,
fault repair, and installation across Singapore.
```

- [ ] **Step 4: Add a stat strip between the hero and the Services section**

Insert a new `<section>` block between the closing `</section>` of the hero (line 93) and the opening `{/* Services */}` comment (line 95):

```tsx
{/* Stat strip */}
<section className="bg-white border-b border-border">
  <SectionInner className="py-8">
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <p className="font-heading font-bold text-3xl text-primary">5+</p>
        <p className="text-sm text-muted-foreground mt-1">Years in service</p>
      </div>
      <div>
        <p className="font-heading font-bold text-3xl text-primary">All</p>
        <p className="text-sm text-muted-foreground mt-1">AC makes &amp; models</p>
      </div>
      <div>
        <p className="font-heading font-bold text-3xl text-primary">SG</p>
        <p className="text-sm text-muted-foreground mt-1">Island-wide coverage</p>
      </div>
    </div>
  </SectionInner>
</section>
```

- [ ] **Step 5: Update the "How it works" steps array**

Steps array currently says "Pick a date range" which no longer matches the slot model. Update lines 27-31 from:
```tsx
const steps = [
  { label: 'Choose your service', description: 'Select the type of job' },
  { label: 'Pick a date range', description: 'Tell us when works for you' },
  { label: 'We confirm & arrive', description: 'Admin books your slot' },
]
```
to:
```tsx
const steps = [
  { label: 'Choose your service', description: 'Select the type of job' },
  { label: 'Pick a date & slot', description: 'Choose a time that suits you' },
  { label: 'We confirm & arrive', description: 'Your booking is locked in' },
]
```

- [ ] **Step 6: Verify the page renders without errors**

Run:
```
npm run dev
```
Open `http://localhost:3000`. Confirm:
- Trust label reads "Trusted for 5 years across Singapore"
- H1 reads "Hydrowash home aircon solution."
- Subheading reads "5 years of expert aircon servicing..."
- Stat strip shows 5+, All, SG
- Steps show "Pick a date & slot"
- Mobile (resize to 375px): stat strip grid stacks cleanly, text not clipped

- [ ] **Step 7: Check for any hardcoded hex values that should use tokens**

Scan for any `#` literals introduced: the hero bg gradient (`from-[#0F172A]`, `via-[#0C2340]`, `to-[#0F172A]`) was already there pre-Phase 2H and is NOT from the stat strip — leave it. The stat strip only uses `bg-white`, `border-border`, `text-primary`, `text-muted-foreground` — all tokens. No new hex introduced. ✓

- [ ] **Step 8: Lint**

```
npm run lint
```
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add app/(public)/page.tsx
git commit -m "feat: Phase 2-H landing page copy refresh — new tagline + 5yr trust strip"
```

---

## Verification

| Check | Expected |
|-------|----------|
| `/` loads without error | ✓ |
| Trust badge | "Trusted for 5 years across Singapore" |
| H1 | "Hydrowash home aircon solution." |
| Subheading | 5-year + all-service mention |
| Stat strip | 5+, All, SG — visible on desktop and mobile |
| Step 2 | "Pick a date & slot" |
| `npm run lint` | No new errors |
| `npm run build` | No new type errors |
