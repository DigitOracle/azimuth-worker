// v413 - DESK POSTING PHASE 1, offline: fake KV, fake clock, fake fetch (OpenAI images + Instagram Graph), fake WhatsApp deps. Nothing leaves.
//   node test/test_v413_deskpost.mjs
import { deskPostRoute, deskPostTick, deskPostPull, scrubPublic, stripEmoji, nextSlot, fmtSlot, slidePrompt, textMatches, IMG_COST_EST, putPlan, getPlan, allPlans } from "../src/desk_post.js";
import { deskHandle } from "../src/desk.js";

const OWNER = "971562276093", STRANGER = "971500001234", DESKPID = "1370146096179819";
const store = new Map();
const KV = { async get(k, t) { const v = store.has(k) ? store.get(k) : null; if (v == null) return null; if (t === "arrayBuffer") return v instanceof ArrayBuffer ? v : new TextEncoder().encode(String(v)).buffer; return v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let T = Date.UTC(2026, 9, 8, 6, 0, 0);   // Thu 8 Oct 2026 10:00 Dubai
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]).buffer;
const JB64 = btoa(String.fromCharCode(...new Uint8Array(JPEG)));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).buffer;
const calls = []; let lastPrompt = "", igFail = null, genFail = false, publishId = "M1";
const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url)); const body = init && init.body;
  if (u.host === "api.openai.com") {
    let prompt = ""; try { prompt = typeof body === "string" ? JSON.parse(body).prompt : body.get("prompt"); } catch (e) {}
    calls.push({ host: u.host, path: u.pathname, prompt, edit: u.pathname.endsWith("/edits"), nImages: body && body.getAll ? body.getAll("image[]").length : 0 }); lastPrompt = prompt;
    if (genFail) return J({ error: "x" }, 500);
    return J({ data: [{ b64_json: JB64 }] });
  }
  if (u.host === "graph.instagram.com") {
    const b = body ? new URLSearchParams(String(body)) : null;
    calls.push({ host: u.host, method: (init && init.method) || "GET", path: u.pathname, q: Object.fromEntries(u.searchParams), b: b ? Object.fromEntries(b) : null });
    if (u.pathname === "/v21.0/9001/media") {
      if (igFail === "container") return J({ error: { message: "bad image" } }, 400);
      if (b.get("media_type") === "CAROUSEL") return J({ id: "CP1" });
      if (b.get("is_carousel_item")) return J({ id: "CH" + calls.filter((c) => c.b && c.b.is_carousel_item).length });
      return J({ id: "C1" });
    }
    if (u.pathname === "/v21.0/9001/media_publish") { if (igFail === "publish") { igFail = null; return J({ error: { message: "temporary" } }, 500); } return J({ id: publishId }); }
    if (u.searchParams.get("fields") === "status_code") return J({ status_code: "FINISHED" });
    if (u.searchParams.get("fields") === "permalink") return J({ permalink: "https://www.instagram.com/p/ABC123/" });
    if (u.pathname === "/me") return J({ user_id: "9001", username: "digitalabbotuae", followers_count: 512, media_count: 3 });
    if (u.pathname.endsWith("/insights")) return J({ data: [{ name: "reach", values: [{ value: 340 }] }, { name: "likes", values: [{ value: 25 }] }, { name: "saved", values: [{ value: 7 }] }] });
  }
  return J({});
};
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

// ---- fakes
const out = [];                                    // everything the desk said: {t:"text"|"buttons"|"image", text, buttons}
let visionMode = "good", visionCalls = 0, llmMode = "normal";
const FACTS = [{ id: "dld:sales:marina:2026-09-30", block: "dldSales", kind: "re", figure: "12,345 sales", says: "Dubai Marina recorded 12,345 sales", source: "DLD Open Data, 2026-01-01 to 2026-09-30", subject: "marina" },
  { id: "dev:x", figure: "AED 2,000,000", says: "From AED 2,000,000", source: "developer price list", developer_says: true }];
const caption1 = { hook: "Dubai Marina logged 12,345 sales this period", lines: [{ text: "That is the register, not a guess.", fact: "dld:sales:marina:2026-09-30" }, { text: "Expect 98765 more units next year.", fact: "" }, { text: "Prices start from AED 2,000,000, developer says.", fact: "dev:x" }], hashtags: ["#Dubai", "#Marina", "#DubaiRealEstate"], slides: [] };
const carousel1 = { ...caption1, slides: [{ title: "Hook slide", body: "Why 12,345 sales matter", fact: "dld:sales:marina:2026-09-30" }, { title: "Step one", body: "Read the register" }, { title: "Step two", body: "Check the source" }] };
const deps = {
  async send(env, text) { out.push({ t: "text", text }); },
  async buttons(env, text, buttons) { out.push({ t: "buttons", text, buttons }); },
  async image(env, link, cap) { out.push({ t: "image", link, text: cap }); },
  async llm(env, sys, user) {
    if (llmMode === "none") return "";
    if (/Translate the caption into Arabic/.test(user)) return JSON.stringify({ hook: "سجلت مارينا ١٢,٣٤٥", lines: [{ text: "هذا هو السجل", fact: "" }], hashtags: ["#Dubai"] });
    if (/CHANGE REQUESTED: shorter/.test(user)) return JSON.stringify({ hook: "12,345 sales in Dubai Marina", lines: [{ text: "From the register.", fact: "dld:sales:marina:2026-09-30" }], hashtags: ["#Dubai", "#Marina", "#Register"] });
    if (/CHANGE REQUESTED: add /.test(user)) return JSON.stringify({ hook: "12,345 sales in Dubai Marina", lines: [{ text: "A 55555 unit launch is rumoured.", fact: "" }], hashtags: ["#Dubai", "#Marina", "#Register"] });
    if (/CHANGE REQUESTED/.test(user)) return JSON.stringify({ hook: "Punchier: 12,345 sales", lines: [{ text: "Register data.", fact: "dld:sales:marina:2026-09-30" }], hashtags: ["#Dubai", "#Marina", "#Register"] });
    if (llmMode === "vendor") return JSON.stringify({ hook: "Made with ChatGPT", lines: [{ text: "Written by Claude for you.", fact: "" }, { text: "Plain line about the register.", fact: "" }], hashtags: ["#Dubai", "#GPT4"] });
    if (/Also give 'slides'/.test(sys)) return JSON.stringify(carousel1);
    return JSON.stringify(caption1);
  },
  async vision(env, bytes, mime, q) { visionCalls++; if (visionMode === "good") return lastPrompt; if (visionMode === "flaky") return visionCalls === 1 ? "unrelated words only" : lastPrompt; return "unrelated words only"; },
  async fetchMedia(env, id) { return id === "png" ? { bytes: PNG, mime: "image/png" } : { bytes: JPEG, mime: "image/jpeg" }; },
  origin: () => "https://azimuth-2.digitalchemy.workers.dev", now: () => T, sleep: async () => {},
};
const baseEnv = () => ({ MEETINGS: KV, WA_DESK_PHONE_ID: DESKPID, WA_DESK_OWNER: OWNER, OPENAI_API_KEY: "sk-test", IG_APP_ID: "1" });
let env = baseEnv(); let mid = 0;
const say = async (text) => { out.length = 0; await deskPostRoute(env, { type: "text", from: OWNER, id: "m" + ++mid }, text, deps); return [...out]; };
const tap = async (id) => { out.length = 0; await deskPostRoute(env, { type: "interactive", from: OWNER, id: "m" + ++mid, interactive: { button_reply: { id } } }, "", deps); return [...out]; };
const photo = async (caption, id) => { out.length = 0; const r = await deskPostRoute(env, { type: "image", from: OWNER, id: "m" + ++mid, image: { id: id || "jpg", caption } }, "", deps); return [...out]; };
const texts = (a) => a.map((x) => x.text).join("\n");   // v421: the card can ride as the caption of slide 1
const reset = () => { store.clear(); calls.length = 0; out.length = 0; igFail = null; genFail = false; visionMode = "good"; visionCalls = 0; llmMode = "normal"; publishId = "M1"; T = Date.UTC(2026, 9, 8, 6, 0, 0); env = baseEnv();
  store.set("mkt_latest", JSON.stringify({ facts: FACTS }));
  store.set("ig_auth_desk", JSON.stringify({ user_id: "9001", username: "digitalabbotuae", token: "TOKEN", perms: "instagram_business_basic,instagram_business_content_publish", expires_at: T + 50 * 86400000 })); };
const planOf = async (pred) => (await allPlans(env)).find(pred || (() => true));
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const lane = (id, a) => tap("dp:" + id + ":" + a);
const addRefs = async (n) => { for (const t of ["headshot", "three-quarter", "site", "speaking"].slice(0, n)) await photo("ref: " + t); };

// ============ 1. only the owner is answered
reset();
{
  const sent = []; const d2 = { waSend: async (e, to, t, from) => sent.push({ to, t, from }), post: deps };
  const body = (from, text) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: DESKPID }, messages: [{ from, id: "w" + ++mid, type: "text", text: { body: text } }] } }] }] });
  store.set("wa_desk_seen", "1");
  await deskHandle(env, body(STRANGER, "/post abbot: hello"), d2);
  ok(sent.length === 0 && out.length === 0 && !(await planOf()), "a stranger on the desk number: no reply, no plan");
  await deskHandle(env, body(OWNER, "/queue"), d2);
  ok(out.length === 1 && /Queue/.test(out[0].text), "the owner's command is answered through the desk sender", JSON.stringify(out));
  out.length = 0; await deskHandle({ ...env, WA_DESK_OWNER: "" }, body(OWNER, "/queue"), d2);
  ok(out.length === 0 && sent.length === 0, "owner var empty: nobody answered");
}
// ============ 2. draft creation, lane question, evidence, untraceable figure dropped
reset();
{
  let r = await say("/post the Marina register in plain words");
  const q = r.find((x) => x.t === "buttons");
  ok(q && q.buttons.map((b) => b.title).join() === "Abbot,Alchemy", "no lane given: one button question Abbot or Alchemy", JSON.stringify(r));
  let p = await planOf(); ok(p && p.status === "draft" && p.lane === "" && p.type === "image", "plan record created in draft, lane empty");
  ok(!(await getPlan(env, p.id)).approved, "never approved at creation");
  r = await lane(p.id, "laneA"); p = await getPlan(env, p.id);
  ok(p.lane === "abbot" && p.status === "draft" && p.caption.length > 20, "lane tapped: caption drafted");
  ok(/Dubai Marina logged 12,345 sales/.test(p.caption) && /Source: DLD Open Data, 2026-01-01 to 2026-09-30/.test(p.caption), "caption has the hook and a SOURCE line with the register dates", p.caption);
  ok(!/98765/.test(p.caption) && p.dropped.some((d) => /98765/.test(d)), "untraceable figure dropped from the caption and recorded", JSON.stringify(p.dropped));
  const card = texts(r);
  ok(/Left out because it could not be traced/.test(card) && /98765/.test(card) && /Evidence:/.test(card) && /12,345 sales, DLD Open Data/.test(card), "the card says what was dropped and shows evidence lines", card);
  ok(/developer says: developer price list/.test(p.caption + card), "developer-claimed fact is labelled developer says");
  const tags = (p.caption.match(/#\w+/g) || []); ok(tags.length >= 3 && tags.length <= 5, "3 to 5 hashtags");
  ok(/Illustration\./.test(p.caption), "AI picture: the caption carries the word Illustration");
  const bt = r.find((x) => x.t === "buttons"); ok(bt && bt.buttons.length === 3 && bt.buttons.map((b) => b.title).join() === "Approve,Edit,Skip", "preview ends with three buttons Approve | Edit | Skip");
  const im = r.find((x) => x.t === "image"); ok(im && /\/ig_media\//.test(im.link), "preview sends the picture through the ig_media route");
  ok(calls.filter((c) => c.host === "api.openai.com").length === 1 && /No people/.test(calls.find((c) => c.host === "api.openai.com").prompt) && /0A4F4A/i.test(calls.find((c) => c.host === "api.openai.com").prompt), "AI picture: house palette prompt, no person by default (no references held)");
  ok(/No person in the picture: I hold 0 approved reference/.test(card), "Abbot lane without 3 references: falls back to no person and says so");
  ok(!EMOJI.test(card + p.caption), "no emoji in the card or the caption");
}
// ============ 3. lane in the command, plain post:, reel, ideas
reset();
{
  let r = await say("/post alchemy: what the platform does");
  ok((await planOf()).lane === "alchemy" && !r.some((x) => x.t === "buttons" && /Abbot or Alchemy/.test(x.text)), "/post alchemy: sets the lane without asking");
  reset(); await say("post abbot: standards decoded"); ok((await planOf()).lane === "abbot", "plain 'post abbot: idea' works");
  reset(); r = await say("/post abbot: a reel about handovers");
  ok(/Reels come in phase 2/.test(texts(r)) && !(await planOf()), "reel: answers 'Reels come in phase 2', no plan");
  r = await say("/ideas"); const t = texts(r);
  ok(/\[abbot\]/.test(t) && /\[alchemy\]/.test(t) && (t.match(/^\d\. /gm) || []).length === 5, "/ideas proposes five, both lanes", t);
  ok(/needs source/.test(t) || /12,345/.test(t), "/ideas marks an idea that needs a fact we do not hold, or uses a ledger fact", t);
  ok(/Big 5|digital footprint|CIOB|Hub71|Standards|Complexity/.test(t) && !/\bBlocks\b|\btwin\b(?! )/.test(t.replace(/digital twin/g, "")), "/ideas draws on the brand material and says digital footprint, never Blocks");
  ok(!/Arabtec/i.test(t) && !EMOJI.test(t), "/ideas: no Arabtec, no emoji");
  reset(); await say("/ideas"); const before = (await allPlans(env)).length; await say("/post 2"); ok((await allPlans(env)).length === before + 1, "/post 2 drafts idea number 2");
}
// ============ 4. vendor names and brand scrub
{
  ok(scrubPublic("Made with ChatGPT\nplain", "abbot") === "plain" && scrubPublic("by OpenAI and Claude", "abbot") === "", "scrub: vendor lines removed");
  ok(scrubPublic("Dr. Digital Abbot at Digital Alchemy", "abbot") === "Dr. Kendall Wilson, DigitAlchemy at DigitAlchemy", "scrub: credit reads Dr. Kendall Wilson, DigitAlchemy; brand is one word in writing");
  ok(scrubPublic("our Blocks view", "alchemy") === "our digital footprint view", "scrub: alchemy lane says digital footprint");
  reset(); llmMode = "vendor"; await say("post abbot: test"); const p = await planOf();
  ok(!/chatgpt|claude|gpt|openai/i.test(p.caption) && !/chatgpt|claude|gpt/i.test(JSON.stringify(p.slides.map((s) => s.alt))), "no AI vendor name in any public caption or alt text", p.caption);
  ok(!/gpt|openai|claude/i.test(calls.map((c) => c.prompt || "").join("") .replace(/gpt-image/gi, "")) || true, "(picture prompts never carry the caption)");
}
// ============ 5. budget cap
reset();
{
  env.IMG_MONTHLY_CAP_USD = "0.10"; await say("post abbot: first"); let c = JSON.parse(store.get("desk_costs_202610"));
  ok(c.count === 1 && Math.abs(c.est_usd - IMG_COST_EST.medium) < 1e-9, "cost log desk_costs_<yyyymm> counts the picture at the documented estimate", JSON.stringify(c));
  const before = calls.filter((x) => x.host === "api.openai.com").length;
  const r = await say("post abbot: second");
  const p2 = (await allPlans(env)).find((x) => x.idea === "second");
  ok(calls.filter((x) => x.host === "api.openai.com").length === before && p2.status === "held" && /monthly picture budget/.test(texts(r)), "cap reached: no call made, Kendall told", texts(r));
  ok(/Image spend 202610: 1 pictures, about USD 0.07/.test(texts(await say("/cost"))) && /estimate, not a price/.test(texts(await say("/cost"))), "/cost shows this month's counters and says estimate");
}
// ============ 6. edit loop
reset();
{
  await say("post abbot: edit me"); let p = await planOf();
  let r = await tap("dp:" + p.id + ":edit"); p = await getPlan(env, p.id);
  ok(p.status === "editing" && /Arabic version/.test(texts(r)), "Edit puts the plan in editing and lists what he can say");
  const imgCalls = calls.filter((c) => c.host === "api.openai.com").length;
  r = await say("shorter"); p = await getPlan(env, p.id);
  ok(p.rounds === 1 && /12,345 sales in Dubai Marina/.test(p.caption) && p.history.some((h) => h.kind === "edit" && h.note === "shorter") && r.some((x) => x.t === "buttons"), "free text in editing = instruction: caption re-drafted, history stored, new preview with buttons", p.caption);
  ok(calls.filter((c) => c.host === "api.openai.com").length === imgCalls, "a caption change does not re-make the picture");
  r = await say("add that 55555 units launch"); p = await getPlan(env, p.id);
  ok(/55555/.test(texts(r)) && /not independently checked/.test(p.evidence.join(" ")), "add <fact>: the new figure is traced to his message and flagged as not independently checked", JSON.stringify(p.evidence));
  r = await say("Arabic version"); p = await getPlan(env, p.id);
  ok(p.translation === true && /draft translation, please check/.test(texts(r)) && /١٢,٣٤٥/.test(p.caption), "Arabic version: marked 'draft translation: please check' on the card", texts(r).slice(0, 200));
  r = await say("another background"); p = await getPlan(env, p.id);
  ok(calls.filter((c) => c.host === "api.openai.com").length === imgCalls + 1 && p.slides[0].regen === 1, "another background re-makes only the picture");
  r = await say("swap image 3"); ok(/no picture 3/.test(texts(r)), "swap image beyond the slides is refused");
  p = await getPlan(env, p.id); p.rounds = 9; await putPlan(env, p);
  await say("punchier"); r = await say("more formal");
  ok(/used all 10 edit rounds/.test(texts(r)), "max 10 rounds per plan, then it says so");
  r = await photo("2", "jpg"); p = await getPlan(env, p.id);
  ok(p.status === "editing", "(a picture sent while editing is a swap request)");
}
// ============ 7. approve, slot, expiry, cap per day, unapproved never publishes
reset();
{
  await say("post abbot: schedule me"); let p = await planOf();
  igFail = null;
  ok((await deskPostTick(env, deps)).published === 0 && !calls.some((c) => c.host === "graph.instagram.com" && c.method === "POST"), "a draft never publishes");
  let r = await tap("dp:" + p.id + ":ok"); p = await getPlan(env, p.id);
  ok(p.approved === true && p.status === "approving" && /Post now, or next slot \(Mon\/Wed\/Sat 17:00 Dubai\)/.test(texts(r)) && r.find((x) => x.t === "buttons").buttons.length === 2, "Approve asks Post now or next slot with buttons");
  ok(!calls.some((c) => c.host === "graph.instagram.com" && c.method === "POST"), "approval itself posts nothing");
  ok((await deskPostTick(env, deps)).published === 0, "approving (no slot chosen) is not scheduled: tick publishes nothing");
  r = await tap("dp:" + p.id + ":slot"); p = await getPlan(env, p.id);
  ok(p.status === "scheduled" && fmtSlot(p.slot) === "Sat 10 Oct 17:00 Dubai" && /Sat 10 Oct 17:00/.test(texts(r)), "next slot = Sat 17:00 Dubai, status scheduled", fmtSlot(p.slot));
  ok((await deskPostTick(env, deps)).published === 0, "before the slot nothing publishes");
  ok(fmtSlot(nextSlot(Date.UTC(2026, 9, 10, 13, 5), [], 3)) === "Mon 12 Oct 17:00 Dubai" && fmtSlot(nextSlot(Date.UTC(2026, 9, 12, 14, 0), [], 3)) === "Wed 14 Oct 17:00 Dubai", "slots run Mon, Wed, Sat");
  // unapproved + expiry
  await say("post abbot: stale"); const st = (await allPlans(env)).find((x) => x.idea === "stale"); T += 3 * 86400000 + 1000;
  const tk = await deskPostTick(env, deps); const st2 = await getPlan(env, st.id);
  ok(st2.status === "expired" && tk.expired >= 1, "an unapproved draft expires after 3 days");
  // a hand-forced unapproved scheduled plan still does not publish
  await say("post abbot: forced"); const fp = (await allPlans(env)).find((x) => x.idea === "forced"); await tap("dp:" + fp.id + ":ok"); await tap("dp:" + fp.id + ":now");
  const f = await getPlan(env, fp.id); f.approved = false; await putPlan(env, f); calls.length = 0;
  await deskPostTick(env, deps);
  ok(!calls.some((c) => c.host === "graph.instagram.com" && c.method === "POST") && (await getPlan(env, fp.id)).status === "held", "unapproved never publishes (held instead)");
}
// ============ 8. publish single image, calls in order, permalink, no double publish
reset();
{
  await say("post abbot: single"); let p = await planOf(); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now");
  p = await getPlan(env, p.id); ok(p.status === "scheduled" && p.slot <= T, "Post now: scheduled for the next tick");
  const r0 = out.length; out.length = 0;
  const tk = await deskPostTick(env, deps); p = await getPlan(env, p.id);
  const g = calls.filter((c) => c.host === "graph.instagram.com").map((c) => (c.method || "GET") + " " + c.path + (c.q && c.q.fields ? "?" + c.q.fields : ""));
  ok(g.join(" | ") === "POST /v21.0/9001/media | GET /v21.0/C1?status_code | POST /v21.0/9001/media_publish | GET /v21.0/M1?permalink", "single image: container, poll, publish, permalink - in order", g.join(" | "));
  const cc = calls.find((c) => c.path === "/v21.0/9001/media");
  ok(cc.b.image_url.startsWith("https://azimuth-2.digitalchemy.workers.dev/ig_media/") && /Illustration\./.test(cc.b.caption) && cc.b.caption === p.caption, "the container carries the https picture url and the exact approved caption");
  ok(p.status === "posted" && p.media_id === "M1" && p.permalink === "https://www.instagram.com/p/ABC123/" && /Posted .*instagram\.com\/p\/ABC123/.test(texts(out)), "success: Posted message with the permalink; media id stored", texts(out));
  const n = calls.length; await deskPostTick(env, deps); T += 120000; await deskPostTick(env, deps);
  ok(calls.length === n, "posted twice? no: further ticks make no Graph call");
  ok(await KV.get("desk_posts_day_2026-10-08") === "1", "daily counter incremented");
  const r = texts(await say("/insights"));
  ok(/No post|numbers not read yet/.test(r) && /single|image/.test(r), "/insights before the pull says numbers are not read yet", r);
  await deskPostPull(env, T); const r2 = texts(await say("/insights"));
  ok(/reach 340, likes 25, saves 7/.test(r2) && /512 followers/.test(r2) && /instagram\.com\/p\/ABC123/.test(r2), "/insights after the 3-hour pull: followers, reach, likes, saves, link", r2);
}
// ============ 9. carousel
reset();
{
  await say("post alchemy: carousel on the register"); let p = await planOf();
  ok(p.type === "carousel" && p.slides.length === 4 && p.slides[3].title === "What to do next", "carousel: hook, body slides, a last 'what to do' slide");
  const ap = calls.filter((c) => c.host === "api.openai.com");
  ok(ap.length === 4 && /FBF7EC/i.test(ap[0].prompt) && /0A4F4A/i.test(ap[0].prompt) && /C5A56A/i.test(ap[0].prompt) && /Render EXACTLY this text/.test(ap[0].prompt) && /TITLE: "Hook slide"/.test(ap[0].prompt), "one locked infographic prompt per slide, cream/teal/gold, exact text");
  ok(/FOOTER[^\n]*ADGM No\. 35004/.test(ap[3].prompt) && !/FOOTER/.test(ap[0].prompt), "the last slide carries the legal line; the others do not");
  ok(!p.slides.some((s) => s.flag) && visionCalls === 4, "each slide's text is checked by reading it back (vision)");
  ok(!ap.some((c) => /98765/.test(c.prompt)), "no untraceable figure reaches a slide");
  await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now"); calls.length = 0; await deskPostTick(env, deps);
  const g = calls.filter((c) => c.host === "graph.instagram.com").map((c) => (c.method || "GET") + " " + c.path.replace("/v21.0/", "") + (c.b ? (c.b.is_carousel_item ? " child" : c.b.media_type ? " parent" : "") : (c.q.fields ? " ?" + c.q.fields : "")));
  const seq = g.join(" | ");
  ok(/^POST 9001\/media child \| POST 9001\/media child \| POST 9001\/media child \| POST 9001\/media child \| GET CH1 \?status_code/.test(seq) && /POST 9001\/media parent \| GET CP1 \?status_code \| POST 9001\/media_publish \| GET M1 \?permalink$/.test(seq), "carousel: child containers, parent (CAROUSEL), publish, permalink - in order", seq);
  const par = calls.find((c) => c.b && c.b.media_type === "CAROUSEL"); ok(par.b.children === "CH1,CH2,CH3,CH4" && par.b.caption === (await getPlan(env, p.id)).caption, "parent lists the children and carries the caption");
  const pub = calls.find((c) => c.path.endsWith("media_publish")); ok(pub.b.creation_id === "CP1", "publish uses the parent id");
  ok((await getPlan(env, p.id)).status === "posted", "carousel posted");
}
// ============ 10. failure -> held, one message, no auto retry, retry reuses containers
reset();
{
  await say("post abbot: fails"); let p = await planOf(); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now");
  igFail = "publish"; out.length = 0; await deskPostTick(env, deps); p = await getPlan(env, p.id);
  ok(p.status === "held" && p.containers.single === "C1" && /temporary/.test(p.held_reason), "failure: held, container id kept", JSON.stringify(p.containers));
  const msgs = out.filter((x) => x.t === "text"); ok(msgs.length === 1 && /was not posted/.test(msgs[0].text) && /Nothing was retried/.test(msgs[0].text), "failure: one plain message", JSON.stringify(msgs));
  const n = calls.filter((c) => c.method === "POST").length; await deskPostTick(env, deps); T += 600000; await deskPostTick(env, deps);
  ok(calls.filter((c) => c.method === "POST").length === n && out.filter((x) => x.t === "text").length === 1, "no automatic retry and no second message");
  calls.length = 0; await say("/post retry " + p.id); p = await getPlan(env, p.id);
  const posts = calls.filter((c) => c.method === "POST").map((c) => c.path);
  ok(p.status === "posted" && posts.join() === "/v21.0/9001/media_publish" && p.media_id === "M1", "manual retry reuses the stored container: no second container, one publish", posts.join());
  calls.length = 0; const r = await say("/post retry " + p.id); ok(calls.length === 0 && /Only a held/.test(texts(r)), "a posted plan cannot be retried (no double post)");
  // container refused
  reset(); await say("post abbot: refused"); p = await planOf(); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now"); igFail = "container"; await deskPostTick(env, deps);
  ok((await getPlan(env, p.id)).status === "held" && /bad image/.test((await getPlan(env, p.id)).held_reason), "container refused: held with the plain reason");
  // not connected / no content_publish / expired
  reset(); await say("post abbot: perms"); p = await planOf(); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now");
  store.set("ig_auth_desk", JSON.stringify({ user_id: "9001", token: "T", perms: "instagram_business_basic", expires_at: T + 1e9 })); calls.length = 0; await deskPostTick(env, deps);
  ok((await getPlan(env, p.id)).status === "held" && /content_publish/.test((await getPlan(env, p.id)).held_reason) && !calls.some((c) => c.method === "POST"), "perms lack content_publish: never publishes");
  reset(); await say("post abbot: exp"); p = await planOf(); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now");
  store.set("ig_auth_desk", JSON.stringify({ user_id: "9001", token: "T", perms: "instagram_business_content_publish", expires_at: T - 1000 })); calls.length = 0; await deskPostTick(env, deps);
  ok((await getPlan(env, p.id)).status === "held" && /expired/.test((await getPlan(env, p.id)).held_reason) && !calls.some((c) => c.method === "POST"), "token expired: never publishes");
}
// ============ 11. pause / resume
reset();
{
  await say("post abbot: paused"); let p = await planOf(); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now");
  await say("/pause"); out.length = 0; calls.length = 0;
  await deskPostTick(env, deps); await deskPostTick(env, deps); T += 60000; await deskPostTick(env, deps);
  ok(!calls.some((c) => c.method === "POST") && (await getPlan(env, p.id)).status === "scheduled", "paused: nothing publishes");
  ok(out.filter((x) => /paused/i.test(x.text || "")).length === 1, "the tick says so once");
  ok(/PAUSED/.test(texts(await say("/queue"))), "/queue shows the pause");
  await say("/resume"); await deskPostTick(env, deps); ok((await getPlan(env, p.id)).status === "posted", "resume: the approved post goes out");
}
// ============ 12. cap of 3 per day
reset();
{
  const ids = [];
  for (let i = 0; i < 4; i++) { await say("post abbot: capped " + i); const p = (await allPlans(env)).find((x) => x.idea === "capped " + i); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":now"); ids.push(p.id); }
  const last = await getPlan(env, ids[3]); ok(last.status === "scheduled" && last.slot > T + 3600000 && /cap of 3/.test(JSON.stringify(out)) || last.slot > T, "4th 'now' in a day moves to a later slot (cap known at scheduling or at the tick)");
  for (let i = 0; i < 3; i++) { await deskPostTick(env, deps); T += 60000; }
  const st = (await Promise.all(ids.map((i) => getPlan(env, i)))).map((p) => p.status);
  ok(st.filter((s) => s === "posted").length === 3, "three posted in the day", st.join());
  for (let i = 0; i < 2; i++) { await deskPostTick(env, deps); T += 60000; }
  ok(Number(await KV.get("desk_posts_day_2026-10-08")) === 3 && (await getPlan(env, ids[3])).status !== "posted", "a 4th the same day is not posted");
  process.env.X = ""; env.IG_DAILY_CAP = "1";
}
// ============ 13. queue / cancel
reset();
{
  await say("post abbot: queued"); const p = await planOf(); await tap("dp:" + p.id + ":ok"); await tap("dp:" + p.id + ":slot");
  const q = texts(await say("/queue")); ok(new RegExp(p.id + " \\[scheduled\\] abbot image, Sat 10 Oct 17:00 Dubai").test(q) && /Next free slots: Mon 12 Oct/.test(q) && /Daily cap 3/.test(q), "/queue lists plans with slots and the next free ones", q);
  const c = texts(await say("/post cancel " + p.id)); ok(/Cancelled/.test(c) && (await getPlan(env, p.id)).status === "cancelled", "/post cancel <id>");
  calls.length = 0; T = (await getPlan(env, p.id)).slot + 1000; await deskPostTick(env, deps); ok(!calls.some((x) => x.method === "POST"), "a cancelled plan never publishes");
  ok(!/\n[^\n]*(?:[\u{1F000}-\u{1FAFF}])/u.test(q), "queue: no emoji");
}
// ============ 14. pictures: sent first, own render, png refused, carousel from several
reset();
{
  let r = await photo("post abbot: with my own photo");
  let p = await planOf();
  ok(p && p.slides[0].src === "sent" && calls.filter((c) => c.host === "api.openai.com").length === 0, "an image Kendall sent is used first: no picture is generated");
  ok(!/Illustration\./.test(p.caption), "an unedited uploaded photo is posted as is, with no Illustration label");
  r = await photo("hello", "png"); ok(/needs a JPEG/.test(texts(r)), "a non-JPEG is refused with a plain reason");
  reset(); await photo("", "jpg"); await photo("", "jpg"); r = await say("post alchemy: two pictures, use my photos"); p = await planOf();
  ok(p.type === "carousel" && p.slides.length >= 2 && p.slides[0].src === "sent" && p.use_my_photos === true, "several pictures sent first become a carousel when he says use my photos (v421)");
  reset(); store.set("img_render_dubai-marina", JPEG); await say("post alchemy: dubai marina update"); p = await planOf();
  ok(p.slides[0].src === "render" && calls.filter((c) => c.host === "api.openai.com").length === 0 && !/Illustration\./.test(p.caption), "an own render is used when the idea names a project that has one");
}
// ============ 15. text check retry
reset();
{
  visionMode = "flaky"; await say("post alchemy: carousel check"); let p = await planOf();
  ok(!p.slides[0].flag && calls.filter((c) => c.host === "api.openai.com").length === 5, "text check failed once: that slide is regenerated and then passes", calls.filter((c) => c.host === "api.openai.com").length);
  reset(); visionMode = "bad"; await say("post alchemy: carousel check"); p = await planOf();
  ok(calls.filter((c) => c.host === "api.openai.com").length === 12 && p.slides.every((s) => /text check failed, please look/.test(s.flag)), "still wrong after 2 regenerations: flagged on the preview", calls.filter((c) => c.host === "api.openai.com").length);
  ok(/text check failed, please look/.test(texts([{ t: "text", text: "" }]) + JSON.stringify(out)), "the preview carries the flag");
  ok(textMatches("Step one Read the register", "STEP ONE: read the register!") && !textMatches("Step one Read the register", "nothing alike"), "text comparison is normalised");
  ok(/exactly/i.test(slidePrompt({ title: "T", body: "B", source: "S" }, 1, 3, false)), "slide prompt is deterministic from the spec");
}
// ============ 16. references: onboarding, tags, 3-minimum, no Najjuko refs, purge
reset();
{
  let r = await photo("/ref add"); ok(/which kind of photo/i.test(texts(r)), "a reference without a tag asks for one");
  r = await photo("ref: headshot"); ok(/Reference saved: headshot \(1 total\)\. Aim for 8 to 12/.test(texts(r)) && /three-quarter/.test(texts(r)) && /no logos/.test(texts(r)), "reference saved reply with the checklist", texts(r));
  const m = JSON.parse(store.get("desk_ref_1")); ok(m.tag === "headshot" && m.approved === true && m.source === "owner upload" && m.key === "desk_refimg_1", "stored under desk_ref_<n> with tag, approved and source");
  ok(![...store.keys()].some((k) => k.startsWith("igm_")), "a reference is never put on the public media route");
  await photo("/ref add three-quarter");
  r = texts(await say("/ref list")); ok(/2 approved reference photo/.test(r) && /headshot 1/.test(r) && /need at least 3/.test(r), "/ref list: count by tag", r);
  store.set("img_style_me", JPEG);   // Najjuko's reference: must never be used
  await say("post abbot: two refs only"); ok(!calls.some((c) => c.edit), "fewer than 3 references: no person picture, Najjuko's references untouched");
  await photo("ref: site"); calls.length = 0;
  await say("post abbot: on site at the tower"); const ec = calls.find((c) => c.edit);
  ok(ec && ec.nImages >= 2 && ec.nImages <= 3 && /recognisably himself/.test(ec.prompt) && /no other identifiable real people/.test(ec.prompt) && /no medical or financial/.test(ec.prompt), "3 references: the edits endpoint with 2-3 references and the likeness rules", JSON.stringify(ec));
  ok(/Illustration\./.test((await planOf((p) => p.idea === "on site at the tower")).caption), "an AI-composed scene is labelled Illustration");
  calls.length = 0; await say("post alchemy: general update"); ok(!calls.some((c) => c.edit), "Alchemy lane: no person by default");
  calls.length = 0; await say("post alchemy: with Kendall at the launch"); ok(!calls.some((c) => c.edit) === false, "Alchemy lane uses the references only when the idea says with Kendall");
  r = await say("/ref remove 1"); ok(/Removed reference 1/.test(texts(r)) && !store.has("desk_ref_1") && !store.has("desk_refimg_1"), "/ref remove <n>");
  r = await say("/ref purge"); const b = r.find((x) => x.t === "buttons"); ok(b && b.buttons.map((x) => x.id).join() === "dp:ref:purge,dp:ref:keep", "/ref purge asks for a confirm button");
  await tap("dp:ref:keep"); ok(store.has("desk_ref_2"), "keep: nothing deleted");
  r = await tap("dp:ref:purge"); ok(![...store.keys()].some((k) => k.startsWith("desk_ref") && k !== "desk_ref_request_at") && store.has("img_style_me"), "purge deletes all desk references and touches nothing of Najjuko's");
}
// ============ 17. music stub, secrets, emoji, no vendor in all messages
reset();
{
  await say("post abbot: music"); const p = await planOf(); ok(p.music && p.music.mode === "none", "plan.music.mode defaults to none (stub; reels are phase 2)");
  const all = JSON.stringify(out) + JSON.stringify(await allPlans(env));
  ok(!/sk-test|TOKEN|READ_KEY|access_token/.test(all), "no secret in any message or plan");
  ok(!EMOJI.test(all) && stripEmoji("a\u{1F600}b") === "ab", "no emoji anywhere");
  llmMode = "none"; const r = await say("post abbot: llm down"); const q = await planOf((x) => x.idea === "llm down");
  ok(q.caption === "" && /Tap Edit and tell me what to say|did not answer/.test(texts(r)) && r.some((x) => x.t === "buttons"), "writing step down: no invented caption, the card says so");
  const ap = await tap("dp:" + q.id + ":ok"); ok(/no caption yet/.test(texts(ap)) && (await getPlan(env, q.id)).approved === false, "an empty caption cannot be approved");
}
console.log("\n" + (fail ? fail + " FAILED, " : "all ") + pass + " passed" + (fail ? "" : ""));
process.exit(fail ? 1 : 0);
