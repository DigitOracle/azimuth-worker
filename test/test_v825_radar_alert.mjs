// v825 - Launch Radar desk alerts: window, 3-a-day cap, one message, each id once, both recipients, auth.
import assert from "node:assert/strict";
import { radarGate, radarText, radarAlertRoute, dubaiNow } from "../src/radar_alert.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const at = (h, m) => Date.parse("2026-11-09T00:00:00Z") + ((h - 4) * 60 + (m || 0)) * 60000;   // Dubai wall clock -> ms
const A = "al_0123456789abcdef", B = "al_1111111111111111", C = "al_2222222222222222", D = "al_3333333333333333";
eq(dubaiNow(at(9)).hour, 9, "clock");
ok(!radarGate(at(8, 59), 0, [A]).ok && radarGate(at(9), 0, [A]).ok && !radarGate(at(19), 0, [A]).ok, "09:00-19:00 only");
ok(!radarGate(at(12), 3, [A]).ok, "3 a day");
ok(!radarGate(at(12), 1, [A, B, C]).ok && radarGate(at(12), 0, [A, B, C]).ok, "a batch bigger than the room is refused");
ok(!radarGate(at(12), 1, [A], [A]).ok, "an id is delivered once");
ok(!radarGate(at(12), 0, ["al_; drop"]).ok, "ids are checked");
ok(radarText("x", true).startsWith("Black Coffee,") && radarText("x", true).endsWith("curated by Papi") && radarText("x", false) === "x", "Naj greeting rule");
// the route, with a fake KV and senders
const kv = new Map(); const env = { INGEST_TOKEN: "t", WA_ALLOWED: "971500000000", MEETINGS: { get: async (k) => kv.get(k) || null, put: async (k, v) => kv.set(k, v) } };
const sent = []; const deps = (h) => ({ ctEq: (a, b) => a === b, waSend: async (e, to, t) => { sent.push(["naj", to, t]); return { ok: true }; }, tellOwner: async (e, t) => { sent.push(["kendall", t]); return true; }, now: () => at(h) });
const req = (ids, tok) => new Request("https://x/radar_alert", { method: "POST", headers: { "X-Azimuth-Ingest": tok || "t" }, body: JSON.stringify({ text: "Launch Radar - 2 alerts\nKNOWN\n- a\nREPORTED\n- b\nUNVERIFIED\n- c\nNEXT CHECK\n- d", ids }) });
eq((await radarAlertRoute(req([A], "bad"), env, deps(12))).status, 401, "auth");
let r = await (await radarAlertRoute(req([A, B]), env, deps(12))).json();
ok(r.ok && r.najjuko && r.kendall && r.counted === 2 && sent.length === 2, "one message to each recipient");
r = await (await radarAlertRoute(req([C, D]), env, deps(13))).json();
ok(!r.ok && /room/.test(r.reason) && sent.length === 2, "the 4th alert of the day is refused, nothing sent");
r = await (await radarAlertRoute(req([C]), env, deps(14))).json();
ok(r.ok && r.counted === 1, "the 3rd goes");
r = await (await radarAlertRoute(req([D]), env, deps(15))).json();
ok(!r.ok && /already sent/.test(r.reason), "cap holds after 3");
r = await (await radarAlertRoute(req([D]), env, deps(20))).json();
ok(!r.ok && /outside/.test(r.reason), "evening refused");
console.log(`v825 radar alert: ${n} checks passed`);
