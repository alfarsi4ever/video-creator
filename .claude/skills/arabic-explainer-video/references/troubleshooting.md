# Troubleshooting

## Voice

**`429` / quota exceeded from `tts.mjs`.** The free tier allows about 10 TTS requests per model
per day, counted per Google *project* — a second key from the same project does not help. Options,
in order: wait for the daily reset; `TTS_MODEL=gemini-3.8-flash-lite-tts node <skill>/scripts/tts.mjs`
(separate quota, slightly plainer voice — do not mix models inside one video if avoidable); a key
from a different Google project; a paid key. Finished batches are cached, so a retry only spends
requests on what is missing. Remaining quota is shown in Google AI Studio → the key's project → Usage / Rate limits.

**`503` high demand.** Temporary. `verify.mjs` retries by itself; for `tts.mjs` run it again later.

**`check <id>: 0.6× expected rate` from `tts.mjs`, or a mismatch from `verify.mjs`.** The cut is
in the wrong place, or the model read something other than the text. Listen-by-transcript in
`build/heard.json`. Usual causes and fixes:
- a line without final punctuation, or a one-word line → rewrite it (see narration.md);
- the voice ran two lines together → end the first with a full stop, or merge them into one line
  and time the second reveal from `dur`;
- the model added words (it sometimes repeats the first line at the end of a batch) or dropped a
  line → `node <skill>/scripts/tts.mjs <batch> --force` (costs one request).
A clip flagged only by a rate between 0.6 and 0.72 on a very short line, with a matching
transcript, is fine.

**`verify.mjs` says "the model refused to transcribe this clip".** The transcription model
sometimes blocks a request for no visible reason; the script narrows it down to the clip. It says
nothing about the clip being bad — tell the user that clip was not checked.

**A word is mispronounced** (the user reports it; you cannot hear it). Add diacritics to that
word, or respell it phonetically, and re-synthesize its batch.

## Timeline and picture

**Reveals are out of sync after editing the script.** `beats.json` is stale: run `timeline.mjs`.
If lines were added or removed, re-check every `data-u` index and `u[k]` in that scene — the page
throws `data-u="5" but the scene has 4 narration lines` when an index is out of range.

**`index.html has no markup for scene "x"`.** Every non-quiz scene id in `script.mjs` needs an
entry in `HTML`.

**A style "sticks" in some frames (a border stays lit, text stays typed).** A draw function sets
it conditionally without resetting it. Frames are rendered out of order; set it on every call.

**Page is blank when opened by double-click.** It fetches `beats.json`, which browsers block on
`file://`. Use the renderer's stills, or serve the folder: `npx http-server .`

**Fonts differ between machines.** See "Look" in design.md.

## Render and encode

**`browserType.launch: Chromium distribution 'chrome' is not found`.** Install Google Chrome, or
run `npx playwright install chromium` in `<skill>` (a large download — ask the user first).

**`Cannot find package 'playwright-core'`.** Run `npm install` in `<skill>`.

**Rendering is slow.** About 60 frames/second with 5 workers on a laptop; `--workers 8` on a
strong machine. A 13-minute video is ~24,000 frames (≈7 minutes) and ~3 GB of JPEGs in `frames/`,
which can be deleted after encoding.

**The video is too large to send.** `encode.mjs --small` writes `out-small.mp4` (about half
the size; fine on a phone, softer on a TV).

**Windows.** Run the scripts from Git Bash or PowerShell; paths with spaces need quotes. Python
is not needed.
