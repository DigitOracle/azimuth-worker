// v825 - LAUNCH RADAR DESK ALERTS (Kendall 8 Nov 2026: "use your best judgement" -> on, tightly limited). POST /radar_alert from the
// collector (launch_radar.py --alerts), X-Azimuth-Ingest only. The worker enforces the limits again, so a collector bug cannot spam:
//   - 09:00-19:00 Dubai only;  - at most 3 alerts a day, in ONE message per call;  - each alert id is delivered once, ever.
// Delivery: Najjuko on this instance's own number (env.WA_ALLOWED) and Kendall through the existing owner note (OWNER_NOTE_URL).
// Free-form WhatsApp only reaches Najjuko inside the 24-hour window; outside it the send fails and the alerts stay pending upstream.
export const RADAR_MAX_PER_DAY = 3, RADAR_FROM_H = 9, RADAR_TO_H = 19;

export function dubaiNow(ms) {
  const d = new Date(ms + 4 * 3600000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

// pure: may this batch go now? -> { ok, reason, take }
export function radarGate(nowMs, sentToday, ids, seen) {
  const t = dubaiNow(nowMs);
  if (t.hour < RADAR_FROM_H || t.hour >= RADAR_TO_H) return { ok: false, reason: "outside 09:00-19:00 Dubai" };
  const fresh = (ids || []).filter((i) => /^al_[a-f0-9]{8,32}$/.test(String(i)) && !(seen || []).includes(i));
  if (!fresh.length) return { ok: false, reason: "nothing new" };
  const room = RADAR_MAX_PER_DAY - (sentToday || 0);
  if (room <= 0) return { ok: false, reason: "today's 3 already sent" };
  if (fresh.length > room) return { ok: false, reason: "batch larger than today's room (" + room + ")" };
  return { ok: true, take: fresh };
}

export function radarText(text, forNaj) {
  const body = String(text || "").replace(/[\u0000-\u0008\u000B-\u001F]/g, "").trim().slice(0, 1400);
  // Naj's messages open "Black Coffee" and close "curated by Papi" (Kendall's standing rule for messages to her)
  return forNaj ? "Black Coffee,\n\n" + body + "\n\ncurated by Papi" : body;
}

export async function radarAlertRoute(request, env, deps) {
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json" } });
  const h = request.headers.get("X-Azimuth-Ingest");
  if (!env.INGEST_TOKEN || !h || !deps.ctEq(h, env.INGEST_TOKEN)) return new Response("unauthorized", { status: 401 });
  let b = {}; try { b = await request.json(); } catch (e) { return J({ ok: false, reason: "bad json" }, 400); }
  if (!b.text || !Array.isArray(b.ids)) return J({ ok: false, reason: "text and ids required" }, 400);
  const now = deps.now ? deps.now() : Date.now(), day = dubaiNow(now).date;
  const st = JSON.parse((await env.MEETINGS.get("radar_sent_" + day)) || '{"n":0,"ids":[]}');
  const g = radarGate(now, st.n, b.ids, st.ids);
  if (!g.ok) return J({ ok: false, reason: g.reason }, 200);
  let naj = false, owner = false;
  try { const r = env.WA_ALLOWED ? await deps.waSend(env, env.WA_ALLOWED, radarText(b.text, true)) : null; naj = !!(r && r.ok); } catch (e) {}
  try { owner = !!(await deps.tellOwner(env, radarText(b.text, false))); } catch (e) {}
  if (naj || owner) await env.MEETINGS.put("radar_sent_" + day, JSON.stringify({ n: st.n + g.take.length, ids: st.ids.concat(g.take) }), { expirationTtl: 3 * 86400 });
  return J({ ok: naj || owner, najjuko: naj, kendall: owner, counted: naj || owner ? g.take.length : 0 });
}
