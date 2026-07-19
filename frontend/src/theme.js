// ── Design language: clean monochrome ────────────────────────────────────────
// White / near-black / light-grey surfaces, a single clean sans, and status
// colours used only where they carry meaning (compliance & approval).

export const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');";

export const T = {
  font: {
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    // Display type is the same clean sans (heavier weight), not a serif.
    serif: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'IBM Plex Mono', 'Courier New', monospace",
  },
  c: {
    // surfaces
    canvas: "#F7F7F8",
    canvasDeep: "#EEEEF0",
    card: "#FFFFFF",
    line: "#E6E6E9",
    lineSoft: "#F1F1F3",
    // ink
    ink: "#18181B",
    inkSoft: "#5C5C64",
    inkFaint: "#9A9AA2",
    // dark chrome (loading overlays, dark accents) — near-black, not green
    pine: "#18181B",
    pineDeep: "#0E0E11",
    pineLine: "#2A2A2E",
    pineText: "#D6D6DA",
    pineFaint: "#8A8A92",
    // primary action = near-black
    brand: "#18181B",
    brandDeep: "#000000",
    brandSoft: "#EEEEF0",
    // secondary accent = also monochrome (kept as tokens so callers don't break)
    amber: "#18181B",
    amberDeep: "#000000",
    amberSoft: "#EEEEF0",
  },
  // status tokens (compliance + approval share this scale) — muted for a clean canvas
  s: {
    ok: { fg: "#177245", bg: "#EAF3EE", line: "#CFE6D9" },
    warn: { fg: "#8A6410", bg: "#F6EFDF", line: "#E7D9B6" },
    fail: { fg: "#B03A28", bg: "#F7E7E3", line: "#EDCDC4" },
    na: { fg: "#6C6C74", bg: "#EFEFF1", line: "#E0E0E4" },
    info: { fg: "#2E5C86", bg: "#E9EFF5", line: "#D0DEEC" },
  },
  radius: { sm: 6, md: 9, lg: 13, xl: 18 },
  shadow: {
    sm: "0 1px 2px rgba(24,24,27,0.05)",
    md: "0 3px 12px rgba(24,24,27,0.07)",
    lg: "0 16px 44px rgba(24,24,27,0.16)",
  },
};

// Uppercase tracked label — a signature element used throughout.
export const labelStyle = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  color: T.c.inkFaint,
  fontFamily: T.font.sans,
};

// Map an evaluation/approval status string to the status palette.
export const stat = (k) => T.s[k] || T.s.na;

// Approval-request lifecycle → display meta.
export const REQ_STATUS = {
  processing: { label: "Building…", tone: "info" },
  error: { label: "Failed", tone: "fail" },
  draft: { label: "Draft", tone: "na" },
  pending: { label: "In Approval", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "fail" },
  changes: { label: "Changes Requested", tone: "info" },
};
