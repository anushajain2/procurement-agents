import { useState, Fragment } from "react";
import { userById } from "./store.jsx";

// ── Clean monochrome spreadsheet palette ─────────────────────────────────────
const hdr = "#18181B", bdr = "#E2E2E5", bg = "#F1F1F3", rib = "#18181B";
const G = "#EAF3EE", R = "#F7E7E3", Y = "#F6EFDF", B = "#F4F4F5", NA = "#F1F1F3";
const gt = "#177245", rt = "#B03A28", yt = "#8A6410", nat = "#6C6C74";
const stBg = { ok: G, warn: Y, fail: R, na: NA };
const stClr = { ok: gt, warn: yt, fail: rt, na: nat };
const STATUS_OPTS = [
  { v: "ok", label: "✓ Compliant" },
  { v: "warn", label: "⚠ Deviation" },
  { v: "fail", label: "✗ Non-compliant" },
  { v: "na", label: "— Not found" },
];

const cb = { padding: "3px 6px", borderRight: `1px solid ${bdr}`, borderBottom: `1px solid ${bdr}`, fontSize: 11, fontFamily: "'Calibri','Segoe UI',sans-serif", textAlign: "center", verticalAlign: "middle" };
const hc = { ...cb, fontWeight: 700, background: hdr, color: "#FFF", borderRight: "1px solid #2C2C31", borderBottom: "1px solid #2C2C31" };
const rownum = { ...cb, background: bg, color: "#808080", width: 26, fontSize: 10 };

// Highlight a verbatim quote inside the real source page text.
function HighlightedDoc({ pageText, quote }) {
  const text = pageText || "";
  const q = (quote || "").trim();
  const idx = q ? text.indexOf(q) : -1;
  const mono = { fontFamily: "'Courier New', monospace", fontSize: 10.5, lineHeight: 1.6, color: "#222", whiteSpace: "pre-wrap", wordBreak: "break-word" };
  if (idx === -1) {
    return (
      <div style={mono}>
        {q && (
          <div style={{ marginBottom: 8, padding: "6px 8px", background: Y, border: "1px solid #E7D9B6", borderRadius: 3 }}>
            <div style={{ fontSize: 9, color: yt, fontWeight: 700, marginBottom: 2 }}>EXTRACTED VALUE</div>{q}
          </div>
        )}
        {text || <span style={{ color: "#999" }}>No extractable text for this page.</span>}
      </div>
    );
  }
  return (
    <div style={mono}>
      {text.slice(0, idx)}
      <span style={{ background: "#FDE68A", fontWeight: 700, padding: "0 2px", border: "1px solid #E7D9B6" }}>{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </div>
  );
}

const letterAt = (i) => String.fromCharCode(65 + i); // A, B, C, ...

// Parse a cell's text into a comparable number (₹ / Cr / L / % / commas stripped).
function parseNum(s) {
  if (s == null) return NaN;
  const t = String(s).replace(/,/g, "").trim();
  const m = t.match(/-?\d+(\.\d+)?/);
  if (!m) return NaN;
  let v = parseFloat(m[0]);
  if (/crore|\bcr\b/i.test(t)) v *= 1e7;
  else if (/lakh|\blac?\b/i.test(t)) v *= 1e5;
  else if (/million|\bmn\b/i.test(t)) v *= 1e6;
  return v;
}
const fmtNum = (v) => (Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 }));
const isFormula = (raw) => typeof raw === "string" && raw.trim().startsWith("=");

export default function BidSheet({
  result, awardedVendor, fileName = "TBE.xlsx", canEdit = false,
  onEditCell, onEditRemark, onEdited, bottomLabel = "COMPLIANCE", bottomMark = true,
  onAddRow, onDeleteRow, onAddColumn, onRenameColumn, onDeleteColumn, onEditCategory, onEditParam,
}) {
  const [panel, setPanel] = useState(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const vendors = result.vendors || [];
  const customCols = result.customCols || [];
  const structural = !!(onAddRow || onAddColumn); // Excel-like add row/column available

  // Group rows into ordered sections by category (keep original row index for edits).
  const sections = [];
  const seen = new Map();
  (result.rows || []).forEach((r, idx) => {
    if (!seen.has(r.category)) { seen.set(r.category, { category: r.category, rows: [] }); sections.push(seen.get(r.category)); }
    seen.get(r.category).rows.push({ ...r, _i: idx });
  });

  // Column model in display order → drives letters + formula addressing.
  const colModel = [
    { kind: "param" }, { kind: "unit" }, { kind: "req" },
    ...vendors.map((v) => ({ kind: "vendor", key: v, label: v })),
    ...customCols.map((c) => ({ kind: "custom", key: c.id, id: c.id, label: c.name })),
    { kind: "remark" },
  ];
  const totalCols = colModel.length;

  const vendorHeaderBg = (v) => {
    const flagged = (result.rows || []).some((r) => r.cells?.[v]?.status === "fail");
    return v === awardedVendor ? "#18181B" : flagged ? "#52525B" : "#3F3F46";
  };

  const rowRemark = (row) => {
    if (row.remark != null) return { text: row.remark, by: row.remarkBy || null };
    const parts = [];
    vendors.forEach((v) => { const c = row.cells?.[v]; if (c && c.remark) parts.push(`${v}: ${c.remark}`); });
    return { text: parts.join("  ·  "), by: null };
  };

  // ── Formula addressing (A1-style, matching the letters/numbers shown) ────────
  let pre = 3; const numbered = [];
  sections.forEach((section) => {
    pre += 1; numbered.push({ kind: "section", num: pre, section });
    section.rows.forEach((row) => { pre += 1; numbered.push({ kind: "row", num: pre, row }); });
  });
  const colByLetter = {}; colModel.forEach((c, i) => (colByLetter[letterAt(i)] = c));
  const rowByNum = {}; numbered.forEach((x) => { if (x.kind === "row") rowByNum[x.num] = x.row; });
  const rawCell = (col, row) => {
    if (!col || !row) return "";
    if (col.kind === "param") return row.parameter || "";
    if (col.kind === "unit") return row.unit || "";
    if (col.kind === "req") return row.mr || "";
    if (col.kind === "remark") return rowRemark(row).text || "";
    return row.cells?.[col.key]?.value ?? "";
  };
  const memo = {}; const active = new Set();
  const expandRange = (a, b) => {
    const ma = /^([A-Z]+)(\d+)$/.exec(a), mb = /^([A-Z]+)(\d+)$/.exec(b);
    if (!ma || !mb) return [];
    const c1 = ma[1].charCodeAt(0), c2 = mb[1].charCodeAt(0), r1 = +ma[2], r2 = +mb[2], out = [];
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) out.push(String.fromCharCode(c) + r);
    return out;
  };
  const addrValue = (addr) => {
    addr = addr.toUpperCase();
    if (addr in memo) return memo[addr];
    const m = /^([A-Z]+)(\d+)$/.exec(addr); if (!m) return NaN;
    const raw = rawCell(colByLetter[m[1]], rowByNum[+m[2]]);
    let val;
    if (isFormula(raw)) {
      if (active.has(addr)) return NaN;
      active.add(addr); val = evalExpr(raw.trim().slice(1)); active.delete(addr);
    } else val = parseNum(raw);
    memo[addr] = val; return val;
  };
  function evalExpr(expr) {
    try {
      let s = expr.replace(/\b(SUM|AVG|AVERAGE|MIN|MAX|COUNT)\s*\(([^()]*)\)/gi, (mm, fn, args) => {
        let nums = [];
        args.split(",").map((x) => x.trim()).filter(Boolean).forEach((p) => {
          if (p.includes(":")) { const [a, b] = p.split(":"); expandRange(a, b).forEach((ad) => nums.push(addrValue(ad))); }
          else if (/^[A-Z]+\d+$/i.test(p)) nums.push(addrValue(p));
          else nums.push(parseFloat(p));
        });
        nums = nums.filter((n) => !isNaN(n));
        const f = fn.toUpperCase();
        if (f === "SUM") return String(nums.reduce((a, b) => a + b, 0));
        if (f === "COUNT") return String(nums.length);
        if (f === "MIN") return String(nums.length ? Math.min(...nums) : 0);
        if (f === "MAX") return String(nums.length ? Math.max(...nums) : 0);
        return String(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
      });
      s = s.replace(/[A-Z]+\d+/gi, (ad) => { const v = addrValue(ad); return isNaN(v) ? "0" : String(v); });
      if (!/^[-+*/(). 0-9eE]*$/.test(s)) return NaN;
      // eslint-disable-next-line no-new-func
      const r = Function('"use strict";return (' + (s || "0") + ")")();
      return typeof r === "number" && isFinite(r) ? r : NaN;
    } catch { return NaN; }
  }
  // What a cell shows: formulas are evaluated; everything else is verbatim.
  const shown = (raw) => {
    if (isFormula(raw)) { const v = evalExpr(raw.trim().slice(1)); return isNaN(v) ? "#ERR" : fmtNum(v); }
    return raw;
  };

  const openCell = (rowI, key) => {
    if (editing) return;
    const cell = (result.rows[rowI].cells || {})[key];
    if (cell && cell.source) setPanel({ rowI, vendor: key, cell, param: result.rows[rowI].parameter, mr: result.rows[rowI].mr, unit: result.rows[rowI].unit });
  };

  const mark = () => setDirty(true);
  const commitCell = (rowI, key, patch) => { mark(); onEditCell && onEditCell(rowI, key, patch); };
  const commitRemark = (rowI, text) => { mark(); onEditRemark && onEditRemark(rowI, text); };
  const toggleEdit = () => {
    if (editing && dirty) { onEdited && onEdited(); setDirty(false); }
    setEditing((e) => !e);
    setPanel(null);
  };
  const cellInput = { width: "100%", border: `1px solid ${bdr}`, borderRadius: 2, fontSize: 10.5, fontFamily: "inherit", textAlign: "center", padding: "1px 2px", background: "#FFF", color: "#222", outline: "none" };

  let rn = 3;

  return (
    <div style={{ fontFamily: "'Calibri','Segoe UI',sans-serif", border: `1px solid ${bdr}`, borderRadius: 4, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.12)", background: bg }}>
      {/* Ribbon */}
      <div style={{ height: 28, background: rib, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
        <span style={{ color: "#FFF", fontSize: 12 }}>📊 {fileName}</span>
      </div>
      {/* Menu tabs */}
      <div style={{ height: 28, background: "#F3F3F3", borderBottom: "1px solid #D4D4D4", display: "flex", alignItems: "center", padding: "0 6px" }}>
        {["File", "Home", "Insert", "Data", "Review"].map((t, i) => (
          <span key={i} style={{ padding: "3px 10px", fontSize: 11.5, color: i === 0 ? rib : "#333" }}>{t}</span>
        ))}
        {canEdit && (
          <button onClick={toggleEdit} style={{ marginLeft: "auto", marginRight: 2, padding: "3px 12px", fontSize: 11.5, fontFamily: "inherit", fontWeight: 600, cursor: "pointer", borderRadius: 4, border: `1px solid ${editing ? rib : bdr}`, background: editing ? rib : "#FFF", color: editing ? "#FFF" : "#333" }}>
            {editing ? "✓ Done editing" : "✎ Edit sheet"}
          </button>
        )}
      </div>
      {/* Info / formula bar */}
      <div style={{ minHeight: 22, background: "#FFF", borderBottom: "1px solid #D4D4D4", padding: "3px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 10.5, color: editing ? rt : panel ? "#18181B" : "#999", fontWeight: editing || panel ? 500 : 400 }}>
          {editing
            ? "Editing — type values, or a formula like =E5*0.9 or =SUM(E5:E9). Changes save automatically."
            : panel ? `Viewing source: ${panel.param} — ${panel.vendor}` : "Click any vendor cell to see the exact source document →"}
        </span>
        {editing && structural && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {onAddRow && <button onClick={() => { mark(); onAddRow(); }} style={miniBtn}>＋ Row</button>}
            {onAddColumn && <button onClick={() => { mark(); onAddColumn(); }} style={miniBtn}>＋ Column</button>}
          </span>
        )}
      </div>

      <div style={{ display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "auto", maxHeight: "70vh", background: "#FFF" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
            <thead>
              {/* Column letters */}
              <tr>
                <th style={{ ...hc, ...rownum }}></th>
                {colModel.map((c, i) => (
                  <th key={i} style={{ ...hc, background: bg, color: "#808080", minWidth: c.kind === "unit" ? 48 : c.kind === "param" || c.kind === "req" || c.kind === "remark" ? 150 : 110 }}>{letterAt(i)}</th>
                ))}
              </tr>
              {/* Title row */}
              <tr>
                <td style={rownum}>1</td>
                <td colSpan={totalCols} style={{ ...cb, textAlign: "left", fontSize: 12.5, fontWeight: 700, color: hdr, borderBottom: `2px solid ${hdr}`, background: "#FFF", padding: "6px 9px" }}>
                  {result.title}{result.mr_summary ? ` — ${result.mr_summary}` : ""}
                </td>
              </tr>
              {/* Header row */}
              <tr>
                <td style={rownum}>3</td>
                <th style={{ ...hc, textAlign: "left" }}>Parameter</th>
                <th style={hc}>Unit</th>
                <th style={hc}>Requirement</th>
                {vendors.map((v, i) => (
                  <th key={i} style={{ ...hc, background: vendorHeaderBg(v) }}>{v}{v === awardedVendor ? " ★" : ""}</th>
                ))}
                {customCols.map((c) => (
                  <th key={c.id} style={{ ...hc, background: "#3F3F46" }}>
                    {editing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <input value={c.name} onChange={(e) => { mark(); onRenameColumn && onRenameColumn(c.id, e.target.value); }}
                          style={{ width: "100%", border: "1px solid #55555C", borderRadius: 2, fontSize: 10.5, fontFamily: "inherit", fontWeight: 700, textAlign: "center", padding: "1px 2px", background: "#2C2C31", color: "#FFF", outline: "none" }} />
                        <span onClick={() => { mark(); onDeleteColumn && onDeleteColumn(c.id); }} title="Delete column" style={{ cursor: "pointer", color: "#C9C9CE", fontSize: 12, padding: "0 2px" }}>✕</span>
                      </div>
                    ) : (c.name || "Column")}
                  </th>
                ))}
                <th style={{ ...hc, background: "#5B5B5B", textAlign: "left" }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, si) => (
                <Fragment key={si}>
                  <tr style={{ background: B }}>
                    <td style={rownum}>{++rn}</td>
                    <td colSpan={totalCols} style={{ ...cb, textAlign: "left", fontWeight: 700, fontSize: 10.5, color: "#52525B", letterSpacing: "0.03em", background: B }}>{section.category}</td>
                  </tr>
                  {section.rows.map((row, ri) => {
                    const rowBg = ri % 2 ? "#FAFAFA" : "#FFF";
                    const rmk = rowRemark(row);
                    const custom = !!row.custom;
                    return (
                      <tr key={ri} style={{ background: rowBg }}>
                        <td style={rownum}>{++rn}</td>
                        {/* Parameter */}
                        <td style={{ ...cb, textAlign: "left", fontWeight: 500, fontSize: 10.5, padding: editing ? "2px 3px" : "3px 6px" }}>
                          {editing && custom ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <input value={row.parameter} onChange={(e) => { mark(); onEditParam && onEditParam(row._i, { parameter: e.target.value }); }} placeholder="Row name" style={{ ...cellInput, textAlign: "left" }} />
                              {onDeleteRow && <span onClick={() => { mark(); onDeleteRow(row._i); }} title="Delete row" style={{ cursor: "pointer", color: "#B03A28", fontSize: 12, padding: "0 2px" }}>✕</span>}
                            </div>
                          ) : row.parameter}
                        </td>
                        {/* Unit */}
                        <td style={{ ...cb, color: "#666", fontSize: 10, padding: editing ? "2px 3px" : "3px 6px" }}>
                          {editing && custom ? <input value={row.unit || ""} onChange={(e) => { mark(); onEditParam && onEditParam(row._i, { unit: e.target.value }); }} style={cellInput} /> : row.unit}
                        </td>
                        {/* Requirement */}
                        <td style={{ ...cb, background: B, fontSize: 10, textAlign: "left", lineHeight: 1.35, padding: editing ? "2px 3px" : "3px 6px" }}>
                          {editing && custom ? (
                            <input value={row.mr || ""} onChange={(e) => { mark(); onEditParam && onEditParam(row._i, { mr: e.target.value }); }} placeholder="Requirement" style={{ ...cellInput, textAlign: "left" }} />
                          ) : (
                            <>
                              <div>{row.mr || "—"}</div>
                              {row.standard && (
                                <div style={{ fontSize: 8.5, color: "#52525B", fontWeight: 600, marginTop: 1 }} title={`Governing standard: ${row.standard}`}>
                                  ⬡ {row.standard}{row.standard_requirement ? `: ${row.standard_requirement}` : ""}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        {/* Vendor cells */}
                        {vendors.map((v, vi) => {
                          const cell = row.cells[v] || { value: "—", status: "na" };
                          const s = stBg[cell.status] ? cell.status : "na";
                          const clickable = !editing && !!cell.source;
                          const activeCell = panel && panel.rowI === row._i && panel.vendor === v;
                          return (
                            <td key={vi} onClick={() => clickable && openCell(row._i, v)} title={clickable ? "Click to view source document" : isFormula(cell.value) ? cell.value : ""}
                              style={{ ...cb, background: stBg[s], color: stClr[s], fontWeight: s === "fail" ? 700 : 400, cursor: editing ? "default" : clickable ? "pointer" : "cell", boxShadow: activeCell ? `inset 0 0 0 2px ${hdr}` : "none", padding: editing ? "2px 3px" : "3px 6px" }}>
                              {editing ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <input value={cell.value === "—" ? "" : cell.value} onChange={(e) => commitCell(row._i, v, { value: e.target.value || "—" })} style={cellInput} />
                                  <select value={s} onChange={(e) => commitCell(row._i, v, { status: e.target.value })}
                                    style={{ width: "100%", border: `1px solid ${bdr}`, borderRadius: 2, fontSize: 9.5, fontFamily: "inherit", padding: "1px", background: "#FFF", color: stClr[s], outline: "none" }}>
                                    {STATUS_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                                  </select>
                                </div>
                              ) : (
                                <span style={{ borderBottom: clickable ? "1px dotted currentColor" : "none" }}>{shown(cell.value)}</span>
                              )}
                            </td>
                          );
                        })}
                        {/* Custom column cells (value / formula only, no compliance status) */}
                        {customCols.map((c) => {
                          const cell = row.cells[c.id] || { value: "" };
                          return (
                            <td key={c.id} title={isFormula(cell.value) ? cell.value : ""} style={{ ...cb, background: "#FFFDF5", fontWeight: 500, padding: editing ? "2px 3px" : "3px 6px" }}>
                              {editing ? (
                                <input value={cell.value || ""} onChange={(e) => commitCell(row._i, c.id, { value: e.target.value })} placeholder="value or =…" style={cellInput} />
                              ) : shown(cell.value)}
                            </td>
                          );
                        })}
                        {/* Remarks */}
                        <td style={{ ...cb, textAlign: "left", fontSize: 9.5, color: "#555", background: rowBg, padding: editing ? "2px 3px" : "3px 6px" }}>
                          {editing ? (
                            <input value={rmk.text} placeholder="Add a comment…" onChange={(e) => commitRemark(row._i, e.target.value)}
                              style={{ width: "100%", border: `1px solid ${bdr}`, borderRadius: 2, fontSize: 9.5, fontFamily: "inherit", padding: "2px 4px", background: "#FFFCEC", color: "#333", outline: "none" }} />
                          ) : (
                            <>
                              {rmk.text}
                              {rmk.by && <span style={{ color: "#18181B", fontStyle: "italic", whiteSpace: "nowrap" }}> (Comment by {userById(rmk.by).name})</span>}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {/* Spacer + bottom (compliance / price) row */}
              <tr><td style={{ ...cb, background: bg, border: "none" }}></td><td colSpan={totalCols} style={{ height: 3, borderBottom: `2px solid ${hdr}` }}></td></tr>
              <tr style={{ background: bg }}>
                <td style={rownum}></td>
                <td colSpan={2} style={{ ...cb, fontWeight: 700, textAlign: "left", background: bg }}>{bottomLabel}</td>
                <td style={{ ...cb, background: B }}></td>
                {vendors.map((v, i) => {
                  const c = result.compliance?.[v] || { score: "0/0", counts: {} };
                  const allOk = (c.counts?.fail || 0) === 0;
                  const isBest = bottomMark ? false : v === awardedVendor;
                  return <td key={i} style={{ ...cb, background: bottomMark ? (allOk ? G : R) : (isBest ? G : bg), fontWeight: 700, color: bottomMark ? (allOk ? gt : rt) : (isBest ? gt : "#333") }}>{c.score}{bottomMark ? ` ${allOk ? "✓" : "✗"}` : isBest ? " ★" : ""}</td>;
                })}
                {customCols.map((c) => <td key={c.id} style={{ ...cb, background: bg }}></td>)}
                <td style={{ ...cb, textAlign: "left", fontWeight: 600, fontSize: 9.5, background: bg }}>{result.ranking}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Source document panel */}
        {panel && (
          <div style={{ width: 340, borderLeft: `2px solid ${hdr}`, background: "#F7F7F7", overflow: "auto", flexShrink: 0, maxHeight: "70vh" }}>
            <div style={{ padding: "7px 12px", background: hdr, color: "#FFF", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>Source document</div>
                <div style={{ fontSize: 9, opacity: 0.85 }}>{panel.vendor} — {panel.param}: {panel.cell.value}</div>
              </div>
              <span onClick={() => setPanel(null)} style={{ cursor: "pointer", fontSize: 15, opacity: 0.8, padding: "0 4px" }}>✕</span>
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <div style={{ flex: 1, padding: "5px 8px", borderRadius: 4, fontSize: 10, textAlign: "center", fontWeight: 600, background: stBg[panel.cell.status] || NA, color: stClr[panel.cell.status] || nat }}>
                  {panel.cell.status === "ok" ? "✓ COMPLIANT" : panel.cell.status === "warn" ? "⚠ WARNING" : panel.cell.status === "fail" ? "✗ NON-COMPLIANT" : "— NOT FOUND"}
                </div>
                <div style={{ padding: "5px 8px", borderRadius: 4, fontSize: 10, background: "#FFF", border: `1px solid ${bdr}`, color: "#555" }}>MR: {panel.mr}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 4, background: "#FFF", border: `1px solid ${bdr}`, marginBottom: 8 }}>
                <div style={{ width: 18, height: 22, borderRadius: 2, background: "#EA4335", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 6.5, fontWeight: 700, flexShrink: 0 }}>PDF</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, wordBreak: "break-all" }}>{panel.cell.source.file}</div>
                  <div style={{ fontSize: 8.5, color: "#888" }}>Page {panel.cell.source.page}</div>
                </div>
              </div>
              <div style={{ background: "#FFF", border: "1px solid #C0C0C0", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ padding: "4px 8px", background: "#F5F5F5", borderBottom: "1px solid #DDD", fontSize: 9, color: "#888" }}>{panel.cell.source.file} — Page {panel.cell.source.page}</div>
                <div style={{ padding: "10px 12px", maxHeight: 300, overflow: "auto" }}>
                  <HighlightedDoc pageText={panel.cell.source.page_text} quote={panel.cell.source.quote} />
                </div>
              </div>
              <div style={{ marginTop: 5, fontSize: 8.5, color: "#888", textAlign: "center", fontStyle: "italic" }}>Yellow = value located by AI in this document</div>
              {panel.cell.remark && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 4, background: "#FFF", border: "1px solid #E0E0E0", fontSize: 10, color: "#333", lineHeight: 1.5 }}>
                  <strong>Evaluator note:</strong> {panel.cell.remark}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sheet tabs */}
      <div style={{ height: 24, background: bg, borderTop: `1px solid ${bdr}`, display: "flex", alignItems: "center", padding: "0 8px", gap: 2 }}>
        {["TBE Matrix", ...vendors, "Summary"].map((t, i) => (
          <span key={i} style={{ padding: "2px 11px", fontSize: 10, background: i === 0 ? "#FFF" : bg, border: `1px solid ${i === 0 ? bdr : "transparent"}`, borderTop: i === 0 ? `2px solid ${rib}` : "none", fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "#222" : "#666" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

const miniBtn = { padding: "2px 9px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, cursor: "pointer", borderRadius: 4, border: `1px solid ${bdr}`, background: "#FFF", color: "#18181B" };
