---
name: arabic-explainer-video
description: Make narrated Arabic videos about any idea from code — history, biography, science, culture, sport, a school lesson, a law, a system, a product, a how-to, a story. A script becomes Gemini TTS narration, the narration's timing drives an HTML page, headless Chrome renders it to MP4. For TV (16:9) or phone (9:16), with optional timed quiz questions. Use when the user asks for an Arabic video with a voice-over on any subject (فيديو شرح، فيديو توضيحي، فيديو تعليمي، فيديو وثائقي قصير، فيديو عن …، شرح درس أو قانون أو نظام أو إجراء، فيديو بأسئلة).
---

# Arabic explainer video

The narration is the clock. Every spoken line is one TTS clip; the clip durations decide when each
element appears on screen. So the order of work is fixed: **script → voice → timeline → picture**.
Never hand-time a scene.

The subject can be anything that can be told in sentences: the rulers of a country, how vaccines
work, a maths lesson, a football tournament, a new regulation, a product. The pipeline is the same;
what changes is the story shape and the visual pattern of each scene —
[references/topics.md](references/topics.md) has both, per kind of video.

Everything runs from the **project folder** (one folder per video) with the scripts of this skill.
`<skill>` below is this folder.

```
<project>/
  script.mjs    what is said: CONFIG + SCENES (narration lines, quiz questions)
  index.html    what is seen: markup per scene + optional draw functions
  engine.js     runtime (copied from the template, do not edit per video)
  build/        generated: narration clips, premix, stills
  beats.json    generated timeline      frames/  out.mp4  poster.png  contact_sheet.jpg
```

## Setup (once per machine)

- Node 20+, `ffmpeg` on PATH, Google Chrome installed.
- In `<skill>`: `npm install` (installs `playwright-core`; it drives the installed Chrome, nothing is downloaded).
- A Gemini API key (Google AI Studio) as `GEMINI_API_KEY` in the environment, or in a `.env` file in
  the project or in `<skill>` (see `.env.example`). Never write a key into a script, a reply or a
  file that gets shared. If there is no key, ask the user for one — do not look for keys elsewhere.

## Workflow

### 1. Brief
Infer what you can; ask only what you cannot: **screen** (TV 1920×1080 or phone 1080×1920),
**audience** (decides depth and pace), **quiz or not**, and the **source material**. Decide what
**kind of video** it is (history, profile, top-N, science, lesson, law, process, comparison, how-to,
recap, product, story) and take its shape from [references/topics.md](references/topics.md).

Then get the material before writing a line. A document from the user is the source. For a
general-knowledge subject, research it: every date, number and name that will be shown or spoken
comes from a source you read. For a law or a regulation, fetch the full current text and confirm
it is the one in force — laws get repealed and replaced; an explainer built on the old text is
worse than none.

### 2. Script — `script.mjs`
Copy `<skill>/template/` to the new project folder and write `script.mjs`. Rules for writing lines
that the voice reads well and that cut cleanly are in [references/narration.md](references/narration.md)
— read it before writing; the cutting depends on it.

- Explain, do not list: each scene is one idea, each line one step of it.
- 2–7 lines per scene; a scene id is letters/digits/dashes and appears nowhere on screen.
- Do not put on screen or in the narration a fact you did not get from the source. Where an
  example is invented (a sample clause, an article number you do not have), label it as an example
  on screen and tell the user. Where sources disagree, use wording true under both or leave the
  detail out. A selection you made yourself ("the most important …", a top five) is editorial:
  say so when you deliver.
- No likeness of a real person, and no photograph, logo or flag image unless the user supplies it
  or its licence allows it. Names, dates, places and diagrams carry the story.
- Quiz: `{ id, quiz: { q, a, ref, sayQ?, sayA? } }` — the engine draws question, a 5-second
  countdown and the answer. Put quizzes after the section they test.

If the user asked to see the script first, or the video is longer than about three minutes, show
the script and the scene breakdown and wait for the go-ahead. Otherwise continue.

### 3. Voice
```bash
node <skill>/scripts/tts.mjs --list     # how many requests this will cost
node <skill>/scripts/tts.mjs            # synthesize + cut into one clip per line
node <skill>/scripts/verify.mjs         # transcribe every clip and compare with the script
```
One request speaks a whole batch of lines (up to 40), then the audio is cut at the pauses. The free
tier allows about **10 TTS requests per model per day per Google project**, so never synthesize
line by line, and fix the script before synthesizing, not after. Only batches whose text changed
are synthesized again. Lines flagged `check …` by `tts.mjs` and mismatches from `verify.mjs` mean
a bad cut or a misreading: see [references/troubleshooting.md](references/troubleshooting.md).

`verify.mjs` checks words, not pronunciation. You cannot hear the audio: say so when you deliver.

### 4. Timeline
```bash
node <skill>/scripts/timeline.mjs
```
Writes `beats.json` (scene start/end, `units[k] = { at, dur }` per narration line, quiz countdown)
and `build/premix.wav` (voice + transition/tick sounds). Run it again after any change to the
script or the narration. Tempo is `CONFIG.tempo` (`VO_TEMPO=1.0 node …` to try another).
It also works before the voice exists (silent placeholders), which is enough to design the layouts.

### 5. Picture — `index.html`
One entry in `HTML` per scene id. `data-u="k"` makes an element appear when line `k` starts;
`DRAW[sceneId](scene, t, units)` is for everything else (typing, a packet moving, a button press,
a highlight following the narration). All motion is a pure function of `t` — no CSS animations or
transitions, no timers, no randomness: the renderer seeks to arbitrary frames in parallel.

Design rules, sizes for TV and phone, RTL pitfalls and the engine's helpers:
[references/design.md](references/design.md). Read it before writing the page. Scene patterns to
build from (date rail, profile card, big number, versus, moving diagram, map, quote, worked
example, recap) and how to set the mood for the subject: [references/topics.md](references/topics.md).

### 6. Check, render, encode
```bash
node <skill>/scripts/render.mjs --stills     # end state of every scene + build/stills/sheet.jpg + overflow report
node <skill>/scripts/render.mjs --at 12,40.5 # single moments (mid-animation states)
node <skill>/scripts/render.mjs              # all frames → frames/, poster.png
node <skill>/scripts/encode.mjs --small      # audio.wav (-14 LUFS), out.mp4, out-small.mp4, contact_sheet.jpg
```
Look at `build/stills/sheet.jpg` and fix layout before the full render: text too small for the
screen, half-empty frames, overflow (`LAYOUT …` lines), an empty first frame. After encoding look
at `contact_sheet.jpg` once: scenes change where the narration does, nothing sits static for long,
quiz countdowns are there. Fix the worst problems and render again; two passes are normally enough.

### 7. Deliver
`out.mp4` (and `out-small.mp4` when it has to travel through a messaging app). Report plainly:
duration, format, what was checked (transcription result, loudness) and what was not (you did
not listen), every invented example, the sources of the facts, any choice that was yours (which
items made the list, a date picked between two sources), anything from the brief that did not make it in.

## Examples (in `examples/`)

- **contract-check** — 2:36, TV. Custom scenes: a form mock reused in several states, a request
  travelling between three stations, a locked button. The model for process/system explainers.
- **drug-law-quiz** — 13 min, phone. A long lesson generated from data: scene *types* (list, grid,
  versus, ladder, penalty, map) filled from `content.mjs`, section openers, 20 quiz questions. It
  predates this skill's shared scripts and has its own `tools/`; use it as the model when a video
  has dozens of similar scenes and writing markup per scene would be repetition. See its README.

Both ship with their narration audio in `build/batch/`, so they rebuild without spending TTS quota.
Both happen to be about law and process; nothing in the scripts or the engine is specific to that.
For another kind of subject start from `template/` and the patterns in references/topics.md.
