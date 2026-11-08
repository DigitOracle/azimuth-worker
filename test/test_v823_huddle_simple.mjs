// v823 - "dumb down this interface": the card is her slides, numbered, in her order; each opens ONE question; Momo drafts; Accept / Redo; Done ✓.
// Theme from the YouTube clip (Data API + captions when published, else title + description); project of the week only from the developer's own
// material; sales first names; departments sorted; the MD's week Mon-Sat. Network is stubbed; made-up values only.
import assert from "node:assert/strict";
import * as Hd from "../src/huddle.js";
import { ytId, ytRead } from "../src/yt_read.js";
import { projectFrom, salesFrom, deptsFrom, weekFrom, tipValues, TIPS } from "../src/huddle_project.js";
import { bridgeRoute } from "../src/work_bridge.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const LOGS = []; for (const lv of ["log", "info", "warn", "error"]) { const o = console[lv]; console[lv] = (...a) => { LOGS.push(a.map(String).join(" ")); if (process.env.V) o(...a); }; }
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) }; }
const KEY = "TESTKEY_never_shown_123", NAJ = "naj_" + "x".repeat(40), store = kv(), env = { MEETINGS: store, YOUTUBE_API_KEY: KEY, MOMO_BRIDGE_KEYS: "najjuko:" + NAJ };
const seen = [];
const yfetch = (captions) => async (u) => { seen.push(String(u)); const s = String(u);
  if (s.includes("/youtube/v3/videos")) return new Response(JSON.stringify({ items: [{ snippet: { title: "Never Give Up On The Sale", description: "Persistence wins deals. Focus on the one client in front of you. Courage to ask for the close is what separates top agents. https://example.com", channelTitle: "Sales Talks" }, contentDetails: { duration: "PT9M" } }] }));
  if (s.includes("timedtext")) return new Response(captions ? "<transcript><text>Keep calling back, persistence is everything in sales and the deal comes to those who follow up again and again</text></transcript>" : "", { status: 200 });
  return new Response("{}", { status: 404 }); };

ok(ytId("https://youtu.be/k0GD3tZdf-k") === "k0GD3tZdf-k" && ytId("https://www.youtube.com/watch?v=k0GD3tZdf-k&t=3") === "k0GD3tZdf-k" && !ytId("https://vimeo.com/1"), "YouTube links recognised");
let y = await ytRead(env, "https://youtu.be/k0GD3tZdf-k", yfetch(false));
ok(y.title === "Never Give Up On The Sale" && y.captions_ok === false, "no captions: title + description");
y = await ytRead(env, "https://youtu.be/k0GD3tZdf-k", yfetch(true));
ok(y.captions_ok && /persistence/.test(y.captions), "captions read when published");
ok((await ytRead({ MEETINGS: store }, "https://youtu.be/k0GD3tZdf-k", yfetch(true))).error.includes("not switched on"), "no key on the worker: says so");

// the card
const prev = await Hd.createCard(env, "2026-11-02"); prev.status = "Closed"; prev.form = Object.assign({}, prev.form, { dept3_label: "HR", dept3_title: "HR reminders", dept3_body: ["Submit leave requests in Momo"] }); await store.put("hud_card_2026-11-02", JSON.stringify(prev));
await store.put("work_naj_2026-11-04_e1", JSON.stringify({ id: "e1", date: "2026-11-04", title: "Off-plan booking Sobha", type: "Outreach", people: ["Ruzanna Avanyan (Rose)"], broker_tasks: ["booking"] }));
await Hd.createCard(env, "2026-11-09", undefined, {});
const act = (b, deps) => Hd.cardAction(env, Object.assign({ date: "2026-11-09" }, b), undefined, deps);
let c = Hd.cardOut(await Hd.getCard(env, "2026-11-09"));
ok(c.section_status.theme === "Needs link" && c.section_status.mantra === "Done ✓" && c.section_status.shoutouts === "Done ✓" && c.section_status.tip === "Ready to check", "statuses: needs link; mantra and shout-outs carried; tip suggested");
ok(c.next_step === "paste this week's YouTube link", "next step in plain words");
ok(Hd.SLIDE_ORDER.map((r) => r[1]).join("|") === "Cover|Agenda|Clip & pillars|Market|Project of the week|Company updates|Mortgage|Celebrating every sale|Celebrating people & moments|Success tips|Schedule Mon–Sat|Shout-outs|Mantra|Close", "the card lists her slides in her order");

// Theme & clip: one link -> both slides drafted; captions used or the fallback said; the key never leaves
let r = await act({ action: "theme_link", section: "theme", url: "https://youtu.be/k0GD3tZdf-k" }, { fetch: yfetch(false) });
ok(r[0] === 200 && r[1].card.section_status.theme === "Ready to check" && r[1].card.drafts.theme.captions === false, "link -> drafted; no-captions recorded");
ok(r[1].card.form.clip_url === "https://www.youtube.com/watch?v=k0GD3tZdf-k" && /Never Give Up/.test(r[1].card.form.clip_label) && r[1].card.form.pillar1_text && r[1].card.form.pillar3_text, "clip fields and three pillars filled");
const deps = { fetch: yfetch(true), model: "m", claudeJSON: async (e, sys, user, schema) => { deps.sys = sys; deps.user = user; return Object.fromEntries(Object.keys(schema.properties).map((k) => [k, k === "pillar1_title" ? "Persistence" : k === "pillar2_title" ? "Focus" : k === "pillar3_title" ? "Courage" : "Text for " + k])); } };
r = await act({ action: "redo", section: "theme" }, deps);
ok(/SALES PERSPECTIVE/.test(deps.sys) && /Captions \(automatic\)/.test(deps.user) && r[1].card.form.pillar1_title === "Persistence" && r[1].card.drafts.theme.captions, "Redo drafts again from a sales perspective, from the captions");
ok(Object.keys(r[1].card.form).every((k) => !Hd.FIELD_META[k] || String(r[1].card.form[k]).length <= Hd.FIELD_META[k].max || Array.isArray(r[1].card.form[k])), "every drafted value within the slide's maximum");
ok(!JSON.stringify(r[1].card).includes(KEY) && !LOGS.join("\n").includes(KEY), "the YouTube key is never in the card or a log");
r = await act({ action: "accept_section", section: "theme" });
ok(r[1].card.section_status.theme === "Done ✓", "Accept: Done ✓");

// Project of the week: developer material only, sources, placeholders for the rest
ok(projectFrom("Palm Springs\nhttps://www.propertyfinder.ae/x from AED 3.3M", "2026-11-08").error, "portals refused");
r = await act({ action: "paste", section: "project", text: "Palm Springs\nby Nakheel\nhttps://www.nakheel.com/palm-springs\nVillas from AED 3.8M, 4 and 5 bedroom villas, payment plan 60/40, handover Q4 2028" });
const pf = r[1].card.extra_slides.project_of_week;
ok(pf.project_name === "Palm Springs" && pf.project_price_from === "From AED 3.8M" && pf.project_payment_plan === "60/40" && pf.project_handover === "Q4 2028" && /nakheel\.com/.test(pf.project_source), "figures only from the developer's material, with the source");
ok(r[1].card.extra_slides.project_sources.project_price_from && r[1].card.section_status.project === "Ready to check", "each figure carries its source");
// Mortgage
r = await act({ action: "paste", section: "mortgage", text: "Emirates NBD: fixed 3.99% for 3 years\nLTV 80% for first-time buyers\nPartner broker: Home Finance Co" });
const mf = r[1].card.extra_slides.mortgage;
ok(/3\.99%/.test(mf.mort_market) && /Emirates NBD|Partner broker/.test(mf.mort_partners) && /Palm Springs: 60\/40/.test(mf.mort_dev_plan) && /pasted by Najjuko/.test(mf.mort_source), "mortgage: market, partners, the project's payment plan, sources");
// Celebrating every sale: first names; suggestions from the work log
ok((r[1].card.sales_suggest || []).some((x) => /^Rose, Off-plan, /.test(x)), "suggestions from her work-log deal steps (first names)");
r = await act({ action: "paste", section: "recognition", text: "Sally Zehil, off-plan, Sobha One\nRevant Vaish, rental, JVC\nAdnan Shafi, secondary sale, Arjan" });
ok(r[1].card.form.rec_1st === "Sally" && r[1].card.form.rec_2nd === "Revant" && /Off-plan 1 · Rental 1 · Secondary 1/.test(r[1].card.form.rec_bar), "first names only on the slide; deal types counted");
// Company updates: sorted by department, the standing HR card kept
r = await act({ action: "paste", section: "announcements", text: "Marketing: New brochure out\nPrinted copies at reception\nBusiness Development: Two new partner agencies" });
ok(r[1].card.form.dept1_label === "Marketing" && ["Business Development", "BD"].includes(r[1].card.form.dept2_label) && r[1].card.form.dept3_title === "HR reminders", "sorted by department; the standing HR reminders card stays");
// Schedule: the MD's week, Monday to Saturday, mandatory / optional, focus line
const w = weekFrom("Tuesday 10:00 Emaar briefing at their office (mandatory)\nThursday launch at Dubai Hills\nSaturday 11am shoot at the office, optional\nFocus: off-plan follow-ups", "2026-11-09", Hd.FIELD_META, [{ date: "2026-11-13", title: "Sobha Orbis" }]);
ok(w.values.day1_name === "Tuesday" && w.values.day1_time === "10:00" && /^Mandatory · /.test(w.values.day1_purpose) && w.values.day1_place.startsWith("their office") && w.values.day2_name === "Thursday", "items by day, time, place, mandatory");
ok(w.values.day4_name === "Saturday" && /^Optional/.test(w.values.day4_purpose) && w.values.focus_strip === "off-plan follow-ups" && w.items.some((x) => /reported/.test(x.t)), "Saturday included; optional; focus; Launch Radar marked reported");
r = await act({ action: "paste", section: "schedule", text: "Monday 9:00 Weekly huddle\nWednesday Developer visit to our office" }, { kv: async () => ({ events: [] }) });
ok(r[1].card.form.day1_event && r[1].card.form.day2_name === "Wednesday" && r[1].card.form.day3_name === "", "pasted week laid out; empty days left as placeholders");
// Tip: suggested, another, own idea (never a name)
ok(c.form.tip_title === tipValues(Math.floor(Date.parse("2026-11-09") / (7 * 864e5)), Hd.FIELD_META).tip_title && /^WHY IT WORKS/.test(c.form.tip_strip), "this week's suggested tip: the tip, what it means, why it works");
r = await act({ action: "redo", section: "tip" });
ok(r[1].card.form.tip_title !== c.form.tip_title && TIPS.some((t) => t.title === r[1].card.form.tip_title), "Another tip");
ok((await act({ action: "paste", section: "tip", text: "Sousan should reply faster" }))[0] === 400, "her own tip: no names");
// Shout-outs: optional
r = await act({ action: "paste", section: "shoutouts", text: "Marketing team: the new brochure looks great\nFaez: thank you for the launch access" });
ok(r[1].card.extra_slides.shoutouts.s13_title === "SHOUT-OUTS" && r[1].card.extra_slides.shoutouts.items.length === 2, "shout-outs: SHOUT-OUTS slide with the list");
// the bridge hands her Claude the edition plus the new slides and the order
const B = "https://x.test/momo/bridge/v1/", j = await (await bridgeRoute(new Request(B + "huddle/2026-11-09", { headers: { Authorization: "Bearer " + NAJ } }), env, new URL(B + "huddle/2026-11-09"))).json();
ok(j.data.edition && Object.keys(j.data.edition).length === 146 && j.data.extra_slides.project_of_week.project_price_from === "From AED 3.8M" && j.data.slide_order.length === 14, "bridge: the edition (unchanged shape), the extra slides, the slide order");
// readiness and the build
for (const sx of ["project", "mortgage", "recognition", "announcements", "schedule", "tip", "celebrations"]) await act({ action: "accept_section", section: sx });
const t4 = Hd.cardOut(await Hd.getCard(env, "2026-11-09")).market.topics; await act({ action: "pick", ids: [] });
c = Hd.cardOut(await Hd.getCard(env, "2026-11-09"));
ok(c.ready_count === 8 && c.section_status.market !== "Done ✓", "8 of the 9 weekly cards done; market still to tick");

// the page: list, one question per pop-up, Back/Close and Home everywhere
const page = await (await Hd.huddleRoute(new Request("https://x/momo/work/huddle?key=K&date=2026-11-09"), env, new URL("https://x/momo/work/huddle?key=K&date=2026-11-09"), { person: () => "najjuko", page: (k, rk, b) => "<html><body>" + b + "</body></html>" })).text();
ok(page.includes("slides ready</b>") && page.includes("openRow(") && page.includes("Nothing to do. This slide is fixed.") && page.includes("Same mantra?") && page.includes("Nothing to do. Thank you, have a great week."), "the list; fixed slides say there is nothing to do");
ok(page.includes("s YouTube link</label>") && page.includes("Who closed this week?") && page.includes("Paste the MD's week") && page.includes("Project name + developer link or brochure") && page.includes("s suggested tip?</p>") && page.includes("s birthdays and days. Accept?</p>"), "one question per pop-up");
ok(page.includes("data-back=1>&#8592; Back") && page.includes(">Home</a>") && page.includes("&#8592; Close") && /<summary>Edit details<\/summary>/.test(page) && page.includes("Build huddle"), "Back + Home on every pop-up; Close on the enlarged preview; Edit details hidden; Build huddle");
new Function(page.slice(page.indexOf("(function(){")).replace(/<\/script>[\s\S]*$/, "")); ok(true, "the card script parses");
console.log = console.log; process.stdout.write("test_v823_huddle_simple: " + n + " checks passed\n");
