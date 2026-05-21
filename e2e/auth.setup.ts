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
    await page.waitForLoadState('networkidle') // wait for React hydration
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')
    // Next.js router.push is a client-side history navigation — fixed wait is reliable
    await page.waitForTimeout(6000)
    if (page.url().includes('/auth')) {
      throw new Error(`Login failed for ${email} — still on ${page.url()}`)
    }
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
