// v654 - the Momo bridge: header key only, each key opens its own person's data, idempotent POSTs, rate limit. FAKE keys and FAKE data only (the worker repo is public).
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NB = "brg_najjuko_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE01", KB = "brg_kendall_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE02", NAJ_LINK = "ins_najjuko_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ_LINK, MOMO_BRIDGE_KEYS: "najjuko:" + NB + ", kendall:" + KB + ",nobody:short" }, ctx = { waitUntil() {}, passThroughOnException() {} };
const B = "https://w/momo/bridge/v1/";
const call = async (path, { key, method = "GET", body, idem, headers = {} } = {}) => {
  const h = Object.assign({}, headers); if (key) h.Authorization = "Bearer " + key; if (idem) h["Idempotency-Key"] = idem; if (body) h["Content-Type"] = "application/json";
  const r = await worker.fetch(new Request(B + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  let j = null; try { j = await r.clone().json(); } catch (e) {} return { s: r.status, j, r };
};
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
store.set("work_naj_" + today + "_abc123", JSON.stringify({ id: "abc123", date: today, created: today + "T08:00:00Z", title: "Example kickoff", type: "Meeting", summary: "Example.", people: [], kpis: [2], scope: [], works: ["Example Campaign"], effort: "1-2 hours", text: "Notes." }));
store.set("recw_" + today.replace(/-/g, "") + "aaaaa", JSON.stringify({ id: today.replace(/-/g, "") + "aaaaa", date: today, started: today + "T09:00:00Z", title: "Example huddle", status: "filed", notes: { summary: "Example summary" } }));
store.set("work_naj_plan_p1", JSON.stringify({ id: "p1", title: "Example post", start: today, end: today, pillar: "market", format: "post", state: "Planned" }));
store.set("work_naj_planseed", "1");
store.set("annemarie_rec", JSON.stringify({ title: "Example client", leads: [] }));
store.set("speaking_rec_kendall", JSON.stringify({ items: [] }));
const MID = today.replace(/-/g, "") + "aaaaa";

// auth
ok((await call("whoami")).s === 401, "no key: 401");
ok((await call("whoami", { key: "brg_najjuko_wrongwrongwrongwrongwrongwrong99" })).s === 401, "wrong key: 401");
ok((await call("whoami", { key: "short" })).s === 401, "short key entry is ignored");
const u = await worker.fetch(new Request(B + "whoami?key=" + NB), env, ctx); ok(u.status === 400, "a key in the URL is refused", u.status);
const u2 = await worker.fetch(new Request(B + "whoami?key=" + NB, { headers: { Authorization: "Bearer " + NB } }), env, ctx); ok(u2.status === 400, "key in URL refused even with the header");
ok((await call("entries", { headers: { Authorization: "Basic " + NB } })).s === 401, "not Bearer: 401");
ok((await worker.fetch(new Request(B + "entries?key=" + NAJ_LINK), env, ctx)).status === 400, "her LINK key in the URL does not open the bridge");
ok((await call("entries", { key: NAJ_LINK })).s === 401, "her LINK key as a bearer does not open the bridge");
let w = await call("whoami", { key: NB }); ok(w.s === 200 && w.j.ok && w.j.data.person === "najjuko" && w.j.data.routes.length >= 12, "najjuko whoami", w.j);
w = await call("whoami", { key: KB }); ok(w.s === 200 && w.j.data.person === "kendall", "kendall whoami");

// reads
let r = await call("entries", { key: NB }); ok(r.s === 200 && r.j.data.entries.length === 1 && r.j.data.entries[0].ref === today + "_abc123", "entries", r.j);
ok((await call("entries?from=2026-01-01&to=2026-12-31", { key: NB })).s === 400, "span over 92 days refused");
r = await call("entry?id=" + today + "_abc123", { key: NB }); ok(r.s === 200 && r.j.data.title === "Example kickoff", "entry");
ok((await call("entry?id=nope", { key: NB })).s === 400, "bad entry id");
ok((await call("entry?id=2026-01-01_zzz", { key: NB })).s === 404, "missing entry 404");
r = await call("tasks", { key: NB }); ok(r.s === 200 && r.j.data.tasks.some((t) => t.name === "Example Campaign"), "tasks", r.j);
r = await call("plan", { key: NB }); ok(r.s === 200 && r.j.data.items.some((i) => i.id === "p1"), "plan", r.j);
r = await call("meetings", { key: NB }); ok(r.s === 200 && r.j.data.meetings.length === 1 && r.j.data.meetings[0].has_notes, "meetings", r.j);
r = await call("meeting?id=" + MID, { key: NB }); ok(r.s === 200 && r.j.data.notes.summary === "Example summary", "meeting");
r = await call("anne", { key: NB }); ok(r.s === 200 && r.j.ok, "anne", r.j);
r = await call("pdf-links?type=entry&id=" + today + "_abc123", { key: NB }); ok(r.s === 200 && /item\/entry\?id=/.test(r.j.data.links.item_pdf) && !/key=ins_|brg_/.test(JSON.stringify(r.j)), "pdf-links has no key", r.j);
ok((await call("pdf-links?type=x&id=1", { key: NB })).s === 400, "pdf-links bad type");

// person separation
for (const p of ["entries", "tasks", "plan", "meetings", "anne"]) ok((await call(p, { key: KB })).s === 403, "kendall key cannot read her " + p);
for (const p of ["jobs", "speaking", "ggu"]) ok((await call(p, { key: NB })).s === 403, "her key cannot read kendall " + p);
ok((await call("speaking", { key: KB })).s === 200, "kendall speaking");
ok((await call("entry", { key: KB, method: "POST", body: { entry: { title: "x" } }, idem: "kendall-idem-1" })).s === 403, "kendall cannot write her entries");
ok((await call("nothing", { key: NB })).s === 404, "unknown route 404");
ok((await call("entries", { key: NB, method: "POST", body: {}, idem: "abcdefgh1" })).s === 404, "GET route by POST is 404");

// writes
ok((await call("entry", { key: NB, method: "POST", body: { entry: { title: "x" } } })).s === 400, "POST without Idempotency-Key refused");
const before = [...store.keys()].filter((k) => /^work_naj_\d{4}/.test(k)).length;
r = await call("entry", { key: NB, method: "POST", body: { date: today, entry: { title: "Example from the bridge", type: "Meeting", effort: "nonsense", people: ["Not A Real Person"] }, text: "Logged by her agent." }, idem: "entry-create-0001" });
ok(r.s === 200 && r.j.data.title === "Example from the bridge" && r.j.data.effort === "1-2 hours" && r.j.data.people.length === 0 && r.j.data.via === "bridge", "entry create, sanitised like the app", r.j);
const again = await call("entry", { key: NB, method: "POST", body: { date: today, entry: { title: "Example from the bridge" } }, idem: "entry-create-0001" });
ok(again.s === 200 && again.r.headers.get("Idempotent-Replay") === "true" && again.j.data.id === r.j.data.id, "retry replays, no second write");
ok([...store.keys()].filter((k) => /^work_naj_\d{4}/.test(k)).length === before + 1, "exactly one entry written");
r = await call("task", { key: NB, method: "POST", body: { name: "Example Campaign", percent: 60, status: "In progress" }, idem: "task-0001-aaaa" });
ok(r.s === 200 && r.j.data.percent === 60, "task progress", r.j);
r = await call("plan-item", { key: NB, method: "POST", body: { item: { title: "Example reel", start: today, format: "reel", state: "Bogus" } }, idem: "plan-0001-aaaa" });
ok(r.s === 200 && r.j.data.format === "reel" && r.j.data.state === "Planned" && store.has("work_naj_plan_" + r.j.data.id), "plan item saved via cleanItem", r.j);
ok((await call("plan-item", { key: NB, method: "POST", body: { item: {} }, idem: "plan-0002-aaaa" })).s === 400, "plan item needs a title");
r = await call("note", { key: NB, method: "POST", body: { type: "meeting", id: MID, text: "Follow up with the example developer." }, idem: "note-0001-aaaa" });
ok(r.s === 200 && r.j.data.added_notes.length === 1, "note on a meeting", r.j);
r = await call("note", { key: NB, method: "POST", body: { type: "entry", id: today + "_abc123", text: "Added later." }, idem: "note-0002-aaaa" });
ok(r.s === 200 && /Added later\./.test(r.j.data.text), "note on an entry");
ok((await call("note", { key: NB, method: "POST", body: { type: "entry", id: "2026-01-01_zz", text: "x" }, idem: "note-0003-aaaa" })).s === 404, "note on a missing entry 404");

// log: no payload content
const logs = [...store.keys()].filter((k) => k.startsWith("brg_log_najjuko_")).map((k) => store.get(k));
ok(logs.length > 10 && logs.every((v) => { const o = JSON.parse(v); return Object.keys(o).sort().join() === "at,person,route,status"; }) && !logs.some((v) => /Example|Logged by/.test(v)), "call log holds person, route, status, time only");

// rate limit
let got429 = false; for (let i = 0; i < 125 && !got429; i++) got429 = (await call("whoami", { key: KB })).s === 429;
ok(got429, "rate limit answers 429");
ok((await call("whoami", { key: NB })).s !== 429, "the limit is per key");

// the existing Momo POST guard is untouched for normal addresses
ok((await worker.fetch(new Request("https://w/momo/work/api", { method: "POST", body: "{}" }), env, ctx)).status !== 200, "Momo Work API still needs her link key");
console.log(`v654 bridge: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
