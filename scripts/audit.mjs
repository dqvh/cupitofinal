import lighthouse from 'lighthouse';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

await mkdir('artifacts', { recursive: true });
const server = process.argv[2] ? null : await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
const debugPort = await new Promise((resolvePort, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') return reject(new Error('No se encontró un puerto libre para Lighthouse.'));
    probe.close(() => resolvePort(address.port));
  });
});
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox', `--remote-debugging-port=${debugPort}`],
});
try {
  const result = await lighthouse(process.argv[2] || 'http://127.0.0.1:4175', {
    port: debugPort, output: ['json', 'html'], logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });
  for (const [index, extension] of ['json', 'html'].entries()) await writeFile(`artifacts/lighthouse-after.${extension}`, result.report[index]);
  console.log(JSON.stringify({
    scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, value.score * 100])),
    metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift'].map(key => [key, result.lhr.audits[key].displayValue])),
  }, null, 2));
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
