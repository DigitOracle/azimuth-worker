// v409 - OWNER-ONLY check and register of the desk WhatsApp number (WA_DESK_PHONE_ID) with the WhatsApp Cloud API.
// Why: the desk number shows PENDING in WhatsApp Manager until it is registered through the API, and only the worker holds WHATSAPP_TOKEN.
//   GET  /wa_desk_status?key=            reads the number's status from Meta and says the next step in plain words.
//   POST /wa_desk_register?key=[&pin=]   registers the number. Refuses when it is already CONNECTED. Only ever touches env.WA_DESK_PHONE_ID.
// The token is only put in an Authorization header. The PIN lives in KV wa_desk_pin; it is never returned, logged or echoed.

export const DESK_PIN_KV = "wa_desk_pin";
export const DESK_FIELDS = "display_phone_number,verified_name,name_status,status,quality_rating,code_verification_status,platform_type,throughput";
const J = (o, s) => new Response(JSON.stringify(o, null, 2), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const DIG = (v) => String(v == null ? "" : v).replace(/[^0-9]/g, "");

// Meta's phone-number object -> exactly the requested fields.
export function pickFields(j) {
  const o = {}; for (const f of DESK_FIELDS.split(",")) o[f] = (j && j[f] !== undefined) ? j[f] : null;
  return o;
}
export function nextStep(st) {
  const s = String((st && st.status) || "").toUpperCase();
  if (s === "CONNECTED") return "Already connected. Nothing to register. You can now press Connect Instagram on the number's profile in WhatsApp Manager.";
  if (s === "PENDING" || s === "UNVERIFIED" || s === "") return "Not registered yet. Run POST /wa_desk_register with your owner key (scripts\\wa_desk_register.py --register). Then check this status again.";
  return "Status is " + s + ". Register is allowed only while the number is not CONNECTED; run POST /wa_desk_register, then check status again.";
}
export function mapMetaError(code, msg) {
  const c = Number(code);
  if (c === 133005) return "Two-step PIN mismatch: a PIN already exists on this number and it is not the one stored. Supply the existing PIN once as ?pin=NNNNNN on POST /wa_desk_register; it will then be stored.";
  if (c === 131056) return "Rate limit: too many register attempts. Wait a few minutes and try again.";
  if (c === 100) return "Invalid parameter: Meta rejected the request. Check that WA_DESK_PHONE_ID is this number's phone number ID.";
  if (c === 190) return "Meta rejected the access token (expired or lacks permission).";
  return "Meta refused (code " + (Number.isFinite(c) ? c : "unknown") + "): " + String(msg || "no detail").replace(/[0-9]{6,}/g, "#").slice(0, 160);
}
const missing = () => J({ ok: false, error: "WA_DESK_PHONE_ID is not set. Set the worker secret WA_DESK_PHONE_ID to the desk number's phone number ID, then retry." }, 500);

async function getStatus(env, graph, pid) {
  if (!env.WHATSAPP_TOKEN) return { ok: false, error: "WHATSAPP_TOKEN is not configured on the worker." };
  try {
    const r = await fetch(`${graph}/${pid}?fields=${DESK_FIELDS}`, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, http: r.status, error: mapMetaError(j && j.error && j.error.code, j && j.error && j.error.message) };
    return { ok: true, ...pickFields(j) };
  } catch (e) { return { ok: false, error: "Meta unreachable." }; }
}
function randomPin() { const a = new Uint32Array(1); let v; do { crypto.getRandomValues(a); v = a[0]; } while (v >= 4294000000); return String(v % 1000000).padStart(6, "0"); }

// Returns a Response for the two routes, or null for any other path. deps: { graph }.
export async function deskRegRoutes(request, env, url, deps) {
  const p = url.pathname;
  if (p !== "/wa_desk_status" && p !== "/wa_desk_register") return null;
  if (!env.READ_KEY || url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
  const pid = DIG(env.WA_DESK_PHONE_ID); if (!pid) return missing();
  const graph = deps.graph;

  if (p === "/wa_desk_status") {
    if (request.method !== "GET") return J({ ok: false, error: "GET only" }, 405);
    const st = await getStatus(env, graph, pid);
    return J(st.ok ? { ...st, next_step: nextStep(st) } : st, st.ok ? 200 : 502);
  }
  if (request.method !== "POST") return J({ ok: false, error: "POST only (this route registers the number)" }, 405);
  const given = String(url.searchParams.get("pin") || "");
  if (given && !/^[0-9]{6}$/.test(given)) return J({ ok: false, error: "pin must be exactly 6 digits." }, 400);
  const before = await getStatus(env, graph, pid);
  if (!before.ok) return J({ ...before, registered: false, note: "Could not read the status first, so nothing was registered." }, 502);
  if (String(before.status).toUpperCase() === "CONNECTED") return J({ ok: true, refused: true, registered: false, why: "Already CONNECTED; a connected number is never re-registered.", status: before, next_step: nextStep(before) }, 409);

  // PIN: a valid ?pin= (mismatch case) replaces the stored one; else the stored one; else a fresh random one. Stored BEFORE Meta is called.
  let pin = given;
  if (!pin) { try { pin = String((await env.MEETINGS.get(DESK_PIN_KV)) || ""); } catch (e) {} }
  if (!/^[0-9]{6}$/.test(pin)) pin = randomPin();
  try { await env.MEETINGS.put(DESK_PIN_KV, pin); } catch (e) { return J({ ok: false, registered: false, error: "Could not store the PIN in KV wa_desk_pin, so nothing was sent to Meta." }, 500); }

  let r, j = {};
  try {
    r = await fetch(`${graph}/${pid}/register`, { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }) });
    j = await r.json().catch(() => ({}));
  } catch (e) { return J({ ok: false, registered: false, error: "Meta unreachable; safe to retry." }, 502); }
  if (!r.ok || (j && j.success === false)) {
    const code = j && j.error && j.error.code;
    return J({ ok: false, registered: false, http: r.status, meta_code: code === undefined ? null : code, error: mapMetaError(code, j && j.error && j.error.message) }, 502);
  }
  const after = await getStatus(env, graph, pid);
  return J({ ok: true, registered: true, note: "registered; PIN kept in KV wa_desk_pin", status: after.ok ? after : null, next_step: after.ok ? nextStep(after) : "Registered. Check /wa_desk_status." });
}
