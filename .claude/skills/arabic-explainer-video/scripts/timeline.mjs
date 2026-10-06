// Cleans the narration clips, lays the scenes on the beat grid from the clip durations, writes
// beats.json (read by the page and the renderer) and mixes voice + SFX into build/premix.wav.
//   node <skill>/scripts/timeline.mjs          (VO_TEMPO=1.0 … to try another narration speed)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { loadProject } from "../lib/project.mjs";
import { weight } from "../lib/gemini-tts.mjs";

const { config, scenes: source } = await loadProject();
const BPM = 120, RATE = 48000, BEAT = 60 / BPM;
const snap = (t) => Math.ceil(t / BEAT - 1e-6) * BEAT; // scene cuts sit on the beat

await mkdir("build/vo", { recursive: true });

// Trim the silence around a clip and apply the tempo. Cached per tempo.
function clean(id) {
  const src = `build/tts/${id}.wav`, out = `build/vo/${id}@${config.tempo}.wav`;
  if (!existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs) {
    const trim = "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02";
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-af",
      `${trim},areverse,${trim},areverse,atempo=${config.tempo},aresample=${RATE}`, "-ac", "1", "-c:a", "pcm_s16le", out]);
  }
  return out;
}

async function pcm(path) {
  const buf = await readFile(path);
  const at = buf.indexOf("data", 12);
  const length = Math.min(buf.readUInt32LE(at + 4), buf.length - at - 8);
  return new Int16Array(buf.buffer, buf.byteOffset + at + 8, length >> 1);
}

const scenes = [], events = [], voice = [];
let cursor = 0, placeholders = 0;
for (const from of source) {
  const scene = { id: from.id, start: (cursor = snap(cursor)), units: [] };
  events.push({ t: scene.start, type: "scene" });
  cursor += from === source[0] ? 0.8 : 0.6;
  for (const [k, cue] of from.cues.entries()) {
    // Lines not synthesized yet get a silent stand-in of the expected length (layout previews).
    const missing = !existsSync(`build/tts/${cue.id}.wav`);
    if (missing) placeholders++;
    const samples = missing ? new Int16Array(Math.round((weight(cue.text) / 13 / config.tempo + 0.3) * RATE)) : await pcm(clean(cue.id));
    const dur = samples.length / RATE;
    if (from.quiz && k === 1) {
      // The answer waits for the countdown that follows the question.
      const countdown = snap(cursor - config.gap + 0.15);
      for (let s = 0; s < config.countdown; s++) events.push({ t: countdown + s, type: "tick" });
      cursor = countdown + config.countdown;
      events.push({ t: cursor, type: "reveal" });
      scene.quiz = { ...from.quiz, countdown, reveal: cursor, seconds: config.countdown };
      delete scene.quiz.sayQ; delete scene.quiz.sayA;
      cursor += 0.2;
    }
    voice.push({ t: cursor, samples });
    scene.units.push({ at: cursor - 0.1, dur });
    if (k && !from.quiz) events.push({ t: cursor - 0.1, type: "pop" });
    cursor += dur + config.gap;
  }
  cursor += from === source.at(-1) ? config.tail : from.quiz ? 0.9 : 0.5;
  scene.end = cursor = snap(cursor);
  scenes.push(scene);
}

const duration = cursor;
const round = (key, value) => (typeof value === "number" ? +value.toFixed(3) : value);
await writeFile("beats.json", JSON.stringify({ bpm: BPM, fps: config.fps, width: config.width, height: config.height, duration, events, scenes }, round));

// ── mix: voice + synthesized SFX ──
const mix = new Float32Array(Math.ceil(duration * RATE));
const add = (t, length, fn) => {
  const start = Math.round(t * RATE);
  for (let i = 0; i < length * RATE && start + i < mix.length; i++) mix[start + i] += fn(i / RATE, i);
};
for (const { t, samples } of voice) add(t, samples.length / RATE, (_, i) => samples[i] / 32768);

let seed = 7;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
const SFX = {
  pop: (t) => add(t, 0.12, (x) => 0.07 * Math.sin(2 * Math.PI * 880 * x) * Math.exp(-x * 38)),
  tick: (t) => add(t, 0.09, (x) => 0.2 * Math.sin(2 * Math.PI * 1250 * x) * Math.exp(-x * 45)),
  reveal: (t) => add(t, 1.0, (x) => 0.14 * (Math.sin(2 * Math.PI * 1047 * x) + 0.5 * Math.sin(2 * Math.PI * 1568 * x)) * Math.exp(-x * 4)),
  scene: (t) => {
    let low = 0;
    add(t, 0.42, (x) => {
      low += 0.18 * (noise() - low); // one-pole low-pass on noise = soft whoosh
      return 0.16 * low * Math.sin(Math.PI * x / 0.42) ** 2;
    });
    add(t, 0.5, (x) => 0.2 * Math.sin(2 * Math.PI * (52 * x + 4 * (1 - Math.exp(-x * 25)))) * Math.exp(-x * 7));
  },
};
for (const event of events) SFX[event.type]?.(event.t);

const out = Buffer.alloc(44 + mix.length * 2);
out.write("RIFF", 0); out.writeUInt32LE(36 + mix.length * 2, 4); out.write("WAVEfmt ", 8);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
out.writeUInt32LE(RATE, 24); out.writeUInt32LE(RATE * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(mix.length * 2, 40);
for (let i = 0; i < mix.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), 44 + i * 2);
await writeFile("build/premix.wav", out);

if (placeholders) console.log(`WARNING: ${placeholders} narration clips missing — silent placeholders used`);
console.log(`${scenes.length} scenes, ${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, "0")} (${duration.toFixed(1)} s), ${config.width}×${config.height}, tempo ${config.tempo}`);
for (const s of scenes) console.log(`  ${s.id.padEnd(12)} ${s.start.toFixed(1).padStart(6)} – ${s.end.toFixed(1)}`);
