import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 3,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
  },

  timeout: 60_000,

  projects: [
    // Auth setup — runs first (longer timeout for Clerk)
    { name: 'coach-setup', testMatch: /auth\/coach\.setup\.ts/, timeout: 90_000 },
    { name: 'client-setup', testMatch: /auth\/client\.setup\.ts/, timeout: 90_000 },

    // Public pages — no auth required
    {
      name: 'public',
      testMatch: /public-pages\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Auth flow tests (longer timeout for Clerk)
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      timeout: 90_000,
      use: { ...devices['Desktop Chrome'] },
    },

    // Coach dashboard — depends on coach auth
    {
      name: 'coach-dashboard',
      testMatch: /coach-dashboard\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/coach.json',
      },
      dependencies: ['coach-setup'],
    },

    // Client dashboard — depends on client auth
    {
      name: 'client-dashboard',
      testMatch: /client-dashboard\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/client.json',
      },
      dependencies: ['client-setup'],
    },

    // Booking flow — depends on client auth
    {
      name: 'booking',
      testMatch: /booking-flow\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/client.json',
      },
      dependencies: ['client-setup'],
    },

    // Messaging — depends on client auth
    {
      name: 'messaging',
      testMatch: /messaging\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/client.json',
      },
      dependencies: ['client-setup'],
    },

    // M6: Mobile responsive audit — coach pages
    {
      name: 'mobile-audit-coach',
      testMatch: /mobile-responsive-audit\.spec\.ts/,
      grep: /Coach/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/coach.json',
      },
      dependencies: ['coach-setup'],
    },

    // M6: Mobile responsive audit — client pages
    {
      name: 'mobile-audit-client',
      testMatch: /mobile-responsive-audit\.spec\.ts/,
      grep: /Client/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/client.json',
      },
      dependencies: ['client-setup'],
    },

    // G3: Mobile navigation drawer test
    {
      name: 'mobile-nav',
      testMatch: /mobile-nav-drawer\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
