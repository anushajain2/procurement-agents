import { useState } from "react";
import { T, REQ_STATUS } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, StatusPill, Pill, Avatar, Label, Modal, Divider, ComplianceBar, Spinner, fmtDate, fmtDateTime } from "../ui.jsx";
import { useApp, userById, parseRanking, APPROVAL_LADDER } from "../store.jsx";
import { parseINR } from "../projects.js";
import BidSheet from "../BidSheet.jsx";

const ACTION_VERB = { created: "created the evaluation", submitted: "submitted for approval", approved: "approved", rejected: "rejected", changes: "requested changes", resubmitted: "re-submitted", awarded: "set the award", po_issued: "issued the Purchase Order", edited: "edited the comparison sheet" };

// Re-tally compliance + ranking after an approver edits cell statuses.
function recompute(result) {
  const vendors = result.vendors || [];
  const counts = {};
  vendors.forEach((v) => (counts[v] = { ok: 0, warn: 0, fail: 0, na: 0 }));
  // Only auto-generated parameter rows count toward compliance — user-added rows don't.
  const scored = (result.rows || []).filter((r) => !r.custom);
  scored.forEach((r) => vendors.forEach((v) => {
    let s = r.cells?.[v]?.status;
    if (!["ok", "warn", "fail", "na"].includes(s)) s = "na";
    counts[v][s]++;
  }));
  const total = scored.length;
  const compliance = {};
  vendors.forEach((v) => { compliance[v] = { ok: counts[v].ok, total, score: `${counts[v].ok}/${total}`, counts: counts[v] }; });
  const ranked = [...vendors].sort((a, b) => counts[b].ok - counts[a].ok);
  const ranking = ranked.map((n, i) => `L${i + 1}: ${n} (${compliance[n].score})`).join(" > ");
  return { ...result, compliance, ranking };
}

// ── Issue-PO modal: turn an approved evaluation into a PO under a project ─────
function IssuePOModal({ req, onClose }) {
  const { projects, issuePO, navigate } = useApp();
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [poRef, setPoRef] = useState("PO-" + Math.floor(5000 + Math.random() * 4000));
  const [delivery, setDelivery] = useState("");
  const [valueStr, setValueStr] = useState(req.value || "");
  const [t, setT] = useState({
    priceBasis: "Firm, fixed price",
    incoterms: "FOR Site (freight & insurance incl.)",
    deliveryPeriod: "18 weeks from PO",
    warranty: "24 months from commissioning",
    paymentTerms: "10% advance against ABG, 80% on delivery, 10% after commissioning",
    ld: "0.5% of PO value per week of delay, max 5%",
    pbg: "10% Performance Bank Guarantee, valid till warranty + 3 months",
    retention: "5% retained, released after defect liability period",
    validity: "PO valid for 12 months",
  });
  const set = (k) => (e) => setT((p) => ({ ...p, [k]: e.target.value }));
  const inputStyle = { width: "100%", padding: "8px 11px", border: `1px solid ${T.c.line}`, borderRadius: 8, fontSize: 12.5, fontFamily: T.font.sans, color: T.c.ink, background: "#FAFAFA", outline: "none" };
  const field = (label, k, area) => (
    <div style={{ gridColumn: area ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginBottom: 5, fontWeight: 500 }}>{label}</div>
      {area
        ? <textarea value={t[k]} onChange={set(k)} style={{ ...inputStyle, minHeight: 48, resize: "vertical", lineHeight: 1.5 }} />
        : <input value={t[k]} onChange={set(k)} style={inputStyle} />}
    </div>
  );
  const submit = () => {
    const num = parseINR(valueStr) ?? 0;
    const pkgId = issuePO(req.id, { projectId, poRef, expectedDelivery: delivery, value: num, terms: t });
    onClose();
    if (pkgId) navigate("project", { id: projectId });
  };
  return (
    <Modal title="Issue Purchase Order" subtitle={`Award to ${req.awardedVendor} · set contract terms and assign to a project.`} onClose={onClose} width={680}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginBottom: 5, fontWeight: 500 }}>Assign to project</div>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginBottom: 5, fontWeight: 500 }}>PO number</div>
          <input value={poRef} onChange={(e) => setPoRef(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginBottom: 5, fontWeight: 500 }}>PO value</div>
          <input value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder="e.g. 18500000 or ₹ 1.85 Cr" style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginBottom: 5, fontWeight: 500 }}>Expected delivery</div>
          <input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <Divider m="0 0 16px" />
      <Label style={{ marginBottom: 12 }}>Contract terms</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        {field("Price basis", "priceBasis")}
        {field("Incoterms", "incoterms")}
        {field("Delivery period", "deliveryPeriod")}
        {field("Warranty / guarantee", "warranty")}
        {field("Payment terms", "paymentTerms", true)}
        {field("Liquidated damages (LD)", "ld")}
        {field("Performance security", "pbg")}
        {field("Retention", "retention")}
        {field("Validity", "validity")}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button icon="check" disabled={!projectId || !poRef.trim()} onClick={submit}>Issue PO</Button>
      </div>
    </Modal>
  );
}

// ── Submit-for-approval modal: pick the approval ladder ──────────────────────
function SubmitModal({ req, onClose }) {
  const { submitForApproval, navigate } = useApp();
  const [levels, setLevels] = useState(APPROVAL_LADDER.map((l) => l.level)); // all selected by default
  const toggle = (lvl) => setLevels((ls) => (ls.includes(lvl) ? ls.filter((x) => x !== lvl) : [...ls, lvl].sort()));
  const chosen = APPROVAL_LADDER.filter((l) => levels.includes(l.level));
  return (
    <Modal title="Route for approval" subtitle="Choose the sign-off hierarchy this evaluation must pass through." onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {APPROVAL_LADDER.map((l, i) => {
          const u = userById(l.userId);
          const on = levels.includes(l.level);
          return (
            <div key={l.level} onClick={() => toggle(l.level)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                border: `1.5px solid ${on ? T.c.brand : T.c.line}`, background: on ? T.c.brandSoft : T.c.card }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${on ? T.c.brand : T.c.line}`, background: on ? T.c.brand : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {on && <Icon name="check" size={14} color="#fff" />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.c.inkFaint, width: 26 }}>L{l.level}</div>
              <Avatar user={u} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.c.ink }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: T.c.inkSoft }}>{l.role}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: T.c.inkSoft, marginBottom: 16, padding: "10px 12px", background: T.c.canvas, borderRadius: 8, border: `1px solid ${T.c.line}` }}>
        Approvals are sequential — each level is notified once the previous one signs off. {chosen.length} level(s) selected.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button icon="send" disabled={chosen.length === 0} onClick={() => { submitForApproval(req.id, chosen); onClose(); }}>Submit for approval</Button>
      </div>
    </Modal>
  );
}

// ── Approver action box (shown to whoever owns the current pending level) ─────
function ActionBox({ req }) {
  const { actOnApproval } = useApp();
  const [mode, setMode] = useState(null); // approved | rejected | changes
  const [comment, setComment] = useState("");
  const cfg = {
    approved: { title: "Approve this evaluation", variant: "primary", btn: "Confirm approval", ph: "Add an optional note for the record…" },
    changes: { title: "Request changes", variant: "amber", btn: "Send back for changes", ph: "Describe what needs to change before you can approve…" },
    rejected: { title: "Reject this evaluation", variant: "danger", btn: "Confirm rejection", ph: "State the reason for rejection…" },
  };
  return (
    <Card style={{ borderColor: T.c.brand, borderWidth: 1.5, background: "linear-gradient(180deg,#FBFCFB,#fff)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="inbox" size={18} color={T.c.brand} />
        <div style={{ fontFamily: T.font.serif, fontSize: 16, fontWeight: 600 }}>Awaiting your decision</div>
      </div>
      <div style={{ fontSize: 12.5, color: T.c.inkSoft, marginBottom: 14 }}>You are the Level {req.currentLevel} approver for this request.</div>
      {!mode ? (
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <Button icon="check" onClick={() => setMode("approved")}>Approve</Button>
          <Button variant="amber" onClick={() => setMode("changes")}>Request changes</Button>
          <Button variant="danger" onClick={() => setMode("rejected")}>Reject</Button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.c.ink, marginBottom: 8 }}>{cfg[mode].title}</div>
          <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder={cfg[mode].ph}
            style={{ width: "100%", minHeight: 84, resize: "vertical", padding: "10px 12px", border: `1px solid ${T.c.line}`, borderRadius: 9, fontSize: 13, fontFamily: T.font.sans, lineHeight: 1.5, color: T.c.ink, background: "#FAFAFA", outline: "none", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 9 }}>
            <Button variant={cfg[mode].variant} disabled={mode !== "approved" && !comment.trim()} onClick={() => actOnApproval(req.id, mode, comment.trim())}>{cfg[mode].btn}</Button>
            <Button variant="ghost" onClick={() => { setMode(null); setComment(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Approval chain stepper ───────────────────────────────────────────────────
function ChainStepper({ req }) {
  return (
    <Card>
      <Label style={{ marginBottom: 14 }}>Approval chain</Label>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {req.chain.map((c, i) => {
          const u = userById(c.userId);
          const last = i === req.chain.length - 1;
          const tone = c.status === "approved" ? "ok" : c.status === "rejected" ? "fail" : c.status === "changes" ? "info" : "na";
          const isCurrent = req.status === "pending" && c.status === "pending" && c.level === req.currentLevel;
          return (
            <div key={i} style={{ display: "flex", gap: 13 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  background: c.status === "approved" ? T.s.ok.fg : c.status === "rejected" ? T.s.fail.fg : c.status === "changes" ? T.s.info.fg : isCurrent ? T.c.amber : T.c.canvasDeep,
                  color: c.status === "pending" && !isCurrent ? T.c.inkFaint : "#fff", boxShadow: isCurrent ? `0 0 0 4px ${T.c.amberSoft}` : "none" }}>
                  {c.status === "approved" ? <Icon name="check" size={17} /> : c.status === "rejected" ? <Icon name="x" size={17} /> : c.status === "changes" ? <Icon name="arrowLeft" size={16} /> : <span style={{ fontSize: 13, fontWeight: 700 }}>{c.level}</span>}
                </div>
                {!last && <div style={{ width: 2, flex: 1, minHeight: 26, background: c.status === "approved" ? T.s.ok.fg : T.c.line, margin: "2px 0" }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink }}>{u.name}</span>
                  {isCurrent && <Pill tone="warn" size="sm" dot={false}>Pending now</Pill>}
                  {c.status === "approved" && <Pill tone="ok" size="sm" dot={false}>Approved</Pill>}
                  {c.status === "rejected" && <Pill tone="fail" size="sm" dot={false}>Rejected</Pill>}
                  {c.status === "changes" && <Pill tone="info" size="sm" dot={false}>Changes requested</Pill>}
                </div>
                <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginTop: 1 }}>{c.role} · Level {c.level}</div>
                {c.actedAt && <div style={{ fontSize: 11, color: T.c.inkFaint, marginTop: 3 }}>{fmtDateTime(c.actedAt)}</div>}
                {c.comment && <div style={{ marginTop: 7, padding: "8px 11px", background: T.c.canvas, border: `1px solid ${T.c.lineSoft}`, borderRadius: 8, fontSize: 12.5, color: T.c.ink, lineHeight: 1.5 }}>“{c.comment}”</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function RequestDetail({ id }) {
  const app = useApp();
  const { requests, projects, navigate, user, patchRequest, deleteRequest } = app;
  const req = requests.find((r) => r.id === id);
  const [tab, setTab] = useState("sheet");
  const [sheetView, setSheetView] = useState("technical");
  const [showSubmit, setShowSubmit] = useState(false);
  const [showPO, setShowPO] = useState(false);
  const [showStandards, setShowStandards] = useState(false);

  if (!req) return <Card><div style={{ padding: 30, textAlign: "center", color: T.c.inkSoft }}>Request not found. <a style={{ color: T.c.brand, cursor: "pointer" }} onClick={() => navigate("requests")}>Back to requests</a></div></Card>;

  const result = req.result;
  const ranked = parseRanking(req.ranking || result?.ranking);
  const isOwner = req.createdBy === user.id;
  const isCurrentApprover = req.status === "pending" && req.chain.some((c) => c.status === "pending" && c.level === req.currentLevel && c.userId === user.id);
  const meta = REQ_STATUS[req.status];

  // The current approver — or the owner while still a draft — may edit the sheet.
  const canEditSheet = isCurrentApprover || (isOwner && (req.status === "draft" || req.status === "changes"));
  const editCell = (rowIdx, vendor, patch) => {
    const rows = result.rows.map((r, i) => (i !== rowIdx ? r : { ...r, cells: { ...r.cells, [vendor]: { ...(r.cells[vendor] || { value: "—", status: "na" }), ...patch } } }));
    patchRequest(req.id, { result: recompute({ ...result, rows }) });
  };
  const editRemark = (rowIdx, text) => {
    const clear = !text || !text.trim();
    const rows = result.rows.map((r, i) => (i !== rowIdx ? r : { ...r, remark: clear ? null : text, remarkBy: clear ? null : user.id }));
    patchRequest(req.id, { result: { ...result, rows } });
  };
  const onSheetEdited = () => app.logEvent(req.id, { actor: user.id, action: "edited", note: "Edited the comparison sheet (values / status / remarks)." });
  // Excel-like structural edits: add/remove custom rows and columns.
  const addRow = () => {
    const row = { category: "Added rows", parameter: "New row", unit: "", mr: "", governing: "pr", standard: "", standard_requirement: "", cells: {}, custom: true };
    patchRequest(req.id, { result: recompute({ ...result, rows: [...(result.rows || []), row] }) });
  };
  const deleteRow = (rowIdx) => {
    patchRequest(req.id, { result: recompute({ ...result, rows: result.rows.filter((_, i) => i !== rowIdx) }) });
  };
  const addColumn = () => {
    const id = "col_" + Math.random().toString(36).slice(2, 7);
    const cols = [...(result.customCols || []), { id, name: "New column" }];
    patchRequest(req.id, { result: { ...result, customCols: cols } });
  };
  const renameColumn = (id, name) => {
    patchRequest(req.id, { result: { ...result, customCols: (result.customCols || []).map((c) => (c.id === id ? { ...c, name } : c)) } });
  };
  const deleteColumn = (id) => {
    const rows = (result.rows || []).map((r) => { if (!r.cells || !(id in r.cells)) return r; const c = { ...r.cells }; delete c[id]; return { ...r, cells: c }; });
    patchRequest(req.id, { result: { ...result, customCols: (result.customCols || []).filter((c) => c.id !== id), rows } });
  };
  const editCategory = (rowIdx, text) => {
    patchRequest(req.id, { result: { ...result, rows: result.rows.map((r, i) => (i === rowIdx ? { ...r, category: text } : r)) } });
  };
  const editParam = (rowIdx, patch) => {
    patchRequest(req.id, { result: recompute({ ...result, rows: result.rows.map((r, i) => (i === rowIdx ? { ...r, ...patch } : r)) }) });
  };

  const tabs = [
    { id: "sheet", label: "Comparison Sheet", icon: "sheet" },
    { id: "approvals", label: "Approvals", icon: "inbox" },
    { id: "activity", label: "Activity", icon: "clock" },
  ];

  // Sibling evaluations created from the same BOQ (batch navigation).
  const batchSiblings = req.batch ? requests.filter((r) => r.batch?.id === req.batch.id).sort((a, b) => a.batch.index - b.batch.index) : [];
  const batchPos = batchSiblings.findIndex((r) => r.id === req.id);

  // In-progress or failed evaluations have no comparison sheet yet.
  if (req.status === "processing" || req.status === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <button onClick={() => navigate("pending")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.c.inkSoft, cursor: "pointer", fontSize: 12.5, fontFamily: T.font.sans, padding: 0, width: "fit-content" }}>
          <Icon name="arrowLeft" size={15} /> Pending evaluations
        </button>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.c.ink, letterSpacing: "0.04em" }}>{req.ref}</span>
            <StatusPill status={req.status} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.c.ink }}>{req.title}</div>
          {req.batch && <div style={{ fontSize: 12.5, color: T.c.inkFaint, marginTop: 4 }}>From BOQ {req.batch.boqTitle} · {req.batch.index + 1} of {req.batch.total}</div>}
        </Card>
        {req.status === "processing" ? (
          <Card style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <Spinner size={20} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Building the comparison sheet…</div>
              <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>Claude is reading the vendor responses and evaluating each parameter. This can take a few minutes — you can leave this page and come back.</div>
            </div>
          </Card>
        ) : (
          <Card style={{ borderColor: T.s.fail.line, background: T.s.fail.bg }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Icon name="alert" size={22} color={T.s.fail.fg} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.s.fail.fg }}>This evaluation failed</div>
                <div style={{ fontSize: 12.5, color: T.s.fail.fg, lineHeight: 1.5, marginTop: 3, whiteSpace: "pre-wrap" }}>{req.error || "The bid evaluation could not be completed."}</div>
                <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
                  <Button icon="plus" onClick={() => navigate("new")}>Start a new evaluation</Button>
                  <Button variant="ghost" icon="x" onClick={() => { deleteRequest(req.id); navigate("pending"); }}>Remove</Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button onClick={() => navigate("requests")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.c.inkSoft, cursor: "pointer", fontSize: 12.5, fontFamily: T.font.sans, padding: 0, width: "fit-content" }}>
        <Icon name="arrowLeft" size={15} /> All requests
      </button>

      {req.batch && batchSiblings.length > 1 && (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", flexWrap: "wrap" }}>
            <Icon name="layers" size={16} color={T.c.inkSoft} />
            <div style={{ fontSize: 12.5, color: T.c.inkSoft, minWidth: 0 }}>
              From BOQ <strong style={{ color: T.c.ink }}>{req.batch.boqTitle}</strong> · evaluation <strong style={{ color: T.c.ink }}>{batchPos + 1} of {batchSiblings.length}</strong>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <Button variant="outline" size="sm" icon="arrowLeft" disabled={batchPos <= 0} onClick={() => navigate("request", { id: batchSiblings[batchPos - 1].id })}>Prev</Button>
              <Button variant="outline" size="sm" disabled={batchPos >= batchSiblings.length - 1} onClick={() => navigate("request", { id: batchSiblings[batchPos + 1].id })}>Next <Icon name="arrowRight" size={15} /></Button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 0, borderTop: `1px solid ${T.c.lineSoft}`, overflowX: "auto" }}>
            {batchSiblings.map((r, i) => (
              <button key={r.id} onClick={() => navigate("request", { id: r.id })}
                style={{ flexShrink: 0, padding: "8px 14px", border: "none", borderRight: `1px solid ${T.c.lineSoft}`, cursor: "pointer", fontSize: 11.5, fontFamily: T.font.sans,
                  background: r.id === req.id ? T.c.canvasDeep : "#fff", color: r.id === req.id ? T.c.ink : T.c.inkSoft, fontWeight: r.id === req.id ? 600 : 450, whiteSpace: "nowrap" }}>
                {i + 1}. {r.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Header card */}
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.c.brand, letterSpacing: "0.04em" }}>{req.ref}</span>
              <StatusPill status={req.status} />
            </div>
            <div style={{ fontFamily: T.font.serif, fontSize: 23, fontWeight: 600, color: T.c.ink, lineHeight: 1.2 }}>{req.title}</div>
            <div style={{ fontSize: 13, color: T.c.inkSoft, marginTop: 6, lineHeight: 1.5, maxWidth: 720 }}>{req.summary}</div>
          </div>
          <div style={{ display: "flex", gap: 9, flexShrink: 0 }}>
            {req.status === "draft" && isOwner && <Button icon="send" onClick={() => setShowSubmit(true)}>Send for approval</Button>}
            {req.status === "changes" && isOwner && <Button icon="send" onClick={() => app.resubmit(req.id)}>Re-submit for approval</Button>}
          </div>
        </div>
        <Divider m="18px 0" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 18 }}>
          <Meta label="Category" value={req.category} />
          <Meta label="Estimated value" value={req.value || "—"} />
          <Meta label="Recommended award" value={req.awardedVendor || ranked[0] || "—"} accent />
          <Meta label="Requested by" value={userById(req.createdBy).name} />
          <Meta label="Created" value={fmtDate(req.createdAt)} />
        </div>
        {result?.standards && result.standards.length > 0 && (
          <>
            <Divider m="16px 0" />
            <button onClick={() => setShowStandards((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font.sans }}>
              <Icon name="chevronDown" size={15} color={T.c.inkSoft} style={{ transform: showStandards ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: T.c.ink }}>Standards applied</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.c.inkFaint, background: T.c.canvasDeep, borderRadius: 999, padding: "1px 8px" }}>{result.standards.length}</span>
              {result.standards_verified && <Icon name="check" size={13} color={T.s.ok.fg} title="Current editions web-verified" />}
            </button>
            {showStandards && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {result.standards.map((s, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: T.s.info.fg, background: T.s.info.bg, border: `1px solid ${T.s.info.line}`, borderRadius: 999, padding: "4px 11px", fontWeight: 500 }}>
                    <span style={{ fontSize: 11 }}>⬡</span>{s}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Approver action / status banner */}
      {isCurrentApprover && <ActionBox req={req} />}
      {req.status === "approved" && (
        <Card style={{ borderColor: T.s.ok.line, background: T.s.ok.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Icon name="trophy" size={26} color={T.s.ok.fg} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600, color: T.s.ok.fg }}>{req.packageId ? "Purchase Order issued" : "Fully approved — ready to award"}</div>
              <div style={{ fontSize: 12.5, color: "#2C5C3F" }}>All {req.chain.length} approval levels signed off. Recommended award: <strong>{req.awardedVendor}</strong>.{req.poRef ? ` PO ${req.poRef}.` : ""}</div>
            </div>
            {req.packageId
              ? <Button variant="outline" icon="layers" onClick={() => navigate("project", { id: req.projectId })}>View in project</Button>
              : isOwner && <Button icon="send" onClick={() => setShowPO(true)}>Issue Purchase Order</Button>}
          </div>
        </Card>
      )}
      {req.status === "rejected" && (
        <Card style={{ borderColor: T.s.fail.line, background: T.s.fail.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="alert" size={24} color={T.s.fail.fg} />
            <div style={{ fontSize: 13, color: T.s.fail.fg, fontWeight: 600 }}>This evaluation was rejected. See the Approvals tab for the reason.</div>
          </div>
        </Card>
      )}
      {req.status === "changes" && (
        <Card style={{ borderColor: T.s.info.line, background: T.s.info.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="arrowLeft" size={22} color={T.s.info.fg} />
            <div style={{ fontSize: 13, color: T.s.info.fg, fontWeight: 600 }}>Changes were requested. {isOwner ? "Address them, then re-submit." : "Awaiting the requester's update."}</div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.c.line}` }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: T.font.sans,
                fontSize: 13.5, fontWeight: 600, color: active ? T.c.ink : T.c.inkFaint, borderBottom: `2px solid ${active ? T.c.brand : "transparent"}`, marginBottom: -1 }}>
              <Icon name={t.icon} size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "sheet" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Award selector (owner, pre-submit) */}
          {req.status === "draft" && isOwner && (
            <Card pad={14} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12.5, color: T.c.inkSoft, fontWeight: 500 }}>Recommended award:</div>
              {(result.vendors || []).map((v) => {
                const on = req.awardedVendor === v;
                return <button key={v} onClick={() => patchRequest(req.id, { awardedVendor: v })}
                  style={{ padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: T.font.sans,
                    border: `1.5px solid ${on ? T.c.brand : T.c.line}`, background: on ? T.c.brandSoft : "#fff", color: on ? T.c.brandDeep : T.c.inkSoft }}>{on ? "★ " : ""}{v}</button>;
              })}
            </Card>
          )}

          {/* Technical / Commercial toggle — only when a commercial sheet was inferred */}
          {result.commercial && (
            <div style={{ display: "inline-flex", alignSelf: "flex-start", background: T.c.canvasDeep, borderRadius: 999, padding: 3, gap: 3 }}>
              {[{ id: "technical", label: "Technical", icon: "sheet" }, { id: "commercial", label: "Commercial", icon: "trophy" }].map((s) => {
                const on = sheetView === s.id;
                return <button key={s.id} onClick={() => setSheetView(s.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: T.font.sans,
                    fontSize: 12.5, fontWeight: 600, background: on ? "#fff" : "transparent", color: on ? T.c.ink : T.c.inkSoft, boxShadow: on ? T.shadow.sm : "none" }}>
                  <Icon name={s.icon} size={14} /> {s.label}
                </button>;
              })}
            </div>
          )}

          {sheetView === "commercial" && result.commercial ? (
            <BidSheet
              result={{
                title: result.title,
                mr_summary: "Commercial comparative statement",
                vendors: result.commercial.vendors,
                rows: result.commercial.rows,
                standards: [],
                compliance: Object.fromEntries((result.commercial.vendors || []).map((v) => [v, { score: result.commercial.prices?.[v] || "—", counts: { fail: 0 } }])),
                ranking: result.commercial.ranking,
                model: result.model,
              }}
              awardedVendor={result.commercial.awarded}
              fileName={`${req.ref}_${req.category.replace(/[^A-Za-z0-9]+/g, "_")}_Commercial.xlsx`}
              bottomLabel="TOTAL EVALUATED PRICE" bottomMark={false} />
          ) : (
            <BidSheet result={result} awardedVendor={req.awardedVendor} fileName={`${req.ref}_${req.category.replace(/[^A-Za-z0-9]+/g, "_")}.xlsx`}
              canEdit={canEditSheet} onEditCell={editCell} onEditRemark={editRemark} onEdited={onSheetEdited}
              onAddRow={addRow} onDeleteRow={deleteRow} onAddColumn={addColumn} onRenameColumn={renameColumn} onDeleteColumn={deleteColumn} onEditCategory={editCategory} onEditParam={editParam} />
          )}

          {sheetView === "commercial" && result.commercial?.ranking ? (
            <Card pad={15} style={{ background: T.c.canvas }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name="trophy" size={17} color={T.c.amber} />
                <Label style={{ color: T.c.inkSoft }}>Lowest evaluated bid (L1)</Label>
              </div>
              <div style={{ fontSize: 13.5, color: T.c.ink, lineHeight: 1.6 }}>{result.commercial.ranking}</div>
            </Card>
          ) : sheetView === "technical" && result.ranking && (
            <Card pad={15} style={{ background: T.c.canvas }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name="trophy" size={17} color={T.c.amber} />
                <Label style={{ color: T.c.inkSoft }}>Recommendation</Label>
              </div>
              <div style={{ fontSize: 13.5, color: T.c.ink, lineHeight: 1.6 }}>{result.ranking}</div>
            </Card>
          )}
          <div style={{ fontSize: 11, color: T.c.inkFaint, textAlign: "center" }}>Click any cell to trace its source.</div>
        </div>
      )}

      {tab === "approvals" && (
        <div style={{ display: "grid", gridTemplateColumns: req.status === "draft" ? "1fr" : "1.2fr 1fr", gap: 16, alignItems: "start" }}>
          {req.status === "draft" ? (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Icon name="send" size={20} color={T.c.brand} />
                <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600 }}>Not yet submitted</div>
              </div>
              <div style={{ fontSize: 13, color: T.c.inkSoft, lineHeight: 1.6, marginBottom: 16, maxWidth: 520 }}>This comparison sheet is still a draft. {isOwner ? "Route it through your approval hierarchy when you're ready — you choose which levels must sign off." : "The requester hasn't submitted it for approval yet."}</div>
              {isOwner && <Button icon="send" onClick={() => setShowSubmit(true)}>Send for approval</Button>}
            </Card>
          ) : (
            <>
              <ChainStepper req={req} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {isCurrentApprover && <ActionBox req={req} />}
                <Card pad={15}>
                  <Label style={{ marginBottom: 10 }}>Progress</Label>
                  {(() => {
                    const done = req.chain.filter((c) => c.status === "approved").length;
                    const pct = Math.round((done / req.chain.length) * 100);
                    return (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 7 }}>
                          <span style={{ color: T.c.inkSoft }}>{done} of {req.chain.length} levels approved</span>
                          <span style={{ fontWeight: 700, color: T.c.ink }}>{pct}%</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: T.c.canvasDeep, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: req.status === "rejected" ? T.s.fail.fg : T.c.brand, transition: "width .3s" }} />
                        </div>
                      </>
                    );
                  })()}
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "activity" && (
        <Card>
          <Label style={{ marginBottom: 16 }}>Activity timeline</Label>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(req.activity || []).map((a, i) => {
              const u = userById(a.actor);
              const last = i === req.activity.length - 1;
              const iconName = a.action === "approved" ? "check" : a.action === "rejected" ? "x" : a.action === "submitted" || a.action === "resubmitted" ? "send" : a.action === "changes" ? "arrowLeft" : a.action === "created" ? "spark" : "dot";
              const col = a.action === "approved" ? T.s.ok.fg : a.action === "rejected" ? T.s.fail.fg : a.action === "changes" ? T.s.info.fg : T.c.brand;
              return (
                <div key={i} style={{ display: "flex", gap: 13 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.c.canvasDeep, color: col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={iconName} size={15} /></div>
                    {!last && <div style={{ width: 2, flex: 1, minHeight: 20, background: T.c.line, margin: "2px 0" }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: last ? 0 : 16 }}>
                    <div style={{ fontSize: 13, color: T.c.ink }}><strong>{u.name}</strong> {ACTION_VERB[a.action] || a.action}</div>
                    <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 1 }}>{fmtDateTime(a.ts)}</div>
                    {a.note && <div style={{ marginTop: 6, padding: "8px 11px", background: T.c.canvas, border: `1px solid ${T.c.lineSoft}`, borderRadius: 8, fontSize: 12.5, color: T.c.inkSoft, lineHeight: 1.5 }}>{a.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {showSubmit && <SubmitModal req={req} onClose={() => setShowSubmit(false)} />}
      {showPO && <IssuePOModal req={req} onClose={() => setShowPO(false)} />}
    </div>
  );
}

function Meta({ label, value, accent }) {
  return (
    <div>
      <Label style={{ marginBottom: 4 }}>{label}</Label>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent ? T.c.brand : T.c.ink }}>{value}</div>
    </div>
  );
}
