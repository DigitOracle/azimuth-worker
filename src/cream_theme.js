// v728 - THE CREAM THEME (Kendall 4 Nov 2026: "All interfaces on Doli and Najjuko should be lighter cream colored.")
// One shared light palette for every app page. The dark pages were written over ~40 modules with the same dark palette
// (#0C1413 page, #101D1B cards, #24352F lines, #E8E4D8 ink, #8FA39B mute, #C5A56A gold), so instead of editing each one
// the worker remaps that palette on the way out, once, here. A page is touched only when its BODY background is dark;
// pages that are already cream (Momo, passports, the brief, fit) pass through unchanged. PDFs are not HTML and never pass here.
// Escape hatch: ?theme=dark returns the page exactly as written.
// Canvas pages (/skyline = the twin, /map = the live map): only CSS (style blocks and style="" attributes) is remapped, never
// <script>, so the 3D scene and map layers keep their own colours and only the chrome turns cream.
//
// Contrast on --cr-bg #F7F3EA (WCAG 2.1): ink #1D2A27 14.0:1 · mute #566963 5.4:1 · gold text #8A6A2C 4.6:1 (AA; the
// identity gold #C5A56A is 2.1:1 on cream, so it is kept only for the rules on cream pages that already use it) · teal #0A4F4A 9.2:1 ·
// accent teal #15665C 6.4:1 · amber #8A5A00 5.6:1 · green #2F7D4F 4.9:1 · blue #2F5F8F 6.0:1 · red #B04A3A 5.0:1.
// Cream text #F7F3EA on a gold button #8A6A2C is 4.6:1.

export const CREAM = {
  bg: "#F7F3EA", card: "#FFFDF8", chip: "#F1EBDD", raise: "#EAE3D2", line: "#DCD5C2", line2: "#CFC6B0",
  ink: "#1D2A27", ink2: "#16201E", soft: "#3B4441", mute: "#566963", gold: "#8A6A2C", goldSoft: "#7A5A20",
  teal: "#0A4F4A", teal2: "#15665C", amber: "#8A5A00", green: "#2F7D4F", blue: "#2F5F8F", red: "#B04A3A",
};

export const CREAM_VARS = ":root{--cr-bg:" + CREAM.bg + ";--cr-card:" + CREAM.card + ";--cr-chip:" + CREAM.chip + ";--cr-line:" + CREAM.line
  + ";--cr-ink:" + CREAM.ink + ";--cr-mute:" + CREAM.mute + ";--cr-gold:" + CREAM.gold + ";--cr-teal:" + CREAM.teal + ";--cr-teal2:" + CREAM.teal2 + "}";

const C = CREAM;
// dark hex -> cream hex (upper-case keys, six digits)
const HEX = {
  // page backgrounds
  "0C1413": C.bg, "0E1918": C.bg, "0E1413": C.bg, "0B0F0F": C.bg, "0E1817": C.bg, "0E1613": C.bg,
  // cards / panels / chips
  "101D1B": C.card, "131F1D": C.card, "121D1B": C.card, "1C2321": C.card,
  "16241F": C.chip, "182823": C.chip, "1A2422": C.chip, "13231F": C.chip,
  "1B2E2A": C.raise, "1C2B28": C.raise, "1B2A26": C.raise, "22302D": C.raise, "2B3532": C.raise, "1D1608": C.raise, "1A1407": C.raise,
  // hairlines
  "24352F": C.line, "2E4540": C.line2, "2E4A44": C.line2, "3B584F": C.line2, "3A4A48": C.line2,
  // ink (light text on dark)
  "E8E4D8": C.ink, "F2EFE6": C.ink2, "E6E1D8": C.ink, "E7E1D6": C.ink, "E9E3D6": C.ink, "EDE8DE": C.ink, "EEE9E0": C.ink, "E6E9E4": C.ink,
  "F0E4C8": C.teal, "FAF8F3": C.ink2, "F5EFE2": C.ink2, "F6F3EC": C.ink2, "FFFDF9": C.ink2,
  "C8D3CE": C.soft, "CFD8D3": C.soft, "B9B2A3": C.soft, "DDD5C2": C.soft, "D8D1C4": C.soft,
  // mutes
  "8FA39B": C.mute, "8FA39E": C.mute, "93A39E": C.mute, "6F837D": C.mute, "A9B7B2": C.mute, "B8C4BD": C.mute, "8A9A96": C.mute, "5E6E68": C.mute, "5E6F69": C.mute,
  // gold and warm accents (darkened for text on cream)
  "C5A56A": C.gold, "C9A97A": C.gold, "D9A441": C.amber, "E0B060": C.amber, "E0A458": C.amber,
  "E3C88F": C.goldSoft, "E8C27A": C.goldSoft, "F4D58D": C.goldSoft, "E8D6AE": C.goldSoft, "B98B3E": C.gold, "A88544": C.gold,
  // teals, status colours
  "3E8A7E": C.teal2, "8FC7B9": C.teal2, "8FD3B9": C.teal2, "2F8A7F": C.teal2,
  "5FBF8A": C.green, "56B584": C.green, "6FA8DC": C.blue, "7FA8C9": C.blue,
  "E06B5F": C.red, "E0A080": C.red,
  // second pass (v728 scan of every dark module): the rarer surfaces, tints and light text
  "26312F": C.raise, "0B1211": C.bg, "132320": C.card, "2C3A35": C.line2, "151D1C": C.card, "1B2524": C.chip, "1C2827": C.chip, "111C1A": C.card,
  "16302B": C.chip, "16211E": C.chip, "152422": C.chip, "152926": C.chip, "141C19": C.card, "12302A": C.chip, "0A1110": C.bg, "22312E": C.raise,
  "1C2725": C.chip, "2F433E": C.line2,
  "3A3222": "#F3E7CC", "4A3B1E": "#F3E7CC", "33270F": "#F3E7CC", "2A1F12": "#F3E7CC", "3B3322": "#F3E7CC", "3A3A1E": "#F3E7CC",
  "3A1A1A": "#F6DEDA", "4A2323": "#F6DEDA", "17283F": "#E1E9F3", "1E3148": "#E1E9F3",
  "D8E1DD": C.soft, "E8EEEC": C.ink, "C9D4CD": C.soft, "C9D3CE": C.soft, "C3C2B7": C.soft,
  "E8C4A8": C.goldSoft, "E8CD93": C.goldSoft, "E3D0B8": C.goldSoft, "F0DECC": C.goldSoft,
  "7FC8A9": C.teal2, "D2EBDD": C.teal2, "D8EFE6": C.teal2, "B7D3F6": C.blue, "9FC2E8": C.blue, "E0D88A": C.amber,
};
const RGB = {
  "197,165,106": "138,106,44", "12,20,19": "247,243,234", "19,31,29": "255,253,248", "24,42,38": "241,235,221",
  "26,36,34": "241,235,221", "232,228,216": "29,42,39", "14,25,24": "247,243,234", "16,29,27": "255,253,248",
};

const DARK_BG = /^#?(0C1413|0E1918|0E1413|0B0F0F|0E1817|0E1613|101D1B|131F1D)$/i;

/** True when the page's body background (resolved through --bg when it is a var) is one of the dark palette's. */
export function isDarkPage(html) {
  const s = String(html || "").slice(0, 400000);
  const bodyStyle = s.match(/<body[^>]*style\s*=\s*["'][^"']*background(?:-color)?\s*:\s*([^;"']+)/i);
  let v = String((bodyStyle && bodyStyle[1]) || "").trim();
  if (!v) for (const m of s.matchAll(/(?:^|[}\s,>])(?:html\s*,\s*)?body\s*\{([^}]*)\}/gi)) { const b = m[1].match(/background(?:-color)?\s*:\s*([^;}]+)/i); if (b) { v = b[1].trim(); break; } }
  const vm = v.match(/var\(\s*(--[\w-]+)/);
  if (vm) { const d = s.match(new RegExp(vm[1] + "\\s*:\\s*(#[0-9a-f]{6})", "i")); v = d ? d[1] : ""; }
  const hx = v.match(/#[0-9a-f]{6}/i);
  return !!(hx && DARK_BG.test(hx[0]));
}

/** Remap the dark palette in one piece of CSS/HTML text. */
export function creamText(t) {
  return String(t)
    .replace(/#([0-9a-f]{6})(?![0-9a-f])/gi, (m, h) => HEX[h.toUpperCase()] || m)
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*([,)])/gi, (m, r, g, b, end) => {
      const k = r + "," + g + "," + b; const to = RGB[k];
      if (to) return m.replace(/\(\s*\d+\s*,\s*\d+\s*,\s*\d+/, "(" + to);
      return m;
    })
    // faint white hairlines/fills meant for a dark page become faint ink on cream
    .replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.[0-2]\d*)\s*\)/gi, "rgba(29,42,39,$1)");
}

/** Remap only CSS: <style> blocks and style="" attributes (canvas pages). */
export function creamCssOnly(html) {
  return String(html)
    .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, b, c) => a + creamText(b) + c)
    .replace(/(\sstyle\s*=\s*")([^"]*)(")/gi, (m, a, b, c) => a + creamText(b) + c)
    .replace(/(<meta\s+name=["']?theme-color["']?\s+content=["']?)(#[0-9a-f]{6})/gi, (m, a, h) => a + creamText(h));
}

const CSS_ONLY = /^\/(skyline|map|twin)(\/|$)/;
const NEVER = /pdf|print|\/questions\//i;

/** Whole-page transform. Returns the HTML string unchanged when the page is not a dark app page. */
export function creamHtml(html, pathname) {
  if (!isDarkPage(html)) return html;
  const out = CSS_ONLY.test(pathname || "") ? creamCssOnly(html) : creamText(html);
  return out.replace(/<\/head>/i, "<style id=cream-v728>" + CREAM_VARS + "html{color-scheme:light}</style></head>");
}

/** Response wrapper for the worker's fetch: text/html only, 2xx only, never PDFs/print, ?theme=dark opts out. */
export async function creamTheme(request, url, resp) {
  try {
    if (!resp || resp.status < 200 || resp.status >= 300 || resp.webSocket) return resp;
    const ct = resp.headers.get("Content-Type") || "";
    if (ct.indexOf("text/html") !== 0) return resp;
    if (url.searchParams.get("theme") === "dark" || NEVER.test(url.pathname)) return resp;
    const len = Number(resp.headers.get("Content-Length") || 0); if (len > 4e6) return resp;
    const html = await resp.clone().text();
    const out = creamHtml(html, url.pathname);
    const h = new Headers(resp.headers); h.delete("Content-Length");
    return new Response(out, { status: resp.status, statusText: resp.statusText, headers: h });
  } catch (e) { return resp; }
}
