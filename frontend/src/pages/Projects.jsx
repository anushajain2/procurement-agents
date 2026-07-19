import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Pill, Label, Avatar, EmptyState } from "../ui.jsx";
import { useApp, userById } from "../store.jsx";
import { inr, parseINR, PO_STAGE, isPO } from "../projects.js";

const STATUS_TONE = { Procurement: "warn", Execution: "info", Closed: "ok", Planning: "na" };

export default function Projects() {
  const { projects, navigate } = useApp();

  if (!projects.length) return <Card><EmptyState icon="layers" title="No projects yet" body="Projects and their PRs/POs will be tracked here." /></Card>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Label>{projects.length} active projects · {projects.reduce((n, p) => n + p.packages.length, 0)} procurement packages</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
        {projects.map((p) => {
          const committed = p.packages.filter((k) => isPO(k.stage)).reduce((n, k) => n + (parseINR(k.value) || 0), 0);
          const pct = p.budget ? Math.min(100, Math.round((committed / p.budget) * 100)) : 0;
          const pos = p.packages.filter((k) => isPO(k.stage)).length;
          const prs = p.packages.length - pos;
          const mgr = userById(p.manager);
          return (
            <Card key={p.id} onClick={() => navigate("project", { id: p.id })} hover pad={0} style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 18px 14px", borderBottom: `1px solid ${T.c.lineSoft}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.c.brand, letterSpacing: "0.04em" }}>{p.code}</span>
                  <Pill tone={STATUS_TONE[p.status] || "na"} size="sm" dot={false}>{p.status}</Pill>
                </div>
                <div style={{ fontFamily: T.font.serif, fontSize: 18, fontWeight: 600, color: T.c.ink, lineHeight: 1.25 }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 12, color: T.c.inkSoft }}>
                  <Icon name="vendors" size={13} color={T.c.inkFaint} /> {p.client}
                </div>
              </div>
              <div style={{ padding: "14px 18px", flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: T.c.inkSoft }}>Committed <strong style={{ color: T.c.ink }}>{inr(committed)}</strong></span>
                  <span style={{ color: T.c.inkFaint }}>of {inr(p.budget)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: T.c.canvasDeep, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${T.c.brand}, ${T.c.brandDeep})` }} />
                </div>
                <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
                  <Mini label="Packages" value={p.packages.length} />
                  <Mini label="POs issued" value={pos} accent />
                  <Mini label="Open PRs" value={prs} />
                </div>
              </div>
              <div style={{ padding: "11px 18px", borderTop: `1px solid ${T.c.lineSoft}`, display: "flex", alignItems: "center", gap: 8, background: T.c.canvas }}>
                <Avatar user={mgr} size={22} />
                <span style={{ fontSize: 11.5, color: T.c.inkSoft }}>{mgr.name} · Project Manager</span>
                <Icon name="arrowRight" size={15} color={T.c.inkFaint} style={{ marginLeft: "auto" }} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontFamily: T.font.serif, fontSize: 20, fontWeight: 600, color: accent ? T.c.brand : T.c.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: T.c.inkFaint, marginTop: 3 }}>{label}</div>
    </div>
  );
}
