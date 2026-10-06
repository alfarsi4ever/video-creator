// Loads the video project in the current directory (its script.mjs) and turns it into scenes
// with narration cues. Every script in scripts/ starts from this.
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  width: 1920, height: 1080, fps: 30,
  voice: "Charon", model: "gemini-3.8-flash-tts",
  tempo: 1.08,      // narration speed-up applied after synthesis (1 = as spoken)
  gap: 0.3,         // pause between narration lines, seconds
  countdown: 5,     // seconds to answer a quiz question
  tail: 3,          // seconds the last scene holds after the narration ends
  style: "clear, confident Modern Standard Arabic; measured, unhurried pace, like a product explainer narrator",
  askStyle: "curious, challenging quiz-host tone in Modern Standard Arabic; clear",
  answerStyle: "decisive, satisfied tone in Modern Standard Arabic; short and clear",
};
const MAX_CUES = 40, MAX_CHARS = 9000; // per TTS request: more lines than this and the cuts get unreliable

export async function loadProject() {
  const file = resolve("script.mjs");
  if (!existsSync(file)) throw new Error("script.mjs not found — run this from the video's project folder");
  const source = await import(pathToFileURL(file).href);
  const config = { ...DEFAULTS, ...source.CONFIG };
  if (process.env.VO_TEMPO) config.tempo = Number(process.env.VO_TEMPO);
  if (process.env.TTS_VOICE) config.voice = process.env.TTS_VOICE;
  if (process.env.TTS_MODEL) config.model = process.env.TTS_MODEL;

  const seen = new Set();
  let batch = null, named = false, auto = 0, count = 0, chars = 0;
  const scenes = source.SCENES.map((scene) => {
    if (!/^[a-z][a-z0-9-]*$/i.test(scene.id) || seen.has(scene.id)) throw new Error(`scene id "${scene.id}" must be unique and made of letters, digits and dashes`);
    seen.add(scene.id);
    const lines = scene.quiz
      ? [{ text: scene.quiz.sayQ ?? scene.quiz.q, style: config.askStyle }, { text: scene.quiz.sayA ?? scene.quiz.a, style: config.answerStyle }]
      : scene.say.map((line) => (typeof line === "string" ? { text: line } : line));

    // One TTS request per batch: scenes are packed in order until a request would get too large.
    const length = lines.reduce((sum, line) => sum + line.text.length, 0);
    if (scene.batch ? scene.batch !== batch : batch === null || named || count + lines.length > MAX_CUES || chars + length > MAX_CHARS) {
      batch = scene.batch ?? `b${++auto}`; named = Boolean(scene.batch); count = chars = 0;
    }
    count += lines.length; chars += length;

    const cues = lines.map((line, k) => ({ id: `${scene.id}_${k}`, text: line.text.trim(), style: line.style ?? config.style, batch }));
    return { id: scene.id, quiz: scene.quiz, cues };
  });

  // "Question n of total" within each run of consecutive quiz scenes.
  for (let i = 0; i < scenes.length; i++) {
    if (!scenes[i].quiz || scenes[i - 1]?.quiz) continue;
    let end = i;
    while (scenes[end]?.quiz) end++;
    for (let j = i; j < end; j++) scenes[j].quiz = { ...scenes[j].quiz, index: j - i + 1, total: end - i };
  }
  return { config, scenes, cues: scenes.flatMap((scene) => scene.cues) };
}

// GEMINI_API_KEY from the environment, else from a .env file in the project, else in the skill folder.
export function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const file of [resolve(".env"), join(SKILL_DIR, ".env")]) {
    if (!existsSync(file)) continue;
    const key = readFileSync(file, "utf8").match(/^\s*GEMINI_API_KEY\s*=\s*(.*)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g, "").trim();
    if (key) return key;
  }
  throw new Error("no Gemini API key: set GEMINI_API_KEY, or put GEMINI_API_KEY=... in a .env file in the project or the skill folder");
}

export function group(cues) {
  const batches = new Map();
  for (const cue of cues) batches.set(cue.batch, [...(batches.get(cue.batch) ?? []), cue]);
  return batches;
}
