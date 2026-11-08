// v819 - campaign follow-up groups (Kendall and Najjuko, 8 Nov): delivered not opened / opened no reply / started but didn't finish /
// completed / opted out (count only). Through the REAL worker; FAKE keys and numbers; the live pja-owners flow as stored on 8 Nov; no network.
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const F = await import("../src/camp_followup.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };
const store = new Map();
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
  put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd", OTHER = "ins_nobody_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN].join(","), WA_DESK_PHONE_ID: "100000000000001", WA_PHONE_ID: "100000000000002", WHATSAPP_TOKEN: "TEST_TOKEN", PUBLIC_ORIGIN: "https://w" };
const ctx = { waitUntil() {}, passThroughOnException() {} };
globalThis.fetch = async (u) => { throw new Error("network blocked in test: " + String(u && u.url || u)); };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), env, ctx);
const post = (path, key, body) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, ctx);
const put = (k, v) => store.set(k, JSON.stringify(v));
const J = (k) => JSON.parse(store.get(k) || "null");

const flow = JSON.parse(fs.readFileSync(new URL("./fixtures/flow_pja_owners_live_08nov.json", import.meta.url), "utf8"));
put("camp_flow_pja-owners", flow);
const CID = "pja-test";
put("camp_index", [CID]);
put("camp_" + CID, { id: CID, name: "Palm Jebel Ali owners: Frond B (test)", status: "done", flow: "pja-owners", template: "najjuko_pja_owner_intro_v3", vars: [], tags: ["pja"], cap: 70, window: "10:00-20:00", phone: "desk" });
// [digits, name, msg, status row, state path, extra]
const P = [
  ["971500000201", "Dana Delivered", { st: "delivered", delivered: true }, { sent: "2026-11-08T13:30:00Z", delivered: "2026-11-08T13:31:00Z" }, null],
  ["971500000202", "Omar Opened", { st: "read", delivered: true, read: true }, { sent: "x", delivered: "2026-11-08T13:31:00Z", read: "2026-11-08T13:40:00Z" }, null],
  ["971500000203", "Sara Seller", { st: "read", delivered: true, read: true, replied: true, tap: "Open to selling" }, { read: "2026-11-08T13:41:00Z" }, ["s1.selling", "b1.listed"]],   // stopped at "With how many agents?" (1 of 3 answered after the opener)
  ["971500000204", "Karim Keeper", { st: "read", read: true, delivered: true, replied: true }, {}, ["s1.handover"]],   // a1 text -> a2 buttons: stopped at the market-update question
  ["971500000205", "Hana Handover", { st: "read", read: true, delivered: true, replied: true }, {}, ["s1.selling", "b1.listed", "b2.three"]],   // -> bh handover: completed
  ["971500000206", "Ena End", { st: "read", read: true, delivered: true, replied: true }, {}, ["s1.notnow", "d1.yes"]],   // -> a3 end: completed
  ["971500000207", "Stop Person", { st: "read", read: true, delivered: true, replied: true, optout: true }, {}, ["s1.stop"]],
  ["971500000208", "Fay Failed", { st: "failed", err: [131049] }, { failed: "x", code: 131049 }, null],
  ["971500000209", "Ravi Replied", { st: "read", read: true, delivered: true, replied: true }, {}, null],   // typed a reply, no tap
  ["971500000210", "Lina Later", { st: "read", read: true, delivered: true }, {}, ["s1.palmsprings"]],   // c1 brief -> c2 buttons: started
];
const msgs = [];
P.forEach(([d, name, m, s, path], i) => {
  const w = "wamid.T" + i; msgs.push(w);
  put("camp_contact_" + d, { e164: "+" + d, name, tags: ["pja"], consent: { text: "Yes I agree", date: "2026-10-20" } });
  put("camp_msg_" + w, Object.assign({ cid: CID, d, at: "2026-11-08T13:30:00Z" }, m)); put("camp_status_" + w, Object.assign({ cid: CID, d }, s));
  if (path) put("camp_state_" + CID + "_" + d, { path, node: "x", at: "2026-11-08T14:0" + i + ":00Z" });
});
put("camp_optout_971500000207", { at: "2026-11-08T14:00:00Z", how: "button" });
// a forgotten person: number redacted on the message row
msgs.push("wamid.TF"); put("camp_msg_wamid.TF", { cid: CID, d: "h:abcdef0123456789", st: "read", read: true });
// the follow-up template went to Dana too (same person twice: counted once)
msgs.push("wamid.TD2"); put("camp_msg_wamid.TD2", { cid: CID, d: "971500000201", st: "sent", followup: true });
put("camp_msgs_" + CID, msgs);
put("camp_handover_index", [{ kind: "follow_up", cid: CID, d: "971500000203", status: "open" }, { cid: CID, d: "971500000205", node: "bh", status: "open" }]);   // a follow_up flag is NOT completion

// ---- flowProgress on the live flow ----
let pr = F.flowProgress(flow, { path: ["s1.selling", "b1.listed"] });
ok(!pr.terminal && pr.stoppedAt === "b2" && pr.question === "With how many agents?" && pr.answers.join("|") === "Open to selling|Already listed", "selling, listed: stopped at b2 (through the bt brief and b1 list)", pr);
pr = F.flowProgress(flow, { path: ["s1.selling"] }); ok(!pr.terminal && pr.stoppedAt === "b1", "selling only: waits at b1 (bt brief walked through)", pr);
ok(F.flowProgress(flow, { path: ["s1.selling", "b1.notlisted"] }).terminal, "not listed -> b4 text -> bh handover: terminal");
ok(F.flowProgress(flow, { path: ["s1.selling", "b1.listed", "b2.one"] }).terminal, "1 agent -> b3 -> bh: terminal");
ok(F.flowProgress(flow, { path: ["s1.notnow", "d1.no"] }).terminal, "no thanks -> endok: terminal");
ok(F.flowProgress(flow, { path: ["s1.stop"] }).optout, "Stop button is an opt-out");
ok(!F.flowProgress(flow, { path: [], node: "nudge", followed_node: "nudge" }).started, "only the follow-up template went: not started");
ok(F.flowProgress(flow, { path: ["nudge.yes"] }).terminal, "nudge yes -> a3 end: terminal");

// ---- the groups ----
const c = J("camp_" + CID), G = await F.followupGroups(env, c, Date.parse("2026-11-08T15:00:00Z"));
const names = (g) => G.groups[g].map((r) => r.name).sort().join(",");
ok(names("started") === "Karim Keeper,Lina Later,Ravi Replied,Sara Seller", "started but didn't finish", names("started"));
ok(names("opened") === "Omar Opened", "opened, no reply", names("opened"));
ok(names("delivered") === "Dana Delivered", "delivered, not opened (and counted once though messaged twice)", names("delivered"));
ok(names("completed") === "Ena End,Hana Handover", "completed: the handover and the end node", names("completed"));
ok(G.counts.optout === 2 && G.counts.not_delivered === 1, "opted out (Stop + a forgotten person) and not delivered are counts", G.counts);
const sara = G.groups.started.find((r) => r.name === "Sara Seller");
ok(F.pathText(sara) === "Open to selling → Already listed → stopped at ‘With how many agents?’", "the last step reached, with the answers", F.pathText(sara));
ok(sara.message === "Hi Sara, this is Najjuko. I saw you clicked on our Palm Jebel Ali message but didn't get to finish. I just wanted to check whether there's anything of interest to you, or would you prefer I remove you completely?", "Kendall's wording, first name, topic from the campaign", sara.message);
ok(sara.wa === "https://wa.me/971500000203?text=" + encodeURIComponent(sara.message), "wa.me with the full number and the text prefilled");
ok(/^Hi Omar, this is Najjuko\./.test(G.groups.opened[0].message) && G.groups.delivered[0].message === "", "a message for opened too; none for delivered");
ok(F.pathText(G.groups.started.find((r) => r.name === "Ravi Replied")).includes("replied in their own words"), "a typed reply counts as started");

// ---- the page: both viewers, Back + Home, masked numbers, opted out count only ----
ok((await get("/momo/campaigns/followup?c=" + CID, OTHER)).status === 404, "an unknown key gets not found");
for (const [who, key] of [["Najjuko", NAJ], ["Kendall", KEN]]) {
  const r = await get("/momo/campaigns/followup?c=" + CID, key), h = await r.text();
  ok(r.status === 200 && h.includes("Follow-up groups") && h.includes("&#8592; Campaign") && h.includes(">Home<"), who + " opens it, with Back and Home");
  ok(h.includes("+971 ••• 0203") && !h.includes(">+971500000203<") && h.includes("data-full='+971500000203'") && h.includes(">show</button>"), who + ": numbers masked to the last 4 with show");
  ok(!h.includes("Stop Person") && !h.includes("0207") && /<b>2<\/b><i>Opted out: never contact<\/i>/.test(h), who + ": opted out is a count only");
  ok(h.indexOf("id='g_started'") < h.indexOf("id='g_opened'") && h.indexOf("id='g_opened'") < h.indexOf("id='g_delivered'"), who + ": warm group first");
  ok(h.includes("Copy message") && h.includes("Open in WhatsApp") && h.includes("Mark contacted") && h.includes("Remove from list") && h.includes("type=date"), who + ": the four buttons and the follow-up date");
  ok(!/\p{Extended_Pictographic}/u.test(h), who + ": icons, no emoji");
}
// ---- the campaign card line ----
let h = await (await get("/momo/campaigns?c=" + CID, NAJ)).text();
ok(h.includes("id=fu_link") && h.includes("<b>4</b> started but didn&#39;t finish · follow up") || h.includes("<b>4</b> started but didn't finish · follow up"), "campaign card: warm count first", h.match(/fuw[\s\S]{0,300}/) && h.match(/fuw[\s\S]{0,300}/)[0]);
ok(h.indexOf("started but didn") < h.indexOf("opened, no reply") && h.includes("2</b> opted out"), "then the other groups, opted out as a count");

// ---- actions ----
let j = await (await post("/momo/campaigns/api", NAJ, { action: "fu_contacted", id: CID, d: "971500000203" })).json();
ok(j.ok && J("camp_fu_" + CID + "_971500000203").contacted.length === 1, "mark contacted (with the date)", j);
j = await (await post("/momo/campaigns/api", NAJ, { action: "fu_remove", id: CID, d: "971500000204" })).json();
ok(j.ok && !(await F.followupGroups(env, c)).groups.started.some((r) => r.name === "Karim Keeper") && (await F.followupGroups(env, c)).counts.removed === 1, "remove is soft: off the list, counted as removed", j);
ok(!!J("camp_contact_971500000204") && !J("camp_contact_971500000204").removed, "the contact record itself is untouched");
j = await (await post("/momo/campaigns/api", NAJ, { action: "fu_restore", id: CID, d: "971500000204" })).json();
ok(j.ok && (await F.followupGroups(env, c)).groups.started.some((r) => r.name === "Karim Keeper"), "bring back");
j = await (await post("/momo/campaigns/api", NAJ, { action: "fu_contacted", id: CID, d: "971599999999" })).json();
ok(!j.ok, "a number this campaign never messaged is refused");
const due = new Date(Date.now() + 3 * 864e5 + 4 * 3600e3).toISOString().slice(0, 10);
j = await (await post("/momo/campaigns/api", NAJ, { action: "fu_date", id: CID, d: "971500000203", date: due })).json();
const tk = [...store.keys()].find((k) => k.startsWith("work_naj_task_") && k.includes("sara-seller")), task = tk && J(tk);
ok(j.ok && task && task.due === due && /^\d{4}-\d{2}-\d{2}$/.test(task.start) && /^Call Sara Seller \(••• 0203\) back about the Palm Jebel Ali campaign$/.test(task.name) && task.quick, "follow up on <date>: a Momo task (action + what + for whom, start + due)", task);
ok(J("camp_fu_" + CID + "_971500000203").follow_on === due, "the date shows on the card");
j = await (await post("/momo/campaigns/api", NAJ, { action: "fu_date", id: CID, d: "971500000203", date: "2020-01-01" })).json();
ok(!j.ok, "a date in the past is refused");
h = await (await get("/momo/campaigns/followup?c=" + CID, NAJ)).text();
ok(h.includes("Contacted 20") && h.includes("Follow up " + due), "contacted date and follow-up date on Sara's card");
// forget me removes the follow-up notes too
const C = await import("../src/campaigns.js"); await C.forgetContact(env, "971500000203", "test", Date.now());
ok(!store.has("camp_fu_" + CID + "_971500000203"), "forget me deletes the follow-up notes");

console.log("v819 follow-up groups:", pass, "passed,", fail, "failed"); if (fail) process.exit(1);
