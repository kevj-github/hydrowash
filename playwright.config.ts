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
