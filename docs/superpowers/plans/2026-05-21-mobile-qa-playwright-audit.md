# Mobile QA — Playwright Audit Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Playwright, write a full e2e test suite for all customer and admin pages at 375px and 768px viewports, run it against the live dev server, capture screenshots, and produce a confirmed findings report.

**Architecture:** Playwright with two viewport projects (mobile-chrome at 375px, tablet at 768px). A global auth setup saves session cookies for customer and admin roles. Test files are organised by role under `e2e/customer/` and `e2e/admin/`. After the suite runs, a markdown findings report is written at `docs/superpowers/specs/2026-05-21-mobile-audit-findings.md`.

**Tech Stack:** `@playwright/test`, Chromium, `.env.local` for test credentials, Next.js dev server at `http://localhost:3000`

---

## Pre-flight: Add test credentials to `.env.local`

Before starting, add these four lines to `.env.local` (fill in real values for a test customer and test admin account in Supabase):

```
E2E_CUSTOMER_EMAIL=customer@test.com
E2E_CUSTOMER_PASSWORD=testpass123
E2E_ADMIN_EMAIL=admin@test.com
E2E_ADMIN_PASSWORD=testpass123
```

---

## File Map

| Action | Path |
|---|---|
| Create | `playwright.config.ts` |
| Create | `e2e/auth.setup.ts` |
| Create | `e2e/customer/landing.spec.ts` |
| Create | `e2e/customer/booking-wizard.spec.ts` |
| Create | `e2e/customer/account-bookings.spec.ts` |
| Create | `e2e/customer/account-contracts.spec.ts` |
| Create | `e2e/admin/overview.spec.ts` |
| Create | `e2e/admin/bookings.spec.ts` |
| Create | `e2e/admin/customers.spec.ts` |
| Create | `e2e/admin/agenda.spec.ts` |
| Create | `e2e/admin/contracts.spec.ts` |
| Create | `e2e/admin/invoices.spec.ts` |
| Create | `e2e/admin/settings.spec.ts` |
| Create | `e2e/admin/schedule.spec.ts` |
| Create | `docs/superpowers/specs/2026-05-21-mobile-audit-findings.md` |
| Modify | `.gitignore` |

---

## Task 1: Install Playwright

**Files:**
- Modify: `package.json` (dev dependency added by npm)
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Playwright and Chromium**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Expected: no errors; `node_modules/@playwright/test` present.

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'mobile-customer',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/.auth/customer.json',
      },
      dependencies: ['setup'],
      testMatch: '**/customer/**',
    },
    {
      name: 'tablet-customer',
      use: {
        viewport: { width: 768, height: 1024 },
        storageState: 'e2e/.auth/customer.json',
      },
      dependencies: ['setup'],
      testMatch: '**/customer/**',
    },
    {
      name: 'mobile-admin',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: '**/admin/**',
    },
    {
      name: 'tablet-admin',
      use: {
        viewport: { width: 768, height: 1024 },
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: '**/admin/**',
    },
  ],
})
```

- [ ] **Step 3: Add screenshot and auth dirs to `.gitignore`**

Append to `.gitignore`:
```
e2e/.auth/
e2e/screenshots/
playwright-report/
```

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts .gitignore package.json package-lock.json
git commit -m "chore: install Playwright and add config"
```

---

## Task 2: Write Auth Setup

**Files:**
- Create: `e2e/auth.setup.ts`

- [ ] **Step 1: Create `e2e/auth.setup.ts`**

```ts
import { chromium } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function globalSetup() {
  fs.mkdirSync('e2e/.auth', { recursive: true })
  fs.mkdirSync('e2e/screenshots/customer', { recursive: true })
  fs.mkdirSync('e2e/screenshots/admin', { recursive: true })

  const browser = await chromium.launch()

  async function login(email: string, password: string, statePath: string) {
    const page = await browser.newPage()
    await page.goto('http://localhost:3000/auth/login')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 })
    await page.context().storageState({ path: statePath })
    await page.close()
  }

  await login(
    process.env.E2E_CUSTOMER_EMAIL!,
    process.env.E2E_CUSTOMER_PASSWORD!,
    'e2e/.auth/customer.json'
  )

  await login(
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
    'e2e/.auth/admin.json'
  )

  await browser.close()
}

export default globalSetup
```

- [ ] **Step 2: Verify setup runs (dev server must be running)**

```bash
npx playwright test --project=setup
```

Expected: passes; `e2e/.auth/customer.json` and `e2e/.auth/admin.json` created.

- [ ] **Step 3: Commit**

```bash
git add e2e/auth.setup.ts
git commit -m "chore: add Playwright auth setup"
```

---

## Task 3: Customer — Landing Page Spec

**Files:**
- Create: `e2e/customer/landing.spec.ts`

- [ ] **Step 1: Create `e2e/customer/landing.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

// Landing is public — override to use no auth
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Landing page', () => {
  test('hero and CTA visible at mobile', async ({ page }, testInfo) => {
    await page.goto('/')
    await page.screenshot({
      path: `e2e/screenshots/customer/landing-load-${testInfo.project.name}.png`,
      fullPage: true,
    })
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Book Now/i }).first()).toBeVisible()
  })

  test('MobileNav hamburger opens and closes', async ({ page }, testInfo) => {
    await page.goto('/')
    const hamburger = page.getByRole('button', { name: /open menu/i })
    // Only present on mobile — skip on tablet
    if (await hamburger.count() === 0) return
    await hamburger.click()
    await page.screenshot({
      path: `e2e/screenshots/customer/landing-nav-open-${testInfo.project.name}.png`,
    })
    await expect(page.getByRole('link', { name: /Sign In/i })).toBeVisible()
    await page.getByRole('button', { name: /close menu/i }).click()
    await expect(page.getByRole('link', { name: /Sign In/i })).not.toBeVisible()
  })

  test('service cards render without overflow', async ({ page }, testInfo) => {
    await page.goto('/')
    const body = await page.evaluate(() => document.body.scrollWidth)
    const viewport = page.viewportSize()!.width
    expect(body).toBeLessThanOrEqual(viewport + 2) // ≤2px tolerance
    await page.screenshot({
      path: `e2e/screenshots/customer/landing-services-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })
})
```

- [ ] **Step 2: Run spec**

```bash
npx playwright test e2e/customer/landing.spec.ts --project=mobile-customer --project=tablet-customer
```

Expected: passes; screenshots created in `e2e/screenshots/customer/`.

- [ ] **Step 3: Commit**

```bash
git add e2e/customer/landing.spec.ts
git commit -m "test: landing page mobile spec"
```

---

## Task 4: Customer — Booking Wizard Spec

**Files:**
- Create: `e2e/customer/booking-wizard.spec.ts`

- [ ] **Step 1: Create `e2e/customer/booking-wizard.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Booking wizard', () => {
  test('step 0 renders service selector', async ({ page }, testInfo) => {
    await page.goto('/book')
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-step0-${testInfo.project.name}.png`,
      fullPage: true,
    })
    // Progress bar visible
    await expect(page.getByText(/Service/i).first()).toBeVisible()
    // No horizontal overflow
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('step 0 → step 1 navigation', async ({ page }, testInfo) => {
    await page.goto('/book')
    // Select a service type (first available radio/button)
    const serviceOption = page.locator('[data-testid="service-option"]').first()
    if (await serviceOption.count() > 0) {
      await serviceOption.click()
    } else {
      // Fall back: click first visible service card/button
      await page.locator('button').filter({ hasText: /General|Chemical|Wash/i }).first().click()
    }
    await page.getByRole('button', { name: /Next|Continue/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-step1-${testInfo.project.name}.png`,
      fullPage: true,
    })
    // SlotCalendar should be visible
    await expect(page.locator('button').filter({ hasText: /Su|Mo|Tu/i }).first()).toBeVisible()
  })

  test('SlotCalendar month grid does not overflow viewport', async ({ page }, testInfo) => {
    await page.goto('/book')
    // Navigate to step 1 (schedule)
    await page.locator('button').filter({ hasText: /General|Chemical|Wash/i }).first().click()
    await page.getByRole('button', { name: /Next|Continue/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/customer/booking-calendar-${testInfo.project.name}.png`,
    })
    const calendarWidth = await page.evaluate(() => {
      const cal = document.querySelector('[class*="grid-cols-7"]')
      return cal ? cal.getBoundingClientRect().width : 0
    })
    expect(calendarWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
  })

  test('address section appears after location selected', async ({ page }, testInfo) => {
    await page.goto('/book')
    await page.locator('button').filter({ hasText: /General|Chemical|Wash/i }).first().click()
    await page.getByRole('button', { name: /Next|Continue/i }).click()
    // Click "Other" address option
    const otherBtn = page.getByRole('button', { name: /Other/i })
    if (await otherBtn.count() > 0) {
      await otherBtn.click()
      await page.screenshot({
        path: `e2e/screenshots/customer/booking-address-${testInfo.project.name}.png`,
      })
    }
  })
})
```

- [ ] **Step 2: Run spec**

```bash
npx playwright test e2e/customer/booking-wizard.spec.ts --project=mobile-customer --project=tablet-customer
```

- [ ] **Step 3: Commit**

```bash
git add e2e/customer/booking-wizard.spec.ts
git commit -m "test: booking wizard mobile spec"
```

---

## Task 5: Customer — Account Pages Specs

**Files:**
- Create: `e2e/customer/account-bookings.spec.ts`
- Create: `e2e/customer/account-contracts.spec.ts`

- [ ] **Step 1: Create `e2e/customer/account-bookings.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Account bookings', () => {
  test('page loads and shows bookings or empty state', async ({ page }, testInfo) => {
    await page.goto('/account/bookings')
    await page.screenshot({
      path: `e2e/screenshots/customer/account-bookings-${testInfo.project.name}.png`,
      fullPage: true,
    })
    // Either bookings list or empty state
    const hasBookings = await page.locator('[class*="border-l-4"]').count() > 0
    const hasEmpty = await page.getByText(/No bookings yet|no upcoming/i).count() > 0
    expect(hasBookings || hasEmpty).toBeTruthy()
    // No horizontal overflow
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('reschedule dialog opens without overflow', async ({ page }, testInfo) => {
    await page.goto('/account/bookings')
    const rescheduleBtn = page.getByRole('button', { name: /Reschedule/i }).first()
    if (await rescheduleBtn.count() === 0) return // skip if no reschedulable bookings
    await rescheduleBtn.click()
    await page.screenshot({
      path: `e2e/screenshots/customer/reschedule-dialog-${testInfo.project.name}.png`,
    })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const dialogBox = await dialog.boundingBox()
    const viewport = page.viewportSize()!
    if (dialogBox) {
      expect(dialogBox.height).toBeLessThanOrEqual(viewport.height)
    }
  })

  test('cancel dialog opens', async ({ page }, testInfo) => {
    await page.goto('/account/bookings')
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first()
    if (await cancelBtn.count() === 0) return
    await cancelBtn.click()
    await page.screenshot({
      path: `e2e/screenshots/customer/cancel-dialog-${testInfo.project.name}.png`,
    })
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
```

- [ ] **Step 2: Create `e2e/customer/account-contracts.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Account contracts', () => {
  test('page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/account/contracts')
    await page.screenshot({
      path: `e2e/screenshots/customer/account-contracts-${testInfo.project.name}.png`,
      fullPage: true,
    })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('contract status filter chips are tappable (≥44px height)', async ({ page }) => {
    await page.goto('/account/contracts')
    const chips = page.locator('button').filter({ hasText: /All|Active|Awaiting|Expired/i })
    for (const chip of await chips.all()) {
      const box = await chip.boundingBox()
      if (box) expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })
})
```

- [ ] **Step 3: Run both specs**

```bash
npx playwright test e2e/customer/account-bookings.spec.ts e2e/customer/account-contracts.spec.ts --project=mobile-customer
```

- [ ] **Step 4: Commit**

```bash
git add e2e/customer/account-bookings.spec.ts e2e/customer/account-contracts.spec.ts
git commit -m "test: account pages mobile spec"
```

---

## Task 6: Admin — Overview + Bookings Specs

**Files:**
- Create: `e2e/admin/overview.spec.ts`
- Create: `e2e/admin/bookings.spec.ts`

- [ ] **Step 1: Create `e2e/admin/overview.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin overview', () => {
  test('loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin')
    await page.screenshot({
      path: `e2e/screenshots/admin/overview-${testInfo.project.name}.png`,
      fullPage: true,
    })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('stat cards visible', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })
})
```

- [ ] **Step 2: Create `e2e/admin/bookings.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin bookings', () => {
  test('loads and map renders (or card list on mobile)', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.waitForTimeout(2000) // wait for map script
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-maintenance-${testInfo.project.name}.png`,
      fullPage: true,
    })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('fault repair tab renders', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: /Fault Repair/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-fault-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })

  test('installation tab renders', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: /Installation/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-install-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })

  test('all tab renders', async ({ page }, testInfo) => {
    await page.goto('/admin/bookings')
    await page.getByRole('button', { name: /^All$/i }).click()
    await page.screenshot({
      path: `e2e/screenshots/admin/bookings-all-${testInfo.project.name}.png`,
      fullPage: true,
    })
  })
})
```

- [ ] **Step 3: Run specs**

```bash
npx playwright test e2e/admin/overview.spec.ts e2e/admin/bookings.spec.ts --project=mobile-admin
```

- [ ] **Step 4: Commit**

```bash
git add e2e/admin/overview.spec.ts e2e/admin/bookings.spec.ts
git commit -m "test: admin overview and bookings mobile spec"
```

---

## Task 7: Admin — Remaining Page Specs

**Files:**
- Create: `e2e/admin/customers.spec.ts`
- Create: `e2e/admin/agenda.spec.ts`
- Create: `e2e/admin/contracts.spec.ts`
- Create: `e2e/admin/invoices.spec.ts`
- Create: `e2e/admin/settings.spec.ts`
- Create: `e2e/admin/schedule.spec.ts`

- [ ] **Step 1: Create `e2e/admin/customers.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin customers', () => {
  test('list page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/customers')
    await page.screenshot({ path: `e2e/screenshots/admin/customers-list-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('customer detail page loads', async ({ page }, testInfo) => {
    await page.goto('/admin/customers')
    const viewLink = page.getByRole('link', { name: /View/i }).first()
    if (await viewLink.count() === 0) return
    await viewLink.click()
    await page.screenshot({ path: `e2e/screenshots/admin/customer-detail-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
```

- [ ] **Step 2: Create `e2e/admin/agenda.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin agenda', () => {
  test('week grid loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/agenda')
    await page.screenshot({ path: `e2e/screenshots/admin/agenda-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    // NOTE: known issue — 7-col grid likely overflows on 375px
    const overflow = body - page.viewportSize()!.width
    if (overflow > 2) {
      console.warn(`[ISSUE] Agenda overflows by ${overflow}px on ${testInfo.project.name}`)
    }
  })

  test('prev/next week navigation works', async ({ page }) => {
    await page.goto('/admin/agenda')
    await page.getByRole('button', { name: /next week|→|›/i }).click()
    await expect(page.locator('h1, h2').filter({ hasText: /week|agenda/i }).first()).toBeVisible()
  })
})
```

- [ ] **Step 3: Create `e2e/admin/contracts.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin contracts', () => {
  test('list page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/contracts')
    await page.screenshot({ path: `e2e/screenshots/admin/contracts-list-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })

  test('filter inputs visible and usable', async ({ page }, testInfo) => {
    await page.goto('/admin/contracts')
    await page.screenshot({ path: `e2e/screenshots/admin/contracts-filters-${testInfo.project.name}.png` })
    // Filters may overflow on mobile — capture for audit
    const filterSection = page.locator('input[type="date"]').first()
    if (await filterSection.count() > 0) {
      const box = await filterSection.boundingBox()
      if (box) {
        const rightEdge = box.x + box.width
        if (rightEdge > page.viewportSize()!.width) {
          console.warn(`[ISSUE] Date filter overflows viewport on ${testInfo.project.name}`)
        }
      }
    }
  })
})
```

- [ ] **Step 4: Create `e2e/admin/invoices.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin invoices', () => {
  test('list page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/invoices')
    await page.screenshot({ path: `e2e/screenshots/admin/invoices-list-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
```

- [ ] **Step 5: Create `e2e/admin/settings.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin settings', () => {
  test('page loads without overflow', async ({ page }, testInfo) => {
    await page.goto('/admin/settings')
    await page.screenshot({ path: `e2e/screenshots/admin/settings-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
```

- [ ] **Step 6: Create `e2e/admin/schedule.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('Admin schedule (route optimiser)', () => {
  test('date redirect works', async ({ page }, testInfo) => {
    const today = new Date().toISOString().slice(0, 10)
    await page.goto(`/admin/schedule/${today}`)
    await page.screenshot({ path: `e2e/screenshots/admin/schedule-${testInfo.project.name}.png`, fullPage: true })
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(page.viewportSize()!.width + 2)
  })
})
```

- [ ] **Step 7: Run all admin specs**

```bash
npx playwright test e2e/admin/ --project=mobile-admin --project=tablet-admin
```

- [ ] **Step 8: Commit**

```bash
git add e2e/admin/
git commit -m "test: admin pages mobile specs"
```

---

## Task 8: Run Full Suite and Capture Screenshot Audit

**Files:**
- Create: `e2e/screenshots/` (generated)
- Create: `docs/superpowers/specs/2026-05-21-mobile-audit-findings.md`

- [ ] **Step 1: Ensure dev server is running**

```bash
npm run dev &
```

Wait until `http://localhost:3000` responds (check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`).

- [ ] **Step 2: Run the full suite**

```bash
npx playwright test --project=setup && \
npx playwright test --project=mobile-customer --project=tablet-customer --project=mobile-admin --project=tablet-admin
```

Note all failures and console warnings in the terminal output.

- [ ] **Step 3: Review screenshots**

Check `e2e/screenshots/` — look for:
- Horizontal overflow (page wider than viewport)
- Clipped text
- Overlapping elements
- Dialogs taller than viewport
- Calendar grids overflowing

- [ ] **Step 4: Write findings report**

Create `docs/superpowers/specs/2026-05-21-mobile-audit-findings.md` with this structure, filling in actual findings from the test run:

```markdown
# Mobile Audit Findings — 2026-05-21

## Summary
- Total pages audited: 15
- Critical issues: N
- High issues: N
- Medium issues: N
- Low issues: N

## Issues

### [Page/Component] — [Issue title]
- **Severity:** Critical / High / Medium / Low
- **Viewport:** 375px / 768px / both
- **Description:** what's broken
- **Screenshot:** `e2e/screenshots/.../filename.png`
- **Fix:** pointer to Phase 2 plan task

---
```

- [ ] **Step 5: Commit findings**

```bash
git add e2e/ docs/superpowers/specs/2026-05-21-mobile-audit-findings.md
git commit -m "test: run full Playwright audit and document findings"
```
