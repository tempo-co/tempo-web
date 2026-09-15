import {defineConfig, devices} from '@playwright/test';
import {loadEnv} from 'vite';

const loadedEnv = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(loadedEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const appUrl = process.env.VITE_APP_URL ?? loadedEnv.VITE_APP_URL ?? 'http://localhost:5173';
const providerE2eEnabled = process.env.ENABLE_BANKING_E2E === 'true';

export default defineConfig({
  webServer: {
    command: 'npm run build && npm run preview',
    url: appUrl,
    reuseExistingServer: !process.env.CI,
  },
  testDir: './test',
  timeout: 10000,
  expect: {timeout: providerE2eEnabled ? 30000 : 5000},
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: providerE2eEnabled ? [['list']] : [['list'], ['html', {open: 'never'}]],
  use: {
    baseURL: appUrl,
    trace: providerE2eEnabled ? 'off' : 'on-first-retry',
    screenshot: providerE2eEnabled ? 'off' : 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
      dependencies: ['setup'],
    },
  ],
});
