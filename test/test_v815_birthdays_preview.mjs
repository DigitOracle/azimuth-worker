// v815: birthdays go into the huddle automatically (week + missed since the last huddle; no years, no ages; untick; organogram first names; soft remove),
// and every section shows a live preview of how it will show. Names here are made up; no real staff or dates.
import assert from "node:assert/strict";
import * as Hd from "../src/huddle.js";
import { birthdaysFor, inRange, okMd, birthdayAction, readBirthdays } from "../src/huddle_birthdays.js";
import { rosterMatch } from "../src/work_log.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const LOGS = []; for (const lv of ["log", "info", "warn", "error"]) { const o = console[lv]; console[lv] = (...a) => { LOGS.push(a.map(String).join(" ")); if (process.env.V) o(...a); }; }
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) }; }
const store = kv(), env = { MEETINGS: store };
const people = [["Ruzanna Avanyan (Rose)", "Sales", "sales"], ["Testy Person", "Team", "team"]];

// dates: no years, the week, the year turn, 29 Feb
ok(okMd("11-10") && !okMd("2026-11-10") && !okMd("13-01") && okMd("02-29"), "month-day only, never a year");
ok(inRange("12-30", "2026-12-28", "2027-01-03") === "2026-12-30" && inRange("01-02", "2026-12-28", "2027-01-03") === "2027-01-02", "a week across the new year");
ok(inRange("02-29", "2027-02-22", "2027-02-28") === "2027-02-28", "29 Feb falls on 28 Feb in a non-leap year");
const list = [{ name: "Ruzanna Avanyan", md: "11-10" }, { name: "Testy Person", md: "11-15" }, { name: "Zed Example", md: "11-04" }, { name: "Gone Person", md: "11-11", removed: true }, { name: "Later Person", md: "12-25" }];
const bd = birthdaysFor(list, "2026-11-09", "2026-10-26", people, rosterMatch);
ok(bd.map((x) => x.name).join() === "Zed,Rose,Testy", "this week plus the one missed since the last huddle (26 Oct); organogram first name (Rose); removed left out");
ok(bd[0].missed && /^last week, Wed 4 Nov$/.test(bd[0].when) && bd[1].when === "Tue 10 Nov" && bd.every((x) => x.on), "missed ones say last week; all ticked");
ok(!JSON.stringify(bd).match(/20\d\d|age|years? old/i), "no year and no age anywhere");
ok(birthdaysFor(list, "2026-11-09", "2026-11-02", people, rosterMatch).every((x) => !x.missed), "nothing missed when last week's huddle covered it");

// into the card: pre-accepted Momo draft; untick a name
await store.put("hud_birthdays", JSON.stringify(list));
const prev = await Hd.createCard(env, "2026-11-02"); prev.status = "Closed"; await store.put("hud_card_2026-11-02", JSON.stringify(prev));
const c = await Hd.createCard(env, "2026-11-09", undefined, {});
ok(c.momo.celebrations.accepted && c.sections.celebrations.state === "momo" && c.momo.celebrations.birthdays.length === 2, "Celebrations lists the week's birthdays, pre-accepted");
let r = await Hd.cardAction(env, { date: "2026-11-09", action: "bday_toggle", section: "celebrations", key: "Testy Person", on: false });
ok(r[0] === 200 && r[1].card.momo.celebrations.birthdays.find((x) => x.key === "Testy Person").on === false, "she can untick any name");
ok(!JSON.stringify(r[1].card.log || []).includes("Testy"), "the card log keeps the action, never the name");

// the Birthdays list: add, edit, soft remove, restore
r = await birthdayAction(env, { action: "bd_add", name: "New Starter", md: "11-12" }); ok(r[0] === 200, "add");
ok((await birthdayAction(env, { action: "bd_add", name: "Bad Date", md: "1990-11-12" }))[0] === 400, "a year is refused");
r = await birthdayAction(env, { action: "bd_edit", key: "New Starter", md: "11-13" }); ok(r[0] === 200 && (await readBirthdays(env)).find((x) => x.name === "New Starter").md === "11-13", "edit");
r = await birthdayAction(env, { action: "bd_remove", key: "New Starter" });
const kept = (await readBirthdays(env)).find((x) => x.name === "New Starter");
ok(r[0] === 200 && kept && kept.removed, "remove is soft: kept in the store, marked removed");
r = await birthdayAction(env, { action: "bd_restore", key: "New Starter" }); ok(!(await readBirthdays(env)).find((x) => x.name === "New Starter").removed, "Undo / Bring back");
const hr = (path, o) => Hd.huddleRoute(new Request("https://x" + path, o), env, new URL("https://x" + path), { person: () => "najjuko", page: (k, rk, b) => "<html><body>" + b + "</body></html>" });
let page = await (await hr("/momo/work/huddle/birthdays?key=K")).text();
ok(page.includes("Birthdays list") && page.includes("&#8592; Huddle") && page.includes("Home") && page.includes("never a year") && page.includes("Removed (1)"), "the Birthdays list page: Back, Home, cards, removed ones kept");
ok((await Hd.huddleRoute(new Request("https://x/momo/work/huddle/birthdays?key=K"), env, new URL("https://x/momo/work/huddle/birthdays?key=K"), { person: () => "kendall", page: (k, rk, b) => b })).status === 404, "her key only");
r = await (await hr("/momo/work/huddle/api?key=K", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bd_add", name: "Via Page", md: "11-14" }) })).json();
ok(r.ok, "the page's actions go through the huddle api");

// the live preview in every section sheet (presenter view from current values; tap to enlarge; last built slide when there is one)
page = await (await hr("/momo/work/huddle?key=K&date=2026-11-09")).text();
const js = page.slice(page.indexOf("(function(){"));
ok(/function preview\(id,keys\)/.test(js) && /h\+=preview\(id,keys\)/.test(js) && /h\+=preview\("market",\[\]\)/.test(js), "every section and the market sheet show the preview");
ok(/Preview of the slide/.test(js) && /className="pvo"/.test(js) && /Last built slide/.test(js) && /PREVIEW/.test(js), "tap to enlarge; the built slide when available (v822: FN-palette previews, birthdays via cel_bday_body)");
new Function(js.replace(/<\/script>[\s\S]*$/, "")); ok(true, "the card script parses");
ok(!LOGS.join("\n").match(/Ruzanna|Testy|Zed Example|New Starter/), "no birthday name in any log line");
console.log = console.log; process.stdout.write("test_v815_birthdays_preview: " + n + " checks passed\n");
