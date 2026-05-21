import { defineConfig } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  globalSetup: './e2e/auth.setup',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    browserName: 'chromium',
  },
  projects: [
    {
      name: 'mobile-customer',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        storageState: 'e2e/.auth/customer.json',
      },
      testMatch: '**/customer/**',
    },
    {
      name: 'tablet-customer',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        storageState: 'e2e/.auth/customer.json',
      },
      testMatch: '**/customer/**',
    },
    {
      name: 'mobile-admin',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: '**/admin/**',
    },
    {
      name: 'tablet-admin',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: '**/admin/**',
    },
  ],
})
