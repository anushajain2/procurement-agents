// Seed requests so the platform looks fully populated on first load.
// Real evaluations created later carry the same shape (see store.createFromResult).

const src = (file, page, quote, page_text) => ({ file, page, quote, page_text: page_text || quote });

const cell = (value, status, source, remark = "") => ({ value, status, source, remark });

// ── Request 1: Power Transformer (in approval) ───────────────────────────────
const transformerResult = {
  title: "33/11 kV, 10 MVA Power Transformer — MR-EPC-2241",
  mr_summary: "Supply of one 33/11 kV, 10 MVA ONAN power transformer conforming to IS 2026 / IEC 60076 for the Phase-II substation.",
  vendors: ["Voltamp Transformers", "EMCO Ltd"],
  model: "claude-opus-4-8",
  rows: [
    { category: "A. General Data", parameter: "Rated Power", unit: "MVA", mr: "10 MVA (ONAN)",
      cells: { "Voltamp Transformers": cell("10 MVA", "ok", src("Voltamp_TechBid.pdf", 3, "Rated power: 10 MVA, cooling ONAN")), "EMCO Ltd": cell("10 MVA", "ok", src("EMCO_Technical.pdf", 2, "10 MVA ONAN rating")) } },
    { category: "A. General Data", parameter: "Voltage Ratio", unit: "kV", mr: "33 / 11 kV",
      cells: { "Voltamp Transformers": cell("33 / 11 kV", "ok", src("Voltamp_TechBid.pdf", 3, "HV 33 kV / LV 11 kV")), "EMCO Ltd": cell("33 / 11 kV", "ok", src("EMCO_Technical.pdf", 2, "33/11 kV")) } },
    { category: "A. General Data", parameter: "Vector Group", unit: "-", mr: "Dyn11",
      cells: { "Voltamp Transformers": cell("Dyn11", "ok", src("Voltamp_TechBid.pdf", 3, "Vector group Dyn11")), "EMCO Ltd": cell("Dyn11", "ok", src("EMCO_Technical.pdf", 3, "Vector group: Dyn11")) } },
    { category: "B. Performance", parameter: "No-load Loss", unit: "kW", mr: "≤ 9 kW",
      cells: { "Voltamp Transformers": cell("8.2 kW", "ok", src("Voltamp_TechBid.pdf", 5, "No-load losses guaranteed 8.2 kW")), "EMCO Ltd": cell("9.4 kW", "fail", src("EMCO_Technical.pdf", 5, "No-load loss 9.4 kW"), "Exceeds MR limit of 9 kW by 0.4 kW.") } },
    { category: "B. Performance", parameter: "Load Loss at 75°C", unit: "kW", mr: "≤ 55 kW",
      cells: { "Voltamp Transformers": cell("52 kW", "ok", src("Voltamp_TechBid.pdf", 5, "Load loss 52 kW at 75 deg C")), "EMCO Ltd": cell("54 kW", "ok", src("EMCO_Technical.pdf", 5, "Load loss 54 kW")) } },
    { category: "B. Performance", parameter: "Impedance", unit: "%", mr: "10% ± 7.5%",
      cells: { "Voltamp Transformers": cell("10.2%", "ok", src("Voltamp_TechBid.pdf", 5, "Impedance voltage 10.2%")), "EMCO Ltd": cell("10.0%", "ok", src("EMCO_Technical.pdf", 6, "Percentage impedance 10.0")) } },
    { category: "C. Construction", parameter: "Tap Changer", unit: "-", mr: "OLTC, ±10% in 1.25% steps",
      cells: { "Voltamp Transformers": cell("OLTC ±10%, 1.25%", "ok", src("Voltamp_TechBid.pdf", 7, "On-load tap changer +/-10% in 1.25% steps")), "EMCO Ltd": cell("OLTC ±10%, 1.25%", "ok", src("EMCO_Technical.pdf", 7, "OLTC range +/-10%, 16 steps")) } },
    { category: "C. Construction", parameter: "Insulation Class", unit: "-", mr: "Class A, oil-immersed",
      cells: { "Voltamp Transformers": cell("Class A", "ok", src("Voltamp_TechBid.pdf", 8, "Insulation: Class A, mineral oil immersed")), "EMCO Ltd": cell("Class A", "ok", src("EMCO_Technical.pdf", 8, "Class A insulation, oil immersed")) } },
    { category: "D. Documentation", parameter: "Type Test Reports", unit: "-", mr: "Required (CPRI/NABL)",
      cells: { "Voltamp Transformers": cell("Submitted — CPRI", "ok", src("Voltamp_TechBid.pdf", 12, "Type test certificates from CPRI enclosed (Annexure 4)")), "EMCO Ltd": cell("Not enclosed", "warn", src("EMCO_Technical.pdf", 11, "Type test reports available on request"), "Reports not enclosed with bid; to be confirmed.") } },
    { category: "E. Commercial", parameter: "Delivery Period", unit: "weeks", mr: "≤ 20 weeks",
      cells: { "Voltamp Transformers": cell("18 weeks", "ok", src("Voltamp_Commercial.pdf", 1, "Delivery: 18 weeks from PO")), "EMCO Ltd": cell("16 weeks", "ok", src("EMCO_Commercial.pdf", 1, "Delivery within 16 weeks")) } },
    { category: "E. Commercial", parameter: "Warranty", unit: "months", mr: "≥ 24 months",
      cells: { "Voltamp Transformers": cell("30 months", "ok", src("Voltamp_Commercial.pdf", 2, "Warranty 30 months from commissioning")), "EMCO Ltd": cell("24 months", "ok", src("EMCO_Commercial.pdf", 2, "24 months standard warranty")) } },
  ],
  compliance: {
    "Voltamp Transformers": { ok: 11, total: 11, score: "11/11", counts: { ok: 11, warn: 0, fail: 0, na: 0 } },
    "EMCO Ltd": { ok: 8, total: 11, score: "8/11", counts: { ok: 8, warn: 2, fail: 1, na: 0 } },
  },
  ranking: "L1: Voltamp Transformers (11/11) > L2: EMCO Ltd (8/11)",
};

// ── Request 2: HT Switchgear (approved) ──────────────────────────────────────
const switchgearResult = {
  title: "11 kV Indoor VCB Switchgear — MR-EPC-2198",
  mr_summary: "Supply of 11 kV, 1250 A indoor vacuum circuit breaker panels (8 feeders) to IEC 62271.",
  vendors: ["Siemens", "C&S Electric"],
  model: "claude-opus-4-8",
  rows: [
    { category: "A. Ratings", parameter: "Rated Voltage", unit: "kV", mr: "11 kV",
      cells: { "Siemens": cell("12 kV", "ok", src("Siemens_Bid.pdf", 2, "Rated voltage 12 kV")), "C&S Electric": cell("12 kV", "ok", src("CS_Bid.pdf", 2, "12 kV rated")) } },
    { category: "A. Ratings", parameter: "Rated Current", unit: "A", mr: "1250 A",
      cells: { "Siemens": cell("1250 A", "ok", src("Siemens_Bid.pdf", 2, "Busbar 1250 A")), "C&S Electric": cell("1250 A", "ok", src("CS_Bid.pdf", 2, "1250 A")) } },
    { category: "A. Ratings", parameter: "Short-circuit Rating", unit: "kA/3s", mr: "25 kA / 3s",
      cells: { "Siemens": cell("25 kA", "ok", src("Siemens_Bid.pdf", 3, "25 kA for 3 s")), "C&S Electric": cell("25 kA", "ok", src("CS_Bid.pdf", 3, "25 kA / 3 sec")) } },
    { category: "B. Construction", parameter: "Breaker Type", unit: "-", mr: "Vacuum, draw-out",
      cells: { "Siemens": cell("VCB, draw-out", "ok", src("Siemens_Bid.pdf", 4, "Vacuum circuit breaker, draw-out type")), "C&S Electric": cell("VCB, draw-out", "ok", src("CS_Bid.pdf", 4, "Draw-out VCB")) } },
    { category: "B. Construction", parameter: "IP Rating", unit: "-", mr: "IP4X",
      cells: { "Siemens": cell("IP4X", "ok", src("Siemens_Bid.pdf", 5, "Enclosure IP4X")), "C&S Electric": cell("IP4X", "ok", src("CS_Bid.pdf", 5, "IP4X")) } },
    { category: "C. Commercial", parameter: "Delivery", unit: "weeks", mr: "≤ 24 weeks",
      cells: { "Siemens": cell("22 weeks", "ok", src("Siemens_Comm.pdf", 1, "Delivery 22 weeks")), "C&S Electric": cell("20 weeks", "ok", src("CS_Comm.pdf", 1, "20 weeks")) } },
  ],
  compliance: {
    "Siemens": { ok: 6, total: 6, score: "6/6", counts: { ok: 6, warn: 0, fail: 0, na: 0 } },
    "C&S Electric": { ok: 6, total: 6, score: "6/6", counts: { ok: 6, warn: 0, fail: 0, na: 0 } },
  },
  ranking: "L1: C&S Electric (6/6) > L2: Siemens (6/6)",
};

// ── Request 3: Numerical Protection Relays (pending on the Lead Engineer) ─────
const relayResult = {
  title: "Numerical Protection Relays — MR-EPC-2270",
  mr_summary: "Supply of numerical feeder & transformer protection relays (IEC 61850) for the Phase-II substation.",
  vendors: ["ABB", "Schneider Electric"],
  model: "claude-opus-4-8",
  rows: [
    { category: "A. General", parameter: "Relay Type", unit: "-", mr: "Numerical, IEC 61850",
      cells: { "ABB": cell("REF615 (numerical)", "ok", src("ABB_RelayBid.pdf", 2, "REF615 numerical feeder protection relay, IEC 61850 native")), "Schneider Electric": cell("MiCOM P14N", "ok", src("Schneider_Relay.pdf", 2, "MiCOM P14N numerical overcurrent relay")) } },
    { category: "A. General", parameter: "Communication Protocol", unit: "-", mr: "IEC 61850 + Modbus",
      cells: { "ABB": cell("IEC 61850 Ed.2 + Modbus", "ok", src("ABB_RelayBid.pdf", 4, "Supports IEC 61850 Edition 2, Modbus TCP and DNP3")), "Schneider Electric": cell("IEC 61850 + Modbus", "ok", src("Schneider_Relay.pdf", 4, "IEC 61850 and Modbus supported")) } },
    { category: "B. Protection Functions", parameter: "Overcurrent (50/51)", unit: "-", mr: "Required",
      cells: { "ABB": cell("Included", "ok", null), "Schneider Electric": cell("Included", "ok", null) } },
    { category: "B. Protection Functions", parameter: "Earth Fault (50N/51N)", unit: "-", mr: "Required",
      cells: { "ABB": cell("Included", "ok", null), "Schneider Electric": cell("Included", "ok", null) } },
    { category: "B. Protection Functions", parameter: "Differential (87T)", unit: "-", mr: "Required (transformer)",
      cells: { "ABB": cell("Included (RET615)", "ok", src("ABB_RelayBid.pdf", 6, "Transformer differential protection 87T available in RET615 variant")), "Schneider Electric": cell("Not offered", "fail", src("Schneider_Relay.pdf", 6, "P14N: differential protection not supported; separate P64x required"), "87T not offered in quoted model — needs a different relay.") } },
    { category: "C. Hardware", parameter: "Binary I/O", unit: "-", mr: "≥ 8 DI / 4 DO",
      cells: { "ABB": cell("12 DI / 8 DO", "ok", src("ABB_RelayBid.pdf", 8, "Binary inputs: 12, Binary outputs: 8")), "Schneider Electric": cell("6 DI / 4 DO", "warn", src("Schneider_Relay.pdf", 8, "6 digital inputs, 4 output relays"), "DI count below the specified minimum of 8.") } },
    { category: "C. Hardware", parameter: "Auxiliary Supply", unit: "V DC", mr: "110 V DC",
      cells: { "ABB": cell("110 V DC", "ok", null), "Schneider Electric": cell("110 V DC", "ok", null) } },
    { category: "D. Commercial", parameter: "Delivery Period", unit: "weeks", mr: "≤ 16",
      cells: { "ABB": cell("14 weeks", "ok", null), "Schneider Electric": cell("12 weeks", "ok", null) } },
    { category: "D. Commercial", parameter: "Warranty", unit: "months", mr: "≥ 24",
      cells: { "ABB": cell("36 months", "ok", null), "Schneider Electric": cell("24 months", "ok", null) } },
  ],
  compliance: {
    "ABB": { ok: 9, total: 9, score: "9/9", counts: { ok: 9, warn: 0, fail: 0, na: 0 } },
    "Schneider Electric": { ok: 7, total: 9, score: "7/9", counts: { ok: 7, warn: 1, fail: 1, na: 0 } },
  },
  ranking: "L1: ABB (9/9) > L2: Schneider Electric (7/9)",
};

// Decorate a result with the standards Claude would auto-detect for the equipment,
// tagging the governed parameters with their code + clause.
function withStandards(result, standards, perParam) {
  result.standards = standards;
  result.rows.forEach((r) => {
    const s = perParam[r.parameter];
    if (s) { r.governing = s.g || "both"; r.standard = s.std; r.standard_requirement = s.req || ""; }
    else { r.governing = "pr"; r.standard = ""; r.standard_requirement = ""; }
  });
  return result;
}

withStandards(transformerResult,
  ["IS 2026 (Part 1) — Power transformers", "IEC 60076-1 — Power transformers", "IS 1180:2014 — Energy Efficiency Level-1"],
  {
    "Vector Group": { std: "IS 2026 Cl.7", req: "Dyn11" },
    "No-load Loss": { std: "IS 1180:2014 EEL-1", req: "≤ 9 kW" },
    "Load Loss at 75°C": { std: "IS 1180:2014 EEL-1", req: "≤ 55 kW" },
    "Impedance": { std: "IS 2026 Cl.9", req: "10% ± 7.5%" },
    "Insulation Class": { std: "IEC 60076-3", req: "LI 75 kV / AC 28 kV" },
    "Type Test Reports": { std: "IS 2026 Cl.16", req: "CPRI / NABL type tests" },
  });

withStandards(switchgearResult,
  ["IEC 62271-200 — AC metal-enclosed switchgear", "IEC 62271-100 — HV circuit breakers", "IS 13118"],
  {
    "Rated Voltage": { std: "IEC 62271-1", req: "12 kV" },
    "Short-circuit Rating": { std: "IEC 62271-200", req: "25 kA / 3s" },
    "Breaker Type": { std: "IEC 62271-100", req: "Vacuum, draw-out" },
    "IP Rating": { std: "IEC 60529", req: "IP4X" },
  });

withStandards(relayResult,
  ["IEC 61850 — Substation communication", "IEC 60255 — Measuring relays & protection equipment", "IEC 60255-151 — Overcurrent protection"],
  {
    "Relay Type": { std: "IEC 60255-27", req: "Numerical" },
    "Communication Protocol": { std: "IEC 61850", req: "IEC 61850 native" },
    "Overcurrent (50/51)": { std: "IEC 60255-151", req: "Required" },
    "Earth Fault (50N/51N)": { std: "IEC 60255-151", req: "Required" },
    "Differential (87T)": { std: "IEC 60255-187", req: "Required (transformer feeders)" },
  });

const iso = (d) => d; // pre-baked ISO strings keep seed deterministic

export const SEED_REQUESTS = [
  {
    id: "r_demo03",
    ref: "TBE-DM03",
    title: relayResult.title,
    summary: relayResult.mr_summary,
    category: "Instrumentation",
    value: "₹ 76 L",
    status: "pending",
    result: relayResult,
    awardedVendor: "ABB",
    createdBy: "u_eng2",
    createdAt: iso("2026-06-22T07:15:00.000Z"),
    currentLevel: 1,
    chain: [
      { level: 1, role: "Technical Review — Lead Engineer", userId: "u_eng", status: "pending", comment: "", actedAt: null },
      { level: 2, role: "Procurement Manager", userId: "u_mgr", status: "pending", comment: "", actedAt: null },
    ],
    activity: [
      { ts: iso("2026-06-22T07:15:00.000Z"), actor: "u_eng2", action: "submitted", note: "Routed for approval — technical review first." },
      { ts: iso("2026-06-22T07:00:00.000Z"), actor: "u_eng2", action: "created", note: "Evaluation completed and comparison sheet generated." },
    ],
  },
  {
    id: "r_demo01",
    ref: "TBE-DM01",
    title: transformerResult.title,
    summary: transformerResult.mr_summary,
    category: "Power Transformers",
    value: "₹ 1.85 Cr",
    status: "pending",
    result: transformerResult,
    awardedVendor: "Voltamp Transformers",
    createdBy: "u_eng",
    createdAt: iso("2026-06-18T09:20:00.000Z"),
    currentLevel: 2,
    chain: [
      { level: 1, role: "Procurement Manager", userId: "u_mgr", status: "approved", comment: "Technical evaluation is sound. Voltamp clearly L1 on compliance and loss figures.", actedAt: iso("2026-06-20T06:30:00.000Z"), actedBy: "u_mgr" },
      { level: 2, role: "Category Head — Electrical", userId: "u_cat", status: "pending", comment: "", actedAt: null },
      { level: 3, role: "Chief Financial Officer", userId: "u_fin", status: "pending", comment: "", actedAt: null },
    ],
    activity: [
      { ts: iso("2026-06-20T06:30:00.000Z"), actor: "u_mgr", action: "approved", note: "Technical evaluation is sound. Voltamp clearly L1." },
      { ts: iso("2026-06-19T11:00:00.000Z"), actor: "u_eng", action: "submitted", note: "Routed for approval through 3 level(s)." },
      { ts: iso("2026-06-18T09:20:00.000Z"), actor: "u_eng", action: "created", note: "Evaluation completed and comparison sheet generated." },
    ],
  },
  {
    id: "r_demo02",
    ref: "TBE-DM02",
    title: switchgearResult.title,
    summary: switchgearResult.mr_summary,
    category: "Switchgear",
    value: "₹ 92 L",
    status: "approved",
    result: switchgearResult,
    awardedVendor: "C&S Electric",
    createdBy: "u_eng",
    createdAt: iso("2026-06-05T08:00:00.000Z"),
    currentLevel: 0,
    projectId: "prj_01",
    packageId: "pkg_02",
    poRef: "PO-5512",
    chain: [
      { level: 1, role: "Procurement Manager", userId: "u_mgr", status: "approved", comment: "Both fully compliant; C&S is lower on price and delivery.", actedAt: iso("2026-06-07T05:00:00.000Z"), actedBy: "u_mgr" },
      { level: 2, role: "Category Head — Electrical", userId: "u_cat", status: "approved", comment: "Agreed. Award to C&S Electric.", actedAt: iso("2026-06-08T07:30:00.000Z"), actedBy: "u_cat" },
    ],
    activity: [
      { ts: iso("2026-06-08T07:30:00.000Z"), actor: "u_cat", action: "approved", note: "Agreed. Award to C&S Electric." },
      { ts: iso("2026-06-07T05:00:00.000Z"), actor: "u_mgr", action: "approved", note: "Both fully compliant; C&S lower on price." },
      { ts: iso("2026-06-06T09:00:00.000Z"), actor: "u_eng", action: "submitted", note: "Routed for approval through 2 level(s)." },
      { ts: iso("2026-06-05T08:00:00.000Z"), actor: "u_eng", action: "created", note: "Evaluation completed and comparison sheet generated." },
    ],
  },
];
