import { useState, useEffect, useRef } from "react";
import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, Label, Modal } from "../ui.jsx";
import { useApp } from "../store.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ACCEPT = ".pdf,.docx,.txt,.md,.csv";

const STEPS = [
  "Identifying the equipment & applicable standards…",
  "Looking up current standard editions…",
  "Reading your reference specifications…",
  "Drafting the parameter datasheet…",
  "Writing the specification sections…",
  "Flagging code values that need engineer confirmation…",
];

function Generating() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1800);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(247,247,248,0.9)", backdropFilter: "blur(4px)", color: T.c.ink, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ width: 560, maxWidth: "90%", background: T.c.card, border: `1px solid ${T.c.line}`, borderRadius: T.radius.xl, padding: 28, boxShadow: T.shadow.lg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: T.c.ink, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="doc2" size={20} color="#fff" /></div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.c.ink }}>Drafting the specification</div>
            <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>Claude is building the RFQ datasheet and sections from your brief.</div>
          </div>
        </div>
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "8px 2px", opacity: state === "todo" ? 0.5 : 1, transition: "opacity .3s" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: state === "done" ? T.c.ink : T.c.canvasDeep, color: "#fff" }}>
                {state === "done" ? <Icon name="check" size={13} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: state === "active" ? T.c.ink : T.c.inkFaint }} />}
              </span>
              <span style={{ fontSize: 13.5, color: state === "active" ? T.c.ink : state === "done" ? T.c.inkSoft : T.c.inkFaint, fontWeight: state === "active" ? 500 : 400 }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NewSpec() {
  const { navigate, createSpec } = useApp();
  const [brief, setBrief] = useState("");
  const [category, setCategory] = useState("Power Transformers");
  const [refFiles, setRefFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refInput = useRef(null);

  const canRun = brief.trim().length > 12;
  const inputStyle = { width: "100%", padding: "9px 12px", border: `1px solid ${T.c.line}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", color: T.c.ink, background: "#FAFAFA", outline: "none" };

  const run = async () => {
    setError(""); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ brief, category }));
      refFiles.forEach((f) => fd.append("reference_files", f.file, f.name));
      const resp = await fetch(`${API_URL}/api/generate-spec`, { method: "POST", body: fd });
      if (!resp.ok) {
        let msg = `Request failed (${resp.status})`;
        try { msg = (await resp.json()).detail || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const draft = await resp.json();
      const id = createSpec(draft, { category });
      setBusy(false);
      navigate("spec", { id });
    } catch (e) {
      setError(e.message || String(e));
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {busy && <Generating />}

      <button onClick={() => navigate("specs")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.c.inkSoft, cursor: "pointer", fontSize: 12.5, fontFamily: T.font.sans, padding: 0, width: "fit-content" }}>
        <Icon name="arrowLeft" size={15} /> All specifications
      </button>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <Icon name="doc2" size={18} color={T.c.brand} />
          <div style={{ fontFamily: T.font.serif, fontSize: 16, fontWeight: 600 }}>Equipment brief</div>
        </div>
        <div style={{ fontSize: 12, color: T.c.inkSoft, marginBottom: 12 }}>Describe what you're procuring — ratings, service conditions, key requirements. Claude drafts the full RFQ datasheet and specification.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: T.c.inkSoft, marginBottom: 6, fontWeight: 500 }}>Category</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {["Power Transformers", "Switchgear", "Cables & Conductors", "Electrical Equipment", "Instrumentation", "Mechanical", "Rotating Equipment", "Valves & Piping", "Pressure Vessels", "Civil & Structural", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. 33/11 kV, 10 MVA ONAN power transformer for a Phase-II substation. Outdoor, ambient 50°C. Dyn11, off-circuit tap changer ±10%. Losses per IS 1180 EEL-1. Delivery ≤ 20 weeks, warranty ≥ 24 months."
            style={{ ...inputStyle, minHeight: 140, resize: "vertical", fontFamily: T.font.mono, fontSize: 12.5, lineHeight: 1.6 }} />
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <Icon name="file" size={18} color={T.c.brand} />
          <div style={{ fontFamily: T.font.serif, fontSize: 16, fontWeight: 600 }}>Reference specifications <span style={{ fontFamily: T.font.sans, fontSize: 12.5, color: T.c.inkFaint, fontWeight: 400 }}>(optional, recommended)</span></div>
        </div>
        <div style={{ fontSize: 12, color: T.c.inkSoft, marginBottom: 12 }}>Attach your own past specs, engineering standards or datasheet templates. These are used as the <strong>primary source</strong> for exact code-derived values — the resulting spec stays in your house style, and values are traceable to your documents rather than guessed.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button variant="outline" size="sm" icon="file" onClick={() => refInput.current?.click()}>Attach reference document(s)</Button>
          {refFiles.map((f, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.c.ink, background: T.c.canvasDeep, borderRadius: 999, padding: "5px 11px" }}>
              {f.name} <span onClick={() => setRefFiles(refFiles.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.c.inkFaint, display: "flex" }}><Icon name="x" size={13} /></span>
            </span>
          ))}
          <input ref={refInput} type="file" multiple accept={ACCEPT} style={{ display: "none" }} onChange={(e) => { setRefFiles([...refFiles, ...Array.from(e.target.files).map((file) => ({ name: file.name, file }))]); e.target.value = ""; }} />
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, padding: "10px 12px", borderRadius: 9, background: T.s.warn.bg, border: `1px solid ${T.s.warn.line}` }}>
          <Icon name="alert" size={15} color={T.s.warn.fg} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "#7a5a12", lineHeight: 1.5 }}>
            Exact code-derived limits that can't be sourced from your references are <strong>flagged for engineer confirmation</strong>, not guessed. Standards are referenced by number/edition — no copyrighted text is reproduced.
          </div>
        </div>
      </Card>

      <Card style={{ position: "sticky", bottom: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: T.shadow.md }}>
        <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>{refFiles.length} reference document(s) · category <strong style={{ color: T.c.ink }}>{category}</strong></div>
        <Button icon="doc2" size="lg" disabled={!canRun} onClick={run} style={{ marginLeft: "auto" }}>Draft Specification</Button>
      </Card>

      {error && (
        <Modal title="Spec generation failed" subtitle="The specification could not be drafted." onClose={() => setError("")}>
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
