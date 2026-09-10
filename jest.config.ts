import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // next/jest does not derive a moduleNameMapper entry for the "@/*" tsconfig
  // path on this setup (plain `import '@/...'` resolves via SWC's own alias
  // handling, but string-literal specifiers such as `jest.mock('@/...')` do
  // not go through that and fail to resolve without this). Route tests mock
  // `@/lib/supabase/server` and `@/lib/supabase/admin` by module path, so this
  // mapper is required for that pattern to work.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // `npx jest` used to report 36 failing suites that were not Jest tests at all:
  // e2e/ holds Playwright specs (run with `npx playwright test`), and
  // .claude/worktrees holds other checkouts of this same repo. Neither belongs
  // to the unit-test run.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '<rootDir>/.claude/worktrees/',
  ],
}

export default createJestConfig(config)
