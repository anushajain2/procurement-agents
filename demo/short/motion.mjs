// Renders each motion-graphics scene in motion.html frame by frame to MP4.
// Usage: node motion.mjs [scene ...]   (default: all)   --stills renders 3 stills per scene instead
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(process.env.PLAYWRIGHT_ROOT || import.meta.url);
const { chromium } = require("playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out_motion");
fs.mkdirSync(OUT, { recursive: true });
const FPS = 30;
const args = process.argv.slice(2);
const stills = args.includes("--stills");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file://" + path.join(HERE, "motion.html"));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const names = args.filter((a) => !a.startsWith("--"));
const scenes = names.length ? names : await page.evaluate(() => window.sceneNames());

for (const name of scenes) {
  const dur = await page.evaluate((n) => window.buildScene(n), name);
  await page.evaluate(() => document.fonts.ready);
  if (stills) {
    for (const f of [0.35, 0.65, 0.97]) {
      await page.evaluate((t) => window.renderAt(t), dur * f);
      await page.screenshot({ path: path.join(OUT, `still_${name}_${Math.round(f * 100)}.png`) });
    }
    console.log("stills", name);
    continue;
  }
  const out = path.join(OUT, `${name}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS), out], { stdio: ["pipe", "inherit", "inherit"] });
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`${name}: ${dur}s (${n} frames)`);
}
await browser.close();
