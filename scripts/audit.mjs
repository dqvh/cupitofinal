import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

await mkdir('artifacts', { recursive: true });
const profile = await mkdtemp(resolve('artifacts/lighthouse-profile-'));
const server = process.argv[2] ? null : await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
const browser = await launch({
  chromePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : chromium.executablePath()),
  userDataDir: profile,
  chromeFlags: ['--headless', '--no-sandbox'],
});
try {
  const result = await lighthouse(process.argv[2] || 'http://127.0.0.1:4175', {
    port: browser.port, output: ['json', 'html'], logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });
  for (const [index, extension] of ['json', 'html'].entries()) await writeFile(`artifacts/lighthouse-after.${extension}`, result.report[index]);
  console.log(JSON.stringify({
    scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, value.score * 100])),
    metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift'].map(key => [key, result.lhr.audits[key].displayValue])),
  }, null, 2));
} finally {
  await browser.kill();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
