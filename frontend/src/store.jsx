import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SEED_REQUESTS } from "./seed.js";
import { SEED_PROJECTS } from "./projects.js";
import { SEED_SPECS } from "./specSeed.js";

// ── Demo users / roles ───────────────────────────────────────────────────────
// The approval chain routes by `level`. The active user determines who can act
// on the current pending step (simulating multi-level sign-off in one browser).
export const USERS = [
  { id: "u_eng", name: "Anusha Jain", initials: "AJ", role: "Lead Procurement Engineer", level: 1, dept: "Projects — EPC", color: "#1C7A5E" },
  { id: "u_mgr", name: "R. Krishnan", initials: "RK", role: "Procurement Manager", level: 1, dept: "Procurement", color: "#2C5C86" },
  { id: "u_cat", name: "Meera Nair", initials: "MN", role: "Category Head — Electrical", level: 2, dept: "Category Management", color: "#7A4FA0" },
  { id: "u_fin", name: "S. Iyer", initials: "SI", role: "Chief Financial Officer", level: 3, dept: "Finance", color: "#BC8521" },
  { id: "u_eng2", name: "Arjun Mehta", initials: "AM", role: "Procurement Engineer", level: 0, dept: "Projects — EPC", color: "#B5663B" },
];
export const userById = (id) => USERS.find((u) => u.id === id) || USERS[0];

// The standard approval ladder (requester picks which rungs apply).
export const APPROVAL_LADDER = [
  { level: 1, role: "Procurement Manager", userId: "u_mgr" },
  { level: 2, role: "Category Head — Electrical", userId: "u_cat" },
  { level: 3, role: "Chief Financial Officer", userId: "u_fin" },
];

// Bump these versions whenever the seed shape changes so existing browsers
// re-seed instead of loading stale localStorage data.
const KEY = "procura.requests.v3";
const PKEY = "procura.projects.v3";
const SKEY = "procura.specs.v1";
const now = () => new Date().toISOString();
export const uid = () => "r_" + Math.random().toString(36).slice(2, 9);

function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return fallback;
}
const load = () => loadKey(KEY, SEED_REQUESTS);

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [requests, setRequests] = useState(load);
  const [projects, setProjects] = useState(() => loadKey(PKEY, SEED_PROJECTS));
  const [specs, setSpecs] = useState(() => loadKey(SKEY, SEED_SPECS));
  const [userId, setUserId] = useState("u_eng");
  const [view, setView] = useState({ name: "dashboard", params: {} });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(requests)); } catch { /* ignore */ }
  }, [requests]);
  useEffect(() => {
    try { localStorage.setItem(PKEY, JSON.stringify(projects)); } catch { /* ignore */ }
  }, [projects]);
  useEffect(() => {
    try { localStorage.setItem(SKEY, JSON.stringify(specs)); } catch { /* ignore */ }
  }, [specs]);

  const user = userById(userId);
  const navigate = (name, params = {}) => { setView({ name, params }); window.scrollTo?.(0, 0); };

  const addRequest = (req) => setRequests((rs) => [req, ...rs]);
  const patchRequest = (id, patch) =>
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const logEvent = (id, ev) =>
    setRequests((rs) =>
      rs.map((r) => (r.id === id ? { ...r, activity: [{ ts: now(), ...ev }, ...(r.activity || [])] } : r)),
    );

  // Create a draft request from a completed evaluation result.
  const createFromResult = (result, meta = {}) => {
    const ranked = parseRanking(result.ranking);
    const id = uid();
    const req = {
      id,
      ref: "TBE-" + id.slice(2, 6).toUpperCase(),
      title: meta.title || result.title || "Untitled Evaluation",
      summary: result.mr_summary || "",
      category: meta.category || "Electrical Equipment",
      value: meta.value || "",
      status: "draft",
      batch: meta.batch || null,
      result,
      awardedVendor: ranked[0] || result.vendors?.[0] || "",
      createdBy: userId,
      createdAt: now(),
      chain: [],
      currentLevel: 0,
      activity: [{ ts: now(), actor: userId, action: "created", note: "Evaluation completed and comparison sheet generated." }],
    };
    addRequest(req);
    return id;
  };

  // ── Pending Evaluations (background bid-eval runs) ─────────────────────────
  // Create a placeholder the moment an evaluation is started, so it's saved and
  // shows in Pending Evaluations while it runs — the user can leave and return.
  const createProcessing = (meta = {}) => {
    const id = uid();
    addRequest({
      id, ref: "TBE-" + id.slice(2, 6).toUpperCase(),
      title: meta.title || "Bid Evaluation", summary: "", category: meta.category || "Electrical Equipment",
      value: meta.value || "", status: "processing", batch: meta.batch || null, result: null, awardedVendor: "",
      createdBy: userId, createdAt: now(), startedAt: now(), chain: [], currentLevel: 0,
      activity: [{ ts: now(), actor: userId, action: "started", note: "Bid evaluation started." }],
    });
    return id;
  };
  const finishEvaluation = (id, result) => {
    const ranked = parseRanking(result.ranking);
    setRequests((rs) => rs.map((r) => (r.id !== id ? r : {
      ...r, status: "draft", result, error: null,
      summary: result.mr_summary || r.summary,
      awardedVendor: ranked[0] || result.vendors?.[0] || "",
      activity: [{ ts: now(), actor: userId, action: "created", note: "Comparison sheet generated." }, ...(r.activity || [])],
    })));
  };
  const failEvaluation = (id, message) => setRequests((rs) => rs.map((r) => (r.id !== id ? r : {
    ...r, status: "error", error: message || "Evaluation failed.",
    activity: [{ ts: now(), actor: userId, action: "failed", note: message || "Evaluation failed." }, ...(r.activity || [])],
  })));

  // Submit a draft for approval with a chosen chain of levels.
  const submitForApproval = (id, levels) => {
    const chain = levels.map((l) => ({ ...l, status: "pending", comment: "", actedAt: null }));
    patchRequest(id, { status: "pending", chain, currentLevel: 1 });
    logEvent(id, { actor: userId, action: "submitted", note: `Routed for approval through ${chain.length} level(s).` });
  };

  // Approver action on the current step: approve | reject | changes.
  const actOnApproval = (id, action, comment) => {
    setRequests((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const idx = r.chain.findIndex((c) => c.status === "pending");
        if (idx === -1) return r;
        const chain = r.chain.map((c, i) => (i === idx ? { ...c, status: action, comment, actedAt: now(), actedBy: userId } : c));
        let status = r.status, currentLevel = r.currentLevel;
        if (action === "approved") {
          const next = chain.findIndex((c) => c.status === "pending");
          if (next === -1) { status = "approved"; currentLevel = 0; }
          else currentLevel = chain[next].level;
        } else if (action === "rejected") {
          status = "rejected"; currentLevel = 0;
        } else if (action === "changes") {
          status = "changes"; currentLevel = 0;
        }
        const ev = { ts: now(), actor: userId, action, note: comment || "" };
        return { ...r, chain, status, currentLevel, activity: [ev, ...(r.activity || [])] };
      }),
    );
  };

  // Re-submit a request that came back with change requests.
  const resubmit = (id) => {
    setRequests((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const chain = r.chain.map((c) => ({ ...c, status: "pending", comment: "", actedAt: null, actedBy: null }));
        const ev = { ts: now(), actor: userId, action: "resubmitted", note: "Re-submitted for approval after changes." };
        return { ...r, status: "pending", chain, currentLevel: chain[0]?.level || 1, activity: [ev, ...(r.activity || [])] };
      }),
    );
  };

  const deleteRequest = (id) => setRequests((rs) => rs.filter((r) => r.id !== id));

  // ── Projects / PO tracking ────────────────────────────────────────────────
  const patchProject = (id, patch) => setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // Issue a Purchase Order from a fully-approved evaluation. Creates a PO
  // package under the chosen project and links it back to the request.
  const issuePO = (requestId, { projectId, poRef, expectedDelivery, value: poValue, terms }) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;
    const pkgId = "pkg_" + Math.random().toString(36).slice(2, 8);
    const pkg = {
      id: pkgId, title: req.title, category: req.category, vendor: req.awardedVendor,
      value: poValue, stage: 4, prRef: req.ref?.replace("TBE", "PR") || null, poRef,
      raisedBy: req.createdBy, raisedDate: req.createdAt, poDate: now(),
      expectedDelivery, linkedRequestId: requestId, terms,
    };
    setProjects((ps) => ps.map((p) => (p.id === projectId ? { ...p, packages: [pkg, ...(p.packages || [])] } : p)));
    patchRequest(requestId, { poRef, projectId, packageId: pkgId });
    logEvent(requestId, { actor: userId, action: "po_issued", note: `Purchase Order ${poRef} issued to ${req.awardedVendor}.` });
    return pkgId;
  };

  // Advance a package one step along the pipeline (manual stage tracking).
  const advancePackage = (projectId, pkgId, stage) =>
    setProjects((ps) => ps.map((p) => p.id !== projectId ? p : { ...p, packages: p.packages.map((k) => (k.id === pkgId ? { ...k, stage } : k)) }));

  // ── Specifications / RFQs ─────────────────────────────────────────────────
  const createSpec = (draft, meta = {}) => {
    const id = "spec_" + Math.random().toString(36).slice(2, 9);
    const spec = {
      id, ref: "SPEC-" + id.slice(5, 9).toUpperCase(),
      category: meta.category || "Equipment",
      status: "draft", createdBy: userId, createdAt: now(),
      activity: [{ ts: now(), actor: userId, action: "created", note: "Specification drafted from brief." }],
      ...draft,
    };
    setSpecs((ss) => [spec, ...ss]);
    return id;
  };
  const patchSpec = (id, patch) => setSpecs((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const updateSpecParam = (id, idx, patch) =>
    setSpecs((ss) => ss.map((s) => (s.id !== id ? s : { ...s, parameters: s.parameters.map((p, i) => (i === idx ? { ...p, ...patch } : p)) })));
  const deleteSpec = (id) => setSpecs((ss) => ss.filter((s) => s.id !== id));

  const value = useMemo(
    () => ({
      requests, projects, specs, user, userId, setUserId, view, navigate,
      createFromResult, createProcessing, finishEvaluation, failEvaluation,
      submitForApproval, actOnApproval, resubmit,
      patchRequest, deleteRequest, logEvent,
      patchProject, issuePO, advancePackage,
      createSpec, patchSpec, updateSpecParam, deleteSpec,
    }),
    [requests, projects, specs, userId, view],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// "L1: Voltamp (12/14) > L2: EMCO (10/14)" → ["Voltamp", "EMCO"]
export function parseRanking(ranking) {
  if (!ranking) return [];
  return ranking.split(">").map((seg) => {
    const m = seg.match(/L\d+:\s*(.+?)\s*\(/);
    return m ? m[1].trim() : seg.replace(/L\d+:/, "").trim();
  });
}

// Requests currently awaiting THIS user's sign-off (matched by identity, so a
// request is only "pending on you" if you are the named approver for the step).
export function pendingForUser(requests, user) {
  if (!user) return [];
  return requests.filter(
    (r) => r.status === "pending" && r.chain.some((c) => c.status === "pending" && c.userId === user.id),
  );
}
