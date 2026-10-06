// Renders the project's index.html to frames with headless Chrome (several pages in parallel).
//   node <skill>/scripts/render.mjs                 → frames/%05d.jpg for the whole video + poster.png
//   node <skill>/scripts/render.mjs --stills        → build/stills/<scene>.png (end state of every scene),
//                                                     build/stills/sheet.jpg and a layout-overflow report
//   node <skill>/scripts/render.mjs --at 0,12.5     → build/stills/t<sec>.png
//   options: --workers N (default 5)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (name) => args.includes("--" + name);
const value = (name, fallback) => (args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : fallback);
const WORKERS = Number(value("workers", 5));
const TYPES = { ".html": "text/html", ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ttf": "font/ttf" };

if (!existsSync("beats.json")) throw new Error("beats.json not found — run timeline.mjs first");
const { width, height } = JSON.parse(readFileSync("beats.json", "utf8"));

const root = resolve(".");
const server = createServer((req, res) => {
  const file = join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

// Installed Chrome first; Playwright's own Chromium if there is one.
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
async function open() {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => console.error("page error:", error.message));
  await page.goto(url);
  await page.evaluate(() => window.ready);
  return page;
}

try {
  if (flag("stills") || flag("at")) {
    mkdirSync("build/stills", { recursive: true });
    const page = await open();
    if (flag("at")) {
      for (const t of value("at").split(",").map(Number)) {
        await page.evaluate((t) => window.seek(t), t);
        await page.screenshot({ path: `build/stills/t${t.toFixed(2)}.png` });
      }
    } else {
      const scenes = await page.evaluate(() => window.SCENES.map((s) => ({ id: s.id, end: s.end })));
      for (const scene of scenes) {
        await page.evaluate((t) => window.seek(t), scene.end - 0.5);
        // Layout report: visible text that leaves the frame.
        const issues = await page.evaluate((id) => {
          const out = [];
          for (const el of window.SCENES.find((s) => s.id === id).el.querySelectorAll("*")) {
            if (el.children.length || !el.textContent.trim() || +getComputedStyle(el).opacity === 0) continue;
            const r = el.getBoundingClientRect();
            if (r.width && (r.left < 0 || r.top < 0 || r.right > window.WIDTH || r.bottom > window.HEIGHT)) out.push(`"${el.textContent.trim().slice(0, 30)}" at ${Math.round(r.left)},${Math.round(r.top)} – ${Math.round(r.right)},${Math.round(r.bottom)}`);
          }
          return out;
        }, scene.id);
        for (const issue of issues) console.log(`LAYOUT ${scene.id}: ${issue}`);
        await page.screenshot({ path: `build/stills/${scene.id}.png` });
      }
      // One overview image of all scenes.
      const cols = width > height ? 3 : 5, list = "build/stills/list.txt";
      writeFileSync(list, scenes.map((s) => `file '${s.id}.png'\nduration 1`).join("\n"));
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-i", list, "-vf",
        `fps=1,scale=${width > height ? 960 : 432}:-1,tile=${cols}x${Math.ceil(scenes.length / cols)}:padding=6`, "-frames:v", "1", "build/stills/sheet.jpg"]);
      rmSync(list);
      console.log(`${scenes.length} stills → build/stills/ (overview: build/stills/sheet.jpg)`);
    }
  } else {
    const out = value("out", "frames");
    rmSync(out, { recursive: true, force: true }); // frames of a longer earlier render must not survive
    mkdirSync(out, { recursive: true });
    const probe = await open();
    const { duration, fps } = await probe.evaluate(() => ({ duration: window.DURATION, fps: window.FPS }));
    await probe.evaluate(() => window.seek(0));
    await probe.screenshot({ path: "poster.png" });
    await probe.close();
    const total = Math.round(duration * fps);
    let next = 0, done = 0;
    const started = Date.now();
    await Promise.all(Array.from({ length: WORKERS }, async () => {
      const page = await open();
      for (let i; (i = next++) < total; ) {
        await page.evaluate((t) => window.seek(t), i / fps);
        await page.screenshot({ path: join(out, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 93 });
        if (++done % 1500 === 0) console.log(`${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)} s`);
      }
    }));
    console.log(`rendered ${total} frames at ${fps} fps to ${out}/`);
  }
} finally {
  await browser.close();
  server.close();
}
