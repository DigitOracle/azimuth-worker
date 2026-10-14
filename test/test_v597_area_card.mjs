// v597 - Momo Work "About the area": the Worker passes the place name to the engine's /area (same host and secret as /vet), never without the secret; the approved screen carries the row and its script parses.
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, x) => { if (c) pass++; else { fail++; console.log("FAIL", msg, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const mkEnv = (on) => ({ MEETINGS: KV, ...(on ? { ASK_ENGINE_URL: "https://engine.test/", ASK_SECRET: "s3cret" } : {}) });
const deps = { isNaj: () => true, model: "m", page: (k, rk, b) => b, claudeJSON: async () => null };
const req = (path, body, env) => m.workRoute(new Request("https://w" + path + "?key=K", body ? { method: "POST", body: JSON.stringify(body) } : {}), env, new URL("https://w" + path + "?key=K"), deps);
const calls = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { calls.push({ u: String(u), h: o && o.headers, b: o && o.body }); const b = JSON.parse(o.body); return { json: async () => (b.list ? { status: "ok", districts: [{ name: "Business Bay" }] } : b.name === "JLT" ? { status: "ambiguous", candidates: [{ name: "Jumeirah Lake Towers", level: "district" }, { name: "JLT / Al Thanyah 5", level: "community" }] } : { status: "ok", matched: { level: "district", name: "Business Bay" }, items: [{ topic: "getting_around", label: "Getting around", summary: "About 14 minutes to DIFC.", sources: ["Google Routes"], as_of: "2026-10-14" }], attribution: "Includes Google Maps Platform data." }) }; };
const a1 = await (await req("/momo/work/api", { action: "area", name: "Business Bay" }, mkEnv(true))).json();
ok(a1.status === "ok" && a1.items.length === 1 && calls[0].u === "https://engine.test/area" && calls[0].h["X-Ask-Secret"] === "s3cret" && JSON.parse(calls[0].b).name === "Business Bay", "the place name goes to the engine's /area with the secret", calls[0]);
const a2 = await (await req("/momo/work/api", { action: "area", name: "JLT" }, mkEnv(true))).json();
ok(a2.status === "ambiguous" && a2.candidates.length === 2, "an ambiguous name returns candidates and picks none");
const a3 = await (await req("/momo/work/api", { action: "area", list: true }, mkEnv(true))).json();
ok(a3.districts.length === 1 && JSON.parse(calls[2].b).list === true, "the district list comes through for a picker");
const a4 = await req("/momo/work/api", { action: "area", name: "x" }, mkEnv(true));
ok(a4.status === 400, "a one-letter name is refused");
const a5 = await (await req("/momo/work/api", { action: "area", name: "Business Bay" }, mkEnv(false))).json();
ok(a5.status === "error" && a5.error === "not_connected" && calls.length === 3, "without the engine connection nothing is called");
globalThis.fetch = realFetch;
const js = await (await req("/momo/work.js", null, mkEnv(true))).text();
let parsed = false; try { new Function(js); parsed = true; } catch (e) { console.log(String(e)); }
ok(parsed && /function areaSheet/.test(js) && /About the area/.test(js) && /j\.attribution/.test(js) && /\$\("fra"\)/.test(js), "the screen script parses and carries the Area row, sheet and attribution line");
console.log("v597 area card: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
