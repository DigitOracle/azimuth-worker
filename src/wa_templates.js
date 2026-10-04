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
};
export const DEFAULT_FEED_TEMPLATE = "azimuth_daily";
export const FEED_TEMPLATE_KV = "feed_template";
export const LOG_NUDGE_TEMPLATE = "najma_log_day";   // for the log worker's use; there is deliberately no send path here

// The exact payload Meta receives. Body only: no header, no footer, no buttons, no variables (so no examples).
export function buildCreatePayload(name) {
  const t = WA_TEMPLATES[name]; if (!t) return null;
  return { name: t.name, language: t.language, category: t.category, components: [{ type: "BODY", text: t.body }] };
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
    const payload = buildCreatePayload(name);
    if (q.get("dry") !== "0") return J({ dry: true, would_post: `${graph}/${waba || "<waba>"}/message_templates`, payload, note: "nothing was sent; add dry=0 to submit" });
    if (!waba) return J({ ok: false, error: "need waba (business account id) or env.WABA_ID" }, 400);
    if (!env.WHATSAPP_TOKEN) return J({ ok: false, error: "no WHATSAPP_TOKEN configured" }, 500);
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
