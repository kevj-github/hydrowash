import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
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
