// Gemini TTS: one request speaks many lines (each line is a separate part with its own style),
// and split() cuts the returned audio back into one clip per line.
export const RATE = 24000; // Gemini TTS returns 24 kHz, 16-bit, mono PCM

export async function synthesize({ key, model, voice, cues }) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: cues.map(({ text, style }) => ({ text, speech_metadata: { style } })) }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice } } },
    }),
    signal: AbortSignal.timeout(600_000),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${payload?.error?.message || "TTS request failed"}`);
  const data = payload?.candidates?.[0]?.content?.parts?.find((part) => part?.inlineData?.data)?.inlineData.data;
  if (!data) throw new Error(`no audio returned (${payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason || "unknown reason"})`);
  return pcmOf(Buffer.from(data, "base64"));
}

export function wav(pcm, rate = RATE) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export const pcmOf = (buf) => (buf.subarray(0, 4).toString() === "RIFF" ? buf.subarray(buf.indexOf("data", 12) + 8) : buf);

// Letters that are actually spoken: no spaces, no diacritics.
export const weight = (text) => text.replace(/[\sً-ْ]/g, "").length;

// Cut a batch's audio into its cues. Pauses in the audio follow the punctuation of the text,
// so the phrases (text between punctuation marks) are aligned to the speech chunks (audio between
// pauses) with a segmental DP on "letters ≈ rate × seconds"; a cue ends at the pause its last
// phrase lands on. Returns [{ cue, pcm, rate, pause }]; `rate` far from 1 marks a suspect cut.
export function split(pcm, list) {
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
  const WIN = RATE / 100; // 10 ms
  const frames = Math.floor(samples.length / WIN);
  const loud = new Uint8Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * WIN; i < (f + 1) * WIN; i++) sum += samples[i] * samples[i];
    loud[f] = Math.sqrt(sum / WIN) / 32768 > 0.012 ? 1 : 0;
  }
  const chunks = []; // { dur: speech seconds, pause: seconds of silence after, cut: sample index }
  let f = 0;
  while (f < frames && !loud[f]) f++;
  for (let voiced = 0; f < frames; ) {
    if (loud[f]) { voiced++; f++; continue; }
    let g = f;
    while (g < frames && !loud[g]) g++;
    if (g - f >= 14 || g === frames) { chunks.push({ dur: voiced * 0.01, pause: (g - f) * 0.01, cut: ((f + g) >> 1) * WIN }); voiced = 0; }
    f = g;
    if (f === frames && voiced) chunks.push({ dur: voiced * 0.01, pause: 0, cut: samples.length });
  }
  if (!chunks.length) throw new Error("the audio is silent");
  chunks.at(-1).cut = samples.length;

  const phrases = []; // { letters, cueEnd, cue }
  list.forEach((cue, c) => {
    const parts = cue.text.split(/[،,.؟?!:؛…]+/).map(weight).filter(Boolean);
    parts.forEach((letters, i) => phrases.push({ letters, cue: c, cueEnd: i === parts.length - 1 }));
  });
  const rate = phrases.reduce((s, p) => s + p.letters, 0) / chunks.reduce((s, c) => s + c.dur, 0);

  const P = phrases.length, C = chunks.length, MAX = 4;
  const best = Array.from({ length: P + 1 }, () => new Float64Array(C + 1).fill(Infinity));
  const back = Array.from({ length: P + 1 }, () => new Array(C + 1).fill(null));
  best[0][0] = 0;
  for (let i = 0; i < P; i++) for (let j = 0; j < C; j++) {
    if (best[i][j] === Infinity) continue;
    let letters = 0;
    for (let a = 1; a <= MAX && i + a <= P; a++) {
      if (a > 1 && phrases[i + a - 2].cueEnd) break; // a cue boundary needs a pause to cut at
      letters += phrases[i + a - 1].letters;
      let dur = 0;
      for (let b = 1; b <= MAX && j + b <= C; b++) {
        dur += chunks[j + b - 1].dur;
        const want = letters / rate, err = want - dur;
        const last = phrases[i + a - 1], pause = chunks[j + b - 1].pause;
        const cost = (err / (0.22 * Math.max(want, dur) + 0.3)) ** 2 + 0.2 * (a + b - 2)
          + (last.cueEnd ? -1.5 * Math.min(pause, 0.8) : pause > 0.7 ? 0.6 : 0);
        if (best[i][j] + cost < best[i + a][j + b]) { best[i + a][j + b] = best[i][j] + cost; back[i + a][j + b] = [i, j]; }
      }
    }
  }
  if (best[P][C] === Infinity) throw new Error("could not align the narration to the text (fewer pauses than lines?)");
  const ends = new Array(list.length); // chunk index (exclusive) where each cue ends
  for (let i = P, j = C; i > 0; ) {
    if (phrases[i - 1].cueEnd) ends[phrases[i - 1].cue] = j;
    [i, j] = back[i][j];
  }
  let from = 0, start = 0;
  return list.map((cue, c) => {
    const own = chunks.slice(from, ends[c]);
    const end = own.at(-1).cut;
    const piece = { cue, pcm: pcm.subarray(start * 2, end * 2), rate: weight(cue.text) / own.reduce((s, x) => s + x.dur, 0) / rate, pause: own.at(-1).pause };
    from = ends[c]; start = end;
    return piece;
  });
}
