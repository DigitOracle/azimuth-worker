// v834 (Kendall 11 Nov 2026): the monthly market note - ingest, approval screen, audit, send job, audience and the month guard.
// Nothing here touches the network: fetch throws, and the dry campStep only builds payloads.
import { campaignRoute, campStep } from "../src/campaigns.js";
import { ingestNotes, checkNoteText, areaAudience, noteCampaign, MKT_NOTE_FLOW, syncSent } from "../src/market_note.js";

const store = new Map();
const env = { READ_KEY: "rk-owner", WA_DESK_PHONE_ID: "111", WHATSAPP_TOKEN: "t",
  MEETINGS: { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } } };
const put = (k, v) => store.set(k, JSON.stringify(v)), getj = (k) => JSON.parse(store.get(k) || "null");
let n = 0; const ok = (c, m, x) => { if (!c) { console.error("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); process.exit(1); } n++; };
const NOW = Date.parse("2026-12-01T08:00:00Z");   // Tue 1 Dec 12:00 Dubai
const najDeps = { now: NOW, person: () => "najjuko", isNaj: () => true, fetch: async () => { throw new Error("no network"); } };
const ownDeps = { now: NOW, fetch: async () => { throw new Error("no network"); } };
const req = (path, key, body) => new Request("https://x" + path + (path.includes("?") ? "&" : "?") + "key=" + key, body ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {});
const call = async (path, key, body, deps) => { const u = new URL(req(path, key).url); return campaignRoute(req(path, key, body), env, u, deps); };
const T1 = "New 1-bed leases average AED 90k a year (up 3%), and registered sales ran near AED 2,060/sq ft (down 3%).";

// 1. text rules
ok(checkNoteText(T1) === "", "a good note passes");
ok(/banned/.test(checkNoteText("Get a free valuation today")), "valuation refused");
ok(/banned/.test(checkNoteText("ask for an appraisal")), "appraisal refused");
ok(/banned/.test(checkNoteText("your home is worth more")), "worth refused");
ok(/200/.test(checkNoteText("x".repeat(200))), "200 characters refused");
ok(/newline/.test(checkNoteText("a\nb")) && /newline/.test(checkNoteText("see https://x.y")), "newline and link refused");

// 2. ingest: writes drafts and thin, refuses a banned draft, never overwrites a decision
let r = await ingestNotes(env, { month: "202612", mktNotes: [
  { month: "202612", area_slug: "dubai-marina", area_name: "Dubai Marina", text: T1, status: "draft", metrics: { rent: { 1: { med: 90000, n: 1898, qoq: 3, n_prv: 1800 } }, sale: { psf: 2060, n: 772, qoq: -3 }, as_of: { ejari: "2026-11-30", dld: "2026-11-15" } } },
  { month: "202612", area_slug: "palm-jebel-ali", area_name: "Palm Jebel Ali", text: "", status: "thin", reason: "thin: 1 usable clause (needs 2)" },
  { month: "202612", area_slug: "jvc", area_name: "JVC", text: "A free valuation for you", status: "draft" },
] }, NOW);
ok(r.ok && r.written.length === 2 && r.rejected.length === 1 && r.rejected[0].slug === "jvc", "ingest writes 2, refuses the banned one", r);
ok(getj("mkt_note_202612_dubai-marina").status === "draft" && getj("mkt_note_202612_palm-jebel-ali").status === "thin", "draft + thin stored");
ok((await ingestNotes(env, { month: "2026-12", mktNotes: [] }, NOW)).ok === false, "bad month refused");

// 3. contacts: tagged + consented, tagged without consent, opted out, other area
put("camp_contact_index", ["971500000001", "971500000002", "971500000003", "971500000004", "971500000005"]);
const C = (d, tags, cons, extra) => put("camp_contact_" + d, Object.assign({ e164: "+" + d, name: "Owner " + d.slice(-1), tags, consent: { text: "said yes on WhatsApp", date: "2026-11-08" }, consents: cons ? { "market-updates": { value: true } } : {} }, extra || {}));
C("971500000001", ["pja-frond-b", "area-dubai-marina"], true);
C("971500000002", ["area-dubai-marina"], false);
C("971500000003", ["area-dubai-marina"], true, { opted_out: true });
C("971500000004", ["area-jvc"], true);
C("971500000005", ["area-dubai-marina", "nurture"], false);   // the tag nurture counts as the yes
const aud = await areaAudience(env, "dubai-marina");
ok(aud.n === 2 && aud.no_consent === 1, "audience: consent or nurture, opted-out and other areas left out", aud);

// 4. the screen: both viewers; Najjuko approves; edits are re-checked; audit
let res = await call("/momo/campaigns/notes?m=202612", "naj", null, najDeps); let html = await res.text();
ok(res.status === 200 && html.includes("Market notes") && html.includes("Dubai Marina") && html.includes("goes to 2 owners") && html.includes("Too few records"), "screen renders for Najjuko", html.slice(0, 300));
ok(!html.includes("Send all approved"), "no Send button for Najjuko or before approval");
ok((await call("/momo/campaigns/notes?m=202612", "nobody", null, { now: NOW })).status === 404, "no key, no screen");
res = await call("/momo/campaigns/notes/api", "naj", { action: "edit", m: "202612", slug: "dubai-marina", text: T1 + " A valuation is free." }, najDeps);
ok(res.status === 400 && /banned|200/.test((await res.json()).error), "an edit with a banned word / too long is refused");
res = await call("/momo/campaigns/notes/api", "naj", { action: "edit", m: "202612", slug: "dubai-marina", text: "New 1-bed leases average AED 90k a year (up 3%)." }, najDeps);
ok(res.status === 200 && getj("mkt_note_202612_dubai-marina").edited === true && getj("mkt_note_202612_dubai-marina").text_draft === T1, "edit saved, draft kept");
res = await call("/momo/campaigns/notes/api", "naj", { action: "approve", m: "202612", slug: "palm-jebel-ali" }, najDeps);
ok(res.status === 409, "a thin note cannot be approved");
res = await call("/momo/campaigns/notes/api", "naj", { action: "approve", m: "202612", slug: "dubai-marina" }, najDeps);
ok(res.status === 200 && getj("mkt_note_202612_dubai-marina").status === "approved" && getj("mkt_note_202612_dubai-marina").approved_by === "najjuko", "Najjuko approves");
res = await call("/momo/campaigns/notes/api", "naj", { action: "skip", m: "202612", slug: "palm-jebel-ali", reason: "too thin" }, najDeps);
ok(res.status === 200 && getj("mkt_note_202612_palm-jebel-ali").status === "skipped", "skip with a reason");
const log = getj("mkt_note_log_202612");
ok(log.length === 3 && log[0].action === "edit" && log[0].before === T1 && log[1].who === "najjuko" && log[2].reason === "too thin", "audit: edit before/after, who, reason", log);
r = await ingestNotes(env, { month: "202612", mktNotes: [{ month: "202612", area_slug: "dubai-marina", area_name: "Dubai Marina", text: T1, status: "draft" }] }, NOW);
ok(r.kept.length === 1 && getj("mkt_note_202612_dubai-marina").status === "approved", "a re-run never overwrites an approved note");

// 5. send job: owner only, confirm, template APPROVED, flow installed
res = await call("/momo/campaigns/notes/api", "naj", { action: "send_all", m: "202612", confirm: "send-202612" }, najDeps);
ok(res.status === 403, "Najjuko cannot send");
res = await call("/momo/campaigns/notes/api", "rk-owner", { action: "send_all", m: "202612", confirm: "send-202612" }, ownDeps);
ok(res.status === 409 && /not approved/.test((await res.json()).error), "template not approved yet: refused");
put("camp_tpl_najjuko_market_update_v1", { status: "APPROVED" });
res = await call("/momo/campaigns/notes/api", "rk-owner", { action: "send_all", m: "202612", confirm: "send-202612" }, ownDeps);
ok(res.status === 409 && /flow/.test((await res.json()).error), "flow not installed: refused");
res = await call("/momo/campaigns/notes/api", "naj", { action: "flow_install" }, najDeps); ok(res.status === 403, "flow install is owner only");
res = await call("/momo/campaigns/notes/api", "rk-owner", { action: "flow_install" }, ownDeps); let j = await res.json();
ok(res.status === 200 && j.flow.nodes.t0.buttons.length === 3 && j.flow.nodes.t0.buttons[2].optout === true, "flow installed: 3 buttons, Stop opts out", j);
res = await call("/momo/campaigns/notes/api", "rk-owner", { action: "send_all", m: "202612", confirm: "wrong" }, ownDeps); ok(res.status === 400, "confirm required");
env.CAMPAIGNS_OFF = "1"; res = await call("/momo/campaigns/notes/api", "rk-owner", { action: "send_all", m: "202612", confirm: "send-202612" }, ownDeps); ok(res.status === 409, "CAMPAIGNS_OFF refuses"); delete env.CAMPAIGNS_OFF;
html = await (await call("/momo/campaigns/notes?m=202612", "rk-owner", null, ownDeps)).text(); ok(html.includes("Send all approved"), "owner sees Send all approved");
res = await call("/momo/campaigns/notes/api", "rk-owner", { action: "send_all", m: "202612", confirm: "send-202612" }, ownDeps); j = await res.json();
ok(res.status === 200 && j.live.length === 1 && j.live[0].campaign === "mkt-202612-dubai-marina" && j.live[0].contacts === 2, "one campaign live for the approved area", j);
const c = getj("camp_mkt-202612-dubai-marina");
ok(c.status === "live" && c.template === "najjuko_market_update_v1" && c.vars[1] === "=Dubai Marina" && c.vars[2] === "=New 1-bed leases average AED 90k a year (up 3%)." && c.tags[0] === "area-dubai-marina"
  && c.require_consent === "market-updates" && c.mkt_month === "202612" && c.window === "10:00-17:30" && c.days === "mon-fri" && c.freq_days === 28 && c.flow === "mkt-note" && c.parent === "mkt-notes" && c.stop_forgets, "campaign record", c);
ok(getj("mkt_note_202612_dubai-marina").status === "sending", "note now sending (locked)");
res = await call("/momo/campaigns/notes/api", "rk-owner", { action: "reopen", m: "202612", slug: "dubai-marina" }, ownDeps); ok(res.status === 409, "sending note is locked");

// 6. the engine: dry run builds the template payload for the consented owners only; the month guard holds a second note
let d = await campStep(env, c, ownDeps, true);
const tos = d.would.map((w) => w.payload.to).sort();
ok(tos.join() === "971500000001,971500000005" && d.would[0].payload.template.components.find((x) => x.type === "body").parameters[2].text === c.vars[2].slice(1), "dry run: 2 owners, note text exact", d);
put("camp_q_mkt-202612-dubai-marina", { list: ["971500000001", "971500000002", "971500000005"], pos: 0 });
const k1 = getj("camp_contact_971500000001"); k1.mkt_note_last = "202612"; put("camp_contact_971500000001", k1);
d = await campStep(env, c, ownDeps, true);
ok(d.would.length === 1 && d.skipped.mkt_note_already === 1 && d.skipped.no_updates_consent === 1, "month guard + consent re-check at send time", d);
const sat = Date.parse("2026-12-05T08:00:00Z"); d = await campStep(env, c, Object.assign({}, ownDeps, { now: sat }), false);
ok(/outside window/.test(d.note), "Saturday: outside the Mon-Fri window, nothing sent", d);

// 7. sync: the note becomes sent with the counters once the campaign is done
const cc = getj("camp_mkt-202612-dubai-marina"); cc.status = "done"; put("camp_mkt-202612-dubai-marina", cc); put("camp_stats_mkt-202612-dubai-marina", { sent: 2, delivered: 2, read: 1, replies: 1, optouts: 0 });
await syncSent(env, "202612", NOW);
ok(getj("mkt_note_202612_dubai-marina").status === "sent" && getj("mkt_note_202612_dubai-marina").result.replied === 1, "note marked sent with its counters");
ok(noteCampaign({ month: "202612", area_slug: "jvc", area_name: "JVC", text: T1 }, 0).c.cap === 1, "cap never 0");
ok(MKT_NOTE_FLOW.nodes.t0.buttons.map((b) => b.title).join("|") === "Exploring selling|Exploring leasing|Stop messages", "flow buttons follow the template order");
console.log("test_v834_market_note: " + n + " checks passed");
