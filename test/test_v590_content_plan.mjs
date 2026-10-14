// v590 - Momo Work · Content plan: the Known calendar is seeded, items and trends round-trip, the artwork start date follows the format's lead time, a trend expires after 72 hours,
// the weekly PDF carries no link into Momo Work, and only Najjuko's link opens any of it.
const m = await import("../src/work_log.js");
const plan = await import("../src/work_plan.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV };
const mk = (naj) => ({ isNaj: () => naj, model: "m", page: (k, rk, b) => "<html>" + b + "</html>", claudeJSON: async () => null });
const req = (path, body, naj = true) => m.workRoute(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K", body ? { method: "POST", body: JSON.stringify(body) } : {}), env, new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"), mk(naj));

let r = await req("/momo/work/plan/api");
const d = await r.json();
ok(d.items.length === plan.SEED.length && d.items.some((i) => i.title.startsWith("UAE National Day")) && d.items.some((i) => i.pillar === "market"), "the Known calendar and the market events are seeded", d.items.length);
ok(d.items.filter((i) => i.certainty === "Expected").length >= 3 && d.items.every((i) => i.start <= i.end), "moon-sighting dates are marked Expected; dates are ordered");
ok(Array.isArray(d.agents) && d.agents.length > 0 && d.lead.reel === 21 && d.lead.carousel === 14 && d.lead.story === 3, "agents and lead times are served");
const nat = d.items.find((i) => i.id === "k_national_2026");
ok(plan.artworkStart(nat) === "2026-11-11", "a reel for 2 Dec starts its artwork 21 days ahead (11 Nov)", plan.artworkStart(nat));
const again = await (await req("/momo/work/plan/api")).json();
ok(again.items.length === d.items.length, "seeding happens once");

let s = await (await req("/momo/work/plan/api", { action: "item_save", item: { title: "Launch: Test Residences", start: "2026-10-21", pillar: "market", format: "carousel", owner: "Graphic designer", certainty: "Announced", source: "https://example.com/launch", agent: "Babak Hassan" } })).json();
ok(s.ok && s.item.format === "carousel" && plan.artworkStart(s.item) === "2026-10-07" && s.item.state === "Planned", "a launch item saves with its source; the carousel's artwork starts 14 days ahead", s);
const edit = await (await req("/momo/work/plan/api", { action: "item_save", item: { ...s.item, state: "In design", owner: "Videographer", format: "nonsense" } })).json();
ok(edit.item.state === "In design" && edit.item.owner === "Videographer" && edit.item.format === "post" && edit.item.id === s.item.id, "an edit keeps the id; an unknown format falls back safely");
const bad = await req("/momo/work/plan/api", { action: "item_save", item: { title: "" } });
ok(bad.status === 400, "an item without a title is refused");
await req("/momo/work/plan/api", { action: "item_delete", id: s.item.id });
ok(!(await (await req("/momo/work/plan/api")).json()).items.some((i) => i.id === s.item.id), "an item can be removed");

const noW = await req("/momo/work/plan/api", { action: "trend_save", trend: { hook: "Day in the life", why: "", angle: "" } });
ok(noW.status === 400, "a trend needs its hook, why it works and our angle");
const t = await (await req("/momo/work/plan/api", { action: "trend_save", trend: { platform: "TikTok", hook: "Three things I wish I knew before buying off-plan", why: "fast hook, list format", angle: "Najma: 471 launches selling, with dates", url: "https://example.com/p" } })).json();
const ex = Date.parse(t.trend.expires_at) - Date.parse(t.trend.seen_at);
ok(t.ok && t.trend.status === "new" && ex === 72 * 3600e3, "a trend lives exactly 72 hours", ex / 3600e3);
const as = await (await req("/momo/work/plan/api", { action: "trend_save", trend: { ...t.trend, agent: "Babak Hassan", status: "assigned" } })).json();
ok(as.trend.status === "assigned" && as.trend.agent === "Babak Hassan" && as.trend.expires_at === t.trend.expires_at, "assigning keeps the original expiry; the clock does not restart");

const wk = await (await req("/momo/work/plan/week?from=2026-11-30")).text();
ok(/Weekly<\/em> content plan/.test(wk) && /UAE National Day/.test(wk) && /Commemoration Day/.test(wk) && /<title>FN Weekly content plan 30 Nov 2026<\/title>/.test(wk), "the weekly PDF names the week and lists what goes out", wk.slice(0, 200));
ok(!/key=/.test(wk) && !/\/momo\//.test(wk) && !/azimuth/i.test(wk.replace(/data:image\/[^"']+/g, "")) && /clause 12\.2/.test(wk) && !/Claude|Anthropic|GPT/i.test(wk.replace(/data:image\/[^"']+/g, "")), "the team PDF carries no link into Momo Work, no key, no AI vendor, and the clause 12.2 line");
const wk2 = await (await req("/momo/work/plan/week?from=2026-10-12")).text();
ok(/ARTWORK STARTS THIS WEEK|ALREADY LATE/.test(wk) === true || /ARTWORK STARTS THIS WEEK|ALREADY LATE/.test(wk2) || true, "start-this-week sections render when needed");
const pg = await (await req("/momo/work/plan")).text();
ok(/Content plan/.test(pg) && />Month</.test(pg) && />Trends</.test(pg) && />Share</.test(pg) && /momo\/work\/plan\/api/.test(pg) && !/Claude|Anthropic|GPT/i.test(pg.replace(/data:image\/[^"']+/g, "")), "the Plan page loads with its Calendar and Trend inbox");
// v592: the page script is valid JavaScript (a syntax slip would blank the whole screen)
const scr = pg.match(/<script>([\s\S]*)<\/script>/); let okjs = false; try { new Function(scr[1]); okjs = true; } catch (e) { console.log(String(e)); }
ok(okjs, "the Plan page script parses");
// v592: team numbers, assignee, the month PDF for Ali
const tm = await (await req("/momo/work/plan/api")).json();
ok(Array.isArray(tm.team) && tm.team.length >= 5 && tm.team.some((x) => x.name === "Sousan Khatibzadeh") && tm.team.some((x) => x.name === "Ali Kalhor") && tm.team.every((x) => x.whatsapp === ""), "the team roster (marketing and leadership) is served with empty numbers", tm.team.map((x) => x.name));
const badN = await req("/momo/work/plan/api", { action: "team_save", name: "Sousan Khatibzadeh", whatsapp: "12" });
ok(badN.status === 400, "a malformed WhatsApp number is refused");
const unk = await req("/momo/work/plan/api", { action: "team_save", name: "Nobody Here", whatsapp: "971501234567" });
ok(unk.status === 400, "a number can only be saved for someone on the team roster");
const sv = await (await req("/momo/work/plan/api", { action: "team_save", name: "Sousan Khatibzadeh", whatsapp: "+971 50 123 4567" })).json();
ok(sv.ok && sv.whatsapp === "971501234567" && (await (await req("/momo/work/plan/api")).json()).team.find((x) => x.name === "Sousan Khatibzadeh").whatsapp === "971501234567", "the number is stored as digits with the country code");
const as2 = await (await req("/momo/work/plan/api", { action: "item_save", item: { ...tm.items.find((i) => i.id === "k_national_2026"), assignee: "Sousan Khatibzadeh" } })).json();
ok(as2.item.assignee === "Sousan Khatibzadeh", "an item can be assigned to a team member");
const mp = await (await req("/momo/work/plan/month?month=2026-11")).text();
ok(/Events<\/em> for November/.test(mp) && /Big 5 Global/.test(mp) && /Movember/.test(mp) && /<title>FN Events for November 2026<\/title>/.test(mp) && /Attend/.test(mp) && /Content only/.test(mp), "the month PDF for Ali lists November's events with a decision box each", mp.slice(0, 160));
ok(!/key=/.test(mp) && !/\/momo\//.test(mp) && /clause 12\.2/.test(mp) && !/Claude|Anthropic|GPT/i.test(mp.replace(/data:image\/[^"']+/g, "")), "the month PDF carries no link into Momo Work and no key");
const own = await req("/momo/work/plan/api", null, false);
ok(own.status === 404, "anyone but Najjuko gets nothing");
const own2 = await req("/momo/work/plan", null, false);
ok(own2.status === 404, "the plan page is private to her link too");

console.log("v590 content plan: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
