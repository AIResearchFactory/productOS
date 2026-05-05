import { defineConfig, devices } from '@playwright/test';

import path from 'path';
const TEST_DATA_DIR = path.resolve('./.test-data');
const APP_DATA_DIR = path.join(TEST_DATA_DIR, 'appdata');
const PROJECTS_DIR = path.join(TEST_DATA_DIR, 'projects');
const SKILLS_DIR = path.join(TEST_DATA_DIR, 'skills');

// Set environment variables for both the test runner and the webServer
process.env.APP_DATA_DIR = APP_DATA_DIR;
process.env.PROJECTS_DIR = PROJECTS_DIR;
process.env.SKILLS_DIR = SKILLS_DIR;
process.env.NODE_ENV = 'test';
const isVerifyRelease = process.env.PRODUCTOS_E2E_VERIFY_RELEASE === 'true';
process.env.VITE_SERVER_URL = isVerifyRelease ? 'http://127.0.0.1:51423' : 'http://127.0.0.1:51424';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: isVerifyRelease ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: isVerifyRelease ? [
    {
      command: "productos",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        APP_DATA_DIR,
        PROJECTS_DIR,
        SKILLS_DIR,
        CI: 'true',
      }
    }
  ] : [
    {
      command: "vite --port 5174 --host 127.0.0.1 --force",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        APP_DATA_DIR,
        PROJECTS_DIR,
        SKILLS_DIR,
        VITE_SERVER_URL: 'http://localhost:51424',
      }
    },
    {
      command: "node scripts/run-dev-server-ci.mjs",
      url: "http://127.0.0.1:51424/api/health",
      reuseExistingServer: false,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        APP_DATA_DIR,
        PROJECTS_DIR,
        SKILLS_DIR,
        PRODUCTOS_NODE_SERVER_PORT: '51424',
        NODE_ENV: 'test',
        CI: 'true',
      }
    }
  ],
});


