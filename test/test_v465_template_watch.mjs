// v465 - the template watch: first run records, a change is told once, APPROVED/REJECTED leave the watch. Offline.
import { templateWatchTick } from "../src/wa_templates.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const store = new Map();
const env = { WHATSAPP_TOKEN: "T", MEETINGS: { get: async (k) => store.get(k) || null, put: async (k, v) => store.set(k, v) } };
let rows = [];
globalThis.fetch = async (u, init) => { ok.auth = init.headers.Authorization; return new Response(JSON.stringify({ data: rows })); };
const sent = []; const send = async (e, t) => sent.push(t);
const R = (name, status, category, rejected_reason) => ({ name, status, category, rejected_reason: rejected_reason || "NONE" });

rows = [R("digitalchemy_site_clarity", "PENDING", "MARKETING"), R("najma_log_reminder", "PENDING", "UTILITY"), R("najma_feed_update", "PENDING", "MARKETING"), R("momo_day_check", "PENDING", "MARKETING")];
await templateWatchTick(env, "g", send);
ok(!sent.length && JSON.parse(store.get("tpl_watch")).digitalchemy_site_clarity === "PENDING|MARKETING", "first run records quietly");
await templateWatchTick(env, "g", send);
ok(!sent.length, "no change, no message");
rows[0] = R("digitalchemy_site_clarity", "APPROVED", "MARKETING"); rows[1] = R("najma_log_reminder", "PENDING", "MARKETING");
await templateWatchTick(env, "g", send);
ok(sent.length === 1 && /digitalchemy_site_clarity: APPROVED \(MARKETING\)/.test(sent[0]) && /najma_log_reminder: PENDING \(MARKETING\)/.test(sent[0]), "approval and a category change are told in one message", sent[0]);
ok(!("digitalchemy_site_clarity" in JSON.parse(store.get("tpl_watch"))), "an approved template leaves the watch");
sent.length = 0; await templateWatchTick(env, "g", send);
ok(!sent.length, "told once only");
rows[3] = R("momo_day_check", "REJECTED", "MARKETING", "INVALID_FORMAT");
await templateWatchTick(env, "g", send);
ok(/momo_day_check: REJECTED \(MARKETING\), reason: INVALID_FORMAT/.test(sent.join("")), "a rejection carries Meta's reason");
ok(ok.auth === "Bearer T" && !/Bearer|T"/.test(sent.join("")), "token used, never shown");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
