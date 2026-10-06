// Synthesizes the narration with Gemini TTS: one request per batch, then one clip per line.
//   node <skill>/scripts/tts.mjs [batch ...] [--force] [--list]
//   → build/cues.json, build/batch/<batch>.wav, build/tts/<cue>.wav
// A batch is only re-synthesized when its text, voice or model changed (or with --force).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadProject, loadKey, group } from "../lib/project.mjs";
import { synthesize, split, wav, pcmOf, RATE } from "../lib/gemini-tts.mjs";

const args = process.argv.slice(2);
const only = args.filter((arg) => !arg.startsWith("--"));
const { config, cues } = await loadProject();
await mkdir("build/batch", { recursive: true });
await mkdir("build/tts", { recursive: true });
await writeFile("build/cues.json", JSON.stringify(cues, null, 1));

const batches = group(cues);
console.log(`${cues.length} lines, ${cues.reduce((n, c) => n + c.text.length, 0)} characters, ${batches.size} request(s) — voice ${config.voice}, model ${config.model}`);
if (args.includes("--list")) {
  for (const [name, list] of batches) console.log(`  ${name}: ${list.length} lines (${list[0].id} … ${list.at(-1).id})`);
  process.exit(0);
}

for (const [name, list] of batches) {
  if (only.length && !only.includes(name)) continue;
  const hash = createHash("sha1").update(JSON.stringify([config.voice, config.model, list.map(({ text, style }) => [text, style])])).digest("hex");
  const file = `build/batch/${name}.wav`, tag = `build/batch/${name}.hash`;
  const cached = !args.includes("--force") && existsSync(file) && existsSync(tag) && (await readFile(tag, "utf8")) === hash;
  if (!cached) {
    const pcm = await synthesize({ key: loadKey(), model: config.model, voice: config.voice, cues: list }).catch((error) => { throw new Error(`${name}: ${error.message}`); });
    await writeFile(file, wav(pcm));
    await writeFile(tag, hash);
  }
  const pieces = split(pcmOf(await readFile(file)), list);
  for (const piece of pieces) await writeFile(`build/tts/${piece.cue.id}.wav`, wav(piece.pcm));
  const seconds = pieces.reduce((sum, p) => sum + p.pcm.length, 0) / 2 / RATE;
  const pauses = pieces.slice(0, -1).map((p) => p.pause);
  console.log(`${name}: ${list.length} lines, ${seconds.toFixed(1)} s${cached ? " (cached)" : ""}${pauses.length ? `, shortest boundary pause ${Math.min(...pauses).toFixed(2)} s` : ""}`);
  // A clip spoken much faster or slower than the batch average was probably cut in the wrong place.
  for (const p of pieces.filter((p) => p.rate < 0.72 || p.rate > 1.38)) console.log(`  check ${p.cue.id}: ${p.rate.toFixed(2)}× expected rate — ${p.cue.text.slice(0, 50)}`);
}
