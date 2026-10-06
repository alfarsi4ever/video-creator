// Runtime shared by every video page. index.html supplies the markup of each scene and, where a
// scene needs more than reveals, a draw function; this file turns beats.json into a deterministic
// seek(t): the same t always paints the same frame, which is what lets the renderer capture frames.
//
// Render contract (read by scripts/render.mjs): window.ready (a promise), window.seek(t),
// window.DURATION, window.FPS, window.WIDTH, window.HEIGHT, window.SCENES.

const $ = (root, sel) => root.querySelector(sel);
const $$ = (root, sel) => [...root.querySelectorAll(sel)];
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);                         // fast start, soft landing
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };       // soft start and landing
const P = (t, at, d = 0.5) => ease((t - at) / d);                           // 0→1 over d seconds from `at`
const mix = (a, b, p) => a + (b - a) * p;
const pulse = (t, at, d = 0.5) => { const x = (t - at) / d; return x > 0 && x < 1 ? Math.sin(Math.PI * x) : 0; }; // 0→1→0
const ar = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);         // Arabic-Indic digits

// Types an element's text from `at`, `cps` characters per second.
function type(el, t, at, cps = 22) {
  const full = el.dataset.full ??= el.textContent;
  const n = Math.floor(clamp((t - at) * cps / full.length) * full.length);
  el.textContent = full.slice(0, n) + (n < full.length && t > at ? "▏" : "");
}

const QUIZ_CSS = `
.q-wrap { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:calc(var(--u)*4); text-align:center; }
.q-no { font-size:calc(var(--u)*3.4); color:var(--acc); font-weight:700; }
.q-text { font-size:calc(var(--u)*6.4); font-weight:700; line-height:1.4; max-width:92%; }
.q-slot { position:relative; width:100%; height:calc(var(--u)*30); display:flex; justify-content:center; align-items:center; }
.q-ring { position:absolute; width:calc(var(--u)*24); height:calc(var(--u)*24); }
.q-ring svg { width:100%; height:100%; transform:rotate(-90deg); }
.q-ring circle { fill:none; stroke-width:8; stroke:var(--line); }
.q-ring .q-arc { stroke:var(--acc); stroke-linecap:round; }
.q-ring b { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:calc(var(--u)*11); }
.q-answer { position:absolute; max-width:92%; padding:calc(var(--u)*3) calc(var(--u)*6); border-radius:calc(var(--u)*3); background:var(--acc); color:var(--ink); }
.q-a { font-size:calc(var(--u)*5.6); font-weight:700; line-height:1.4; }
.q-ref { font-size:calc(var(--u)*3.2); opacity:.75; margin-top:calc(var(--u)*1); }`;

const quizHTML = (q) => `<div class="q-wrap">
  <div class="q-no">سؤال ${ar(q.index)} / ${ar(q.total)}</div>
  <div class="q-text">${q.q}</div>
  <div class="q-slot">
    <div class="q-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="q-arc" cx="60" cy="60" r="52"/></svg><b></b></div>
    <div class="q-answer"><div class="q-a">${q.a}</div>${q.ref ? `<div class="q-ref">${q.ref}</div>` : ""}</div>
  </div></div>`;

function drawQuiz(s, t) {
  const q = s.quiz, show = P(t, s.units[0].at, 0.5), reveal = P(t, q.reveal, 0.45), LENGTH = 2 * Math.PI * 52;
  const text = $(s.el, ".q-text"), ring = $(s.el, ".q-ring"), arc = $(s.el, ".q-arc"), answer = $(s.el, ".q-answer");
  text.style.opacity = show; text.style.transform = `translateY(${(1 - show) * 30}px)`;
  ring.style.opacity = P(t, q.countdown - 0.3, 0.3) * (1 - P(t, q.reveal, 0.25));
  arc.style.strokeDasharray = LENGTH; arc.style.strokeDashoffset = LENGTH * clamp((t - q.countdown) / q.seconds);
  $(ring, "b").textContent = ar(Math.min(q.seconds, Math.max(1, Math.ceil(q.reveal - t))));
  answer.style.opacity = reveal; answer.style.transform = `scale(${mix(0.8, 1, reveal)})`;
}

// html:   { sceneId: markup }        — quiz scenes need none, they are drawn here
// draw:   { sceneId: (scene, t, units) => … }   — optional per-scene animation, units[k] = { at, dur } of narration line k
// chrome: (t, scene, alpha) => …    — optional: everything outside the scenes (background drift, progress bar, …)
function startVideo({ html, draw = {}, chrome }) {
  window.ready = (async () => {
    const beats = await (await fetch("beats.json")).json();
    Object.assign(window, { WIDTH: beats.width, HEIGHT: beats.height, FPS: beats.fps, DURATION: beats.duration });
    const stage = document.getElementById("stage");
    for (const el of [document.documentElement, document.body, stage]) { el.style.width = WIDTH + "px"; el.style.height = HEIGHT + "px"; }
    stage.style.setProperty("--u", Math.min(WIDTH, HEIGHT) / 100 + "px"); // 1 unit = 1% of the short side
    stage.classList.toggle("portrait", HEIGHT > WIDTH);
    document.head.appendChild(Object.assign(document.createElement("style"), { textContent: QUIZ_CSS }));
    const host = document.getElementById("scenes");
    window.SCENES = beats.scenes.map((s) => {
      const markup = html[s.id] ?? (s.quiz ? quizHTML(s.quiz) : null);
      if (markup === null) throw new Error(`index.html has no markup for scene "${s.id}"`);
      const el = document.createElement("div");
      el.className = "scene"; el.dataset.scene = s.id; el.innerHTML = markup;
      host.appendChild(el);
      for (const r of $$(el, "[data-u]")) if (!s.units[+r.dataset.u]) throw new Error(`scene "${s.id}": data-u="${r.dataset.u}" but the scene has ${s.units.length} narration lines`);
      return { ...s, el, reveals: $$(el, "[data-u]") };
    });
    await document.fonts.ready;
    window.seek(0);
  })();

  window.seek = (t) => {
    for (const s of window.SCENES) {
      const on = t >= s.start && t < s.end;
      s.el.style.display = on ? "block" : "none";
      if (!on) continue;
      // Scenes slide in and out; the first frame and the last frame of the video are fully drawn.
      const enter = s.start === 0 ? 1 : P(t, s.start, 0.5), exit = s.end >= window.DURATION ? 0 : clamp((t - (s.end - 0.3)) / 0.3);
      s.el.style.opacity = enter * (1 - exit);
      s.el.style.transform = `translateX(${(1 - enter) * -70 + exit * 50}px)`;
      // data-u="k": appears when narration line k starts. data-fx="pop" scales in instead of rising.
      for (const el of s.reveals) {
        const p = P(t, s.units[+el.dataset.u].at, 0.55);
        el.style.opacity = p;
        el.style.transform = el.dataset.fx === "pop" ? `scale(${mix(0.7, 1, p)})` : `translateY(${(1 - p) * 34}px)`;
      }
      if (s.quiz && !html[s.id]) drawQuiz(s, t);
      draw[s.id]?.(s, t, s.units);
      chrome?.(t, s, enter * (1 - exit));
    }
  };
}
