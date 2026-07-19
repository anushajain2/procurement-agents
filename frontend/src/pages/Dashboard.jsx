import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, StatusPill, Avatar, Label, fmtDate, EmptyState } from "../ui.jsx";
import { useApp, userById, pendingForUser } from "../store.jsx";

function Stat({ label, value, icon, tone = "brand", onClick }) {
  const colors = { brand: T.c.brand, amber: T.c.amber, ok: T.s.ok.fg, info: T.s.info.fg };
  return (
    <Card pad={0} onClick={onClick} hover={!!onClick} style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.c.canvasDeep, color: colors[tone], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={icon} size={22} />
        </div>
        <div>
          <div style={{ fontFamily: T.font.serif, fontSize: 30, fontWeight: 600, color: T.c.ink, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 12, color: T.c.inkSoft, marginTop: 4 }}>{label}</div>
        </div>
      </div>
      <div style={{ height: 3, background: colors[tone], opacity: 0.85 }} />
    </Card>
  );
}

export default function Dashboard() {
  const { requests, navigate, user } = useApp();
  const by = (s) => requests.filter((r) => r.status === s).length;
  const inbox = pendingForUser(requests, user);
  const recent = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: T.c.inkSoft }}>Welcome back, <strong style={{ color: T.c.ink }}>{user.name.split(" ")[0]}</strong></div>
        <div style={{ display: "flex", gap: 10 }}>
          {inbox.length > 0 && <Button variant="outline" icon="inbox" onClick={() => navigate("approvals")}>{inbox.length} awaiting you</Button>}
          <Button icon="plus" onClick={() => navigate("new")}>Start new evaluation</Button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Stat label="Pending evaluations" value={by("processing") + by("draft")} icon="clock" tone="brand" onClick={() => navigate("pending")} />
        <Stat label="In approval" value={by("pending")} icon="inbox" tone="amber" onClick={() => navigate("requests")} />
        <Stat label="Approved" value={by("approved")} icon="check" tone="ok" onClick={() => navigate("requests")} />
        <Stat label="Awaiting your sign-off" value={inbox.length} icon="inbox" tone="info" onClick={() => navigate("approvals")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "start" }}>
        {/* Recent requests */}
        <Card pad={0}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.c.lineSoft}`, display: "flex", alignItems: "center" }}>
            <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600 }}>Recent requests</div>
            <Button variant="ghost" size="sm" style={{ marginLeft: "auto" }} onClick={() => navigate("requests")}>View all</Button>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="No evaluations yet" body="Run your first technical bid evaluation to populate the workspace." action={<Button icon="plus" onClick={() => navigate("new")}>New evaluation</Button>} />
          ) : recent.map((r, i) => (
            <div key={r.id} onClick={() => navigate("request", { id: r.id })}
              style={{ padding: "13px 20px", borderBottom: i < recent.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.c.canvas)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 2 }}>{r.ref} · {r.category} · {r.value || "—"}</div>
              </div>
              <StatusPill status={r.status} size="sm" />
              <Icon name="arrowRight" size={16} color={T.c.inkFaint} />
            </div>
          ))}
        </Card>

        {/* Pending on you */}
        <Card pad={0}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.c.lineSoft}` }}>
            <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600 }}>Pending your approval</div>
          </div>
          {inbox.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: T.c.inkSoft, fontSize: 13 }}>
              <Icon name="check" size={28} color={T.s.ok.fg} style={{ marginBottom: 8 }} />
              <div>You're all caught up.</div>
              <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 4 }}>Acting as {user.role}.</div>
            </div>
          ) : inbox.map((r, i) => (
            <div key={r.id} onClick={() => navigate("request", { id: r.id })}
              style={{ padding: "13px 20px", borderBottom: i < inbox.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.c.canvas)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.c.ink, marginBottom: 4 }}>{r.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar user={userById(r.createdBy)} size={20} />
                <span style={{ fontSize: 11.5, color: T.c.inkFaint }}>{userById(r.createdBy).name.split(" ")[0]} · {fmtDate(r.createdAt)}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: T.c.amberDeep }}>L{r.currentLevel} →</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
