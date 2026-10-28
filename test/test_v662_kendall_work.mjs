// v662 - Momo Work per person: the owner's key opens HIS OWN Work (same capabilities as hers) on parallel keys; her keys keep their exact legacy
// names; neither person can read or write the other's log, tasks, plan, meetings, recordings, transcripts, minutes, PDFs or bridge data.
// FAKE keys, FAKE names and FAKE data only (the worker repo is public).
const worker = (await import("../src/index.js")).default;
const W = await import("../src/work_log.js");
const P = await import("../src/work_person.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k, t) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd", OTHER = "ins_someone_TESTKEY0123456789abcd";
const NB = "brg_najjuko_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE01", KB = "brg_kendall_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE02";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN, OTHER].join(","), MOMO_BRIDGE_KEYS: "najjuko:" + NB + ",kendall:" + KB,
  AI: { run: async () => ({ text: "Good morning everyone. We agreed the example plan and the example budget for next week, and Example Person will send the draft." }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const U = (path, key) => "https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key);
const get = (path, key) => worker.fetch(new Request(U(path, key)), env, ctx);
const post = (path, key, body) => worker.fetch(new Request(U(path, key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, ctx);

// direct route with a fake model, for the AI-written parts (notes, minutes, entries from a recording)
const sysSeen = [];
const deps = { isNaj: (e, u) => u.searchParams.get("key") === NAJ, person: (e, u) => ({ [NAJ]: "najjuko", [KEN]: "kendall" })[u.searchParams.get("key")] || "", model: "m",
  page: (k, rk, b) => "<html>" + b + "</html>",
  claudeJSON: async (e, sys, user, schema) => {
    sysSeen.push(sys);
    const pr = schema && schema.properties ? schema.properties : {};
    if (pr.decisions && pr.topics) return { summary: "Example summary of the meeting.", topics: ["Example topic"], decisions: ["Example decision"], people: [], actions: [{ what: "Send the example draft", owner: "", due: "" }] };
    if (pr.purpose || pr.discussion || pr.open_questions) return { title: "Example minutes", purpose: "Review the example plan.", decisions: [{ headline: "Example decision", detail: "Agreed." }], discussion: [{ heading: "Example topic", bullets: ["Point"] }], actions: [{ action: "Send the example draft", owner: "", due: "2026-11-02", due_stated: true }], open_questions: [] };
    if (pr.notes) return { notes: "Condensed." };
    if (pr.entries) return { entries: [{ title: "Example client meeting", type: "Meeting", summary: "Met an example client.", people: [], kpis: [1], scope: ["k1"], works: ["Example engagement"], deliverables: [], evidence: [], next: [], questions: [], time_of_day: "Morning", alone: false, in_scope: true, external: [], progress: [{ work: "Example engagement", status: "In progress", percent: 30, owners: [] }] }] };
    return null; } };
const call = (path, key, body) => { const u = new URL(U(path, key)); return W.workRoute(new Request(u, body ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}), env, u, deps); };

const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), compact = today.replace(/-/g, "");
// her data, on her legacy keys
store.set("work_naj_" + today + "_her001", JSON.stringify({ id: "her001", date: today, created: today + "T08:00:00Z", title: "HerSecretEntry", type: "Meeting", summary: "HerSecretSummary", people: [], kpis: [2], scope: [], works: ["HerSecretWork"], effort: "1-2 hours", progress: [{ work: "HerSecretWork", status: "In progress", percent: 20, owners: [] }] }));
store.set("work_naj_task_hersecretwork", JSON.stringify({ name: "HerSecretWork", percent: 20, status: "In progress", updated: today }));
store.set("work_naj_plan_hp1", JSON.stringify({ id: "hp1", title: "HerSecretPlan", start: today, end: today, pillar: "market", format: "post", state: "Planned" }));
store.set("work_naj_planseed", "1");
store.set("work_naj_people", JSON.stringify({ people: [{ n: "HerSecretColleague" }] }));
const HID = compact + "her99";
store.set("recw_" + HID, JSON.stringify({ id: HID, date: today, started: today + "T06:00:00Z", title: "HerSecretMeeting", status: "filed", notes: { summary: "HerSecretNotes", topics: [], decisions: [], people: [], actions: [] }, minutes: { title: "HerSecretMinutes", purpose: "x", decisions: [], discussion: [], actions: [], open_questions: [] } }));
store.set("recs_" + HID + "_000", JSON.stringify({ n: 0, secs: 30, text: "HerSecretTranscript words words words words words words words." }));
store.set("annemarie_rec", JSON.stringify({ title: "Example client card", leads: [] }));
const herKeys = [...store.keys()].sort();

// ---- key scheme
ok(P.workKey("najjuko", "work_naj_x") === "work_naj_x" && P.workKey("najjuko", "recw_1") === "recw_1", "her keys keep their names");
ok(P.workKey("kendall", "work_naj_2026-10-01_a") === "work_kendall_2026-10-01_a" && P.workKey("kendall", "recw_1") === "kendall_recw_1" && P.workKey("kendall", "recj_1_notes") === "kendall_recj_1_notes", "his keys are parallel");
let threw = false; try { P.workKey("kendall", "annemarie_rec"); } catch (e) { threw = true; } ok(threw, "a key outside Work is refused for him");
ok(!"work_kendall_".startsWith("work_naj_") && !"kendall_recw_".startsWith("recw_"), "none of his prefixes sits under one of hers");

// ---- front door and the page
let r = await get("/momo", KEN), h = await r.text(); ok(r.status === 200 && /href="\/momo\/work\?key=/.test(h), "his front door has a Work card");
ok(/speaking/.test(h), "his own cards stay (Speaking)");
r = await get("/momo/work", KEN); h = await r.text(); ok(r.status === 200 && /id=wf/.test(h) && /\/momo\/work\.js/.test(h) && !/private/.test(h), "his key opens his Work page", h.slice(0, 200));
ok(!/Najjuko|FN Realty/.test(h), "his page carries none of her names");
r = await get("/momo/work", NAJ); h = await r.text(); ok(r.status === 200 && /id=wf/.test(h), "her key opens her Work page");
r = await get("/momo/work", OTHER); h = await r.text(); ok(/private to its owner/.test(h) && !/id=wf/.test(h), "another insider key sees only the private note");
ok((await get("/momo/work/api", OTHER)).status === 404, "another insider key cannot read any log");
ok((await post("/momo/work/api", OTHER, { action: "save", entry: { title: "x" } })).status === 404, "another insider key cannot write");
r = await get("/momo/work.js", KEN); const js = await r.text(); let parsed = false; try { new Function(js); parsed = true; } catch (e) { console.log(e.message); }
ok(parsed, "his page script parses (new Function on the served string)");
ok(!/Najjuko/.test(js), "his page script carries none of her names");

// ---- his GET api: his profile, none of her lists
r = await get("/momo/work/api", KEN); let j = await r.json();
ok(r.status === 200 && j.entries.length === 0 && j.tasks.length === 0, "his log starts empty (none of hers)", j.entries);
ok(j.kpis.map((k) => k.name).join() === "Clients,Engagements,Speaking,Product,Admin", "neutral default focus areas", j.kpis);
ok(j.people.length === 0 && j.works.length === 0 && !JSON.stringify(j).includes("Kalhor"), "none of her people or campaigns");
store.set("work_cfg_kendall", JSON.stringify({ name: "Example Owner", org: "Example Co", kpis: [{ id: 1, name: "Alpha" }, { id: 2, name: "Beta" }], people: [["Example Partner", "Partner", "Partners"]], works: ["Example engagement"] }));
j = await (await get("/momo/work/api", KEN)).json();
ok(j.kpis.map((k) => k.name).join() === "Alpha,Beta" && j.people[0] === "Example Partner" && j.works[0] === "Example engagement", "his lists come from his KV config", j.kpis);
ok(j.depts.some((d) => d.dept === "Partners"), "his departments come from his config");
j = await (await get("/momo/work/api", NAJ)).json(); ok(j.entries.some((e) => e.title === "HerSecretEntry") && j.kpis.length === 5, "her api unchanged");

// ---- every capability round-trips for him
let x = await (await post("/momo/work/api", KEN, { action: "parse", text: "Met an example client about the example engagement.", date: today })).json();
ok(Array.isArray(x.entries) && x.entries.length >= 1, "parse (no model: the fallback) works for him", x);
x = await (await call("/momo/work/api", KEN, { action: "parse", text: "Met an example client.", date: today })).json();
ok(x.entries[0].title === "Example client meeting" && x.entries[0].kpis[0] === 1 && x.entries[0].scope[0] === "k1", "parse with the model files to HIS focus areas", x.entries);
const ps = sysSeen[sysSeen.length - 1]; ok(/Example Owner/.test(ps) && /Alpha/.test(ps) && !/Najjuko|FN Realty|Kalhor/.test(ps), "his filing prompt is his, with none of her people", ps.slice(0, 200));
x = await (await post("/momo/work/api", KEN, { action: "save", date: today, text: "typed", entry: { title: "HisEntry", type: "Meeting", kpis: [1], people: ["Example Partner"], works: ["HisWork"], progress: [{ work: "HisWork", status: "In progress", percent: 40, owners: [] }] } })).json();
ok(x.ok && x.entry.people[0] === "Example Partner", "save", x);
const hid = x.entry.id;
ok(store.has("work_kendall_" + today + "_" + hid), "his entry is on his own key");
j = await (await get("/momo/work/api", KEN)).json();
ok(j.entries.length === 1 && j.entries[0].title === "HisEntry" && j.tasks.some((t) => t.name === "HisWork") && j.tally[0].week === 1, "his entry, task and tally", j.tally);
x = await (await post("/momo/work/api", KEN, { action: "save", id: hid, date: today, oldDate: today, entry: { title: "HisEntryEdited", kpis: [2], works: ["HisWork"] } })).json(); ok(x.ok && x.entry.title === "HisEntryEdited", "edit");
x = await (await post("/momo/work/api", KEN, { action: "task_progress", name: "HisWork", percent: 70 })).json(); ok(x.ok && store.has("work_kendall_task_hiswork"), "task progress on his key");
x = await (await post("/momo/work/api", KEN, { action: "party_confirm", name: "Example Vendor", kind: "supplier" })).json(); ok(x.ok && store.has("work_kendall_party_example-vendor"), "known parties on his key");
x = await (await post("/momo/work/api", KEN, { action: "parties" })).json(); ok(x.parties.length === 1, "his parties only");
x = await (await post("/momo/work/api", KEN, { action: "doc_dna", name: "a.pdf", title: "Example weekly deck", head: "example weekly deck agenda review" })).json(); ok(x.ok && [...store.keys()].some((k) => k.startsWith("work_kendall_doc_")), "doc DNA on his key");
r = await get("/momo/work/report?from=" + today + "&to=" + today, KEN); h = await r.text();
ok(r.status === 200 && /HisEntryEdited/.test(h) && !/HerSecret/.test(h) && !/Najjuko|FN Realty/.test(h), "day report: his, none of hers, none of her names");
r = await get("/momo/work/report?all=1", KEN); h = await r.text(); ok(r.status === 200 && /HisEntryEdited/.test(h) && !/HerSecret/.test(h), "month/all report (v615)");
r = await get("/momo/work/debrief?date=" + today + "&id=" + hid, KEN); h = await r.text(); ok(r.status === 200 && /HisEntryEdited/.test(h) && !/Najjuko Ganyana|FN Realty/.test(h), "debrief PDF");
r = await get("/momo/work/item/entry?id=" + today + "_" + hid, KEN); h = await r.text(); ok(r.status === 200 && /HisEntryEdited/.test(h) && /Beta/.test(h), "item PDF names HIS focus area");
r = await get("/momo/work/item/task?id=HisWork", KEN); ok(r.status === 200, "task PDF");
// plan + 'I have an idea'
x = await (await post("/momo/work/plan/api", KEN, { action: "item_save", item: { title: "HisPlanItem", start: today, end: today } })).json(); ok(x.ok !== false && [...store.keys()].some((k) => k.startsWith("work_kendall_plan_")), "plan item on his key", x);
ok(store.get("work_kendall_planseed") === "1" && ![...store.keys()].some((k) => k.startsWith("work_kendall_plan_") && !/HisPlanItem/.test(store.get(k))), "her campaign seed never lands in his plan");
x = await (await post("/momo/work/plan/api", KEN, { action: "idea_find", text: "" })).json(); ok(x && typeof x === "object", "I have an idea answers for him");
r = await get("/momo/work/plan/week?from=" + today, KEN); h = await r.text(); ok(r.status === 200 && /HisPlanItem/.test(h) && !/HerSecretPlan/.test(h), "plan week PDF: his only");
r = await get("/momo/work/plan/month?month=" + today.slice(0, 7), KEN); h = await r.text(); ok(r.status === 200 && !/HerSecretPlan/.test(h), "plan month PDF: none of hers");
// recorder: start, chunked parts, finish, notes, minutes, entry, transcript page, minutes page, archive, delete
x = await (await call("/momo/work/rec/api", KEN, { action: "start", title: "HisMeeting" })).json(); const rid = x.id; ok(x.ok && store.has("kendall_recw_" + rid) && !store.has("recw_" + rid), "recording starts on his key");
for (let n = 0; n < 2; n++) { const u = new URL(U("/momo/work/rec/chunk?id=" + rid + "&n=" + n + "&secs=30", KEN)); const c = await (await W.workRoute(new Request(u, { method: "POST", body: new Uint8Array(4000), headers: { "Content-Type": "audio/mp4" } }), env, u, deps)).json(); ok(c.ok, "part " + n + " banked", c); }
ok(store.has("kendall_recs_" + rid + "_000") && store.has("kendall_recs_" + rid + "_001"), "transcript parts on his keys");
x = await (await call("/momo/work/rec/api", KEN, { action: "finish", id: rid, secs: 60 })).json(); ok(x.ok !== false, "finish", x);
x = await (await call("/momo/work/rec/api", KEN, { action: "notes", id: rid })).json(); ok(x.ok, "notes", x);
x = await (await call("/momo/work/rec/api", KEN, { action: "minutes", id: rid })).json(); ok(x.ok, "minutes", x);
ok(!sysSeen.some((s) => /Fayez|Barbak/.test(s) && /Example Owner/.test(s)), "his prompts carry none of her colleagues' misheard names");
x = await (await call("/momo/work/rec/api", KEN, { action: "read", id: rid, kind: "notes" })).json(); ok(x.state, "read job (v629) runs for him", x);
x = await (await call("/momo/work/rec/api", KEN, { action: "entries", id: rid })).json(); ok(x.ok && x.entries.length >= 1, "entry from his recording", x);
x = await (await call("/momo/work/rec/api", KEN, { action: "list", date: today })).json(); ok(x.recs.length === 1 && x.recs[0].id === rid, "his day list: only his recording", x.recs);
x = await (await call("/momo/work/rec/api", KEN, { action: "archive" })).json(); ok(x.recs.length === 1 && x.recs[0].id === rid, "his archive: only his");
r = await get("/momo/work/rec/view?id=" + rid, KEN); h = await r.text(); ok(r.status === 200 && /Good morning everyone/.test(h), "his transcript page");
r = await get("/momo/work/rec/minutes?id=" + rid, KEN); h = await r.text(); ok(r.status === 200 && /Example minutes/.test(h) && !/FN Realty|Najjuko/.test(h), "his minutes page, none of her names");
r = await get("/momo/work/item/meeting?id=" + rid, KEN); ok(r.status === 200, "meeting PDF");
ok((await post("/momo/work/voicetest", KEN, {})).status !== 401, "the voice test opens for him");

// ---- isolation both ways, every route
for (const [path, label] of [["/momo/work/rec/view?id=" + HID, "transcript"], ["/momo/work/rec/minutes?id=" + HID, "minutes"], ["/momo/work/item/meeting?id=" + HID, "meeting PDF"], ["/momo/work/item/entry?id=" + today + "_her001", "entry PDF"], ["/momo/work/item/task?id=HerSecretWork", "task PDF"], ["/momo/work/debrief?date=" + today + "&id=her001", "debrief"]])
  ok((await get(path, KEN)).status === 404, "his key cannot open her " + label);
for (const [path, label] of [["/momo/work/rec/view?id=" + rid, "transcript"], ["/momo/work/rec/minutes?id=" + rid, "minutes"], ["/momo/work/item/meeting?id=" + rid, "meeting PDF"], ["/momo/work/item/entry?id=" + today + "_" + hid, "entry PDF"], ["/momo/work/item/task?id=HisWork", "task PDF"], ["/momo/work/debrief?date=" + today + "&id=" + hid, "debrief"]])
  ok((await get(path, NAJ)).status === 404, "her key cannot open his " + label);
j = await (await get("/momo/work/api", NAJ)).json(); ok(!JSON.stringify(j).includes("HisEntry") && !JSON.stringify(j).includes("HisWork"), "her api never shows his");
h = await (await get("/momo/work/report?all=1", NAJ)).text(); ok(!/HisEntry/.test(h), "her report never shows his");
h = await (await get("/momo/work/plan/month?month=" + today.slice(0, 7), NAJ)).text(); ok(!/HisPlanItem/.test(h), "her plan never shows his");
x = await (await call("/momo/work/rec/api", NAJ, { action: "archive" })).json(); ok(x.recs.length === 1 && x.recs[0].id === HID, "her archive: only hers");
x = await (await call("/momo/work/rec/api", KEN, { action: "delete", id: HID })).json(); ok(store.has("recw_" + HID), "his key cannot delete her recording", x);
x = await (await call("/momo/work/rec/api", NAJ, { action: "delete", id: rid })).json(); ok(store.has("kendall_recw_" + rid), "her key cannot delete his recording", x);
await post("/momo/work/api", KEN, { action: "delete", date: today, id: "her001" }); ok(store.has("work_naj_" + today + "_her001"), "his delete never touches her entry");
x = await (await call("/momo/work/rec/api", KEN, { action: "people" })).json(); ok(!JSON.stringify(x).includes("HerSecretColleague"), "his roster is not hers");
ok((await get("/momo/work/anne", KEN)).status !== 200 || !/Example client card/.test(await (await get("/momo/work/anne", KEN)).text()), "her client card stays hers");
ok((await get("/momo/work/brief", KEN)).status === 404 || (await get("/momo/work/brief", KEN)).status === 401, "her briefing dossiers stay hers");
// her legacy key names: write as her, the exact names
x = await (await post("/momo/work/api", NAJ, { action: "save", date: today, entry: { title: "HerNew", kpis: [1] } })).json(); ok(store.has("work_naj_" + today + "_" + x.entry.id), "her save: work_naj_<date>_<id>");
await post("/momo/work/api", NAJ, { action: "task_progress", name: "HerTaskTwo", percent: 10 }); ok(store.has("work_naj_task_hertasktwo"), "her task: work_naj_task_<slug>");
x = await (await call("/momo/work/rec/api", NAJ, { action: "start", title: "HerRec" })).json(); ok(store.has("recw_" + x.id), "her recording: recw_<id>");
await post("/momo/work/plan/api", NAJ, { action: "item_save", item: { id: "hp2", title: "HerPlanTwo", start: today, end: today } }); ok(store.has("work_naj_plan_hp2"), "her plan: work_naj_plan_<id>");
ok(herKeys.every((k) => store.has(k) || k === "x"), "none of her original keys were renamed or removed");
ok(![...store.keys()].some((k) => /^work_kendall_|^kendall_rec/.test(k) && /Her(Secret|New|Rec|PlanTwo)/.test(store.get(k) || "")), "none of her data sits on his keys");
ok(![...store.keys()].some((k) => /^(work_naj_|rec[wsaj]_)/.test(k) && /His(Entry|Meeting|PlanItem|Work)/.test(typeof store.get(k) === "string" ? store.get(k) : "")), "none of his data sits on her keys");

// ---- bridge: his key reads and writes HIS Work only
const bcall = async (path, key, method = "GET", body, idem) => { const hd = { Authorization: "Bearer " + key }; if (idem) hd["Idempotency-Key"] = idem; if (body) hd["Content-Type"] = "application/json";
  const rr = await worker.fetch(new Request("https://w/momo/bridge/v1/" + path, { method, headers: hd, body: body ? JSON.stringify(body) : undefined }), env, ctx); return { s: rr.status, j: await rr.json() }; };
let b = await bcall("entries", KB); ok(b.s === 200 && b.j.data.entries.length === 1 && b.j.data.entries[0].title === "HisEntryEdited", "bridge: his entries", b.j);
b = await bcall("tasks", KB); ok(b.s === 200 && b.j.data.tasks.some((t) => t.name === "HisWork") && !JSON.stringify(b.j).includes("HerSecret"), "bridge: his tasks");
b = await bcall("plan", KB); ok(b.s === 200 && b.j.data.items.some((i) => i.title === "HisPlanItem") && !JSON.stringify(b.j).includes("HerSecret"), "bridge: his plan");
b = await bcall("meetings", KB); ok(b.s === 200 && b.j.data.meetings.length === 1 && b.j.data.meetings[0].id === rid, "bridge: his meetings");
b = await bcall("meeting?id=" + rid, KB); ok(b.s === 200 && /Good morning everyone/.test(b.j.data.transcript) && b.j.data.minutes.title === "Example minutes", "bridge: his meeting with transcript and minutes");
ok((await bcall("meeting?id=" + HID, KB)).s === 404, "bridge: his key cannot read her meeting");
ok((await bcall("meeting?id=" + rid, NB)).s === 404, "bridge: her key cannot read his meeting");
ok((await bcall("entry?id=" + today + "_her001", KB)).s === 404, "bridge: his key cannot read her entry");
ok(!JSON.stringify((await bcall("entries", NB)).j).includes("HisEntry"), "bridge: her entries never show his");
ok((await bcall("anne", KB)).s === 403, "bridge: her client card stays hers");
b = await bcall("entry", KB, "POST", { entry: { title: "HisBridgeEntry", kpis: [1] } }, "his-bridge-0001"); ok(b.s === 200 && store.has("work_kendall_" + b.j.data.date + "_" + b.j.data.id), "bridge: post entry to his key", b.j);
b = await bcall("task", KB, "POST", { name: "HisBridgeTask", percent: 50 }, "his-bridge-0002"); ok(b.s === 200 && store.has("work_kendall_task_hisbridgetask"), "bridge: post task");
b = await bcall("plan-item", KB, "POST", { item: { title: "HisBridgePlan", start: today, end: today } }, "his-bridge-0003"); ok(b.s === 200 && store.has("work_kendall_plan_" + b.j.data.id), "bridge: post plan item");
b = await bcall("note", KB, "POST", { type: "meeting", id: rid, text: "HisNote" }, "his-bridge-0004"); ok(b.s === 200 && JSON.parse(store.get("kendall_recw_" + rid)).added_notes[0].text === "HisNote", "bridge: note on his meeting");
b = await bcall("note", KB, "POST", { type: "meeting", id: HID, text: "x" }, "his-bridge-0005"); ok(b.s === 404 && !JSON.parse(store.get("recw_" + HID)).added_notes, "bridge: his key cannot note her meeting");
ok((await bcall("speaking", KB)).s === 200 && (await bcall("jobs", KB)).s === 200, "bridge: his own Speaking and Jobs stay");

console.log("v662 kendall work: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
