// v810: the Monday Huddle card (Kendall 8 Nov 2026; FN Realty handover "Monday Huddle Card", 8 Nov 2026).
// No real names or real birthdays here: the form values are made up, and the birthday is a marker string that must never reach a log line.
import assert from "node:assert/strict";
import * as Hd from "../src/huddle.js";
import { bridgeRoute } from "../src/work_bridge.js";
const TI = (b, id) => b.data.market.topics.find((t) => t.id === id), T0 = (b) => TI(b, "t0");
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// ---- capture every log line for the whole run (the birthday check at the end) ----
const LOGS = [], realLog = console.log;
for (const lv of ["log", "info", "warn", "error", "debug"]) { const o = console[lv]; console[lv] = (...a) => { LOGS.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")); if (process.env.V) o(...a); }; }

function kv() {
  const m = new Map();
  return { m, get: async (k, t) => { if (!m.has(k)) return null; const v = m.get(k); if (t === "arrayBuffer") return v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : new TextEncoder().encode(v).buffer; return typeof v === "string" ? v : new TextDecoder().decode(v); },
    put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) };
}
const NAJ = "naj_" + "x".repeat(40), KEN = "ken_" + "y".repeat(40), BDAY = "BDAY-MARKER-0712-zq";
const store = kv(), env = { MEETINGS: store, MOMO_BRIDGE_KEYS: "najjuko:" + NAJ + ",kendall:" + KEN };
const ms = (d, h) => Date.parse(d + "T" + (h || "08") + ":00:00Z") - 4 * 3600e3;   // a Dubai wall-clock time

// ---- dates: Thursday makes the card for the next Monday ----
ok(Hd.mondayFor("2026-11-05") === "2026-11-09" && Hd.mondayFor("2026-11-09") === "2026-11-09" && Hd.mondayFor("2026-11-10") === "2026-11-16", "mondayFor");
ok(Hd.inCreateWindow("2026-11-05") && Hd.inCreateWindow("2026-11-08") && !Hd.inCreateWindow("2026-11-04") && !Hd.inCreateWindow("2026-11-10"), "Thursday to Monday window");
ok((await Hd.huddleTick(env, ms("2026-10-28"))) === null && !(await store.get("hud_card_2026-11-02")), "Wednesday: no card yet");

// ---- section map: field-agnostic, keys placed by FIELD_SECTION, slide prefix, or name prefix; unknown keys are kept ----
ok(Hd.sectionOfKey("s04_headline") === "market" && Hd.sectionOfKey("slide12_mon") === "schedule" && Hd.sectionOfKey("theme_title") === "theme" && Hd.sectionOfKey("birthdays_this_week") === "celebrations", "section map by prefix");
ok(Hd.sectionOfKey("zz_unknown") === "" && Hd.sectionOfKey("skip_slides") === "", "unmapped key is not forced into a section");
ok(Hd.SECTIONS.length === 8 && Hd.SECTIONS.map((s) => s.slides.join(",")).join("|") === "1,3|4,5,6,7|8|9|10|11|12|14,15", "8 sections with the PDF's slide numbers");
ok(Hd.SEGMENTS.length === 8 && Hd.SEGMENTS.reduce((a, s) => a + s.min, 0) === 31, "8 presenter segments, about 30 minutes");
ok(Hd.HOSTS[0] === "Ali Kalhor" && Hd.HOSTS[1] === "Najjuko", "Ali Kalhor above Najjuko");

// ---- the first card (no last week): created on Thursday, empty form ----
let c1 = await Hd.huddleTick(env, ms("2026-10-29"));
ok(c1 && c1.date === "2026-11-02" && c1.status === "Draft" && c1.prev_date === "", "Thursday 29 Oct creates the 2 Nov card");
ok((await Hd.huddleTick(env, ms("2026-10-30"))) === null, "a second tick does not recreate it");
// seed last week's form directly (as if filled and closed)
const lastForm = { theme_title: "Own the week", theme_clip_url: "https://www.youtube.com/watch?v=abc", theme_notes: "Open with the clip.", s04_market_notes: "Four topics, 7 minutes.",
  recognition_name: "Top agent", recognition_notes: "Read the numbers.", announcements_1: "Office move", announcements_2: "", birthdays_this_week: BDAY, celebrations_days: "Flag Day",
  tip_text: "Answer every lead in 10 minutes", schedule_mon: "Viewings", schedule_tue: "", mantra_text: "We are FN", challenge_text: "3 listings", zz_unknown: "kept", skip_slides: [8] };
c1 = await Hd.getCard(env, "2026-11-02"); c1.form = lastForm; c1.status = "Closed"; await store.put("hud_card_2026-11-02", JSON.stringify(c1));

// ---- creating and copying the card ----
const c2 = await Hd.huddleTick(env, ms("2026-11-05"));
ok(c2 && c2.date === "2026-11-09" && c2.prev_date === "2026-11-02", "Thursday 5 Nov creates the 9 Nov card from last week");
ok(c2.form.theme_title === "Own the week" && c2.form.zz_unknown === "kept" && c2.form.birthdays_this_week === BDAY, "every key copied as-is (same keys as the DNA file)");
ok(Array.isArray(c2.form.skip_slides) && c2.form.skip_slides.length === 0, "a skip is for one week only");
ok(JSON.parse(await store.get("hud_index")).join() === "2026-11-02,2026-11-09", "index lists both Mondays");

// ---- the placeholder count: empty fields, not *_notes, not skipped slides ----
let ph = Hd.placeholders(c2.form);
ok(ph.count === 2 && ph.keys.includes("announcements_2") && ph.keys.includes("schedule_tue"), "two empty fields count as placeholders");
ok(Hd.placeholders({ a: "", b_notes: "", c: [], d: [{ x: "", y: "1" }], e: null, skip_slides: [] }).count === 4, "empty string, empty list, nested empty, null; notes ignored");
ok(Hd.placeholders({ tip_text: "", skip_slides: [11] }).count === 0, "a skipped section's fields are not counted");

// ---- Same and Edit ----
const page = async (b) => Hd.cardAction(env, Object.assign({ date: "2026-11-09" }, b));
let r = await page({ action: "edit", section: "tip", values: { tip_text: "Call back before lunch", mantra_text: "not mine" } });
ok(r[0] === 200 && r[1].card.form.tip_text === "Call back before lunch" && r[1].card.form.mantra_text === "We are FN", "Edit writes only that section's keys");
ok(r[1].card.status === "Filling" && r[1].card.sections.find((s) => s.id === "tip").done, "Edit marks the section done (green) and the card is Filling");
r = await page({ action: "edit", section: "tip", values: { tip_text: "changed again" } });
r = await page({ action: "same", section: "tip" });
ok(r[1].card.form.tip_text === "Answer every lead in 10 minutes" && r[1].card.sections.find((s) => s.id === "tip").state === "same", "Same copies last week's value back for that section");
r = await page({ action: "skip", section: "recognition", on: true });
ok(r[1].card.skip_slides.join() === "8" && r[1].card.sections.find((s) => s.id === "recognition").done, "Skip slide writes skip_slides and counts as done");
r = await page({ action: "edit", section: "schedule", values: { schedule_tue: "Team training" } });
ok(r[1].card.placeholders.count === 1, "filling a field lowers the placeholder count");
for (const s of ["theme", "announcements", "celebrations", "mantra"]) r = await page({ action: "same", section: s });
ok(r[1].card.status === "Filling" && /market/.test(r[1].card.next_step), "one next step: pick the market topics");
ok((await page({ action: "request_build" }))[0] === 409, "Build is refused until every section is done");

// ---- bridge: auth, Idempotency-Key, the routes ----
const B = "https://x.test/momo/bridge/v1/";
const call = (path, o) => bridgeRoute(new Request(B + path, Object.assign({ headers: Object.assign({ "Content-Type": "application/json" }, o && o.h) }, o)), env, new URL(B + path));
const nh = (ik) => Object.assign({ Authorization: "Bearer " + NAJ }, ik ? { "Idempotency-Key": ik } : {});
const js = async (res) => [res.status, await res.json(), res.headers.get("Idempotent-Replay")];
ok((await call("huddle/next", {}))?.status === 401, "no key: 401");
ok((await call("huddle/next?key=" + NAJ, { h: nh() })).status === 400, "a key in the address is refused");
let [st, body] = await js(await call("huddle/next", { h: { Authorization: "Bearer " + KEN } }));
ok(st === 403, "Kendall's key does not open the huddle (private to Najjuko)");
ok((await call("huddle/2026-11-09", { h: { Authorization: "Bearer " + KEN } })).status === 403, "Kendall's key cannot read the card");
ok((await call("huddle/2026-11-09/form", { method: "PUT", h: { Authorization: "Bearer " + KEN, "Idempotency-Key": "kendall-try-1" }, body: "{}" })).status === 403, "Kendall's key cannot write the form");
const realNow = Date.now; Date.now = () => ms("2026-11-06", "10");
[st, body] = await js(await call("huddle/next", { h: nh() }));
ok(st === 200 && body.data.date === "2026-11-09" && body.data.status === "Filling", "GET huddle/next: date and status");
Date.now = realNow;
[st, body] = await js(await call("huddle/2026-11-09", { h: nh() }));
ok(st === 200 && body.data.form.zz_unknown === "kept" && body.data.unmapped_keys.includes("zz_unknown"), "GET huddle/{date}: the form as-is plus the status");
ok((await call("huddle/2026-11-09/form", { method: "PUT", h: nh(), body: JSON.stringify({ form: { theme_title: "x" } }) })).status === 400, "PUT without Idempotency-Key is refused");
const topics = Array.from({ length: 18 }, (_, i) => ({ id: "t" + i, line: i === 0 ? "Vacancy in Business Bay eased" : "Topic " + i, table: "v_gov_sales", as_of: "2026-11-05", provisional: i === 3 }));
const put1 = () => call("huddle/2026-11-09/form", { method: "PUT", h: nh("huddle-put-0001"), body: JSON.stringify({ form: { theme_slide_text: "Drafted line" }, market_topics: topics }) });
[st, body] = await js(await put1());
ok(st === 200 && body.data.market.topics.length === 18 && body.data.drafted_by_claude.includes("theme_slide_text"), "PUT form: drafted text and 18 topics");
ok(!/vacancy/i.test(T0(body).line) && /units on the market/.test(T0(body).line), "never the word vacancy");
ok(TI(body,"t3").provisional === true && TI(body,"t1").table === "v_gov_sales" && TI(body,"t1").as_of === "2026-11-05", "topics keep their source and date");
const before0 = 0; const before = (await Hd.getCard(env, "2026-11-09")).log.length;
let rep = await js(await put1());
ok(rep[0] === 200 && rep[2] === "true" && (await Hd.getCard(env, "2026-11-09")).log.length === before, "a retried PUT replays the first answer and writes nothing twice");

// ---- the bridge can never set Approved ----
for (const bad of [{ status: "Approved" }, { approved: true }, { form: { status: "Approved" } }, { status: "Built" }]) {
  [st, body] = await js(await call("huddle/2026-11-09/form", { method: "PUT", h: nh("appr-" + Math.random().toString(36).slice(2, 10)), body: JSON.stringify(bad) }));
  ok(st === 403 && body.code === "approval_is_hers", "bridge refused: " + JSON.stringify(bad));
}
[st, body] = await js(await call("huddle/2026-11-09/build", { method: "POST", h: nh("appr-build-01"), body: JSON.stringify({ status: "Approved", pdf_base64: "x" }) }));
ok(st === 403 && body.code === "approval_is_hers", "a build that tries to approve is refused");
ok((await Hd.getCard(env, "2026-11-09")).status !== "Approved", "the card is not approved by any bridge call");

// ---- market pick, accept drafts, build ----
r = await page({ action: "pick", ids: ["t0", "t1", "t2", "t3", "t4"] });
ok(r[0] === 400, "more than 4 topics refused");
r = await page({ action: "pick", ids: ["t0", "t1", "t2", "t3"] });
ok(r[1].card.status === "Ready to build" && r[1].card.next_step === "build the preview", "4 picks: Ready to build");
const pdf = Buffer.from("%PDF-1.4 test").toString("base64"), pptx = Buffer.from("PK\x03\x04pptx").toString("base64"), png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]).toString("base64");
ok((await page({ action: "request_build" }))[0] === 200, "Build preview (with the placeholder warning on the page) asks her Claude to build");
[st, body] = await js(await call("huddle/2026-11-09/build", { method: "POST", h: nh("build-0001"), body: JSON.stringify({ pdf_base64: "bm90IGEgcGRm" }) }));
ok(st === 400 && body.code === "bad_pdf", "a build without a real PDF is refused");
[st, body] = await js(await call("huddle/2026-11-09/build", { method: "POST", h: nh("build-0002"), body: JSON.stringify({ pdf_base64: pdf, pptx_base64: pptx, slides_base64: Array(15).fill(png), placeholders: ["announcements_2"] }) }));
ok(st === 200 && body.data.status === "Built" && body.data.build.placeholders === 1 && body.data.build.slides === 15, "build: Built, files and placeholder list attached");
ok(store.m.get("hud_file_2026-11-09_pdf") instanceof Uint8Array && store.m.has("hud_file_2026-11-09_slide_15"), "files stored");
r = await page({ action: "approve" });
ok(r[0] === 409 && /drafted by Claude/.test(r[1].error), "Approve waits until she accepts Claude's drafts");
r = await page({ action: "accept" });
r = await page({ action: "approve" });
ok(r[0] === 200 && r[1].card.status === "Approved" && r[1].card.approved, "only her tap approves");
[st, body] = await js(await call("huddle/2026-11-09/form", { method: "PUT", h: nh("after-appr-1"), body: JSON.stringify({ form: { theme_title: "late" } }) }));
ok(st === 409 && body.code === "locked", "after approval the bridge cannot change the form");

// ---- pages: only her key; presenter; close ----
const hr = (path, person, o) => Hd.huddleRoute(new Request("https://x.test" + path, o), env, new URL("https://x.test" + path), { person: () => person, page: (k, rk, b) => "<html>" + b + "</html>" });
ok((await hr("/momo/work/huddle?key=k", "kendall")).status === 404, "the card page: Kendall's key sees nothing");
let html = await (await hr("/momo/work/huddle?key=k&date=2026-11-09", "najjuko")).text();
ok(/MONDAY HUDDLE/.test(html) && /Approved/.test(html), "her card page renders");
html = await (await hr("/momo/work/huddle/present?key=k&date=2026-11-09", "najjuko")).text();
ok(/PRESENTER/.test(html) && /"Recognition"/.test(html) === false && /Mantra/.test(html), "presenter: skipped Recognition hidden, others shown");
ok(/Open with the clip\./.test(html) && /youtube\.com\/watch\?v=abc/.test(html), "speaker notes and the clip are in the page (preloaded)");
ok((await hr("/momo/work/huddle/file?key=k&date=2026-11-09&kind=pdf", "najjuko")).headers.get("Content-Type") === "application/pdf", "the preview PDF opens from the card");
r = await page({ action: "seg", n: "01", done: true, note: "Q: parking. Action: ask admin." });
r = await page({ action: "close" });
ok(r[0] === 200 && r[1].card.status === "Closed", "Close: Closed");
const rid = (await Hd.getCard(env, "2026-11-09")).record_id, rec = JSON.parse(await store.get("recw_" + rid));
ok(rec && rec.source === "huddle" && rec.status === "transcribed" && rec.auto_file_off === true, "a meeting record in Momo Meetings, never auto-filed to her work log");
ok(/Segment 01 Motivation \(done\): Q: parking/.test(JSON.parse(await store.get("recs_" + rid + "_000")).text), "its text holds the segment notes, so the standard minutes can be made from it");

// ---- birthdays never appear in any log line ----
const allLogs = LOGS.join("\n") + "\n" + [...store.m.keys()].filter((k) => k.startsWith("brg_log_")).map((k) => store.m.get(k)).join("\n") + "\n" + JSON.stringify((await Hd.getCard(env, "2026-11-09")).log);
ok(allLogs.length > 10 && !allLogs.includes(BDAY), "no birthday value in any console line, bridge log or card log");
ok([...store.m.keys()].some((k) => k.startsWith("brg_log_najjuko_")), "the bridge log exists (person, route, status only)");

console.log = realLog; console.log("test_v810_huddle: " + n + " checks passed");
