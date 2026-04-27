import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'cp ./docker/meilisearch/.env.example ./docker/meilisearch/.env && cp ./src/directus/.env.example ./src/directus/.env && cp ./src/frontend/.env.example ./src/frontend/.env && cp docker/db/.env.example docker/db/.env && chmod 777 ./src/directus/.env ./src/frontend/.env docker/db/.env ./docker/meilisearch/.env && cd bin && ./start_development.sh',
    url: 'http://localhost:8081/server/ping',
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000,
  },
  globalSetup: require.resolve('./tests/global.setup.ts'),
  globalTeardown: require.resolve('./tests/global.teardown.ts'),
});
