import { useState } from "react";
import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, Pill, Label, Avatar, Modal, Divider, fmtDate } from "../ui.jsx";
import { useApp, userById } from "../store.jsx";
import { inr, parseINR, PIPELINE, PO_STAGE, isPO, stageLabel, stageTone } from "../projects.js";

// Horizontal pipeline tracker for one package.
function PipelineTracker({ stage }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", padding: "4px 0" }}>
      {PIPELINE.map((s, i) => {
        const done = i < stage, current = i === stage;
        const col = done ? T.s.ok.fg : current ? T.c.amber : T.c.canvasDeep;
        return (
          <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 78, position: "relative" }}>
            {i < PIPELINE.length - 1 && <div style={{ position: "absolute", top: 13, left: "50%", width: "100%", height: 2, background: done ? T.s.ok.fg : T.c.line }} />}
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: col, color: done || current ? "#fff" : T.c.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, flexShrink: 0, boxShadow: current ? `0 0 0 4px ${T.c.amberSoft}` : "none" }}>
              {done ? <Icon name="check" size={15} /> : <span style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>}
            </div>
            <div style={{ fontSize: 9.5, textAlign: "center", marginTop: 6, color: current ? T.c.ink : T.c.inkFaint, fontWeight: current ? 700 : 500, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function Term({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <Label style={{ marginBottom: 4 }}>{label}</Label>
      <div style={{ fontSize: 13, color: T.c.ink, lineHeight: 1.5 }}>{value || "—"}</div>
    </div>
  );
}

function PackageModal({ project, pkg, onClose }) {
  const { navigate, advancePackage } = useApp();
  const t = pkg.terms || {};
  const po = isPO(pkg.stage);
  return (
    <Modal title={pkg.title} subtitle={`${po ? pkg.poRef : pkg.prRef} · ${project.code}`} onClose={onClose} width={680}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <Pill tone={po ? "info" : "warn"} dot={false}>{po ? "Purchase Order" : "Purchase Requisition"}</Pill>
        <Pill tone={stageTone(pkg.stage)}>{stageLabel(pkg.stage)}</Pill>
        <span style={{ marginLeft: "auto", fontFamily: T.font.serif, fontSize: 22, fontWeight: 600, color: T.c.ink }}>{inr(pkg.value)}</span>
      </div>

      <div style={{ background: T.c.canvas, border: `1px solid ${T.c.line}`, borderRadius: 11, padding: "16px 16px 12px", marginBottom: 18 }}>
        <Label style={{ marginBottom: 12 }}>Approval & procurement stage</Label>
        <PipelineTracker stage={pkg.stage} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <Term label="Vendor / Supplier" value={pkg.vendor || "To be awarded"} />
        <Term label="Category" value={pkg.category} />
        <Term label="PR Number" value={pkg.prRef} />
        <Term label="PO Number" value={pkg.poRef || "Not issued"} />
        <Term label="Raised by" value={userById(pkg.raisedBy).name} />
        <Term label="Raised on" value={fmtDate(pkg.raisedDate)} />
        {pkg.poDate && <Term label="PO date" value={fmtDate(pkg.poDate)} />}
        <Term label="Expected delivery" value={fmtDate(pkg.expectedDelivery)} />
      </div>

      <Divider m="0 0 16px" />
      <Label style={{ marginBottom: 12 }}>Contract terms</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <Term label="Price basis" value={t.priceBasis} />
        <Term label="Incoterms" value={t.incoterms} />
        <Term label="Delivery period" value={t.deliveryPeriod} />
        <Term label="Warranty / guarantee" value={t.warranty} />
        <Term label="Payment terms" value={t.paymentTerms} full />
        <Term label="Liquidated damages (LD)" value={t.ld} />
        <Term label="Performance security" value={t.pbg} />
        <Term label="Retention" value={t.retention} />
        <Term label="Validity" value={t.validity} />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        {pkg.linkedRequestId ? (
          <Button variant="outline" icon="sheet" onClick={() => { onClose(); navigate("request", { id: pkg.linkedRequestId }); }}>View bid evaluation</Button>
        ) : <span style={{ fontSize: 12, color: T.c.inkFaint }}>No linked bid evaluation.</span>}
        <div style={{ display: "flex", gap: 8 }}>
          {pkg.stage < PIPELINE.length - 1 && (
            <Button icon="arrowRight" onClick={() => advancePackage(project.id, pkg.id, pkg.stage + 1)}>Advance to “{stageLabel(pkg.stage + 1)}”</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function ProjectDetail({ id }) {
  const { projects, navigate } = useApp();
  const [open, setOpen] = useState(null);
  const p = projects.find((x) => x.id === id);
  if (!p) return <Card><div style={{ padding: 30, textAlign: "center", color: T.c.inkSoft }}>Project not found. <a style={{ color: T.c.brand, cursor: "pointer" }} onClick={() => navigate("projects")}>Back to projects</a></div></Card>;

  const committed = p.packages.filter((k) => isPO(k.stage)).reduce((n, k) => n + (parseINR(k.value) || 0), 0);
  const pipelineVal = p.packages.filter((k) => !isPO(k.stage)).reduce((n, k) => n + (parseINR(k.value) || 0), 0);
  const pct = p.budget ? Math.min(100, Math.round((committed / p.budget) * 100)) : 0;
  const mgr = userById(p.manager);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button onClick={() => navigate("projects")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.c.inkSoft, cursor: "pointer", fontSize: 12.5, fontFamily: T.font.sans, padding: 0, width: "fit-content" }}>
        <Icon name="arrowLeft" size={15} /> All projects
      </button>

      {/* Header */}
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.c.brand, letterSpacing: "0.04em" }}>{p.code}</span>
              <Pill tone={p.status === "Execution" ? "info" : p.status === "Closed" ? "ok" : "warn"} size="sm" dot={false}>{p.status}</Pill>
            </div>
            <div style={{ fontFamily: T.font.serif, fontSize: 24, fontWeight: 600, color: T.c.ink, lineHeight: 1.2 }}>{p.name}</div>
            <div style={{ fontSize: 13, color: T.c.inkSoft, marginTop: 7, lineHeight: 1.55, maxWidth: 760 }}>{p.description}</div>
          </div>
        </div>
        <Divider m="18px 0" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 18 }}>
          <Meta label="Client" value={p.client} />
          <Meta label="Location" value={p.location} />
          <Meta label="Project manager" value={mgr.name} />
          <Meta label="Timeline" value={`${fmtDate(p.start)} – ${fmtDate(p.end)}`} />
        </div>
        <Divider m="18px 0" />
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 7 }}>
              <span style={{ color: T.c.inkSoft }}>Committed (POs issued): <strong style={{ color: T.c.ink }}>{inr(committed)}</strong></span>
              <span style={{ fontWeight: 700, color: T.c.ink }}>{pct}% of budget</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: T.c.canvasDeep, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${T.c.brand}, ${T.c.brandDeep})` }} />
            </div>
          </div>
          <Meta label="Budget" value={inr(p.budget)} />
          <Meta label="In pipeline (PRs)" value={inr(pipelineVal)} accent />
        </div>
      </Card>

      {/* Packages */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Icon name="sheet" size={18} color={T.c.brand} />
        <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600 }}>Procurement packages</div>
        <span style={{ fontSize: 12.5, color: T.c.inkFaint }}>· {p.packages.length} PR/PO</span>
      </div>
      <Card pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1.1fr 1.3fr 1fr 1.5fr", padding: "11px 20px", borderBottom: `1px solid ${T.c.line}`, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.c.inkFaint }}>
          <div>Package</div><div>Ref</div><div>Vendor</div><div>Value</div><div>Stage</div>
        </div>
        {p.packages.map((k, i) => {
          const po = isPO(k.stage);
          return (
            <div key={k.id} onClick={() => setOpen(k)}
              style={{ display: "grid", gridTemplateColumns: "2.2fr 1.1fr 1.3fr 1fr 1.5fr", padding: "14px 20px", borderBottom: i < p.packages.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", alignItems: "center", cursor: "pointer", gap: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.c.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.title}</div>
                <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 2 }}>{k.category}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: po ? T.s.info.bg : T.s.warn.bg, color: po ? T.s.info.fg : T.s.warn.fg }}>{po ? "PO" : "PR"}</span>
                <div style={{ fontSize: 11.5, color: T.c.inkSoft, marginTop: 3 }}>{po ? k.poRef : k.prRef}</div>
              </div>
              <div style={{ fontSize: 12.5, color: k.vendor ? T.c.ink : T.c.inkFaint, fontWeight: k.vendor ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.vendor || "To be awarded"}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.c.ink }}>{inr(k.value)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pill tone={stageTone(k.stage)} size="sm">{stageLabel(k.stage)}</Pill>
                {k.linkedRequestId && <Icon name="sheet" size={13} color={T.c.brand} title="Linked evaluation" />}
              </div>
            </div>
          );
        })}
      </Card>

      {open && <PackageModal project={p} pkg={open} onClose={() => setOpen(null)} />}
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
