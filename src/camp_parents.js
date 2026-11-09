// v828 (Kendall 9 Nov 2026: "there should be children for each campaign") - PARENT campaigns with CHILD runs.
// The Frond B launch was three campaign records (run 1 stopped, run 2 done, a retry draft); the card picked the newest record
// (an empty draft) and showed zeros everywhere. Now:
//   camp_parent_<pid>  {id, title, flow, tags[], created}   the parent (e.g. "pja-frond-b": "Palm Jebel Ali owners · Frond B")
//   camp_<id>.parent   the parent id on each child run. A run without one falls back to its first tag (or its own id).
// The parent card shows totals DE-DUPLICATED PER PERSON (each person once, at their furthest status across all runs).
// Read-only helpers: nothing here sends or writes, except ensureParent (called from "create").
const DIG = (s) => String(s || "").replace(/[^0-9]/g, "");
const getJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const slug = (x) => String(x || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export const parentIdOf = (c) => slug(c && c.parent) || slug(c && c.tags && c.tags[0]) || String((c && c.id) || "");
export const defaultParentTitle = (c) => [c.flow, (c.tags || [])[0]].filter(Boolean).join(" · ") || c.name || c.id;

// "create": attach to the parent with the same flow + first tag; make that parent if none exists yet.
export async function ensureParent(env, c, now) {
  if (!c) return null;
  if (!c.parent) {
    const pid = parentIdOf(c), rec = await getJ(env, "camp_parent_" + pid, null);
    if (rec && (rec.flow || "") !== (c.flow || "") ) c.parent = slug(pid + "-" + (c.flow || "x"));   // same tag, different flow: its own parent
    else c.parent = pid;
  }
  const k = "camp_parent_" + c.parent;
  if (!(await env.MEETINGS.get(k))) await env.MEETINGS.put(k, JSON.stringify({ id: c.parent, title: defaultParentTitle(c), flow: c.flow || "", tags: (c.tags || []).slice(0, 1), created: new Date(now || Date.now()).toISOString() }));
  return c.parent;
}

// A run "has sent" when Meta accepted or refused at least one message. Drafts and zero-sent runs never become the default view.
export const runSent = (S) => (S && S.sent) || 0;
export function runActivity(c, S) {
  if (!runSent(S)) return 0;
  const t = [c.done, c.stopped && c.stopped.at, c.paused, c.resumed, c.started, c.created].map((x) => Date.parse(x || "")).filter((x) => !isNaN(x));
  const days = Object.keys((S && S.day) || {}).filter((d) => S.day[d] > 0).sort(); if (days.length) t.push(Date.parse(days[days.length - 1] + "T12:00:00Z"));
  return t.length ? Math.max(...t) : 1;
}
export const runScheduled = (c, S) => c.status === "draft" || !runSent(S);

// Group the campaigns into parents. camps: [{c, S}] in camp_index order. Returns parents newest-activity first.
export async function buildParents(env, camps) {
  const by = {};
  for (const x of camps) { const pid = parentIdOf(x.c); (by[pid] || (by[pid] = { id: pid, runs: [] })).runs.push(x); }
  const out = [];
  for (const P of Object.values(by)) {
    const rec = await getJ(env, "camp_parent_" + P.id, null);
    P.runs.sort((a, b) => String(a.c.created || "").localeCompare(String(b.c.created || "")));
    P.title = (rec && rec.title) || (P.runs.length === 1 ? P.runs[0].c.name || P.runs[0].c.id : defaultParentTitle(P.runs[0].c));
    P.activity = Math.max(0, ...P.runs.map((r) => runActivity(r.c, r.S)));
    P.sent = P.runs.reduce((a, r) => a + runSent(r.S), 0);
    out.push(P);
  }
  return out.sort((a, b) => b.activity - a.activity);
}
// The default parent: the one with the most recent sending activity; a parent with nothing sent only when no other exists.
export function pickParent(parents, wantId) {
  if (wantId) { const p = parents.find((P) => P.id === wantId || P.runs.some((r) => r.c.id === wantId)); if (p) return p; }
  return parents.find((P) => P.activity > 0) || parents[0] || null;
}

// Per person, across every run of the parent: furthest status wins (Replied > Read > Delivered > Sent; Failed only if nothing got through).
const RANK = { failed: 0, sent: 1, delivered: 2, read: 3, replied: 4 };
export async function personRollup(env, runs) {
  const per = {}; let refused = 0;
  for (const { c, S } of runs) {
    const ws = await getJ(env, "camp_msgs_" + c.id, []);
    refused += Math.max(0, ((S && S.sent) || 0) - ws.length);   // refused at send time: no message id, no person to attach it to
    for (const w of ws) {
      const m = await getJ(env, "camp_msg_" + w, null); if (!m || !m.d) continue;
      const s2 = await getJ(env, "camp_state_" + c.id + "_" + m.d, null);
      const st = (s2 && s2.path && s2.path.length) || m.replied || m.tap ? "replied" : m.read ? "read" : m.delivered ? "delivered" : m.st === "failed" ? "failed" : "sent";
      const p = per[m.d], at = String((s2 && s2.at) || m.at || "");
      if (!p || RANK[st] > RANK[p.st] || (RANK[st] === RANK[p.st] && at > p.at)) per[m.d] = { d: m.d, st, at, cid: c.id, w, m, s2, optout: (p && p.optout) || !!m.optout };
      else if (m.optout) p.optout = true;
    }
  }
  const people = Object.values(per), n = (f) => people.filter(f).length;
  const tot = { people: people.length, sent: people.length, delivered: n((p) => RANK[p.st] >= 2), read: n((p) => RANK[p.st] >= 3), replied: n((p) => p.st === "replied"),
    failed: n((p) => p.st === "failed"), optouts: n((p) => p.optout), refused };
  return { tot, people: people.sort((a, b) => (a.at < b.at ? 1 : -1)) };
}

// Follow-up groups across runs: each person once, in the warmest group any run put them in.
const GRANK = { delivered: 1, opened: 2, started: 3, completed: 4 };
export async function followupGroupsMulti(env, cs, now, followupGroups) {
  const best = {}, opt = new Set(), nd = new Set(), removed = {};
  for (const c of cs) {
    const r = await followupGroups(env, c, now);
    for (const d of r.optoutD || []) opt.add(d);
    for (const d of r.notDeliveredD || []) nd.add(d);
    for (const g of Object.keys(r.groups)) for (const row of r.groups[g]) { row.cid = c.id; const b = best[row.d]; if (!b || GRANK[g] > GRANK[b.group] || (GRANK[g] === GRANK[b.group] && row.last_at > b.last_at)) best[row.d] = row; }
    for (const row of r.removed) { row.cid = c.id; removed[row.d] = row; }
  }
  const groups = { started: [], opened: [], delivered: [], completed: [] };
  for (const row of Object.values(best)) { if (opt.has(row.d) || removed[row.d]) continue; groups[row.group].push(row); }
  for (const g of Object.keys(groups)) groups[g].sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
  const inG = new Set(Object.values(groups).flat().map((r) => r.d));
  const rem = Object.values(removed).filter((r) => !inG.has(r.d) && !opt.has(r.d));
  let notDelivered = 0; for (const d of nd) if (!inG.has(d) && !opt.has(d) && !removed[d]) notDelivered++;
  const counts = { started: groups.started.length, opened: groups.opened.length, delivered: groups.delivered.length, completed: groups.completed.length, optout: opt.size, not_delivered: notDelivered, removed: rem.length };
  return { groups, counts, removed: rem };
}
export const _test = { RANK, DIG };
