// Renders the static visual assets (background, window mask, captions, cards)
// as PNGs with Chromium so typography matches the app.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(process.env.PLAYWRIGHT_ROOT || import.meta.url);
const { chromium } = require("playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(HERE, "out", "assets");
fs.mkdirSync(A, { recursive: true });
const segs = JSON.parse(fs.readFileSync(path.join(HERE, "out", "timeline.json"), "utf8"));

export const WIN = { x: 160, y: 22, w: 1600, h: 900, r: 16 };
const LAYERS = "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
const FONT = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;
const base = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}`;
const BG = `background:radial-gradient(1200px 700px at 50% 38%, #26262C 0%, #141417 55%, #0C0C0E 100%)`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
async function shot(file, html, { w = 1920, h = 1080, transparent = false } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head>${FONT}<style>${base}</style></head><body style="width:${w}px;height:${h}px;${transparent ? "background:transparent" : ""}">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(A, file), omitBackground: transparent });
}

// Background with the window's shadow baked in.
await shot("bg.png", `<div style="position:absolute;inset:0;${BG}"></div>
  <div style="position:absolute;left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${WIN.h}px;border-radius:${WIN.r}px;background:#fff;
    box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)"></div>`);
// Rounded-corner alpha mask for the app frames.
await shot("mask.png", `<div style="position:absolute;inset:0;background:#000"></div>
  <div style="position:absolute;inset:0;border-radius:${WIN.r}px;background:#fff"></div>`, { w: WIN.w, h: WIN.h });

// Captions (rendered into the band under the window).
const CAP_H = 1080 - (WIN.y + WIN.h);
const capHtml = (label, text) => `<div style="height:${CAP_H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:0 220px;text-align:center">
  <div style="font-size:14px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9CA3AF">${esc(label)}</div>
  <div style="font-size:29px;font-weight:500;color:#F4F4F5;line-height:1.3;letter-spacing:-.01em">${esc(text)}</div></div>`;
let ci = 0;
for (const s of segs) for (const c of s.captions) {
  if (!c.text) continue;
  c.png = `cap_${String(ci++).padStart(3, "0")}.png`;
  await shot(c.png, capHtml(c.label || "", c.text), { h: CAP_H, transparent: true });
}
fs.writeFileSync(path.join(HERE, "out", "timeline.json"), JSON.stringify(segs, null, 1));

// Title / chapter cards.
const logo = (size) => `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.26}px;background:#F4F4F5;display:flex;align-items:center;justify-content:center">
  <svg width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${LAYERS}"/></svg></div>`;
const card = (inner) => `<div style="position:absolute;inset:0;${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;color:#F4F4F5;text-align:center">${inner}</div>`;

await shot("card_intro.png", card(`
  <div style="display:flex;align-items:center;gap:26px;margin-bottom:34px">${logo(96)}
    <div style="text-align:left"><div style="font-size:84px;font-weight:700;letter-spacing:-.035em;line-height:1">Oton</div>
    <div style="font-size:17px;letter-spacing:.3em;text-transform:uppercase;color:#9CA3AF;margin-top:10px">AI Procurement Suite</div></div></div>
  <div style="font-size:40px;font-weight:600;letter-spacing:-.02em;max-width:1300px;line-height:1.25">Turn procurement documents into decisions<br>you can trace and sign off.</div>
  <div style="font-size:22px;color:#A1A1AA;margin-top:26px">Requisition → RFQ → Bid evaluation → Approval → Purchase order</div>`));

await shot("card_bids.png", card(`
  <div style="font-size:16px;letter-spacing:.3em;text-transform:uppercase;color:#9CA3AF;margin-bottom:22px">Three weeks later</div>
  <div style="font-size:64px;font-weight:700;letter-spacing:-.03em">The bids are in.</div>
  <div style="font-size:24px;color:#A1A1AA;margin-top:22px">Three vendors, hundreds of pages. Let's evaluate them.</div>`));

const pill = (t) => `<span style="display:inline-block;padding:12px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);font-size:22px;font-weight:500">${t}</span>`;
await shot("card_outro.png", card(`
  <div style="margin-bottom:30px">${logo(84)}</div>
  <div style="font-size:60px;font-weight:700;letter-spacing:-.03em;margin-bottom:16px">Oton</div>
  <div style="font-size:30px;font-weight:500;color:#D4D4D8;margin-bottom:44px">Every value traceable to the page it came from.</div>
  <div style="display:flex;gap:14px;align-items:center;color:#71717A;font-size:22px">
    ${pill("Intake")} → ${pill("RFQ")} → ${pill("Bid evaluation")} → ${pill("Approval")} → ${pill("Purchase order")}</div>
  <div style="font-size:18px;color:#71717A;margin-top:56px;letter-spacing:.06em">Powered by Claude</div>`));

await browser.close();
console.log("assets ok", ci, "captions");
