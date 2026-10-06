// Masters the audio, encodes the frames into the final video and makes a contact sheet.
//   node <skill>/scripts/encode.mjs [--small]
//   → audio.wav (-14 LUFS, true peak ≤ -1.5 dB), out.mp4, contact_sheet.jpg
//   --small also writes out-small.mp4 (lighter copy for messaging apps)
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const { fps, duration, width, height } = JSON.parse(readFileSync("beats.json", "utf8"));
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "inherit", "inherit"] });

// Measure, apply the gain that reaches the target loudness, and catch the peaks with a limiter.
const TARGET = -14, CEILING = -2; // LUFS integrated, dBFS limiter ceiling (keeps true peak under -1.5 dB)
const measure = (file) => {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
};
let gain = TARGET - Number(measure("build/premix.wav").input_i), final;
for (let pass = 0; pass < 5; pass++) { // the limiter takes a little loudness back; correct for it
  ffmpeg("-i", "build/premix.wav", "-af", `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${(10 ** (CEILING / 20)).toFixed(3)}:attack=3:release=60:level=false,aresample=48000`, // limit oversampled: inter-sample peaks count
    "-c:a", "pcm_s16le", "audio.wav");
  final = measure("audio.wav");
  if (Math.abs(TARGET - final.input_i) < 0.2) break;
  gain += TARGET - Number(final.input_i);
}
console.log(`audio.wav: ${final.input_i} LUFS integrated, ${final.input_tp} dBTP true peak`);

const video = (out, crf, audio, preset) => {
  ffmpeg("-framerate", String(fps), "-i", "frames/%05d.jpg", "-i", "audio.wav", "-c:v", "libx264", "-preset", preset, "-pix_fmt", "yuv420p",
    "-crf", String(crf), "-c:a", "aac", "-b:a", audio, "-shortest", "-movflags", "+faststart", out);
  console.log(`${out}: ${(statSync(out).size / 2 ** 20).toFixed(1)} MB`);
};
video("out.mp4", 19, "192k", "medium");
if (process.argv.includes("--small")) video("out-small.mp4", 27, "112k", "slow");

// 36 evenly spaced frames for the review pass.
const wide = width > height, cols = wide ? 6 : 9, rows = wide ? 6 : 4;
ffmpeg("-i", "out.mp4", "-vf", `fps=${(cols * rows) / duration},scale=${wide ? 480 : 270}:-1,tile=${cols}x${rows}:padding=4`, "-frames:v", "1", "contact_sheet.jpg");
console.log(`contact_sheet.jpg: one frame every ${(duration / (cols * rows)).toFixed(1)} s`);
