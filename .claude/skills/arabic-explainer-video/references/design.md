# Designing the page

## How a scene is put together

```js
const HTML = {
  steps: `<h2 data-u="0">أربع مراحل</h2>
          <div class="card" data-u="1">…</div>
          <div class="card" data-u="2">…</div>`,
};
const DRAW = {
  steps(s, t, u) { /* s.el = the scene's element, t = seconds, u[k] = { at, dur } of line k */ },
};
startVideo({ html: HTML, draw: DRAW, chrome(t, scene, alpha) { /* background, progress bar */ } });
```

- `data-u="k"` — the element rises in when narration line `k` starts. `data-fx="pop"` scales in.
- No `data-u` — there from the scene's first frame. The opening scene's title must be like this:
  frame 0 is the thumbnail, and an empty first frame reads as a broken video.
- A quiz scene needs no markup. To restyle it, override the `.q-*` classes in the page's CSS, or
  give the scene its own entry in `HTML` and draw it yourself from `s.quiz` (`countdown`, `reveal`).
- Helpers from `engine.js`: `$`, `$$`, `clamp`, `ease`, `smooth`, `mix(a, b, p)`,
  `P(t, at, d)` (0→1 over `d` seconds from `at`), `pulse(t, at, d)` (0→1→0, for a button press),
  `type(el, t, at, cps)` (typewriter), `ar(n)` (Arabic-Indic digits).

Timing inside a draw function always comes from `u`: `u[2].at` (line 2 starts),
`u[2].at + u[2].dur * 0.6` (the moment a word late in the line is spoken). Never a literal second.

## Determinism (the render contract)

Frames are captured by seeking to arbitrary times on several pages in parallel. So:

- Every visual property is set from `t` on every `seek`. If a draw function sets a style under
  some condition, it must reset it otherwise (`el.style.borderColor = on ? "var(--acc)" : ""`).
- No CSS `transition`/`animation`, no `setTimeout`/`requestAnimationFrame`, no `Math.random()`,
  no `Date`. For noise use a function of `t` and an index.
- No network assets at render time: fonts and images are local files in the project folder.

## Sizes

Sizes in the template are in `--u` = 1% of the frame's short side (10.8px at 1080), so the same
CSS serves both orientations; `#stage` gets the class `portrait` on a phone frame.

| | TV 1920×1080, seen from across a room | Phone 1080×1920, held in the hand |
|---|---|---|
| Title | 11–13u (120–140px) | 9–11u |
| Scene heading | 6–7u | 6–7u |
| Body / list item | **≥ 4u (44px)** | ≥ 4u |
| Smallest label | ≥ 2.6u (28px) | ≥ 3u |
| Lines of text on screen at once | ≤ 7 | ≤ 9 |
| Layout | two columns: text (right) + visual (left) | one column, top to bottom |

A UI mock (a form, a dashboard) drawn at "real" size is unreadable on a TV: draw it at 1.5–2× the
size it would have in a browser, with only the fields the narration talks about.

## Look

- One dark ground, one accent colour. Green/red/amber only where they mean pass/fail/warning.
- Use the organisation's real colours, fonts and logo when the user supplies them or they can be
  fetched from its site; never invent a logo or imitate one.
- The font stack starts with Dubai (ships with Windows/Office). On a machine without it the next
  Arabic font in the stack is used and line breaks shift — re-check the stills. To pin a font,
  put the `.woff2` in the project and declare it with `@font-face`.
- Depth comes cheaply from: a slowly drifting background, shadows under panels, one element per
  scene that moves continuously while the narration runs (a scan line, a packet, a growing rule).
- Vary the scene layouts: list, grid of cards, diagram with moving parts, mock screen, full-frame
  statement. Three list scenes in a row is where viewers drift off.
- The element being narrated is lit (accent border); what came before settles back. In long lists
  dim earlier items to ~20% rather than hiding them, and restore all at the end of the scene.

## Arabic and RTL

- `<html lang="ar" dir="rtl">`. The first flex child is on the right.
- Latin terms inside Arabic text: wrap in `<span class="ltr">` or the dot of `.NET` and brackets
  jump to the wrong side.
- Absolute positions use `left`/`top` in pixels of the frame regardless of direction.
- Digits on screen are Arabic-Indic (`ar(12)` → ١٢) unless the organisation uses Western digits.
- Typewriter effects slice by character; Arabic shaping follows automatically.

## Reusing a component in several states

A mock that appears in several scenes (empty → filled → flagged → fixed) is one function returning
markup, and each scene's draw function puts it in its state. See `mock()` and the `front`/`back`
scenes in `examples/contract-check/index.html`.
