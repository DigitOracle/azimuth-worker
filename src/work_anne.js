// v641 - MOMO - a TEMPORARY CLIENT CARD (Kendall, 27 Oct 2026: "a temporary card, easy to access and continually updated"). One record, annemarie_rec in KV: a short brief and a list of
// property leads (agent, phone, advert link, status, notes). Kendall's key only (personOfKey = "kendall"); anyone else gets "not found". The front door shows the card while the record exists and is
// not retired. THIS REPO IS PUBLIC: the client's name, the brief, every lead, name, number and link live in the KV record (loaded once by a script kept outside git, then edited on the page); the code
// holds only the shape, the limits and the page.
export const ANNE_KEY = "annemarie_rec";
export const STATUSES = ["New", "Contacted", "Available", "Viewing booked", "Viewed", "Rejected", "Expired"];
export const DOGS = ["unknown", "yes", "no"];
export const PHONE_TYPES = ["", "agent", "agency", "DLD business", "DLD registered"];
export const VERIFIED = ["", "exact advert", "area search / agent profile", "historical"];
const S = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const url = (v) => { const u = S(v, 500).trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ""; };
const phone = (v) => S(v, 40).replace(/[^0-9+()\-\s]/g, "").trim();
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.min(n, 1e9) : 0; };
const slug = (v) => S(v, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
export const MAX_LEADS = 150;

export function cleanLead(x, prev) {
  const o = Object.assign({}, prev || {}), g = x && typeof x === "object" ? x : {}, has = (k) => g[k] !== undefined;
  const T = [["community", 60], ["property", 120], ["ref", 60], ["portalRef", 60], ["beds", 20], ["baths", 20], ["furnished", 80], ["agent", 80], ["agency", 80], ["brokerLicence", 30], ["trakheesi", 40], ["verification", 400]];
  T.forEach(([k, n]) => { if (has(k)) o[k] = S(g[k], n).trim(); else if (o[k] === undefined) o[k] = ""; });
  if (has("rent")) o.rent = num(g.rent); else if (o.rent === undefined) o.rent = 0;
  if (has("sizeSqft")) o.sizeSqft = num(g.sizeSqft); else if (o.sizeSqft === undefined) o.sizeSqft = 0;
  if (has("dog")) o.dog = DOGS.includes(g.dog) ? g.dog : "unknown"; else if (!o.dog) o.dog = "unknown";
  if (has("phone")) o.phone = phone(g.phone); else if (o.phone === undefined) o.phone = "";
  if (has("phoneType")) o.phoneType = PHONE_TYPES.includes(g.phoneType) ? g.phoneType : ""; else if (o.phoneType === undefined) o.phoneType = "";
  if (has("email")) { const e = S(g.email, 120).trim(); o.email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) ? e : ""; } else if (o.email === undefined) o.email = "";
  if (has("listingUrl")) o.listingUrl = url(g.listingUrl); else if (o.listingUrl === undefined) o.listingUrl = "";
  if (has("contactUrl")) o.contactUrl = url(g.contactUrl); else if (o.contactUrl === undefined) o.contactUrl = "";
  if (has("status")) o.status = STATUSES.includes(g.status) ? g.status : (o.status || "New"); else if (!o.status) o.status = "New";
  if (has("verified")) o.verified = VERIFIED.includes(g.verified) ? g.verified : ""; else if (o.verified === undefined) o.verified = "";
  if (has("flags")) o.flags = (Array.isArray(g.flags) ? g.flags : []).slice(0, 8).map((f) => S(f, 80).trim()).filter(Boolean); else if (!Array.isArray(o.flags)) o.flags = [];
  if (has("notes")) o.notes = S(g.notes, 1500); else if (o.notes === undefined) o.notes = "";
  o.id = slug(g.id || o.id) || ("l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  return o;
}

export function cleanBrief(b) {
  const x = b && typeof b === "object" ? b : {};
  return { budgetMin: num(x.budgetMin), budgetMax: num(x.budgetMax), summary: S(x.summary, 400).trim(),
    chips: (Array.isArray(x.chips) ? x.chips : []).slice(0, 12).map((c) => S(c, 50).trim()).filter(Boolean),
    communities: (Array.isArray(x.communities) ? x.communities : []).slice(0, 8).map((c) => S(c, 50).trim()).filter(Boolean) };
}

export const emptyAnne = () => ({ v: 1, updatedAt: "", title: "", archived: false, brief: cleanBrief({}), leads: [], log: [] });

export function cleanAnne(r) {
  const e = emptyAnne(), x = r && typeof r === "object" ? r : {};
  const seen = new Set(), leads = [];
  (Array.isArray(x.leads) ? x.leads : []).slice(0, MAX_LEADS).forEach((l) => { const c = cleanLead(l); c.updatedAt = S(l && l.updatedAt, 30); if (!seen.has(c.id)) { seen.add(c.id); leads.push(c); } });
  return Object.assign(e, { updatedAt: S(x.updatedAt, 30), title: S(x.title, 40).trim(), archived: !!x.archived, brief: cleanBrief(x.brief), leads,
    log: (Array.isArray(x.log) ? x.log : []).slice(0, 40).map((l) => ({ at: S(l && l.at, 30), text: S(l && l.text, 200) })).filter((l) => l.text) });
}

export async function readAnne(env) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(ANNE_KEY)); } catch (e) {} return r ? cleanAnne(r) : null; }
async function writeAnne(env, rec, line) {
  const now = new Date().toISOString();
  rec.updatedAt = now; if (line) rec.log = [{ at: now, text: S(line, 200) }].concat(rec.log || []).slice(0, 40);
  await env.MEETINGS.put(ANNE_KEY, JSON.stringify(rec));
  return rec;
}

// POST actions. Every edit bumps updatedAt and adds a line to the log.
export async function anneApi(env, b) {
  let rec = await readAnne(env), made = false;
  if (!rec) { rec = emptyAnne(); made = true; }
  const find = (id) => rec.leads.findIndex((l) => l.id === slug(id));
  switch (b.action) {
    case "save_lead": {
      const i = b.lead && b.lead.id ? find(b.lead.id) : -1;
      if (i < 0 && rec.leads.length >= MAX_LEADS) return { error: "The card holds up to " + MAX_LEADS + " leads.", status: 400 };
      const c = cleanLead(b.lead, i >= 0 ? rec.leads[i] : null); c.updatedAt = new Date().toISOString();
      if (!c.property && !c.community) return { error: "Give the lead a property or community.", status: 400 };
      if (i >= 0) rec.leads[i] = c; else rec.leads.push(c);
      await writeAnne(env, rec, (i >= 0 ? "Updated " : "Added ") + (c.property || c.community)); return { ok: true, lead: c, rec };
    }
    case "delete_lead": { const i = find(b.id); if (i < 0) return { error: "No such lead.", status: 404 }; const n = rec.leads[i].property; rec.leads.splice(i, 1); await writeAnne(env, rec, "Removed " + n); return { ok: true, rec }; }
    case "set_status": {
      const i = find(b.id); if (i < 0) return { error: "No such lead.", status: 404 };
      if (!STATUSES.includes(b.status)) return { error: "Unknown status.", status: 400 };
      rec.leads[i].status = b.status; rec.leads[i].updatedAt = new Date().toISOString();
      await writeAnne(env, rec, (rec.leads[i].property || rec.leads[i].community) + ": " + b.status); return { ok: true, rec };
    }
    case "add_note": {
      const i = find(b.id); const t = S(b.note, 400).trim(); if (i < 0) return { error: "No such lead.", status: 404 }; if (!t) return { error: "Write the note first.", status: 400 };
      const d = new Date().toISOString().slice(0, 10); rec.leads[i].notes = S((rec.leads[i].notes ? rec.leads[i].notes + "\n" : "") + d + ": " + t, 1500); rec.leads[i].updatedAt = new Date().toISOString();
      await writeAnne(env, rec, "Note on " + (rec.leads[i].property || rec.leads[i].community)); return { ok: true, rec };
    }
    case "set_notes": { const i = find(b.id); if (i < 0) return { error: "No such lead.", status: 404 }; rec.leads[i].notes = S(b.notes, 1500); rec.leads[i].updatedAt = new Date().toISOString(); await writeAnne(env, rec, "Notes edited on " + (rec.leads[i].property || rec.leads[i].community)); return { ok: true, rec }; }
    case "save_brief": { rec.brief = cleanBrief(b.brief); if (b.title !== undefined) rec.title = S(b.title, 40).trim(); await writeAnne(env, rec, "Brief updated"); return { ok: true, rec }; }
    case "import_leads": {
      const list = Array.isArray(b.leads) ? b.leads.slice(0, MAX_LEADS) : []; let added = 0, merged = 0;
      list.forEach((x) => {
        const id = slug(x && x.id), i = id ? find(id) : -1;
        if (i >= 0) { rec.leads[i] = cleanLead(x, rec.leads[i]); rec.leads[i].updatedAt = new Date().toISOString(); merged++; }
        else if (rec.leads.length < MAX_LEADS) { const c = cleanLead(x); c.updatedAt = new Date().toISOString(); if (!rec.leads.some((l) => l.id === c.id)) { rec.leads.push(c); added++; } }
      });
      if (b.brief) rec.brief = cleanBrief(b.brief);
      if (b.title !== undefined) rec.title = S(b.title, 40).trim();
      await writeAnne(env, rec, "Leads refreshed: " + added + " new, " + merged + " updated"); return { ok: true, added, merged, rec };
    }
    case "archive": rec.archived = true; await writeAnne(env, rec, "Card retired"); return { ok: true, rec };
    case "unarchive": rec.archived = false; await writeAnne(env, rec, "Card restored"); return { ok: true, rec };
    default: return { error: "Unknown action.", status: 400 };
  }
}

export const ANNE_ICON = '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>';

const ANNE_CSS = '<style>.ah{color:#5F6B66;font-size:.8rem;margin:0 0 8px}.ac{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}.ac i{font-style:normal;background:#EAF2EC;color:#2F5D3F;border-radius:999px;padding:4px 10px;font-size:.74rem;font-weight:600}'
  + '.af{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.af button,.ab{border:1px solid #CFE0D2;background:#fff;color:#2F5D3F;border-radius:999px;padding:7px 12px;font:600 .8rem "IBM Plex Sans",sans-serif;cursor:pointer;text-decoration:none;display:inline-block}.af button.on,.ab.p{background:#2F5D3F;color:#fff;border-color:#2F5D3F}'
  + '.lc{background:#fff;border:1px solid #E3EBE4;border-radius:14px;padding:12px 14px;margin:0 0 10px}.lc h3{margin:0;font-size:1rem}.lc .sub{color:#5F6B66;font-size:.8rem;margin:2px 0 6px}.lc .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:.82rem;margin:6px 0}.lc .grid span{color:#5F6B66}'
  + '.lc .row{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.lc select,.lc textarea,.fm input,.fm select,.fm textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:10px;padding:8px;font:inherit;font-size:.85rem;background:#FFFDF6}.lc textarea{min-height:56px}'
  + '.st{font-size:.72rem;font-weight:700;border-radius:999px;padding:3px 9px;background:#F3F0E8;color:#5F6B66;display:inline-block}.st.Available,.st.Viewing{background:#2F5D3F;color:#fff}.st.Rejected,.st.Expired{background:#F0E3E1;color:#8A3B32}'
  + '.fm{background:#fff;border:1px solid #E3EBE4;border-radius:14px;padding:12px 14px;margin:12px 0}.fm label{display:block;font-size:.74rem;color:#5F6B66;margin:8px 0 2px}.lg{font-size:.78rem;color:#5F6B66;margin:6px 0 0}.fl{font-style:normal;font-size:.7rem;font-weight:600;border-radius:999px;padding:3px 9px;background:#FBF1DC;color:#7A5A12}.fl.mc{background:#F0E3E1;color:#8A3B32}.ag{border:1px dashed #D8D1C4;border-radius:14px;padding:18px;text-align:center;color:#5F6B66}</style>';

export const ANNE_BODY = ANNE_CSS + '<a class=back href="/momo" id=aback>&#8592; Momo</a><div class=tag>MOMO</div><h1 id=atitle>Client card</h1><p class=ah id=aupd></p><div class=ac id=abrief></div><div id=aarch></div><div class=af id=acom></div><div class=af id=asta></div><div id=alist></div>'
  + '<div class=fm><b>Add a lead</b><label>Property</label><input id=n_prop><label>Community</label><input id=n_com><label>Asking rent a year (AED)</label><input id=n_rent inputmode=numeric><label>Agent</label><input id=n_agent><label>Agency</label><input id=n_agency><label>Phone</label><input id=n_phone><label>Advert link</label><input id=n_url><div class=row style="margin-top:10px"><button class="ab p" id=n_add type=button>Add lead</button> <span class=ah id=n_msg></span></div></div>'
  + '<div class=fm><b>Recent changes</b><div id=alog class=lg></div><div class=row style="margin-top:10px"><button class=ab id=aret type=button>Retire this card</button></div></div>';

export const ANNE_JS = String.raw`(function(){var KEY=new URLSearchParams(location.search).get("key")||"",REC=null,FC="All",FS="All";
var $=function(i){return document.getElementById(i)};$("aback").href="/momo?door=1&key="+encodeURIComponent(KEY);
var STA=["New","Contacted","Available","Viewing booked","Viewed","Rejected","Expired"];
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function api(b){return fetch("/momo/work/anne/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()}).then(function(d){if(d.error)throw new Error(d.error);if(d.rec){REC=d.rec;draw()}return d})}
function digits(p){return String(p||"").replace(/[^0-9]/g,"")}
function fmt(n){return n?Number(n).toLocaleString("en"):""}
function link(href,txt,cls){var a=el("a",cls||"ab",txt);a.href=href;if(/^https?:/.test(href)){a.target="_blank";a.rel="noopener noreferrer"}return a}
function card(l){var c=el("div","lc");c.appendChild(el("h3","",l.property||l.community));
var sub=[l.community,l.ref?"Ref "+l.ref:"",l.portalRef?"Portal "+l.portalRef:""].filter(Boolean).join("  |  ");c.appendChild(el("div","sub",sub));
var g=el("div","grid");function kv(k,v){if(!v)return;var d=el("div","");d.appendChild(el("span","",k+" "));d.appendChild(document.createTextNode(v));g.appendChild(d)}
kv("Rent",l.rent?"AED "+fmt(l.rent)+" / yr":"");kv("Beds",l.beds);kv("Baths",l.baths);kv("Size",l.sizeSqft?fmt(l.sizeSqft)+" sq ft":"");kv("Furnished",l.furnished);kv("Dog",l.dog==="unknown"?"not confirmed":l.dog);kv("Agent",l.agent);kv("Agency",l.agency);kv("Broker card no.",l.brokerLicence);kv("Advert permit",l.trakheesi);c.appendChild(g);
var fl=(l.flags||[]).slice();var dl=l.listingUrl||(l.contactUrl&&l.contactUrl.indexOf("/agent/")>=0);if(!l.phone&&!l.email&&!dl)fl.unshift("Missing contact");if(fl.length){var fr=el("div","row");fl.forEach(function(f){fr.appendChild(el("i","fl"+(f==="Missing contact"?" mc":""),f))});c.appendChild(fr)}
if(l.verified)c.appendChild(el("div","lg","Link: "+l.verified));
if(l.phone){var pt=l.phoneType?" ("+l.phoneType+")":"";var r=el("div","row");r.appendChild(link("tel:"+l.phone.replace(/[^0-9+]/g,""),"Call "+l.phone+pt,"ab p"));if(digits(l.phone))r.appendChild(link("https://wa.me/"+digits(l.phone),"WhatsApp"));c.appendChild(r)}
var r2=el("div","row");if(l.email)r2.appendChild(link("mailto:"+l.email,"Email"));if(l.listingUrl)r2.appendChild(link(l.listingUrl,"Open advert"));if(l.contactUrl)r2.appendChild(link(l.contactUrl,"Agent page"));if(r2.childNodes.length)c.appendChild(r2);
if(l.verification)c.appendChild(el("div","lg",l.verification));
var s=el("select");STA.forEach(function(x){var o=el("option","",x);o.value=x;if(x===l.status)o.selected=true;s.appendChild(o)});s.onchange=function(){api({action:"set_status",id:l.id,status:s.value})};
var sw=el("div","row");sw.appendChild(s);c.appendChild(sw);
var ta=el("textarea");ta.value=l.notes||"";ta.placeholder="Notes: agent said, dog policy, viewing time";var sv=el("button","ab","Save notes");sv.type="button";sv.onclick=function(){api({action:"set_notes",id:l.id,notes:ta.value})};c.appendChild(ta);var r3=el("div","row");r3.appendChild(sv);var rm=el("button","ab","Remove");rm.type="button";rm.onclick=function(){if(confirm("Remove this lead?"))api({action:"delete_lead",id:l.id})};r3.appendChild(rm);c.appendChild(r3);return c}
function count(f){return REC.leads.filter(f).length}
function draw(){$("atitle").textContent=REC.title||"Client card";$("aupd").textContent=REC.updatedAt?"Updated "+REC.updatedAt.slice(0,10)+" "+REC.updatedAt.slice(11,16)+" UTC":"No leads yet";
var b=$("abrief");b.textContent="";var br=REC.brief||{};if(br.budgetMin||br.budgetMax)b.appendChild(el("i","","AED "+fmt(br.budgetMin)+" to "+fmt(br.budgetMax)+" / yr"));(br.chips||[]).forEach(function(x){b.appendChild(el("i","",x))});
var ar=$("aarch");ar.textContent="";if(REC.archived){var d=el("div","ag","This card is retired and hidden from the Momo front door. ");var bt=el("button","ab p","Restore it");bt.type="button";bt.onclick=function(){api({action:"unarchive"})};d.appendChild(bt);ar.appendChild(d)}
var coms=["All"];REC.leads.forEach(function(l){if(l.community&&coms.indexOf(l.community)<0)coms.push(l.community)});var cf=$("acom");cf.textContent="";coms.forEach(function(c){var x=el("button",c===FC?"on":"",c+" "+(c==="All"?REC.leads.length:count(function(l){return l.community===c})));x.type="button";x.onclick=function(){FC=c;draw()};cf.appendChild(x)});
var sf=$("asta");sf.textContent="";["All"].concat(STA).forEach(function(s){var n=s==="All"?REC.leads.length:count(function(l){return l.status===s});if(s!=="All"&&!n)return;var x=el("button",s===FS?"on":"",s+" "+n);x.type="button";x.onclick=function(){FS=s;draw()};sf.appendChild(x)});
var L=$("alist");L.textContent="";var ls=REC.leads.filter(function(l){return(FC==="All"||l.community===FC)&&(FS==="All"||l.status===FS)});if(!ls.length)L.appendChild(el("div","ag","No leads here yet."));ls.forEach(function(l){L.appendChild(card(l))});
var lg=$("alog");lg.textContent="";(REC.log||[]).slice(0,8).forEach(function(x){lg.appendChild(el("div","",x.at.slice(0,10)+": "+x.text))});$("aret").style.display=REC.archived?"none":""}
$("n_add").onclick=function(){var m=$("n_msg");api({action:"save_lead",lead:{property:$("n_prop").value,community:$("n_com").value,rent:$("n_rent").value,agent:$("n_agent").value,agency:$("n_agency").value,phone:$("n_phone").value,listingUrl:$("n_url").value}}).then(function(){["n_prop","n_com","n_rent","n_agent","n_agency","n_phone","n_url"].forEach(function(i){$(i).value=""});m.textContent="Added."}).catch(function(e){m.textContent=e.message})};
$("aret").onclick=function(){if(confirm("Retire this card? It disappears from the Momo front door; you can restore it from this page."))api({action:"archive"})};
fetch("/momo/work/anne/rec?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(d){REC=d.rec||{leads:[],brief:{},log:[]};draw()}).catch(function(){$("aupd").textContent="Could not load the card. Try again in a minute."})})();`;

export async function anneRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "kendall") return new Response("not found", { status: 404 });   // Kendall's key only
  if (p === "/momo/work/anne" && request.method === "GET") return new Response(deps.page(key, rk, ANNE_BODY + "<script>" + ANNE_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/anne/rec" && request.method === "GET") return J({ rec: (await readAnne(env)) || emptyAnne() });
  if (p === "/momo/work/anne/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await anneApi(env, b || {}); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  return new Response("not found", { status: 404 });
}
