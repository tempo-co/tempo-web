import {defineConfig, devices} from '@playwright/test';
import {loadEnv} from 'vite';

const env = loadEnv('development', process.cwd(), '');
const appUrl = env.VITE_APP_URL || 'http://localhost:5173';

export default defineConfig({
  webServer: {
    command: 'npm run build && npm run preview',
    url: appUrl,
    reuseExistingServer: !process.env.CI,
  },
  testDir: './test',
  timeout: 120000,
  expect: {timeout: 30000},
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: appUrl,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'auth.setup.ts',
    },
    {
      name: 'sandbox-auth',
      testMatch: 'sandbox-auth.setup.ts',
      dependencies: ['setup'],
    },
    {
      name: 'sandbox',
      testMatch: 'bank-connection.sandbox.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/enable-banking-sandbox-user.json',
      },
      dependencies: ['sandbox-auth'],
    },
  ],
});
