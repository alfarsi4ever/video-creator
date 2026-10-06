# Source notes

## Source

- **Video:** "How to Make Insane Motion Graphics With Opus 5.5" -- Lukas Margerie (YouTube,
  uploaded 2026-09-29, 20:16). https://youtu.be/747ZnEtsRbg
- **Official chapters:** 0:00 Intro, 1:16 How Opus 5.5 makes videos, 3:59 Motion studio rules,
  5:20 Adding a real brand, 7:46 Fish Audio (sponsor), 10:20 Sound, 10:56 Reference videos,
  16:17 Director's brief and critique loop.
- The creator sells a kit with the exact prompts, rule files and templates. **This skill does not
  contain them.** The rules, brief template and rubric here are written independently from the
  workflow the video describes.

## How the content was extracted

- Title, description and chapters: YouTube metadata via yt-dlp.
- Visual check: YouTube storyboard thumbnails (160x90), which confirmed the general scenes
  (workflow diagrams, Claude Code sessions, brand pages, rendered launch frames) but were too small to read text.
- Detailed content: Gemini (`gemini-3.7-flash`) watching the YouTube URL directly. The spoken
  transcript and full-resolution video could not be downloaded from the cloud environment.

## What came from the video (as reported by Gemini)

- Opus writes code, not video files; four render routes (code-drawn with headless Chrome + FFmpeg,
  Remotion/HyperFrames, mixed image/video models, footage editing); code-drawn is the model's default.
- A rules file with four parts: render contract (seekable, deterministic frames, no CSS transitions),
  banned generic patterns (centered text on gradients, fade-everything, particle bursts, multiple
  accents), sound (BPM grid, SFX on clicks/transitions, about -14 LUFS), and a feedback loop.
- Real brand inputs captured with Playwright; reference-video style extraction by sampling frames every 0.5 s.
- Voiceover through a TTS MCP server (the sponsor, Fish Audio).
- 120 BPM beat grid with a `beats.json` of downbeats and click times.
- A director's brief covering the one-line film, references, tools, character/asset bible, beat sheet,
  on-screen text, workflow gates, critique thresholds and deliverables.
- Critique loop: contact sheet per beat, 7 axes (Hook, Readability, Motion quality, Variety, Brand,
  Sound, Depth), fix the 3 worst flaws, iterate to >= 8/10.
- Packaging the pipeline as a reusable Claude Code skill.

## Caveats

Gemini's chapter times drifted by up to about a minute from the official chapters, and it reported
some specifics (exact section counts, model-call totals) that could not be checked. Those
unverifiable specifics were left out of this skill.
