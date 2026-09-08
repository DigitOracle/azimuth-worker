"""v105 (8 Sep 2026) - social-media cards: five looks, two sizes, rendered in the Worker.

Kendall: "these are for social media, so need the pictures and infographics, text to pop and randomize as well".
Naj: "Could I use it in 9:16 size - or at least both options".

1. angleCardSvg gets a template engine: Big Number / Editorial Split / Stat Infographic / Pull Quote / Ticker,
   seeded by the hook so the square and the story of one angle share a look, at 1080x1080 and 1080x1920.
2. renderAngleCard renders in the Worker through the Browser Rendering BINDING (env.BROWSER + @cloudflare/puppeteer)
   when there is no CF_RENDER_TOKEN - the PC task becomes a fallback, not the path.
3. The pick flow sends both sizes; /angle_pending, /send_card, /angle_svg, /card_test learn about sizes.
4. bgPromptBlock rotates light / lens / vantage / text layout per angle (seeded) so the plates stop repeating.
"""
import io, re
P = r"C:\Dev\azimuth-worker\src\index.js"
s = io.open(P, encoding="utf-8").read()
orig = s

def between(s, start, end):
    a = s.index(start); b = s.index(end, a); return a, b

# ------------------------------------------------------------------ 1. puppeteer import (ESM file)
if 'from "@cloudflare/puppeteer"' not in s:
    s = 'import puppeteer from "@cloudflare/puppeteer";   // v105 - Browser Rendering binding (env.BROWSER); self-disables when the binding is absent\n' + s

# ------------------------------------------------------------------ 2. the card engine
a, b = between(s, "function angleCardSvg(angle, areaName, imgUrl, n) {", "// v90 - BRIDGE RECORDS.")
ENGINE = r'''// v105 - CARD ENGINE. Five looks, two sizes. The look is seeded by the hook so an angle's square and story match,
// and tomorrow's cards do not look like today's. Every look carries the same four facts: masthead, hook, figure, source.
const CARD_C = { beige: "#E8DCC8", beige2: "#D9CBB2", gold: "#C5A56A", goldD: "#8C7238", green: "#006039", greenD: "#0B3D2E", ink: "#0C1413", mute: "#5E6F69", muteL: "#B8C4BD" };
const F_SERIF = "Fraunces,Georgia,serif", F_SANS = "'IBM Plex Sans',sans-serif", F_MONO = "'IBM Plex Mono',monospace";
const CARD_TPL = ["bignumber", "split", "stat", "quote", "ticker"];
function hashStr(t) { let h = 2166136261; const x = String(t || ""); for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function tplOf(angle, t) { if (Number.isInteger(t)) return ((t % 5) + 5) % 5; if (angle && Number.isInteger(angle.tpl)) return ((angle.tpl % 5) + 5) % 5; return hashStr((angle && angle.hook) || "") % 5; }
function wrapWords(text, max) { const w = String(text || "").split(/\s+/).filter(Boolean); const lines = []; let cur = ""; for (const x of w) { if ((cur + " " + x).trim().length > max && cur) { lines.push(cur); cur = x; } else cur = (cur + " " + x).trim(); } if (cur) lines.push(cur); return lines; }
// shrink the font until the text sits inside boxW x maxLines (k = average glyph width as a fraction of the font size)
function fitLines(text, boxW, fz, maxLines, k, minFz) { k = k || 0.54; minFz = minFz || 34; let f = fz; for (;;) { const lines = wrapWords(text, Math.max(8, Math.floor(boxW / (f * k)))); if (lines.length <= maxLines || f <= minFz) { const L = lines.slice(0, maxLines); if (lines.length > maxLines) L[maxLines - 1] = L[maxLines - 1].replace(/\s+\S*$/, "") + "…"; return { lines: L, fz: f }; } f -= 4; } }
function fitOne(text, boxW, fz, k, minFz) { const L = String(text || "").length || 1; return Math.max(minFz || 40, Math.min(fz, Math.floor(boxW / (L * (k || 0.6))))); }
function svgLines(lines, x, y, fz, fill, font, weight, lh, extra) { return lines.map((l, i) => `<text x="${x}" y="${y + i * Math.round(fz * (lh || 1.12))}" fill="${fill}" font-size="${fz}" font-weight="${weight || 600}" font-family="${font}"${extra || ""}>${_sx(l)}</text>`).join(""); }
function figureParts(fig) {
  const t = String(fig || "").trim().replace(/\d{4,}/g, m => Number(m).toLocaleString("en-US"));
  const pct = t.match(/^(-?\d+(?:\.\d+)?)\s*%(.*)$/); if (pct) return { kind: "pct", val: Math.max(0, Math.min(100, parseFloat(pct[1]))), num: pct[1] + "%", unit: (pct[2] || "").trim(), text: t };
  const two = t.match(/^(.+?)\s+(?:vs\.?|versus|→|->|to)\s+(.+)$/i); if (two) { const av = parseFloat(two[1].replace(/[^\d.]/g, "")), bv = parseFloat(two[2].replace(/[^\d.]/g, "")); if (isFinite(av) && isFinite(bv) && av + bv > 0) return { kind: "two", a: two[1].trim(), b: two[2].trim(), av, bv, text: t }; }
  const m = t.match(/^([A-Za-z]{2,4}\s+)?([\d,.]+\s*[kKmMbB]?)\s*(.*)$/); if (m && m[2] && /\d/.test(m[2])) return { kind: "num", num: ((m[1] || "") + m[2]).trim(), unit: (m[3] || "").trim(), text: t };
  return { kind: "text", num: t, unit: "", text: t };
}
function cardDate() { const d = new Date(Date.now() + 4 * 3600 * 1000); return d.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] + " " + d.getUTCFullYear(); }
function angleCardSvg(angle, areaName, imgUrl, n, opts) {
  opts = opts || {}; const W = 1080, story = opts.size === "story", H = story ? 1920 : 1080; const t = tplOf(angle, opts.t); const C = CARD_C;
  const hook = String(angle.hook || "").replace(/\s+/g, " ").trim().slice(0, 220);
  const src = String(angle.source || "").replace(/\s+/g, " ").trim();
  const fp = figureParts(angle.figure); const fig = fp.text; const area = areaName ? String(areaName) : "";
  const mast = "THE DIGEST" + (area ? " · " + area.toUpperCase() : "");
  const img = (x, y, w, h, id) => imgUrl ? `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${opts.rx || 0}"/></clipPath><g clip-path="url(#${id})"><image href="${imgUrl}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/></g>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.greenD}"/>`;
  const chip = (x, y, ground, ink) => { const w = Math.min(W - 2 * x, mast.length * 14.5 + 56); return `<rect x="${x}" y="${y}" width="${w}" height="48" rx="24" fill="${ground}" fill-opacity=".94"/><text x="${x + 28}" y="${y + 32}" fill="${ink}" font-size="22" font-weight="700" letter-spacing="4" font-family="${F_MONO}">${_sx(mast.length > 40 ? mast.slice(0, 39) + "…" : mast)}</text>`; };
  const srcLines = (y, fill) => { const L = wrapWords(src, 62).slice(0, 2); return svgLines(L.map((l, i) => (i === 0 ? "Source: " : "") + l), 72, y, 22, fill, F_SANS, 400, 1.3); };
  const foot = (y, fill, fillR) => `<text x="72" y="${y}" fill="${fill}" font-size="22" font-family="${F_SANS}">Najjuko · settled, not asking · the register's own numbers</text><text x="${W - 72}" y="${y}" fill="${fillR}" font-size="20" text-anchor="end" font-family="${F_MONO}">the digest</text>`;
  const num = n ? `<text x="${W - 72}" y="96" fill="${C.beige}" fill-opacity=".85" font-size="24" text-anchor="end" font-family="${F_MONO}">${n}</text>` : "";
  const defs = `<defs><filter id="sh" x="-5%" y="-10%" width="110%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".6"/></filter><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ink}" stop-opacity="0"/><stop offset=".45" stop-color="${C.ink}" stop-opacity=".25"/><stop offset=".75" stop-color="${C.ink}" stop-opacity=".86"/><stop offset="1" stop-color="${C.ink}" stop-opacity=".97"/></linearGradient></defs>`;
  let body = "";
  if (t === 0) {                                                                   // BIG NUMBER - the figure is the picture
    const fz = fitOne(fig, 936, story ? 340 : 300, 0.6, 120); const base = Math.round(H * (story ? 0.60 : 0.57));
    const hk = fitLines(hook, 936, story ? 70 : 62, story ? 5 : 4, 0.54);
    body = img(0, 0, W, H, "c0") + `<rect width="${W}" height="${H}" fill="url(#gd)"/>` + chip(56, 62, C.beige, C.green) + num +
      `<text x="66" y="${base}" fill="${C.gold}" font-size="${fz}" font-weight="700" font-family="${F_SERIF}" filter="url(#sh)">${_sx(fig)}</text>` +
      svgLines(hk.lines, 72, base + 40 + hk.fz, hk.fz, C.beige, F_SANS, 600, 1.12, ' filter="url(#sh)"') +
      srcLines(H - 118, C.muteL) + foot(H - 52, C.beige, C.gold);
  } else if (t === 1) {                                                            // EDITORIAL SPLIT - photo above, the words on beige
    const ph = Math.round(H * (story ? 0.50 : 0.52)); const hk = fitLines(hook, 936, story ? 84 : 72, story ? 6 : 4, 0.56);
    const ffz = fitOne(fig, 936, story ? 128 : 104, 0.6, 56); const fy = H - (story ? 190 : 150);
    body = `<rect width="${W}" height="${H}" fill="${C.beige}"/>` + img(0, 0, W, ph, "c1") + `<rect x="0" y="${ph - 8}" width="${W}" height="10" fill="${C.gold}"/>` + chip(56, 62, C.beige, C.green) + num +
      svgLines(hk.lines, 72, ph + 60 + hk.fz, hk.fz, C.greenD, F_SERIF, 600, 1.1) +
      `<rect x="72" y="${fy - ffz - 36}" width="260" height="4" fill="${C.gold}"/><text x="72" y="${fy}" fill="${C.goldD}" font-size="${ffz}" font-weight="700" font-family="${F_SERIF}">${_sx(fig)}</text>` +
      srcLines(H - 96, C.mute) + foot(H - 44, C.green, C.goldD);
  } else if (t === 2) {                                                            // STAT INFOGRAPHIC - the figure becomes a graphic
    const y0 = 150; const stripH = story ? 620 : 300; const stripY = H - stripH - 120; let g = "", hookY, hk;
    if (fp.kind === "pct") {
      const r = story ? 230 : 190, cx = 72 + r + 18, cy = y0 + r + 40, circ = 2 * Math.PI * r;
      g = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.beige2}" stroke-width="36"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.gold}" stroke-width="36" stroke-linecap="round" stroke-dasharray="${(circ * fp.val / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>` +
        `<text x="${cx}" y="${cy + 34}" fill="${C.goldD}" font-size="${fitOne(fp.num, 2 * r - 90, 104, 0.6, 48)}" font-weight="700" text-anchor="middle" font-family="${F_SERIF}">${_sx(fp.num)}</text>` +
        (fp.unit ? `<text x="${cx}" y="${cy + 84}" fill="${C.green}" font-size="24" letter-spacing="4" text-anchor="middle" font-family="${F_MONO}">${_sx(fp.unit.toUpperCase().slice(0, 22))}</text>` : "");
      const bx = cx + r + 48, bw = W - 72 - bx; hk = fitLines(hook, bw, story ? 56 : 48, story ? 8 : 6, 0.54); hookY = y0 + 60 + hk.fz;
      g += svgLines(hk.lines, bx, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);
    } else if (fp.kind === "two") {
      const mx = Math.max(fp.av, fp.bv) || 1, bw = 936 - 260; const row = (lab, v, y, col) => `<text x="72" y="${y + 44}" fill="${C.greenD}" font-size="30" font-weight="600" font-family="${F_SANS}">${_sx(lab.slice(0, 18))}</text><rect x="300" y="${y}" width="${Math.max(24, Math.round(bw * v / mx))}" height="60" rx="8" fill="${col}"/>`;
      g = row(fp.a, fp.av, y0 + 40, C.gold) + row(fp.b, fp.bv, y0 + 130, C.green);
      hk = fitLines(hook, 936, story ? 64 : 56, story ? 5 : 3, 0.54); hookY = y0 + 250 + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);
    } else {
      const nfz = fitOne(fp.num, 936, story ? 240 : 210, 0.6, 96);
      g = `<text x="66" y="${y0 + nfz}" fill="${C.goldD}" font-size="${nfz}" font-weight="700" font-family="${F_SERIF}">${_sx(fp.num)}</text>` +
        (fp.unit ? `<text x="72" y="${y0 + nfz + 52}" fill="${C.green}" font-size="34" letter-spacing="6" font-family="${F_MONO}">${_sx(fp.unit.toUpperCase().slice(0, 40))}</text>` : "");
      hk = fitLines(hook, 936, story ? 64 : 56, story ? 5 : 3, 0.54); hookY = y0 + nfz + (fp.unit ? 120 : 70) + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);
    }
    body = `<rect width="${W}" height="${H}" fill="${C.beige}"/>` + chip(56, 62, C.green, C.beige) + `<text x="${W - 72}" y="96" fill="${C.goldD}" font-size="24" text-anchor="end" font-family="${F_MONO}">${n || ""}</text>` + g +
      `<clipPath id="c2"><rect x="56" y="${stripY}" width="${W - 112}" height="${stripH}" rx="26"/></clipPath>` + (imgUrl ? `<g clip-path="url(#c2)"><image href="${imgUrl}" x="56" y="${stripY}" width="${W - 112}" height="${stripH}" preserveAspectRatio="xMidYMid slice"/></g>` : `<rect x="56" y="${stripY}" width="${W - 112}" height="${stripH}" rx="26" fill="${C.greenD}"/>`) +
      `<rect x="56" y="${stripY}" width="${W - 112}" height="${stripH}" rx="26" fill="none" stroke="${C.gold}" stroke-width="3"/>` +
      srcLines(H - 78, C.mute) + foot(H - 40, C.green, C.goldD);
  } else if (t === 3) {                                                            // PULL QUOTE - the line is the hero, on Rolex green
    const th = story ? 520 : 380; const hk = fitLines(hook, 900, story ? 84 : 70, story ? 7 : 5, 0.56); const hy = story ? 470 : 400;
    const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.1); const ffz = fitOne(fig, 600, 72, 0.65, 40);
    body = `<rect width="${W}" height="${H}" fill="${C.greenD}"/>` +
      `<text x="44" y="${hy - 40}" fill="${C.gold}" fill-opacity=".92" font-size="360" font-weight="700" font-family="${F_SERIF}">“</text>` +
      `<rect x="56" y="62" width="${Math.min(W - 112, mast.length * 14.5 + 56)}" height="48" rx="24" fill="none" stroke="${C.gold}" stroke-width="2"/><text x="84" y="94" fill="${C.gold}" font-size="22" font-weight="700" letter-spacing="4" font-family="${F_MONO}">${_sx(mast.length > 40 ? mast.slice(0, 39) + "…" : mast)}</text>` + num +
      svgLines(hk.lines, 72, hy, hk.fz, C.beige, F_SERIF, 600, 1.1) +
      `<rect x="72" y="${endY + 44}" width="240" height="4" fill="${C.gold}"/><text x="72" y="${endY + 60 + ffz}" fill="${C.gold}" font-size="${ffz}" font-weight="700" font-family="${F_MONO}">${_sx(fig)}</text>` +
      `<clipPath id="c3"><rect x="${W - 72 - th}" y="${H - 140 - th}" width="${th}" height="${th}" rx="28"/></clipPath>` + (imgUrl ? `<g clip-path="url(#c3)"><image href="${imgUrl}" x="${W - 72 - th}" y="${H - 140 - th}" width="${th}" height="${th}" preserveAspectRatio="xMidYMid slice"/></g>` : "") +
      `<rect x="${W - 72 - th}" y="${H - 140 - th}" width="${th}" height="${th}" rx="28" fill="none" stroke="${C.gold}" stroke-width="3"/>` +
      srcLines(H - 100, C.muteL) + foot(H - 52, C.beige, C.gold);
  } else {                                                                         // TICKER - dark plate, mono data strip
    const ffz = fitOne(fig, 936, story ? 240 : 200, 0.6, 96); const fy = story ? 700 : 470; const hk = fitLines(hook, 936, story ? 66 : 58, story ? 5 : 4, 0.54);
    const hy = fy + 60 + hk.fz; const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.12);
    body = img(0, 0, W, H, "c4") + `<rect width="${W}" height="${H}" fill="${C.ink}" fill-opacity=".66"/><rect width="${W}" height="${H}" fill="${C.greenD}" fill-opacity=".28"/>` +
      `<text x="72" y="118" fill="${C.gold}" font-size="26" font-weight="700" letter-spacing="6" font-family="${F_MONO}">${_sx(mast)}</text>` + num +
      `<text x="66" y="${fy}" fill="${C.gold}" font-size="${ffz}" font-weight="700" font-family="${F_SERIF}" filter="url(#sh)">${_sx(fig)}</text>` +
      svgLines(hk.lines, 72, hy, hk.fz, C.beige, F_SANS, 600, 1.12) +
      `<rect x="72" y="${endY + 36}" width="936" height="3" fill="${C.gold}"/>` +
      `<text x="72" y="${endY + 92}" fill="${C.beige}" font-size="26" letter-spacing="2" font-family="${F_MONO}">${_sx([fig, area || "Dubai", cardDate()].join("  ·  "))}</text>` +
      srcLines(endY + 140, C.muteL) + foot(H - 52, C.beige, C.gold);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-tpl="${CARD_TPL[t]}">` + defs + body + `</svg>`;
}
'''
s = s[:a] + ENGINE + s[b:]

# ------------------------------------------------------------------ 3. keys, html, render (both sizes, browser binding)
a, b = between(s, 'const cardKey = (ctxAt, n) => "angle_" + String(ctxAt || 0) + "_" + n;', "// v59 — AREA POSTCARD:")
RENDER = r'''const cardKey = (ctxAt, n, size) => "angle_" + String(ctxAt || 0) + "_" + n + (size === "story" ? "_s" : "");   // v105 - "_s" = 1080x1920
async function angleCardHtml(env, angle, n, origin, size, t) {
  let d = null; try { d = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
  const area = angleArea(angle, d); let img = null;
  if (area) { const sl = AREA_SLUG(area); try { if (await env.MEETINGS.get("img_sat_" + sl, "arrayBuffer")) img = origin + "/img/sat_" + sl; } catch (e) {} }
  if (!img) img = origin + "/img/bg_market";
  const story = size === "story", W = 1080, H = story ? 1920 : 1080;
  const svg = angleCardSvg(angle, area, img, n, { size: story ? "story" : "square", t });
  return { area, W, H, html: `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;700&display=swap"><style>html,body{margin:0;background:#0C1413;width:${W}px;height:${H}px;overflow:hidden}svg{display:block}</style></head><body>${svg}</body></html>` };
}
// v105 - render HTML to PNG inside the Worker through the Browser Rendering binding. One browser per call; fonts awaited.
async function renderHtmlPng(env, html, W, H) {
  if (!env.BROWSER) return null;
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 });
    try { await page.evaluate(() => document.fonts.ready.then(() => true)); } catch (e) {}
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
    return png && png.byteLength ? png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) : null;
  } finally { try { await browser.close(); } catch (e) {} }
}
async function renderAngleCard(env, angle, n, origin, ctxAt, wantedBy, size) {
  RENDER_LAST_ERR = ""; size = size === "story" ? "story" : "square";
  const k = cardKey(ctxAt, n, size);
  try { if (await env.MEETINGS.get("img_" + k, "arrayBuffer")) return { key: k, url: origin + "/img/" + k, area: angleArea(angle, null), size }; } catch (e) {}
  const { area, W, H, html } = await angleCardHtml(env, angle, n, origin, size);
  let png = null;
  try {
    if (env.CF_RENDER_TOKEN) {                                                                     // REST API (needs an API token)
      const acc = env.CF_ACCOUNT_ID || "76bc08573538d7426fce444cf7ef7645";
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/browser-rendering/screenshot`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.CF_RENDER_TOKEN },
        body: JSON.stringify({ html, viewport: { width: W, height: H, deviceScaleFactor: 1 }, gotoOptions: { waitUntil: "networkidle0", timeout: 20000 }, screenshotOptions: { type: "png", clip: { x: 0, y: 0, width: W, height: H } } }) });
      if (!r.ok) { RENDER_LAST_ERR = "render " + r.status; } else png = await r.arrayBuffer();
    } else if (env.BROWSER) {                                                                       // v105 - binding, no token needed
      png = await renderHtmlPng(env, html, W, H);
      if (!png) RENDER_LAST_ERR = "browser binding returned nothing";
    } else {
      RENDER_LAST_ERR = "no renderer on this Worker - rendered on the DigitAlchemy machine within ~5 min";
    }
  } catch (e) { RENDER_LAST_ERR = "render exception: " + String((e && e.message) || e).slice(0, 120); }
  if (!png || png.byteLength < 5000) {
    if (!RENDER_LAST_ERR) RENDER_LAST_ERR = "png too small";
    if (wantedBy) { try { await env.MEETINGS.put("angle_wanted_" + k, JSON.stringify({ to: wantedBy, n, at: Date.now(), size }), { expirationTtl: 6 * 3600 }); } catch (e) {} }   // the PC fallback delivers it
    return null;
  }
  await env.MEETINGS.put("img_" + k, png, { expirationTtl: 14 * 86400 }); await env.MEETINGS.put("img_ct_" + k, "image/png", { expirationTtl: 14 * 86400 });
  return { key: k, url: origin + "/img/" + k, area, size };
}

'''
s = s[:a] + RENDER + s[b:]

# ------------------------------------------------------------------ 4. routes
old = 'if (_bc && _bc.angles) for (let i = 0; i < _bc.angles.length; i++) { const k = cardKey(_bc.at, i + 1); if (!(await env.MEETINGS.get("img_" + k, "arrayBuffer"))) out.pending.push({ n: i + 1, key: k }); if (await env.MEETINGS.get("angle_wanted_" + k)) out.wanted.push(i + 1); }'
new = 'if (_bc && _bc.angles) for (let i = 0; i < _bc.angles.length; i++) for (const sz of ["square", "story"]) { const k = cardKey(_bc.at, i + 1, sz); if (!(await env.MEETINGS.get("img_" + k, "arrayBuffer"))) out.pending.push({ n: i + 1, key: k, size: sz }); if ((await env.MEETINGS.get("angle_wanted_" + k)) && !out.wanted.includes(i + 1)) out.wanted.push(i + 1); }   // v105 - both sizes'
assert s.count(old) == 1; s = s.replace(old, new)

old = 'await waSendImage(env, _w.to, url.origin + "/img/" + _k, "🖼 Here is your card for angle " + _w.n + " - 1080×1080, ready to post.");'
new = 'await waSendImage(env, _w.to, url.origin + "/img/" + _k, _k.endsWith("_s") ? "🖼 Your card for angle " + _w.n + " at 1080×1920 - Stories, Reels and TikTok." : "🖼 Here is your card for angle " + _w.n + " - 1080×1080 for the grid.");'
assert s.count(old) == 1; s = s.replace(old, new)

old = 'const _h = await angleCardHtml(env, _a, _n, url.origin);'
new = 'const _h = await angleCardHtml(env, _a, _n, url.origin, url.searchParams.get("size") === "story" ? "story" : "square", url.searchParams.has("t") ? parseInt(url.searchParams.get("t"), 10) : undefined);   // v105 - ?size=story ?t=0..4'
assert s.count(old) == 1; s = s.replace(old, new)

old = 'const _c = await renderAngleCard(env, _a, _n, url.origin, _bc.at, null);'
new = 'const _c = await renderAngleCard(env, _a, _n, url.origin, _bc.at, null, url.searchParams.get("size") === "story" ? "story" : "square");'
assert s.count(old) == 1; s = s.replace(old, new)

# ------------------------------------------------------------------ 5. the pick flow sends both sizes
start = '  if (_ang && (kind === "li" || kind === "ig" || kind === "car")) {                                // v89 - the finished square image, ready to post'
a = s.index(start); b = s.index("catch (e) {}\n  }\n", a) + len("catch (e) {}\n  }\n")
PICK = r'''  if (_ang && (kind === "li" || kind === "ig" || kind === "car")) {                                // v89 - the finished image; v105 - both sizes, five looks
    try { const _o = env.PUBLIC_ORIGIN || "https://azimuth-2.digitalchemy.workers.dev";
      const _sq = await renderAngleCard(env, _ang, n, _o, ctx.at, to, "square");
      const _st = await renderAngleCard(env, _ang, n, _o, ctx.at, to, "story");
      if (_sq) await waSendImage(env, to, _sq.url, "Your card for angle " + n + (_sq.area ? " · " + _sq.area : "") + " - 1080×1080 for the grid.");
      if (_st) await waSendImage(env, to, _st.url, "Same card at 1080×1920 - Stories, Reels and TikTok.");
      if (!_sq && !_st) await waSend(env, to, "🖼 Your cards for angle " + n + " (square and 9:16) are rendering - they land here in a few minutes."); } catch (e) {}
  }
'''
s = s[:a] + PICK + s[b:]

# ------------------------------------------------------------------ 6. the plate prompt rotates its look per angle
old = '''    "THE PICTURE: shot on a full-frame camera with a 35mm lens at f/4, camera at standing eye level (about 1.6 m from the ground), horizon level and roughly a third up the frame. Late afternoon, about an hour before sunset: warm low sun coming from the RIGHT of frame at a shallow angle, long soft shadows falling to the LEFT, gentle haze in the distance, no harsh midday contrast. Natural colour, no filter, no HDR crunch, no vignette.\\n\\n" +'''
new = '''    "THE PICTURE: " + look.lens + " " + look.vantage + " Horizon level and roughly a third up the frame. " + look.light + " Natural colour, no filter, no HDR crunch, no vignette.\\n\\n" +'''
assert s.count(old) == 1, "picture line"; s = s.replace(old, new)

old = '''  const strings = ['"THE DIGEST"'].concat('''
new = '''  // v105 - seeded by the hook: light, lens, vantage and text layout rotate, so two mornings never hand her the same plate
  const seed = hashStr(H + "|" + F);
  const look = {
    light: ["Late afternoon, about an hour before sunset: warm low sun coming from the RIGHT of frame at a shallow angle, long soft shadows falling to the LEFT, gentle haze in the distance, no harsh midday contrast.",
            "Blue hour, twenty minutes after sunset: deep cobalt sky fading to amber at the horizon, building lights just switched on, soft even light with a faint warm key from the RIGHT so shadows fall gently to the LEFT.",
            "Bright clear morning, about eight o'clock: crisp cool light from the RIGHT at a low angle, long clean shadows to the LEFT, pale sky, high clarity, no haze.",
            "Soft overcast afternoon: diffuse light with no hard shadows, a muted warm palette, and a hint of directional light from the RIGHT so a composited figure can still be lit to match."][seed % 4],
    lens: ["Shot on a full-frame camera with a 35mm lens at f/4,", "Shot on a full-frame camera with a 24mm lens at f/5.6 for a wide, calm view,", "Shot on a full-frame camera with a 50mm lens at f/2.8, the far distance softly out of focus,"][(seed >> 2) % 3],
    vantage: ["camera at standing eye level (about 1.6 m from the ground) on the street or promenade.", "camera on a balcony one floor up (about 5 m from the ground), looking slightly down across the scene.", "camera at standing eye level on a waterfront promenade, water on one side, the buildings beyond.", "camera on a rooftop terrace (about 30 m up), the terrace floor visible in the foreground as the standing ground."][(seed >> 4) % 4],
    layout: (seed >> 6) % 3,
  };
  const strings = ['"THE DIGEST"'].concat('''
assert s.count(old) == 1, "strings line"; s = s.replace(old, new)

old = '''      "TEXT — this is the point of the picture, do not leave it out. All of it sits in the RIGHT two thirds and never crosses into the left third. Across the top right, the masthead \\"THE DIGEST\\" small, beige #E8DCC8, uppercase, wide letter-spacing. Below it a stacked cover-line, upper-right to mid-right: " +
      (F ? "the figure \\"" + F + "\\" set LARGE in warm gold #C5A56A, bold condensed sans-serif; " : "") +
      (H ? "the headline \\"" + H + "\\" in smaller beige #E8DCC8 sans-serif, over a soft dark translucent band so it stays legible on the photograph; " : "") +
      (S ? "under a thin gold rule the kicker \\"" + S + "\\" small in beige. " : "") +'''
new = '''      "TEXT — this is the point of the picture, do not leave it out. All of it sits in the RIGHT two thirds and never crosses into the left third. Across the top right, the masthead \\"THE DIGEST\\" small, beige #E8DCC8, uppercase, wide letter-spacing. " +
      (look.layout === 0 ? "Below it a stacked cover-line, upper-right to mid-right: " + (F ? "the figure \\"" + F + "\\" set LARGE in warm gold #C5A56A, bold condensed sans-serif; " : "") + (H ? "the headline \\"" + H + "\\" in smaller beige #E8DCC8 sans-serif, over a soft dark translucent band so it stays legible on the photograph; " : "") + (S ? "under a thin gold rule the kicker \\"" + S + "\\" small in beige. " : "")
       : look.layout === 1 ? "Poster treatment: " + (F ? "the figure \\"" + F + "\\" set LARGE in warm gold #C5A56A as a single poster number filling the upper right, bold condensed sans-serif, with a soft shadow; " : "") + (H ? "the headline \\"" + H + "\\" runs along the lower right in a beige #E8DCC8 band, two lines at most; " : "") + (S ? "the kicker \\"" + S + "\\" tiny in beige under the band. " : "")
       : "Magazine box: " + (F ? "the figure \\"" + F + "\\" set LARGE in warm gold #C5A56A inside a thin gold-outlined rectangle at the upper right; " : "") + (H ? "the headline \\"" + H + "\\" stacked beneath the box in beige #E8DCC8 serif, on a soft dark translucent band; " : "") + (S ? "a thin gold rule and the kicker \\"" + S + "\\" small in beige. " : "")) +'''
assert s.count(old) == 1, "text layout"; s = s.replace(old, new)

io.open(P, "w", encoding="utf-8", newline="\n").write(s)
print("index.js patched:", len(s) - len(orig), "bytes delta")

# ------------------------------------------------------------------ 7. wrangler.toml - the browser binding on azimuth-2
W = r"C:\Dev\azimuth-worker\wrangler.toml"
w = io.open(W, encoding="utf-8").read()
if 'binding = "BROWSER"' not in w:
    i = w.index("[env.azimuth2]"); j = w.index('ai = { binding = "AI" }', i) + len('ai = { binding = "AI" }')
    w = w[:j] + '\n\nbrowser = { binding = "BROWSER" }   # v105 - Browser Rendering binding: cards render in the Worker, no API token needed' + w[j:]
    io.open(W, "w", encoding="utf-8", newline="\n").write(w); print("wrangler.toml: browser binding added to [env.azimuth2]")

# ------------------------------------------------------------------ 8. the PC fallback renders both sizes and always offers delivery
R = r"C:\Dev\naj-market-pulse\scripts\render_angle_cards.py"
r = io.open(R, encoding="utf-8").read()
old = '''        url = f"{WORKER}/angle_svg?n={n}&key={urllib.parse.quote(key)}"'''
new = '''        story = k.endswith("_s"); wh = "1080,1920" if story else "1080,1080"                       # v105 - "_s" keys are the 9:16 card
        url = f"{WORKER}/angle_svg?n={n}&size={'story' if story else 'square'}&key={urllib.parse.quote(key)}"'''
assert r.count(old) == 1; r = r.replace(old, new)
old = '''f"--window-size=1080,1080"'''; new = '''f"--window-size={wh}"'''
assert r.count(old) == 1; r = r.replace(old, new)
old = '''        if n in (pend.get("wanted") or []):
            try: log("  " + get(f"/send_card?k={k}", key).read().decode()[:80])'''
new = '''        if n in (pend.get("wanted") or []):                                                        # v105 - the Worker answers "nobody waiting" harmlessly
            try: log("  " + get(f"/send_card?k={k}", key).read().decode()[:80])'''
assert r.count(old) == 1; r = r.replace(old, new)
io.open(R, "w", encoding="utf-8", newline="\n").write(r); print("render_angle_cards.py: both sizes")
