// v455 - THE CLIENT BRIEF AS A CHAT (10 Oct 2026). Meta will not publish the WhatsApp form (Flow) until the account reaches the
// 2,000-a-day messaging limit (ours is 250), so the brief is asked here with list menus, reply buttons and typed answers instead.
// Same questions as the form, same vocabulary (answersToQuery in wa_flows.js), same search (briefSearch, owner: false) and the same
// reply (briefReplyText + the Brief link), so a brief gives identical results whichever way it was asked.
// Desk first: the desk lab starts it with "brief". Naj gets it only when the switch is ON: env BRIEF_CHAT_NAJ = "1" or KV brief_chat_naj = "on".
// Both are OFF by default; while OFF nothing here runs for Naj.
// State: KV briefchat_<sender digits>, 30 minutes, one open brief per sender.
// deps: { raw(env, payload, kind) -> {error?}, send(env, text), briefLink(env, sp), search?(env, sp) }
import { FLOW_AREAS, answersToQuery, briefReplyText } from "./wa_flows.js";
import { briefSearch, BRIEF_CRITERIA } from "./brief.js";
import { listPayload } from "./desk_lab.js";

export const BC_TTL = 1800;
export const BC_PREFIX = "briefchat_";
export const NAJ_SWITCH_KEY = "brief_chat_naj";
export async function briefChatNajOn(env) {
  if (String(env.BRIEF_CHAT_NAJ || "") === "1") return true;
  try { return (await env.MEETINGS.get(NAJ_SWITCH_KEY)) === "on"; } catch (e) { return false; }
}

// The 32 form areas in four groups of at most 10 (every slug exactly once; the test checks it).
export const AREA_GROUPS = [
  { title: "Marina and the coast", slugs: ["dubaimarina", "jltnorth", "jltsouth", "palmjumeirah", "alwasl", "alsatwa", "palmdeira", "dubaimaritimecity"] },
  { title: "Downtown and the Creek", slugs: ["burjkhalifa", "businessbay", "alkhairanfirst", "sobhaheartland", "meydanone", "samaaljadaf", "siliconoasis"] },
  { title: "Hills and the villages", slugs: ["dubaihills", "jumeirahvillagecircle", "jumeirahvillagetriangle", "arjan", "motorcity", "dubaisportscity", "dubaiproductioncity", "dubaistudiocity", "majan"] },
  { title: "South and the outskirts", slugs: ["dubaisciencepark","damachills", "madinathind4", "alyelayiss2", "madinatalmataar", "alyufrah1", "jabalalifirst", "dubaiinvestmentparkfirst"] },
];
const AREA_NAME = Object.fromEntries(FLOW_AREAS);
const SHORT = { jumeirahvillagetriangle: "Village Triangle" };   // a list row title holds 24 characters; the full name goes in the description
const areaRow = (s) => { const n = AREA_NAME[s]; return n.length > 24 ? { id: "bc:area:" + s, title: SHORT[s] || n.slice(0, 24), description: n } : { id: "bc:area:" + s, title: n }; };
const BEDS = [["studio", "Studio"], ["1", "1 bedroom"], ["2", "2 bedrooms"], ["3", "3 bedrooms or more"]];
const TYPES = [["any", "Any"], ["apartment", "Apartment"], ["townhouse", "Townhouse"], ["villa", "Villa"]];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const MSG = {
  name: "Client brief. Who is it for? Type a name, or tap Skip.",
  mode: "Rent or buy?",
  beds: "How many bedrooms?",
  bedsMore: (b) => "Bedrooms so far: " + b + ". Add another, or Next?",
  type: "What type of home?",
  areaGroups: "Which part of Dubai? Pick a group, then the area. Or pick Any area.",
  areaIn: (g) => g + ": pick an area.",
  areaMore: (a) => "Areas so far: " + a + ". Add another area, or Done?",
  max: "Type your top budget in AED, e.g. 120000, or tap Skip.",
  min: "Type the lowest budget in AED, e.g. 80000, or tap Skip.",
  musts: "Any must-haves? Pick one, or None.",
  mustsMore: (m) => "Must-haves so far: " + m + ". Add another, or Done?",
  change: "What would you like to change?",
  cancelled: "Brief cancelled. Send brief to start again.",
  expired: "That brief timed out after 30 minutes. Send brief to start again.",
  sorry: "Sorry, I did not catch that. ",
};

const key = (from) => BC_PREFIX + String(from || "").replace(/\D/g, "");
async function load(env, from) { try { return JSON.parse((await env.MEETINGS.get(key(from))) || "null"); } catch (e) { return null; } }
async function save(env, from, st) { st.at = Date.now(); await env.MEETINGS.put(key(from), JSON.stringify(st), { expirationTtl: BC_TTL }); }
async function clear(env, from) { try { await env.MEETINGS.delete(key(from)); } catch (e) {} }

export function buttonsPayload(to, body, buttons) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: String(body).slice(0, 1024) },
    action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: String(b.id).slice(0, 256), title: String(b.title).slice(0, 20) } })) } } };
}

// budget: "120000", "120,000", "120k", "1.2m", "AED 95000" -> a whole number, or null
export function parseAed(s) {
  const t = String(s || "").toLowerCase().replace(/aed|dhs?|dirhams?|,|\s/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m)?$/); if (!m) return null;
  const n = Math.round(Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1));
  return n >= 1000 && n <= 1e9 ? n : null;
}
const cleanName = (s) => String(s || "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 40);
const COMMAND = /^(\/|(lab|feed|post|ideas|queue|insights|cost|pause|resume|ref|retry|approve|purge|remove|list)\b)/i;
const money = (n) => "AED " + Number(n).toLocaleString("en-US");

// The answers in the form's shape, so answersToQuery reads them exactly as it reads the form.
export function stateAnswers(st) {
  return { client: st.client || "", mode: st.mode, beds: st.beds && st.beds.length ? st.beds : [], type: st.type || "any",
    areas1: st.areas || [], areas2: [], max: st.max || "", min: st.min || "", musts: st.musts || [] };
}
export function summaryText(st) {
  const beds = (st.beds || []).map((b) => (BEDS.find((x) => x[0] === b) || [, b])[1]).join(" or ");
  return "Here is the brief" + (st.client ? " for " + st.client : "") + ":\n" +
    "Rent or buy: " + cap(st.mode || "rent") + "\nBedrooms: " + beds + "\nHome type: " + cap(st.type || "any") +
    "\nAreas: " + ((st.areas || []).length ? st.areas.map((s) => AREA_NAME[s]).join(", ") : "Any area") +
    "\nBudget: " + (st.min ? "from " + money(st.min) + " " : "") + (st.max ? "up to " + money(st.max) : st.min ? "" : "no limit") +
    "\nMust-haves: " + ((st.musts || []).length ? st.musts.map((m) => (BRIEF_CRITERIA.find((c) => c[0] === m) || [, m])[1]).join(", ") : "none") +
    "\nSearch now?";
}

// ---- asking each step ----
async function ask(env, to, st, deps, pre) {
  const P = pre || "";
  const btn = (body, b) => deps.raw(env, buttonsPayload(to, P + body, b), "brief-chat");
  const lst = (body, label, rows, header) => deps.raw(env, listPayload(to, P + body, label, rows, header || "Client brief"), "brief-chat");
  switch (st.step) {
    case "name": return btn(MSG.name, [{ id: "bc:skip", title: "Skip" }, { id: "bc:cancel", title: "Cancel" }]);
    case "mode": return btn(MSG.mode, [{ id: "bc:mode:rent", title: "Rent" }, { id: "bc:mode:buy", title: "Buy" }]);
    case "beds": return lst(MSG.beds, "Bedrooms", BEDS.filter((b) => !(st.beds || []).includes(b[0])).map(([i, t]) => ({ id: "bc:beds:" + i, title: t })).concat((st.beds || []).length ? [] : [{ id: "bc:beds:any", title: "Any", description: "Studio to 3 bedrooms or more" }]));
    case "bedsMore": return btn(MSG.bedsMore(st.beds.map((b) => BEDS.find((x) => x[0] === b)[1]).join(", ")), [{ id: "bc:beds:more", title: "Add another" }, { id: "bc:beds:next", title: "Next" }]);
    case "type": return lst(MSG.type, "Home type", TYPES.map(([i, t]) => ({ id: "bc:type:" + i, title: t })));
    case "areaGroups": return lst(MSG.areaGroups, "Areas", AREA_GROUPS.map((g, i) => ({ id: "bc:ag:" + i, title: g.title, description: g.slugs.slice(0, 3).map((s) => AREA_NAME[s]).join(", ").slice(0, 72) }))
      .concat((st.areas || []).length ? [{ id: "bc:area:done", title: "Done with areas" }] : [{ id: "bc:area:any", title: "Any area" }]));
    case "areaIn": { const g = AREA_GROUPS[st.group] || AREA_GROUPS[0];
      return lst(MSG.areaIn(g.title), "Areas", g.slugs.filter((s) => !(st.areas || []).includes(s)).map(areaRow).concat([{ id: "bc:area:back", title: "Back to groups" }]).slice(0, 10)); }
    case "areaMore": return btn(MSG.areaMore(st.areas.map((s) => AREA_NAME[s]).join(", ")), [{ id: "bc:area:more", title: "Add another area" }, { id: "bc:area:done", title: "Done" }]);
    case "max": return btn(MSG.max, [{ id: "bc:skip", title: "Skip" }]);
    case "min": return btn(MSG.min, [{ id: "bc:skip", title: "Skip" }]);
    case "musts": return lst(MSG.musts, "Must-haves", BRIEF_CRITERIA.filter((c) => !(st.musts || []).includes(c[0])).map(([k, l]) => ({ id: "bc:must:" + k, title: cap(l) }))
      .concat([{ id: "bc:must:none", title: (st.musts || []).length ? "No more" : "None" }]));
    case "mustsMore": return btn(MSG.mustsMore(st.musts.map((m) => cap(BRIEF_CRITERIA.find((c) => c[0] === m)[1])).join(", ")), [{ id: "bc:must:more", title: "Add another" }, { id: "bc:must:done", title: "Done" }]);
    case "summary": return btn(summaryText(st), [{ id: "bc:go", title: "Search" }, { id: "bc:change", title: "Change" }, { id: "bc:cancel", title: "Cancel" }]);
    case "change": return lst(MSG.change, "Change", [["mode", "Rent or buy"], ["beds", "Bedrooms"], ["type", "Home type"], ["areaGroups", "Areas"], ["max", "Budget"], ["musts", "Must-haves"], ["name", "Client name"]].map(([i, t]) => ({ id: "bc:chg:" + i, title: t })));
  }
}

// after a step is answered: the next step, or straight back to the summary when this was a change
const ORDER = ["name", "mode", "beds", "type", "areaGroups", "max", "min", "musts", "summary"];
function next(st, done) { if (st.editing && done !== "max") { st.editing = false; return "summary"; } return ORDER[ORDER.indexOf(done) + 1] || "summary"; }

export async function briefChatStart(env, from, deps) {
  const st = { step: "name", client: "", mode: "", beds: [], type: "", areas: [], max: null, min: null, musts: [], started: Date.now() };
  await save(env, from, st); await ask(env, from, st, deps); return true;
}

// One incoming message. Returns true when the brief took it. A message the brief does not take falls through to the usual routing.
export async function briefChatRoute(env, from, msg, deps) {
  const ia = msg && msg.type === "interactive" && msg.interactive, pick = ia && (ia.button_reply || ia.list_reply);
  const id = pick ? String(pick.id || "") : "";
  const text = msg && msg.type === "text" && msg.text ? String(msg.text.body || "").trim() : "";
  if (/^\/?brief$/i.test(text)) return briefChatStart(env, from, deps);
  if (pick && id.indexOf("bc:") !== 0) return false;                 // somebody else's button
  if (!pick && !text) return false;
  const st = await load(env, from);
  if (!st) { if (pick) { await deps.send(env, MSG.expired); return true; } return false; }
  if (!pick && COMMAND.test(text)) return false;                     // a desk command: it runs, the brief stays open
  if (!pick && /^\d{1,2}$/.test(text) && st.step !== "beds") return false;   // a bare number is a feed pick unless bedrooms are being asked
  if (id === "bc:cancel" || (!pick && /^(cancel|stop)$/i.test(text))) { await clear(env, from); await deps.send(env, MSG.cancelled); return true; }
  const go = async (step, pre) => { st.step = step; await save(env, from, st); await ask(env, from, st, deps, pre); return true; };
  const again = () => go(st.step, MSG.sorry);
  const low = text.toLowerCase();
  const isSkip = id === "bc:skip" || /^skip$/i.test(text);
  switch (st.step) {
    case "name": {
      if (isSkip) { st.client = ""; return go(next(st, "name")); }
      if (pick) return again();
      const n = cleanName(text); if (!n) return again();
      st.client = n; return go(next(st, "name"));
    }
    case "mode": {
      const v = id ? id.slice(8) : low;
      if (v !== "rent" && v !== "buy") return again();
      st.mode = v; return go(next(st, "mode"));
    }
    case "beds": {
      let v = id.indexOf("bc:beds:") === 0 ? id.slice(8) : low.replace(/\s*(bed(room)?s?|br)\s*$/, "").replace(/\+$/, "");
      if (v === "3 or more" || v === "4" || v === "5") v = "3";
      if (v === "any") { st.beds = BEDS.map((b) => b[0]); return go(next(st, "beds")); }
      if (!BEDS.some((b) => b[0] === v)) return again();
      if (!st.beds.includes(v)) st.beds.push(v);
      return go(st.beds.length >= BEDS.length ? next(st, "beds") : "bedsMore");
    }
    case "bedsMore": {
      if (id === "bc:beds:more" || /^add/i.test(low)) return go("beds");
      if (id === "bc:beds:next" || /^(next|done)$/.test(low)) return go(next(st, "beds"));
      return again();
    }
    case "type": {
      const v = id.indexOf("bc:type:") === 0 ? id.slice(8) : low;
      if (!TYPES.some((t) => t[0] === v)) return again();
      st.type = v; return go(next(st, "type"));
    }
    case "areaGroups": case "areaIn": case "areaMore": {
      if (id === "bc:area:any") { st.areas = []; return go(next(st, "areaGroups")); }
      if (id === "bc:area:done" || (st.step !== "areaIn" && /^done$/.test(low))) return go(next(st, "areaGroups"));
      if (id === "bc:area:more" || id === "bc:area:back") return go("areaGroups");
      if (id.indexOf("bc:ag:") === 0) { const g = Number(id.slice(6)); if (!AREA_GROUPS[g]) return again(); st.group = g; return go("areaIn"); }
      let s = id.indexOf("bc:area:") === 0 ? id.slice(8) : "";
      if (!s && text) { const f = FLOW_AREAS.find(([, n]) => n.toLowerCase() === low); s = f ? f[0] : ""; if (!s && /^any( area)?$/.test(low)) { st.areas = []; return go(next(st, "areaGroups")); } }
      if (!AREA_NAME[s]) return again();
      if (!st.areas.includes(s)) st.areas.push(s);
      return go("areaMore");
    }
    case "max": case "min": {
      if (isSkip) { st[st.step] = null; return go(next(st, st.step)); }
      if (pick) return again();
      const n = parseAed(text);
      if (!n) return go(st.step, "Please type the amount in AED as a number, e.g. 120000. ");
      st[st.step] = n; return go(next(st, st.step));
    }
    case "musts": case "mustsMore": {
      if (id === "bc:must:none" || id === "bc:must:done" || /^(none|done|no more)$/.test(low)) return go(next(st, "musts"));
      if (id === "bc:must:more" || (st.step === "mustsMore" && /^add/.test(low))) return go("musts");
      let k = id.indexOf("bc:must:") === 0 ? id.slice(8) : "";
      if (!k && text) { const c = BRIEF_CRITERIA.find(([kk, l]) => kk === low || l === low); k = c ? c[0] : ""; }
      if (!BRIEF_CRITERIA.some((c) => c[0] === k)) return again();
      if (!st.musts.includes(k)) st.musts.push(k);
      return go(st.musts.length >= BRIEF_CRITERIA.length ? next(st, "musts") : "mustsMore");
    }
    case "summary": {
      if (id === "bc:change" || /^change$/.test(low)) return go("change");
      if (id === "bc:go" || /^(search|go)$/.test(low)) return runSearch(env, from, st, deps);
      return again();
    }
    case "change": {
      const s = id.indexOf("bc:chg:") === 0 ? id.slice(7) : "";
      if (!ORDER.includes(s) && s !== "areaGroups") return again();
      st.editing = true;
      if (s === "beds") st.beds = []; if (s === "areaGroups") st.areas = []; if (s === "musts") st.musts = [];
      return go(s);
    }
  }
  await clear(env, from); return false;
}

async function runSearch(env, from, st, deps) {
  const { sp, client } = answersToQuery(stateAnswers(st));
  await clear(env, from);
  let out = null; try { out = await (deps.search ? deps.search(env, sp) : briefSearch(env, sp, { owner: false })); } catch (e) {}
  if (!out || out.status !== 200) { await deps.send(env, "I could not run that brief just now" + (out && out.body && out.body.error ? " (" + [].concat(out.body.error).join("; ") + ")" : "") + ". Send brief to try again."); return true; }
  const link = deps.briefLink ? deps.briefLink(env, sp) : "";
  await deps.send(env, briefReplyText(sp, client, out.body, link));
  return true;
}
