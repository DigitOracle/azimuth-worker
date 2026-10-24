// v624 - Plan > Team: the model from the sheet, the routes, the report page, and the plan page wiring (SYNTHETIC data only; Kendall 24 Oct 2026)
import { fetcher } from "./fixtures_v624_team.mjs";
const T = await import("../src/work_team.js"); const W = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL", msg); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV }; const NOW = Date.UTC(2026, 9, 24, 12);
const calls = []; const deps = { isNaj: (e, u) => u.searchParams.get("key") === "K", page: (k, r, b) => b, fetchText: fetcher(NOW, calls), now: () => NOW };
const get = async (path, d) => { const u = new URL("https://w" + path); return W.workRoute(new Request(u), env, u, d || deps); };

ok(T.parseCsv('a,"b,c",d\n"x ""q""",2').length === 2 && T.parseCsv('a,"b,c",d\n"x ""q""",2')[0][1] === "b,c", "csv quotes and commas");
ok(T.readDesign([["Wrong"]]).warn, "a changed Graphic Design header is noticed, not guessed");
ok(T.readMotion([["Task", "x", "Status", "Nope"]]).warn, "a changed Motion header is noticed");

let r = await get("/momo/work/team/api?key=K"); let j = await r.json();
ok(r.status === 200 && j.error === "not_connected", "no sheet id: says not connected");
ok(calls.length === 0, "nothing is fetched without a sheet id");
r = await get("/momo/work/team/report?key=K"); ok(r.status === 404, "report 404 when not connected");

store.set("work_naj_cfg_sheet", "SYNTHETIC_SHEET_ID");
r = await get("/momo/work/team/api?key=K"); j = await r.json(); const m = j.model;
ok(!!m && calls.length === 2 && calls.every((u) => u.includes("SYNTHETIC_SHEET_ID") && u.includes("gviz")), "reads the two main tabs by name, read only (GET gviz); the daily tab is skipped quietly while its KV name is unset");
ok(!/\bLiam\b/.test(T.TEAM_JS + String(T.loadModel)), "no person's name is hard-coded in the public file");
ok(m.needs.length === 2 && m.needs.some((n) => n.task === "Epsilon invite") && m.needs.some((n) => n.task === "Video three"), "open tasks with nobody named are listed; named, done and cancelled are not");
const dana = m.people["Dana Test"]; ok(dana && dana.open.length === 2, "designer open count");
const eli = m.people["Eli Sample"]; ok(eli && eli.open.length === 0 && eli.recent === 1, "recent = done within 10 days; the 20-day-old one is not; cancelled ignored");
ok(m.people["Fay Mock"] && m.people["Fay Mock"].open.length === 1 && m.people["Fay Mock"].recent === 1, "editor counts, release date used for recent");
ok(m.groups.map((g) => g.role).join("|") === "Graphic design|Video|Photography" && m.groups[2].people.length === 0, "three groups, Photography empty");
ok(m.groups[0].people[0].name === "Dana Test", "most open work first");
ok(m.groups[1].people.some((p) => p.name === "Fay Mock"), "video group lists the editor");
store.delete("work_naj_team_model"); store.set("work_naj_cfg_daily_tab", "Zed Daily task"); calls.length = 0;
j = await (await get("/momo/work/team/api?key=K")).json();
ok(calls.length === 3 && calls.some((u) => u.includes("Zed%20Daily%20task")), "with the daily tab named in KV it is read as the third tab");
ok(j.model.people["Zed"] && j.model.people["Zed"].notes.length === 1 && j.model.groups[1].people.some((p) => p.name === "Zed"), "the daily list becomes that person's notes under Video");
const before = calls.length; await get("/momo/work/team/api?key=K"); ok(calls.length === before, "fresh copy is served from KV, no second fetch");
const later = { ...deps, now: () => NOW + 5 * 3600e3, fetchText: async () => { throw new Error("down"); } };
j = await (await get("/momo/work/team/api?key=K", later)).json(); ok(j.model && j.stale, "sheet down: last copy with a stale note");
store.delete("work_naj_team_model"); const html = { ...deps, fetchText: async () => "<!doctype html><html>sign in" };
j = await (await get("/momo/work/team/api?key=K", html)).json(); ok(j.error === "unreachable", "html answer (no longer shared) is an error, not data");
r = await get("/momo/work/team/api?key=bad"); ok(r.status === 404, "wrong key sees nothing");
store.delete("work_naj_team_model");
r = await get("/momo/work/team/report?key=K"); const h = await r.text();
ok(r.status === 200 && h.includes("Tasks with nobody named") && h.includes("Epsilon invite") && h.includes("Video three"), "report lists the tasks");
ok(h.includes("Back</a>") && h.includes("Share / Save as PDF") && h.includes("navigator.share") && h.includes("@media print"), "report has Back, Share, Save as PDF, print sheet");
ok(!h.includes("SYNTHETIC_SHEET_ID") && !h.includes("docs.google.com"), "the sheet id never reaches a page");
ok(!/var T=[^;]*<\/script>/.test(h), "report text cannot close the script tag");
ok(calls.every((u) => !/\b(edit|update|append)\b/i.test(u)), "no write url is ever used");

const u = new URL("https://w/momo/work/plan?key=K"); const pg = await (await W.workRoute(new Request(u), env, u, deps)).text();
ok(pg.includes("id=ttm>Team</button>") && pg.includes("id=pact") && pg.includes("function drawTeam"), "Team tab, action row id and drawTeam are in the plan page");
ok(/grid-template-columns:1fr 1fr 1fr 1fr"><button type=button id=tcal/.test(pg), "four tabs in one row");
const js = pg.match(/<script>([\s\S]*)<\/script>/)[1]; let syntax = true; try { new Function(js); } catch (e) { syntax = false; console.log(e.message); } ok(syntax, "the plan script (plan + team) parses");
ok(!/`|\$\{/.test(T.TEAM_JS), "team client code has no backtick or dollar-brace");
console.log("v624 team: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
