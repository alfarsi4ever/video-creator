import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGeminiRequest, extractAudio, validateTtsRequest } from "./lib/tts.js";

const root = fileURLToPath(new URL("./public", import.meta.url));
const envPath = fileURLToPath(new URL("./.env", import.meta.url));

async function loadEnv() {
  try {
    const source = await readFile(envPath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (!match || match[2].startsWith("#") || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await loadEnv();

function hasApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== "ضع_المفتاح_هنا");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("حجم الطلب أكبر من المسموح.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("تعذّر قراءة بيانات الطلب.");
  }
}

async function generateSpeech(request, response) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasApiKey()) {
    return json(response, 503, {
      error: "مفتاح Google AI Studio غير مضاف. انسخ .env.example إلى .env ثم أضف GEMINI_API_KEY.",
      code: "MISSING_API_KEY",
    });
  }

  try {
    const input = validateTtsRequest(await readJson(request));
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent`;
    const googleResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(buildGeminiRequest(input)),
      signal: AbortSignal.timeout(120_000),
    });

    const payload = await googleResponse.json();
    if (!googleResponse.ok) {
      const message = payload?.error?.message || "فشل الاتصال بخدمة Google الصوتية.";
      return json(response, googleResponse.status, { error: message, code: "GOOGLE_API_ERROR" });
    }

    const audio = extractAudio(payload);
    response.writeHead(200, {
      "content-type": audio.mimeType,
      "content-disposition": 'attachment; filename="arabic-tts.wav"',
      "cache-control": "no-store",
    });
    response.end(audio.buffer);
  } catch (error) {
    const status = error.name === "TimeoutError" ? 504 : 400;
    json(response, status, { error: error.message || "حدث خطأ غير متوقع." });
  }
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) return json(response, 403, { error: "غير مسموح." });

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch (error) {
    json(response, error.code === "ENOENT" ? 404 : 500, { error: "الملف غير موجود." });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (request.method === "GET" && url.pathname === "/api/status") {
    return json(response, 200, { configured: hasApiKey() });
  }
  if (request.method === "POST" && url.pathname === "/api/tts") {
    return generateSpeech(request, response);
  }
  if (request.method === "GET") return serveStatic(url.pathname, response);
  json(response, 405, { error: "الطريقة غير مدعومة." });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, "127.0.0.1", () => {
  console.log(`Arabic TTS Studio: http://127.0.0.1:${port}`);
});
