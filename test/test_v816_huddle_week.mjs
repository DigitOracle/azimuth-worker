// v816 - the huddle week everywhere: "Week of Mon 9 Nov 2026" (Mon-Sun, Dubai) on the card, the presenter, the preview, the bridge (for the PDF and
// the opening slide), the Content Planner draft; the week list; "Next week · " when the card is opened early.
import assert from "node:assert/strict";
import * as Hd from "../src/huddle.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) }; }
const store = kv(), env = { MEETINGS: store };
const ms = (d, h) => Date.parse(d + "T" + (h || "10") + ":00:00Z") - 4 * 3600e3;
ok(Hd.weekLabel("2026-11-09") === "Week of Mon 9 Nov 2026", "the label");
ok(Hd.weekPrefix("2026-11-09", ms("2026-11-05")) === "Next week · " && Hd.weekPrefix("2026-11-09", ms("2026-11-11")) === "" && Hd.weekPrefix("2026-11-09", ms("2026-11-09")) === "" && Hd.weekPrefix("2026-11-02", ms("2026-11-11")) === "Past · " && Hd.weekPrefix("2026-12-07", ms("2026-11-08")) === "Coming · ", "Next week when opened early (Thu before); this week from Monday to Sunday");
const prev = await Hd.createCard(env, "2026-11-02"); prev.status = "Closed"; await store.put("hud_card_2026-11-02", JSON.stringify(prev));
await store.put("work_naj_2026-11-04_e1", JSON.stringify({ id: "e1", date: "2026-11-04", title: "t", type: "Meeting", people: [], broker_tasks: [] }));
const c = await Hd.createCard(env, "2026-11-09", undefined, {});
const out = Hd.cardOut(c);
ok(out.week_label === "Week of Mon 9 Nov 2026" && out.week.from === "2026-11-09" && out.week.to === "2026-11-15", "the card (and the bridge, for the opening slide and the PDF) carries the week, Mon to Sun");
ok(/^Week of Mon 2 Nov 2026 in Momo: /.test(c.momo.recognition.lines[0]), "recognition names the week it counted");
const hr = (path) => Hd.huddleRoute(new Request("https://x" + path), env, new URL("https://x" + path), { person: () => "najjuko", page: (k, rk, b) => "<html><body>" + b + "</body></html>" });
let page = await (await hr("/momo/work/huddle?key=K&date=2026-11-09")).text();
ok(/<h1 id=hwk>'\+e\(C\.week_prefix\|\|""\)\+e\(C\.week_label\)/.test(page) && page.includes('"week_label":"Week of Mon 9 Nov 2026"'), "the card header reads the week");
ok(page.includes("All huddles") && page.includes('"label":"Past · Week of Mon 2 Nov 2026"') || page.includes('"label":"Week of Mon 2 Nov 2026"'), "the week list shows each card as Week of ...");
c.status = "Approved"; c.build = { slides: 0 }; await store.put("hud_card_2026-11-09", JSON.stringify(c));
page = await (await hr("/momo/work/huddle/present?key=K&date=2026-11-09")).text();
ok(page.includes("PRESENTER · WEEK OF MON 9 NOV 2026"), "presenter mode shows the week");
// Content Planner draft title
const d = await Hd.createCard(env, "2026-11-16", undefined, {});
d.market.topics = Hd.cleanTopics([1, 2, 3, 4].map((i) => ({ id: "t" + i, line: "Topic " + i, table: "v_" + i, as_of: "2026-11-12" }))); await store.put("hud_card_2026-11-16", JSON.stringify(d));
await Hd.cardAction(env, { date: "2026-11-16", action: "pick", ids: ["t1", "t2", "t3", "t4"] });
const cp = [...store.m.keys()].filter((k) => k.startsWith("cp_item_")).map((k) => JSON.parse(store.m.get(k)));
ok(cp.length === 1 && cp[0].topic.startsWith("Market research (Week of Mon 16 Nov 2026): "), "the Content Planner draft title carries the week");
const pv = (await (await hr("/momo/work/huddle?key=K&date=2026-11-16")).text());
ok(pv.includes("e(C.week_label)+' · presenter view"), "the slide preview footer carries the week");
console.log("test_v816_huddle_week: " + n + " checks passed");
