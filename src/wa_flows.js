// v428 - WhatsApp FLOWS (Kendall 9 Oct 2026: "we are going to do all of these ... start with one"). Flow 1: THE CLIENT BRIEF AS A FORM.
// Naj sends "brief" -> a WhatsApp form opens inside the chat (2 screens: the home, then areas, budget and must-haves) -> on Submit
// WhatsApp sends us the answers (interactive type nfm_reply) -> we run the SAME briefSearch the Brief page uses (owner: false, so no
// owner-only field can leak into a client-shareable line) and reply with the top matches and one link to the full Brief.
// No-endpoint Flow: every screen is static, the answers arrive only in the completion webhook. Nothing here posts to anyone but Naj.
//   GET /wa_flow_setup?key=READ_KEY&waba=<WABA id>[&apply=1]   owner only: dry run shows the Flow JSON; apply=1 creates + publishes it
//                                                               on Meta and stores its id at KV wa_flow_brief_id.
import { briefSearch, BRIEF_CRITERIA } from "./brief.js";

export const FLOW_KEY = "wa_flow_brief_id";
export const FLOW_DRAFT_KEY = "wa_flow_brief_draft";
const BRIEF_DRAFT_ID = "1390776043225593";   // najma_client_brief_v1, created 9 Oct, held in draft by Meta
export const FLOW_NAME = "najma_client_brief_v1";
// The areas offered on the form: the app's own districts (KV img_districts_geo, 41 on 9 Oct 2026). A CheckboxGroup takes at most 20 options,
// so the list is split in two groups of up to 20. Slugs are what briefSearch reads (areas=slug,slug).
export const FLOW_AREAS = [
  ["dubaimarina", "Dubai Marina"], ["jltnorth", "Jumeirah Lake Towers"], ["palmjumeirah", "Palm Jumeirah"], ["businessbay", "Business Bay"], ["burjkhalifa", "Downtown Dubai"],
  ["dubaihills", "Dubai Hills Estate"], ["jumeirahvillagecircle", "Jumeirah Village Circle"], ["jumeirahvillagetriangle", "Jumeirah Village Triangle"], ["alkhairanfirst", "Dubai Creek Harbour"], ["sobhaheartland", "Sobha Hartland"],
  ["meydanone", "Meydan One"], ["damachills", "DAMAC Hills"], ["madinathind4", "DAMAC Hills 2"], ["arjan", "Arjan"], ["motorcity", "Motor City"],
  ["dubaisportscity", "Dubai Sports City"], ["siliconoasis", "Dubai Silicon Oasis"], ["alyelayiss2", "Town Square"], ["madinatalmataar", "Dubai South"], ["samaaljadaf", "Al Jaddaf"],
  ["alwasl", "Al Wasl"], ["alsatwa", "Al Satwa"], ["palmdeira", "Dubai Islands"], ["dubaimaritimecity", "Dubai Maritime City"], ["dubaiproductioncity", "Dubai Production City"],
  ["dubaistudiocity", "Dubai Studio City"], ["dubaisciencepark", "Dubai Science Park"], ["majan", "Majan"], ["jltsouth", "Jumeirah Islands"], ["alyufrah1", "The Valley"],
  ["jabalalifirst", "Jebel Ali"], ["dubaiinvestmentparkfirst", "Dubai Investments Park"],
];
const opt = (id, title) => ({ id, title: String(title).slice(0, 30) });

// The Flow JSON. Screen 1 HOME: client name, rent or buy, bedrooms, home type. Screen 2 WHERE (terminal): areas, budget, must-haves.
export function briefFlowJson() {
  const a1 = FLOW_AREAS.slice(0, 20).map(([s, n]) => opt(s, n)), a2 = FLOW_AREAS.slice(20, 40).map(([s, n]) => opt(s, n));
  return {
    version: "7.1",
    screens: [
      { id: "HOME", title: "Client brief", data: {},
        layout: { type: "SingleColumnLayout", children: [
          { type: "TextSubheading", text: "Who is it for, and what home?" },
          { type: "TextInput", name: "client", label: "Client name", "helper-text": "Optional", "input-type": "text", required: false },
          { type: "RadioButtonsGroup", name: "mode", label: "Rent or buy", required: true, "data-source": [opt("rent", "Rent"), opt("buy", "Buy")] },
          { type: "CheckboxGroup", name: "beds", label: "Bedrooms", description: "Tick one or more", required: true, "data-source": [opt("studio", "Studio"), opt("1", "1 bedroom"), opt("2", "2 bedrooms"), opt("3", "3 bedrooms or more")] },
          { type: "RadioButtonsGroup", name: "type", label: "Home type", required: true, "data-source": [opt("any", "Any"), opt("apartment", "Apartment"), opt("townhouse", "Townhouse"), opt("villa", "Villa")] },
          { type: "Footer", label: "Next", "on-click-action": { name: "navigate", next: { type: "screen", name: "WHERE" },
            payload: { client: "${form.client}", mode: "${form.mode}", beds: "${form.beds}", type: "${form.type}" } } },
        ] } },
      { id: "WHERE", title: "Where and budget", terminal: true,
        data: { client: { type: "string", __example__: "" }, mode: { type: "string", __example__: "rent" }, beds: { type: "array", items: { type: "string" }, __example__: ["1"] }, type: { type: "string", __example__: "any" } },
        layout: { type: "SingleColumnLayout", children: [
          { type: "CheckboxGroup", name: "areas1", label: "Areas", description: "Optional", required: false, "data-source": a1 },
          { type: "CheckboxGroup", name: "areas2", label: "More areas", required: false, "data-source": a2 },
          { type: "TextInput", name: "max", label: "Budget up to (AED)", "helper-text": "Yearly rent, or the price to buy", "input-type": "number", required: false },
          { type: "TextInput", name: "min", label: "Budget from (AED)", "helper-text": "Optional", "input-type": "number", required: false },
          { type: "CheckboxGroup", name: "musts", label: "Must-haves", description: "Optional", required: false, "data-source": BRIEF_CRITERIA.map(([k, l]) => opt(k, l.charAt(0).toUpperCase() + l.slice(1))) },
          { type: "Footer", label: "Find homes", "on-click-action": { name: "complete",
            payload: { client: "${data.client}", mode: "${data.mode}", beds: "${data.beds}", type: "${data.type}", areas1: "${form.areas1}", areas2: "${form.areas2}", max: "${form.max}", min: "${form.min}", musts: "${form.musts}" } } },
        ] } },
    ],
  };
}

// The interactive message that opens the form (inside the 24-hour window, which is always open when she has just typed "brief").
export function flowMessage(to, flowId, token, draft) {
  const m = { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "flow",
    header: { type: "text", text: "Client brief" },
    body: { text: "Fill in the client's brief and I'll bring back the homes that match, from the registers." },
    footer: { text: "Najma" },
    action: { name: "flow", parameters: { flow_message_version: "3", flow_token: token, flow_id: String(flowId), flow_cta: "Start the brief", flow_action: "navigate", flow_action_payload: { screen: "HOME" } } } } };
  if (draft) m.interactive.action.parameters.mode = "draft";   // v433: an unpublished form opens in test mode on the business's own numbers
  return m;
}

// The form's answers -> the Brief's own query string. Anything outside the Brief's vocabulary is dropped rather than guessed.
const BEDS_OK = ["studio", "1", "2", "3"], TYPES_OK = ["any", "apartment", "townhouse", "villa"], AREA_OK = new Set(FLOW_AREAS.map((a) => a[0])), MUST_OK = new Set(BRIEF_CRITERIA.map((c) => c[0]));
const arr = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : String(v).split(",")).map((s) => String(s).trim()).filter(Boolean);
const aed = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.]/g, "")); return isFinite(n) && n > 0 ? Math.round(n) : null; };
export function answersToQuery(r) {
  r = r || {};
  const sp = new URLSearchParams();
  sp.set("mode", r.mode === "buy" ? "buy" : "rent");
  const beds = arr(r.beds).filter((b) => BEDS_OK.includes(b)); sp.set("beds", (beds.length ? beds : ["1"]).join(","));
  const type = TYPES_OK.includes(String(r.type)) ? String(r.type) : "any"; sp.set("type", type);
  const areas = arr(r.areas1).concat(arr(r.areas2)).filter((a) => AREA_OK.has(a)); if (areas.length) sp.set("areas", [...new Set(areas)].join(","));
  let min = aed(r.min), max = aed(r.max); if (min && max && max < min) { const t = min; min = max; max = t; }
  if (max) sp.set("max", String(max)); if (min) sp.set("min", String(min));
  const musts = arr(r.musts).filter((m) => MUST_OK.has(m)); if (musts.length) sp.set("musts", musts.join(","));
  return { sp, client: String(r.client || "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 40) };
}

const money = (n) => "AED " + Math.round(n).toLocaleString("en-US");
// The reply: who it is for, what was asked, the top matches (name, area, the figure the Brief shows), and the one link to the full Brief.
export function briefReplyText(q, client, body, link) {
  const ask = (q.get("mode") === "buy" ? "Buy" : "Rent") + ", " + q.get("beds").split(",").map((b) => (b === "studio" ? "studio" : b + " bed")).join(" or ") +
    (q.get("type") !== "any" ? ", " + q.get("type") : "") + (q.get("max") ? ", up to " + money(Number(q.get("max"))) : "") + (q.get("areas") ? ", " + q.get("areas").split(",").length + " area(s)" : ", any area");
  const L = ["Brief" + (client ? " for " + client : "") + ": " + ask + "."];
  const rows = (body && body.results) || [];
  if (!rows.length) L.push((body && body.empty) || "Nothing matched all of that. Try a wider budget or more areas: send brief again.");
  const yearly = q.get("mode") !== "buy";
  rows.slice(0, 5).forEach((r, i) => {
    const e = r.evidence || {}, where = r.district_name || "";
    const fig = e.median ? "typical " + money(e.median) + (yearly ? " a year" : "") + (e.n ? " (" + e.n + (yearly ? " contracts" : " sales") + ")" : "") : "";
    L.push((i + 1) + ". " + (r.name || "Building") + (r.area_figure ? " (area figure)" : "") + (where && where !== r.name ? ", " + where : "") + (fig ? ": " + fig : ""));
  });
  if (rows.length > 5) L.push("+" + (rows.length - 5) + " more in the full Brief.");
  if (link) L.push("Full Brief, map and client sheets: " + link);
  return L.join("\n");
}

// nfm_reply -> search -> reply. deps: { send(env, to, text), briefLink(env, sp) }
export async function flowReply(env, from, msg, deps) {
  const nfm = msg && msg.interactive && msg.interactive.nfm_reply;
  if (!nfm) return false;
  let r = null; try { r = JSON.parse(nfm.response_json || "{}"); } catch (e) {}
  if (!r || (r.flow_token && String(r.flow_token).indexOf("brief:") !== 0)) return false;     // not our form
  const { sp, client } = answersToQuery(r);
  let out = null; try { out = await briefSearch(env, sp, { owner: false }); } catch (e) {}
  if (!out || out.status !== 200) { await deps.send(env, from, "I could not run that brief just now" + (out && out.body && out.body.error ? " (" + [].concat(out.body.error).join("; ") + ")" : "") + ". Send brief to try again."); return true; }
  const link = deps.briefLink ? deps.briefLink(env, sp) : "";
  await deps.send(env, from, briefReplyText(sp, client, out.body, link));
  return true;
}

// Sends the form; returns false when no Flow id is stored yet (the owner has not run /wa_flow_setup?apply=1).
export async function sendBriefFlow(env, to, deps) {
  // v433 (9 Oct): Meta's "Blocked by Integrity" keeps the form in draft while support reviews it. Until it is published, the desk opens
  // the draft in test mode. Desk only: sendBriefFlow is called from the desk lab, never for Naj.
  let id = await env.MEETINGS.get(FLOW_KEY), draft = false;
  if (!id) { id = (await env.MEETINGS.get(FLOW_DRAFT_KEY)) || BRIEF_DRAFT_ID; draft = true; }
  if (!id) { await deps.send(env, to, "The brief form is not set up yet. Send: lab setup brief <WhatsApp Business Account id>, then the same with go at the end."); return true; }
  const token = "brief:" + Date.now().toString(36);
  const r = await deps.post(env, flowMessage(to, id, token, draft), "flow");
  if (r && r.error) await deps.send(env, to, "WhatsApp did not open the form (" + String(r.error.message || "error").slice(0, 120) + "). Send brief again in a minute.");
  return true;
}

// Owner route: dry run shows the JSON; apply=1 creates the Flow on the WhatsApp Business Account and publishes it.
export async function flowSetupRoute(env, url, deps) {
  if (!env.READ_KEY || url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
  const waba = String(url.searchParams.get("waba") || env.WA_WABA_ID || "").replace(/\D/g, "");
  const json = briefFlowJson();
  const J = (o, s) => new Response(JSON.stringify(o, null, 1), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (url.searchParams.get("apply") !== "1") return J({ dry: true, name: FLOW_NAME, waba: waba || "(pass &waba=<WhatsApp Business Account id>)", stored_id: await env.MEETINGS.get(FLOW_KEY), flow_json: json });
  if (!waba) return J({ ok: false, why: "waba= is required (the WhatsApp Business Account id of Naj's number)" }, 400);
  const H = { Authorization: "Bearer " + env.WHATSAPP_TOKEN };
  const fd = new FormData();
  fd.append("name", FLOW_NAME); fd.append("categories", JSON.stringify(["LEAD_GENERATION"]));
  fd.append("flow_json", JSON.stringify(json)); fd.append("publish", "true");
  let cj = null; try { cj = await (await fetch(deps.graph + "/" + waba + "/flows", { method: "POST", headers: H, body: fd })).json(); } catch (e) { return J({ ok: false, why: "Meta did not answer" }, 502); }
  if (!cj || !cj.id) return J({ ok: false, why: "Meta refused the Flow", meta: cj }, 502);
  await env.MEETINGS.put(FLOW_KEY, String(cj.id));
  return J({ ok: true, flow_id: cj.id, validation_errors: cj.validation_errors || [], note: "Stored. Naj can now send: brief" });
}
