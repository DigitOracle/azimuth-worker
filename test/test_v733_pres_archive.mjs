// v733 - Presentations card: past presentations (Dubai day) move into a collapsible "Archived (N)" child section, newest first,
// grouped by month above 10; dates from a linked speaking engagement, else the entry's date, else a date in the slug/title;
// no date -> main list marked "Date unknown"; links (share/open) still present; nothing deleted.
// FAKE data through the real worker; the real pres_index is checked only when PRES_INDEX_JSON points at a local read-only copy.
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const P = await import("../src/work_presentations.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const KEN = "ins_kendall_TESTKEY0123456789abcd", NAJ = "ins_najjuko_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN].join(","), READ_KEY: "readkey_TEST_0123456789abcdef" };
const ctx = { waitUntil() {}, passThroughOnException() {} };

// date parsing
ok(P.dateInText("proptech-summit-digital-twins-3nov2026") === "2026-11-03", "slug 3nov2026");
ok(P.dateInText("talk 2026-11-03") === "2026-11-03", "iso in title");
ok(P.dateInText("Masterclass 31 October 2026") === "2026-10-31", "long month in title");
ok(P.dateInText("x-31feb2026") === "" && P.dateInText("proptech-summit-2026") === "", "no false dates");

// resolution order and split
const links = P.spkLinks([
  { id: "talk-a", title: "A", date: "2026-11-10", status: "confirmed", materials: [] },
  { id: "other", title: "B", date: "2026-10-20", endDate: "2026-10-21", status: "confirmed", materials: [{ label: "Deck", url: "https://w/pres/talk-b-1nov2026" }] },
  { id: "talk-c", title: "C", date: "2026-01-01", status: "cancelled" },
]);
ok(links["talk-a"].date === "2026-11-10" && links["talk-b-1nov2026"].date === "2026-10-21" && !links["talk-c"], "speaking links by id and by materials url", links);
const T = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);   // Dubai today (was fixed at 4 Nov; the page uses the real date)
const items = [
  { slug: "talk-a", title: "A", date: "2026-10-01" },          // speaking wins: future -> main
  { slug: "talk-b-1nov2026", title: "B" },                     // speaking endDate 21 Oct -> archived
  { slug: "today-talk", title: "Today", date: T },             // today -> main
  { slug: "old-2026-09-15", title: "Old" },                    // slug date -> archived
  { slug: "mystery", title: "Mystery" },                       // unknown -> main
];
const sp = P.presSplit(items, T, links);
ok(sp.main.map((e) => e.slug).join() === "today-talk,talk-a,mystery", "main: soonest first, undated last", sp.main.map((e) => e.slug));
ok(sp.archived.map((e) => e.slug).join() === "talk-b-1nov2026,old-2026-09-15", "archived newest first", sp.archived.map((e) => e.slug));
ok(sp.main.find((e) => e.slug === "talk-a").whenFrom === "speaking", "speaking engagement date wins");

// page through the real worker
store.set("pres_index", JSON.stringify(items));
store.set("speaking_rec_kendall", JSON.stringify({ v: 1, items: [{ id: "talk-a", title: "A", date: "2099-11-10", status: "confirmed" }] }));
let r = await worker.fetch(new Request("https://w/momo/work/presentations?key=" + KEN), env, ctx), t = await r.text();
ok(r.status === 200, "page 200", r.status);
const ai = t.indexOf("<details class=pa id=pres_arch>");
ok(ai > 0 && !/<details[^>]*\bopen\b/.test(t), "archived section present and closed", ai);
ok(t.includes("<summary>Archived (2)</summary>"), "archived count");
ok(t.indexOf('data-s="https://w/pres/old-2026-09-15"') > ai && t.indexOf('data-s="https://w/pres/today-talk"') < ai, "past tiles under Archived, current above");
ok(t.includes("Date unknown"), "unknown date flagged");
ok(t.includes("grid-template-columns:repeat(2,minmax(0,1fr))"), "2-up cards");
ok(JSON.parse(store.get("pres_index")).length === 5, "nothing deleted");
r = await worker.fetch(new Request("https://w/pres/old-2026-09-15"), env, ctx);
ok(r.status === 200, "archived share page still works", r.status);

// month grouping above 10
const many = Array.from({ length: 12 }, (_, i) => ({ slug: "t" + i, title: "T" + i, date: "2026-0" + (i < 6 ? 8 : 9) + "-1" + (i % 6) }));
const body = P.presBody(KEN, "", many, "https://w", "kendall", { today: T, links: {} });
ok(body.includes("Archived (12)") && body.includes("<h3 class=pm>September 2026</h3>") && body.indexOf("September 2026") < body.indexOf("August 2026"), "grouped by month, newest first");

// the real pres_index (read-only local copy)
const rp = process.env.PRES_INDEX_JSON;
if (rp && fs.existsSync(rp)) {
  const real = JSON.parse(fs.readFileSync(rp, "utf8")).map(P.cleanEntry).filter(Boolean);
  const rs = P.presSplit(real, T, {});
  console.log("real pres_index on " + T + ": archived " + rs.archived.map((e) => e.slug + "@" + e.when).join(", ") + " | main " + (rs.main.map((e) => e.slug + "@" + (e.when || "unknown")).join(", ") || "none"));
  ok(real.length > 0 && rs.archived.length + rs.main.length === real.length, "every real entry placed");
  ok(rs.archived.every((e) => e.when < T) && rs.main.every((e) => !e.when || e.when >= T), "real split obeys the rule");
} else console.log("(real pres_index check skipped: set PRES_INDEX_JSON)");

const src = fs.readFileSync(new URL("../src/work_presentations.js", import.meta.url), "utf8");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src), "no emoji in source");
console.log("v733 pres archive: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
