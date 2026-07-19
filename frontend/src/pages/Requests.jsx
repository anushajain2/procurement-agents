import { useState } from "react";
import { T, REQ_STATUS } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, StatusPill, Avatar, Pill, EmptyState, fmtDate } from "../ui.jsx";
import { useApp, userById, parseRanking } from "../store.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "In Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "changes", label: "Changes" },
];

// Requests shows only evaluations that have been sent for approval — drafts and
// in-progress evaluations live under Pending Evaluations.
const SUBMITTED = ["pending", "approved", "rejected", "changes"];

export default function Requests() {
  const { requests, navigate } = useApp();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const list = requests
    .filter((r) => SUBMITTED.includes(r.status))
    .filter((r) => (filter === "all" ? true : r.status === filter))
    .filter((r) => (q ? (r.title + r.ref + r.category).toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: T.c.card, border: `1px solid ${T.c.line}`, borderRadius: 999, padding: 4 }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = f.id === "all" ? requests.filter((r) => SUBMITTED.includes(r.status)).length : requests.filter((r) => r.status === f.id).length;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{ padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: T.font.sans,
                  background: active ? T.c.pine : "transparent", color: active ? "#fff" : T.c.inkSoft }}>
                {f.label} <span style={{ opacity: 0.65 }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, background: T.c.card, border: `1px solid ${T.c.line}`, borderRadius: 999, padding: "7px 14px", minWidth: 230 }}>
          <Icon name="search" size={16} color={T.c.inkFaint} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests…" style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent", color: T.c.ink, fontFamily: T.font.sans }} />
        </div>
        <Button icon="plus" onClick={() => navigate("new")}>New evaluation</Button>
      </div>

      {list.length === 0 ? (
        <Card><EmptyState title="No requests found" body="Try a different filter, or start a new technical bid evaluation." action={<Button icon="plus" onClick={() => navigate("new")}>New evaluation</Button>} /></Card>
      ) : (
        <Card pad={0}>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 1.3fr 1fr", padding: "11px 20px", borderBottom: `1px solid ${T.c.line}`, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.c.inkFaint }}>
            <div>Evaluation</div><div>Category</div><div>Value</div><div>Approval</div><div>Status</div>
          </div>
          {list.map((r, i) => {
            const ranked = parseRanking(r.ranking || r.result?.ranking);
            return (
              <div key={r.id} onClick={() => navigate("request", { id: r.id })}
                style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 1.3fr 1fr", padding: "14px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", alignItems: "center", cursor: "pointer", gap: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.c.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 2 }}>{r.ref} · {(r.result?.vendors || []).length} vendors · {fmtDate(r.createdAt)}</div>
                </div>
                <div style={{ fontSize: 12.5, color: T.c.inkSoft }}>{r.category}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.c.ink }}>{r.value || "—"}</div>
                <div>{r.status === "pending" ? <Pill tone="warn" size="sm">L{r.currentLevel} of {r.chain.length}</Pill> : r.status === "approved" ? <Pill tone="ok" size="sm">Complete</Pill> : <span style={{ fontSize: 12, color: T.c.inkFaint }}>—</span>}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusPill status={r.status} size="sm" />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
