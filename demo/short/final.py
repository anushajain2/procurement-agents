"""Join motion scenes and product clips into the short demo with crossfades."""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
M, C = os.path.join(HERE, "out_motion"), os.path.join(HERE, "out_clips")
# (clip, crossfade into the next clip)
ORDER = [
    (f"{M}/pile.mp4", 0.45), (f"{M}/copy.mp4", 0.45), (f"{M}/email.mp4", 0.5), (f"{M}/meet.mp4", 0.6),
    (f"{C}/intake.mp4", 0.35), (f"{C}/vendors.mp4", 0.35), (f"{C}/sheet.mp4", 0.35), (f"{C}/commercial.mp4", 0.35),
    (f"{C}/approval.mp4", 0.35), (f"{C}/po.mp4", 0.6), (f"{M}/benefits.mp4", 0.5), (f"{M}/outro.mp4", 0),
]
OUT = os.path.join(HERE, "oton_short_demo.mp4")


def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
    return float(r.stdout)


cmd, fc = ["ffmpeg", "-y", "-loglevel", "error"], []
for i, (p, _) in enumerate(ORDER):
    cmd += ["-i", p]
    fc.append(f"[{i}:v]fps=30,format=yuv420p,settb=AVTB[s{i}]")
prev, off = "s0", 0.0
for i in range(1, len(ORDER)):
    fade = ORDER[i - 1][1]
    off += dur(ORDER[i - 1][0]) - fade
    fc.append(f"[{prev}][s{i}]xfade=transition=fade:duration={fade}:offset={off:.3f}[x{i}]")
    prev = f"x{i}"
total = off + dur(ORDER[-1][0])
fc.append(f"[{prev}]fade=in:st=0:d=0.5,fade=out:st={total - 0.8:.3f}:d=0.8[v]")
r = subprocess.run(cmd + ["-filter_complex", ";".join(fc), "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                          "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT])
if r.returncode:
    sys.exit("ffmpeg failed")
print(f"{OUT}: {dur(OUT):.1f}s")
