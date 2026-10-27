// v645 - one entry, one task or one meeting as its own FN Realty PDF page, any day after it was logged; her key only. FAKE data only (the worker repo is public).
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_kendall_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), env, ctx);

// an entry from two days ago that moved a task, and a recording from last week with minutes
store.set("work_naj_2026-10-25_abc123", JSON.stringify({ id: "abc123", date: "2026-10-25", created: "2026-10-25T08:00:00Z", title: "Example campaign kickoff", type: "Meeting",
  summary: "Agreed the example campaign plan.", people: ["Example Person"], kpis: [2], scope: ["m2"], works: ["Example Campaign"], effort: "1-2 hours",
  progress: [{ work: "Example Campaign", status: "In progress", percent: 40, owners: ["Example Owner"] }], deliverables: ["Draft brief"], next: ["Send the draft brief"], text: "Kickoff notes typed by her." }));
store.set("recw_20261020abcd1234", JSON.stringify({ id: "20261020abcd1234", date: "2026-10-20", started: "2026-10-20T06:00:00Z", started_hm: "10:00", ended_hm: "10:30", secs: 1800, title: "Example weekly huddle", status: "filed",
  attendees: [{ n: "Example Person" }], minutes: { title: "Example weekly huddle", purpose: "Review the week.", decisions: [{ headline: "Example decision", detail: "Go ahead." }],
    discussion: [{ heading: "Example topic", bullets: ["Point one"] }], actions: [{ action: "Send the example report", owner: "Example Owner", due: "2026-10-30", due_stated: true }], open_questions: ["Example question?"] } }));
store.set("recw_20261021unread99", JSON.stringify({ id: "20261021unread99", date: "2026-10-21", started: "2026-10-21T06:00:00Z", secs: 600, title: "Unread recording", status: "recording" }));

// entry
let r = await get("/momo/work/item/entry?id=2026-10-25_abc123", NAJ), h = await r.text();
ok(r.status === 200, "her key opens one entry", r.status);
ok(/Example campaign kickoff/.test(h) && /Agreed the example campaign plan/.test(h) && /Example Owner/.test(h) && /Send the draft brief/.test(h) && /Kickoff notes typed by her/.test(h), "entry page carries title, summary, assignee, next steps, her notes");
ok(/Content &amp; creative|Content & creative/.test(h) && /Content &amp; Creative Production|Content & Creative Production/.test(h), "entry page names the focus area and scope");
ok(/data:image\/png;base64/.test(h) && h.includes("#2A3A68"), "FN logo and FN navy present");
ok(/clause 12\.2/.test(h) && !/CONFIDENTIAL/.test(h), "report footer (clause 12.2), no confidentiality footer");
ok(!/Najma|DigitAlchemy|Digital Abbot/i.test(h), "no Najma / DigitAlchemy branding");
ok(/print\(\)/.test(h) && /Save as PDF/.test(h), "Save as PDF button");
ok(!/setTimeout\(function\(\)\{print\(\)\}/.test(h), "no auto print without print=1");
h = await (await get("/momo/work/item/entry?id=2026-10-25_abc123&print=1", NAJ)).text();
ok(/setTimeout\(function\(\)\{print\(\)\},400\)/.test(h), "print=1 opens the print dialog");

// task
r = await get("/momo/work/item/task?id=" + encodeURIComponent("Example Campaign"), NAJ); h = await r.text();
ok(r.status === 200 && /Example Campaign/.test(h) && /In progress, 40% complete/.test(h) && /Example Owner/.test(h) && /Work logged on this task/.test(h) && /Example campaign kickoff/.test(h), "task page: status, owner, the entries that touched it", r.status);
ok(/Task<\/em> Report/.test(h), "task page headed Task Report");

// meeting with minutes, and one not read yet
r = await get("/momo/work/item/meeting?id=20261020abcd1234", NAJ); h = await r.text();
ok(r.status === 200 && /Example weekly huddle/.test(h) && /Send the example report/.test(h) && /2026-10-30/.test(h) && /Example decision/.test(h) && /Example question\?/.test(h), "meeting page: decisions, action items with owner and due, open questions", r.status);
r = await get("/momo/work/item/meeting?id=20261021unread99", NAJ); h = await r.text();
ok(r.status === 200 && /has not been read yet/.test(h), "a recording not read yet says so");

// refusals
for (const [p, k] of [["/momo/work/item/entry?id=2026-10-25_abc123", OWNER], ["/momo/work/item/task?id=Example%20Campaign", OWNER], ["/momo/work/item/meeting?id=20261020abcd1234", OWNER],
  ["/momo/work/item/entry?id=2026-10-25_abc123", ""], ["/momo/work/item/entry?id=2026-10-25_abc123", "wrong"],
  ["/momo/work/item/entry?id=2026-10-25_nope", NAJ], ["/momo/work/item/entry?id=bad", NAJ], ["/momo/work/item/task?id=Nothing", NAJ], ["/momo/work/item/meeting?id=nothere", NAJ], ["/momo/work/item/other?id=x", NAJ]]) {
  const x = await get(p, k); ok(x.status === 404 || x.status === 401, "refused: " + p + " key " + (k ? k.slice(0, 12) : "none"), x.status);
}

// archive list (any day) through the real entry point
const post = (body) => worker.fetch(new Request("https://w/momo/work/rec/api?key=" + NAJ, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env, ctx);
const a = await (await post({ action: "archive" })).json();
ok(a.ok && a.recs.length === 2 && a.recs[0].id === "20261021unread99" && a.recs[1].minutes === true, "archive lists every recording, newest first", a);
const ownerArch = await worker.fetch(new Request("https://w/momo/work/rec/api?key=" + OWNER, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "archive" }) }), env, ctx);
ok(ownerArch.status === 401 || ownerArch.status === 404, "the owner cannot list her recordings", ownerArch.status);

// the page scripts carry the buttons
const js = await (await get("/momo/work.js", NAJ)).text();
ok(/item\/entry\?key=/.test(js) && /item\/task\?key=/.test(js) && /item\/meeting\?key=/.test(js) && /FN Realty PDF/.test(js) && /var FNPDF=/.test(js), "Work page script has FN Realty PDF links for entries, tasks and meetings");
ok(/Earlier meetings/.test(js) && /action:"archive"/.test(js), "recordings list shows earlier meetings from the archive");
let parsed = true; try { new Function(js); } catch (e) { parsed = e.message; }
ok(parsed === true, "Work page script parses", parsed);

console.log("v645 item pdf: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
