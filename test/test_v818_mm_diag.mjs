// v818: keep Meta's full error detail + pricing category on camp_status_<wamid>, and an owner-only read of the WABA's
// Marketing Messages API onboarding status (GET only; never sends, never returns the token).
import { campaignRoute, statusExtras, mmOnboarding } from "../src/campaigns.js";

const fail = (m) => { throw new Error(m); };

// statusExtras: a real 131049 failure shape
const s131049 = { id: "wamid.X", status: "failed", timestamp: "1762608300", errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement.", message: "This message was not delivered to maintain healthy ecosystem engagement.", error_data: { details: "In order to maintain a healthy ecosystem engagement, the message failed to be delivered." } }] };
const e = statusExtras(s131049);
if (!e.err_title.includes("healthy ecosystem") || !e.err_details.includes("healthy ecosystem")) fail("131049 detail not kept " + JSON.stringify(e));
if ("pcat" in e) fail("no pricing on a failure, so no pcat");
const lite = statusExtras({ status: "delivered", pricing: { billable: true, pricing_model: "PMP", category: "marketing_lite" }, conversation: { origin: { type: "marketing_lite" } } });
if (lite.pcat !== "marketing_lite" || lite.origin !== "marketing_lite" || lite.billable !== true || lite.pmodel !== "PMP") fail("pricing not kept " + JSON.stringify(lite));
if (JSON.stringify(statusExtras({ status: "sent" })) !== "{}") fail("plain status should add nothing");

// mmOnboarding: GET, right field, token in header only, never in the result
let seen = null;
const fakeFetch = async (u, o) => { seen = { u, o }; return new Response(JSON.stringify({ id: "1588773749592854", marketing_messages_onboarding_status: { status: "ONBOARDED" } }), { status: 200 }); };
const env = { READ_KEY: "rk-owner", WHATSAPP_TOKEN: "SECRET-T", MEETINGS: { get: async () => null, put: async () => {}, delete: async () => {} } };
const r = await mmOnboarding(env, { fetch: fakeFetch, graph: "https://g" });
if (!seen.u.endsWith("/1588773749592854?fields=marketing_messages_onboarding_status")) fail("wrong url " + seen.u);
if (seen.o.method && seen.o.method !== "GET") fail("must be GET");
if (!r.ok || r.marketing_messages_onboarding_status.status !== "ONBOARDED") fail("bad result " + JSON.stringify(r));
if (JSON.stringify(r).includes("SECRET")) fail("token leaked");
const bad = await mmOnboarding(env, { fetch: async () => new Response(JSON.stringify({ error: { code: 100, message: "Tried accessing nonexisting field" } }), { status: 400 }), graph: "https://g" });
if (bad.ok || bad.error.code !== 100) fail("graph error not surfaced " + JSON.stringify(bad));

// route: owner only
const call = (key) => campaignRoute(new Request("https://x/momo/campaigns/api?key=" + key, { method: "POST", body: JSON.stringify({ action: "mm_status" }) }), env, new URL("https://x/momo/campaigns/api?key=" + key), { fetch: fakeFetch, graph: "https://g", person: (e2, u) => (u.searchParams.get("key") === "k-naj" ? "najjuko" : ""), isNaj: () => true });
const ro = await call("rk-owner"); const jo = await ro.json();
if (!jo.ok || !jo.marketing_messages_onboarding_status) fail("owner should read status " + JSON.stringify(jo));
const rn = await call("k-naj");
if (rn.status === 200 && (await rn.json()).ok) fail("Najjuko's key must not read mm_status");
console.log("test_v818_mm_diag OK");
