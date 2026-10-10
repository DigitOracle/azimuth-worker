// v421 - DESK POSTING FIX, offline: fake KV, fake clock, fake OpenAI / Instagram / WhatsApp. Nothing leaves.
//   node test/test_v421_deskfix.mjs
import { deskPostRoute, deskPostTick, putPlan, getPlan, allPlans, refImport, publishGuard, LIKENESS } from "../src/desk_post.js";

const OWNER = "971562276093", DESKPID = "1370146096179819";
const store = new Map();
const KV = { async get(k, t) { const v = store.has(k) ? store.get(k) : null; if (v == null) return null; if (t === "arrayBuffer") return v instanceof ArrayBuffer ? v : new TextEncoder().encode(String(v)).buffer; return v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let T = Date.UTC(2026, 9, 8, 6, 0, 0);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]).buffer;
const JB64 = btoa(String.fromCharCode(...new Uint8Array(JPEG)));
const calls = []; let lastPrompt = "", genFail = false;
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
    calls.push({ host: u.host, method: (init && init.method) || "GET", path: u.pathname, b: b ? Object.fromEntries(b) : null });
    if (u.pathname === "/v21.0/9001/media") return J({ id: b.get("media_type") === "CAROUSEL" ? "CP1" : b.get("is_carousel_item") ? "CH" + calls.length : "C1" });
    if (u.pathname === "/v21.0/9001/media_publish") return J({ id: "M1" });
    if (u.searchParams.get("fields") === "status_code") return J({ status_code: "FINISHED" });
    if (u.searchParams.get("fields") === "permalink") return J({ permalink: "https://www.instagram.com/p/X/" });
  }
  return J({});
};
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const out = [];
const carousel = { hook: "Standards decoded", lines: [{ text: "One idea per slide.", fact: "" }], hashtags: ["#Dubai", "#BIM", "#Standards"], slides: [{ title: "Hook slide", body: "Why handover needs one owner" }, { title: "Step one", body: "Name the owner" }, { title: "Step two", body: "Write it down" }] };
const deps = {
  async send(env, text) { out.push({ t: "text", text }); },
  async buttons(env, text, buttons) { out.push({ t: "buttons", text, buttons }); },
  async image(env, link, cap) { out.push({ t: "image", link, text: cap }); },
  async llm(env, sys) { return JSON.stringify(/Also give 'slides'/.test(sys) ? carousel : { ...carousel, slides: [] }); },
  async vision() { return lastPrompt; },
  async fetchMedia() { return { bytes: JPEG, mime: "image/jpeg" }; },
  origin: () => "https://azimuth-2.example", now: () => T, sleep: async () => {},
};
let env;
const reset = () => { store.clear(); calls.length = 0; out.length = 0; genFail = false; T = Date.UTC(2026, 9, 8, 6, 0, 0);
  env = { MEETINGS: KV, WA_DESK_PHONE_ID: DESKPID, WA_DESK_OWNER: OWNER, OPENAI_API_KEY: "sk-test", IG_APP_ID: "1" };
  store.set("mkt_latest", JSON.stringify({ facts: [] }));
  store.set("ig_auth_desk", JSON.stringify({ user_id: "9001", username: "digitalabbotuae", token: "TOKEN", perms: "instagram_business_basic,instagram_business_content_publish", expires_at: T + 50 * 86400000 })); };
let mid = 0;
const say = async (text) => { out.length = 0; await deskPostRoute(env, { type: "text", from: OWNER, id: "m" + ++mid }, text, deps); return [...out]; };
const tap = async (id) => { out.length = 0; await deskPostRoute(env, { type: "interactive", from: OWNER, id: "m" + ++mid, interactive: { button_reply: { id } } }, "", deps); return [...out]; };
const photo = async (caption) => { out.length = 0; await deskPostRoute(env, { type: "image", from: OWNER, id: "m" + ++mid, image: { id: "jpg", caption } }, "", deps); return [...out]; };
const tick = async () => { out.length = 0; await deskPostTick(env, deps); return [...out]; };
const texts = (a) => a.map((x) => x.text).join("\n");
const gen = () => calls.filter((c) => c.host === "api.openai.com");
const igPosts = () => calls.filter((c) => c.host === "graph.instagram.com" && c.method === "POST");
const planOf = async (pred) => (await allPlans(env)).find(pred || (() => true));
const addRefs = async (n) => { for (let i = 0; i < n; i++) await photo("ref: " + ["headshot", "three-quarter", "site", "speaking"][i % 4]); };

// ============ 1. a carousel: every slide is a generated graphic from the house prompt
reset();
{
  await say("/post alchemy: handover decoded (carousel)"); const p = await planOf();
  const g = gen();
  ok(p.type === "carousel" && p.slides.length === 4 && g.length === 4, "carousel of 4 slides: 4 picture calls", g.length);
  ok(g.every((c) => !c.edit && /FBF7EC/.test(c.prompt) && /0A4F4A/.test(c.prompt) && /C5A56A/.test(c.prompt) && /Render EXACTLY this text/.test(c.prompt)), "each call is the locked house infographic prompt");
  ok(/TITLE: "Hook slide"/.test(g[0].prompt) && /TITLE: "Step one"/.test(g[1].prompt) && /TITLE: "What to do next"/.test(g[3].prompt), "each prompt carries its own slide text");
  ok(p.slides.every((s) => s.img_key && s.src === "ai"), "every slide has a generated picture");
}
// ============ 2. Abbot hook slide with him when 3+ references
reset();
{
  await addRefs(3); calls.length = 0;
  await say("/post abbot: handover decoded (carousel)"); const p = await planOf((x) => /handover/.test(x.idea));
  const g = gen();
  ok(g[0].edit && g[0].nImages >= 2 && g[0].nImages <= 3 && g[0].prompt.includes(LIKENESS) && /TITLE: "Hook slide"/.test(g[0].prompt), "Abbot + 3 refs: slide 1 through edits with 2-3 refs, likeness rules, hook text rendered", JSON.stringify(g[0]).slice(0, 300));
  ok(g.slice(1).every((c) => !c.edit && /No photographs of people/.test(c.prompt)), "the other slides are text graphics without a person");
  ok(p.slides[0].src === "ai-person" && /Illustration\./.test(p.caption), "slide 1 marked as an illustration with his reference; caption says Illustration");
  reset(); await addRefs(2); calls.length = 0; await say("/post abbot: handover decoded (carousel)");
  const p2 = await planOf((x) => /handover/.test(x.idea));
  ok(!gen().some((c) => c.edit) && (p2.notes || []).some((n) => /Slide 1 is a text graphic/.test(n)), "Abbot with 2 refs: slide 1 is a text graphic and the card says why");
  reset(); await addRefs(3); calls.length = 0; await say("/post alchemy: handover decoded (carousel)");
  ok(!gen().some((c) => c.edit), "Alchemy carousel: no person on the hook slide");
}
// ============ 3. uncaptioned photos: one question per burst, never slides
reset();
{
  let r = [];
  for (let i = 0; i < 12; i++) { r = r.concat(await photo("")); T += 5000; }
  ok(r.length === 0, "12 uncaptioned photos: no reply per photo");
  ok(![...store.keys()].some((k) => k.startsWith("igm_")), "uncaptioned photos are not on the public media route");
  r = await tick(); ok(r.length === 0, "the tick waits while the burst is still arriving");
  T += 50000; r = await tick();
  const q = r.filter((x) => x.t === "buttons");
  ok(q.length === 1 && /these 12 photos/.test(q[0].text) && q[0].buttons.map((b) => b.title).join() === "Use in a post,Reference photo,Ignore", "ONE question covering all 12, three buttons", JSON.stringify(q));
  T += 60000; r = await tick(); ok(r.length === 0, "asked once, not every minute");
  calls.length = 0; await say("/post abbot: handover decoded (carousel)"); const p = await planOf();
  ok(p.slides.every((s) => s.src !== "sent") && gen().length === p.slides.length && !p.use_my_photos, "a /post after uncaptioned photos does NOT use them as slides");
  ok(JSON.parse(store.get("desk_post_inbox")).items.length === 12, "the photos still wait for his answer");
  r = await tap("dp:inbox:ref");
  const ix = JSON.parse(store.get("desk_ref_index")); const m = JSON.parse(store.get("desk_ref_" + ix[0]));
  ok(ix.length === 12 && m.tag === "general" && m.approved === true && store.has("desk_refimg_" + ix[0]) && /Saved 12 reference photo/.test(texts(r)), "Reference photo: all 12 saved as refs with tag general", texts(r));
  ok(!store.has("desk_post_inbox"), "inbox cleared");
  r = await say("/ref tag 3 headshot"); ok(JSON.parse(store.get("desk_ref_3")).tag === "headshot" && /tagged headshot/.test(texts(r)), "/ref tag <n> <tag>");
}
// ============ 3b. ref request recent: Reference photo is the first button; Ignore; Use in a post
reset();
{
  await say("/ref add"); T += 3600000;
  await photo(""); await photo(""); T += 60000; let r = await tick(); const q = r.find((x) => x.t === "buttons");
  ok(q && /Save these 2 photos as reference photos\?/.test(q.text) && q.buttons[0].title === "Reference photo", "after a reference request: the question defaults to Reference photo", JSON.stringify(q));
  r = await tap("dp:inbox:ignore"); ok(/Ignored 2/.test(texts(r)) && !store.has("desk_post_inbox") && ![...store.keys()].some((k) => k.startsWith("desk_inbox_img_")), "Ignore drops them");
  store.set("desk_ref_request_at", String(T - 25 * 3600000)); await photo(""); T += 60000; r = await tick();
  ok(r.find((x) => x.t === "buttons").buttons[0].title === "Use in a post", "a reference request older than 24 h: neutral order");
  r = await tap("dp:inbox:use"); calls.length = 0;
  await say("/post abbot: my own picture"); const p = await planOf();
  ok(p.use_my_photos === true && p.slides[0].src === "sent" && gen().length === 0, "Use in a post: the next /post uses them, marked use_my_photos");
}
// ============ 3c. post: captioned photo = single image of THAT photo; pending uncaptioned ones not taken
reset();
{
  await photo(""); await photo(""); calls.length = 0;
  await photo("post abbot: my site visit"); const p = await planOf();
  ok(p.type === "image" && p.slides.length === 1 && p.slides[0].src === "sent" && p.use_my_photos === true && gen().length === 0, "post: caption -> a single-image post of that photo");
  ok(JSON.parse(store.get("desk_post_inbox")).items.length === 2, "the earlier uncaptioned photos stay in the inbox");
  reset(); await photo(""); await photo(""); await say("/post abbot: site visit (carousel) with my photos"); const p2 = await planOf();
  ok(p2.use_my_photos === true && p2.slides.filter((s) => s.src === "sent").length === 2, "/post ... with my photos takes the inbox photos");
}
// ============ 4. preview sends the pictures, then the buttons; no Approve without pictures
reset();
{
  const r = await say("/post alchemy: handover decoded (carousel)"); const p = await planOf();
  const kinds = r.filter((x) => x.t !== "text" || !/^Drafting/.test(x.text)).map((x) => x.t);
  ok(kinds.slice(0, 4).join() === "image,image,image,image" && kinds[kinds.length - 1] === "buttons", "preview: 4 slide images first, buttons last", kinds.join());
  const imgs = r.filter((x) => x.t === "image");
  ok(imgs.every((x, i) => x.link.endsWith(p.slides[i].img_key)) && /Caption, exactly as it will go up/.test(imgs[0].text + texts(r)), "slides in order, the card goes with slide 1");
  ok(r.find((x) => x.t === "buttons").buttons.map((b) => b.title).join() === "Approve,New picture,More options", "pictures present: Approve offered");
  reset(); genFail = true; const r2 = await say("/post alchemy: handover decoded (carousel)"); const p2 = await planOf();
  const first = r2.find((x) => x.t !== "text" || !/^Drafting/.test(x.text));
  ok(/^No pictures yet: /.test(first.text), "image failure: first line 'No pictures yet: <reason>'", first.text.slice(0, 120));
  ok(r2.find((x) => x.t === "buttons").buttons.map((b) => b.title).join() === "Make pictures,More options", "no Approve without pictures");
  const a = await tap("dp:" + p2.id + ":ok"); ok((await getPlan(env, p2.id)).approved !== true, "a forced Approve tap is refused", texts(a));
  reset(); env.IMG_MONTHLY_CAP_USD = "0.01"; const r3 = await say("/post alchemy: handover decoded (carousel)");
  ok(/^No pictures yet: the monthly picture budget/.test(r3.find((x) => x.t !== "text" || !/^Drafting/.test(x.text)).text) && !r3.find((x) => x.t === "buttons").buttons.some((b) => b.title === "Approve"), "budget cap: says so first, no Approve");
}
// ============ 5. /post regen
reset();
{
  await say("/post alchemy: handover decoded (carousel)"); let p = await planOf(); const oldKeys = p.slides.map((s) => s.img_key);
  await tap("dp:" + p.id + ":ok"); p = await getPlan(env, p.id); ok(p.approved === true, "(approved before regen)");
  calls.length = 0; const r = await say("/post regen " + p.id); p = await getPlan(env, p.id);
  ok(gen().length === 4 && p.slides.every((s, i) => s.img_key && s.img_key !== oldKeys[i]), "regen: every slide picture made again");
  ok(p.approved === false && p.status === "draft", "regen: approval cleared, back to draft");
  ok(r.filter((x) => x.t === "image").length === 4 && r[r.length - 1].buttons.map((b) => b.title).join() === "Approve,New picture,More options", "regen: a NEW preview with the pictures and the buttons");
}
// ============ 6. publish guard + the plovqyt-shaped plan
reset();
{
  const keys = []; for (let i = 0; i < 8; i++) { const k = "sent" + i + "abcdef"; store.set("igm_" + k, JPEG); keys.push(k); }
  const plov = { id: "plovqyt", status: "scheduled", approved: true, approved_at: T - 3600000, type: "carousel", lane: "abbot", idea: "standards decoded (carousel)", caption: "Hook\n\n#Dubai #BIM #Standards", slot: T - 1000, created: T - 7200000, expires_at: T + 86400000, history: [], rounds: 0, music: { mode: "none" },
    slides: keys.map((k, i) => ({ title: "Slide " + (i + 1), body: "Body " + (i + 1), source: "", img_key: k, src: "sent", alt: "" })) };
  await putPlan(env, plov);
  ok(/raw photos/.test(publishGuard(plov)), "guard: a carousel of raw sent photos is refused");
  ok(publishGuard({ ...plov, use_my_photos: true }) === "", "guard: allowed when use_my_photos is true");
  ok(/no picture/.test(publishGuard({ ...plov, slides: [{ title: "x" }] })), "guard: a slide without a picture is refused");
  calls.length = 0; const r = await tick(); const p = await getPlan(env, "plovqyt");
  ok(igPosts().length === 0 && p.status === "held" && /raw photos/.test(p.held_reason) && /\/post regen plovqyt/.test(texts(r)), "the plovqyt fixture is refused by the publish tick, held, told how to fix", texts(r));
  calls.length = 0; const rr = await say("/post regen plovqyt"); const q = await getPlan(env, "plovqyt");
  ok(gen().length === 8 && q.slides.every((s) => s.src !== "sent" && s.img_key) && q.approved === false && q.status === "draft", "regen plovqyt: 8 generated slides, needs approval again");
  ok(/TITLE: "Slide 1"/.test(gen()[0].prompt) && /Illustration\./.test(q.caption), "regen uses the stored slide specs; caption gains Illustration");
  ok(rr.filter((x) => x.t === "image").length === 8, "regen preview sends all 8 slides");
  await tap("dp:plovqyt:ok"); await tap("dp:plovqyt:now"); calls.length = 0; await tick();
  ok((await getPlan(env, "plovqyt")).status === "posted" && igPosts().length >= 9, "after regen + re-approval it can publish");
}
// ============ 7. import route
reset();
{
  store.set("igm_aaaaaa111111", JPEG); store.set("igm_bbbbbb222222", JPEG); store.set("igm_cccccc333333", new Uint8Array([0x89, 0x50]).buffer);
  let r = await refImport(env, ["igm_aaaaaa111111", "bbbbbb222222", "cccccc333333", "dddddd444444", "../x"], undefined, false, T);
  ok(r.ok && r.dry && r.would === 2 && !store.has("desk_ref_index"), "dry run: reports, writes nothing", JSON.stringify(r));
  ok(r.rows.find((x) => x.id === "cccccc333333").result === "not a JPEG" && r.rows.find((x) => x.id === "dddddd444444").result === "not found" && r.rows.find((x) => x.id === "../x").result === "bad id", "dry run: not JPEG / not found / bad id reported");
  r = await refImport(env, ["aaaaaa111111", "bbbbbb222222"], "general", true, T);
  const ix = JSON.parse(store.get("desk_ref_index")); const m = JSON.parse(store.get("desk_ref_" + ix[0]));
  ok(r.imported === 2 && ix.length === 2 && m.approved === true && m.tag === "general" && m.source === "owner upload 8 Oct, imported" && store.get("desk_refimg_" + ix[0]) instanceof ArrayBuffer, "apply: refs written with approved, tag, source", JSON.stringify(m));
  r = await refImport(env, ["aaaaaa111111"], "general", true, T); ok(r.rows[0].result === "already imported" && JSON.parse(store.get("desk_ref_index")).length === 2, "apply twice: no duplicate");
  ok(!(await refImport(env, ["aaaaaa111111"], "nonsense", true, T)).ok, "unknown tag refused");
}
const all = JSON.stringify([...store.values()].filter((v) => typeof v === "string")) + JSON.stringify(out);
ok(!/sk-test|TOKEN/.test(JSON.stringify(out)), "no secret in any message");
console.log("\n" + (fail ? fail + " FAILED, " : "all ") + pass + " passed");
process.exit(fail ? 1 : 0);
