// Renders the extension icons, the Web Store screenshots and the promo tile.
//
//   node store/render.mjs <path to Chrome for Testing executable>
//
// Branded Chrome ignores --load-extension, so this needs Chrome for Testing:
//   npx @puppeteer/browsers install chrome@stable
//
// Screenshots load the real extension and open store/samples/*.json from a
// local server, so they always show the current viewer. Chrome loads the
// extension before the icons are re-rendered, so the committed icon PNGs must
// already exist and be valid.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const store = path.join(root, 'store');
const iconSvg = await fs.readFile(path.join(store, 'icon.svg'), 'utf8');

const chromePath = process.argv[2];
if (!chromePath) {
  console.error('Usage: node store/render.mjs <path to Chrome for Testing executable>');
  process.exit(1);
}

const server = http
  .createServer(async (req, res) => {
    try {
      const body = await fs.readFile(path.join(store, 'samples', path.basename(req.url)));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(0, '127.0.0.1');
await once(server, 'listening');
const sampleUrl = (name) => `http://127.0.0.1:${server.address().port}/${name}`;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'unbrace-render-'));
const chrome = spawn(chromePath, [
  '--headless',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  `--load-extension=${path.join(root, 'extension')}`,
  'about:blank',
]);

try {
  const page = await connectToPage(chrome);
  await page.send('Page.enable');
  await page.send('Emulation.setScrollbarsHidden', { hidden: true });

  for (const size of [16, 32, 48, 128]) {
    // The 128px store icon keeps the transparent padding the Web Store asks
    // for; toolbar sizes crop it so the mark stays legible.
    const svg = size === 128 ? iconSvg : iconSvg.replace('viewBox="0 0 128 128"', 'viewBox="16 16 96 96"');
    await capture(page, `extension/icons/icon-${size}.png`, {
      html: `<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
      width: size,
      height: size,
      transparent: true,
    });
  }

  // Store screenshots must be 1280x800; an 800x500 viewport at 1.6x keeps the
  // text readable after the store scales them down to 640x400.
  const screenshot = { width: 800, height: 500, scale: 1.6 };
  await capture(page, 'store/screenshots/1-light.png', { ...screenshot, url: sampleUrl('order.json') });
  await capture(page, 'store/screenshots/2-dark-collapsed.png', {
    ...screenshot,
    url: sampleUrl('order.json'),
    dark: true,
    script: `for (const node of document.querySelectorAll('.jv-node')) {
      const key = node.querySelector(':scope > .jv-key')?.textContent;
      if (['"items"', '"shipping"'].includes(key)) node.querySelector(':scope > .jv-toggle').click();
    }`,
  });
  await capture(page, 'store/screenshots/3-raw.png', {
    ...screenshot,
    url: sampleUrl('order.json'),
    script: `[...document.querySelectorAll('.jv-button')].find((b) => b.textContent === 'Raw').click()`,
  });

  await capture(page, 'store/promo-440x280.png', {
    width: 440,
    height: 280,
    html: `<style>
      html,body{margin:0;height:100%}
      body{display:flex;align-items:center;justify-content:center;gap:20px;background:#0d1b2e;
        font-family:'Segoe UI',system-ui,sans-serif;color:#fff}
      svg{width:120px;height:120px}
      h1{margin:0;font-size:46px;font-weight:600}
      p{margin:4px 0 0;font-size:18px;color:#9fb3cc}
    </style>${iconSvg}<div><h1>Unbrace</h1><p>JSON, made readable</p></div>`,
  });
} finally {
  chrome.kill();
  server.close();
}

async function capture(page, file, { url, html, width, height, scale = 1, dark = false, transparent = false, script }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
  });
  await page.send('Emulation.setDefaultBackgroundColorOverride', transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});

  const loaded = page.next('Page.loadEventFired');
  await page.send('Page.navigate', { url: url ?? `data:text/html,${encodeURIComponent(html)}` });
  await loaded;
  if (url) await waitFor(page, `!!document.querySelector('.jv-tree')`);
  if (script) await page.send('Runtime.evaluate', { expression: script });

  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(root, file), Buffer.from(data, 'base64'));
  console.log(`wrote ${file}`);
}

async function waitFor(page, expression, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { result } = await page.send('Runtime.evaluate', { expression });
    if (result.value) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expression} (is the extension loading?)`);
}

// Minimal Chrome DevTools Protocol client for the first page target.
async function connectToPage(chromeProcess) {
  const browserUrl = await new Promise((resolve, reject) => {
    let output = '';
    chromeProcess.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(new URL(match[1]));
    });
    chromeProcess.on('exit', () => reject(new Error(`Chrome exited:\n${output}`)));
  });
  const targets = await (await fetch(`http://${browserUrl.host}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await once(ws, 'open');

  let nextId = 0;
  const pending = new Map();
  const waiters = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else {
      waiters.get(message.method)?.(message.params);
      waiters.delete(message.method);
    }
  });

  return {
    send(method, params = {}) {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    next(method) {
      return new Promise((resolve) => waiters.set(method, resolve));
    },
  };
}
