import { useState, Fragment } from "react";
import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, Pill, Label, Divider, fmtDate } from "../ui.jsx";
import { useApp, userById } from "../store.jsx";

const BASIS = {
  reference: { label: "Ref doc", tone: "ok" },
  standard: { label: "Standard", tone: "info" },
  engineering: { label: "Eng. default", tone: "na" },
  pr: { label: "Brief", tone: "na" },
};
const CONF = { high: { tone: "ok", label: "High" }, medium: { tone: "info", label: "Medium" }, low: { tone: "warn", label: "Low" } };

export default function SpecDetail({ id }) {
  const { specs, navigate, user, updateSpecParam, patchSpec, deleteSpec } = useApp();
  const spec = specs.find((s) => s.id === id);
  const [copied, setCopied] = useState(false);
  if (!spec) return <Card><div style={{ padding: 30, textAlign: "center", color: T.c.inkSoft }}>Specification not found. <a style={{ color: T.c.brand, cursor: "pointer" }} onClick={() => navigate("specs")}>Back to specs</a></div></Card>;

  const isOwner = spec.createdBy === user.id;
  const params = spec.parameters || [];
  const pending = params.filter((p) => p.needs_review && !p.reviewed).length;
  const ready = spec.status === "ready";

  // Group parameters by category, keeping their original index for edits.
  const sections = [];
  const seen = new Map();
  params.forEach((p, idx) => {
    if (!seen.has(p.category)) { seen.set(p.category, { category: p.category, rows: [] }); sections.push(seen.get(p.category)); }
    seen.get(p.category).rows.push({ ...p, _i: idx });
  });

  const toText = () => {
    const L = [spec.title, spec.summary, ""];
    if (spec.standards?.length) { L.push("APPLICABLE STANDARDS:"); spec.standards.forEach((s) => L.push("  · " + s)); L.push(""); }
    L.push("DATASHEET:");
    sections.forEach((sec) => {
      L.push("  " + sec.category);
      sec.rows.forEach((r) => L.push(`    - ${r.parameter}${r.unit && r.unit !== "-" ? ` (${r.unit})` : ""}: ${r.requirement}${r.standard ? `  [${r.standard}]` : ""}`));
    });
    L.push("");
    (spec.sections || []).forEach((s) => { L.push(s.heading.toUpperCase()); L.push(s.body); L.push(""); });
    return L.join("\n");
  };

  const copy = () => { navigator.clipboard?.writeText(toText()); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  const toRequirements = () => {
    const L = [spec.title]; if (spec.summary) L.push(spec.summary);
    if (spec.standards?.length) L.push("\nApplicable standards: " + spec.standards.join("; "));
    L.push("\nRequirements:");
    params.forEach((p) => L.push(`- ${p.parameter}${p.unit && p.unit !== "-" ? ` (${p.unit})` : ""}: ${p.requirement}${p.standard ? ` [${p.standard}]` : ""}`));
    return L.join("\n");
  };

  const cellHead = { padding: "9px 12px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.c.inkFaint, textAlign: "left", borderBottom: `1px solid ${T.c.line}` };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button onClick={() => navigate("specs")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.c.inkSoft, cursor: "pointer", fontSize: 12.5, fontFamily: T.font.sans, padding: 0, width: "fit-content" }}>
        <Icon name="arrowLeft" size={15} /> All specifications
      </button>

      {/* Header */}
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.c.brand, letterSpacing: "0.04em" }}>{spec.ref}</span>
              {ready ? <Pill tone="ok">Ready to issue</Pill> : pending > 0 ? <Pill tone="warn">{pending} to confirm</Pill> : <Pill tone="info">Draft</Pill>}
            </div>
            <div style={{ fontFamily: T.font.serif, fontSize: 23, fontWeight: 600, color: T.c.ink, lineHeight: 1.2 }}>{spec.title}</div>
            <div style={{ fontSize: 13, color: T.c.inkSoft, marginTop: 6, lineHeight: 1.5, maxWidth: 720 }}>{spec.summary}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <Button variant="outline" size="sm" icon={copied ? "check" : "file"} onClick={copy}>{copied ? "Copied" : "Copy as text"}</Button>
            <Button variant="outline" size="sm" icon="sheet" onClick={() => navigate("new", { seedReq: toRequirements(), category: spec.category })}>Create evaluation</Button>
          </div>
        </div>
        <Divider m="18px 0" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 18 }}>
          <Meta label="Category" value={spec.category} />
          <Meta label="Parameters" value={params.length} />
          <Meta label="Drafted by" value={userById(spec.createdBy).name} />
          <Meta label="Created" value={fmtDate(spec.createdAt)} />
        </div>
        {spec.standards?.length > 0 && (
          <>
            <Divider m="16px 0" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <Label>Standards referenced</Label>
              {spec.standards_verified && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, color: T.s.ok.fg, background: T.s.ok.bg, border: `1px solid ${T.s.ok.line}`, borderRadius: 999, padding: "2px 8px" }}>
                  <Icon name="search" size={11} /> Current editions web-verified
                </span>
              )}
              {spec.used_references && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, color: T.s.info.fg, background: T.s.info.bg, border: `1px solid ${T.s.info.line}`, borderRadius: 999, padding: "2px 8px" }}>
                  <Icon name="file" size={11} /> Grounded in your reference docs
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {spec.standards.map((s, i) => (
                <span key={i} style={{ fontSize: 12, color: T.c.inkSoft, background: T.c.canvas, border: `1px solid ${T.c.line}`, borderRadius: 999, padding: "4px 11px" }}>⬡ {s}</span>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Review gating banner */}
      {pending > 0 ? (
        <Card style={{ borderColor: T.s.warn.line, background: T.s.warn.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="alert" size={22} color={T.s.warn.fg} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.font.serif, fontSize: 16, fontWeight: 600, color: "#7a5a12" }}>{pending} value{pending === 1 ? "" : "s"} need engineer confirmation before issue</div>
              <div style={{ fontSize: 12.5, color: "#7a5a12" }}>These are code-derived limits Claude could not source from your references — confirm each against the licensed standard, then this RFQ can be issued.</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ borderColor: T.s.ok.line, background: T.s.ok.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Icon name="check" size={22} color={T.s.ok.fg} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: T.font.serif, fontSize: 16, fontWeight: 600, color: T.s.ok.fg }}>{ready ? "Marked ready to issue" : "All values confirmed"}</div>
              <div style={{ fontSize: 12.5, color: "#2C5C3F" }}>Every code-derived value has been sourced or confirmed by an engineer.</div>
            </div>
            {!ready && isOwner && <Button variant="success" icon="check" onClick={() => patchSpec(spec.id, { status: "ready" })}>Mark ready to issue</Button>}
          </div>
        </Card>
      )}

      {/* Datasheet */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <Icon name="sheet" size={18} color={T.c.brand} />
        <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600 }}>Parameter datasheet</div>
        <span style={{ fontSize: 11.5, color: T.c.inkFaint }}>· edit any value; confirm flagged ones</span>
      </div>
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...cellHead, minWidth: 190 }}>Parameter</th>
                <th style={{ ...cellHead, width: 60 }}>Unit</th>
                <th style={{ ...cellHead, minWidth: 240 }}>Specified requirement</th>
                <th style={{ ...cellHead, width: 110 }}>Source</th>
                <th style={{ ...cellHead, width: 150 }}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec, si) => (
                <Fragment key={si}>
                  <tr><td colSpan={5} style={{ padding: "8px 12px", background: T.c.canvasDeep, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: T.c.brandDeep }}>{sec.category}</td></tr>
                  {sec.rows.map((r) => {
                    const flagged = r.needs_review && !r.reviewed;
                    const b = BASIS[r.basis] || BASIS.engineering;
                    const c = CONF[r.confidence] || CONF.medium;
                    return (
                      <tr key={r._i} style={{ background: flagged ? T.s.warn.bg : "#fff", borderBottom: `1px solid ${T.c.lineSoft}` }}>
                        <td style={{ padding: "9px 12px", fontSize: 12.5, fontWeight: 500, color: T.c.ink, verticalAlign: "top" }}>{r.parameter}</td>
                        <td style={{ padding: "9px 12px", fontSize: 11.5, color: T.c.inkFaint, verticalAlign: "top" }}>{r.unit}</td>
                        <td style={{ padding: "6px 10px", verticalAlign: "top" }}>
                          <input value={r.requirement} onChange={(e) => updateSpecParam(spec.id, r._i, { requirement: e.target.value })}
                            style={{ width: "100%", border: `1px solid ${flagged ? T.s.warn.line : T.c.line}`, borderRadius: 6, padding: "5px 8px", fontSize: 12.5, fontFamily: T.font.sans, color: flagged ? "#7a5a12" : T.c.ink, background: flagged ? "#FFFDF5" : "#fff", outline: "none" }} />
                          {r.note && <div style={{ fontSize: 10.5, color: flagged ? "#8a6a1a" : T.c.inkFaint, marginTop: 3, lineHeight: 1.4 }}>{r.note}</div>}
                          {r.standard && <div style={{ fontSize: 10, color: T.s.info.fg, marginTop: 2 }}>⬡ {r.standard}</div>}
                        </td>
                        <td style={{ padding: "9px 12px", verticalAlign: "top" }}><Pill tone={b.tone} size="sm" dot={false}>{b.label}</Pill></td>
                        <td style={{ padding: "9px 12px", verticalAlign: "top" }}>
                          {r.needs_review ? (
                            r.reviewed ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.s.ok.fg, fontWeight: 600 }}>
                                <Icon name="check" size={13} /> Confirmed
                                <span onClick={() => updateSpecParam(spec.id, r._i, { reviewed: false })} style={{ cursor: "pointer", color: T.c.inkFaint, fontSize: 10, marginLeft: 2 }}>undo</span>
                              </span>
                            ) : (
                              <Button variant="amber" size="sm" icon="check" onClick={() => updateSpecParam(spec.id, r._i, { reviewed: true })}>Confirm</Button>
                            )
                          ) : (
                            <Pill tone={c.tone} size="sm">{c.label}</Pill>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Narrative sections */}
      {(spec.sections || []).length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Icon name="doc2" size={18} color={T.c.brand} />
            <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600 }}>Specification</div>
          </div>
          <Card>
            {spec.sections.map((s, i) => (
              <div key={i} style={{ marginBottom: i < spec.sections.length - 1 ? 18 : 0 }}>
                <div style={{ fontFamily: T.font.serif, fontSize: 15, fontWeight: 600, color: T.c.ink, marginBottom: 5 }}>{i + 1}. {s.heading}</div>
                <div style={{ fontSize: 13, color: T.c.inkSoft, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{s.body}</div>
              </div>
            ))}
          </Card>
        </>
      )}

      <div style={{ fontSize: 11, color: T.c.inkFaint, textAlign: "center" }}>
        Drafted by {spec.model || "Claude"} · standards referenced by number/edition only — confirm code-derived limits against the licensed standard before issue.
      </div>

      {isOwner && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="danger" size="sm" icon="x" onClick={() => { if (confirm("Delete this specification?")) { deleteSpec(spec.id); navigate("specs"); } }}>Delete specification</Button>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <Label style={{ marginBottom: 4 }}>{label}</Label>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.c.ink }}>{value}</div>
    </div>
  );
}
