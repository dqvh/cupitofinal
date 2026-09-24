import { defineConfig } from '@playwright/test';

// Por defecto usa Edge; con PW_EXECUTABLE se puede apuntar a otro Chromium (CI / contenedores).
const executablePath = process.env.PW_EXECUTABLE;

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    screenshot: 'only-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : { channel: 'msedge' }),
  },
  webServer: { command: 'npm exec vite -- preview --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
