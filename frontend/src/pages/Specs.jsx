import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, Pill, EmptyState, fmtDate } from "../ui.jsx";
import { useApp, userById } from "../store.jsx";

export default function Specs() {
  const { specs, navigate } = useApp();
  const sorted = [...specs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>{specs.length} specification{specs.length === 1 ? "" : "s"} / RFQs</div>
        <Button icon="plus" style={{ marginLeft: "auto" }} onClick={() => navigate("newspec")}>New specification</Button>
      </div>

      {sorted.length === 0 ? (
        <Card><EmptyState icon="doc2" title="No specifications yet" body="Draft a standards-based RFQ / technical specification from an equipment brief — Claude builds the datasheet and sections, and flags any code value that needs engineer sign-off." action={<Button icon="plus" onClick={() => navigate("newspec")}>New specification</Button>} /></Card>
      ) : (
        <Card pad={0}>
          <div style={{ display: "grid", gridTemplateColumns: "2.6fr 1fr 1fr 1fr", padding: "11px 20px", borderBottom: `1px solid ${T.c.line}`, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.c.inkFaint }}>
            <div>Specification</div><div>Category</div><div>Parameters</div><div>Status</div>
          </div>
          {sorted.map((s, i) => {
            const pending = (s.parameters || []).filter((p) => p.needs_review && !p.reviewed).length;
            const ready = s.status === "ready" || pending === 0;
            return (
              <div key={s.id} onClick={() => navigate("spec", { id: s.id })}
                style={{ display: "grid", gridTemplateColumns: "2.6fr 1fr 1fr 1fr", padding: "14px 20px", borderBottom: i < sorted.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", alignItems: "center", cursor: "pointer", gap: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.c.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                  <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 2 }}>{s.ref} · {userById(s.createdBy).name} · {fmtDate(s.createdAt)}</div>
                </div>
                <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>{s.category}</div>
                <div style={{ fontSize: 13, color: T.c.ink }}>{(s.parameters || []).length}</div>
                <div>
                  {s.status === "ready" ? <Pill tone="ok" size="sm">Ready to issue</Pill>
                    : pending > 0 ? <Pill tone="warn" size="sm">{pending} to confirm</Pill>
                    : <Pill tone="info" size="sm">Draft</Pill>}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
