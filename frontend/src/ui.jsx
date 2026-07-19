import { useEffect } from "react";
import { T, stat, labelStyle, REQ_STATUS } from "./theme.js";
import { Icon } from "./icons.jsx";

export const Label = ({ children, style }) => <div style={{ ...labelStyle, ...style }}>{children}</div>;

export function Button({ children, variant = "primary", size = "md", icon, onClick, disabled, style, type = "button" }) {
  const pads = size === "sm" ? "7px 13px" : size === "lg" ? "12px 22px" : "9px 17px";
  const fs = size === "sm" ? 12.5 : size === "lg" ? 14.5 : 13.5;
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: pads, fontSize: fs, fontWeight: 600, fontFamily: T.font.sans,
    borderRadius: T.radius.md, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", transition: "filter .15s, background .15s", whiteSpace: "nowrap",
  };
  const variants = {
    primary: { background: disabled ? "#C2C7BD" : T.c.brand, color: "#fff", boxShadow: disabled ? "none" : T.shadow.sm },
    dark: { background: disabled ? "#C2C7BD" : T.c.pine, color: "#fff" },
    amber: { background: T.c.amber, color: "#fff" },
    danger: { background: T.s.fail.bg, color: T.s.fail.fg, border: `1px solid ${T.s.fail.line}` },
    success: { background: T.s.ok.bg, color: T.s.ok.fg, border: `1px solid ${T.s.ok.line}` },
    ghost: { background: "transparent", color: T.c.inkSoft, border: `1px solid ${T.c.line}` },
    outline: { background: T.c.card, color: T.c.ink, border: `1px solid ${T.c.line}`, boxShadow: T.shadow.sm },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...variants[variant], opacity: disabled && variant !== "primary" && variant !== "dark" ? 0.55 : 1, ...style }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.filter = "brightness(0.95)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} />}
      {children}
    </button>
  );
}

// Status pill — used for both compliance and approval lifecycle.
export function Pill({ tone = "na", children, dot = true, size = "md" }) {
  const s = stat(tone);
  const fs = size === "sm" ? 10.5 : 11.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: size === "sm" ? "2px 8px" : "3px 10px",
      borderRadius: 999, background: s.bg, color: s.fg, border: `1px solid ${s.line}`,
      fontSize: fs, fontWeight: 600, fontFamily: T.font.sans, whiteSpace: "nowrap" }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.fg }} />}
      {children}
    </span>
  );
}

export const StatusPill = ({ status, size }) => {
  const m = REQ_STATUS[status] || REQ_STATUS.draft;
  return <Pill tone={m.tone} size={size}>{m.label}</Pill>;
};

export function Card({ children, style, pad = 18, onClick, hover }) {
  return (
    <div onClick={onClick}
      style={{ background: T.c.card, border: `1px solid ${T.c.line}`, borderRadius: T.radius.lg,
        boxShadow: T.shadow.sm, padding: pad, transition: "box-shadow .15s, border-color .15s",
        cursor: onClick ? "pointer" : "default", ...style }}
      onMouseEnter={(e) => { if (hover || onClick) { e.currentTarget.style.boxShadow = T.shadow.md; e.currentTarget.style.borderColor = "#D6D6DA"; } }}
      onMouseLeave={(e) => { if (hover || onClick) { e.currentTarget.style.boxShadow = T.shadow.sm; e.currentTarget.style.borderColor = T.c.line; } }}>
      {children}
    </div>
  );
}

export function Avatar({ user, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: user.color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
      fontSize: size * 0.38, fontFamily: T.font.sans, flexShrink: 0, letterSpacing: "0.02em" }}>
      {user.initials}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, width = 540 }) {
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,30,26,0.5)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ background: T.c.card, borderRadius: T.radius.xl, width,
        maxWidth: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: T.shadow.lg }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.c.lineSoft}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontFamily: T.font.serif, fontSize: 19, fontWeight: 600, color: T.c.ink }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: T.c.inkSoft, marginTop: 3 }}>{subtitle}</div>}
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", color: T.c.inkFaint, padding: 2, display: "flex" }}><Icon name="x" size={20} /></span>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = "sheet", title, body, action }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", color: T.c.inkSoft }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: T.c.canvasDeep, display: "inline-flex", alignItems: "center", justifyContent: "center", color: T.c.inkFaint, marginBottom: 14 }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ fontFamily: T.font.serif, fontSize: 19, fontWeight: 600, color: T.c.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, maxWidth: 380, margin: "0 auto 18px", lineHeight: 1.6 }}>{body}</div>
      {action}
    </div>
  );
}

// Horizontal compliance bar (ok/warn/fail/na segments).
export function ComplianceBar({ counts, total, height = 7 }) {
  const order = ["ok", "warn", "fail", "na"];
  return (
    <div style={{ display: "flex", height, borderRadius: 999, overflow: "hidden", background: T.c.canvasDeep, width: "100%" }}>
      {order.map((k) => {
        const w = total ? (counts[k] / total) * 100 : 0;
        return w > 0 ? <div key={k} style={{ width: `${w}%`, background: stat(k).fg, opacity: k === "na" ? 0.4 : 1 }} /> : null;
      })}
    </div>
  );
}

export const Divider = ({ m = 0 }) => <div style={{ height: 1, background: T.c.lineSoft, margin: m }} />;

export function Spinner({ size = 15, color = T.c.inkFaint }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", border: `2px solid ${T.c.line}`, borderTopColor: color, display: "inline-block", animation: "otonspin .7s linear infinite", flexShrink: 0 }}>
      <style>{`@keyframes otonspin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

// Relative-ish date formatting for activity/timestamps.
export function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}
export function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}
