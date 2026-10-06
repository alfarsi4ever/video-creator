#!/usr/bin/env python3
"""Build a synthesized music bed + SFX from beats.json and master it to a loudness target.

Everything is generated with ffmpeg's lavfi sources -- no samples, no numpy. The bed is a simple
kick / hat / bass / pluck pattern on the beat grid; SFX are placed on beats.json events:

    {"t": 1.0, "type": "click"}                 -> sfx chosen from type
    {"t": 1.5, "type": "wipe", "sfx": "whoosh"} -> explicit sfx wins

SFX names: kick, click, whoosh, chime, hit. Types map to SFX as: click->click, wipe/transition->whoosh,
reveal/chime->chime, hit/cut->hit. Unknown types without an "sfx" are silent.

Mastering does a measured gain to the integrated-loudness target, then a 4x-oversampled limiter so
the true peak stays under the ceiling (single-pass loudnorm undershoots on short clips).

Stdlib only; requires ffmpeg. Usage:
    python3 audio.py [--beats beats.json] [--out audio.wav] [--no-bed] [--voice vo.wav]
                     [--lufs -14] [--tp -1.5] [--key A]
"""

import argparse
import json
import os
import re
import subprocess
import sys

NOTES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}

# name: (lavfi source, extra filters, gain)
SOURCES = {
    "kick": ("aevalsrc='sin(2*PI*(50*t+3*(1-exp(-t*30))))*exp(-t*12)':d=0.3", "", 0.9),
    "hat": ("anoisesrc=d=0.06:c=white:seed=3", "highpass=f=7000,afade=t=out:d=0.06", 0.12),
    "bass": ("aevalsrc='tanh(2*sin(2*PI*FREQ*t))*exp(-t*6)':d=0.45", "", 0.3),
    "pluck": ("aevalsrc='(sin(2*PI*FREQ*t)+0.4*sin(4*PI*FREQ*t))*exp(-t*7)':d=0.5", "", 0.18),
    "click": ("aevalsrc='sin(2*PI*1800*t)*exp(-t*60)':d=0.08", "", 0.8),
    "whoosh": ("anoisesrc=d=0.5:c=pink:seed=5",
               "highpass=f=600,lowpass=f=6000,afade=t=in:d=0.35:curve=qua,afade=t=out:st=0.35:d=0.15", 0.45),
    "chime": ("aevalsrc='(sin(2*PI*1047*t)+0.5*sin(2*PI*1568*t)+0.3*sin(2*PI*2093*t))*exp(-t*4)':d=1.0", "", 0.3),
    "hit": ("aevalsrc='sin(2*PI*(45*t+4*(1-exp(-t*25))))*exp(-t*6)':d=0.6", "", 0.9),
}
TYPE_TO_SFX = {"click": "click", "tap": "click", "wipe": "whoosh", "transition": "whoosh",
               "reveal": "chime", "chime": "chime", "hit": "hit", "cut": "hit"}


def hz(semitones_from_a4):
    return 440.0 * 2 ** (semitones_from_a4 / 12.0)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def measure(path):
    """Return (integrated LUFS, true peak dBTP) using ffmpeg's ebur128 filter."""
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
               "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    summary = err[err.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary)
    tp = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    to_f = lambda m: float("-inf") if not m or m.group(1) == "-inf" else float(m.group(1))
    return to_f(i), to_f(tp)


def build_mix(beats, out, bed, voice, key):
    dur = float(beats["duration"])
    bpm = float(beats.get("bpm", 120))
    beat_times = beats.get("beats") or [i * 60.0 / bpm for i in range(int(dur * bpm / 60.0))]
    half = 30.0 / bpm
    root = NOTES[key] - 9  # semitones from A
    bass_prog = [root - 24, root - 24, root - 21, root - 26]  # i, i, iii, VII-ish
    arp = [root, root + 3, root + 7, root + 3]

    hits = []
    if bed:
        for i, t in enumerate(beat_times):
            hits += [(t, "kick", None), (t + half, "hat", None),
                     (t, "bass", hz(bass_prog[(i // 2) % 4])), (t + half, "pluck", hz(arp[i % 4]))]
    for e in beats.get("events", []):
        name = e.get("sfx") or TYPE_TO_SFX.get(e.get("type", ""))
        if name in SOURCES:
            hits.append((float(e["t"]), name, None))
    hits = [h for h in hits if h[0] < dur]
    if not hits and not voice:
        sys.exit("error: nothing to mix (no bed, no SFX events, no voice)")

    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    chains, labels = [], []
    for i, (t, name, freq) in enumerate(hits):
        src, flt, gain = SOURCES[name]
        cmd += ["-f", "lavfi", "-i", src.replace("FREQ", "%.2f" % (freq or 0))]
        pre = flt + "," if flt else ""
        chains.append("[%d]%svolume=%s,adelay=%d:all=1,apad=whole_dur=%s[a%d]" % (i, pre, gain, int(t * 1000), dur, i))
        labels.append("[a%d]" % i)
    music = "".join(labels)
    graph = chains
    if hits:
        graph.append("%samix=inputs=%d:normalize=0,atrim=0:%s[m]" % (music, len(hits), dur))
    if voice:
        vi = len(hits)
        cmd += ["-i", voice]
        graph.append("[%d]aresample=44100,apad=whole_dur=%s,atrim=0:%s[v]" % (vi, dur, dur))
        if hits:
            # Duck the music under the voice.
            graph.append("[v]asplit[v1][v2];[m][v1]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[md];"
                         "[md][v2]amix=inputs=2:normalize=0[mx]")
        else:
            graph.append("[v]anull[mx]")
    else:
        graph.append("[m]anull[mx]")
    graph.append("[mx]afade=t=out:st=%s:d=0.4,aformat=channel_layouts=stereo[o]" % max(0.0, dur - 0.4))
    cmd += ["-filter_complex", ";".join(graph), "-map", "[o]", "-ar", "48000", out]
    res = run(cmd)
    if res.returncode:
        sys.exit("error: ffmpeg mix failed:\n" + res.stderr)


def master(src, out, lufs, tp):
    ceiling = 10 ** ((tp - 0.3) / 20.0)  # small margin for resampling overshoot
    gain = 0.0
    for _ in range(3):
        af = ("volume=%.2fdB,aresample=192000,alimiter=limit=%.4f:attack=1:release=50:level=false,"
              "aresample=48000" % (gain, ceiling))
        res = run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, out])
        if res.returncode:
            sys.exit("error: ffmpeg master failed:\n" + res.stderr)
        i, peak = measure(out)
        if abs(i - lufs) <= 0.5:
            break
        gain += lufs - i
    return measure(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--beats", default="beats.json")
    ap.add_argument("--out", default="audio.wav")
    ap.add_argument("--no-bed", action="store_true", help="SFX (and voice) only, no music bed")
    ap.add_argument("--voice", help="voiceover WAV/MP3 to mix on top (music is ducked under it)")
    ap.add_argument("--lufs", type=float, default=-14.0, help="integrated loudness target")
    ap.add_argument("--tp", type=float, default=-1.5, help="true-peak ceiling in dBTP")
    ap.add_argument("--key", default="A", choices=sorted(NOTES), help="musical key of the bed")
    args = ap.parse_args()

    with open(args.beats) as f:
        beats = json.load(f)
    mix = args.out + ".mix.wav"
    build_mix(beats, mix, not args.no_bed, args.voice, args.key)
    i, peak = master(mix, args.out, args.lufs, args.tp)
    os.remove(mix)
    ok = abs(i - args.lufs) <= 1.0 and peak <= args.tp + 0.5
    print("wrote %s: %.1f LUFS integrated, %.1f dBTP true peak%s"
          % (args.out, i, peak, "" if ok else "  (WARNING: outside target)"))


if __name__ == "__main__":
    main()
