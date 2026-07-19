import { useState, useEffect, useRef } from "react";
import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, Label, Pill, Modal, Spinner } from "../ui.jsx";
import { useApp } from "../store.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const fmtSize = (b) => (b == null ? "" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB");

// POST a form with a hard timeout, so a hang or unreachable backend surfaces an
// error instead of leaving the loading overlay stuck forever.
async function postForm(url, fd, timeoutMs = 300000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method: "POST", body: fd, signal: ctrl.signal });
    if (!resp.ok) { let m = `Request failed (${resp.status})`; try { m = (await resp.json()).detail || m; } catch { /* ignore */ } throw new Error(m); }
    return await resp.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("This is taking longer than expected and timed out. Very large or scanned documents are slow — try splitting them or pasting the key text, then run again.");
    if (e instanceof TypeError) throw new Error(`Couldn't reach the backend at ${API_URL}. Is it running (uvicorn on :8000)?`);
    throw e;
  } finally { clearTimeout(t); }
}
const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.xlsx,.xls";

let _vid = 0;
const newVendor = () => ({ id: ++_vid, name: `Vendor ${_vid}`, files: [], text: "" });
const inputStyle = { width: "100%", padding: "9px 12px", border: `1px solid ${T.c.line}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", color: T.c.ink, background: "#FAFAFA", outline: "none" };

const SAMPLE_BOQ = {
  doc_type: "boq",
  title: "Phase-II Substation — Electrical Package (Tender HVPNL/EL/2026/07)",
  summary: "Supply of major and balance-of-plant electrical equipment for the 33/11 kV Phase-II substation.",
  model: "claude-opus-4-8",
  items: [
    { item_no: "1", description: "33/11 kV, 10 MVA ONAN Power Transformer", unit: "no", quantity: "1", category: "Power Transformers", complexity: "detailed", spec_summary: "10 MVA, 33/11 kV, Dyn11, ONAN. Losses per IS 1180 EEL-1, impedance 10±7.5% per IS 2026, OLTC ±10%, type tests from CPRI/NABL, warranty ≥24 months.", group: "g1" },
    { item_no: "2", description: "11 kV Indoor VCB Switchgear (8 panels)", unit: "set", quantity: "1", category: "Switchgear", complexity: "detailed", spec_summary: "12 kV, 1250 A busbar, 25 kA/3s, vacuum draw-out breakers, IP4X, per IEC 62271-200. Numerical protection, 110 V DC.", group: "g2" },
    { item_no: "3", description: "HT XLPE Power Cable, 11 kV, 3C x 240 sq.mm", unit: "m", quantity: "1200", category: "Cables & Conductors", complexity: "simple", spec_summary: "11 kV (E) XLPE, 3C×240 sq.mm, aluminium, armoured, per IS 7098-2 / IEC 60502-2.", group: "g3" },
    { item_no: "4", description: "LT XLPE Power Cable, 1.1 kV, 3.5C x 185 sq.mm", unit: "m", quantity: "800", category: "Cables & Conductors", complexity: "simple", spec_summary: "1.1 kV XLPE, 3.5C×185 sq.mm, aluminium, armoured, per IS 7098-1.", group: "g3" },
    { item_no: "5", description: "Earthing Strip, GI 50x6 mm", unit: "m", quantity: "600", category: "Electrical Equipment", complexity: "simple", spec_summary: "Hot-dip galvanised earthing strip 50×6 mm per IS 3043.", group: "g3" },
    { item_no: "6", description: "LED Street Light Fittings, 90 W", unit: "no", quantity: "40", category: "Electrical Equipment", complexity: "simple", spec_summary: "90 W LED, IP66, ≥120 lm/W, surge 10 kV, per IS 10322 / LM-79.", group: "g3" },
  ],
  groups: [
    { group: "g1", title: "33/11 kV, 10 MVA Power Transformer", combined: false, rationale: "Engineered item with a detailed datasheet — evaluated on its own sheet." },
    { group: "g2", title: "11 kV VCB Switchgear", combined: false, rationale: "Detailed switchgear specification — its own sheet." },
    { group: "g3", title: "Cables, Earthing & Lighting (commodity items)", combined: true, rationale: "Four simple commodity items with short specs — combined into one comparison sheet." },
  ],
};

function FileRow({ f, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 7, background: T.c.canvas, border: `1px solid ${T.c.lineSoft}` }}>
      <div style={{ width: 20, height: 25, borderRadius: 3, background: "#8A8A92", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 6.5, fontWeight: 700, flexShrink: 0 }}>DOC</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
        <div style={{ fontSize: 10, color: T.c.inkFaint }}>{fmtSize(f.size)}</div>
      </div>
      <span onClick={onRemove} style={{ cursor: "pointer", color: T.c.inkFaint, display: "flex" }}><Icon name="x" size={14} /></span>
    </div>
  );
}

function DropZone({ label, hint, onAdd }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  return (
    <div onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onAdd(e.dataTransfer.files); }}
      style={{ cursor: "pointer", padding: "18px 12px", borderRadius: 9, border: `1.5px dashed ${drag ? T.c.ink : T.c.line}`, background: drag ? T.c.canvasDeep : "#FAFAFA", textAlign: "center", color: T.c.inkSoft, fontSize: 12 }}>
      <Icon name="upload" size={20} color={T.c.inkFaint} style={{ marginBottom: 4 }} />
      <div>{label} or <span style={{ color: T.c.ink, fontWeight: 600 }}>browse</span></div>
      <div style={{ fontSize: 10, color: T.c.inkFaint, marginTop: 2 }}>{hint}</div>
      <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: "none" }} onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function Check({ on, indeterminate, small }) {
  const sz = small ? 17 : 20;
  return (
    <div style={{ width: sz, height: sz, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${on || indeterminate ? T.c.ink : T.c.line}`, background: on || indeterminate ? T.c.ink : "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginTop: small ? 1 : 0 }}>
      {on && <Icon name="check" size={small ? 12 : 14} color="#fff" />}
      {indeterminate && <div style={{ width: 8, height: 2, background: "#fff", borderRadius: 1 }} />}
    </div>
  );
}

function BoqGroups({ parsed, sel, toggleItem, toggleGroup, editing, assignItemGroup, newGroupForItem, setGroupTitle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {parsed.groups.map((g) => {
        const items = parsed.items.map((it, idx) => ({ it, idx })).filter((x) => x.it.group === g.group);
        const selCount = items.filter((x) => sel.has(x.idx)).length;
        const allOn = selCount === items.length && items.length > 0;
        return (
          <Card key={g.group} pad={0} style={{ overflow: "hidden", borderColor: selCount ? T.c.ink : T.c.line }}>
            <div onClick={() => !editing && toggleGroup(g.group, !allOn)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderBottom: `1px solid ${T.c.lineSoft}`, cursor: editing ? "default" : "pointer", background: selCount ? T.c.canvas : "#fff" }}>
              {!editing && <Check on={allOn} indeterminate={selCount > 0 && !allOn} />}
              {editing && <Icon name="sheet" size={16} color={T.c.inkSoft} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {editing ? (
                    <input value={g.title} onClick={(e) => e.stopPropagation()} onChange={(e) => setGroupTitle(g.group, e.target.value)} placeholder="Sheet name"
                      style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink, border: `1px solid ${T.c.line}`, borderRadius: 6, padding: "3px 8px", outline: "none", fontFamily: T.font.sans, minWidth: 220 }} />
                  ) : (
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink }}>{g.title}</span>
                  )}
                  <Pill tone={g.combined ? "info" : "na"} size="sm" dot={false}>{g.combined ? "Combined sheet" : "Own sheet"}</Pill>
                  <span style={{ fontSize: 11.5, color: T.c.inkFaint }}>{items.length} item{items.length === 1 ? "" : "s"}</span>
                </div>
                {!editing && <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginTop: 2 }}>{g.rationale}</div>}
              </div>
            </div>
            <div>
              {items.map(({ it, idx }, i) => {
                const on = sel.has(idx);
                return (
                  <div key={idx} onClick={() => !editing && toggleItem(idx)} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 14px 10px 34px", borderBottom: i < items.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", cursor: editing ? "default" : "pointer", background: on ? "#fff" : "#FBFBFC" }}>
                    {!editing && <Check on={on} small />}
                    <div style={{ flex: 1, minWidth: 0, opacity: on || editing ? 1 : 0.55 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.c.inkFaint }}>{it.item_no}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: T.c.ink }}>{it.description}</span>
                        <span style={{ fontSize: 11, color: T.c.inkFaint }}>· {it.quantity} {it.unit}</span>
                        <Pill tone={it.complexity === "detailed" ? "warn" : "na"} size="sm" dot={false}>{it.complexity}</Pill>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{it.spec_summary}</div>
                      {editing && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: T.c.inkFaint }}>Put on sheet:</span>
                          <select value={it.group} onChange={(e) => e.target.value === "__new__" ? newGroupForItem(idx) : assignItemGroup(idx, e.target.value)}
                            style={{ fontSize: 12, fontFamily: T.font.sans, color: T.c.ink, border: `1px solid ${T.c.line}`, borderRadius: 6, padding: "4px 8px", background: "#fff", outline: "none", cursor: "pointer" }}>
                            {parsed.groups.map((gg) => <option key={gg.group} value={gg.group}>{gg.title || "Untitled sheet"}</option>)}
                            <option value="__new__">＋ New separate sheet…</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function VendorCard({ vendor, index, onName, onAddFiles, onRemoveFile, onText, onRemove, canRemove }) {
  return (
    <Card pad={0} style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.c.lineSoft}`, display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: T.c.canvasDeep, color: T.c.ink, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{index + 1}</div>
        <input value={vendor.name} onChange={(e) => onName(e.target.value)} placeholder="Vendor name"
          style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: T.c.ink, border: "none", outline: "none", padding: "2px 0", background: "transparent", fontFamily: T.font.sans }} />
        {canRemove && <span onClick={onRemove} title="Remove vendor" style={{ cursor: "pointer", color: T.c.inkFaint, display: "flex" }}><Icon name="x" size={16} /></span>}
      </div>
      <div style={{ padding: 13, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {vendor.files.map((f, i) => <FileRow key={i} f={f} onRemove={() => onRemoveFile(i)} />)}
        <DropZone label="Drop the vendor's response" hint="PDF · DOCX · XLSX · TXT — any format" onAdd={onAddFiles} />
        <textarea value={vendor.text} onChange={(e) => onText(e.target.value)} placeholder="…or paste the vendor's quote / offer text here"
          style={{ width: "100%", minHeight: 60, resize: "vertical", padding: "8px 10px", border: `1px solid ${T.c.line}`, borderRadius: 8, fontSize: 12, fontFamily: T.font.mono, lineHeight: 1.5, color: T.c.ink, background: "#FAFAFA", outline: "none" }} />
      </div>
    </Card>
  );
}

const EVAL_STEPS = ["Deriving evaluation parameters…", "Extracting values from each vendor's documents…", "Checking compliance…", "Locating source evidence…", "Building the comparison sheet…"];
const PARSE_STEPS = ["Reading the document(s)…", "Detecting PR vs BOQ…", "Extracting the line items…", "Grouping items for evaluation…"];
const RFQ_STEPS = ["Identifying the applicable standards…", "Checking current standard editions…", "Drafting the parameter datasheet…", "Writing the specification sections…", "Flagging values that need engineer confirmation…"];

function Evaluating({ heading, sub, steps }) {
  const STEPS = steps || EVAL_STEPS;
  const [step, setStep] = useState(0);
  useEffect(() => { if (step >= STEPS.length - 1) return; const t = setTimeout(() => setStep((s) => s + 1), 1500); return () => clearTimeout(t); }, [step, STEPS.length]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(247,247,248,0.9)", backdropFilter: "blur(4px)", color: T.c.ink, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ width: 540, maxWidth: "90%", background: T.c.card, border: `1px solid ${T.c.line}`, borderRadius: T.radius.xl, padding: 28, boxShadow: T.shadow.lg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: T.c.ink, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="spark" size={20} color="#fff" /></div>
          <div><div style={{ fontSize: 18, fontWeight: 700 }}>{heading}</div><div style={{ fontSize: 12.5, color: T.c.inkSoft }}>{sub}</div></div>
        </div>
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "8px 2px", opacity: state === "todo" ? 0.5 : 1, transition: "opacity .3s" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: state === "done" ? T.c.ink : T.c.canvasDeep, color: "#fff" }}>{state === "done" ? <Icon name="check" size={13} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: state === "active" ? T.c.ink : T.c.inkFaint }} />}</span>
              <span style={{ fontSize: 13.5, color: state === "active" ? T.c.ink : state === "done" ? T.c.inkSoft : T.c.inkFaint, fontWeight: state === "active" ? 500 : 400 }}>{s}</span>
            </div>
          );
        })}
        {step >= STEPS.length - 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.c.lineSoft}` }}>
            <Spinner />
            <span style={{ fontSize: 12.5, color: T.c.inkSoft }}>Please wait — this might take a few minutes.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBar({ stage }) {
  const steps = [["intake", "Requirement"], ["review", "Review items"], ["choose", "Next step"]];
  const idx = { intake: 0, review: 1, choose: 2, responses: 2 }[stage];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {steps.map(([k, label], i) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", background: i <= idx ? T.c.ink : T.c.canvasDeep, color: i <= idx ? "#fff" : T.c.inkFaint }}>{i < idx ? "✓" : i + 1}</span>
            <span style={{ fontSize: 12.5, fontWeight: i === idx ? 600 : 400, color: i === idx ? T.c.ink : T.c.inkFaint }}>{label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: T.c.line }} />}
        </div>
      ))}
    </div>
  );
}

export default function NewEvaluation() {
  const { navigate, createProcessing, finishEvaluation, failEvaluation, createSpec, view } = useApp();
  const seed = view.params || {};
  const [stage, setStage] = useState("intake");
  const [files, setFiles] = useState([]);
  const [text, setText] = useState(seed.seedReq || "");
  const [category, setCategory] = useState(seed.category || "Electrical Equipment");
  const [value, setValue] = useState("");
  const [parsed, setParsed] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [editingGroups, setEditingGroups] = useState(false);
  const [vendors, setVendors] = useState([newVendor(), newVendor()]);
  const [busy, setBusy] = useState(null);
  const [rfqDone, setRfqDone] = useState(null); // [{id,title}]
  const [error, setError] = useState("");

  const selGroups = parsed ? parsed.groups
    .map((g) => ({ g, items: parsed.items.map((it, idx) => ({ it, idx })).filter((x) => x.it.group === g.group && sel.has(x.idx)).map((x) => x.it) }))
    .filter((x) => x.items.length) : [];
  const isBoq = parsed?.doc_type === "boq" || (parsed && parsed.items.length > 1);

  const addTo = (setter) => (list) => setter((cur) => [...cur, ...Array.from(list).map((file) => ({ name: file.name, size: file.size, file }))]);
  const applyParsed = (p) => { setParsed(p); setSel(new Set(p.items.map((_, i) => i))); setStage("review"); };
  const toggleItem = (idx) => setSel((s) => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const toggleGroup = (group, on) => setSel((s) => { const n = new Set(s); parsed.items.forEach((it, idx) => { if (it.group === group) on ? n.add(idx) : n.delete(idx); }); return n; });

  // ── Editable grouping (which items are clubbed onto one evaluation sheet) ─────
  // Keep the `groups` list consistent with the items' `group` keys: a group with
  // more than one item is a combined sheet; a lone item gets its own.
  const recomputeGroups = (items, prevGroups) => {
    const order = [];
    const byKey = new Map();
    items.forEach((it) => { if (!byKey.has(it.group)) { byKey.set(it.group, []); order.push(it.group); } byKey.get(it.group).push(it); });
    return order.map((key) => {
      const its = byKey.get(key);
      const prev = prevGroups.find((g) => g.group === key);
      return {
        group: key,
        title: prev?.title || its[0].description,
        combined: its.length > 1,
        rationale: prev?.rationale || (its.length > 1 ? "Clubbed onto one comparison sheet." : "Evaluated on its own sheet."),
      };
    });
  };
  const assignItemGroup = (idx, key) => setParsed((p) => {
    const items = p.items.map((it, i) => (i === idx ? { ...it, group: key } : it));
    return { ...p, items, groups: recomputeGroups(items, p.groups) };
  });
  const newGroupForItem = (idx) => setParsed((p) => {
    const key = "g_" + Math.random().toString(36).slice(2, 7);
    const items = p.items.map((it, i) => (i === idx ? { ...it, group: key } : it));
    return { ...p, items, groups: recomputeGroups(items, p.groups) };
  });
  const setGroupTitle = (key, title) => setParsed((p) => ({ ...p, groups: p.groups.map((g) => (g.group === key ? { ...g, title } : g)) }));

  const setVendor = (id, patch) => setVendors((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const addVFiles = (id, list) => { const arr = Array.from(list).map((file) => ({ name: file.name, size: file.size, file })); if (arr.length) setVendor(id, { files: [...vendors.find((v) => v.id === id).files, ...arr] }); };
  const removeVFile = (id, idx) => setVendor(id, { files: vendors.find((v) => v.id === id).files.filter((_, i) => i !== idx) });

  const groupText = (g, items) => {
    const L = [g.title]; if (parsed.summary) L.push(parsed.summary);
    L.push("\nItems:");
    items.forEach((it) => { L.push(`\n[${it.item_no}] ${it.description}  (Qty: ${it.quantity} ${it.unit})`); if (it.spec_summary) L.push(it.spec_summary); });
    return L.join("\n");
  };

  const parseIntake = async () => {
    setError(""); setBusy({ heading: "Reading your requirement", sub: "Detecting the document type and extracting the items…", steps: PARSE_STEPS });
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f.file, f.name));
      fd.append("text", text);
      const out = await postForm(`${API_URL}/api/parse-intake`, fd);
      setBusy(null); applyParsed(out);
    } catch (e) { setError(e.message || String(e)); setBusy(null); }
  };

  // Create RFQ / vendor inquiry per selected package (standards-based, saved).
  const createRFQs = async () => {
    setError("");
    const created = [];
    try {
      for (let i = 0; i < selGroups.length; i++) {
        const { g, items } = selGroups[i];
        setBusy({ heading: selGroups.length > 1 ? `Drafting RFQ ${i + 1} of ${selGroups.length}` : "Drafting the RFQ", sub: g.title, steps: RFQ_STEPS });
        const fd = new FormData();
        // The brief already carries the requirement (extracted at the parse step),
        // so we don't re-send the heavy source documents to every RFQ call.
        fd.append("payload", JSON.stringify({ brief: groupText(g, items), category: items[0]?.category || category }));
        const draft = await postForm(`${API_URL}/api/generate-spec`, fd);
        const id = createSpec(draft, { category: items[0]?.category || category });
        created.push({ id, title: g.title });
      }
      setBusy(null); setRfqDone(created);
    } catch (e) { setError(e.message || String(e)); setBusy(null); }
  };

  // Evaluations run in the BACKGROUND: each selected package is saved immediately
  // as a "processing" record in Pending Evaluations, so the user can navigate away
  // and come back. Records flip to a draft (or error) as each one completes.
  const runEvaluation = () => {
    const active = vendors.filter((v) => v.files.length || v.text.trim());
    if (!active.length) return;
    const batchId = "b_" + Math.random().toString(36).slice(2, 8);
    const total = selGroups.length;
    const boqTitle = parsed?.title || "";

    // 1. Create placeholders up-front and take the user to Pending Evaluations.
    const jobs = selGroups.map((sg, i) => ({
      sg,
      id: createProcessing({
        category: sg.items[0]?.category || category, value,
        title: sg.g.title || "Bid Evaluation",
        batch: total > 1 ? { id: batchId, index: i, total, boqTitle } : null,
      }),
    }));
    navigate("pending");

    // 2. Process sequentially in the background (survives navigating within the app).
    (async () => {
      for (const { sg, id } of jobs) {
        try {
          const { g, items } = sg;
          const fd = new FormData();
          fd.append("payload", JSON.stringify({ requirements_text: groupText(g, items), vendors: active.map((v) => ({ name: v.name.trim() || "Vendor", file_count: v.files.length + (v.text.trim() ? 1 : 0) })) }));
          active.forEach((v) => {
            v.files.forEach((f) => fd.append("vendor_files", f.file, f.name));
            if (v.text.trim()) fd.append("vendor_files", new File([v.text], `${(v.name || "vendor").replace(/\s+/g, "_")}_response.txt`, { type: "text/plain" }), `${(v.name || "vendor").replace(/\s+/g, "_")}_response.txt`);
          });
          const result = await postForm(`${API_URL}/api/evaluate`, fd);
          finishEvaluation(id, result);
        } catch (e) {
          failEvaluation(id, e.message || String(e));
        }
      }
    })();
  };

  const canParse = files.length > 0 || text.trim().length > 2;
  const vendorsReady = vendors.filter((v) => v.files.length || v.text.trim()).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {busy && <Evaluating key={busy.sub} heading={busy.heading} sub={busy.sub} steps={busy.steps} />}

      <StepBar stage={stage} />

      {/* ── Stage: intake ─────────────────────────────────────────────────── */}
      {stage === "intake" && (
        <>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
              <Icon name="doc2" size={18} color={T.c.ink} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Upload your requirement</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.c.ink, marginBottom: 14 }}>A Purchase Requisition, or a Bill of Quantities with technical specifications — any format, in one place.</div>
            <DropZone label="Drop your requirement documents" hint="PR · BOQ · specifications — PDF · DOCX · XLSX · TXT" onAdd={addTo(setFiles)} />
            {files.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>{files.map((f, i) => <FileRow key={i} f={f} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />)}</div>}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste the requirement text here"
              style={{ width: "100%", minHeight: 90, resize: "vertical", padding: "10px 12px", marginTop: 12, border: `1px solid ${T.c.line}`, borderRadius: 9, fontSize: 12.5, fontFamily: T.font.mono, lineHeight: 1.6, color: T.c.ink, background: "#FAFAFA", outline: "none" }} />
          </Card>
          <Card style={{ position: "sticky", bottom: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: T.shadow.md }}>
            <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>{files.length} document(s){text.trim() ? " + pasted text" : ""}</div>
            <button onClick={() => applyParsed(SAMPLE_BOQ)} style={{ background: "none", border: "none", color: T.c.inkSoft, textDecoration: "underline", cursor: "pointer", fontSize: 12.5, marginLeft: "auto" }}>try a sample BOQ</button>
            <Button icon="spark" size="lg" disabled={!canParse} onClick={parseIntake}>Parse requirement</Button>
          </Card>
        </>
      )}

      {/* ── Stage: review items ───────────────────────────────────────────── */}
      {stage === "review" && parsed && (
        <>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <Pill tone={isBoq ? "info" : "na"} dot={false}>{isBoq ? "Bill of Quantities" : "Purchase Requisition"}</Pill>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.c.ink }}>{parsed.title}</span>
            </div>
            <div style={{ fontSize: 13, color: T.c.inkSoft, lineHeight: 1.5 }}>{parsed.summary}</div>
          </Card>

          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <Icon name="check" size={18} color={T.c.ink} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>{editingGroups ? "Club items onto sheets" : isBoq ? "Select items to proceed with" : "Detected requirement"}</div>
            <span style={{ fontSize: 12.5, color: T.c.inkFaint }}>· {sel.size} of {parsed.items.length} selected · {selGroups.length} evaluation sheet{selGroups.length === 1 ? "" : "s"}</span>
            {parsed.items.length > 1 && (
              <Button variant={editingGroups ? "primary" : "outline"} size="sm" icon={editingGroups ? "check" : "layers"} style={{ marginLeft: "auto" }} onClick={() => setEditingGroups((v) => !v)}>
                {editingGroups ? "Done grouping" : "Edit grouping"}
              </Button>
            )}
          </div>
          {editingGroups && (
            <div style={{ fontSize: 12.5, color: T.c.inkSoft, lineHeight: 1.5, marginTop: -4 }}>
              Items on the same sheet are compared side-by-side in one evaluation. Use each item's <strong style={{ color: T.c.ink }}>Put on sheet</strong> dropdown to club items together or split one onto its own sheet, and rename a sheet inline. We grouped them for you by default — combining simple commodity items and keeping engineered items separate.
            </div>
          )}
          {parsed.items.length === 0 ? (
            <Card style={{ borderColor: T.s.warn.line, background: T.s.warn.bg }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <Icon name="alert" size={20} color={T.s.warn.fg} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "#7a5a12", lineHeight: 1.55 }}>
                  <strong>No line items could be read from this document.</strong> If it's a scanned PDF, make sure the pages are legible; try uploading fewer pages at a time, or paste the key requirements as text on the previous step.
                </div>
              </div>
            </Card>
          ) : (
            <BoqGroups parsed={parsed} sel={sel} toggleItem={toggleItem} toggleGroup={toggleGroup}
              editing={editingGroups} assignItemGroup={assignItemGroup} newGroupForItem={newGroupForItem} setGroupTitle={setGroupTitle} />
          )}

          <Card style={{ position: "sticky", bottom: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: T.shadow.md }}>
            <Button variant="ghost" icon="arrowLeft" onClick={() => setStage("intake")}>Back</Button>
            <div style={{ fontSize: 12.5, color: T.c.inkSoft, marginLeft: "auto" }}>{selGroups.length} package(s) selected</div>
            <Button icon="arrowRight" size="lg" disabled={!selGroups.length} onClick={() => { setRfqDone(null); setStage("choose"); }}>Continue</Button>
          </Card>
        </>
      )}

      {/* ── Stage: choose path ────────────────────────────────────────────── */}
      {stage === "choose" && (
        rfqDone ? (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: T.s.ok.bg, border: `1px solid ${T.s.ok.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={20} color={T.s.ok.fg} /></div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{rfqDone.length} RFQ{rfqDone.length === 1 ? "" : "s"} created &amp; saved</div>
                <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>Standards-based, with any insufficient spec flagged for engineer confirmation. Send to your vendors, then come back with their responses.</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
              {rfqDone.map((r) => (
                <div key={r.id} onClick={() => navigate("spec", { id: r.id })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${T.c.line}`, borderRadius: 9, cursor: "pointer" }}>
                  <Icon name="doc2" size={16} color={T.c.inkSoft} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.c.ink, flex: 1 }}>{r.title}</span>
                  <Icon name="arrowRight" size={15} color={T.c.inkFaint} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="outline" icon="doc2" onClick={() => navigate("specs")}>View in Specs &amp; RFQs</Button>
              <Button icon="arrowRight" onClick={() => setStage("responses")}>I have the vendor responses now</Button>
            </div>
          </Card>
        ) : (
          (() => {
            const ambiguous = parsed?.clarity === "ambiguous";
            return (
          <>
            <div style={{ fontSize: 16, fontWeight: 700 }}>What would you like to do with {selGroups.length === 1 ? "this package" : `these ${selGroups.length} packages`}?</div>
            {ambiguous && (
              <Card pad={14} style={{ background: T.s.info.bg, border: `1px solid ${T.s.info.line}` }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <Icon name="alert" size={18} color={T.s.info.fg} />
                  <div style={{ fontSize: 12.5, color: T.c.inkSoft, lineHeight: 1.55 }}>
                    <strong style={{ color: T.c.ink }}>The requirement is a bit open-ended, so we won't assume what you need.</strong>{parsed?.clarity_note ? ` (${parsed.clarity_note})` : ""} Drafting an RFQ would mean guessing the exact specs. Instead, upload the vendor responses — Claude will read them to understand the actual equipment you're after and build the comparison on that basis. To draft an RFQ, go back and add a spec document or more detail.
                  </div>
                </div>
              </Card>
            )}
            <div style={{ display: "grid", gridTemplateColumns: ambiguous ? "1fr" : "1fr 1fr", gap: 14 }}>
              {!ambiguous && (
              <Card hover onClick={createRFQs} style={{ cursor: "pointer" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.c.canvasDeep, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icon name="send" size={19} color={T.c.ink} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Create RFQ / vendor inquiry</div>
                <div style={{ fontSize: 12.5, color: T.c.inkSoft, lineHeight: 1.55 }}>Haven't gone to vendors yet. Draft a detailed, standards-based RFQ for each package — filling gaps where the specification is insufficient — to send to vendors. Saved so you can return with responses.</div>
                <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: T.c.ink, display: "flex", alignItems: "center", gap: 6 }}>Draft RFQs <Icon name="arrowRight" size={15} /></div>
              </Card>
              )}
              <Card hover onClick={() => setStage("responses")} style={{ cursor: "pointer" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.c.canvasDeep, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icon name="sheet" size={19} color={T.c.ink} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>I already have vendor responses</div>
                <div style={{ fontSize: 12.5, color: T.c.inkSoft, lineHeight: 1.55 }}>Vendors have quoted. Upload or paste their responses (any format) and Claude builds the traceable comparison sheet for each package.</div>
                <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: T.c.ink, display: "flex", alignItems: "center", gap: 6 }}>Upload responses <Icon name="arrowRight" size={15} /></div>
              </Card>
            </div>
            <button onClick={() => setStage("review")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.c.inkSoft, cursor: "pointer", fontSize: 12.5, padding: 0, width: "fit-content" }}><Icon name="arrowLeft" size={15} /> Back to items</button>
          </>
            );
          })()
        )
      )}

      {/* ── Stage: vendor responses ───────────────────────────────────────── */}
      {stage === "responses" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <Icon name="vendors" size={18} color={T.c.ink} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Vendor responses</div>
            <span style={{ fontSize: 12, color: T.c.inkFaint }}>· {selGroups.length} sheet(s) will be created · responses shared across all</span>
            <Button variant="outline" size="sm" icon="plus" style={{ marginLeft: "auto" }} onClick={() => setVendors([...vendors, newVendor()])}>Add vendor</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {vendors.map((v, i) => (
              <VendorCard key={v.id} vendor={v} index={i}
                onName={(name) => setVendor(v.id, { name })} onAddFiles={(list) => addVFiles(v.id, list)} onRemoveFile={(idx) => removeVFile(v.id, idx)}
                onText={(t) => setVendor(v.id, { text: t })} onRemove={() => setVendors(vendors.filter((x) => x.id !== v.id))} canRemove={vendors.length > 1} />
            ))}
          </div>
          <Card style={{ position: "sticky", bottom: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: T.shadow.md }}>
            <Button variant="ghost" icon="arrowLeft" onClick={() => setStage("choose")}>Back</Button>
            <div style={{ fontSize: 12.5, color: T.c.inkSoft, marginLeft: "auto" }}><strong style={{ color: T.c.ink }}>{vendorsReady}</strong> vendor response(s) · <strong style={{ color: T.c.ink }}>{selGroups.length}</strong> sheet(s)</div>
            <Button icon="spark" size="lg" disabled={!vendorsReady || !selGroups.length} onClick={runEvaluation}>{selGroups.length > 1 ? `Run ${selGroups.length} Evaluations` : "Run Bid Evaluation"}</Button>
          </Card>
        </>
      )}

      {error && (
        <Modal title="Something went wrong" subtitle="The request could not be completed." onClose={() => setError("")}>
          <div style={{ fontSize: 13, color: T.c.ink, lineHeight: 1.6, marginBottom: 14, whiteSpace: "pre-wrap" }}>{error}</div>
          <div style={{ fontSize: 12, color: T.c.inkSoft, marginBottom: 18, padding: "10px 12px", background: T.c.canvas, borderRadius: 8, border: `1px solid ${T.c.line}` }}>
            Common causes: the backend isn't running on <code>{API_URL}</code>, or <code>ANTHROPIC_API_KEY</code> isn't set on the backend.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={() => setError("")}>Back</Button></div>
        </Modal>
      )}
    </div>
  );
}
