// Stand-in responses for the three AI endpoints, shaped exactly like the
// backend's output (see backend/evaluator.py, spec.py, boq.py). Used only to
// record the demo when no ANTHROPIC_API_KEY is available.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_SPECS } from "../frontend/src/specSeed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PARSE_INTAKE = JSON.parse(fs.readFileSync(path.join(here, "sample_boq.json"), "utf8"));

// ── RFQ / technical specification draft ──────────────────────────────────────
const seed = SEED_SPECS[0];
export const SPEC_DRAFT = {
  title: seed.title, equipment: seed.equipment, summary: seed.summary,
  standards: seed.standards, standards_verified: false, used_references: false, model: seed.model,
  parameters: seed.parameters.map((p) =>
    p.parameter === "Tap Changer" ? { ...p, requirement: "OLTC, ±10% in 1.25% steps" }
    : p.parameter === "Insulation Level (HV)" ? { ...p, requirement: "LI 170 / AC 70" }
    : p),
  sections: seed.sections,
};

// ── Vendor source pages (what the extractor would have pulled per page) ─────
const PAGES = {
  "Voltamp_TechBid.pdf": {
    3: `VOLTAMP TRANSFORMERS LTD.
Offer Ref: VTL/HVPNL/2026/0412
GUARANTEED TECHNICAL PARTICULARS
10 MVA, 33/11 kV Power Transformer
--------------------------------------
SECTION 1 : GENERAL
1.1 Type : Core type, oil immersed
1.2 Rated power: 10 MVA, cooling ONAN
1.3 Rated voltage: HV 33 kV / LV 11 kV
1.4 Rated frequency : 50 Hz
1.5 Vector group Dyn11
1.6 Installation : Outdoor
1.7 Applicable standard : IS 2026 /
    IEC 60076`,
    5: `VOLTAMP TRANSFORMERS LTD.
GTP — SECTION 3 : LOSSES & PERFORMANCE
--------------------------------------
3.1 No-load losses guaranteed 8.2 kW
    at rated voltage and frequency
3.2 Load loss 52 kW at 75 deg C
    on principal tap
3.3 Total losses at 50% load : 21.2 kW
3.4 Impedance voltage 10.2% at
    principal tap (IS tolerance)
3.5 Temperature rise: top oil 50 deg C,
    winding 55 deg C over 50 deg C amb.
3.6 Efficiency at unity pf : 99.38%`,
    7: `VOLTAMP TRANSFORMERS LTD.
GTP — SECTION 4 : CONSTRUCTION
--------------------------------------
4.1 Tap changer: On-load tap changer
    +/-10% in 1.25% steps (17 pos.)
4.2 OLTC make : CTR / Easun-MR
4.3 Core: CRGO M4 grade, step-lap
4.4 Windings: electrolytic grade copper
4.5 Insulation level HV: LI 170 kVp /
    AC 70 kV
4.6 Oil : Mineral oil to IS 335`,
    12: `VOLTAMP TRANSFORMERS LTD.
SECTION 7 : TEST CERTIFICATES
--------------------------------------
7.1 Type test certificates from CPRI
    enclosed (Annexure 4), dated
    March 2024, on identical rating
7.2 Short-circuit withstand test : CPRI
7.3 GA drawing, rating plate and GTP
    enclosed (Annexure 2)
7.4 QAP enclosed (Annexure 6)`,
  },
  "Voltamp_Commercial.pdf": {
    1: `VOLTAMP TRANSFORMERS LTD.
PRICE BID — Tender HVPNL/EL/2026/07
--------------------------------------
Item 1 : 10 MVA, 33/11 kV Transformer
Total price: Rs. 1,78,40,000 FOR site
Price basis : Firm, fixed price
Delivery: 18 weeks from PO
Payment: 10% advance against ABG,
80% on delivery, 10% after comm.`,
    2: `VOLTAMP TRANSFORMERS LTD.
COMMERCIAL TERMS (contd.)
--------------------------------------
Warranty 30 months from commissioning
or 36 months from supply, whichever
is earlier.
PBG: 10% of order value, valid till
warranty + 3 months.
Offer validity: 120 days.`,
  },
  "EMCO_Technical.pdf": {
    2: `EMCO LIMITED — TECHNICAL OFFER
Enquiry: HVPNL/EL/2026/07  Rev 0
--------------------------------------
Equipment : Power Transformer
Rating: 10 MVA ONAN rating
Voltage ratio: 33/11 kV
Frequency : 50 Hz
Cooling : ONAN`,
    3: `EMCO LIMITED — TECHNICAL OFFER
--------------------------------------
Connection : Delta / Star neutral
Vector group: Dyn11
Neutral : Solidly earthed (LV)
Standard : IS 2026 (all parts)`,
    5: `EMCO LIMITED — GTP CLAUSE 5
LOSSES (GUARANTEED)
--------------------------------------
No-load loss 9.4 kW
Load loss 54 kW at 75 deg C
Auxiliary loss : 0.6 kW
Note: losses subject to IS tolerance`,
    6: `EMCO LIMITED — GTP CLAUSE 6
--------------------------------------
Percentage impedance 10.0 at
principal tap
Temperature rise oil/winding:
50 / 55 deg C`,
    7: `EMCO LIMITED — GTP CLAUSE 7
CONSTRUCTION
--------------------------------------
OLTC range +/-10%, 1.25% steps
Core : CRGO, M4
Winding: copper, paper insulated
Insulation level LI 170 / AC 70 kV`,
    11: `EMCO LIMITED — DOCUMENTATION
--------------------------------------
GA drawing and GTP : enclosed
Type test reports available on request
Routine tests : at works, witnessed`,
  },
  "EMCO_Commercial.pdf": {
    1: `EMCO LIMITED — PRICE SCHEDULE
--------------------------------------
Total price: Rs. 1,69,90,000 FOR site
Delivery within 16 weeks
Payment: 30% advance, 70% on delivery
Price basis: Firm`,
    2: `EMCO LIMITED — TERMS
--------------------------------------
24 months standard warranty
PBG 10% of contract value
Validity of offer: 90 days`,
  },
  "Northstar_Offer.pdf": {
    4: `NORTHSTAR TRANSFORMERS PVT LTD
Techno-commercial offer NS/26/118
--------------------------------------
Rating 10 MVA ONAN, 33/11 kV, 50 Hz
Vector group Dyn11
Cooling : ONAN`,
    6: `NORTHSTAR — TECHNICAL PARTICULARS
--------------------------------------
No load loss : 8.9 kW
Load loss : 54.5 kW at 75 C
Impedance : 9.8 %
Temp. rise oil/wdg : 50 / 55 C`,
    9: `NORTHSTAR — CONSTRUCTION DETAILS
--------------------------------------
OLTC +/-10% in 2.5% steps (9 pos.)
Core : CRGO M5 grade
Winding material: Aluminium (EC grade)
Insulation : LI 170 / AC 70 kV`,
    14: `NORTHSTAR — TESTS
--------------------------------------
Type tested at NABL lab (ERDA),
report no. ERDA/TT/2023/551 enclosed`,
    15: `NORTHSTAR — COMMERCIAL
--------------------------------------
Total price: Rs. 1,61,25,000 FOR site
Delivery: 24 weeks from drawing
approval
Payment: 20% advance, balance on
delivery
Warranty: 18 months from supply
PBG: 5% of order value
Validity: 60 days`,
  },
};

const src = (file, page, quote) => {
  const page_text = PAGES[file]?.[page] ?? quote;
  if (!page_text.includes(quote)) throw new Error(`quote not on page: ${file} p${page}: ${quote}`);
  return { file, page, quote, page_text };
};
const c = (value, status, file, page, quote, remark = "") =>
  ({ value, status, source: file ? src(file, page, quote) : null, remark });

const V = "Voltamp Transformers", E = "EMCO Ltd", N = "Northstar Transformers";
const VT = "Voltamp_TechBid.pdf", VC = "Voltamp_Commercial.pdf", ET = "EMCO_Technical.pdf", EC = "EMCO_Commercial.pdf", NO = "Northstar_Offer.pdf";

const row = (category, parameter, unit, mr, std, std_req, cells) =>
  ({ category, parameter, unit, mr, governing: std ? "both" : "pr", standard: std || "", standard_requirement: std_req || "", cells });

const rows = [
  row("A. General Data", "Rated Power", "MVA", "10 MVA (ONAN)", "", "", {
    [V]: c("10 MVA", "ok", VT, 3, "Rated power: 10 MVA, cooling ONAN"),
    [E]: c("10 MVA", "ok", ET, 2, "10 MVA ONAN rating"),
    [N]: c("10 MVA", "ok", NO, 4, "Rating 10 MVA ONAN, 33/11 kV, 50 Hz") }),
  row("A. General Data", "Voltage Ratio", "kV", "33 / 11 kV", "", "", {
    [V]: c("33 / 11 kV", "ok", VT, 3, "HV 33 kV / LV 11 kV"),
    [E]: c("33 / 11 kV", "ok", ET, 2, "Voltage ratio: 33/11 kV"),
    [N]: c("33 / 11 kV", "ok", NO, 4, "Rating 10 MVA ONAN, 33/11 kV, 50 Hz") }),
  row("A. General Data", "Vector Group", "-", "Dyn11", "IS 2026 Cl.7", "Dyn11", {
    [V]: c("Dyn11", "ok", VT, 3, "Vector group Dyn11"),
    [E]: c("Dyn11", "ok", ET, 3, "Vector group: Dyn11"),
    [N]: c("Dyn11", "ok", NO, 4, "Vector group Dyn11") }),
  row("B. Performance", "No-load Loss", "kW", "≤ 9 kW", "IS 1180:2014 EEL-1", "≤ 9 kW", {
    [V]: c("8.2 kW", "ok", VT, 5, "No-load losses guaranteed 8.2 kW"),
    [E]: c("9.4 kW", "fail", ET, 5, "No-load loss 9.4 kW", "Exceeds the 9 kW limit (IS 1180 EEL-1) by 0.4 kW."),
    [N]: c("8.9 kW", "ok", NO, 6, "No load loss : 8.9 kW") }),
  row("B. Performance", "Load Loss at 75°C", "kW", "≤ 55 kW", "IS 1180:2014 EEL-1", "≤ 55 kW", {
    [V]: c("52 kW", "ok", VT, 5, "Load loss 52 kW at 75 deg C"),
    [E]: c("54 kW", "ok", ET, 5, "Load loss 54 kW at 75 deg C"),
    [N]: c("54.5 kW", "ok", NO, 6, "Load loss : 54.5 kW at 75 C") }),
  row("B. Performance", "Impedance", "%", "10% ± 7.5%", "IS 2026 Cl.9", "10% ± 7.5%", {
    [V]: c("10.2%", "ok", VT, 5, "Impedance voltage 10.2%"),
    [E]: c("10.0%", "ok", ET, 6, "Percentage impedance 10.0"),
    [N]: c("9.8%", "ok", NO, 6, "Impedance : 9.8 %") }),
  row("B. Performance", "Temperature Rise (oil / winding)", "°C", "≤ 50 / 55", "IS 2026-2", "50 / 55 °C", {
    [V]: c("50 / 55", "ok", VT, 5, "top oil 50 deg C,\n    winding 55 deg C"),
    [E]: c("50 / 55", "ok", ET, 6, "50 / 55 deg C"),
    [N]: c("50 / 55", "ok", NO, 6, "Temp. rise oil/wdg : 50 / 55 C") }),
  row("C. Construction", "Tap Changer", "-", "OLTC, ±10% in 1.25% steps", "", "", {
    [V]: c("OLTC ±10%, 1.25%", "ok", VT, 7, "On-load tap changer\n    +/-10% in 1.25% steps"),
    [E]: c("OLTC ±10%, 1.25%", "ok", ET, 7, "OLTC range +/-10%, 1.25% steps"),
    [N]: c("OLTC ±10%, 2.5%", "warn", NO, 9, "OLTC +/-10% in 2.5% steps (9 pos.)", "Coarser 2.5% steps (9 positions) vs 1.25% specified.") }),
  row("C. Construction", "Insulation Level (HV)", "kV", "LI 170 / AC 70", "IEC 60076-3", "LI 170 kVp / AC 70 kV", {
    [V]: c("LI 170 / AC 70", "ok", VT, 7, "Insulation level HV: LI 170 kVp /\n    AC 70 kV"),
    [E]: c("LI 170 / AC 70", "ok", ET, 7, "Insulation level LI 170 / AC 70 kV"),
    [N]: c("LI 170 / AC 70", "ok", NO, 9, "Insulation : LI 170 / AC 70 kV") }),
  row("C. Construction", "Core Material", "-", "CRGO, M4 or better", "", "", {
    [V]: c("CRGO M4", "ok", VT, 7, "Core: CRGO M4 grade, step-lap"),
    [E]: c("CRGO M4", "ok", ET, 7, "Core : CRGO, M4"),
    [N]: c("CRGO M5", "warn", NO, 9, "Core : CRGO M5 grade", "M5 is a lower grade than the M4 specified; higher core loss margin.") }),
  row("C. Construction", "Winding Material", "-", "Electrolytic copper", "", "", {
    [V]: c("Copper", "ok", VT, 7, "Windings: electrolytic grade copper"),
    [E]: c("Copper", "ok", ET, 7, "Winding: copper, paper insulated"),
    [N]: c("Aluminium", "fail", NO, 9, "Winding material: Aluminium (EC grade)", "Aluminium windings offered; copper is mandatory.") }),
  row("D. Testing & Documentation", "Type Test Reports", "-", "CPRI / NABL, ≤ 5 yrs old", "IS 2026 Cl.16", "CPRI / NABL type tests", {
    [V]: c("Enclosed — CPRI", "ok", VT, 12, "Type test certificates from CPRI\n    enclosed (Annexure 4)"),
    [E]: c("Not enclosed", "warn", ET, 11, "Type test reports available on request", "Reports not enclosed with the bid; seek before award."),
    [N]: c("Enclosed — ERDA", "ok", NO, 14, "Type tested at NABL lab (ERDA)") }),
  row("D. Testing & Documentation", "GA Drawing & GTP", "-", "Required with bid", "", "", {
    [V]: c("Enclosed", "ok", VT, 12, "GA drawing, rating plate and GTP\n    enclosed (Annexure 2)"),
    [E]: c("Enclosed", "ok", ET, 11, "GA drawing and GTP : enclosed"),
    [N]: { value: "—", status: "na", source: null, remark: "Not stated in the offer." } }),
  row("E. Guarantee", "Warranty", "months", "≥ 24 from commissioning", "", "", {
    [V]: c("30 months", "ok", VC, 2, "Warranty 30 months from commissioning"),
    [E]: c("24 months", "ok", EC, 2, "24 months standard warranty"),
    [N]: c("18 months", "fail", NO, 15, "Warranty: 18 months from supply", "Below the 24-month minimum, and counted from supply.") }),
];

const vendors = [V, E, N];
const counts = Object.fromEntries(vendors.map((v) => [v, { ok: 0, warn: 0, fail: 0, na: 0 }]));
rows.forEach((r) => vendors.forEach((v) => counts[v][r.cells[v].status]++));
const compliance = Object.fromEntries(vendors.map((v) => [v, { ok: counts[v].ok, total: rows.length, score: `${counts[v].ok}/${rows.length}`, counts: counts[v] }]));
const ranked = [...vendors].sort((a, b) => counts[b].ok - counts[a].ok);

const crow = (parameter, unit, mr, cells) => ({ category: "Commercial", parameter, unit, mr, governing: "pr", standard: "", standard_requirement: "", cells });
const commercial = {
  vendors,
  rows: [
    crow("Total Price (FOR site)", "₹", "—", {
      [V]: c("₹ 1,78,40,000", "ok", VC, 1, "Total price: Rs. 1,78,40,000 FOR site"),
      [E]: c("₹ 1,69,90,000", "ok", EC, 1, "Total price: Rs. 1,69,90,000 FOR site"),
      [N]: c("₹ 1,61,25,000", "ok", NO, 15, "Total price: Rs. 1,61,25,000 FOR site") }),
    crow("Delivery Period", "weeks", "≤ 20 weeks from PO", {
      [V]: c("18 weeks", "ok", VC, 1, "Delivery: 18 weeks from PO"),
      [E]: c("16 weeks", "ok", EC, 1, "Delivery within 16 weeks"),
      [N]: c("24 weeks", "fail", NO, 15, "Delivery: 24 weeks from drawing\napproval", "Exceeds 20 weeks, and runs from drawing approval, not PO.") }),
    crow("Payment Terms", "-", "10 / 80 / 10", {
      [V]: c("10 / 80 / 10", "ok", VC, 1, "Payment: 10% advance against ABG,\n80% on delivery, 10% after comm."),
      [E]: c("30 / 70", "warn", EC, 1, "Payment: 30% advance, 70% on delivery", "Higher advance than tender terms."),
      [N]: c("20 / 80", "warn", NO, 15, "Payment: 20% advance, balance on\ndelivery", "Higher advance; no retention till commissioning.") }),
    crow("Performance Bank Guarantee", "%", "10% of order value", {
      [V]: c("10%", "ok", VC, 2, "PBG: 10% of order value"),
      [E]: c("10%", "ok", EC, 2, "PBG 10% of contract value"),
      [N]: c("5%", "fail", NO, 15, "PBG: 5% of order value", "Half the required PBG.") }),
    crow("Offer Validity", "days", "≥ 90 days", {
      [V]: c("120 days", "ok", VC, 2, "Offer validity: 120 days."),
      [E]: c("90 days", "ok", EC, 2, "Validity of offer: 90 days"),
      [N]: c("60 days", "fail", NO, 15, "Validity: 60 days") }),
  ],
  prices: { [V]: "₹ 1.78 Cr", [E]: "₹ 1.70 Cr", [N]: "₹ 1.61 Cr" },
  ranking: `L1: ${N} (₹ 1.61 Cr) > L2: ${E} (₹ 1.70 Cr) > L3: ${V} (₹ 1.78 Cr)`,
  awarded: N,
};

export const EVAL_RESULT = {
  title: "33/11 kV, 10 MVA Power Transformer — HVPNL/EL/2026/07",
  mr_summary: "Supply of one 33/11 kV, 10 MVA ONAN power transformer to IS 2026 / IEC 60076 for the Phase-II substation (BOQ item 1).",
  standards: ["IS 2026 (Part 1) — Power transformers", "IEC 60076-1 — Power transformers", "IS 1180:2014 — Energy Efficiency Level-1", "IEC 60076-3 — Insulation levels"],
  standards_verified: true,
  vendors,
  rows,
  compliance,
  ranking: ranked.map((v, i) => `L${i + 1}: ${v} (${compliance[v].score})`).join(" > "),
  commercial,
  model: "claude-opus-4-8",
};
