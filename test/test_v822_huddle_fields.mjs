// v822 - Najjuko's field list wired in: every field has its section and slide, maxima, fixed fields read-only; the bridge hands render_edition.py the
// edition JSON in exactly her shape; Momo fills celebrations and the schedule; recognition untouched. Made-up values; no real birthdays.
import assert from "node:assert/strict";
import fs from "node:fs";
import * as Hd from "../src/huddle.js";
import { HUDDLE_FIELDS } from "../src/huddle_fields.js";
import { bridgeRoute } from "../src/work_bridge.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) }; }
const NAJ = "naj_" + "x".repeat(40), store = kv(), env = { MEETINGS: store, MOMO_BRIDGE_KEYS: "najjuko:" + NAJ };

// the list itself (and, when her file is on this machine, that it matches it one to one)
ok(HUDDLE_FIELDS.length === 146 && new Set(HUDDLE_FIELDS.map((r) => r[0])).size === 146, "146 fields, no duplicates");
const src = "C:\\Users\\kwils\\Downloads\\huddle-form-fields.json";
if (fs.existsSync(src)) { const j = JSON.parse(fs.readFileSync(src, "utf8")); ok(j.fields.map((f) => f.field).join() === HUDDLE_FIELDS.map((r) => r[0]).join() && j.fields.every((f, i) => HUDDLE_FIELDS[i][6] === f.longest_so_far && HUDDLE_FIELDS[i][7] === Math.ceil(1.3 * f.longest_so_far)), "matches huddle-form-fields.json field for field (max = 1.3 x longest)"); }
const sec = Object.fromEntries(HUDDLE_FIELDS.map((r) => [r[0], r[3]]));
ok(HUDDLE_FIELDS.every((r) => r[3] === "" ? ["_about", "huddle_date", "skip_slides"].includes(r[0]) : Hd.sectionOfKey(r[0]) === r[3]), "every field has its card section (system fields none)");
ok(HUDDLE_FIELDS.filter((r) => r[1]).every((r) => /^\d+ /.test(r[2])), "every slide field carries its slide label");
ok(["_about", "huddle_date", "next_huddle", "agenda_03", "agenda_04", "mantra_theme", "mantra", "mantra_notes"].every((k) => Hd.FIELD_META[k].editable === false) && HUDDLE_FIELDS.filter((r) => r[8]).length === 138, "Fixed / Auto / team-mantra fields are read-only");
ok(Hd.THEME_TITLE_KEY === "cover_title_line1" && Hd.DATE_FIELDS[0] === "huddle_date" && Hd.SEGMENTS.find((s) => s.n === "07").slides.join() === "13", "the v810 TODO filled: theme key, date field, run of show");

// last week (with a recognition the card must not touch), birthdays for the week
await store.put("hud_birthdays", JSON.stringify([{ name: "Sample Person", md: "11-10" }]));
const prev = await Hd.createCard(env, "2026-11-02"); prev.status = "Closed"; prev.form = Object.assign({}, prev.form, { rec_headline: "Top of the month", rec_1st: "Agent A", cel_bday_body: [], dept1_body: ["Item one", "Item two"] });
await store.put("hud_card_2026-11-02", JSON.stringify(prev));
const cal = async (e, d) => ({ connected: true, events: d === "2026-11-09" ? [{ time: "09:00", title: "Weekly huddle" }] : [] });
const c = await Hd.createCard(env, "2026-11-09", undefined, { cal });
ok(c.form.rec_headline === "Top of the month" && c.form.rec_1st === "Agent A" && !(c.momo_filled || []).some((k) => /^rec_/.test(k)), "recognition is left unchanged");
ok(Array.isArray(c.form.cel_bday_body) && c.form.cel_bday_body[0] === "Sample · Tue 10 Nov" && (c.form.cel_days_body === "" || typeof c.form.cel_days_body === "string"), "celebrations: birthdays into cel_bday_body (same shape as last week's), days into cel_days_body");
ok(c.form.week_range === "9–15 Nov 2026" && c.form.day1_name === "Monday" && c.form.day1_date === "9 Nov" && c.form.day4_name === "Thursday" && c.form.day1_event === "Weekly huddle" && c.form.day1_time === "09:00" && c.form.day2_event === "", "schedule: the week, Mon-Thu, events from her calendar; last week's not carried");
ok(c.form.huddle_date === "2026-11-09" && c.form.next_huddle === "Monday 16 November 2026", "huddle_date and next_huddle set for the week");
let r = await Hd.cardAction(env, { date: "2026-11-09", action: "bday_toggle", section: "celebrations", key: "Sample Person", on: false });
ok(r[1].card.form.cel_bday_body.length === 0, "unticking a birthday takes it off the slide field");

// round trip: fill every editable field through the card (market through the bridge, as her Claude does), then the edition must equal the list
const val = (r0) => { const v = ("V-" + r0[0] + "-").repeat(5).slice(0, Math.min(r0[7], 24)); return r0[5] === "list" ? [v, v + "2"] : v; };
const want = {};
for (const sid of ["theme", "recognition", "announcements", "celebrations", "tip", "schedule", "mantra"]) {
  const vals = {}; for (const r0 of HUDDLE_FIELDS.filter((x) => x[3] === sid && x[8])) { vals[r0[0]] = val(r0); want[r0[0]] = vals[r0[0]]; }
  r = await Hd.cardAction(env, { date: "2026-11-09", action: "edit", section: sid, values: vals });
  ok(r[0] === 200, "edit " + sid + " " + (r[1].error || ""));
}
const mvals = {}; for (const r0 of HUDDLE_FIELDS.filter((x) => x[3] === "market" && x[8])) { mvals[r0[0]] = val(r0); want[r0[0]] = mvals[r0[0]]; }
const B = "https://x.test/momo/bridge/v1/", call = (p, o) => bridgeRoute(new Request(B + p, Object.assign({ headers: Object.assign({ "Content-Type": "application/json", Authorization: "Bearer " + NAJ }, o && o.h) }, o)), env, new URL(B + p));
r = await call("huddle/2026-11-09/form", { method: "PUT", h: { "Idempotency-Key": "v822-market-1" }, body: JSON.stringify({ form: mvals }) });
ok(r.status === 200, "market slide text through the bridge");
const ed = (await (await call("huddle/2026-11-09", {})).json()).data.edition;
ok(Object.keys(ed).join() === HUDDLE_FIELDS.map((r0) => r0[0]).join(), "the edition has exactly her fields, in her order");
const missing = Object.keys(want).filter((k) => JSON.stringify(ed[k]) !== JSON.stringify(want[k]));
ok(!missing.length, "every editable field came through the card into the edition unchanged: " + missing.slice(0, 5).join());
ok(ed.huddle_date === "2026-11-09" && ed.next_huddle === "Monday 16 November 2026" && Array.isArray(ed.skip_slides) && ed._about === "" && ed.agenda_03 === "", "fixed and auto fields as her build expects; empty = \"\"");
ok(Hd.editionPlaceholders(await Hd.getCard(env, "2026-11-09")).keys.every((k) => !Hd.FIELD_META[k.split(/[.[]/)[0]] || !Hd.FIELD_META[k.split(/[.[]/)[0]].editable || /_notes/.test(k)) , "nothing she must fill is left empty");
// an empty editable field stays "" (her gold [placeholder]) and is counted
await Hd.cardAction(env, { date: "2026-11-09", action: "edit", section: "tip", values: { tip_strip: "" } });
const c2 = await Hd.getCard(env, "2026-11-09");
ok(Hd.editionOf(c2).tip_strip === "" && Hd.editionPlaceholders(c2).keys.includes("tip_strip"), "an empty field is \"\" in the edition and counted as a placeholder");

// rules: read-only, maxima, the tip never names a person
r = await Hd.cardAction(env, { date: "2026-11-09", action: "edit", section: "mantra", values: { mantra: "Changed" } });
ok((await Hd.getCard(env, "2026-11-09")).form.mantra !== "Changed", "a fixed field cannot be changed from the card");
r = await Hd.cardAction(env, { date: "2026-11-09", action: "edit", section: "theme", values: { cover_title_line1: "x".repeat(Hd.FIELD_META.cover_title_line1.max + 1) } });
ok(r[0] === 400 && /max 29/.test(r[1].error), "over the maximum is refused");
r = await call("huddle/2026-11-09/form", { method: "PUT", h: { "Idempotency-Key": "v822-long-1" }, body: JSON.stringify({ form: { s4_headline: "y".repeat(80) } }) });
ok(r.status === 400, "the bridge enforces the maxima too");
r = await Hd.cardAction(env, { date: "2026-11-09", action: "edit", section: "tip", values: { tip_title: "Sousan, reply faster" } });
ok(r[0] === 400 && /leave out names/.test(r[1].error), "the tip is never aimed at one person");

// the page: labels, maxlength + counter, notes multi-line, fixed read-only, the fixed slides, FN-palette previews
const page = await (await Hd.huddleRoute(new Request("https://x/momo/work/huddle?key=K&date=2026-11-09"), env, new URL("https://x/momo/work/huddle?key=K&date=2026-11-09"), { person: () => "najjuko", page: (k, rk, b) => "<html><body>" + b + "</body></html>" })).text();
ok(page.includes('maxlength="') && page.includes("data-c=") && page.includes(".cc.full") && /notes\/\.test\(M\.type\|\|""\)\?7/.test(page), "editor: maximum, live counter, notes multi-line");
ok(page.includes(" <span class=sl>fixed</span>") && page.includes("Nothing to do. This slide is fixed.") && page.includes('"Agenda",""'), "fixed fields read-only; the agenda is a fixed slide (v823 list)");
ok(page.includes("#F9F1EF") && page.includes("#C9A97A") && page.includes("family=Anton") && page.includes("PREVIEW") && page.includes("CONFIDENTIAL · FN Realty internal use only"), "previews in the FN palette and fonts, labelled preview, with the confidentiality footer");
new Function(page.slice(page.indexOf("(function(){")).replace(/<\/script>[\s\S]*$/, "")); ok(true, "the card script parses");
console.log("test_v822_huddle_fields: " + n + " checks passed");
