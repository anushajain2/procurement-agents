import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Button, Pill, StatusPill, Avatar, Label, EmptyState, fmtDate } from "../ui.jsx";
import { useApp, userById, pendingForUser } from "../store.jsx";

export default function Approvals() {
  const { requests, user, navigate } = useApp();

  if (user.level === 0) {
    return (
      <Card>
        <EmptyState icon="inbox" title="No approval inbox for this role"
          body="You're acting as a Procurement Engineer (requester). Switch to a manager or finance role from the top-right to review pending approvals."
          action={<Button icon="plus" onClick={() => navigate("new")}>New evaluation</Button>} />
      </Card>
    );
  }

  const inbox = pendingForUser(requests, user);
  // Things this user has already acted on.
  const acted = requests.filter((r) => r.chain?.some((c) => c.userId === user.id && c.status !== "pending"))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card pad={0}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.c.lineSoft}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="inbox" size={19} color={T.c.amber} />
          <div style={{ fontFamily: T.font.serif, fontSize: 17, fontWeight: 600 }}>Awaiting your sign-off</div>
          {inbox.length > 0 && <span style={{ background: T.c.amber, color: "#fff", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "2px 9px" }}>{inbox.length}</span>}
        </div>
        {inbox.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: T.c.inkSoft }}>
            <Icon name="check" size={30} color={T.s.ok.fg} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: T.c.ink }}>You're all caught up</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>No requests are waiting on the {user.role} right now.</div>
          </div>
        ) : inbox.map((r, i) => (
          <div key={r.id} style={{ padding: "15px 20px", borderBottom: i < inbox.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.c.ink }}>{r.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                <Avatar user={userById(r.createdBy)} size={20} />
                <span style={{ fontSize: 11.5, color: T.c.inkFaint }}>{userById(r.createdBy).name} · {r.ref} · {r.value || "—"} · {fmtDate(r.createdAt)}</span>
              </div>
            </div>
            <Pill tone="warn" size="sm" dot={false}>Level {r.currentLevel} of {r.chain.length}</Pill>
            <Button icon="eye" size="sm" onClick={() => navigate("request", { id: r.id })}>Review</Button>
          </div>
        ))}
      </Card>

      <div>
        <Label style={{ marginBottom: 12 }}>Your decision history</Label>
        {acted.length === 0 ? (
          <Card><div style={{ padding: "24px", textAlign: "center", color: T.c.inkFaint, fontSize: 13 }}>You haven't acted on any requests yet.</div></Card>
        ) : (
          <Card pad={0}>
            {acted.map((r, i) => {
              const mine = r.chain.find((c) => c.userId === user.id && c.status !== "pending");
              const tone = mine?.status === "approved" ? "ok" : mine?.status === "rejected" ? "fail" : "info";
              const label = mine?.status === "approved" ? "You approved" : mine?.status === "rejected" ? "You rejected" : "You requested changes";
              return (
                <div key={r.id} onClick={() => navigate("request", { id: r.id })}
                  style={{ padding: "13px 20px", borderBottom: i < acted.length - 1 ? `1px solid ${T.c.lineSoft}` : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.c.canvas)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    <div style={{ fontSize: 11.5, color: T.c.inkFaint, marginTop: 2 }}>{r.ref} · {mine?.actedAt ? fmtDate(mine.actedAt) : ""}</div>
                  </div>
                  <Pill tone={tone} size="sm" dot={false}>{label}</Pill>
                  <StatusPill status={r.status} size="sm" />
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
