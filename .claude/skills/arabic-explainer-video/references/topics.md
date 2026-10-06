# Any topic: story shapes and scene patterns

The pipeline does not care what the video is about. What changes with the subject is **how the
story is shaped** (which scenes, in which order) and **which visual device carries each scene**.
Pick the shape first, then write `script.mjs` to it.

## Story shapes

| Kind of video | Shape (one row = one scene or a short run of scenes) | Delivery (`CONFIG.style`) |
|---|---|---|
| **History / timeline** ("تاريخ …", "أهم حكام …", "قصة …") | hook → where and when (map or date rail) → one scene per period, person or event, in time order → what it left behind → closing line | documentary narrator: warm, measured, a little gravity |
| **Biography / profile** | hook (the one thing they are known for) → origin → 3–5 turning points → legacy | documentary narrator |
| **"Top N" / list** ("أفضل خمسة …", "أهم …") | hook → criterion of the selection → one scene per item (same layout, counted) → recap of all N | lively presenter |
| **Science / "how does it work"** | question → the wrong intuition → mechanism in steps (one moving diagram) → everyday example → answer in one sentence | curious teacher |
| **School lesson** (maths, grammar, science) | goal of the lesson → rule → worked example, step by step → second example → quiz → recap | friendly teacher, steady pace |
| **Law / regulation / policy** | who it concerns → what changed → the rules, grouped → penalties or deadlines → quiz | clear, confident, like a legal lecturer |
| **System / process walkthrough** | the problem → the actors → the flow, step by step (one mock reused in several states) → the result | product explainer narrator |
| **Comparison / decision** | the choice → criteria → side by side, one criterion per line → verdict and for whom | balanced, analytical |
| **How-to / guide** | result first → what you need → numbered steps → common mistake → recap | practical, encouraging |
| **News or event recap** (a match, a tournament, a launch) | headline → the events in order with scores/dates → the turning point → what comes next | energetic sports/news presenter |
| **Product / service / announcement** | the pain → the product in one line → three things it does (show, don't list) → call to action | upbeat, confident |
| **Story / awareness message** | a person and a situation → the complication → the turn → the message in one sentence | storyteller, intimate |

A hook is one or two lines that make the viewer want the rest: a question, a surprising number, a
contrast. It is never "في هذا الفيديو سنتحدث عن …".

Length follows the idea, not the other way round: one idea ≈ one scene ≈ 10–20 s. A phone video
people finish is 1–3 minutes; split anything longer into a series (same look, numbered episodes).

## Getting the material

- **The user's document** (a lesson page, a law, a spec): everything on screen comes from it. Read
  photographed pages carefully and say which numbers you were unsure of.
- **General knowledge** (history, science, people, sport): research before writing. Every date,
  number, name and "first/largest/only" needs a source you actually read; prefer two. List the
  sources in the delivery.
- **Sources disagree** (two dates for the same event, two spellings): use wording that is true
  under both ("في منتصف القرن الثامن عشر"), or leave the detail out — and tell the user.
- **Recent or still-moving subjects** (a tournament in progress, a new law): search for the current
  state, date the video on screen, and end on what is known.
- **Your own selection** ("the most important …", a ranking, a top five) is editorial. Choose by a
  criterion you can state in one line, and say in the delivery that the choice is yours and can be changed.
- **Real people, flags, logos, photographs**: use an image only if the user supplies it or its
  licence allows it, and never draw or generate a likeness of a real person. A name set large, a
  date, a place on a simple map and one line of what they did tell the story without a portrait.
- **Sensitive subjects** (religion, politics, living people, health, law): state what the sources
  state, in neutral wording; no jokes, no speculation, no advice presented as professional opinion.

## Scene patterns

One pattern per scene; vary them (see "Look" in design.md). Each is plain markup plus, where
something moves, a draw function timed from `u`.

| Pattern | Use it for | Built from |
|---|---|---|
| **Title / statement** | hook, section opener, closing line | `h1` + `.lead`; one word in the accent colour |
| **Date rail** | history, biography, any sequence in time | a horizontal or vertical line that grows with `t`; a dot + year + label per event, each on its `data-u`; the current one lit |
| **Profile card** | a person, a place, an organisation, a product | name large, role/era in the accent colour, 2–3 facts appearing line by line; a large year or number as the "portrait" |
| **Big number** | a statistic, a score, a price, a duration | the number at 20–30u counting up over the line that says it (`Math.round(mix(0, n, P(t, at, dur)))`, shown with `ar()`), unit and one caption line |
| **List / steps** | rules, requirements, instructions | cards or rows, one per line; the narrated one lit, earlier ones dimmed |
| **Versus** | comparison, before/after, right/wrong | two columns filled row by row; the verdict row in `--ok` / `--bad` |
| **Diagram with a moving part** | how something works, a flow, cause and effect | boxes at fixed positions + one element whose `left/top` follows `t` (a packet, an arrow, a level) |
| **Simple map** | where something is or spread | an inline SVG outline or a schematic of labelled dots and lines — only shapes you can draw correctly; label it "خريطة توضيحية" when schematic |
| **Quote** | a saying, an article of law, a definition | the text typed with `type()`, the source underneath |
| **Mock screen / object** | software, a form, a document, a device | one function returning the markup, put into its state per scene (design.md) |
| **Worked example** | maths, grammar, calculation | the expression built token by token; the changed part lit; result on a highlighted slab |
| **Quiz** | checking a lesson or a law | built in — no markup needed |
| **Recap** | last scene of anything longer than a minute | the 3–5 keywords of the video, appearing together |

Notes that save a re-render:

- **Years and numbers on screen** are Arabic-Indic (`ar(1970)` → ١٩٧٠) and are spelled out in `say`.
- **Maths** in Arabic school books runs right to left (٣٢ × ١٠ then the exponent at the upper
  left of ١٠; decimal comma ٢,٥). Copy the notation of the user's book; set each number or operator
  in its own `<span class="ltr">` so digits keep their order while the expression flows RTL.
- **Mood follows the subject**: change `--acc` and the ground colour in the page's `:root` (heritage
  and history: warm sand or deep red on dark; school: light paper with ink text; sport: the team's
  colour; product: the brand's). A light ground needs dark `--text` and softer shadows.
- **Same subject, more than one video**: keep palette, font, chrome and scene patterns from the
  first one; copy its `index.html` as the starting point.
