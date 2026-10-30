// v677 (Kendall, 30 Oct 2026: "five specific to real estate, five general, five emotional intelligence ... she can choose the colour palette").
// THREE SETS A MORNING. The real-estate five (dailyFeedTick in index.js) are untouched. This module adds, straight after them, two more
// WhatsApp messages with their own pick lists (WhatsApp lists hold 10 rows, so fifteen ideas cannot share one):
//   general  "Beyond property"          five from the day's general news (UAE and world): rail, culture, the economy, sport, openings.
//                                       Every figure must be a number printed in that story; property stories are kept out of it.
//   ei       "Emotional intelligence"   five from the EI DNA (KV mkt_dna_ei, loaded from naj-market-pulse data/dna/emotional_intelligence_dna.json;
//                                       EI_CORE below stands in until it is loaded), one per lane: workplace, selling (her Recode), everyday,
//                                       self, leadership. No invented statistics: a figure is a concept or a principle with its author and year.
// Button ids: fs:<g|e>:pick:N · fs:<g|e>:again · fs:<g|e>:fmt:<li|ig|car>:N · fs:<g|e>:pic:N · fs:<g|e>:pal:N:<palette>
// PALETTES: three, all from her locked style card (10 Sep 2026): the Digest's cream / deep green / bronze gold; her navy with the cream
// bow; her red and rust suits. Each set draws in its own by default; she is asked once per card and may pick any, or "Momo's usual"
// (style_palette, as today). KV style_palette_<id> overrides a named palette without a deploy, the way style_palette does.
export const PALETTE_KEYS = ["beige", "beige2", "gold", "goldD", "green", "greenD", "ink", "mute", "muteL"];
export const FEED_PALETTES = {
  property: { name: "Real estate", note: "cream, deep green, bronze gold", beige: "#F0DECC", beige2: "#E3D0B8", gold: "#A88448", goldD: "#7A5E30", green: "#003C1E", greenD: "#0C3C30", ink: "#00120C", mute: "#5E6F69", muteL: "#B8C4BD" },
  general: { name: "Beyond property", note: "navy and cream", beige: "#F3EBDD", beige2: "#E6DCC8", gold: "#C9A97A", goldD: "#8C7347", green: "#1B2B4A", greenD: "#131F36", ink: "#0A1122", mute: "#5E6878", muteL: "#B9C0CC" },
  ei: { name: "Emotional intelligence", note: "rust and cream", beige: "#F5E9DE", beige2: "#EBD8C8", gold: "#D9A441", goldD: "#9A7020", green: "#7A2E1E", greenD: "#5C2116", ink: "#2A0E09", mute: "#6E5A54", muteL: "#C9B5AD" },
};
export const FEED_SETS = {
  general: { id: "general", tag: "g", name: "Beyond property", palette: "general", header: "🌍 *Beyond property — five from today's news*", lanes: ["city", "transport", "economy", "culture", "world"] },
  ei: { id: "ei", tag: "e", name: "Emotional intelligence", palette: "ei", header: "💛 *Emotional intelligence — five for today*", lanes: ["workplace", "selling", "everyday", "self", "leadership"] },
};
export const SET_IDS = Object.keys(FEED_SETS);
export const setByTag = (t) => SET_IDS.map((k) => FEED_SETS[k]).find((s) => s.tag === t) || null;
const ctxKey = (id) => "mkt_briefctx_" + id, histKey = (id) => "fs_hist_" + id, pendKey = (id) => "fs_pending_" + id;
const HEX = /^#[0-9a-f]{6}$/i;

// a named palette, with her KV override (style_palette_<id>) on top; "usual" is today's behaviour (style_palette over the built-in)
export async function paletteFor(env, deps, pid) {
  if (pid === "usual") { let o = {}; try { o = (await deps.stylePalette(env)) || {}; } catch (e) {} return { id: "usual", colours: Object.assign({}, pick(FEED_PALETTES.property), o) }; }
  const base = FEED_PALETTES[pid]; if (!base) return null;
  let o = {}; try { const p = JSON.parse((await env.MEETINGS.get("style_palette_" + pid)) || "null"); if (p && typeof p === "object") for (const k of PALETTE_KEYS) if (typeof p[k] === "string" && HEX.test(p[k])) o[k] = p[k]; } catch (e) {}
  return { id: pid, colours: Object.assign({}, pick(base), o) };
}
const pick = (p) => { const o = {}; for (const k of PALETTE_KEYS) o[k] = p[k]; return o; };
export function paletteRows(prefix, dflt) {   // the list she sees before a card is drawn; prefix = "fs:e:pal:" + n or "pal:" + n
  return ["property", "general", "ei"].map((p) => ({ id: prefix + ":" + p, title: (p === dflt ? "★ " : "") + FEED_PALETTES[p].name, description: FEED_PALETTES[p].note + (p === dflt ? " · this set's own" : "") }))
    .concat([{ id: prefix + ":usual", title: "Momo's usual", description: "Your stored palette, as today" }]);
}

// ---- Beyond property: the general news, fetched at build time (a handful of feeds, 8 s each) ------------------------------------------
export const GENERAL_FEEDS = [
  { id: "kt_top", outlet: "Khaleej Times", url: "https://www.khaleejtimes.com/api/v1/collections/top-section.rss" },
  { id: "kt_uae", outlet: "Khaleej Times", url: "https://www.khaleejtimes.com/api/v1/collections/uae.rss" },
  { id: "tn_uae", outlet: "The National", url: "https://www.thenationalnews.com/arc/outboundfeeds/rss/category/news/uae/?outputType=xml" },
  { id: "gn_all", outlet: "Gulf News", url: "https://gulfnews.com/feed" },
  { id: "bbc_world", outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "bing_uae", outlet: null, url: "https://www.bing.com/news/search?q=UAE+news&format=rss&mkt=en-AE" },
];
// crime, war and party politics are not her diary; sport, culture and the weather are
export const GENERAL_DROP_RX = /\b(murder|killed|stabb\w+|arrested|jailed|sentenced|rape|abuse|assault|gaza|israel|ukraine|russia|iran|trump|election|airstrikes?|missiles?|war)\b/i;
const titleKey = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
export function generalItems(parsed, nowMs, propRx, gstDay) {
  const seen = new Set(), out = [];
  for (const p of parsed) {
    const at = p.published && p.published <= nowMs + 3600000 ? p.published : 0;
    if (!at || nowMs - at > 36 * 3600000) continue;
    const txt = String(p.title || "") + " " + String(p.summary || "").slice(0, 300);
    if (GENERAL_DROP_RX.test(txt)) continue;
    if (propRx && propRx.test(txt)) continue;   // the first five already cover property
    const k = titleKey(p.title); if (!k || seen.has(k)) continue; seen.add(k);
    out.push({ i: out.length, title: String(p.title || "").slice(0, 160), outlet: p.outlet || "news", at, published: gstDay.fmt(at), today: gstDay.isToday(at), summary: String(p.summary || "").replace(/\s+/g, " ").slice(0, 300), url: p.url || "" });
  }
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, 30).map((x, i) => Object.assign(x, { i }));
}
export async function collectGeneral(env, deps, nowMs) {
  const res = await Promise.allSettled(GENERAL_FEEDS.map((f) => deps.fetchT(f.url, 8000, { headers: { "User-Agent": "Mozilla/5.0 (compatible; najma-news/1.0; +contact@digitalabbot.io)", "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" }, redirect: "follow" })
    .then(async (r) => (r.ok ? deps.parseNewsFeed(await r.text(), f) : []))));
  const parsed = []; res.forEach((r) => { if (r.status === "fulfilled" && Array.isArray(r.value)) parsed.push(...r.value); });
  return generalItems(parsed, nowMs, deps.propRx, deps.gstDay);
}

// ---- Emotional intelligence: the DNA ---------------------------------------------------------------------------------------------------
// Stands in until mkt_dna_ei is loaded. Definitions in our own words; sources are the models' own authors. No effect sizes here on purpose.
export const EI_CORE = {
  name: "Emotional intelligence", version: "core-2026-10-30",
  lanes: [
    { id: "workplace", title: "EI in the workplace", audience_angle: "meetings, feedback, pressure, colleagues", concepts: ["self_awareness", "self_regulation", "empathy", "social_skill", "emotional_labour"], recode_link: null },
    { id: "selling", title: "EI in selling", audience_angle: "reading a client, listening, the fear under the wish", concepts: ["empathy", "active_listening", "ei_in_sales", "perceiving_emotions"], recode_link: "Her Recode: recoding sales habits around how a client feels. Use the name as a theme only; state no Recode facts." },
    { id: "everyday", title: "EI in everyday life", audience_angle: "family, friends, traffic, the phone", concepts: ["amygdala_hijack", "managing_emotions", "self_regulation", "empathy"], recode_link: null },
    { id: "self", title: "EI as an individual", audience_angle: "what you feel and why, before anyone else is involved", concepts: ["self_awareness", "understanding_emotions", "using_emotions", "motivation"], recode_link: null },
    { id: "leadership", title: "EI in leadership", audience_angle: "the mood a leader sets, trust, hard conversations", concepts: ["social_skill", "self_regulation", "empathy", "motivation"], recode_link: null },
  ],
  concepts: [
    { id: "self_awareness", name: "Self-awareness", model: "mixed", plain_definition: "Noticing what you feel as it happens, and how it is colouring what you say and do.", source: "Goleman, Emotional Intelligence, 1995", tips: ["Name the feeling in one word before you answer.", "Notice the body first: jaw, shoulders, breath."] },
    { id: "self_regulation", name: "Self-regulation", model: "mixed", plain_definition: "Choosing the response instead of running the first reaction.", source: "Goleman, Working with Emotional Intelligence, 1998", tips: ["Buy time: a breath, a sip of water, a question back."] },
    { id: "motivation", name: "Motivation", model: "mixed", plain_definition: "Working towards a goal for its own sake, and recovering after a setback.", source: "Goleman, 1995", tips: ["Tie the dull task to the reason you chose this work."] },
    { id: "empathy", name: "Empathy", model: "mixed", plain_definition: "Reading what another person feels, from what they say and from what they do not.", source: "Goleman, 1995; Mayer & Salovey, 1997", tips: ["Repeat back what you heard before you reply to it."] },
    { id: "social_skill", name: "Social skill", model: "mixed", plain_definition: "Handling relationships: influence, conflict, and the mood of a room.", source: "Boyatzis & Goleman, ESCI", tips: ["A room copies the mood of whoever is at the front of it."] },
    { id: "perceiving_emotions", name: "Perceiving emotions", model: "ability", plain_definition: "Spotting emotion accurately in faces, voices and tone, including your own.", source: "Mayer & Salovey, 1997 (ability model)", tips: ["Watch the pause before an answer; it says more than the answer."] },
    { id: "using_emotions", name: "Using emotions", model: "ability", plain_definition: "Letting a feeling point your attention and thinking where it is useful.", source: "Mayer & Salovey, 1997", tips: ["Nervous before a pitch is attention, not a verdict."] },
    { id: "understanding_emotions", name: "Understanding emotions", model: "ability", plain_definition: "Knowing how feelings combine and change: how irritation becomes anger, how relief follows fear.", source: "Mayer & Salovey, 1997", tips: ["Ask what the feeling was five minutes ago; it rarely started where it is now."] },
    { id: "managing_emotions", name: "Managing emotions", model: "ability", plain_definition: "Staying open to a feeling, in yourself or someone else, and steering it rather than shutting it down.", source: "Mayer & Salovey, 1997", tips: ["An emotion is information, not an instruction."] },
    { id: "amygdala_hijack", name: "The amygdala hijack", model: "general", plain_definition: "A sudden emotional reaction that takes over before the thinking part of the brain has weighed in.", source: "Goleman, 1995 (the term)", tips: ["The gap between trigger and reply is the whole skill; breathe through it."], myths: ["There is no fixed number of seconds a hijack lasts."] },
    { id: "active_listening", name: "Active listening", model: "general", plain_definition: "Listening to understand, showing it, and checking you got it, before you answer.", source: "Rogers & Farson, 1957; Weger et al., 2014", tips: ["Let the client finish the sentence you think you can finish for them."] },
    { id: "ei_in_sales", name: "EI in selling", model: "general", plain_definition: "Reading and handling a customer's emotions during a sale, alongside knowing the product.", source: "Kidwell, Hardesty, Murtha & Sheng, Journal of Marketing, 2011", tips: ["A buyer says what they want in the first minute and what they fear later; sell to the second."] },
    { id: "emotional_labour", name: "Emotional labour", model: "general", plain_definition: "The work of showing a feeling your role expects, whether or not you feel it.", source: "Hochschild, The Managed Heart, 1983", tips: ["A fixed smile costs more than an honest, kind sentence."] },
  ],
  claims_to_avoid: [
    "EQ matters more than IQ, or twice as much: the research shows a modest effect that adds to intelligence, it does not beat it.",
    "EI explains 58% (or 90%) of success: vendor figures; the peer-reviewed links with job performance are modest.",
    "An online quiz tells you your true EQ: those quizzes measure how people see themselves, not ability.",
    "EI people are always nice, or more empathy always wins the deal.",
    "Any statistic, percentage or study result that is not in the DNA with its source.",
    "Any fact about Recode: its clients, results, prices or credentials.",
  ],
  sources: [],
};
export async function eiDna(env) {
  try { const d = JSON.parse((await env.MEETINGS.get("mkt_dna_ei")) || "null"); if (d && Array.isArray(d.lanes) && Array.isArray(d.concepts) && d.lanes.length >= 5) return d; } catch (e) {}
  return EI_CORE;
}
// what the generator is handed: for each lane, 2-3 concepts rotated by the day so the week is not the same five, each with its citation
export function eiMaterial(dna, dayIndex) {
  const byId = {}; (dna.concepts || []).forEach((c) => { byId[c.id] = c; });
  const srcById = {}; (dna.sources || []).forEach((s) => { srcById[s.id] = s; });
  const cite = (c) => c.source || (Array.isArray(c.evidence) && c.evidence.length ? c.evidence.map((e) => (srcById[e] && srcById[e].citation) || "").filter(Boolean).slice(0, 2).join("; ") : "") || "the EI literature";
  const lanes = (dna.lanes || []).slice(0, 5).map((l, li) => {
    const ids = (l.concepts || []).filter((id) => byId[id]); const n = ids.length || 1;
    const chosen = [0, 1, 2].map((k) => ids[(dayIndex + li + k) % n]).filter((v, i, a) => v && a.indexOf(v) === i);
    return { id: l.id, title: l.title, audience_angle: l.audience_angle || "", recode: l.recode_link || null,
      concepts: chosen.map((id) => { const c = byId[id]; return { id: c.id, name: c.name, model: c.model, definition: c.plain_definition, source: cite(c), tips: (c.practical_tips || c.tips || []).slice(0, 3), myths: (c.common_myths || c.myths || []).slice(0, 2), video: c.video && c.video.url ? { url: c.video.url, title: c.video.title || "" } : null }; }) };
  });
  return { lanes, claims_to_avoid: (dna.claims_to_avoid || []).map((x) => (typeof x === "string" ? x : x.claim || x.text || JSON.stringify(x))).slice(0, 12) };
}

// ---- generation ------------------------------------------------------------------------------------------------------------------------
export const SET_SCHEMA = { type: "object", additionalProperties: false, properties: { angles: { type: "array", items: { type: "object", additionalProperties: false, properties: { hook: { type: "string" }, figure: { type: "string" }, source: { type: "string" }, buyer: { type: "string" }, lane: { type: "string" }, ref: { type: "string" } }, required: ["hook", "figure", "source", "buyer", "lane", "ref"] } } }, required: ["angles"] };
const NUM_RX = /\d[\d,.]*/g;
const numsIn = (s) => (String(s || "").match(NUM_RX) || []).map((x) => x.replace(/[,.]+$/, "")).filter((x) => x.length >= 2 || /[.,]/.test(x));
export function generalPrompt(voice, hist) {
  return "You pick FIVE distinct, post-worthy angles for a Dubai-based creator's daily social content from today's GENERAL news (not property: her property angles are written elsewhere). Her readers live in Dubai or are deciding to; she posts about the city and the world like a diary of good things happening, honest and never hyped. Each angle is built on ONE story in `stories`: put that story's `i` in `ref` (as a string). `figure` is a number written in THAT story's title or summary, copied exactly with its unit; if the story has no number, `figure` is a short phrase from it (three words at most). Every other number in the hook must be in the same story; never a number from memory, never one combined from two stories. `source` is 'reported by <outlet>, <published>' using the story's own outlet and date. `buyer` is one line on what it means for someone living in Dubai. `lane` is one of city, transport, economy, culture, world, and the five lanes differ. Prefer today:true stories, and at least three of the five about the UAE. AT LEAST FOUR of the five are good news (an opening, a record, an arrival, something that makes the city better to live in). Numbers are written as numerals. "
    + (voice || "") + " Do not reuse these recent hooks: " + JSON.stringify((hist || []).slice(0, 15)) + ". Return JSON only.";
}
export function eiPrompt(voice, hist) {
  return "You write FIVE short, post-worthy angles on EMOTIONAL INTELLIGENCE for a Dubai-based creator whose ground is wellness and how people feel; she also runs Recode, her own practice on selling with emotional intelligence. ONE angle per lane in `lanes`, in that order; `lane` is the lane id. Each angle is built on ONE concept from that lane's `concepts`: put the concept id in `ref`; `figure` is the concept's name (or a principle of it in five words or fewer), never a number; `source` is that concept's `source` exactly as given; `buyer` is one line a reader can do today, taken from the concept's tips. The hook is one or two short sentences in her voice, first person where it fits, specific to the lane (a meeting, a client, a traffic jam, a hard conversation), and says one true thing about the concept; it never invents a statistic, a study result or a percentage. In the selling lane close on the Recode theme in a few words, and state NO fact about Recode. Never make any of these claims: `claims_to_avoid`. "
    + (voice || "") + " Do not reuse these recent hooks: " + JSON.stringify((hist || []).slice(0, 15)) + ". Return JSON only.";
}
export function validateGeneral(angles, items) {
  const seen = new Set(), out = [];
  for (const a of angles || []) {
    const it = items[parseInt(String(a.ref), 10)]; if (!it || seen.has(it.i)) continue;
    const txt = (it.title + " " + it.summary).toLowerCase();
    if (!String(a.source || "").toLowerCase().includes(String(it.outlet || "").toLowerCase().split(" ")[0])) continue;
    if (!numsIn(String(a.hook) + " " + String(a.figure)).every((n) => txt.includes(n.toLowerCase()))) continue;   // every number is in the story
    seen.add(it.i); out.push({ hook: a.hook, figure: a.figure, source: a.source, buyer: a.buyer, lane: a.lane, url: it.url, outlet: it.outlet, set: "general" });
    if (out.length === 5) break;
  }
  return out;
}
export function validateEi(angles, mat) {
  // a concept may sit in several lanes (self-regulation: workplace, everyday, leadership): the angle's own lane decides, else the first lane that holds it
  const find = (ref, lane) => { const l = mat.lanes.find((x) => x.id === lane), c = l && l.concepts.find((x) => x.id === ref); if (c) return Object.assign({ lane: l.id }, c);
    for (const x of mat.lanes) { const y = x.concepts.find((z) => z.id === ref); if (y) return Object.assign({ lane: x.id }, y); } return null; };
  const lanes = new Set(), out = [];
  for (const a of angles || []) {
    const c = find(String(a.ref), String(a.lane || "")); if (!c || lanes.has(c.lane)) continue;
    const allowed = (c.source + " " + c.definition + " " + c.tips.join(" ")).toLowerCase();
    if (!numsIn(String(a.hook) + " " + String(a.figure) + " " + String(a.buyer)).every((n) => allowed.includes(n.toLowerCase()))) continue;   // no number the DNA does not hold
    if (/\d+\s*%/.test(String(a.hook) + String(a.buyer))) continue;
    lanes.add(c.lane); out.push({ hook: a.hook, figure: a.figure || c.name, source: c.source, buyer: a.buyer, lane: c.lane, concept: c.id, video: c.video, set: "ei" });
    if (out.length === 5) break;
  }
  return out;
}
export function setText(set, angles) {
  return set.header + "\n\n" + angles.map((a, i) => (i + 1) + "️⃣ " + a.hook + "\n     " + a.figure + " · " + a.source + (a.video ? "\n     ▶ " + a.video.url : "")).join("\n\n")
    + "\n\n_" + (set.id === "ei" ? "One per lane: " + angles.map((a) => String(a.lane || "").replace(/_/g, " ")).filter(Boolean).join(", ") + ". Nothing here is a statistic." : "Every figure is printed in the story it cites.") + "_\n\nPick one from the list, or type *feed* any time today to see all three lists again.";
}
export const setRows = (set, angles) => angles.slice(0, 10).map((a, i) => ({ id: "fs:" + set.tag + ":pick:" + (i + 1), title: (i + 1) + "️⃣ " + String(a.figure || "").slice(0, 18), description: a.hook }));

export async function buildSet(env, deps, setId, nowMs) {
  const set = FEED_SETS[setId]; let hist = []; try { hist = JSON.parse((await env.MEETINGS.get(histKey(setId))) || "[]"); } catch (e) {}
  const voice = deps.voice || "";
  if (setId === "general") {
    const items = await collectGeneral(env, deps, nowMs);
    if (items.length < 5) return { error: "only " + items.length + " general stories" };
    const g = await deps.claudeJSON(env, generalPrompt(voice, hist), JSON.stringify({ stories: items.map((x) => ({ i: String(x.i), title: x.title, outlet: x.outlet, published: x.published, today: x.today, summary: x.summary })) }), SET_SCHEMA, deps.model, 1400);
    const angles = validateGeneral(g && g.angles, items);
    return angles.length >= 3 ? { set, angles, items: items.length } : { error: "general: " + angles.length + " angles survived the checks" };
  }
  const dna = await eiDna(env), mat = eiMaterial(dna, Math.floor(nowMs / 86400000));
  const g = await deps.claudeJSON(env, eiPrompt(voice, hist), JSON.stringify(mat), SET_SCHEMA, deps.model, 1400);
  const angles = validateEi(g && g.angles, mat);
  return angles.length >= 3 ? { set, angles, dna: dna.version || "core" } : { error: "ei: " + angles.length + " angles survived the checks" };
}
// after the real-estate five went out (or were held): build both sets, store them, send them while her window is open, else hold them
export async function buildExtraSets(env, deps, opts) {
  opts = opts || {}; const nowMs = opts.nowMs || Date.now(), today = deps.gstDateStr(new Date(nowMs + 4 * 3600e3)), note = [];
  for (const setId of SET_IDS) {
    let r; try { r = await buildSet(env, deps, setId, nowMs); } catch (e) { r = { error: String((e && e.message) || e).slice(0, 80) }; }
    if (r.error) { note.push(setId + ": " + r.error); continue; }
    const set = r.set, text = setText(set, r.angles), rows = setRows(set, r.angles);
    await env.MEETINGS.put(ctxKey(setId), JSON.stringify({ at: nowMs, date: today, set: setId, angles: r.angles }), { expirationTtl: 3 * 86400 });
    try { let hist = JSON.parse((await env.MEETINGS.get(histKey(setId))) || "[]"); hist = r.angles.map((a) => a.hook).concat(hist).slice(0, 30); await env.MEETINGS.put(histKey(setId), JSON.stringify(hist), { expirationTtl: 30 * 86400 }); } catch (e) {}
    if (opts.dry) { note.push(setId + ": " + r.angles.length + " (dry)"); continue; }
    if (!(await deps.ownerWindowOpen(env))) { await env.MEETINGS.put(pendKey(setId), JSON.stringify({ at: nowMs, text, rows }), { expirationTtl: 3 * 86400 }); note.push(setId + ": held"); continue; }
    const s = await deps.waSend(env, env.WA_ALLOWED, text);
    if (s && s.ok) { await deps.waSendList(env, env.WA_ALLOWED, set.name + " - pick one:", "Choose an idea", rows); note.push(setId + ": " + r.angles.length + " sent"); }
    else note.push(setId + ": refused by WhatsApp");
  }
  try { await env.MEETINGS.put("fs_last", JSON.stringify({ at: nowMs, date: today, note }), { expirationTtl: 3 * 86400 }); } catch (e) {}
  return note;
}
export async function flushExtraSets(env, deps) {
  for (const setId of SET_IDS) {
    let p = null; try { p = JSON.parse((await env.MEETINGS.get(pendKey(setId))) || "null"); } catch (e) {}
    if (!p || !p.text) continue;
    await env.MEETINGS.delete(pendKey(setId));
    if (Date.now() - (p.at || 0) > 20 * 3600000) continue;
    const s = await deps.waSend(env, env.WA_ALLOWED, p.text);
    if (s && s.ok && p.rows && p.rows.length) await deps.waSendList(env, env.WA_ALLOWED, FEED_SETS[setId].name + " - pick one:", "Choose an idea", p.rows);
  }
}
// "feed" later in the day: the lists again (the real-estate list is re-sent by index.js; these follow it)
export async function resendSetLists(env, deps, to, today) {
  let n = 0;
  for (const setId of SET_IDS) {
    let c = null; try { c = JSON.parse((await env.MEETINGS.get(ctxKey(setId))) || "null"); } catch (e) {}
    if (!c || !Array.isArray(c.angles) || !c.angles.length || (today && c.date !== today)) continue;
    await deps.waSendList(env, to, FEED_SETS[setId].name + " - pick one:", "Choose an idea", setRows(FEED_SETS[setId], c.angles)); n++;
  }
  return n;
}

// ---- her taps ---------------------------------------------------------------------------------------------------------------------------
export function parseSetButton(bid) {
  bid = String(bid || ""); let m;
  if ((m = /^fs:([ge]):(pick|pic):(\d{1,2})$/.exec(bid))) { const set = setByTag(m[1]); return set ? { set, act: m[2], n: +m[3] } : null; }
  if ((m = /^fs:([ge]):again$/.exec(bid))) { const set = setByTag(m[1]); return set ? { set, act: "again" } : null; }
  if ((m = /^fs:([ge]):fmt:(li|ig|car):(\d{1,2})$/.exec(bid))) { const set = setByTag(m[1]); return set ? { set, act: "fmt", kind: m[2], n: +m[3] } : null; }
  if ((m = /^fs:([ge]):pal:(\d{1,2}):(property|general|ei|usual)$/.exec(bid))) { const set = setByTag(m[1]); return set ? { set, act: "pal", n: +m[2], pid: m[3] } : null; }
  return null;
}
const DRAFT_SYS = {
  li: "You write a LinkedIn post for a Dubai-based creator from ONE angle. First line is the hook, specific, no clickbait. Short paragraphs. Use ONLY what the angle gives you: its figure, its source, its takeaway; never add a number, a study or a claim. One practical takeaway. End with one question. At most 3 hashtags. Under 140 words, plain text.",
  ig: "You write an Instagram reel package from ONE angle, plain text, exactly: SCRIPT: 30-45 seconds spoken to camera (70-105 words), hook in the first five words, the angle's figure and source said out loud, one takeaway, no emojis, no stage directions. CAPTION: 2-4 short lines restating the figure with its source, one question, then at most 5 hashtags on the last line. Use ONLY what the angle gives you; never add a number, a study or a claim.",
  car: "You write a 6-slide carousel from ONE angle, plain text, each slide 1-2 short lines: SLIDE 1 COVER: the hook. SLIDE 2: the figure, big, with its source. SLIDE 3: why it matters. SLIDE 4: what to do today. SLIDE 5: the honest caveat. SLIDE 6: a question and the ask to DM. Then CAPTION: 2-3 lines and at most 3 hashtags. Use ONLY what the angle gives you; never add a number, a study or a claim.",
};
export async function handleSetButton(env, deps, from, bid, origin) {
  const b = parseSetButton(bid); if (!b) return false;
  const set = b.set; let c = null; try { c = JSON.parse((await env.MEETINGS.get(ctxKey(set.id))) || "null"); } catch (e) {}
  const angles = (c && c.angles) || [];
  if (b.act === "again") { if (!angles.length) await deps.waSend(env, from, "No " + set.name.toLowerCase() + " ideas on file today - say “feed” and I'll build them."); else await deps.waSendList(env, from, set.name + " - pick one:", "Choose an idea", setRows(set, angles)); return true; }
  const a = angles[b.n - 1];
  if (!a) { await deps.waSend(env, from, "That idea isn't on file any more - say “feed” and I'll show today's lists again."); return true; }
  if (b.act === "pick") {
    try { let pk = JSON.parse((await env.MEETINGS.get("mkt_picks")) || "[]"); pk.unshift({ at: deps.gstDateStr(new Date(Date.now() + 4 * 3600e3)), hook: a.hook, figure: a.figure, source: a.source, set: set.id }); await env.MEETINGS.put("mkt_picks", JSON.stringify(pk.slice(0, 21)), { expirationTtl: 60 * 86400 }); } catch (e) {}
    try { await deps.dnaSignal(env, "picked_" + set.id, a.hook); } catch (e) {}
    await deps.waSend(env, from, "Good pick. What do you want from it?" + (a.video ? "\n\n▶ A short explainer on " + a.figure + ", if you want the concept in your own words first: " + a.video.url : ""));
    const p = "fs:" + set.tag + ":";
    await deps.waSendList(env, from, "Choose a format:", "Format", [
      { id: p + "fmt:li:" + b.n, title: "✍️ LinkedIn post", description: "Short feed post to copy in" },
      { id: p + "fmt:ig:" + b.n, title: "📸 Instagram", description: "Reel script + caption" },
      { id: p + "fmt:car:" + b.n, title: "🎠 Carousel", description: "6 slides + caption" },
      { id: p + "pic:" + b.n, title: "📷 Picture with you", description: "Your card, in the palette you choose" },
      { id: p + "again", title: "🔁 Another idea", description: "Show the list again" }]);
    return true;
  }
  if (b.act === "fmt") {
    const txt = await deps.claudeText(env, DRAFT_SYS[b.kind] + " " + (deps.voice || ""), JSON.stringify({ angle: { hook: a.hook, figure: a.figure, source: a.source, takeaway: a.buyer, lane: a.lane, set: set.name } }), deps.model, 700);
    await deps.waSend(env, from, txt ? txt.slice(0, 3900) : "I couldn't write that one just now - tap the idea again in a minute.");
    try { await deps.dnaSignal(env, "drafted_" + b.kind + "_" + set.id, "idea " + b.n); } catch (e) {}
    await deps.waSendList(env, from, "Want the picture to go with it?", "Picture", paletteRows("fs:" + set.tag + ":pal:" + b.n, set.palette).concat([{ id: "fs:" + set.tag + ":again", title: "Not now", description: "Back to the list" }]));
    return true;
  }
  if (b.act === "pic") { await deps.waSendList(env, from, "Which palette for this card?", "Palette", paletteRows("fs:" + set.tag + ":pal:" + b.n, set.palette)); return true; }
  // pal: draw it, both sizes, keyed by the morning, the idea and the palette (a different palette is a different card)
  const pal = await paletteFor(env, deps, b.pid); if (!pal) return true;
  const o = deps.pubOrigin(origin), key = "fs_" + set.id + "_" + String((c && c.at) || 0) + "_" + b.n + "_" + pal.id;
  const angle = { hook: a.hook, figure: a.figure, source: a.source, buyer: a.buyer };
  const sq = await deps.renderAngleCard(env, angle, b.n, o, 0, from, "square", { key, palette: pal.colours, palId: pal.id, t: set.id === "ei" ? 5 : undefined });
  const st = await deps.renderAngleCard(env, angle, b.n, o, 0, from, "story", { key, palette: pal.colours, palId: pal.id, t: set.id === "ei" ? 5 : undefined });
  if (sq) await deps.waSendImage(env, from, sq.url, "Your card for idea " + b.n + " · " + FEED_PALETTES[pal.id === "usual" ? "property" : pal.id].name + " palette · 1080×1080 for the grid.");
  if (st) await deps.waSendImage(env, from, st.url, "Same card at 1080×1920 - Stories, Reels and TikTok.");
  if (!sq && !st) await deps.waSend(env, from, "Your card is rendering - it lands here in a few minutes.");
  try { await deps.dnaSignal(env, "palette_" + pal.id, set.id); } catch (e) {}
  return true;
}
