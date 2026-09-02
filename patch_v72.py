# v72: unit-type card gallery (/cards) + "Unit cards" section on the availability drill.
p = r"C:\Dev\azimuth-worker\src\index.js"
s = open(p, encoding="utf-8").read()

old_route = '''      if (url.pathname === "/avail") {                        // v69 - availability drill (donut of registered mix; claimed units join after extraction)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _dk = String(url.searchParams.get("d") || "").replace(/[^a-z0-9]/g, "");
        let _dd3 = null; try { _dd3 = JSON.parse((await env.MEETINGS.get("img_drill_" + _dk)) || "null"); } catch (e) {}
        if (!_dd3) return new Response("no drill data", { status: 404 });
        const _full = url.searchParams.get("full") === "1" && _dd3.claimed && _dd3.claimed.detail;
        return new Response(_full ? renderAvailUnits(_dd3, _dk, url.searchParams.get("key") || "") : renderAvailDrill(_dd3, _dk, url.searchParams.get("key") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }'''
assert s.count(old_route) == 1, "avail route anchor"
new_route = '''      if (url.pathname === "/cards") {                        // v72 - unit-type card gallery for a building (cards_<b>_index pushed by push_cards.py)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _cb = String(url.searchParams.get("b") || "symphony").replace(/[^a-z0-9]/g, "");
        let _ci = null; try { _ci = JSON.parse((await env.MEETINGS.get("img_cards_" + _cb + "_index")) || "null"); } catch (e) {}
        if (!_ci) return new Response("no cards for " + _cb, { status: 404 });
        return new Response(renderCards(_ci, _cb, url.searchParams.get("key") || "", url.searchParams.get("t") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/avail") {                        // v69 - availability drill (donut of registered mix; claimed units join after extraction)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _dk = String(url.searchParams.get("d") || "").replace(/[^a-z0-9]/g, "");
        let _dd3 = null; try { _dd3 = JSON.parse((await env.MEETINGS.get("img_drill_" + _dk)) || "null"); } catch (e) {}
        if (!_dd3) return new Response("no drill data", { status: 404 });
        let _cards = [];                                          // v72 - card galleries that belong to this developer's drill
        for (const _b of (CARD_BUILDINGS[_dk] || [])) { try { const _j = JSON.parse((await env.MEETINGS.get("img_cards_" + _b + "_index")) || "null"); if (_j) _cards.push(_j); } catch (e) {} }
        const _full = url.searchParams.get("full") === "1" && _dd3.claimed && _dd3.claimed.detail;
        return new Response(_full ? renderAvailUnits(_dd3, _dk, url.searchParams.get("key") || "") : renderAvailDrill(_dd3, _dk, url.searchParams.get("key") || "", _cards), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }'''
s = s.replace(old_route, new_route)

s = s.replace("function renderAvailDrill(d, dk, key) {", "function renderAvailDrill(d, dk, key, cards) {")
anchor = '''<div style="margin-top:14px"><div style="font-family:Fraunces,Georgia,serif;font-weight:600;margin-bottom:2px">Latest registered</div>${latest}</div>'''
assert s.count(anchor) == 1, "latest anchor"
BS = "\\"
cards_block = (
'''${(() => {                                                      // v72 - unit-type cards (developer plate + facts), one gallery per building
  const gs = cards || []; if (!gs.length) return "";
  return gs.map(g => {
    const b = String(g.building || ""); const bt = b.charAt(0).toUpperCase() + b.slice(1);
    const pills = (g.cards || []).map(c => '<a class=act href="/cards?b=' + encodeURIComponent(b) + '&t=' + encodeURIComponent(c.type) + '&key=' + encodeURIComponent(key) + '">' + cardLabel(c.type) + '</a>').join("");
    return '<div style="margin-top:14px;background:rgba(197,165,106,.06);border:1px solid rgba(197,165,106,.35);border-radius:12px;padding:.7rem .9rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-family:Fraunces,Georgia,serif;font-weight:600;color:var(--gold)">Unit cards - ' + bt + '</span>' +
      (g.pdf ? '<a href="' + g.pdf + '" style="color:var(--gold);text-decoration:none;font-size:.72rem;border:1px solid rgba(197,165,106,.5);border-radius:99px;padding:3px 10px">PDF, all types</a>' : "") + '</div>' +
      '<div style="margin-top:6px">' + pills + '</div>' +
      '<div style="color:var(--mut);font-size:.6rem;margin-top:.4rem;font-family:''' + BS + "'IBM Plex Mono" + BS + '''',monospace">developer plate + availability as of the latest sheet - rebuilt daily</div></div>';
  }).join("");
})()}
''' + anchor)
s = s.replace(anchor, cards_block)

helper = (
'''// v72 - UNIT CARDS: buildings with card galleries per drill key, label helper, and the gallery page
const CARD_BUILDINGS = { imtiaz: ["symphony"] };
function cardLabel(t) { return String(t || "").replace(/_/g, " ").replace(/MasterSuite 1BR/, "Master Suite 1BR").replace(/4BR Duplex (lower|upper)/, "4BR Duplex - $1"); }
function renderCards(ci, b, key, t) {
  const cards = ci.cards || [];
  const sel = t ? cards.find(c => c.type === t) : null;
  const bt = String(ci.building || b); const title = bt.charAt(0).toUpperCase() + bt.slice(1);
  const pills = cards.map(c => '<a class=act' + (sel && sel.type === c.type ? ' style="border-color:var(--gold);color:var(--gold)"' : '') + ' href="/cards?b=' + encodeURIComponent(b) + '&t=' + encodeURIComponent(c.type) + '&key=' + encodeURIComponent(key) + '">' + cardLabel(c.type) + '</a>').join("");
  const body = sel
    ? '<a href="' + sel.url + '" target=_blank><img src="' + sel.url + '" alt="' + cardLabel(sel.type) + ' card" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#fff"></a>' +
      '<div style="color:var(--mut);font-size:.66rem;margin-top:6px;font-family:''' + BS + "'IBM Plex Mono" + BS + '''',monospace">tap the card to open full size - pinch to zoom</div>'
    : cards.map(c => '<a href="/cards?b=' + encodeURIComponent(b) + '&t=' + encodeURIComponent(c.type) + '&key=' + encodeURIComponent(key) + '" style="display:block;margin-bottom:10px"><img src="' + c.url + '" loading=lazy alt="' + cardLabel(c.type) + '" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#fff"></a>').join("");
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title} - unit cards</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:auto;max-width:720px;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 14px 88px}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.3rem;font-weight:600}.mast em{font-style:normal;color:var(--gold)}
.sub{color:var(--mut);font-size:.7rem;font-family:"IBM Plex Mono",monospace;margin:2px 0 12px}
.act{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 11px;color:var(--text);text-decoration:none;font-size:.72rem;margin:0 6px 8px 0;background:var(--card)}
${NAJ_NAV_CSS}</style></head><body>
<div class=mast>${title} <em>- unit cards</em></div>
<div class=sub>developer plate per type - availability from the latest sheet - curated by DigitAlchemy</div>
<div>${pills}${ci.pdf ? '<a class=act href="' + ci.pdf + '" target=_blank>PDF, all types</a>' : ''}</div>
${body}
<div style="margin-top:12px"><a class=act href="/avail?d=imtiaz&key=${encodeURIComponent(key)}">back to the mix</a><a class=act href="/board?key=${encodeURIComponent(key)}">board</a></div>
${najNav(key, "market")}
</body></html>`;
}

''')
anchor2 = "// v71 - UNIT LIST: every developer-stated unit, grouped by project. The bottom of the drill."
assert s.count(anchor2) == 1, "units anchor"
s = s.replace(anchor2, helper + anchor2)
open(p, "w", encoding="utf-8").write(s)
print("v72 patched")
