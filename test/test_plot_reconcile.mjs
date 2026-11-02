// DATA CHECKS (src/plot_reconcile.js) through the real worker entry with an in-memory KV.
import worker from "../src/index.js";
import { PR_KINDS, PR_REASONS, prNeutral } from "../src/plot_reconcile.js";
const store = new Map();
const KV = { async get(k){return store.has(k)?store.get(k):null;}, async put(k,v){store.set(k,String(v));}, async delete(k){store.delete(k);}, async list(o){const p=(o&&o.prefix)||"";return {keys:[...store.keys()].filter(k=>k.startsWith(p)).map(name=>({name}))};} };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: "RK", CLIENT_KEY: "CLIENTKEY123456", INGEST_TOKEN: "ING", MAILBOXES: "" };
const get = (p) => worker.fetch(new Request("https://x" + p), env, { waitUntil(){} });
let pass = 0, fail = 0; const ok = (n, c) => { if (c) { pass++; console.log("  ok -", n); } else { fail++; console.log("  FAIL -", n); } };

// 0. empty KV: the page says the data is not loaded yet (no dead control, no crash)
let r = await get("/data_checks?key=RK"); let t = await r.text();
ok("page 200 before data", r.status === 200 && t.startsWith("<!doctype html>"));
ok("page carries the boot block with sum:null", t.includes('"sum":null'));

// fixture shaped exactly like build_plot_reconcile.py output (rows copied from the 2 Nov 2026 build)
const sum = { as_of: { dld: "2026-10-26", dm_permits: "2026-08-31", dm_summary: "2026-08-31", register: "2026-11-01" }, built_at: "2026-11-02T02:00:35Z", rule: "derived", cap: 1500,
  types: { bld_no_permit: { n: 3, d: { alyelayiss1: 2, naif: 1 } }, permit_no_plot: { n: 1, d: { unknown: 1 } }, floors_differ: { n: 1, d: { naif: 1 } } },
  names: { alyelayiss1: "Al Yelayiss 1", naif: "Naif", unknown: null } };
const A = { id: "naj:plot:9210115", pk: "9210115", d: "alyelayiss1", n: "Cherrywoods", a: { buildings: 2, registered: "2019-07-24", floors: 2, type: "Villa", project: "Cherrywoods" }, b: { permits: 0 }, w: ["older", "key", "renamed"] };
const N = { id: null, pk: "1110103", d: "unknown", n: null, a: { on_register: false }, b: { permits: 44, latest_permit: "142348-1-5", permit_date: "2007-07-23", permit_type: "Normal Decor Permit", building_type: "Multi Storey" }, w: ["merged", "timing", "key"] };
store.set("pr_sum", JSON.stringify(sum));
store.set("pr_l_bld_no_permit_all", JSON.stringify([A, { ...A, id: "naj:plot:9210116", pk: "9210116", n: "Cherrywoods, \"B\"" }]));
store.set("pr_l_bld_no_permit_alyelayiss1", JSON.stringify([A]));
store.set("pr_l_permit_no_plot_all", JSON.stringify([N]));

// 1. summary page
r = await get("/data_checks?key=RK"); t = await r.text();
ok("owner page 200", r.status === 200);
ok("summary data embedded", t.includes('"bld_no_permit":{"n":3'));
ok("district shown by its community label (DAMAC Islands)", t.includes("DAMAC Islands (Al Yelayiss 1)"));
ok("research-flag wording present", t.includes("research flag"));
ok("no accusatory words anywhere on the page", prNeutral(t.replace(/BAD_WORDS[^\n]*/g, "")));
ok("every kind title and reason is neutral", Object.values(PR_KINDS).every(k => prNeutral(k.title + k.line)) && Object.values(PR_REASONS).every(prNeutral));
ok("no emoji characters", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t));
ok("no bare acronyms DLD / DM / RERA in the visible copy", !/>[^<]*\b(DLD|RERA)\b[^<]*</.test(t) && !/\bDM\b/.test(t.split("<script>window.__PR")[0]));
ok("Najma nav present on More", t.includes("nnav") || t.includes("/more"));
ok("theme follows naj_thm", t.includes("naj_thm") && t.includes("html[data-theme=light]"));
// page + script together: every id the script reads by getElementById must be in the markup or written by the script itself
const js = t.slice(t.indexOf("(function(){\nvar B=window.__PR"), t.lastIndexOf("})();") + 5);
ok("page script found", js.length > 1000);
let parsed = true; try { new Function(js); } catch (e) { parsed = false; console.log(e); }
ok("page script parses", parsed);
const ids = [...new Set([...js.matchAll(/getElementById\("([a-z]+)"\)/g)].map(m => m[1]))];
const haveId = (id) => t.includes(" id=" + id + ">") || t.includes(" id=" + id + " ") || t.includes("id=" + id + "\\") || js.includes("id=" + id + ">") || js.includes("id=" + id + " ") || js.includes('id="' + id);
ok("every id the script reads exists (" + ids.join(",") + ")", ids.length > 5 && ids.every(haveId));

// 2. list JSON
r = await get("/data_checks/list?key=RK&t=bld_no_permit&d=all"); let j = await r.json();
ok("list all: total from the summary, items from KV", j.ok && j.total === 3 && j.items.length === 2);
r = await get("/data_checks/list?key=RK&t=bld_no_permit&d=alyelayiss1"); j = await r.json();
ok("list district: its own key and count", j.total === 2 && j.items[0].id === "naj:plot:9210115");
r = await get("/data_checks/list?key=RK&t=floors_differ&d=naif"); j = await r.json();
ok("list with no KV key -> empty, not an error", j.ok && j.items.length === 0 && j.total === 1);
ok("unknown kind -> 400", (await get("/data_checks/list?key=RK&t=nope&d=all")).status === 400);
ok("bad district slug -> 400", (await get("/data_checks/list?key=RK&t=bld_no_permit&d=../x")).status === 400);

// 3. CSV export with sources and dates
r = await get("/data_checks/csv?key=RK&t=bld_no_permit&d=all"); t = await r.text();
ok("csv 200 + attachment", r.status === 200 && /attachment; filename="najma_data_checks_bld_no_permit_all.csv"/.test(r.headers.get("Content-Disposition") || ""));
const lines = t.replace(/^﻿/, "").trim().split("\n");
ok("csv: note line + header + 2 rows", lines.length === 4 && lines[0].startsWith("# Research flags"));
ok("csv: header names both sides", lines[1].includes("land_department_buildings") && lines[1].includes("municipality_permits") && lines[1].includes("sources_and_dates"));
ok("csv: row carries the plot id, reasons and source dates", lines[2].includes("naj:plot:9210115") && lines[2].includes("Older buildings") && lines[2].includes("Building permits (Dubai Municipality) 2026-08-31"));
ok("csv: quotes escaped", t.includes('"Cherrywoods, ""B"""'));
r = await get("/data_checks/csv?key=RK&t=permit_no_plot&d=all"); t = await r.text();
ok("csv: plot not on register has empty plot id", t.split("\n")[2].startsWith("Permit for a plot not on today’s register,,1110103"));

// 4. guards: owner only (research use), 404 for anyone else
ok("client key -> refused (401 at the client gate or 404 here)", [401,404].includes((await get("/data_checks?key=CLIENTKEY123456")).status));
ok("wrong key -> 404", (await get("/data_checks?key=BAD")).status === 404);
ok("no key -> 404 on csv", (await get("/data_checks/csv?t=bld_no_permit&d=all")).status === 404);

// 6. a kind from v_plot_exceptions (Trust workstream): own side titles, own CSV prefixes, group heading on the page
sum.types.project_level_only = { n: 1, d: { naif: 1 } };
store.set("pr_sum", JSON.stringify(sum));
store.set("pr_l_project_level_only_naif", JSON.stringify([{ id: "naj:plot:118-104", pk: "1180104", d: "naif", n: "Naif", a: { register_project: "Naif", land_type: "Commercial", area_sqm: 420 }, b: { detail: "Only project-level records reach this plot.", source: "lk_dld_transactions", source_key: "P-1" }, w: ["projonly", "key"] }]));
r = await get("/data_checks?key=RK"); t = await r.text();
ok("page carries both group headings and the view kind", t.includes("HOW WELL THE RECORDS ARE TIED TO THE PLOT") && t.includes("Linked by project only, not by plot"));
r = await get("/data_checks/csv?key=RK&t=project_level_only&d=naif"); t = await r.text();
ok("csv: view kind uses LAND REGISTER / OTHER RECORD prefixes", t.includes("land_register_register_project") && t.includes("other_record_detail") && t.includes("Only project-level records reach this plot."));

// 5. the More page lists the room for the owner only
r = await get("/more?key=RK"); t = await r.text();
ok("More (owner) links DATA CHECKS", t.includes('href="/data_checks?key=RK"') && t.includes("DATA CHECKS"));
r = await get("/more?key=CLIENTKEY123456"); t = await r.text();
ok("More (client) has no DATA CHECKS", !t.includes("/data_checks"));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
