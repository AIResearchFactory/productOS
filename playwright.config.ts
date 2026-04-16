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
    baseURL: 'http://localhost:5173',
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
  webServer: {
    command: process.env.CI 
      ? `concurrently -k "vite preview --port 5173" "npm run dev:server:ci"`
      : `npm run dev`,
    url: 'http://127.0.0.1:51423/api/health',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 300 * 1000,
    env: {
      APP_DATA_DIR,
      PROJECTS_DIR,
      SKILLS_DIR,
      RUST_BACKTRACE: '1',
    }
  },
});

