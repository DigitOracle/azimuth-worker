// v657 - MOMO - BUILDING BRIEFING CARDS (Kendall, 27 Oct 2026: "add another Momo card ... so she can get to it quickly whenever she needs to"). One card per
// building, keyed by a slug (first: berkeley). Najjuko's key only; anyone else, Kendall included, gets "not found" (as the client card, v643). THIS REPO IS PUBLIC:
// the briefing text, the figures and the PDF live in KV (loaded by a script kept outside git); the code holds only the shape, the limits, the renderer and the page.
//   dossier_list_najjuko          [{slug, title}]                        - which cards the front door shows
//   dossier_rec_najjuko_<slug>    {title, subtitle, updatedAt, usps, kpis, charts, sections:[{id, title, icon, md, open}]}   (kpis and charts: v658, work_dossier_charts.js)
//   dossier_pdf_najjuko_<slug>    the PDF, base64
//   dossier_notes_najjuko_<slug>  [{id, at, section, text}]                - her own notes and research to do
import { cleanGlance, glanceHtml, GLANCE_CSS } from "./work_dossier_charts.js";
const LIST = "dossier_list_najjuko", REC = "dossier_rec_najjuko_", PDF = "dossier_pdf_najjuko_", NOTES = "dossier_notes_najjuko_";
const S = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
export const slugOk = (v) => { const s = S(v, 40).toLowerCase(); return /^[a-z0-9][a-z0-9-]{0,39}$/.test(s) ? s : ""; };
export const MAX_NOTES = 300;
// icons by section (a short keyword set by the loader); line icons only, never emoji
export const DOSSIER_ICONS = {
  pitch: '<path d="M4 12h12M12 6l6 6-6 6"/>', facts: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  brochure: '<path d="M4 5h7v15H4zM13 5h7v15h-7z"/>', usp: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  market: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', area: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  compete: '<path d="M3 21V8l6-4v17M9 21V11l6-3v13M15 21V5l6 3v13"/>', grade: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  ask: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>', sources: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
  doc: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6"/>',
  // v658 - more section kinds for the at-a-glance card
  price: '<path d="M20 12l-8 8-8-8V4h8z"/><circle cx="8.5" cy="8.5" r="1.5"/>', plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  units: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>', transport: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1-4M15 21l-1-4"/>',
  amenity: '<path d="M4 20c4-1 6-5 8-10 2 5 4 9 8 10"/><circle cx="12" cy="6" r="2"/>', risk: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', rent: '<path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/>'
};
export const DOSSIER_ICON = '<path d="M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3"/><path d="M3 21h18"/>';

export function cleanDossier(x) {
  const g = x && typeof x === "object" ? x : {};
  const sections = (Array.isArray(g.sections) ? g.sections : []).slice(0, 30).map((s, i) => ({
    id: slugOk(s && s.id) || ("s" + i), title: S(s && s.title, 120).trim() || "Section", icon: DOSSIER_ICONS[s && s.icon] ? s.icon : "doc", md: S(s && s.md, 60000), open: !!(s && s.open) }));
  const gl = cleanGlance(g);
  return { title: S(g.title, 80).trim() || "Briefing", subtitle: S(g.subtitle, 200).trim(), updatedAt: S(g.updatedAt, 40), usps: S(g.usps, 4000).trim(), kpis: gl.kpis, charts: gl.charts, sections };
}

// Markdown to safe HTML: everything is escaped FIRST, then a small known subset is turned into tags (headings, bullets, numbers, tables, bold, italics,
// code, https links). Nothing from the record can inject markup or script.
export function mdToHtml(md) {
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (m, a, u) => '<a href="' + u + '" target=_blank rel="noopener noreferrer">' + a + "</a>");
  const lines = String(md || "").replace(/\r/g, "").split("\n"), out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l) || /^\s*---+\s*$/.test(l)) { i++; continue; }
    const h = l.match(/^(#{3,6})\s+(.*)$/); if (h) { out.push("<h4>" + inline(h[2]) + "</h4>"); i++; continue; }
    if (/^\s*\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)); if (!body.length) continue;
      out.push('<div class=tw><table><thead><tr>' + cells(body[0]).map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>"
        + body.slice(1).map((r) => "<tr>" + cells(r).map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const items = []; let ordered = /^\s*\d+\./.test(l);
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) items.push({ d: m[1].length >= 2 ? 1 : 0, t: m[3] }); else items[items.length - 1].t += " " + lines[i].trim();
        i++;
      }
      let html = ordered ? "<ol>" : "<ul>", open = false;
      items.forEach((it) => {
        if (it.d === 1 && !open) { html = html.replace(/<\/li>$/, "") + "<ul>"; open = true; }
        if (it.d === 0 && open) { html += "</ul></li>"; open = false; }
        html += "<li>" + inline(it.t) + "</li>";
      });
      if (open) html += "</ul></li>";
      out.push(html + (ordered ? "</ol>" : "</ul>")); continue;
    }
    const para = []; while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{3,6})\s/.test(lines[i]) && !/^\s*\|/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) { para.push(lines[i].trim()); i++; }
    out.push("<p>" + inline(para.join(" ")) + "</p>");
  }
  return out.join("");
}

export async function readList(env) { try { const v = await env.MEETINGS.get(LIST); const a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a.filter((x) => x && slugOk(x.slug)) : []; } catch (e) { return []; } }
export async function readDossier(env, slug) { const s = slugOk(slug); if (!s) return null; try { const v = await env.MEETINGS.get(REC + s); return v ? cleanDossier(JSON.parse(v)) : null; } catch (e) { return null; } }
async function readNotes(env, slug) { try { const v = await env.MEETINGS.get(NOTES + slug); const a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; } }

const CSS = '<style>.dh{color:#5F6B66;font-size:.85rem;margin:-8px 0 14px}.db{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 16px}.db button,.db a{display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 8px;border-radius:14px;border:1px solid #C9A97A;background:#1F2B44;color:#F9F1EF;font:600 .85rem Inter,"IBM Plex Sans",sans-serif;text-decoration:none;cursor:pointer}.db .lt{background:#F9F1EF;color:#1F2B44}'
  + '.ds{border:1px solid #E6DED2;border-radius:16px;background:#fff;margin:0 0 10px;overflow:hidden}.ds>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:14px;cursor:pointer;font-weight:600;color:#1F2B44}.ds>summary::-webkit-details-marker{display:none}.ds>summary svg{flex:none;color:#C9A97A}.ds>summary:after{content:"+";margin-left:auto;color:#C9A97A;font-size:1.2rem}.ds[open]>summary:after{content:"\\2212"}'
  + '.dx{padding:0 14px 14px;font-size:.92rem;line-height:1.5;color:#202020}.dx h4{margin:14px 0 6px;color:#1F2B44;font-size:.95rem}.dx ul,.dx ol{padding-left:20px;margin:6px 0}.dx li{margin:3px 0}.dx p{margin:8px 0}.dx a{color:#1F2B44}.dx code{font-size:.8rem;background:#F9F1EF;padding:1px 4px;border-radius:4px}'
  + '.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:8px 0}.tw table{border-collapse:collapse;font-size:.8rem;min-width:560px}.tw th{background:#1F2B44;color:#F9F1EF;text-align:left;padding:6px}.tw td{border-bottom:1px solid #E6DED2;padding:6px;vertical-align:top}'
  + '.dn textarea{width:100%;box-sizing:border-box;min-height:84px;border:1px solid #D8D1C4;border-radius:12px;padding:10px;font:inherit}.dn select{width:100%;margin:6px 0;padding:8px;border-radius:10px;border:1px solid #D8D1C4}.dn .nl{margin-top:10px}.dn .ni{border-top:1px solid #EEE7DB;padding:8px 0;font-size:.88rem}.dn .ni small{color:#8A6F3E;display:block}</style>';

export const DOSSIER_JS = "var __name=function(f){return f};" + String.raw`(function(){
var Q=new URLSearchParams(location.search),KY=Q.get('key')||'',RK=Q.get('rk')||'',B=Q.get('b')||'',q='?key='+encodeURIComponent(KY)+(RK?'&rk='+encodeURIComponent(RK):'')+'&b='+encodeURIComponent(B);
function el(i){return document.getElementById(i)}
function esc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
var back=el('dback');if(back)back.href='/momo?key='+encodeURIComponent(KY)+(RK?'&rk='+encodeURIComponent(RK):'');
var pdfUrl='/momo/work/brief/pdf'+q;var op=el('dpdf');if(op)op.href=pdfUrl;
var sh=el('dshare');if(sh)sh.onclick=function(){var t=document.title;fetch(pdfUrl).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){var f=null;try{f=new File([b],(B||'briefing')+'.pdf',{type:'application/pdf'})}catch(e){}
 if(f&&navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:t}).catch(function(){})}else if(navigator.share){navigator.share({title:t,url:location.origin+pdfUrl}).catch(function(){})}else{window.open(pdfUrl,'_blank')}}).catch(function(){alert('Could not get the PDF just now.')})};
var cp=el('dcopy');if(cp)cp.onclick=function(){var t=(el('dusps')||{}).value||'';if(!t){alert('No selling points saved yet.');return}
 if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){cp.textContent='Copied';setTimeout(function(){cp.textContent='Copy USPs'},1600)},function(){prompt('Copy:',t)})}else{prompt('Copy:',t)}};
function drawNotes(a){var h='';(a||[]).slice().reverse().forEach(function(n){h+='<div class=ni><small>'+esc(new Date(n.at).toLocaleString())+(n.section?' · '+esc(n.section):'')+'</small>'+esc(n.text).replace(/\n/g,'<br>')+'</div>'});var w=el('dnl');if(w)w.innerHTML=h||'<p class=dh>No notes yet.</p>'}
fetch('/momo/work/brief/rec'+q).then(function(r){return r.json()}).then(function(j){drawNotes(j&&j.notes)}).catch(function(){});
var sv=el('dsave');if(sv)sv.onclick=function(){var t=(el('dtext')||{}).value||'';if(!t.trim()){alert('Write a note first.');return}sv.disabled=true;
 fetch('/momo/work/brief/api'+q,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'note',text:t,section:(el('dsec')||{}).value||''})}).then(function(r){return r.json()}).then(function(j){sv.disabled=false;if(j&&j.ok){el('dtext').value='';drawNotes(j.notes)}else alert((j&&j.error)||'Not saved.')}).catch(function(){sv.disabled=false;alert('Not saved. Check your connection.')})};
})();`;

export function dossierPage(rec) {
  const ic = (d) => '<svg viewBox="0 0 24 24" width=22 height=22 fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + "</svg>";
  const e = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const anyOpen = rec.sections.some((s) => s.open);   // v658 - the record says which sections open; older records keep "first one open"
  const secs = rec.sections.map((s, i) => '<details class=ds' + ((anyOpen ? s.open : i === 0) ? " open" : "") + ' id="s-' + e(s.id) + '"><summary>' + ic(DOSSIER_ICONS[s.icon] || DOSSIER_ICONS.doc) + e(s.title) + '</summary><div class=dx>' + mdToHtml(s.md) + "</div></details>").join("");
  const opts = '<option value="">General</option>' + rec.sections.map((s) => '<option>' + e(s.title) + "</option>").join("");
  return CSS + GLANCE_CSS + '<a class=back href="/momo" id=dback>&#8592; Momo</a><div class=tag>MOMO · BRIEFING</div><h1>' + e(rec.title) + '</h1><p class=dh>' + e(rec.subtitle) + (rec.updatedAt ? " · updated " + e(rec.updatedAt) : "") + "</p>"
    + '<div class=db><a id=dpdf href="#" target=_blank>Open PDF</a><button id=dshare type=button>Share PDF</button><button id=dcopy class=lt type=button>Copy USPs</button><a class=lt href="#dnotes">My notes</a></div>'
    + '<textarea id=dusps hidden>' + e(rec.usps) + "</textarea>" + glanceHtml(rec) + (rec.sections.length && (rec.kpis.length || rec.charts.length) ? "<div class=gl>The detail</div>" : "") + secs
    + '<details class=ds open id=dnotes><summary>' + ic('<path d="M4 20h4l11-11-4-4L4 16z"/><path d="M13 6l4 4"/>') + 'My notes and research to do</summary><div class="dx dn"><select id=dsec>' + opts + '</select><textarea id=dtext placeholder="What to check, who to call, what you found..."></textarea><div class=db style="margin-top:8px"><button id=dsave type=button>Save note</button></div><div class=nl id=dnl></div></div></details>';
}

export async function dossierRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const NF = () => new Response("not found", { status: 404 });
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "najjuko") return NF();   // Najjuko's key only, as the client card
  const slug = slugOk(url.searchParams.get("b")); if (!slug) return NF();
  const rec = await readDossier(env, slug); if (!rec) return NF();
  if (p === "/momo/work/brief" && request.method === "GET") return new Response(deps.page(key, rk, dossierPage(rec) + "<script>" + DOSSIER_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (p === "/momo/work/brief/rec" && request.method === "GET") return J({ rec, notes: await readNotes(env, slug) });
  if (p === "/momo/work/brief/pdf" && request.method === "GET") {
    const b64 = await env.MEETINGS.get(PDF + slug); if (!b64) return NF();
    let bytes; try { const bin = atob(b64); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch (e) { return NF(); }
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="' + slug + '-briefing.pdf"', "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/brief/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    if ((b || {}).action !== "note") return J({ error: "Unknown action." }, 400);
    const text = S(b.text, 3000).trim(); if (!text) return J({ error: "Write a note first." }, 400);
    const notes = await readNotes(env, slug);
    notes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), section: S(b.section, 120).trim(), text });
    const kept = notes.slice(-MAX_NOTES); await env.MEETINGS.put(NOTES + slug, JSON.stringify(kept));
    return J({ ok: true, notes: kept });
  }
  return NF();
}
