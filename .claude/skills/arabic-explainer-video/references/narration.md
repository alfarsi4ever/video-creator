# Writing narration lines

The script is read by Gemini TTS, one request per batch of lines, and the returned audio is cut
back into one clip per line **at the pauses the voice makes at punctuation**. Both the reading and
the cutting depend on how the lines are written.

## Lines that cut cleanly

- **End every line with `.` or `؟`.** A line that ends with a comma or nothing gives the voice no
  reason to pause, and the cut lands in the wrong place.
- **Punctuate inside a line only where a pause is wanted.** The cutter matches "text between
  punctuation marks" to "speech between pauses"; a comma the voice ignores, or a pause with no
  comma, is tolerated, but many of them in one batch make the alignment drift.
- **Avoid one-word lines.** "تهريب." as a line of its own is the classic bad cut. Give it a few
  words ("ويشمل ذلك التهريب.") or join it to its neighbour.
- **One line = one thing appearing on screen.** If two things must appear during one sentence,
  keep it as one line and time the second from the line's duration in a draw function
  (`u[k].at + u[k].dur * 0.6`).
- Aim for lines of 4–20 words. Long legal sentences: split at the natural clause boundary into two
  lines, each a complete sentence.

## Text the voice reads correctly

- **Spell numbers out** as they should be spoken: "خمس سنوات", "المادة السابعة والثلاثون",
  "سبعة وستون على ألفين وستة وعشرين". Digits belong on screen (Arabic-Indic: ٦٧/٢٠٢٦), not in `say`.
- **Latin terms are transliterated in the narration** and shown in Latin on screen:
  say "دوت نت كور", show `.NET Core API`; say "إيه بي آي", show `API`.
- **Add diacritics only where a word is ambiguous** or was misread: "يُعَدّ", "تُظلَّل", "عقدٌ".
  Full tashkeel makes the delivery stiff.
- No abbreviations, no symbols (٪, /, §), no parentheses in `say`.
- What is spoken and what is shown need not be identical: the screen carries the keyword, the
  voice carries the sentence. For a quiz, `q`/`a` are shown and `sayQ`/`sayA` are spoken.

## Delivery

- `CONFIG.style` is the delivery instruction for every line (English works best), e.g.
  `"clear, confident Modern Standard Arabic; measured pace, like a product explainer narrator"`
  for general audiences, `"brisk, confident … like a sharp legal lecturer"` for experts.
- A single line can override it: `{ text: "…", style: "energetic, announcing a new chapter" }`.
  Use this sparingly (section openers, the closing line); a different style on every line sounds
  like different speakers.
- Speed: write for the audience, then set `CONFIG.tempo` — 1.0 as spoken, 1.08 comfortable,
  1.2 brisk for expert viewers. Tempo is applied after synthesis, so changing it costs no quota.
- Voices: Charon (used in both examples), Kore, Puck, Fenrir, Leda, Aoede,
  Callirrhoe, Gacrux, Achird, Sulafat. Keep one voice per video.

## Budget

Roughly 13 spoken letters per second at tempo 1.0; a 1,500-character script is about 2.5 minutes.
Batches are filled in scene order, up to 40 lines or 9,000 characters each; `tts.mjs --list` shows
them. A long video can pin scenes to named batches (`{ id, batch: "s2", say: […] }`, same name on
consecutive scenes) so that editing one section re-synthesizes only that section.
