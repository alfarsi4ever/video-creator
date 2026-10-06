# Motion Rules

Follow every rule here when writing a video. They exist to make rendering deterministic and to keep
output from looking like a generic AI video.

## 1. Render contract (required for frame capture)

- Expose `window.seek(t)` (seconds). Calling it must fully draw the frame for time `t`, with no
  dependency on what was drawn before. The renderer calls it for frames in order, but it must also
  work out of order.
- Derive **all** motion from `t`: no `requestAnimationFrame` clocks, no `Date.now()`, no
  `setTimeout`/`setInterval`, no CSS `transition`/`animation` (use computed styles from `t` instead).
- Expose `window.DURATION` (seconds), `window.FPS`, `window.WIDTH` and `window.HEIGHT`, and size the
  stage to the exact output resolution (no responsive scaling during render).
- Seeded randomness only (for example a small mulberry32 PRNG); the same `t` always gives the same pixels.
- Preload fonts and images before the first `seek`; expose `window.ready` (a Promise) the renderer awaits.
- Read shot times and event times from `beats.json`; never scatter magic numbers through the code.
  The page is served over HTTP for rendering; `fetch` of local files fails under `file://`.
- Frame 0 is the thumbnail: it must already show something on-brand, never a blank stage.

### Layout gotchas
- An `overflow: hidden` mask wrapper around an absolutely positioned child collapses to zero size
  and hides it. Give the wrapper explicit width/height (or position the wrapper, not the child).
- Measure text after fonts load (inside `window.ready`), or line breaks shift between frames.

## 2. Look -- banned patterns

Do not ship any of these unless the brief explicitly asks for it:

- Centered headline on a plain gradient background.
- Every element simply fading in (opacity-only entrances).
- Generic particle bursts, lens flares, or glowing orbs as filler.
- More than one accent color competing (one accent plus neutrals, unless the brand says otherwise).
- Stock "tech" decoration with no meaning: hex grids, circuit lines, floating code.
- Text that sits static on screen with nothing else moving.

## 3. Look -- required

- **Continuous motion:** something meaningful changes at least every 2-4 s; each shot has a payoff.
- **Real easing:** custom cubic-beziers or springs; no linear moves except for constant drifts.
- **Hierarchy:** one focal point per moment; the eye always knows where to look.
- **UI morphs over cuts:** when showing a product flow, morph one container through its states
  (button to loader to checkmark to chart) rather than hard-cutting between screenshots.
- **Depth:** layering, subtle parallax, soft shadows, scale changes.
- **Brand fidelity:** only colors, fonts and assets from `brand.md`.
- **Readable type:** on-screen text stays at least 0.3 s per word, minimum about 1 s per line, at a
  size readable on a phone.

## 4. Sound

- Fixed BPM grid (default 120 BPM: beat = 0.5 s, bar = 2 s). Cuts and big hits land on beats.
- SFX on interactions (clicks, toggles) and transitions (whooshes), timed from `beats.json` events.
- Voiceover sits on top of the music bed (duck the music about 6-10 dB under speech).
- Master to about -14 LUFS integrated, true peak at or below -1 dBTP (`scripts/audio.py` does this).

## 5. Feedback loop

- After each render, make a contact sheet (`scripts/contact_sheet.py`) and score the 7 axes in SKILL.md.
- Fix the three worst flaws per pass; log each pass in `review_log.md`.
- Stop when every axis is at least 8, after three passes, or when a pass doesn't raise the total
  score (then tell the user which axes are still weak).
