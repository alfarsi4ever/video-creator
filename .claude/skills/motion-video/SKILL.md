---
name: motion-video
description: "Make polished motion-graphics videos (product launches, UI animations, showreels, explainer clips) by having Claude write code that renders to MP4 -- HTML/Canvas/SVG or a framework like Remotion/HyperFrames, captured frame-by-frame with headless Chrome + FFmpeg -- inside a 'harness' of motion rules, brand inputs, reference-style extraction, a beat-synced sound track, a director's brief, and a scored critique loop. Use this skill whenever the user asks for an animated video, motion graphics, a launch/promo video, a UI animation, a showreel, or an animated explainer -- especially for a real brand or product. Triggers on: make a launch video, motion graphics for my app, animate this UI, product promo video, showreel, 15-second ad, video in the style of this reference."
argument-hint: "<what the video is for> [brand URL] [reference video] [duration] [aspect]"
metadata:
  version: "1.0.0"
  optional-skill: "banana"
---

# Motion Video -- Code-Rendered Motion Graphics with a Quality Harness

## Core principle

**The prompt is ~10% of the result; the harness is the other 90%.** Asking a model for "a cool launch
video" gives the generic AI look: centered text on a gradient, everything fading in, random particles.
Good output comes from constraining the model with:

1. **Motion rules** that make rendering deterministic and ban the generic look (`references/motion-rules.md`).
2. **Real inputs** -- the actual brand's colors, fonts, logo, UI screenshots -- never invented ones.
3. **A style guide extracted from a reference video** the user likes.
4. **A sound plan** -- a fixed BPM grid that visuals and SFX snap to, plus optional voiceover.
5. **A director's brief** that fixes the story, timeline, and deliverables up front (`references/directors-brief.md`).
6. **A critique loop** -- render, score a contact sheet on fixed axes, fix the worst flaws, repeat.

The model does not output an MP4. It writes **code**, and the code is rendered to video.

## Choose a render route

| Route | How it renders | Use when |
|---|---|---|
| **A. Code-drawn** (default) | Single HTML page (Canvas/SVG/DOM) driven by a `seek(t)` function; headless Chrome (Playwright) screenshots each frame; FFmpeg encodes | Most UI/launch/showreel work. Zero framework dependencies. |
| **B. Framework** | Remotion (React) or HyperFrames (HTML) project, rendered by its CLI | User already uses the framework, or the piece is long/complex with many reusable scenes |
| **C. Mixed pipeline** | Generated stills/clips (e.g. `/banana` images) composited and animated by route A or B | Needs illustrated or photographic content that code can't draw |
| **D. Footage edit** | FFmpeg cuts, captions, B-roll and overlays on existing footage | User supplies raw video to edit |

Default to **Route A** unless the user's setup or content points elsewhere. For Route C, generate
stills with the `banana` skill first, then animate them.

## Workflow

Run these phases in order. Each is a gate: show the user the output of a phase before starting the
next when the job is large (more than ~20 s or a client deliverable). For a quick clip, run straight through.

### 1. Brief
Fill in `references/directors-brief.md` from the user's request. Ask only for what you can't infer:
purpose and call to action, duration, aspect ratio, brand URL or assets, reference video (optional),
voiceover yes/no. Defaults: 15 s, 16:9 1920x1080, 30 fps, 120 BPM, no voiceover.

### 2. Inputs
- **Brand:** fetch the product site; capture screenshots with Playwright; pull the real colors (hex),
  fonts, logo, and UI components. Write them to `brand.md`. Reuse `brand.md` on later runs.
- **Reference style (optional):** if the user gives a reference video, download it (yt-dlp, or the
  `watch` skill if installed), sample frames every 0.5 s with
  `ffmpeg -i ref.mp4 -vf fps=2,scale=640:-1 ref/%04d.jpg`, view them, and write `style_guide.md`:
  palette, typography, camera moves, transition types, pacing (avg shot length), motion "grammar".
  Capture the **style**, never the reference's logos, characters, or copy.

### 3. Script and beat sheet
Write the beat sheet: one row per shot with start time, duration, what's on screen, on-screen text,
and the sound event it lands on. Every shot boundary and major motion hit sits on the beat grid
(at 120 BPM a beat is 0.5 s, a bar is 2 s). Export it as `beats.json`:

```json
{"bpm": 120, "duration": 15, "fps": 30,
 "beats": [0.0, 0.5, 1.0, 1.5],
 "events": [{"t": 2.0, "type": "cut", "shot": 2},
            {"t": 3.5, "type": "click"},
            {"t": 5.5, "type": "wipe", "sfx": "whoosh"}]}
```

`beats` may be omitted (it is derived from `bpm` and `duration`). Event `type` values the scripts
understand: `cut` (shot boundary; also a low hit), `click`/`tap`, `wipe`/`transition` (whoosh),
`reveal`/`chime`, `hit`. Add `"sfx"` to pick a sound explicitly (`kick`, `click`, `whoosh`, `chime`,
`hit`); other types are fine for the page's own use but are silent.

### 4. Build
Write the video as `index.html` following **every rule in `references/motion-rules.md`** (render
contract first -- it is what makes frame capture work). Read times from `beats.json` instead of
hard-coding them. The page is served over HTTP when rendered, so `fetch('beats.json')` works; don't
open it via `file://`, where that fetch fails.

### 5. Render
Route A, with the bundled renderer (Node + Playwright; it serves the folder itself):

```bash
node "${CLAUDE_SKILL_DIR}/scripts/render.js" --dir . --page index.html --out frames --poster poster.png
ffmpeg -y -framerate 30 -i frames/%05d.png -i audio.wav -c:v libx264 -pix_fmt yuv420p -crf 18 \
  -c:a aac -b:a 192k -shortest out.mp4
```

The renderer uses the page's `window.WIDTH`/`HEIGHT` (or `--width/--height`) and finds Playwright in
local `node_modules` or the global npm root. If Playwright is missing, install it in the project with
`npm i -D playwright`; if no Chromium is available either, ask before downloading one.

### 6. Sound
```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/audio.py" --beats beats.json --out audio.wav [--voice vo.wav] [--key D]
```

This synthesizes a kick/hat/bass/pluck bed on the beat grid with ffmpeg (no samples, no numpy),
places SFX on `beats.json` events, ducks the music under an optional voiceover, and masters to
**-14 LUFS** integrated with true peak under **-1.5 dBTP**, printing the measured values. Use
`--no-bed` when the user supplies music; mix their track in instead. For voiceover, use a TTS tool the
user has connected (for example a Fish Audio or ElevenLabs MCP server). Never clone a voice without
the voice owner's explicit consent.

### 7. Critique loop
```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/contact_sheet.py" out.mp4 --beats beats.json
```
This writes `contact_sheet.jpg` with one timestamped frame per beat (thinned to `--max`, default 36;
`--shots` gives one per shot). Check frame 0 separately too -- the first frame is the thumbnail
and the hook. View the sheet and score each axis 1-10:

| Axis | 10 looks like |
|---|---|
| Hook | First 2 s make you want to keep watching |
| Readability | Every text line is readable at its on-screen duration and size |
| Motion quality | Eased, purposeful motion; nothing static for more than 2-4 s; no jank |
| Variety | Shot types, layouts and transitions don't repeat monotonously |
| Brand | Real colors, fonts, logo and UI; looks like this company's video |
| Sound | Cuts and hits land on the beat; mix is clean |
| Depth | Layering, parallax, shadows and scale give a sense of space |

Log scores and the **three worst flaws** in `review_log.md`, fix those, re-render, and repeat.
Stop when **every axis is >= 8**, after **3 passes**, or when a pass doesn't raise the total score.
Sound can't be judged from a contact sheet: check the measured loudness, and that event times in
`beats.json` match the visual hits. Report the final scores honestly -- don't inflate them -- and
name the axes still below 8.

### 8. Deliver
Final `out.mp4` (H.264, yuv420p, CRF 16-22), a poster frame (`poster.png`), and the source project.
Offer extra aspect ratios (9:16 1080x1920, 1:1 1080x1080) by re-laying-out, not cropping.

## Packaging a repeatable pipeline
Once a look works for a user, save `brand.md`, `style_guide.md`, and the brief as presets in the
project so later videos for the same brand start from them.

## Provenance
This workflow was distilled from a public YouTube tutorial on making motion graphics with Claude
Code. See `references/source-notes.md` for what was taken from it and how it was verified.
