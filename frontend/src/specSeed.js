// A seed specification so the Specs section is populated without a live backend.
// Real specs (POST /api/generate-spec) carry the same shape.

const p = (category, parameter, unit, requirement, basis, standard, confidence, needs_review = false, note = "") =>
  ({ category, parameter, unit, requirement, basis, standard, confidence, needs_review, note });

export const SEED_SPECS = [
  {
    id: "spec_demo01",
    ref: "SPEC-DM01",
    title: "33/11 kV, 10 MVA Power Transformer — Technical Specification",
    equipment: "33/11 kV, 10 MVA ONAN Power Transformer",
    summary: "Supply of one 33/11 kV, 10 MVA ONAN power transformer for the Phase-II substation, conforming to IS 2026 / IEC 60076.",
    category: "Power Transformers",
    standards: ["IS 2026 (Part 1) — Power transformers", "IEC 60076-1 — Power transformers", "IS 1180:2014 — Energy Efficiency Level-1"],
    standards_verified: false,
    used_references: false,
    model: "claude-opus-4-8",
    createdBy: "u_eng",
    createdAt: "2026-06-24T05:00:00.000Z",
    status: "draft",
    parameters: [
      p("A. Ratings", "Rated Power", "MVA", "10 (ONAN)", "pr", "", "high"),
      p("A. Ratings", "Voltage Ratio", "kV", "33 / 11", "pr", "", "high"),
      p("A. Ratings", "Frequency", "Hz", "50", "engineering", "", "medium"),
      p("A. Ratings", "Vector Group", "-", "Dyn11", "standard", "IS 2026 Cl.7", "medium"),
      p("B. Design", "Cooling", "-", "ONAN", "pr", "", "high"),
      p("B. Design", "Insulation Level (HV)", "kV", "LI 75 / AC 28", "standard", "IEC 60076-3", "medium"),
      p("C. Performance", "No-load Loss (max)", "kW", "[confirm per IS 1180:2014 EEL-1 loss table]", "standard", "IS 1180:2014 EEL-1", "low", true, "EEL-1 loss limit is a code table value — confirm against the licensed IS 1180 or the buyer's engineering standard before issue."),
      p("C. Performance", "Load Loss at 75°C (max)", "kW", "[confirm per IS 1180:2014 EEL-1 loss table]", "standard", "IS 1180:2014 EEL-1", "low", true, "As above — code-derived loss limit; do not issue with a guessed value."),
      p("C. Performance", "Impedance", "%", "10 ± 7.5% (tolerance per IS 2026)", "standard", "IS 2026 Cl.9", "medium"),
      p("D. Construction", "Tap Changer", "-", "Off-circuit, ±10% in 1.25% steps", "pr", "", "high"),
      p("E. Testing", "Type Tests", "-", "Routine + type tests per IS 2026; certificates from a NABL/CPRI lab to be enclosed", "standard", "IS 2026 Cl.16", "medium"),
      p("F. Documentation", "Drawings & GTP", "-", "GA drawing, rating plate, GTP and test reports required with the bid", "engineering", "", "high"),
      p("G. Commercial", "Delivery Period", "weeks", "≤ 20 from PO", "pr", "", "high"),
      p("G. Commercial", "Warranty", "months", "≥ 24 from commissioning", "pr", "", "high"),
    ],
    sections: [
      { heading: "Scope", body: "This specification covers the design, manufacture, testing at works, supply, and delivery to site of one 33/11 kV, 10 MVA ONAN power transformer complete with all fittings and accessories necessary for satisfactory operation." },
      { heading: "Service & Site Conditions", body: "Outdoor installation. Ambient: max 50°C, average 40°C. Altitude ≤ 1000 m. The transformer shall be suitable for continuous operation at rated output under these conditions." },
      { heading: "Design & Construction", body: "Core-type, oil-immersed, with CRGO core and copper windings. Mineral insulating oil to IS 335. Corrugated tank / radiators sized for ONAN cooling. Bushings, conservator, Buchholz relay, temperature indicators and off-circuit tap changer as per the datasheet." },
      { heading: "Performance", body: "Losses and impedance as per the datasheet and IS 1180 Energy Efficiency Level-1. Temperature rise within IS 2026 limits. Guaranteed values are subject to test tolerances of IS 2026." },
      { heading: "Testing & Inspection", body: "Routine tests on the offered unit and type tests as per IS 2026 / IEC 60076. Type-test certificates from a NABL-accredited or CPRI laboratory shall be enclosed with the bid. The purchaser reserves the right to witness tests." },
      { heading: "Documentation & Drawings", body: "GA drawing, rating & diagram plate, guaranteed technical particulars (GTP), test reports and O&M manual to be submitted. Drawings for approval before manufacture." },
      { heading: "Quality Assurance", body: "A Quality Assurance Plan (QAP) covering raw material, in-process and final inspection, including sub-vendor QAP, to be submitted for approval." },
      { heading: "Painting & Finish", body: "Surface preparation and painting to the buyer's standard; final shade RAL 7035 unless otherwise specified." },
      { heading: "Packing, Marking & Delivery", body: "Suitable for road transport and outdoor storage. Delivery FOR site within the period stated in the datasheet." },
      { heading: "Guarantee", body: "Warranty as per the datasheet from the date of commissioning against defective design, material and workmanship." },
      { heading: "Deviations & Compliance", body: "Bidders shall submit a clause-by-clause compliance statement. Deviations, if any, shall be listed separately; a bid without a deviation list will be taken as fully compliant." },
    ],
    activity: [
      { ts: "2026-06-24T05:00:00.000Z", actor: "u_eng", action: "created", note: "Specification drafted from brief." },
    ],
  },
];
