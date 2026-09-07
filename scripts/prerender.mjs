import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import react from '@vitejs/plugin-react';

// El HTML y React comparten el mismo árbol: no hay una portada alternativa.
const server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, watch: null }, appType: 'custom' });
try {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx');
  let html = await readFile('dist/index.html', 'utf8');
  html = html.replace('<div id="root"></div>', `<div id="root" data-prerender>${renderToString(createElement(App))}</div>`);
  // CSS inicial inline: evita otra ida al servidor antes del primer renderizado.
  const sheets = [...html.matchAll(/<link rel="stylesheet"[^>]*href="(\/assets\/[^\"]+\.css)"[^>]*>/g)];
  for (const [tag, path] of sheets) {
    html = html.replace(tag, `<style data-critical>${await readFile('dist' + path, 'utf8')}</style>`);
  }
  await writeFile('dist/index.html', html);
  console.log('Portada prerenderizada con estilos iniciales incluidos.');
} finally {
  await server.close();
}
