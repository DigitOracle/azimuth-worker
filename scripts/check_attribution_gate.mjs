// v373 - QUALITY GATE for the Developers-by-area index. Offline: reads a built index JSON (the file you are about to publish, or a copy of the live one), reads the threshold from
// scripts/attribution_gate.json, re-asserts the fixtures, and writes an AUDIT-TRAIL CSV (one row per project). Exit 0 = pass, 1 = fail, 2 = bad input.
//   node scripts/check_attribution_gate.mjs <devmap_index.json> [--config scripts/attribution_gate.json] [--audit-csv <out.csv>] [--allow-missing-fixtures]
// Kendall, 7 Oct 2026: the Land Department register is the authority; a developer's own web site is a claim; the check must be a deterministic join, with humans only for exceptions.
//   FAILS when  1 the index carries no attribution evidence (no `bx`), or the share of projects that are not REGISTER_VERIFIED is above the configured threshold;
//               2 a fixture breaks: Vento Tower or The Pad verified under Beyond; Marina Vista (Emaar), Jumeirah Living Marina Gate (Select Group) or Ocean Heights (DAMAC) not verified;
//                 Imtiaz Symphony Tower / Wynwood Horizon not in Meydan Horizon; Cove Grand not in Dubai Land Residence Complex; Westwood By Imtiaz not in Al Furjan.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nk = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const VERIFIED = "REGISTER_VERIFIED";

// the fixtures (project-name key = the start of the name key; dev = developer id the index uses)
export const FIXTURES = {
  // v373b: ABSENT from the brand's lists entirely (any label, either window, by name or by register project number): the register names another company and only a name linked it
  absentFrom: [{ name: "vento tower", dev: "beyond", projects: [2776, 536844615], register: "ANAX Developments" }, { name: "the pad", dev: "beyond", projects: [1173], register: "Pad Properties Nine (Omniyat)" }],
  notVerifiedUnder: [{ name: "vento tower", dev: "beyond" }, { name: "the pad", dev: "beyond" }],
  verifiedUnder: [{ name: "marina vista", dev: "emaar" }, { name: "jumeirah living marina gate", dev: "select-group" }, { name: "ocean heights", dev: "damac" }],
  areaIs: [{ name: "imtiaz symphony tower", area: "Meydan Horizon" }, { name: "wynwood horizon", area: "Meydan Horizon" }, { name: "cove grand", area: "Dubai Land Residence Complex" }, { name: "westwood by imtiaz", area: "Al Furjan" }],
};

// every project of the index, with its evidence, for both windows. returns {rows, hasEvidence}
export function projectRows(index) {
  const rows = []; let hasEvidence = false;
  for (const slug of Object.keys(index.areas || {})) {
    const a = index.areas[slug];
    for (const k of Object.keys(a.devs || {})) {
      const d = a.devs[k];
      for (const [win, bk, xk] of [["all", "b", "bx"], ["l12", "b12", "b12x"]]) {
        const b = d[bk] || [], x = d[xk];
        if (Array.isArray(x) && x.length === b.length) hasEvidence = hasEvidence || x.length > 0;
        for (let i = 0; i < b.length; i++) {
          const ev = (Array.isArray(x) && x.length === b.length && x[i]) || null;
          rows.push({ window: win, slug, area_name: a.name || slug, dev_id: k, dev_name: k === "_" ? "Developer not recorded" : (d.n || (index.devs && index.devs[k] && index.devs[k].name) || k),
            project: b[i][2] || "", sales: b[i][0], p: ev ? ev.p : null, dn: ev ? ev.dn : "", di: ev ? ev.di : null, m: ev ? ev.m : "", e: ev ? ev.e : "NO_EVIDENCE", a: ev ? ev.a : "", as: ev ? ev.as : "", hasEv: !!ev });
        }
      }
    }
  }
  return { rows, hasEvidence };
}

export function runGate(index, cfg, opts) {
  const o = opts || {}, failures = [], now = (o.now || new Date()).toISOString();
  const out = { ok: true, failures, rows: [], share: null, counts: {}, total: 0 };
  if (!index || !index.areas) { out.ok = false; failures.push("the index has no areas"); return out; }
  const { rows, hasEvidence } = projectRows(index);
  out.rows = rows.map((r) => ({ ...r, ts: now }));
  if (!hasEvidence) { out.ok = false; failures.push("the index carries no attribution evidence (no bx lists): it was built without the v373 builder, so nothing in it can be called verified"); return out; }
  const named = rows.filter((r) => r.window === "all" && r.dev_id !== "_");
  out.total = named.length;
  for (const r of named) out.counts[r.e] = (out.counts[r.e] || 0) + 1;
  const bad = named.filter((r) => r.e !== VERIFIED).length;
  out.share = named.length ? bad / named.length : 1;
  const max = cfg && typeof cfg.max_not_verified_share === "number" ? cfg.max_not_verified_share : 0.22;
  if (!(out.share <= max)) { out.ok = false; failures.push("share not REGISTER_VERIFIED " + (100 * out.share).toFixed(1) + "% is above the limit " + (100 * max).toFixed(1) + "% (" + bad + " of " + named.length + " projects)"); }
  const need = !cfg || cfg.require_fixtures !== false;
  const find = (key, wins) => rows.filter((r) => (wins || ["all", "l12"]).includes(r.window) && (nk(r.project) + " ").startsWith(key + " "));
  for (const f of FIXTURES.absentFrom) for (const r of rows) if (r.dev_id === f.dev && ((nk(r.project) + " ").startsWith(f.name + " ") || (r.p != null && f.projects.includes(Number(r.p))))) { out.ok = false; failures.push("fixture: " + r.project + " is listed under " + f.dev + " (" + r.window + ", " + r.slug + ", " + r.e + "); the register names " + f.register + ", so it must be absent from " + f.dev + " entirely"); }
  for (const f of FIXTURES.notVerifiedUnder) for (const r of find(f.name)) if (r.dev_id === f.dev && r.e === VERIFIED) { out.ok = false; failures.push("fixture: " + r.project + " is REGISTER_VERIFIED under " + f.dev + " (" + r.window + ", " + r.slug + "); the register names " + (r.dn || "another company")); }
  for (const f of FIXTURES.verifiedUnder) {
    const hit = find(f.name, ["all"]); const ok = hit.some((r) => r.dev_id === f.dev && r.e === VERIFIED);
    if (!ok && (hit.length || need)) { out.ok = false; failures.push("fixture: " + f.name + (hit.length ? " is not REGISTER_VERIFIED under " + f.dev + " (found: " + hit.map((r) => r.dev_id + "/" + r.e).join(", ") + ")" : " is not in the index")); }
  }
  for (const f of FIXTURES.areaIs) {
    const hit = find(f.name, ["all"]).filter((r) => r.hasEv);
    if (!hit.length) { if (need) { out.ok = false; failures.push("fixture: " + f.name + " is not in the index (area " + f.area + " cannot be checked)"); } continue; }
    for (const r of hit) if (r.a !== f.area) { out.ok = false; failures.push("fixture: " + r.project + " is shown in " + JSON.stringify(r.a) + ", expected " + f.area); }
  }
  return out;
}

const csvq = (v) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function auditCsv(rows) {
  const head = ["timestamp", "window", "area_slug", "developer_shown", "developer_id_shown", "project", "sales", "register_project_number", "register_developer", "register_developer_id", "match_basis", "evidence_label", "area_shown", "area_source"];
  return "﻿" + head.join(",") + "\r\n" + rows.map((r) => [r.ts, r.window, r.slug, r.dev_name, r.dev_id, r.project, r.sales, r.p, r.dn, r.di, r.m, r.e, r.a, r.as].map(csvq).join(",")).join("\r\n") + "\r\n";
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = process.argv.slice(2), flags = new Set(args.filter((x) => x.startsWith("--allow")));
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const file = args.find((x) => !x.startsWith("--") && args[args.indexOf(x) - 1] !== "--config" && args[args.indexOf(x) - 1] !== "--audit-csv");
  if (!file || !fs.existsSync(file)) { console.error("usage: node scripts/check_attribution_gate.mjs <devmap_index.json> [--config file] [--audit-csv out.csv] [--allow-missing-fixtures]"); process.exit(2); }
  const cfgFile = val("--config") || path.join(path.dirname(fileURLToPath(import.meta.url)), "attribution_gate.json");
  const cfg = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
  if (flags.has("--allow-missing-fixtures")) cfg.require_fixtures = false;
  const res = runGate(JSON.parse(fs.readFileSync(file, "utf8")), cfg);
  const csvPath = val("--audit-csv") || file.replace(/\.json$/i, "") + ".attribution_audit.csv";
  fs.writeFileSync(csvPath, auditCsv(res.rows));
  console.log("projects (all-years, named developers):", res.total, "| labels:", JSON.stringify(res.counts), "| not verified:", res.share == null ? "n/a" : (100 * res.share).toFixed(1) + "%", "| limit", (100 * cfg.max_not_verified_share).toFixed(1) + "%");
  console.log("audit trail:", csvPath, "(" + res.rows.length + " rows)");
  if (res.ok) console.log("ATTRIBUTION GATE: PASS");
  else { for (const f of res.failures) console.log("  FAIL - " + f); console.log("ATTRIBUTION GATE: FAIL"); process.exit(1); }
}
