"""Composite the recorded segments, captions and cards into the final MP4."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
A = os.path.join(OUT, "assets")
CLIPS = os.path.join(OUT, "clips")
os.makedirs(CLIPS, exist_ok=True)
FPS, FADE = 30, 0.6
WIN_X, WIN_Y, CAP_Y = 160, 22, 922
SPEED = {"approvals": 1.25}  # gently compress the repetitive sign-offs
CARDS = {"intro": ("card_intro.png", 5.0), "bids": ("card_bids.png", 3.2), "outro": ("card_outro.png", 5.5)}
ORDER = ["intro", "overview", "intake", "rfq", "bids", "responses", "sheet", "approvals", "award", "vendors", "outro"]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-3000:])


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())


def render_segment(seg):
    name, dur, sp = seg["name"], seg["duration"], SPEED.get(seg["name"], 1.0)
    frames = seg["frames"]
    lst = os.path.join(CLIPS, f"{name}.txt")
    with open(lst, "w") as f:
        for i, fr in enumerate(frames):
            nxt = frames[i + 1]["t"] if i + 1 < len(frames) else dur
            d = nxt - fr["t"]
            if d <= 0:
                continue
            f.write(f"file '{fr['file']}'\nduration {d:.4f}\n")
        f.write(f"file '{frames[-1]['file']}'\n")

    out_dur = dur / sp
    caps = []
    cs = seg["captions"]
    for i, c in enumerate(cs):
        if not c["text"]:
            continue
        end = cs[i + 1]["t"] if i + 1 < len(cs) else dur
        caps.append((c["png"], c["t"] / sp, min(end / sp, out_dur)))

    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst,
           "-loop", "1", "-i", os.path.join(A, "bg.png"),
           "-loop", "1", "-i", os.path.join(A, "mask.png")]
    for png, *_ in caps:
        cmd += ["-loop", "1", "-i", os.path.join(A, png)]
    fc = [f"[0:v]setpts=(PTS-STARTPTS)/{sp},fps={FPS},scale=1600:900:flags=lanczos,format=rgba[app]",
          "[2:v]format=gray[m]", "[app][m]alphamerge[aw]",
          f"[1:v][aw]overlay={WIN_X}:{WIN_Y}:shortest=0[v0]"]
    prev = "v0"
    for k, (png, a, b) in enumerate(caps):
        fi = min(0.3, (b - a) / 3)
        fc.append(f"[{3 + k}:v]format=rgba,fade=in:st={a:.3f}:d={fi:.3f}:alpha=1,fade=out:st={b - fi:.3f}:d={fi:.3f}:alpha=1[c{k}]")
        fc.append(f"[{prev}][c{k}]overlay=0:{CAP_Y}:enable='between(t,{a:.3f},{b:.3f})'[v{k + 1}]")
        prev = f"v{k + 1}"
    fc.append(f"[{prev}]format=yuv420p[vout]")
    out = os.path.join(CLIPS, f"{name}.mp4")
    run(cmd + ["-filter_complex", ";".join(fc), "-map", "[vout]", "-t", f"{out_dur:.3f}", "-r", str(FPS),
               "-c:v", "libx264", "-preset", "medium", "-crf", "17", out])
    return out


def render_card(key):
    png, d = CARDS[key]
    out = os.path.join(CLIPS, f"card_{key}.mp4")
    # A slow push-in keeps the card alive.
    zoom = f"scale=2112:1188,zoompan=z='1+0.025*on/({d}*{FPS})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps={FPS}"
    run(["ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-i", os.path.join(A, png), "-vf", f"{zoom},format=yuv420p",
         "-t", str(d), "-c:v", "libx264", "-preset", "medium", "-crf", "17", out])
    return out


segs = {s["name"]: s for s in json.load(open(os.path.join(OUT, "timeline.json")))}
clips = []
for key in ORDER:
    path = render_card(key) if key in CARDS else render_segment(segs[key])
    clips.append((path, probe(path)))
    print(f"{key:10s} {clips[-1][1]:6.1f}s", flush=True)

cmd = ["ffmpeg", "-y"]
for p, _ in clips:
    cmd += ["-i", p]
fc, prev, offset = [], "0:v", 0.0
for i in range(1, len(clips)):
    offset += clips[i - 1][1] - FADE
    fc.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={FADE}:offset={offset:.3f}[x{i}]")
    prev = f"x{i}"
total = offset + clips[-1][1]
fc.append(f"[{prev}]fade=in:st=0:d=0.8,fade=out:st={total - 1.0:.3f}:d=1.0,format=yuv420p[vout]")
final = os.path.join(HERE, "oton_demo.mp4")
run(cmd + ["-filter_complex", ";".join(fc), "-map", "[vout]", "-r", str(FPS), "-c:v", "libx264", "-preset", "slow",
           "-crf", "18", "-movflags", "+faststart", final])
print(f"final {probe(final):.1f}s -> {final}")
