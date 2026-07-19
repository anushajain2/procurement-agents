import { T } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, Pill, Label, EmptyState, Button } from "../ui.jsx";
import { useApp } from "../store.jsx";

// Vendors are derived from every evaluation they appear in.
export default function Vendors() {
  const { requests, navigate } = useApp();

  const map = new Map();
  requests.forEach((r) => {
    const result = r.result || {};
    (result.vendors || []).forEach((v) => {
      if (!map.has(v)) map.set(v, { name: v, evals: 0, awards: 0, okSum: 0, totalSum: 0, categories: new Set() });
      const e = map.get(v);
      e.evals += 1;
      e.categories.add(r.category);
      if (r.awardedVendor === v && r.status === "approved") e.awards += 1;
      const c = result.compliance?.[v];
      if (c) { e.okSum += c.ok || 0; e.totalSum += c.total || 0; }
    });
  });
  const vendors = [...map.values()].sort((a, b) => b.evals - a.evals);

  if (vendors.length === 0) {
    return <Card><EmptyState icon="vendors" title="No vendors yet" body="Vendors appear here as you evaluate their bids." action={<Button icon="plus" onClick={() => navigate("new")}>New evaluation</Button>} /></Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Label>{vendors.length} vendors across {requests.length} evaluations</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {vendors.map((v) => {
          const rate = v.totalSum ? Math.round((v.okSum / v.totalSum) * 100) : 0;
          return (
            <Card key={v.name} pad={16}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: T.c.pine, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font.serif, fontSize: 18, fontWeight: 600, flexShrink: 0 }}>{v.name[0]}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.c.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                  <div style={{ fontSize: 11.5, color: T.c.inkFaint }}>{[...v.categories].join(", ")}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <Stat label="Evaluations" value={v.evals} />
                <Stat label="Awards won" value={v.awards} accent />
                <Stat label="Avg. compliance" value={`${rate}%`} />
              </div>
              {v.awards > 0 && <Pill tone="ok" size="sm">Awarded supplier</Pill>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ flex: 1, padding: "9px 10px", background: T.c.canvas, borderRadius: 9, textAlign: "center" }}>
      <div style={{ fontFamily: T.font.serif, fontSize: 19, fontWeight: 600, color: accent ? T.c.brand : T.c.ink }}>{value}</div>
      <div style={{ fontSize: 10, color: T.c.inkFaint, marginTop: 2 }}>{label}</div>
    </div>
  );
}
