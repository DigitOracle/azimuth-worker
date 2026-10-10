// v329 - WhatsApp template definitions and the OWNER-ONLY routes that submit them to Meta and switch the sends over.
// Why: the approved azimuth_daily template carries a fixed Meta-side footer and an "Open my board" button that point at a board
// that no longer exists. Two new plain templates replace it, with no variables, no header, no footer, no buttons.
//
// Routes (all owner key = READ_KEY in the query, like the other owner routes; 401 otherwise):
//   POST /wa_template_create?name=&waba=&confirm=yes&dry=0   dry=1 is the DEFAULT: returns the JSON that would be sent, sends nothing.
//   GET  /wa_template_status?name=&waba=                     APPROVED / PENDING / REJECTED plus the rejection reason.
//   POST /wa_template_use?name=najma_feed_ready&confirm=yes  checks status first, refuses unless APPROVED, then sets KV feed_template.
// The token is only ever put in an Authorization header. It is never returned, logged or echoed.

export const WA_TEMPLATES = {
  najma_feed_ready: {
    name: "najma_feed_ready", language: "en_US", category: "UTILITY",
    body: "Black Coffee, your five angles for today are ready. Reply here and I will send them. Curated by Papi",
  },
  najma_log_day: {
    name: "najma_log_day", language: "en_US", category: "UTILITY",
    body: "Black Coffee, a quick note: what did you eat and how did you move today? Reply here with a line or a photo, for example food: chicken salad, or gym: 40 min. Curated by Papi",
  },
  // v457 (Kendall 10 Oct): Meta moved the two above to MARKETING. Plain, account-style wording with a date so they read as UTILITY.
  najma_feed_update: {
    name: "najma_feed_update", language: "en_US", category: "UTILITY",
    body: "Your daily market update for {{1}} is ready. Reply to this message to receive it.", example: ["10 Oct"],
  },
  najma_log_reminder: {
    name: "najma_log_reminder", language: "en_US", category: "UTILITY",
    body: "Reminder: your Momo log for {{1}} has no entries yet. Reply with what you ate or how you moved, for example food: chicken salad, or gym: 40 min.", example: ["10 Oct"],
  },
  // v459 (Kendall 10 Oct: "yes submit the template, DigitAlchemy number") - the site-clarity video broadcast. MARKETING, video header
  // (the sample is the hosted clip vid_site_clarity_75, uploaded to Meta at submit time), first name as {{1}}, two quick replies and a link.
  digitalchemy_site_clarity: {
    name: "digitalchemy_site_clarity", language: "en", category: "MARKETING", header_video_key: "site_clarity_75",
    body: "Hi {{1}}, a short one from DigitAlchemy.\n\nOn site, the costly problems are the ones nobody sees in time. Together with our partner GoCanvas, we bring drawings, digital inspections, progress and the market into one live view, so your team and your client work from the same facts on the same day.\n\n75 seconds on how it works. If it's relevant to a project you're on, reply here and we'll set up a short call.",
    example: ["Ahmed"], footer: "DigitAlchemy® · Complexity into clarity",
    buttons: [{ type: "QUICK_REPLY", text: "Book a call" }, { type: "QUICK_REPLY", text: "Not for me" }, { type: "URL", text: "Visit DigitAlchemy", url: "https://digitalabbot.io" }],
  },
};
export const DEFAULT_FEED_TEMPLATE = "azimuth_daily";
export const FEED_TEMPLATE_KV = "feed_template";
export const LOG_NUDGE_TEMPLATE = "najma_log_day";   // for the log worker's use; there is deliberately no send path here

// The exact payload Meta receives. Body only: no header, no footer, no buttons, no variables (so no examples).
export function buildCreatePayload(name, headerHandle) {
  const t = WA_TEMPLATES[name]; if (!t) return null;
  const c = [];
  if (t.header_video_key) c.push({ type: "HEADER", format: "VIDEO", example: { header_handle: [headerHandle || "<uploaded at submit>"] } });
  c.push(Object.assign({ type: "BODY", text: t.body }, t.example ? { example: { body_text: [t.example] } } : {}));
  if (t.footer) c.push({ type: "FOOTER", text: t.footer });
  if (t.buttons) c.push({ type: "BUTTONS", buttons: t.buttons });
  return { name: t.name, language: t.language, category: t.category, components: c };
}

// v459 - Meta's resumable upload: the sample video for a VIDEO header becomes a handle ("4::...") the template refers to.
export async function uploadHeaderSample(env, graph, bytes, fileName, deps) {
  const f = (deps && deps.fetch) || fetch;
  const H = { Authorization: "Bearer " + env.WHATSAPP_TOKEN };
  const app = await (await f(`${graph}/app`, { headers: H })).json().catch(() => ({}));
  if (!app || !app.id) return { error: "could not read the app id: " + String((app && app.error && app.error.message) || "no answer").slice(0, 200) };
  const s = await (await f(`${graph}/${app.id}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${bytes.byteLength}&file_type=video/mp4`, { method: "POST", headers: H })).json().catch(() => ({}));
  if (!s || !s.id) return { error: "upload session refused: " + String((s && s.error && s.error.message) || "no answer").slice(0, 200) };
  const u = await (await f(`${graph}/${s.id}`, { method: "POST", headers: { Authorization: "OAuth " + env.WHATSAPP_TOKEN, file_offset: "0" }, body: bytes })).json().catch(() => ({}));
  if (!u || !u.h) return { error: "upload refused: " + String((u && u.error && u.error.message) || "no answer").slice(0, 200) };
  return { handle: u.h };
}

// Meta's list response -> one small, secret-free object.
export function parseStatus(j, name) {
  const rows = (j && Array.isArray(j.data)) ? j.data : [];
  const r = rows.find((x) => x && x.name === name);
  if (!r) return { found: false, status: "NOT_FOUND", name };
  return { found: true, name, status: String(r.status || "UNKNOWN").toUpperCase(), category: r.category || null,
    rejected_reason: r.rejected_reason && r.rejected_reason !== "NONE" ? String(r.rejected_reason) : null };
}

const J = (o, s) => new Response(JSON.stringify(o, null, 2), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function templateStatus(env, graph, name, waba) {
  const id = waba || env.WABA_ID;
  if (!id) return { ok: false, error: "need waba (business account id) or env.WABA_ID" };
  if (!env.WHATSAPP_TOKEN) return { ok: false, error: "no WHATSAPP_TOKEN configured" };
  try {
    const r = await fetch(`${graph}/${encodeURIComponent(id)}/message_templates?name=${encodeURIComponent(name)}&fields=name,status,category,rejected_reason`,
      { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, http: r.status, error: String((j && j.error && j.error.message) || "Meta error").slice(0, 300) };
    return { ok: true, ...parseStatus(j, name) };
  } catch (e) { return { ok: false, error: "unreachable" }; }
}

// Returns a Response for the three routes, or null for any other path. deps: { graph }.
export async function templateRoutes(request, env, url, deps) {
  const p = url.pathname;
  if (p !== "/wa_template_create" && p !== "/wa_template_status" && p !== "/wa_template_use") return null;
  if (!env.READ_KEY || url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
  const q = url.searchParams, graph = deps.graph, name = q.get("name") || "", waba = q.get("waba") || env.WABA_ID || "";
  if (!WA_TEMPLATES[name]) return J({ ok: false, error: "name must be one of " + Object.keys(WA_TEMPLATES).join(", ") }, 400);

  if (p === "/wa_template_status") {
    if (request.method !== "GET") return J({ ok: false, error: "GET only" }, 405);
    return J(await templateStatus(env, graph, name, waba));
  }
  if (request.method !== "POST") return J({ ok: false, error: "POST only (this route writes)" }, 405);
  if (q.get("confirm") !== "yes") return J({ ok: false, error: "confirm=yes is required" }, 400);

  if (p === "/wa_template_create") {
    let payload = buildCreatePayload(name);
    if (q.get("dry") !== "0") return J({ dry: true, would_post: `${graph}/${waba || "<waba>"}/message_templates`, payload, note: "nothing was sent; add dry=0 to submit" });
    if (!waba) return J({ ok: false, error: "need waba (business account id) or env.WABA_ID" }, 400);
    if (!env.WHATSAPP_TOKEN) return J({ ok: false, error: "no WHATSAPP_TOKEN configured" }, 500);
    const tdef = WA_TEMPLATES[name];
    if (tdef.header_video_key) {
      const bytes = await env.MEETINGS.get("vid_" + tdef.header_video_key, "arrayBuffer");
      if (!bytes) return J({ ok: false, error: "the sample video vid_" + tdef.header_video_key + " is not stored" }, 400);
      const up = await uploadHeaderSample(env, graph, bytes, tdef.header_video_key + ".mp4", deps);
      if (up.error) return J({ ok: false, error: up.error }, 502);
      payload = buildCreatePayload(name, up.handle);
    }
    try {
      const r = await fetch(`${graph}/${encodeURIComponent(waba)}/message_templates`, {
        method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      return J({ ok: r.ok, http: r.status, id: j.id || null, status: j.status || null, error: r.ok ? null : String((j.error && j.error.message) || "Meta error").slice(0, 300) }, r.ok ? 200 : 502);
    } catch (e) { return J({ ok: false, error: "unreachable" }, 502); }
  }

  // /wa_template_use - only the feed template can be switched; the log template has no send path.
  if (name !== "najma_feed_ready") return J({ ok: false, error: "only najma_feed_ready can be switched on" }, 400);
  const st = await templateStatus(env, graph, name, waba);
  if (!st.ok || st.status !== "APPROVED") return J({ ok: false, refused: true, why: "template is not APPROVED", status: st }, 409);
  await env.MEETINGS.put(FEED_TEMPLATE_KV, name);
  return J({ ok: true, feed_template: name });
}

// Which template the feed's out-of-window nudge uses: the KV flag if it names a known template, else azimuth_daily.
export async function feedTemplateFlag(env) {
  try { const v = await env.MEETINGS.get(FEED_TEMPLATE_KV); if (v === "najma_feed_ready") return v; } catch (e) {}
  return DEFAULT_FEED_TEMPLATE;
}
