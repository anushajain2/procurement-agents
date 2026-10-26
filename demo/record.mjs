// Drives the real Oton UI with Playwright and captures a high-quality CDP
// screencast. Writes frames + a timeline (segments, captions) to ./out.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PARSE_INTAKE, SPEC_DRAFT, EVAL_RESULT } from "./mocks.mjs";

const require = createRequire(process.env.PLAYWRIGHT_ROOT || import.meta.url);
const { chromium } = require("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const FRAMES = path.join(OUT, "frames");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
const DOCS = path.join(HERE, "docs");
fs.mkdirSync(DOCS, { recursive: true });

const APP = "http://127.0.0.1:5174/";
const W = 1440, H = 810, DPR = 1600 / 1440;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Dummy upload files (names are what the UI shows) ─────────────────────────
const doc = (name, kb) => { const p = path.join(DOCS, name); fs.writeFileSync(p, Buffer.alloc(kb * 1024, 32)); return p; };
const BOQ_FILES = [doc("HVPNL_Phase-II_BOQ.xlsx", 186), doc("Technical_Specifications_Vol-II.pdf", 4210)];
const VENDOR_FILES = {
  "Voltamp Transformers": [doc("Voltamp_TechBid.pdf", 6120), doc("Voltamp_Commercial.pdf", 812)],
  "EMCO Ltd": [doc("EMCO_Technical.pdf", 5380), doc("EMCO_Commercial.pdf", 640)],
  "Northstar Transformers": [doc("Northstar_Offer.pdf", 9870)],
};

// ── Recorder: frames, segments, pauses, captions ─────────────────────────────
const rec = {
  recording: false, segs: [], seg: null, lastFile: null, n: 0,
  now() { const s = this.seg; return (Date.now() - s.wallStart - s.paused - (s.pauseAt ? Date.now() - s.pauseAt : 0)) / 1000; },
  frame(buf) {
    const file = path.join(FRAMES, `f${String(this.n++).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, buf);
    this.lastFile = file;
    if (this.recording && this.seg) this.seg.frames.push({ file, t: this.now() });
  },
  segment(name) {
    this.end();
    this.seg = { name, wallStart: Date.now(), paused: 0, pauseAt: null, frames: [], captions: [] };
    if (this.lastFile) this.seg.frames.push({ file: this.lastFile, t: 0 });
    this.recording = true;
  },
  pause() { if (this.recording) { this.seg.pauseAt = Date.now(); this.recording = false; } },
  resume() {
    if (this.recording) return;
    this.seg.paused += Date.now() - this.seg.pauseAt; this.seg.pauseAt = null; this.recording = true;
    if (this.lastFile) this.seg.frames.push({ file: this.lastFile, t: this.now() });
  },
  caption(text, label) { this.seg.captions.push({ t: this.now(), text, label }); },
  captionOff() { this.seg.captions.push({ t: this.now(), text: null }); },
  end() {
    if (!this.seg) return;
    if (!this.recording) this.resume();
    this.seg.duration = this.now();
    this.segs.push({ name: this.seg.name, duration: this.seg.duration, frames: this.seg.frames, captions: this.seg.captions });
    this.seg = null; this.recording = false;
  },
};

// ── Cursor overlay (headless Chromium draws no pointer) ──────────────────────
const OVERLAY = `
(() => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const st = document.createElement("style");
    st.textContent = \`
      #__cur{position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
      .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2.5px solid rgba(24,24,27,.55);background:rgba(24,24,27,.10);animation:__rip .55s ease-out forwards}
      @keyframes __rip{from{transform:scale(.35);opacity:1}to{transform:scale(1.25);opacity:0}}
      html{scroll-behavior:auto!important}
    \`;
    document.documentElement.appendChild(st);
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 2.5 L5 19.5 L9.4 15.4 L12.3 21.6 L15.2 20.3 L12.4 14.3 L18.4 14.3 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    document.addEventListener("mousemove", (e) => { c.style.transform = "translate(" + (e.clientX - 5) + "px," + (e.clientY - 2) + "px)"; }, true);
    document.addEventListener("mousedown", (e) => {
      const r = document.createElement("div"); r.className = "__rip";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700);
    }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
})();
`;

// ── Browser + mocks ──────────────────────────────────────────────────────────
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
await context.addInitScript(OVERLAY);
const page = await context.newPage();

const delays = { "parse-intake": 6600, "generate-spec": 8200, evaluate: 7000 };
const bodies = { "parse-intake": PARSE_INTAKE, "generate-spec": SPEC_DRAFT, evaluate: EVAL_RESULT };
await page.route("**/api/**", async (route) => {
  const ep = new URL(route.request().url()).pathname.split("/").pop();
  if (!bodies[ep]) return route.fulfill({ status: 404, body: "{}" });
  await sleep(delays[ep]);
  await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(bodies[ep]) });
});

// ── Interaction helpers ──────────────────────────────────────────────────────
let mx = W / 2, my = H / 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function moveTo(x, y, ms) {
  const d = Math.hypot(x - mx, y - my);
  ms = ms ?? Math.min(900, Math.max(280, d * 0.9));
  const steps = Math.max(8, Math.round(ms / 16));
  const sx = mx, sy = my;
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    await page.mouse.move(sx + (x - sx) * k, sy + (y - sy) * k);
    await sleep(ms / steps);
  }
  mx = x; my = y;
}
async function smoothScrollBy(dy, ms = 700) {
  await page.evaluate(([dy, ms]) => new Promise((res) => {
    const y0 = window.scrollY, t0 = performance.now();
    const e = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); window.scrollTo(0, y0 + dy * e(k)); k < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  }), [dy, ms]);
  await sleep(120);
}
async function scrollToY(y, ms) { const cur = await page.evaluate(() => window.scrollY); await smoothScrollBy(y - cur, ms); }
async function ensureVisible(loc, margin = 110) {
  await loc.waitFor({ state: "visible" });
  const b = await loc.boundingBox();
  if (b.y < margin) await smoothScrollBy(b.y - margin - 40);
  else if (b.y + b.height > H - margin) await smoothScrollBy(b.y + b.height - (H - margin) + 60);
}
async function hover(loc, { dx = 0.5, dy = 0.5, ms } = {}) {
  await ensureVisible(loc);
  const b = await loc.boundingBox();
  await moveTo(b.x + b.width * dx, b.y + b.height * dy, ms);
}
async function click(loc, opts = {}) {
  await hover(loc, opts);
  await sleep(opts.pre ?? 140);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
  await sleep(opts.post ?? 450);
}
async function type(loc, text, { clear = false, delay = 38 } = {}) {
  await click(loc, { post: 150 });
  if (clear) { await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace"); }
  await loc.pressSequentially(text, { delay });
  await sleep(250);
}
const nav = (label) => page.locator("aside button", { hasText: label }).first();
const btn = (name) => page.getByRole("button", { name }).first();
async function switchUser(name) {
  await click(page.locator("header button").last());
  const menu = page.locator("div", { hasText: /^Switch acting user \(demo\)/ }).last().locator("xpath=..");
  await sleep(350);
  await click(menu.getByText(name, { exact: true }), { post: 700 });
}
const say = (text, label) => rec.caption(text, label);
const hold = (ms) => sleep(ms);

// ── Prepare demo state ───────────────────────────────────────────────────────
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

const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  rec.frame(Buffer.from(data, "base64"));
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1600, maxHeight: 900, everyNthFrame: 1 });
await sleep(500);

// ════════════════════════════════════════════════════════════════════════════
// 1 · OVERVIEW
rec.segment("overview");
await hold(600);
say("One workspace for the whole buying cycle: requisition, RFQ, bid evaluation, approval and purchase order.", "Overview");
await hover(page.getByText("Pending evaluations").first(), { ms: 900 });
await hold(700);
await hover(page.getByText("In approval").first());
await hold(600);
await hover(page.getByText("Recent requests").first());
await hold(1200);
say("Evaluations in flight, sign-offs waiting on you, and every project's packages, all in one place.", "Overview");
await hover(nav("Approvals"), { ms: 700 }); await hold(500);
await hover(nav("Projects"), { ms: 450 }); await hold(500);
await hover(nav("Vendors"), { ms: 450 }); await hold(1400);

// 2 · INTAKE
rec.segment("intake");
say("Start with a Purchase Requisition or a Bill of Quantities: PDF, Word, Excel, even scanned pages.", "1 · Intake");
await click(btn("Start new evaluation"), { post: 900 });
await hover(page.getByText("Drop your requirement documents"));
await hold(500);
await page.locator('input[type="file"]').first().setInputFiles(BOQ_FILES);
await hold(1700);
await click(btn("Parse requirement"), { post: 300 });
say("Claude reads the documents, recognises a BOQ, and extracts every line item with its key requirements.", "1 · Intake");
await page.getByText("Select items to proceed with").waitFor({ timeout: 30000 });
await hold(900);
say("It also proposes the comparison sheets: engineered items get their own; simple commodity items are grouped together.", "1 · Intake");
await hover(page.getByText("Own sheet").first(), { ms: 800 });
await hold(1600);
await smoothScrollBy(330, 1300);
await hover(page.getByText("Combined sheet").first());
await hold(1800);
await hover(page.getByText("Four simple commodity items").first());
await hold(1500);
say("Choose what to take forward. Here, the 10 MVA power transformer.", "1 · Intake");
await click(page.getByText("Cables, Earthing & Lighting (commodity items)").first());
await scrollToY(0, 900);
await click(page.getByText("11 kV VCB Switchgear", { exact: true }).first());
await hold(1000);
await click(btn("Continue"), { post: 900 });

// 3 · RFQ
rec.segment("rfq");
say("No vendor quotes yet? Claude drafts the RFQ for you.", "2 · RFQ drafting");
await hover(page.getByText("Create RFQ / vendor inquiry"), { ms: 800 });
await hold(1600);
await click(page.getByText("Draft RFQs"), { post: 300 });
say("It finds the applicable standards, checks their current editions, and writes a full technical specification.", "2 · RFQ drafting");
await page.getByText(/RFQ created/).waitFor({ timeout: 30000 });
await hold(1500);
await click(page.getByText("33/11 kV, 10 MVA Power Transformer", { exact: true }).first(), { post: 1200 });
say("A datasheet where every value shows its basis: the requisition, a standard clause, or engineering practice.", "2 · RFQ drafting");
await hold(1200);
await hover(page.getByText("Standards referenced").first(), { ms: 700 });
await hold(1600);
await smoothScrollBy(300, 1300);
say("Limits taken from code tables that it can't verify are flagged for engineer review. It never guesses them.", "2 · RFQ drafting");
await hover(page.getByText(/values? need engineer confirmation/).first());
await hold(2000);
const note = page.getByText(/EEL-1 loss limit is a code table value/).first();
await ensureVisible(note, 220);
await hover(note);
await hold(2200);
say("The engineer checks the licensed standard, enters the limits, and confirms them.", "2 · RFQ drafting");
for (const [param, val] of [["No-load Loss (max)", "≤ 9"], ["Load Loss at 75°C (max)", "≤ 55"]]) {
  const tr = page.locator("tr", { hasText: param });
  await type(tr.locator("input"), val, { clear: true, delay: 90 });
  await click(tr.getByRole("button", { name: "Confirm" }), { post: 700 });
}
await hold(600);
await hover(page.getByText(/All values confirmed/).first(), { ms: 800 });
await hold(1600);
await smoothScrollBy(800, 1800);
say("It also writes the specification sections: scope, design, testing, documentation, QA and guarantees.", "2 · RFQ drafting");
await hold(3200);
await smoothScrollBy(700, 1500);
await hold(1800);

// 4 · VENDOR RESPONSES (setup off-camera: same BOQ, transformer only)
rec.segment("responses");
rec.pause();
await nav("New Evaluation").click(); await sleep(500);
await page.getByText("try a sample BOQ").click(); await sleep(500);
await page.getByText("Cables, Earthing & Lighting (commodity items)").first().click();
await page.getByText("11 kV VCB Switchgear", { exact: true }).first().click();
await btn("Continue").click(); await sleep(400);
await page.getByText("I already have vendor responses").click(); await sleep(600);
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
rec.resume();
say("Once the bids are in, add each vendor's technical and commercial documents. Add as many vendors as you need.", "3 · Bid evaluation");
await hold(800);
const names = Object.keys(VENDOR_FILES);
await click(btn("Add vendor"), { post: 600 });
const nameInputs = page.locator('input[placeholder="Vendor name"]');
for (let i = 0; i < names.length; i++) {
  await type(nameInputs.nth(i), names[i], { clear: true, delay: 30 });
  await hover(page.getByText("Drop the vendor's response").nth(i), { ms: 450 });
  await page.locator('input[type="file"]').nth(i).setInputFiles(VENDOR_FILES[names[i]]);
  await hold(650);
}
await hold(900);
await click(btn("Run Bid Evaluation"), { post: 600 });
say("Evaluations run in the background, so you can leave and come back.", "3 · Bid evaluation");
await hover(page.getByText("33/11 kV, 10 MVA Power Transformer").first(), { ms: 800 });
await hold(2600);
rec.pause();
await btn("Review →").waitFor({ timeout: 30000 });
await sleep(400);
rec.resume();
await hold(900);
await click(btn("Review →"), { post: 1300 });

// 5 · COMPARISON SHEET
rec.segment("sheet");
say("Claude builds the technical bid evaluation: every requirement, each vendor's offer, and a compliance verdict for each.", "4 · Comparison sheet");
await hold(1200);
await click(page.getByText("Standards applied"), { post: 900 });
await hold(1600);
const sheetTop = await page.getByText(/_Power_Transformer|\.xlsx/).first().boundingBox();
await smoothScrollBy(sheetTop.y - 70, 1500);
await hold(2600);
say("Click any cell to see where the value came from: the source page, with the exact quote highlighted.", "4 · Comparison sheet");
await click(page.locator("td", { hasText: /^9\.4 kW$/ }), { post: 600 });
await hold(3800);
say("Deviations come with the evaluator's reasoning, so a reviewer can check them in seconds.", "4 · Comparison sheet");
await click(page.locator("td", { hasText: /^Aluminium$/ }), { post: 600 });
await hold(3400);
await click(page.locator("td", { hasText: /^Enclosed — CPRI$/ }), { post: 600 });
await hold(2600);
await click(page.getByText("✕").first(), { post: 600 });
await hold(500);
// Commercial view
say("A commercial comparison is built from the price bids as well.", "4 · Comparison sheet");
await click(page.getByRole("button", { name: "Commercial" }), { post: 900 });
await hold(2600);
say("Northstar is cheapest, but fails on winding material, warranty and delivery. Voltamp is the only fully compliant bid.", "4 · Comparison sheet");
await hover(page.locator("td", { hasText: /^₹ 1,61,25,000$/ }));
await hold(1500);
await click(page.locator("td", { hasText: /^24 weeks$/ }), { post: 600 });
await hold(3200);
await click(page.getByText("✕").first(), { post: 500 });
await click(page.getByRole("button", { name: "Technical" }), { post: 900 });
// Edit
say("Engineers stay in control: edit any value, status or remark before it goes for approval.", "4 · Comparison sheet");
await click(page.getByText("✎ Edit sheet"), { post: 900 });
const typeRow = page.locator("tr", { hasText: "Type Test Reports" });
await type(typeRow.locator('input[placeholder="Add a comment…"]'), "EMCO: obtain type test reports before any award.", { clear: true, delay: 26 });
await hold(900);
await click(page.getByText("✓ Done editing"), { post: 1000 });
await hold(1200);

// Submit for approval
say("Then route it through the approval chain it needs.", "4 · Comparison sheet");
await scrollToY(0, 1000);
await click(btn("Send for approval"), { post: 1000 });
await hold(1600);
await click(btn("Submit for approval"), { post: 1200 });
await hold(800);

// 6 · APPROVALS
rec.segment("approvals");
say("Each approver sees what's waiting on them. The Procurement Manager signs off first.", "5 · Approvals");
await switchUser("R. Krishnan");
await click(nav("Approvals"), { post: 900 });
await hold(1200);
await click(btn("Review"), { post: 1100 });
await hold(800);
await click(btn("Approve"), { post: 500 });
await type(page.locator("textarea"), "Technically sound. Voltamp is the only fully compliant bid.", { delay: 24 });
await click(btn("Confirm approval"), { post: 1200 });
say("It moves up the chain to the Category Head, then the CFO. Each level can approve, reject or send it back.", "5 · Approvals");
await switchUser("Meera Nair");
await click(nav("Approvals"), { post: 800 });
await click(btn("Review"), { post: 900 });
await click(btn("Approve"), { post: 400 });
await click(btn("Confirm approval"), { post: 1000 });
await switchUser("S. Iyer");
await click(nav("Approvals"), { post: 800 });
await click(btn("Review"), { post: 900 });
await click(btn("Approve"), { post: 400 });
await type(page.locator("textarea"), "Approved within budget.", { delay: 30 });
await click(btn("Confirm approval"), { post: 1200 });
say("Every decision is logged, giving a full audit trail from evaluation to award.", "5 · Approvals");
await click(page.getByRole("button", { name: "Approvals" }).last(), { post: 900 });
await hold(2600);
await click(page.getByRole("button", { name: "Activity" }), { post: 900 });
await hold(2600);

// 7 · AWARD & TRACK
rec.segment("award");
say("Fully approved. The engineer issues the purchase order, with its contract terms.", "6 · Award & track");
await switchUser("Anusha Jain");
await click(btn("Issue Purchase Order"), { post: 1000 });
await hold(1200);
await hover(page.getByText("Contract terms").last(), { ms: 700 });
await hold(1500);
await type(page.locator('input[placeholder="e.g. 18500000 or ₹ 1.85 Cr"]'), "₹ 1.78 Cr", { delay: 60 });
const dateIn = page.locator('input[type="date"]');
await click(dateIn, { post: 200 });
await dateIn.fill("2027-03-12");
await hold(900);
await click(btn("Issue PO"), { post: 1500 });
say("The PO lands in its project, where each package is tracked from requisition through delivery to close-out.", "6 · Award & track");
await hold(1500);
const pkgs = page.getByText("Procurement packages", { exact: true });
await ensureVisible(pkgs, 120);
await smoothScrollBy(250, 1000);
await hold(1200);
await click(page.getByText("33/11 kV, 10 MVA Power Transformer").first(), { post: 1200 });
await hold(3400);
await page.keyboard.press("Escape"); await sleep(700);

// 8 · VENDORS
rec.segment("vendors");
say("And see how every supplier has performed across all your evaluations.", "7 · Vendors");
await click(nav("Vendors"), { post: 900 });
await hover(page.getByText("Voltamp Transformers").first(), { ms: 800 });
await hold(2800);
await hover(page.getByText("Northstar Transformers").first());
await hold(2600);

rec.end();
await cdp.send("Page.stopScreencast").catch(() => {});
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(rec.segs, null, 1));
console.log(rec.segs.map((s) => `${s.name}: ${s.duration.toFixed(1)}s, ${s.frames.length} frames, ${s.captions.length} captions`).join("\n"));
await browser.close();
