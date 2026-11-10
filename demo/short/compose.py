"""Turn the recorded product shots into 1920x1080 clips: virtual camera
(eased zooms onto logged element boxes), a smooth 30fps cursor with click
ripples, and caption pills. Usage: python3 compose.py [shot ...] [--still]"""
import bisect, json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "out_product")
OUT = os.path.join(HERE, "out_clips")
os.makedirs(OUT, exist_ok=True)
FPS, OW, OH = 30, 1920, 1080
MAX_ZOOM = 1.5
CAP_FREE = 0.86  # share of the frame above the caption pill
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"

meta = json.load(open(os.path.join(SRC, "shots.json")))
SW, SH, Z = meta["W"], meta["H"], meta["Z"]


def ease(t):
    t = max(0.0, min(1.0, t))
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def frame_rect(box, pad):
    """Smallest 16:9 source rect containing box+pad, within zoom limits."""
    if box is None:
        return (0.0, 0.0, float(SW), float(SH))
    pad *= Z
    w, h = box["width"] + 2 * pad, box["height"] + 2 * pad
    W = max(w, (h / CAP_FREE) * 16 / 9, SW / MAX_ZOOM)
    W = min(W, SW)
    H = W * 9 / 16
    # Centre the subject in the area above the caption band.
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2 + H * (1 - CAP_FREE) / 2
    x0 = min(max(cx - W / 2, 0), SW - W)
    y0 = min(max(cy - H / 2, 0), SH - H)
    return (x0, y0, W, H)


def camera(cams):
    segs, prev = [], None
    for c in cams:
        target = frame_rect(c["box"], c["pad"])
        start = cam_at(segs, c["t"]) if segs else target
        segs.append((c["t"], c["dur"], start, target))
    return segs


def cam_at(segs, t):
    r = segs[0][2]
    for t0, d, a, b in segs:
        if t < t0:
            break
        p = 1.0 if d <= 0 else ease((t - t0) / d)
        r = tuple(a[i] + (b[i] - a[i]) * p for i in range(4))
    return r


def mouse_at(ms, t):
    ts = [m["t"] for m in ms]
    i = bisect.bisect_right(ts, t) - 1
    if i < 0:
        return ms[0]["x"], ms[0]["y"]
    if i >= len(ms) - 1:
        return ms[-1]["x"], ms[-1]["y"]
    a, b = ms[i], ms[i + 1]
    k = 0 if b["t"] == a["t"] else (t - a["t"]) / (b["t"] - a["t"])
    if b["t"] - a["t"] > 0.25:  # long idle gap: hold, don't drift
        k = 0
    return a["x"] + (b["x"] - a["x"]) * k, a["y"] + (b["y"] - a["y"]) * k


def make_cursor(h=34):
    s = 8
    pts = [(5, 2.5), (5, 19.5), (9.4, 15.4), (12.3, 21.6), (15.2, 20.3), (12.4, 14.3), (18.4, 14.3)]
    big = Image.new("RGBA", (24 * s, 24 * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    P = [(x * s, y * s) for x, y in pts]
    d.polygon(P, fill=(255, 255, 255, 255))
    d.line(P + [P[0]], fill=(255, 255, 255, 255), width=int(3.2 * s), joint="curve")
    inner = [(5.9 * s, 4.8 * s), (5.9 * s, 17.4 * s), (9.7 * s, 13.9 * s), (12.7 * s, 20.3 * s), (14.0 * s, 19.7 * s), (11.1 * s, 13.4 * s), (16.2 * s, 13.4 * s)]
    d.polygon(inner, fill=(17, 17, 17, 255))
    sz = round(24 * h / 21)
    cur = big.resize((sz, sz), Image.LANCZOS)
    shadow = Image.new("RGBA", (sz + 16, sz + 16), (0, 0, 0, 0))
    alpha = cur.split()[3].point(lambda a: a * 0.35)
    shadow.paste(Image.new("RGBA", cur.size, (0, 0, 0, 255)), (8, 10), alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    shadow.alpha_composite(cur, (8, 8))
    hot = (8 + 5 * sz / 24, 8 + 2.5 * sz / 24)
    return shadow, hot


CURSOR, HOT = make_cursor()


def make_caption(text):
    f = ImageFont.truetype(FONT, 34)
    tw = f.getlength(text)
    pw, ph = int(tw + 84), 78
    img = Image.new("RGBA", (pw + 60, ph + 60), (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((30, 36, 30 + pw, 36 + ph), radius=ph // 2, fill=(0, 0, 0, 70))
    img = sh.filter(ImageFilter.GaussianBlur(10))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((30, 30, 30 + pw, 30 + ph), radius=ph // 2, fill=(24, 24, 27, 236))
    d.text((30 + pw / 2, 30 + ph / 2 + 1), text, font=f, fill=(250, 250, 250, 255), anchor="mm")
    return img


def caption_track(caps, dur):
    out = []
    for i, c in enumerate(caps):
        if not c["text"]:
            continue
        end = caps[i + 1]["t"] if i + 1 < len(caps) else dur
        out.append((c["t"], end, make_caption(c["text"])))
    return out


def render(shot, still=False):
    name, dur = shot["name"], shot["duration"]
    frames = shot["frames"]
    fts = [f["t"] for f in frames]
    segs = camera(shot["cams"]) if shot["cams"] else [(0, 0, (0, 0, SW, SH), (0, 0, SW, SH))]
    caps = caption_track(shot["captions"], dur)
    clicks = shot["clicks"]
    n = int(round(dur * FPS))
    times = [n * 0.3 / FPS, n * 0.7 / FPS, (n - 1) / FPS] if still else [i / FPS for i in range(n)]
    ff = None
    if not still:
        ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
                               "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", os.path.join(OUT, f"{name}.mp4")], stdin=subprocess.PIPE)
    cache = {}
    for j, t in enumerate(times):
        fi = max(0, bisect.bisect_right(fts, t) - 1)
        path = frames[fi]["file"]
        if path not in cache:
            cache.clear()
            cache[path] = Image.open(path).convert("RGB")
        src = cache[path]
        x0, y0, w, h = cam_at(segs, t)
        img = src.resize((OW, OH), Image.LANCZOS, box=(x0, y0, x0 + w, y0 + h)).convert("RGBA")
        sc = OW / w
        # Click ripples
        for c in clicks:
            age = t - c["t"]
            if 0 <= age < 0.5:
                p = age / 0.5
                r = 10 + 30 * (1 - (1 - p) ** 2)
                cx, cy = (c["x"] - x0) * sc, (c["y"] - y0) * sc
                layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
                ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=(24, 24, 27, int(40 * (1 - p))), outline=(24, 24, 27, int(150 * (1 - p))), width=3)
                img.alpha_composite(layer)
        mx, my = mouse_at(shot["mouse"], t)
        px, py = (mx - x0) * sc - HOT[0], (my - y0) * sc - HOT[1]
        if -60 < px < OW and -60 < py < OH:
            img.alpha_composite(CURSOR, (int(round(px)), int(round(py))))
        # Captions
        for a, b, cap in caps:
            if a <= t < b:
                fade = min(1.0, (t - a) / 0.3, (b - t) / 0.3)
                rise = (1 - ease(min(1.0, (t - a) / 0.4))) * 14
                c2 = cap.copy()
                c2.putalpha(c2.split()[3].point(lambda v: int(v * fade)))
                img.alpha_composite(c2, (int((OW - cap.width) / 2), int(OH - cap.height - 34 + rise)))
        rgb = img.convert("RGB")
        if still:
            rgb.save(os.path.join(OUT, f"still_{name}_{j}.png"))
        else:
            ff.stdin.write(rgb.tobytes())
    if ff:
        ff.stdin.close()
        ff.wait()
    print(f"{name}: {dur:.1f}s", flush=True)


args = [a for a in sys.argv[1:] if not a.startswith("--")]
for shot in meta["shots"]:
    if not args or shot["name"] in args:
        render(shot, still="--still" in sys.argv)
