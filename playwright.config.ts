import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
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
      ? 'APP_DATA_DIR=./.test-data/appdata PROJECTS_DIR=./.test-data/projects SKILLS_DIR=./.test-data/skills concurrently -k "vite preview --port 5173" "npm run dev:server:ci"'
      : 'APP_DATA_DIR=./.test-data/appdata PROJECTS_DIR=./.test-data/projects SKILLS_DIR=./.test-data/skills npm run dev > e2e-server.log 2>&1',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: process.env.CI ? 180 * 1000 : 120 * 1000,
  },
});
