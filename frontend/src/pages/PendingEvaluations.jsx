import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, Pill, Spinner, EmptyState, fmtDate } from "../ui.jsx";
import { useApp, userById } from "../store.jsx";

// Evaluations that have been started/created but not yet sent for approval.
const PENDING = ["processing", "draft", "error"];

export default function PendingEvaluations() {
  const { requests, navigate, deleteRequest } = useApp();
  const list = requests.filter((r) => PENDING.includes(r.status)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const processing = list.filter((r) => r.status === "processing").length;
  const ready = list.filter((r) => r.status === "draft").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>
          {processing > 0 && <><strong style={{ color: T.c.ink }}>{processing}</strong> running · </>}
          <strong style={{ color: T.c.ink }}>{ready}</strong> ready to send for approval
        </div>
        <Button icon="plus" style={{ marginLeft: "auto" }} onClick={() => navigate("new")}>New evaluation</Button>
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon="clock" title="No pending evaluations" body="Bid evaluations you start appear here while they build, and stay until you send them for approval. Start one from a PR or a BOQ." action={<Button icon="plus" onClick={() => navigate("new")}>New evaluation</Button>} /></Card>
      ) : (
        <Card pad={0}>
          <div style={{ display: "grid", gridTemplateColumns: "2.6fr 1fr 1.2fr 1.2fr", padding: "11px 20px", borderBottom: `1px solid ${T.c.line}`, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.c.inkFaint }}>
            <div>Evaluation</div><div>Category</div><div>Status</div><div style={{ textAlign: "right" }}>Action</div>
          </div>
          {list.map((r, i) => {
            const vendors = (r.result?.vendors || []).length;
            return (
              <div key={r.id} onClick={() => navigate("request", { id: r.id })}
                style={{ display: "grid", gridTemplateColumns: "2.6fr 1fr 1.2fr 1.2fr", padding: "14px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", alignItems: "center", cursor: "pointer", gap: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.c.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 2 }}>
                    {r.ref} · {fmtDate(r.createdAt)}{r.batch ? ` · from BOQ (${r.batch.index + 1}/${r.batch.total})` : ""}{r.status === "draft" && vendors ? ` · ${vendors} vendors` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>{r.category}</div>
                <div>
                  {r.status === "processing" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.c.inkSoft }}><Spinner /> Building sheet…</span>
                  ) : r.status === "error" ? (
                    <Pill tone="fail" size="sm">Failed</Pill>
                  ) : (
                    <Pill tone="ok" size="sm">Ready</Pill>
                  )}
                </div>
                <div style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  {r.status === "error"
                    ? <Button variant="ghost" size="sm" icon="x" onClick={() => deleteRequest(r.id)}>Remove</Button>
                    : r.status === "draft"
                      ? <Button variant="outline" size="sm" onClick={() => navigate("request", { id: r.id })}>Review →</Button>
                      : <span style={{ fontSize: 11.5, color: T.c.inkFaint }}>—</span>}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
