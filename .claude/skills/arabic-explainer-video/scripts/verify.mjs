// Sanity check of the narration clips: asks a Gemini model to transcribe every clip of a batch
// and prints the clips whose transcript differs from the script.
//   node <skill>/scripts/verify.mjs [batch ...]      → build/heard.json
import { readFile, writeFile } from "node:fs/promises";
import { loadProject, loadKey, group } from "../lib/project.mjs";

const MODELS = process.env.ASR_MODEL ? [process.env.ASR_MODEL] : ["gemini-3.8-flash", "gemini-3.7-flash"];
const only = process.argv.slice(2);
const { cues } = await loadProject();
const key = loadKey();
const norm = (s) => s.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^ء-ي0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function transcribe(list) {
  const parts = [{ text: `You get ${list.length} short Arabic audio clips, numbered in order. Transcribe each clip verbatim (Arabic, numbers as spoken words). Reply with a JSON array of ${list.length} strings only.` }];
  for (const [i, cue] of list.entries()) {
    parts.push({ text: `Clip ${i + 1}:` });
    parts.push({ inlineData: { mimeType: "audio/wav", data: (await readFile(`build/tts/${cue.id}.wav`)).toString("base64") } });
  }
  let failure;
  for (const model of MODELS) for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    });
    const payload = await res.json();
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
    if (res.ok && text) return JSON.parse(text);
    failure = res.ok ? `no transcript (${JSON.stringify(payload.promptFeedback || payload.candidates?.[0]?.finishReason)})` : `${res.status} ${payload?.error?.message?.slice(0, 160)}`;
    if (res.status !== 503 && res.status !== 500) break; // overloaded → wait and retry; anything else → next model
    await new Promise((done) => setTimeout(done, 15000 * (attempt + 1)));
  }
  // The API sometimes refuses a whole request ("blockReason") because of one clip: narrow it down.
  if (failure.startsWith("no transcript") && list.length > 1) {
    const half = list.length >> 1;
    return [...(await transcribe(list.slice(0, half))), ...(await transcribe(list.slice(half)))];
  }
  if (failure.startsWith("no transcript")) return [null];
  throw new Error(failure);
}

const report = {};
let failed = false;
for (const [name, list] of group(cues)) {
  if (only.length && !only.includes(name)) continue;
  let heard;
  try { heard = await transcribe(list); } catch (error) { failed = true; console.log(`${name}: NOT VERIFIED — ${error.message}`); continue; }
  let bad = 0;
  list.forEach((cue, i) => {
    const a = norm(cue.text).split(" "), b = norm(String(heard[i] ?? "")).split(" ");
    const same = a.filter((w) => b.includes(w)).length / a.length;
    const edges = a[0] === b[0] && a.at(-1) === b.at(-1);
    report[cue.id] = heard[i];
    if (heard[i] === null) { bad++; console.log(`  ${cue.id}: the model refused to transcribe this clip — listen to it`); return; }
    if (same < 0.8 || !edges || Math.abs(a.length - b.length) > 2) { bad++; console.log(`  ${cue.id}\n    script: ${cue.text}\n    heard : ${heard[i]}`); }
  });
  console.log(`${name}: ${list.length - bad}/${list.length} clips match`);
}
await writeFile("build/heard.json", JSON.stringify(report, null, 1));
if (failed) process.exitCode = 1;
