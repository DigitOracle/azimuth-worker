// v662 MOMO WORK PER PERSON (Kendall, 28 Oct 2026: "My Momo work is supposed to be the same ... all of the capabilities that Najjuko already
// has in her work ... The recorder, the transcript, the meetings, everything."). Work is opened by the person the signing key belongs to
// (index.js personOfKey: ins_najjuko_* -> najjuko, ins_kendall_* -> kendall). Najjuko's keys keep their exact legacy names (work_naj_*, recw_*,
// recs_*, reca_*, recj_*): her data is never migrated or renamed. Any other person gets PARALLEL keys through a key-rewriting view of the KV
// store, so every Work code path is shared and nothing can reach across: work_naj_X -> work_<person>_X and recw_X -> <person>_recw_X (a prefix
// none of hers starts with, so her listings never see his keys and his never see hers). A key outside the Work namespace is refused outright.
// THIS REPO IS PUBLIC: a person's labels, focus areas, people and running work live in their KV record work_cfg_<person>, never in code.
export const WORK_PEOPLE = ["najjuko", "kendall"];
const REC_PFX = ["recw_", "recs_", "reca_", "recj_"];

export function workKey(person, k) {
  k = String(k);
  if (person === "najjuko") return k;
  if (k.startsWith("work_naj_")) return "work_" + person + "_" + k.slice(9);
  for (const r of REC_PFX) if (k.startsWith(r)) return person + "_" + k;
  throw new Error("v662: key outside the Work namespace: " + k.slice(0, 40));
}
function backKey(person, k) {
  if (k.startsWith("work_" + person + "_")) return "work_naj_" + k.slice(("work_" + person + "_").length);
  if (k.startsWith(person + "_rec")) return k.slice(person.length + 1);
  return k;
}
// a KV binding that only ever touches one person's Work keys (for najjuko: the binding itself, unchanged)
export function personKV(kv, person) {
  if (person === "najjuko") return kv;
  return {
    get: (k, o) => kv.get(workKey(person, k), o),
    put: (k, v, o) => kv.put(workKey(person, k), v, o),
    delete: (k) => kv.delete(workKey(person, k)),
    list: async (o = {}) => { const r = await kv.list(Object.assign({}, o, { prefix: workKey(person, o.prefix || "work_naj_") })); return Object.assign({}, r, { keys: (r.keys || []).map((x) => Object.assign({}, x, { name: backKey(person, x.name) })) }); },
  };
}
export function workEnv(env, person) { return person === "najjuko" ? env : Object.assign({}, env, { MEETINGS: personKV(env.MEETINGS, person) }); }

// ---- a person's profile (labels, focus areas, people, running work). Najjuko's comes from the constants in work_log.js; anyone else's from KV.
const S = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
export const DEFAULT_CFG = {
  name: "", org: "DigitAlchemy", role: "Founder",
  start: "2026-10-01", review_due: "2026-12-31",
  kpis: [
    { id: 1, name: "Clients", good: "Client relationships moved forward; proposals and follow-ups done", ev: "Meetings, proposals, follow-ups" },
    { id: 2, name: "Engagements", good: "Live engagements delivered on time and to standard", ev: "Deliverables, milestones, sign-offs" },
    { id: 3, name: "Speaking", good: "Talks, panels and articles that build the profile", ev: "Invitations, talks given, articles" },
    { id: 4, name: "Product", good: "The product and platform moving forward", ev: "Releases, demos, decisions" },
    { id: 5, name: "Admin", good: "The company kept in order: finance, legal, filings, team", ev: "Filings, payments, contracts" },
  ],
  depts: ["Team", "Clients", "Partners", "External"],
  people: [],   // [name, role, dept] - filled in his own record
  works: [],    // running work and campaigns, by name - filled in his own record
};
export function cleanCfg(r, person) {
  r = r && typeof r === "object" ? r : {};
  const d = DEFAULT_CFG;
  const kpis = Array.isArray(r.kpis) && r.kpis.length ? r.kpis.slice(0, 12).map((k, i) => ({ id: Number.isInteger(k.id) ? k.id : i + 1, name: S(k.name, 60) || "Focus area " + (i + 1), good: S(k.good, 300), ev: S(k.ev, 200) })) : d.kpis;
  const depts = Array.isArray(r.depts) && r.depts.length ? r.depts.slice(0, 12).map((x) => S(x, 40)).filter(Boolean) : d.depts;
  const people = Array.isArray(r.people) ? r.people.slice(0, 300).filter((p) => Array.isArray(p) && S(p[0], 80)).map((p) => [S(p[0], 80), S(p[1], 120), depts.includes(p[2]) ? p[2] : "External"]) : [];
  const works = Array.isArray(r.works) ? r.works.slice(0, 200).map((w) => S(w, 100)).filter(Boolean) : [];
  const dOk = (v, f) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : f);
  const start = dOk(r.start, d.start);
  return { person, name: S(r.name, 80), org: S(r.org, 80) || d.org, role: S(r.role, 80) || d.role, start, review_due: dOk(r.review_due, d.review_due), kpis, depts, people, works,
    scope: kpis.map((k) => ({ id: "k" + k.id, area: k.name, name: k.name })) };
}
export const cfgKey = (person) => "work_cfg_" + person;
export async function readCfg(env, person) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(cfgKey(person))); } catch (e) {} return cleanCfg(r, person); }

// the AI prompts and the printed pages were written for her; for anyone else, her names and her company's name are swapped for theirs
export function swapPrompt(s, cfg, fixLine) {
  const nm = cfg.name || "the owner", first = nm.split(/\s+/)[0];
  let t = String(s); if (fixLine) t = t.split(fixLine).join("none listed");   // her colleagues' misheard names are hers, not anyone else's
  return t.replace(/Serah Najjuko Ganyana|Najjuko Ganyana/g, nm).replace(/Najjuko/g, first).replace(/FN Realty/g, cfg.org)
    .replace(/a boutique real-estate advisory in Business Bay, Dubai|a Dubai off-plan real estate advisory|a Dubai real-estate brokerage/g, "the company")
    .replace(/Strategic Lead( - Marketing, PR & Business Development)?/g, cfg.role);
}
const BLANK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
// template wording on her pages and scripts, swapped on the way out for anyone else
export function swapPage(s, cfg, marks) {
  let t = String(s);
  for (const m of marks || []) if (m && m.length > 40) t = t.split(m).join(m.startsWith("data:") ? BLANK_PNG : "");
  const nm = cfg.name || "", first = nm.split(/\s+/)[0];
  return t.replace(/FN Realty PDF/g, "PDF").replace(/<title>FN /g, "<title>").replace(/alt="FN Realty"|alt="FN"/g, 'alt=""')
    .replace(/Serah Najjuko Ganyana · Strategic Lead[^<]*/g, (nm ? nm + " · " : "") + cfg.role + " · " + cfg.org)
    .replace(/Prepared by Serah Najjuko Ganyana for FN Realty\.[^<]*/g, "Prepared" + (nm ? " by " + nm : "") + " for " + cfg.org + ".")
    .replace(/Serah Najjuko Ganyana|Najjuko Ganyana/g, nm).replace(/Najjuko alone/g, "Alone").replace(/Najjuko\\'s|Najjuko's/g, first ? first + "'s" : "my").replace(/Najjuko/g, first || "me")
    .replace(/FN Realty/g, cfg.org).replace(/FN's/g, cfg.org + "'s")
    .replace(/since 2 Oct 2026/g, "since " + cfg.start).replace(/[Ss]ince 2 Oct/g, (m) => m[0] + "ince " + cfg.start);
}
