// v646 - Momo SPEAKING card: Kendall's key only; per-person record speaking_rec_kendall; save/import/status; upcoming/past; printable brief. FAKE data only (public repo).
const worker = (await import("../src/index.js")).default;
const { cleanItem, splitItems, countdown, whenLabel, SPK_JS, MAX_ITEMS } = await import("../src/work_speaking.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const KEN = "ins_kendall_TESTKEY0123456789abcd", NAJ = "ins_najjuko_TESTKEY0123456789abcd", OTH = "ins_other_TESTKEY0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [KEN, NAJ, OTH].join(",") }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (p, k) => worker.fetch(new Request("https://w" + p + (p.includes("?") ? "&" : "?") + "key=" + k), env, ctx);
const post = (b, k) => worker.fetch(new Request("https://w/momo/work/speaking/api?key=" + k, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), env, ctx);
const cards = (h) => (h.match(/class=card/g) || []).length;
// gate
for (const p of ["/momo/work/speaking", "/momo/work/speaking/rec", "/momo/work/speaking/report"]) {
  ok((await get(p, KEN)).status === 200, "Kendall opens " + p);
  for (const k of [NAJ, OTH, "", "wrong"]) { const r = await get(p, k); ok(r.status === 404 || r.status === 401, "refused " + p + " for '" + k.slice(0, 12) + "'", r.status); }
}
for (const k of [NAJ, OTH, ""]) { const r = await post({ action: "save_item", item: { title: "x" } }, k); ok(r.status === 404 || r.status === 401, "POST refused for '" + k.slice(0, 12) + "'", r.status); }
// front door
const door = async (k) => (await (await get("/momo?door=1", k)).text());
let h = await door(KEN); ok(/<b>Speaking<\/b>/.test(h) && /\/momo\/work\/speaking\?key=/.test(h) && cards(h) === 4, "Speaking card on Kendall's front door (4 cards)", cards(h));
ok(/grid-template-columns:1fr 1fr;/.test(h), "2-column grid for Kendall");
ok(!/<b>Speaking<\/b>/.test(await door(NAJ)) && !/<b>Speaking<\/b>/.test(await door(OTH)), "no Speaking card for Najjuko or others");
// save + sanitise
let r = await (await post({ action: "save_item", item: { id: "fake-masterclass", title: "Fake Masterclass", organiser: "Example Academy", type: "masterclass", date: "2099-01-10", start: "10:00", end: "14:00", venue: "Example Hotel", format: "in-person", durationMins: 240, website: "example.com", status: "confirmed", objectives: ["One", "", "Two"], outline: [{ time: "0:00-0:15", mins: 15, segment: "Opening", covers: "x", interactive: "poll" }, { segment: "" }], materials: [{ label: "Deck", url: "javascript:alert(1)" }, { label: "Site", url: "https://example.com/a" }] } }, KEN)).json();
let it = r.rec.items[0]; ok(r.ok && it.website === "https://example.com" && it.objectives.length === 2 && it.outline.length === 1 && it.materials.length === 1 && it.durationMins === 240, "saved and sanitised", it);
ok(store.has("speaking_rec_kendall") && !store.has("speaking_rec_najjuko"), "stored under speaking_rec_kendall");
r = await (await post({ action: "save_item", item: { title: "Bad", type: "dance", format: "carrier pigeon", status: "maybe", date: "31/10/2026", start: "25:00" } }, KEN)).json();
it = r.rec.items[1]; ok(it.type === "talk" && it.format === "in-person" && it.status === "proposed" && it.date === "" && it.start === "", "enums and dates sanitised", it);
ok((await post({ action: "save_item", item: { title: "" } }, KEN)).status === 400, "untitled refused");
// status
r = await (await post({ action: "set_status", id: "fake-masterclass", status: "delivered" }, KEN)).json(); ok(r.rec.items[0].status === "delivered", "status set");
ok((await post({ action: "set_status", id: "fake-masterclass", status: "lost" }, KEN)).status === 400, "unknown status refused");
// import merge by id keeps fields not sent
r = await (await post({ action: "import_items", items: [{ id: "fake-masterclass", venue: "New Hall" }, { id: "fake-past", title: "Fake Past Talk", date: "2000-05-05", type: "talk", status: "delivered" }] }, KEN)).json();
ok(r.added === 1 && r.merged === 1 && r.rec.items[0].venue === "New Hall" && r.rec.items[0].organiser === "Example Academy" && r.rec.items[0].status === "delivered", "import merges by id and keeps the rest", r.rec.items[0]);
// upcoming / past split
const sp = splitItems([{ id: "a", date: "2026-10-31", start: "10:00", status: "confirmed" }, { id: "b", date: "2026-10-20", status: "delivered" }, { id: "c", date: "2026-12-03", endDate: "2026-12-04", status: "confirmed" }, { id: "d", date: "2026-11-01", status: "cancelled" }, { id: "e", date: "", status: "proposed" }], "2026-10-27");
ok(sp.up.map((x) => x.id).join() === "a,c,e" && sp.past.map((x) => x.id).join() === "d,b", "upcoming soonest first then date TBC, past newest first, cancelled in past", [sp.up.map((x) => x.id), sp.past.map((x) => x.id)]);
ok(splitItems([{ id: "m", date: "2026-12-03", endDate: "2026-12-04", status: "confirmed" }], "2026-12-04").up.length === 1, "a two-day event stays upcoming on its last day");
ok(countdown({ date: "2026-10-31" }, "2026-10-27") === "in 4 days" && countdown({ date: "2026-10-28" }, "2026-10-27") === "tomorrow" && countdown({ date: "2026-10-27" }, "2026-10-27") === "today", "countdown");
ok(whenLabel({ date: "2026-10-31", start: "10:00", end: "14:00" }) === "Sat 31 Oct 2026, 10:00-14:00 GST", "when label", whenLabel({ date: "2026-10-31", start: "10:00", end: "14:00" }));
// delete
r = await (await post({ action: "delete_item", id: "fake-past" }, KEN)).json(); ok(r.rec.items.every((x) => x.id !== "fake-past"), "deleted");
// report
h = await (await get("/momo/work/speaking/report?id=fake-masterclass", KEN)).text();
ok(/Fake Masterclass/.test(h) && /Session outline/.test(h) && /Opening/.test(h) && /window\.print\(\)/.test(h) && /#0A4F4A/.test(h) && /#C5A56A/.test(h) && /size:A4/.test(h), "one-engagement brief renders with outline, print, DigitAlchemy colours");
h = await (await get("/momo/work/speaking/report", KEN)).text(); ok(/Upcoming/.test(h) && /Past/.test(h) && /Fake Masterclass/.test(h), "full list report");
ok(/Not found/.test(await (await get("/momo/work/speaking/report?id=nope", KEN)).text()), "unknown id says not found");
ok(!/[\u{1F300}-\u{1FAFF}]/u.test(h), "no emoji in report");
// page
h = await (await get("/momo/work/speaking", KEN)).text(); ok(/<h1>Speaking<\/h1>/.test(h) && /id=sup/.test(h) && /id=spast/.test(h) && /id=sform/.test(h), "page has upcoming, past and form");
let parses = true; try { new Function(SPK_JS); } catch (e) { parses = false; } ok(parses, "page script parses");
ok(cleanItem({ title: "t", type: "judge" }).type === "judge" && whenLabel({ date: "" }) === "Date TBC" && splitItems([{ id: "x", date: "", status: "delivered" }], "2026-10-27").past.length === 1, "judge type, Date TBC label, undated delivered stays in past");
ok(MAX_ITEMS === 300 && cleanItem({ title: "t" }).id, "limits and ids");
console.log("v646 speaking: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
