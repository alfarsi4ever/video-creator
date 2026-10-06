#!/usr/bin/env node
/*
 * Render a seekable HTML video page (see references/motion-rules.md, "Render contract") to PNG frames.
 *
 * Serves the project directory over a local HTTP server (so fetch('beats.json') works -- it fails
 * over file://), opens the page in headless Chromium via Playwright, awaits window.ready, then calls
 * window.seek(i / FPS) and screenshots every frame. Also writes a poster frame.
 *
 * Usage:
 *   node render.js [--dir .] [--page index.html] [--out frames] [--poster poster.png]
 *                  [--poster-at SECONDS] [--width W --height H]
 *
 * Width/height default to the page's window.WIDTH/HEIGHT, else 1920x1080.
 * Playwright is resolved from: $PLAYWRIGHT_MODULE, local node_modules, then the global npm root.
 */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean);
  try {
    const root = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    candidates.push(path.join(root, 'playwright'), path.join(root, 'playwright-core'));
  } catch (e) { /* npm unavailable */ }
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* try next */ }
  }
  console.error('error: Playwright not found. Install it with `npm i -D playwright` (Chromium must be available).');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.wav': 'audio/wav',
};

function serve(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const dir = arg('dir', '.');
  const page = arg('page', 'index.html');
  const out = arg('out', 'frames');
  const poster = arg('poster', 'poster.png');
  fs.mkdirSync(out, { recursive: true });

  const { chromium } = loadPlaywright();
  const server = await serve(dir);
  const url = `http://127.0.0.1:${server.address().port}/${page}`;
  const browser = await chromium.launch();
  try {
    // Probe the page's declared size first, then render at exactly that viewport.
    const probe = await browser.newPage();
    await probe.goto(url);
    const declared = await probe.evaluate(() => ({ w: window.WIDTH, h: window.HEIGHT }));
    await probe.close();
    const width = Number(arg('width', declared.w || 1920));
    const height = Number(arg('height', declared.h || 1080));

    const pg = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    pg.on('pageerror', e => errors.push(e.message));
    await pg.goto(url);
    await pg.evaluate(() => window.ready);
    const { duration, fps } = await pg.evaluate(() => ({ duration: window.DURATION, fps: window.FPS }));
    if (!duration || !fps || (await pg.evaluate(() => typeof window.seek)) !== 'function') {
      throw new Error('page must define window.DURATION, window.FPS and window.seek(t)');
    }
    const n = Math.round(duration * fps);
    for (let i = 0; i < n; i++) {
      await pg.evaluate(t => window.seek(t), i / fps);
      await pg.screenshot({ path: path.join(out, String(i).padStart(5, '0') + '.png') });
    }
    const posterAt = Number(arg('poster-at', Math.max(0, duration - 1 / fps)));
    await pg.evaluate(t => window.seek(t), posterAt);
    await pg.screenshot({ path: poster });
    if (errors.length) console.error('page errors:\n  ' + errors.join('\n  '));
    console.log(`rendered ${n} frames (${width}x${height} @ ${fps} fps) to ${out}/, poster ${poster}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e => { console.error('error:', e.message); process.exit(1); });
