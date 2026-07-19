// Projects + their procurement packages (PRs/POs), approval stages and contract terms.
// Two packages link to the seed evaluations (r_demo01, r_demo02) so the bid
// evaluation flow and the project tracker are one connected system.

// Procurement lifecycle pipeline. A package is a PR until "PO Issued", then a PO.
export const PIPELINE = [
  { key: "pr_raised", label: "PR Raised", short: "PR" },
  { key: "pr_approved", label: "PR Approved", short: "PR✓" },
  { key: "evaluation", label: "Under Evaluation", short: "TBE" },
  { key: "award", label: "Award Approved", short: "Award" },
  { key: "po_issued", label: "PO Issued", short: "PO" },
  { key: "delivery", label: "In Delivery", short: "Ship" },
  { key: "closed", label: "Closed", short: "Done" },
];
export const PO_STAGE = 4; // index at/after which a package is a PO
export const stageLabel = (i) => PIPELINE[i]?.label || "—";
export const isPO = (i) => i >= PO_STAGE;
export const stageTone = (i) => (i >= 6 ? "ok" : i >= 4 ? "info" : i >= 2 ? "warn" : "na");

const terms = (o) => ({
  priceBasis: "Firm, fixed price",
  incoterms: "FOR Site (freight & insurance incl.)",
  paymentTerms: "10% advance against ABG, 80% on delivery, 10% after commissioning",
  deliveryPeriod: "—",
  warranty: "24 months from commissioning",
  ld: "0.5% of PO value per week of delay, max 5%",
  pbg: "10% Performance Bank Guarantee, valid till warranty + 3 months",
  retention: "5% retained, released after defect liability period",
  validity: "PO valid for 12 months",
  ...o,
});

let _p = 0;
const pkg = (o) => ({ id: "pkg_" + (++_p).toString().padStart(2, "0"), ...o });

export const SEED_PROJECTS = [
  {
    id: "prj_01",
    code: "EPC-P2-JHJ",
    name: "Phase-II 220/33 kV Substation — Jhajjar",
    client: "Haryana Vidyut Prasaran Nigam (HVPNL)",
    location: "Jhajjar, Haryana",
    manager: "u_mgr",
    budget: 480000000, // ₹ 48 Cr
    status: "Execution",
    start: "2026-02-01",
    end: "2027-03-31",
    description: "Turnkey supply, erection and commissioning of a 220/33 kV grid substation including transformers, switchgear, protection and associated civil works.",
    packages: [
      pkg({ title: "33/11 kV, 10 MVA Power Transformer", category: "Power Transformers", vendor: "Voltamp Transformers", value: 18500000, stage: 3, prRef: "PR-2241", poRef: null, raisedBy: "u_eng", raisedDate: "2026-06-10", expectedDelivery: "2026-11-20", linkedRequestId: "r_demo01", terms: terms({ deliveryPeriod: "18 weeks from PO", warranty: "30 months from commissioning" }) }),
      pkg({ title: "11 kV Indoor VCB Switchgear (8 feeders)", category: "Switchgear", vendor: "C&S Electric", value: 9200000, stage: 5, prRef: "PR-2198", poRef: "PO-5512", raisedBy: "u_eng", raisedDate: "2026-05-20", poDate: "2026-06-10", expectedDelivery: "2026-10-30", linkedRequestId: "r_demo02", terms: terms({ deliveryPeriod: "20 weeks from PO", warranty: "24 months" }) }),
      pkg({ title: "HT/LT Power & Control Cables", category: "Cables & Conductors", vendor: "Polycab", value: 14200000, stage: 4, prRef: "PR-2256", poRef: "PO-5530", raisedBy: "u_eng", raisedDate: "2026-06-01", poDate: "2026-06-18", expectedDelivery: "2026-09-15", terms: terms({ deliveryPeriod: "12 weeks from PO", priceBasis: "Variable — IEEMA price variation clause" }) }),
      pkg({ title: "Numerical Protection Relays", category: "Instrumentation", vendor: null, value: 7600000, stage: 2, prRef: "PR-2270", poRef: null, raisedBy: "u_eng", raisedDate: "2026-06-15", expectedDelivery: "2026-12-01", terms: terms({ deliveryPeriod: "16 weeks from PO" }) }),
      pkg({ title: "Substation Civil & Structural Works", category: "Civil & Structural", vendor: "L&T Construction", value: 56000000, stage: 5, prRef: "PR-2180", poRef: "PO-5498", raisedBy: "u_eng", raisedDate: "2026-04-12", poDate: "2026-05-05", expectedDelivery: "2026-10-01", terms: terms({ deliveryPeriod: "24 weeks", paymentTerms: "Monthly RA bills against measurement, 5% retention", pbg: "10% PBG + 5% retention" }) }),
    ],
  },
  {
    id: "prj_02",
    code: "EPC-TL-400B",
    name: "400 kV Transmission Line — Package B",
    client: "Power Grid Corporation of India (PGCIL)",
    location: "Raichur — Sholapur corridor",
    manager: "u_cat",
    budget: 1200000000, // ₹ 120 Cr
    status: "Procurement",
    start: "2026-03-15",
    end: "2027-09-30",
    description: "Supply and stringing of a 400 kV D/C transmission line — conductors, towers, insulators and hardware over a 92 km corridor.",
    packages: [
      pkg({ title: "ACSR Moose Conductor", category: "Cables & Conductors", vendor: "Sterlite Power", value: 420000000, stage: 5, prRef: "PR-3101", poRef: "PO-6001", raisedBy: "u_eng", raisedDate: "2026-04-01", poDate: "2026-05-02", expectedDelivery: "2026-11-30", terms: terms({ deliveryPeriod: "28 weeks, phased", priceBasis: "Variable — LME aluminium linked" }) }),
      pkg({ title: "Transmission Towers (Galvanized)", category: "Civil & Structural", vendor: "KEC International", value: 510000000, stage: 5, prRef: "PR-3088", poRef: "PO-5990", raisedBy: "u_eng", raisedDate: "2026-03-25", poDate: "2026-04-28", expectedDelivery: "2026-12-15", terms: terms({ deliveryPeriod: "30 weeks, phased", ld: "0.5%/week, max 7.5%" }) }),
      pkg({ title: "Polymer Insulators & Hardware", category: "Electrical Equipment", vendor: null, value: 88000000, stage: 0, prRef: "PR-3140", poRef: null, raisedBy: "u_eng", raisedDate: "2026-06-20", expectedDelivery: "2027-01-20", terms: terms({ deliveryPeriod: "20 weeks from PO" }) }),
    ],
  },
  {
    id: "prj_03",
    code: "EPC-SOL-BDL",
    name: "50 MW Solar PV Plant — Bhadla",
    client: "NTPC Renewable Energy Ltd",
    location: "Bhadla, Rajasthan",
    manager: "u_mgr",
    budget: 350000000, // ₹ 35 Cr
    status: "Procurement",
    start: "2026-05-01",
    end: "2027-02-28",
    description: "EPC of a 50 MW (AC) ground-mount solar PV plant — modules, inverters, mounting structures and balance of plant.",
    packages: [
      pkg({ title: "Mono PERC Bifacial PV Modules (550 Wp)", category: "Electrical Equipment", vendor: "Waaree Energies", value: 145000000, stage: 4, prRef: "PR-4011", poRef: "PO-7010", raisedBy: "u_eng", raisedDate: "2026-05-10", poDate: "2026-06-05", expectedDelivery: "2026-12-10", terms: terms({ deliveryPeriod: "22 weeks, phased", warranty: "12 yr product / 30 yr performance" }) }),
      pkg({ title: "Central Inverters (2.5 MW)", category: "Electrical Equipment", vendor: "Sungrow", value: 62000000, stage: 3, prRef: "PR-4025", poRef: null, raisedBy: "u_eng", raisedDate: "2026-06-02", expectedDelivery: "2027-01-15", terms: terms({ deliveryPeriod: "18 weeks from PO", warranty: "60 months" }) }),
      pkg({ title: "Module Mounting Structure", category: "Civil & Structural", vendor: null, value: 38000000, stage: 1, prRef: "PR-4040", poRef: null, raisedBy: "u_eng", raisedDate: "2026-06-18", expectedDelivery: "2026-12-20", terms: terms({ deliveryPeriod: "16 weeks from PO" }) }),
    ],
  },
];

// ₹ formatting — crore / lakh.
export function inr(n) {
  if (n == null || n === "") return "—";
  if (typeof n === "string") {
    const p = parseINR(n);
    if (p == null) return n; // unparseable — show as typed
    n = p;
  }
  if (n >= 10000000) return "₹ " + (n / 10000000).toFixed(2).replace(/\.00$/, "") + " Cr";
  if (n >= 100000) return "₹ " + (n / 100000).toFixed(2).replace(/\.00$/, "") + " L";
  return "₹ " + n.toLocaleString("en-IN");
}

// Parse "₹ 1.85 Cr" / "92 L" / "18,50,000" / "18500000" → a number (or null).
export function parseINR(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const s = String(v).toLowerCase().replace(/₹|,|\s/g, "");
  const m = s.match(/([\d.]+)/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (Number.isNaN(num)) return null;
  if (/cr|crore/.test(s)) return Math.round(num * 10000000);
  if (/l|lakh|lac/.test(s)) return Math.round(num * 100000);
  return Math.round(num);
}
