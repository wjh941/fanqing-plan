import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4519',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  webServer: {
    // 4519:不与其他项目的 5173/4173 冲突
    command: 'npm run preview -- --port 4519 --strictPort',
    port: 4519,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
