import { useState } from "react";
import { T } from "./theme.js";
import { Icon } from "./icons.jsx";
import { Avatar } from "./ui.jsx";
import { useApp, USERS, pendingForUser } from "./store.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "new", label: "New Evaluation", icon: "plus" },
  { id: "specs", label: "Specs & RFQs", icon: "doc2" },
  { id: "pending", label: "Pending Evaluations", icon: "clock", pendingBadge: true },
  { id: "requests", label: "Requests", icon: "sheet" },
  { id: "approvals", label: "Approvals", icon: "inbox", badge: true },
  { id: "projects", label: "Projects", icon: "layers" },
  { id: "vendors", label: "Vendors", icon: "vendors" },
];

const PENDING_EVAL = ["processing", "draft", "error"];

function Sidebar() {
  const { view, navigate, requests, user } = useApp();
  const inbox = pendingForUser(requests, user).length;
  const pendingEvals = requests.filter((r) => PENDING_EVAL.includes(r.status)).length;
  return (
    <aside style={{ width: 248, background: T.c.card, color: T.c.inkSoft, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", borderRight: `1px solid ${T.c.line}` }}>
      {/* Wordmark */}
      <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", gap: 11, borderBottom: `1px solid ${T.c.lineSoft}` }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: T.c.ink, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <Icon name="layers" size={18} strokeWidth={1.9} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.c.ink, lineHeight: 1, letterSpacing: "-0.02em" }}>Oton</div>
          <div style={{ fontSize: 9, letterSpacing: "0.13em", textTransform: "uppercase", color: T.c.inkFaint, marginTop: 3 }}>Procurement Suite</div>
        </div>
      </div>

      <nav style={{ padding: "12px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: T.c.inkFaint, padding: "8px 12px 6px" }}>Workspace</div>
        {NAV.map((n) => {
          const active = view.name === n.id || (n.id === "requests" && view.name === "request") || (n.id === "projects" && view.name === "project") || (n.id === "specs" && (view.name === "spec" || view.name === "newspec"));
          const count = n.badge ? inbox : n.pendingBadge ? pendingEvals : 0;
          return (
            <button key={n.id} onClick={() => navigate(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: T.radius.md, border: "none", cursor: "pointer",
                background: active ? T.c.canvasDeep : "transparent", color: active ? T.c.ink : T.c.inkSoft,
                fontFamily: T.font.sans, fontSize: 13.5, fontWeight: active ? 600 : 450, textAlign: "left", width: "100%", transition: "background .15s, color .15s" }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = T.c.canvas; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <Icon name={n.icon} size={18} color={active ? T.c.ink : T.c.inkFaint} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {count > 0 && (
                <span style={{ background: T.c.ink, color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, minWidth: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 14, borderTop: `1px solid ${T.c.lineSoft}` }}>
        <div style={{ background: T.c.canvas, border: `1px solid ${T.c.line}`, borderRadius: T.radius.md, padding: "11px 13px" }}>
          <div style={{ fontSize: 11, color: T.c.ink, fontWeight: 600, marginBottom: 3 }}>AI Bid Evaluation</div>
          <div style={{ fontSize: 10.5, color: T.c.inkFaint, lineHeight: 1.5 }}>Grounded in your real documents — every value traceable to its source page.</div>
        </div>
      </div>
    </aside>
  );
}

function UserSwitcher() {
  const { user, setUserId } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 9px 5px 6px", borderRadius: 999, border: `1px solid ${T.c.line}`, background: T.c.card, cursor: "pointer" }}>
        <Avatar user={user} size={30} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.c.ink, lineHeight: 1.2 }}>{user.name}</div>
          <div style={{ fontSize: 10.5, color: T.c.inkFaint }}>{user.role}</div>
        </div>
        <Icon name="chevronDown" size={15} color={T.c.inkFaint} style={{ marginLeft: 2 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 280, background: T.c.card, border: `1px solid ${T.c.line}`, borderRadius: T.radius.lg, boxShadow: T.shadow.lg, zIndex: 40, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.c.inkFaint, borderBottom: `1px solid ${T.c.lineSoft}` }}>Switch acting user (demo)</div>
          {USERS.map((u) => (
            <div key={u.id} onMouseDown={() => { setUserId(u.id); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", cursor: "pointer", background: u.id === user.id ? T.c.brandSoft : "transparent" }}
              onMouseEnter={(e) => { if (u.id !== user.id) e.currentTarget.style.background = T.c.canvas; }}
              onMouseLeave={(e) => { if (u.id !== user.id) e.currentTarget.style.background = "transparent"; }}>
              <Avatar user={u} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.c.ink }}>{u.name}</div>
                <div style={{ fontSize: 11, color: T.c.inkSoft }}>{u.role}</div>
              </div>
              {u.level > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: T.c.inkFaint }}>L{u.level}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Shell({ title, subtitle, actions, children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.c.canvas, color: T.c.ink, fontFamily: T.font.sans }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 64, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${T.c.line}`, display: "flex", alignItems: "center", padding: "0 30px", gap: 16, position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: T.c.ink, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: T.c.inkSoft, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            {actions}
            <UserSwitcher />
          </div>
        </header>
        <div style={{ flex: 1, padding: "26px 30px 60px", maxWidth: 1240, width: "100%", margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}
