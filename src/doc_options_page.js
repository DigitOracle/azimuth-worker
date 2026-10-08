// v407 - ONE options-page shell for the three documents (Investor, Client, Broker). The page, its look and its controls pattern are shared:
// cards you press (single choice), cards you tick (several), a text box, greyed cards that say WHY, a "Always included" locked core, one Generate link.
//   - the Investor page (src/investor_tiers_page.js selectorHtml) is a configuration of optFrame(): same markup, same css, same script as before v407.
//   - the Client and Broker pages (src/doc_options_docs.js) are declarative configs drawn by optionsHtml() with the runtime below.
// Nothing here reads or writes KV. The locked core is shown, never a switch: it has no input and no link parameter.
import { esc } from "./brief_docs.js";

// the css the Investor selector has always had, verbatim (kept as the pieces it was written in, so the page is byte-for-byte what it was)
export const OPT_CSS = ':root{--teal:#0A4F4A;--gold:#C5A56A;--ink:#22262B;--hair:#E6E1D8;--bg:#FBFAF7;--warn:#B5651D}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans","Segoe UI",Arial,sans-serif;font-size:14px;line-height:1.4}' +
  "main{max-width:760px;margin:0 auto;padding:16px}h1{font-family:Newsreader,Georgia,serif;font-weight:400;font-size:24px;margin:4px 0 2px;color:#17283F}h2{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#A8814A;margin:20px 0 8px}" +
  ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.card{border:1px solid var(--hair);background:#fff;border-radius:10px;padding:10px;min-width:0;text-align:left;font:inherit;color:inherit}button.card{cursor:pointer}.card[aria-pressed=true]{border-color:var(--teal);box-shadow:inset 0 0 0 1px var(--teal)}" +
  ".card b{display:block;font-size:13px;color:#17283F}.card small{display:block;color:#5b6168;font-size:11.5px;margin-top:2px}.core{border-left:4px solid var(--teal)}.tag{display:inline-block;font-size:10px;border-radius:8px;padding:0 7px;margin-top:5px;border:1px solid var(--teal);color:var(--teal)}" +
  ".blocked{background:#F6F2EC;border-color:#D9B99B}.blocked .tag{border-color:#8A3B12;color:#8A3B12}.note{border-left:3px solid var(--warn);background:#FBF3E8;font-size:11.5px;padding:4px 8px;margin-top:6px}" +
  ".seg{display:flex;gap:8px;align-items:flex-start}.seg input{margin-top:3px;width:18px;height:18px}.go{display:block;width:100%;margin-top:18px;padding:14px;border-radius:10px;background:var(--teal);color:#fff;text-align:center;text-decoration:none;font-weight:600}.sm{font-size:11.5px;color:#5b6168}";
// only the generic (Client / Broker) pages need these: a text box, a greyed card, a link card, and a go link that is off
export const OPT_CSS_EXTRA = ".txt{display:block;width:100%;margin-top:6px;padding:9px;border:1px solid var(--hair);border-radius:8px;font:inherit;font-size:16px;color:inherit;background:#fff}a.card{display:block;text-decoration:none}.off{opacity:.55;cursor:not-allowed}.go.stop{background:#8A3B12;pointer-events:none}";

// the frame: head, title, subtitle, body, script. body may hold the h2/grid markup, the go link and the covers line.
export function optFrame(o) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + o.title + "</title><style>" + OPT_CSS + (o.extraCss || "") +
    "</style></head><body><main><h1>" + o.title + "</h1><div class=sm>" + o.sub + "</div>" + o.body + "</main><script>" + o.script + "</script></body></html>";
}

// ---------------------------------------------------------------------------------------------------------- the generic runtime (runs in the browser; also run by the tests on a stand-in DOM)
// D: { sections, core, base, fixed:[[k,v]], key, go, stop }
//   section: { id, title, type: single|multi|text|nav, when?:{sec,ids}, whyNot?, options?|fields?, param?, mode?: omit|include }
//   option:  { id, title, small, icon, off, why:[..], when?, whyNot?, set?:{k:v}, val?, def?, href? }
export function optRuntime() {
  var st = { sel: {}, chk: {}, txt: {} };
  var E = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var secOf = function (id) { return D.sections.filter(function (s) { return s.id === id; })[0]; };
  function whenOk(w) { return !w || (w.ids.indexOf(st.sel[w.sec]) >= 0); }
  function optOk(sec, o) { return !o.off && whenOk(sec.when) && whenOk(o.when); }
  function optWhy(sec, o) { if (o.off) return o.why || []; if (!whenOk(sec.when)) return [sec.whyNot]; if (!whenOk(o.when)) return [o.whyNot]; return []; }
  function init() {
    D.sections.forEach(function (s) {
      if (s.type === "single") { var d = (s.options.filter(function (o) { return o.def && !o.off; })[0] || s.options.filter(function (o) { return !o.off; })[0] || s.options[0]); st.sel[s.id] = d ? d.id : ""; }
      if (s.type === "multi") s.options.forEach(function (o) { st.chk[s.id + "/" + o.id] = !!o.def && !o.off; });
      if (s.type === "text") s.fields.forEach(function (f) { st.txt[f.param] = f.def || ""; });
    });
  }
  function settle() {   // a single choice that has become unavailable falls back to the first available card
    D.sections.forEach(function (s) {
      if (s.type !== "single") return;
      var cur = s.options.filter(function (o) { return o.id === st.sel[s.id]; })[0];
      if (!cur || !optOk(s, cur)) { var f = s.options.filter(function (o) { return o.def && optOk(s, o); })[0] || s.options.filter(function (o) { return optOk(s, o); })[0]; st.sel[s.id] = f ? f.id : ""; }
    });
  }
  function url() {
    var p = D.fixed.slice(), n = 0;
    D.sections.forEach(function (s) {
      if (s.type === "single") { var o = s.options.filter(function (x) { return x.id === st.sel[s.id]; })[0]; if (o && o.set) Object.keys(o.set).forEach(function (k) { if (o.set[k] !== "" && o.set[k] != null) p.push([k, o.set[k]]); }); if (o && !o.off) n++; }
      if (s.type === "multi") {
        var ids = s.options.filter(function (o) { var on = optOk(s, o) && st.chk[s.id + "/" + o.id]; if (on) n++; return s.mode === "omit" ? (optOk(s, o) && !on) : on; }).map(function (o) { return o.val; });
        if (ids.length) p.push([s.param, ids.join(",")]);
      }
      if (s.type === "text") s.fields.forEach(function (f) { var ok = whenOk(s.when), v = ok ? String(st.txt[f.param] || "").trim() : ""; if (!v && f.always) v = f.always; if (v) { p.push([f.param, v]); if (st.txt[f.param]) n++; } });
    });
    var q = p.map(function (kv) { return kv[0] + "=" + encodeURIComponent(kv[1]); });
    if (D.key) q.push("key=" + encodeURIComponent(D.key));
    return { href: D.base + "?" + q.join("&"), n: n };
  }
  function card(sec, o, kind) {
    var ok = optOk(sec, o), why = optWhy(sec, o), ic = (o.icon && I[o.icon]) || "";
    var tag = ok ? (o.tag ? '<span class=tag>' + E(o.tag) + "</span>" : "") : '<span class=tag>' + E(o.off ? "No data" : "Not with this choice") + "</span>";
    var notes = why.map(function (r) { return "<div class=note>" + E(r) + "</div>"; }).join("");
    var body = ic + "<b>" + E(o.title) + "</b><small>" + E(o.small || "") + "</small>" + tag + notes;
    if (kind === "single") return '<button type=button class="card' + (ok ? "" : " blocked off") + '" aria-pressed=' + (st.sel[sec.id] === o.id) + (ok ? "" : " disabled aria-disabled=true") + ' data-s="' + E(sec.id) + '" data-o="' + E(o.id) + '">' + body + "</button>";
    if (kind === "multi") return '<label class="card seg' + (ok ? "" : " blocked off") + '"><input type=checkbox ' + (ok && st.chk[sec.id + "/" + o.id] ? "checked " : "") + (ok ? "" : "disabled ") + 'data-s="' + E(sec.id) + '" data-o="' + E(o.id) + '"><span>' + body + "</span></label>";
    return '<a class="card" href="' + E(o.href) + '" aria-pressed=' + (!!o.cur) + ">" + body + "</a>";
  }
  function draw() {
    settle();
    D.sections.forEach(function (s) {
      var h = "";
      if (s.type === "text") {
        var ok = whenOk(s.when);
        h = s.fields.map(function (f) { return '<label class="card' + (ok ? "" : " blocked off") + '"><b>' + E(f.title) + "</b><small>" + E(f.small || "") + '</small><input class=txt type=text inputmode="' + (f.kind === "money" ? "numeric" : "text") + '" maxlength=' + (f.max || 60) + ' placeholder="' + E(f.ph || "") + '" value="' + E(st.txt[f.param] || "") + '" data-p="' + E(f.param) + '"' + (ok ? "" : " disabled") + ">" + (ok ? "" : "<div class=note>" + E(s.whyNot) + "</div>") + "</label>"; }).join("");
      } else h = s.options.map(function (o) { return card(s, o, s.type); }).join("");
      $("sec_" + s.id).innerHTML = h;
    });
    $("core").innerHTML = D.core.map(function (c) { return '<div class="card core"><b>' + E(c.title) + "</b><small>" + E(c.small) + '</small><span class=tag>Always included</span></div>'; }).join("");
    var u = url(), go = $("go"); go.href = u.href;
    go.className = D.stop ? "go stop" : "go";
    $("covers").textContent = u.n + " choices made. " + D.coverNote;
  }
  function onClick(e) { var t = e.target; while (t && !(t.getAttribute && t.getAttribute("data-o") && t.tagName === "BUTTON")) t = t.parentNode; if (!t) return; st.sel[t.getAttribute("data-s")] = t.getAttribute("data-o"); draw(); }
  function onChange(e) { var t = e.target; if (t.getAttribute("data-o")) { st.chk[t.getAttribute("data-s") + "/" + t.getAttribute("data-o")] = !!t.checked; draw(); } }
  function onInput(e) { var t = e.target, p = t.getAttribute && t.getAttribute("data-p"); if (!p) return; var v = t.value; if (/numeric/.test(t.getAttribute("inputmode") || "")) v = v.replace(/[^0-9.]/g, ""); st.txt[p] = v; var u = url(); $("go").href = u.href; $("covers").textContent = u.n + " choices made. " + D.coverNote; }
  init();
  draw();
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);
  return { st: st, url: url, draw: draw };
}

// the page for a declarative config. cfg: { title, sub, sections, core, base, fixed, key, go, coverNote, stop?, icons:[names] }
export function optionsHtml(cfg, icon) {
  const data = { sections: cfg.sections, core: cfg.core, base: cfg.base, fixed: cfg.fixed, key: cfg.key || "", stop: !!cfg.stop, coverNote: cfg.coverNote };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const icons = JSON.stringify(Object.fromEntries((cfg.icons || []).map((n) => [n, icon(n, 20, "#0A4F4A")]))).replace(/</g, "\\u003c");
  let n = 0;
  const body = cfg.sections.map((s) => "<h2>" + (++n) + ". " + esc(s.title) + "</h2>" + (s.help ? "<div class=sm>" + esc(s.help) + "</div>" : "") + "<div class=grid id=sec_" + s.id + "></div>").join("") +
    '<h2>Always included, in every version</h2><div class=grid id=core></div><a class=go id=go href="#">' + esc(cfg.go) + "</a><p class=sm id=covers></p>";
  return optFrame({ title: esc(cfg.title), sub: cfg.sub, body, extraCss: OPT_CSS_EXTRA, script: "var D=" + json + ",I=" + icons + ";(" + optRuntime.toString() + ")();" });
}
