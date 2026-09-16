// v157 — the client fact sheet inside Azimuth (Kendall, 16 Sep 2026).
//
// The data spine has produced plenty Naj can read and nothing a buyer can hold. The pipeline
// (naj-market-pulse, scripts/build_client_sheet.py) now turns one building record into a 2-3 page
// A4 PDF — what it sells and rents for, the floor plans and finish, what else is in the building.
// This is the worker half: receive that PDF, keep it, let her preview it, and put it in her own
// WhatsApp thread so she can forward it to a client.
//
// Three decisions worth stating, because each closes off an obvious-looking alternative:
//
//   A FILE, NEVER A LINK. A sheet is built for one named client. waSendImage/waSendVideo hand Meta
//   a URL and Meta fetches it, so anything sent that way must be publicly fetchable with no key —
//   which is precisely the exposure the v156 client-key split just closed, re-opened on a document
//   with a person's name on it. So the bytes are uploaded to WhatsApp and sent by MEDIA ID. The
//   file never touches the public web. A PDF is also the better product: it works on a plane, it
//   forwards, and it does not expire.
//
//   KV, NOT R2. There is no R2 binding on this worker, so R2 means a bucket, a wrangler.toml change
//   and a deploy before a single byte can be written — and a stale wrangler.toml rolled back two
//   live versions on 15 Sep. KV takes 25 MiB; a sheet is 250-600 KB. Stored as an ArrayBuffer, not
//   base64, which would cost a third of the size for nothing.
//
//   THE 24-HOUR WINDOW IS CHECKED BEFORE, NOT AFTER. WhatsApp refuses free-form messages outside
//   the window since her last inbound. A sheet send at 9am on a quiet Sunday fails. Discovering
//   that at a client's desk is the whole nightmare this feature exists to avoid, so the send
//   refuses early and says so, and the app can show her rather than swallowing it.
//
// Keys in MEETINGS:
//   sheet_<slug>    the PDF bytes
//   sheetm_<slug>   { slug, name, pages, bytes, built_at, has_pictures, hold, sha, wa_media_id,
//                     wa_media_at } — small, so the app renders button state without pulling half
//                     a megabyte. `hold` names WHY a building has no sheet ("no pictures yet",
//                     "only 2 registered sales"); a boolean would leave her asking which.

const WA_GRAPH_DEFAULT = "https://graph.facebook.com/v20.0";
const SLUG_RX = /^[a-z0-9_]{1,60}$/;
const MAX_BYTES = 8 * 1024 * 1024;        // a sheet is 250-600 KB; anything near this is a mistake
const MEDIA_TTL = 30 * 86400;             // Meta keeps uploaded media about this long
const SHEET_TTL = 120 * 86400;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function sha256Hex(buf) {
  return crypto.subtle.digest("SHA-256", buf).then(h =>
    Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16));
}

// The PDF a client receives carries her name on it, so the preview route is hers alone: READ_KEY,
// the key on her own device. NOT rk (that is the residents layer and means something else) and NOT
// the v156 client key — a client is handed the file, never the route that lists them.
function ownerOk(env, url, deps) {
  const k = url.searchParams.get("key") || "";
  return !!env.READ_KEY && (deps.ctEq ? deps.ctEq(k, env.READ_KEY) : k === env.READ_KEY);
}

export async function sheetMeta(env, slug) {
  try { return JSON.parse((await env.MEETINGS.get("sheetm_" + slug)) || "null"); } catch (e) { return null; }
}

// Upload the bytes to WhatsApp and send by id. The id is cached: Meta keeps media about 30 days, so
// re-sending the same sheet to the same person costs one API call instead of a fresh upload.
async function waUploadDocument(env, bytes, filename, deps) {
  const graph = deps.WA_GRAPH || WA_GRAPH_DEFAULT;
  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("type", "application/pdf");
  fd.append("file", new Blob([bytes], { type: "application/pdf" }), filename);
  const r = await fetch(`${graph}/${env.WA_PHONE_ID}/media`, {
    method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN }, body: fd
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error("media upload HTTP " + r.status + " " + JSON.stringify(j).slice(0, 160));
  return j.id;
}

export async function sendSheet(env, slug, opts, deps) {
  opts = opts || {}; deps = deps || {};
  if (!SLUG_RX.test(String(slug || ""))) return { ok: false, error: "bad slug" };
  if (!env.WHATSAPP_TOKEN || !env.WA_PHONE_ID || !env.WA_ALLOWED) return { ok: false, error: "whatsapp not configured" };

  const meta = await sheetMeta(env, slug);
  if (!meta) return { ok: false, error: "no sheet for " + slug };

  // Before anything expensive: if the window is shut the send cannot succeed, and she needs to know
  // that as a held sheet rather than as silence.
  if (deps.ownerWindowOpen && !(await deps.ownerWindowOpen(env))) {
    return { ok: false, held: true, reason: "outside the 24-hour WhatsApp window",
             hint: "Send any message to Azimuth on WhatsApp and the sheet will go straight through." };
  }

  const buf = await env.MEETINGS.get("sheet_" + slug, "arrayBuffer");
  if (!buf) return { ok: false, error: "sheet bytes missing for " + slug };

  const filename = (meta.name ? String(meta.name).replace(/[^\w &'(),.-]+/g, " ").trim() : slug) + ".pdf";
  let id = meta.wa_media_id;
  const fresh = id && meta.wa_media_at && (Date.now() - Date.parse(meta.wa_media_at)) < (MEDIA_TTL - 86400) * 1000;
  if (!fresh) {
    try {
      id = await waUploadDocument(env, new Uint8Array(buf), filename, deps);
    } catch (e) {
      if (deps.noteErr) await deps.noteErr(env, "sheet-upload", String((e && e.message) || e));
      return { ok: false, error: String((e && e.message) || e).slice(0, 160) };
    }
    meta.wa_media_id = id; meta.wa_media_at = new Date().toISOString();
    await env.MEETINGS.put("sheetm_" + slug, JSON.stringify(meta), { expirationTtl: SHEET_TTL });
  }

  const caption = String(opts.caption || (meta.name ? meta.name + " — fact sheet" : "Fact sheet")).slice(0, 900);
  const r = await deps.waPost(env, {
    messaging_product: "whatsapp", recipient_type: "individual", to: opts.to || env.WA_ALLOWED,
    type: "document", document: { id, filename, caption }
  }, "sheet");
  return { ok: !!(r && r.ok), status: r && r.status, slug, filename,
           bytes: buf.byteLength, reused_media: !!fresh };
}

export async function sheetRoutes(request, env, url, deps) {
  deps = deps || {};
  const p = url.pathname;

  // ---- the pipeline pushes a built sheet up. INGEST_TOKEN, not READ_KEY: a separate secret that
  // the owner-key rotation does not touch, so the pipeline keeps working through it.
  if (p === "/ingest_sheet" && request.method === "POST") {
    const tok = request.headers.get("X-Azimuth-Ingest") || "";
    const ok = env.INGEST_TOKEN && (deps.ctEq ? deps.ctEq(tok, env.INGEST_TOKEN) : tok === env.INGEST_TOKEN);
    if (!ok) return new Response("unauthorized", { status: 401 });

    const slug = (url.searchParams.get("slug") || "").toLowerCase();
    if (!SLUG_RX.test(slug)) return new Response("bad slug", { status: 400 });

    // A held building carries no bytes — just the reason, so the app can grey the button and say why.
    const hold = url.searchParams.get("hold") || "";
    if (hold) {
      const m = { slug, name: url.searchParams.get("name") || slug, hold, built_at: new Date().toISOString() };
      await env.MEETINGS.put("sheetm_" + slug, JSON.stringify(m), { expirationTtl: SHEET_TTL });
      await env.MEETINGS.delete("sheet_" + slug);
      return json({ ok: true, slug, held: hold });
    }

    const body = await request.arrayBuffer();
    if (!body || body.byteLength < 1000) return new Response("empty body", { status: 400 });
    if (body.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });
    const head = new Uint8Array(body, 0, Math.min(5, body.byteLength));
    if (!(head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46))
      return new Response("not a pdf", { status: 415 });   // %PDF — a truncated upload must not sit in KV looking fine

    const sha = await sha256Hex(body);
    const prev = await sheetMeta(env, slug);
    const meta = {
      slug,
      name: url.searchParams.get("name") || (prev && prev.name) || slug,
      pages: Number(url.searchParams.get("pages") || 0) || null,
      bytes: body.byteLength,
      has_pictures: url.searchParams.get("pics") !== "0",
      built_at: new Date().toISOString(),
      sha
    };
    // A changed sheet invalidates the cached WhatsApp media id; keeping it would send the old file.
    if (prev && prev.sha === sha && prev.wa_media_id) {
      meta.wa_media_id = prev.wa_media_id; meta.wa_media_at = prev.wa_media_at;
    }
    await env.MEETINGS.put("sheet_" + slug, body, { expirationTtl: SHEET_TTL });
    await env.MEETINGS.put("sheetm_" + slug, JSON.stringify(meta), { expirationTtl: SHEET_TTL });
    return json({ ok: true, slug, bytes: meta.bytes, pages: meta.pages, sha, reused_media: !!meta.wa_media_id });
  }

  // ---- her preview. Owner key only; this is tap 2 of search -> sheet -> send and nothing else.
  if (request.method === "GET" && p.startsWith("/sheet/")) {
    const rest = p.slice("/sheet/".length);

    if (rest.endsWith("/meta")) {
      if (!ownerOk(env, url, deps)) return new Response("unauthorized", { status: 401 });
      const slug = rest.slice(0, -"/meta".length).toLowerCase();
      if (!SLUG_RX.test(slug)) return new Response("bad slug", { status: 400 });
      const m = await sheetMeta(env, slug);
      return m ? json(m) : json({ slug, hold: "no sheet built yet" }, 404);
    }

    if (rest.endsWith(".pdf")) {
      if (!ownerOk(env, url, deps)) return new Response("unauthorized", { status: 401 });
      const slug = rest.slice(0, -4).toLowerCase();
      if (!SLUG_RX.test(slug)) return new Response("bad slug", { status: 400 });
      const buf = await env.MEETINGS.get("sheet_" + slug, "arrayBuffer");
      if (!buf) return new Response("not found", { status: 404 });
      const m = await sheetMeta(env, slug);
      const filename = (m && m.name ? String(m.name).replace(/[^\w &'(),.-]+/g, " ").trim() : slug) + ".pdf";
      return new Response(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="' + filename + '"',
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow"
        }
      });
    }
  }

  // ---- send it to her own thread, from which she forwards. Owner key: this spends a Meta call and
  // writes into her chat.
  if (p === "/sheet_send" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
    const k = String((b && b.key) || "");
    const ok = env.READ_KEY && (deps.ctEq ? deps.ctEq(k, env.READ_KEY) : k === env.READ_KEY);
    if (!ok) return new Response("unauthorized", { status: 401 });
    const out = await sendSheet(env, String((b && b.slug) || "").toLowerCase(), { caption: b && b.caption }, deps);
    return json(out, out.ok ? 200 : (out.held ? 409 : 502));
  }

  return null;   // not ours — index.js carries on
}
