#!/usr/bin/env python3
"""Build a contact sheet (grid of frames) from a rendered video for the critique loop.

Frame times come from beats.json when given: one frame per beat (taken a quarter-beat after the
beat, so motion that lands on the beat has started), thinned evenly to --max frames. With --shots,
one frame per shot instead (shots are delimited by "cut" events). Without beats.json, --count frames
are evenly spaced.

Stdlib only; requires ffmpeg and ffprobe on PATH.

Usage:
    python3 contact_sheet.py out.mp4 [--beats beats.json [--shots]] [--count 12] [--max 36]
                             [--cols 6] [--width 480] [--out contact_sheet.jpg]
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile


def probe_duration(video):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", video],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def times_from_beats(beats_path, duration, shots):
    with open(beats_path) as f:
        data = json.load(f)
    duration = float(data.get("duration", duration))
    if shots:
        cuts = sorted(float(e["t"]) for e in data.get("events", []) if e.get("type") == "cut")
        bounds = [0.0] + [c for c in cuts if 0.0 < c < duration] + [duration]
        return [(a + b) / 2 for a, b in zip(bounds, bounds[1:]) if b > a]
    beat = 60.0 / float(data.get("bpm", 120))
    beats = data.get("beats") or list(frange(0.0, duration, beat))
    return [float(t) + beat / 4 for t in beats if float(t) + beat / 4 < duration]


def thin(times, limit):
    if len(times) <= limit:
        return times
    step = len(times) / float(limit)
    return [times[int(i * step)] for i in range(limit)]


def frange(start, stop, step):
    t = start
    while t < stop - 1e-6:
        yield t
        t += step


def even_times(duration, count):
    step = duration / count
    return [step * (i + 0.5) for i in range(count)]


def fmt(t):
    return "%d:%05.2f" % (int(t // 60), t % 60)


def extract(video, t, path, width):
    base = ["ffmpeg", "-v", "error", "-y", "-ss", "%.3f" % t, "-i", video, "-frames:v", "1"]
    label = "drawtext=text='%s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6" % (
        fmt(t).replace(":", "\\:"))
    scale = "scale=%d:-2" % width
    # drawtext needs a usable font; fall back to an unlabeled frame if it is unavailable.
    for vf in ("%s,%s" % (scale, label), scale):
        if subprocess.run(base + ["-vf", vf, path], capture_output=True).returncode == 0:
            return
    raise RuntimeError("ffmpeg could not extract a frame at %s" % fmt(t))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--beats", help="beats.json with bpm/duration/events")
    ap.add_argument("--shots", action="store_true", help="with --beats: one frame per shot, not per beat")
    ap.add_argument("--count", type=int, default=12, help="frames when no beats.json (default 12)")
    ap.add_argument("--max", type=int, default=36, help="cap on frames sampled from beats.json (default 36)")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--width", type=int, default=480, help="tile width in px")
    ap.add_argument("--out", default="contact_sheet.jpg")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit("error: %s not found on PATH" % tool)

    duration = probe_duration(args.video)
    if args.beats:
        times = thin(times_from_beats(args.beats, duration, args.shots), max(1, args.max))
    else:
        times = even_times(duration, args.count)
    times = [min(t, max(duration - 0.05, 0.0)) for t in times]
    if not times:
        sys.exit("error: no frame times to sample")

    cols = max(1, min(args.cols, len(times)))
    rows = math.ceil(len(times) / cols)
    tmp = tempfile.mkdtemp(prefix="contact_")
    try:
        frames = []
        for i, t in enumerate(times):
            path = os.path.join(tmp, "f%04d.png" % i)
            extract(args.video, t, path, args.width)
            frames.append(path)
        listing = os.path.join(tmp, "list.txt")
        with open(listing, "w") as f:
            for p in frames:
                f.write("file '%s'\n" % p)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing,
             "-vf", "tile=%dx%d:padding=4:color=black" % (cols, rows), "-frames:v", "1", args.out],
            check=True,
        )
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print("wrote %s (%d frames, %dx%d)" % (args.out, len(times), cols, rows))
    for i, t in enumerate(times, 1):
        print("  %2d  %s" % (i, fmt(t)))


if __name__ == "__main__":
    main()
