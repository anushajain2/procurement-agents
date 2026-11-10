// Records the product shots for the short demo at 2x pixel density, logging
// camera framing (real element boxes) and captions for compose.py.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PARSE_INTAKE, SPEC_DRAFT, EVAL_RESULT } from "../mocks.mjs";

const require = createRequire(process.env.PLAYWRIGHT_ROOT || import.meta.url);
const { chromium } = require("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out_product");
const FRAMES = path.join(OUT, "frames");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
const DOCS = path.join(HERE, "docs");
fs.mkdirSync(DOCS, { recursive: true });

const APP = "http://127.0.0.1:5174/";
const W = 2880, H = 1620, Z = 2; // 1440x810 layout rendered at 2x via CSS zoom
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const doc = (name, kb) => { const p = path.join(DOCS, name); fs.writeFileSync(p, Buffer.alloc(kb * 1024, 32)); return p; };
const BOQ_FILES = [doc("HVPNL_Phase-II_BOQ.xlsx", 186), doc("Technical_Specifications_Vol-II.pdf", 4210)];
const VENDOR_FILES = {
  "Voltamp Transformers": [doc("Voltamp_TechBid.pdf", 6120), doc("Voltamp_Commercial.pdf", 812)],
  "EMCO Ltd": [doc("EMCO_Technical.pdf", 5380), doc("EMCO_Commercial.pdf", 640)],
  "Northstar Transformers": [doc("Northstar_Offer.pdf", 9870)],
};

// ── Recorder ─────────────────────────────────────────────────────────────────
const rec = {
  recording: false, shots: [], shot: null, lastFile: null, n: 0,
  now() { const s = this.shot; return (Date.now() - s.wallStart - s.paused - (s.pauseAt ? Date.now() - s.pauseAt : 0)) / 1000; },
  frame(buf) {
    const file = path.join(FRAMES, `f${String(this.n++).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, buf);
    this.lastFile = file;
    if (this.recording && this.shot) this.shot.frames.push({ file, t: this.now() });
  },
  start(name) {
    this.end();
    this.shot = { name, wallStart: Date.now(), paused: 0, pauseAt: null, frames: [], captions: [], cams: [], mouse: [{ t: 0, x: mx, y: my }], clicks: [] };
    if (this.lastFile) this.shot.frames.push({ file: this.lastFile, t: 0 });
    this.recording = true;
  },
  pause() { if (this.recording) { this.shot.pauseAt = Date.now(); this.recording = false; } },
  resume() {
    if (this.recording) return;
    this.shot.paused += Date.now() - this.shot.pauseAt; this.shot.pauseAt = null; this.recording = true;
    if (this.lastFile) this.shot.frames.push({ file: this.lastFile, t: this.now() });
  },
  end() {
    if (!this.shot) return;
    if (!this.recording) this.resume();
    this.shot.duration = this.now();
    const { name, duration, frames, captions, cams, mouse, clicks } = this.shot;
    this.shots.push({ name, duration, frames, captions, cams, mouse, clicks });
    this.shot = null; this.recording = false;
  },
};
const say = (text) => rec.shot.captions.push({ t: rec.now(), text });
const quiet = () => rec.shot.captions.push({ t: rec.now(), text: null });
// Camera: ease to frame `box` (CSS px, viewport coords) over `ms`. null = full frame.
async function cam(target, ms = 900, pad = 36) {
  let box = null;
  if (target) {
    if (Array.isArray(target)) {
      const bs = [];
      for (const l of target) bs.push(await l.boundingBox());
      const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
      const x1 = Math.max(...bs.map((b) => b.x + b.width)), y1 = Math.max(...bs.map((b) => b.y + b.height));
      box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    } else if (typeof target.boundingBox === "function") box = await target.boundingBox();
    else box = target;
  }
  rec.shot.cams.push({ t: rec.now(), box, dur: ms / 1000, pad });
}

// ── Cursor overlay ───────────────────────────────────────────────────────────
const OVERLAY = `
(() => {
  const install = () => {
    const st = document.createElement("style");
    // CSS zoom also doubles vh units; halve them so the layout matches 1440x810.
    st.textContent = '[style*="max-height: 90vh"]{max-height:45vh!important}[style*="max-height: 70vh"]{max-height:35vh!important}[style*="min-height: 100vh"]{min-height:50vh!important}aside{height:50vh!important}';
    document.documentElement.appendChild(st);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
})();
`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await context.addInitScript(`document.addEventListener("DOMContentLoaded",()=>{document.documentElement.style.zoom="${Z}"});`);
await context.addInitScript(OVERLAY);
const page = await context.newPage();

const delays = { "parse-intake": 3600, "generate-spec": 3000, evaluate: 2500 };
const bodies = { "parse-intake": PARSE_INTAKE, "generate-spec": SPEC_DRAFT, evaluate: EVAL_RESULT };
await page.route("**/api/**", async (route) => {
  const ep = new URL(route.request().url()).pathname.split("/").pop();
  if (!bodies[ep]) return route.fulfill({ status: 404, body: "{}" });
  await sleep(delays[ep]);
  await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(bodies[ep]) });
});

// ── Interaction helpers ──────────────────────────────────────────────────────
let mx = W * 0.6, my = H * 0.6;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function moveTo(x, y, ms) {
  const d = Math.hypot(x - mx, y - my);
  ms = ms ?? Math.min(650, Math.max(220, d * 0.35));
  const steps = Math.max(8, Math.round(ms / 16));
  const sx = mx, sy = my;
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    const px = sx + (x - sx) * k, py = sy + (y - sy) * k;
    await page.mouse.move(px, py);
    if (rec.recording) rec.shot.mouse.push({ t: rec.now(), x: px, y: py });
    await sleep(ms / steps);
  }
  mx = x; my = y;
}
let SZ = 1; // device px per scrollY unit, measured after load
async function smoothScrollBy(dy, ms = 700) {
  dy = dy / SZ;
  await page.evaluate(([dy, ms]) => new Promise((res) => {
    const y0 = window.scrollY, t0 = performance.now();
    const e = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); window.scrollTo(0, y0 + dy * e(k)); k < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  }), [dy, ms]);
  await sleep(80);
}
async function hover(loc, { dx = 0.5, dy = 0.5, ms } = {}) {
  await loc.waitFor({ state: "visible" });
  const b = await loc.boundingBox();
  await moveTo(b.x + b.width * dx, b.y + b.height * dy, ms);
}
async function click(loc, opts = {}) {
  await hover(loc, opts);
  await sleep(opts.pre ?? 110);
  if (rec.recording) rec.shot.clicks.push({ t: rec.now(), x: mx, y: my });
  await page.mouse.down(); await sleep(60); await page.mouse.up();
  await sleep(opts.post ?? 350);
}
async function type(loc, text, { clear = false, delay = 22 } = {}) {
  await click(loc, { post: 100 });
  if (clear) { await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace"); }
  await loc.pressSequentially(text, { delay });
  await sleep(150);
}
const nav = (label) => page.locator("aside button", { hasText: label }).first();
const btn = (name) => page.getByRole("button", { name }).first();
async function switchUser(name) { // off-camera only
  await page.locator("header button").last().click(); await sleep(250);
  const menu = page.locator("div", { hasText: /^Switch acting user \(demo\)/ }).last().locator("xpath=..");
  await menu.getByText(name, { exact: true }).dispatchEvent("mousedown"); await sleep(300);
}
async function approveAs(name, note) { // off-camera only
  await switchUser(name);
  await nav("Approvals").click(); await sleep(300);
  await btn("Review").click(); await sleep(400);
  await btn("Approve").click(); await sleep(150);
  if (note) await page.locator("textarea").fill(note);
  await btn("Confirm approval").click(); await sleep(400);
}
const hold = (ms) => sleep(ms);

// ── Demo state ───────────────────────────────────────────────────────────────
await page.goto(APP); await sleep(1200);
await page.evaluate(() => {
  const rq = JSON.parse(localStorage.getItem("procura.requests.v3"));
  localStorage.setItem("procura.requests.v3", JSON.stringify(rq.filter((r) => r.id !== "r_demo01")));
  const pj = JSON.parse(localStorage.getItem("procura.projects.v3"));
  pj.forEach((p) => { p.packages = (p.packages || []).filter((k) => !/10 MVA Power Transformer/.test(k.title)); });
  localStorage.setItem("procura.projects.v3", JSON.stringify(pj));
  localStorage.setItem("procura.specs.v1", "[]");
});
await page.reload(); await sleep(1500);
await page.mouse.move(mx, my);
{ await nav("Requests").click(); await sleep(400);
  const l = page.getByText("Numerical Protection Relays").first(); const a = await l.boundingBox();
  await page.evaluate(() => { document.body.style.minHeight = "4000px"; window.scrollTo(0, 100); }); await sleep(150);
  const b2 = await l.boundingBox(); SZ = (a.y - b2.y) / 100;
  await page.evaluate(() => { document.body.style.minHeight = ""; window.scrollTo(0, 0); }); await sleep(150);
  console.log("scroll factor", SZ); }
const scrollElTo = async (loc, top) => { const b = await loc.boundingBox(); await page.evaluate((d) => window.scrollBy(0, d), (b.y - top) / SZ); await sleep(250); };

const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  rec.frame(Buffer.from(data, "base64"));
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

// ════════════════════════════════════════════════════════════════════════════
// P0 · Intake
await nav("New Evaluation").click(); await sleep(700);
rec.start("intake");
await cam(page.locator("main"), 0);
say("Drop in the requisition or BOQ, in any format.");
await hover(page.getByText("Drop your requirement documents"), { ms: 500 });
await page.locator('input[type="file"]').first().setInputFiles(BOQ_FILES);
await hold(1900);
await click(btn("Parse requirement"), { post: 200 });
await sleep(150);
await cam(page.getByText("Reading your requirement").locator("xpath=ancestor::div[4]"), 700, 60);
say("Claude reads it, extracts every line item, and groups them for evaluation.");
await page.getByText("Select items to proceed with").waitFor({ timeout: 30000 });
await sleep(200);
await cam([page.getByText("Bill of Quantities").first(), page.getByText("Combined sheet").first()], 900, 30);
await hover(page.getByText("Own sheet").first(), { ms: 500 });
await hold(1300);
await hover(page.getByText("Combined sheet").first(), { ms: 450 });
await hold(1500);
rec.pause();
await page.getByText("Cables, Earthing & Lighting (commodity items)").first().click();
await page.getByText("11 kV VCB Switchgear", { exact: true }).first().click();
await btn("Continue").click(); await sleep(400);
await page.getByText("I already have vendor responses").click(); await sleep(500);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);

// P1 · Vendor bids
rec.start("vendors");
await btn("Add vendor").click(); await sleep(300);
await cam([page.getByText("Vendor responses").first(), btn("Run Bid Evaluation"), page.locator('input[placeholder="Vendor name"]').first()], 0, 34);
say("Add every vendor's technical and commercial bid.");
const names = Object.keys(VENDOR_FILES);
const nameInputs = page.locator('input[placeholder="Vendor name"]');
for (let i = 0; i < names.length; i++) {
  await type(nameInputs.nth(i), names[i], { clear: true, delay: 16 });
  await page.locator('input[type="file"]').nth(i).setInputFiles(VENDOR_FILES[names[i]]);
  await hold(250);
}
await hold(500);
await click(btn("Run Bid Evaluation"), { post: 300 });
rec.pause();
await btn("Review →").waitFor({ timeout: 30000 });
await btn("Review →").click(); await sleep(900);
const sheetHead = page.getByText(/_Power_Transformers\.xlsx/).first();
await scrollElTo(sheetHead, 140);

// P2 · Comparison sheet
rec.start("sheet");
await cam(null, 0);
say("In minutes: every requirement, every vendor, a compliance verdict on each.");
await hold(1400);
const perf = page.locator("tr", { hasText: "No-load Loss" });
const constr = page.locator("tr", { hasText: "Winding Material" });
await cam([page.locator("tr", { hasText: "Parameter" }).first(), constr], 2200, 20);
await hover(perf.locator("td").nth(5), { ms: 900 });
await hold(2300);

// P3 · Click to source
say("Click any value to see the exact page and quote it came from.");
await click(page.locator("td", { hasText: /^9\.4 kW$/ }), { post: 400 });
const panel = page.getByText("Source document").locator("xpath=ancestor::div[2]");
await cam([page.locator("td", { hasText: /^9\.4 kW$/ }), page.getByText("Evaluator note:").first()], 1000, 24);
await hold(2600);
await click(page.locator("td", { hasText: /^Aluminium$/ }), { post: 400 });
await cam([page.locator("td", { hasText: /^Aluminium$/ }), page.getByText("Evaluator note:").first()], 700, 24);
await hold(2600);
await click(page.getByText("✕").first(), { post: 300 });

// P4 · Commercial
rec.start("commercial");
await cam(null, 0);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(100);
await scrollElTo(page.getByRole("button", { name: "Commercial" }), 120);
await click(page.getByRole("button", { name: "Commercial" }), { post: 500 });
say("The cheapest bid isn't compliant, and the sheet shows exactly why.");
await cam([page.locator("tr", { hasText: "Parameter" }).first(), page.locator("tr", { hasText: "Offer Validity" })], 900, 24);
await hover(page.locator("td", { hasText: /^₹ 1,61,25,000$/ }), { ms: 600 });
await hold(1200);
await hover(page.locator("td", { hasText: /^24 weeks$/ }), { ms: 400 }); await hold(600);
await hover(page.locator("td", { hasText: /^5%$/ }), { ms: 400 }); await hold(600);
await hover(page.locator("td", { hasText: /^60 days$/ }), { ms: 400 }); await hold(1200);

// P5 · Approvals (earlier levels signed off-camera)
rec.pause();
await page.getByRole("button", { name: "Technical" }).click();
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
await btn("Send for approval").click(); await sleep(400);
await btn("Submit for approval").click(); await sleep(500);
await approveAs("R. Krishnan", "Technically sound. Voltamp is the only fully compliant bid.");
await approveAs("Meera Nair", "Agreed.");
await switchUser("S. Iyer");
await nav("Approvals").click(); await sleep(300);
await btn("Review").click(); await sleep(600);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
rec.start("approval");
await cam([page.getByText("TBE-").first(), page.getByText("Awaiting your decision").locator("xpath=ancestor::div[3]")], 0, 30);
say("It routes through each approver for sign-off, with a full audit trail.");
await hold(800);
await click(btn("Approve"), { post: 250 });
await type(page.locator("textarea"), "Approved within budget.", { delay: 26 });
await click(btn("Confirm approval"), { post: 600 });
await page.getByRole("button", { name: "Approvals" }).last().click(); await sleep(300);
{ const bb = await page.getByText("Fully approved").first().boundingBox(); await smoothScrollBy(bb.y - 150, 700); }
await cam([page.getByText("Fully approved").first(), page.getByText("Approved within budget.").last()], 900, 24);
await hover(page.getByText("Fully approved").first(), { ms: 600 });
await hold(2200);

// P6 · Purchase order
rec.pause();
await switchUser("Anusha Jain"); await sleep(300);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
rec.start("po");
await cam(null, 0);
say("Then issue the purchase order, and track it through to delivery.");
await click(btn("Issue Purchase Order"), { post: 500 });
await cam(page.getByText("Issue Purchase Order").last().locator("xpath=ancestor::div[3]"), 800, 10);
await type(page.locator('input[placeholder="e.g. 18500000 or ₹ 1.85 Cr"]'), "₹ 1.78 Cr", { delay: 40 });
await page.locator('input[type="date"]').fill("2027-03-12");
await hold(700);
await click(btn("Issue PO"), { post: 900 });
await cam(null, 0);
const pkgs = page.getByText("Procurement packages", { exact: true });
{ const b = await pkgs.boundingBox(); await smoothScrollBy(b.y - 180, 800); }
const row = page.getByText("33/11 kV, 10 MVA Power Transformer").first();
await cam([pkgs, page.getByText("PO-", { exact: false }).last()], 900, 24);
await hover(row, { ms: 600 });
await hold(2400);

rec.end();
await cdp.send("Page.stopScreencast").catch(() => {});
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify({ W, H, Z, shots: rec.shots }, null, 1));
console.log(rec.shots.map((s) => `${s.name}: ${s.duration.toFixed(1)}s, ${s.frames.length} frames`).join("\n"));
await browser.close();
