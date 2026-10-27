// v641 - MOMO - a TEMPORARY CLIENT CARD (Kendall, 27 Oct 2026: "a temporary card, easy to access and continually updated"). One record, annemarie_rec in KV: a short brief and a list of
// property leads (agent, phone, advert link, status, notes). v643: Najjuko's key only (personOfKey = "najjuko"); anyone else, Kendall included, gets "not found". The front door shows the card while the record exists and is
// not retired. THIS REPO IS PUBLIC: the client's name, the brief, every lead, name, number and link live in the KV record (loaded once by a script kept outside git, then edited on the page); the code
// holds only the shape, the limits and the page.
export const ANNE_KEY = "annemarie_rec";
// v654 - "Declined": the agent does not work with brokers. The lead is kept (never deleted) but drops out of the main list; Najjuko 27 Oct.
export const DECLINED = "Declined (doesn't work with brokers)";
export const STATUSES = ["New", "Contacted", "Available", "Viewing booked", "Viewed", "Rejected", "Expired", DECLINED];
export const GOOD = ["Contacted", "Available", "Viewing booked", "Viewed"];   // v654 - contact made and going well: the card is shaded light green
export const DOGS = ["unknown", "yes", "no"];
export const PHONE_TYPES = ["", "agent", "agency", "DLD business", "DLD registered", "portal line"];
// v644 - the three questions she asks every agent, each yes / no / unknown; and the WhatsApp wording (kept in the record, never in the repo).
export const ANSWERS = ["unknown", "yes", "no"];
export const QUESTIONS = [["available", "Available?"], ["furnishedOk", "Furnished as advertised?"], ["dogsOk", "Dogs allowed?"]];
export const DEFAULT_WA = "Hi {agent_first}, this is {broker_name} from {broker_agency}. I have a client interested in your listing {ref} ({property}, AED {rent}/yr). Is it still available, is it furnished as advertised, and are dogs allowed? Could we view it this week? Thank you.";
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
  QUESTIONS.forEach(([k]) => { if (has(k)) o[k] = ANSWERS.includes(g[k]) ? g[k] : "unknown"; else if (!ANSWERS.includes(o[k])) o[k] = "unknown"; });
  if (has("dog") && !has("dogsOk")) o.dogsOk = o.dog;   // v644 - the older dog field and the new question are one answer
  else if (!has("dogsOk") && o.dogsOk === "unknown" && o.dog && o.dog !== "unknown") o.dogsOk = o.dog;
  if (has("dogsOk")) o.dog = o.dogsOk;
  o.id = slug(g.id || o.id) || ("l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  return o;
}

export function cleanBrief(b) {
  const x = b && typeof b === "object" ? b : {};
  return { budgetMin: num(x.budgetMin), budgetMax: num(x.budgetMax), summary: S(x.summary, 400).trim(),
    chips: (Array.isArray(x.chips) ? x.chips : []).slice(0, 12).map((c) => S(c, 50).trim()).filter(Boolean),
    communities: (Array.isArray(x.communities) ? x.communities : []).slice(0, 8).map((c) => S(c, 50).trim()).filter(Boolean) };
}

export function cleanTpl(t) { const x = t && typeof t === "object" ? t : {}; return { whatsapp: S(x.whatsapp, 600).trim() || DEFAULT_WA, brokerName: S(x.brokerName, 60).trim(), brokerAgency: S(x.brokerAgency, 80).trim() }; }
export const emptyAnne = () => ({ v: 1, updatedAt: "", title: "", archived: false, brief: cleanBrief({}), tpl: cleanTpl({}), leads: [], log: [] });

// v644 - shared by the server (tests, register) and the page: their source is written into the page script, so both always agree. Self-contained on purpose.
export function waDigits(p, type) {   // a wa.me number, or "" when WhatsApp cannot reach it (portal call lines, UAE landlines)
  if (type === "portal line") return "";
  var d = String(p || "").replace(/[^0-9]/g, ""); if (d.indexOf("00") === 0) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = "971" + d.slice(1); else if (/^5\d{8}$/.test(d)) d = "971" + d;
  if (/^971/.test(d)) return /^9715\d{8}$/.test(d) ? d : "";
  return d.length >= 8 && d.length <= 15 && d[0] !== "0" ? d : "";
}
export function fillWa(tpl, l) {
  var t = (tpl && tpl.whatsapp) || "", n = l.rent ? Number(l.rent).toLocaleString("en") : "", a = String(l.agent || "").trim();
  var v = { agent_first: a.split(/\s+/)[0] || "there", agent: a || "there", ref: l.ref || l.portalRef || l.listingUrl || "", property: l.property || l.community || "", rent: n, community: l.community || "", broker_name: (tpl && tpl.brokerName) || "", broker_agency: (tpl && tpl.brokerAgency) || "" };
  return t.replace(/\{(agent_first|agent|ref|property|rent|community|broker_name|broker_agency)\}/g, function (m, k) { return v[k]; }).replace(/[ \t]{2,}/g, " ").replace(/ ([,.?])/g, "$1").trim();
}
export function bestRank(l) {   // lower comes first: available, then dogs, then furnishing; expired and rejected last
  if (l.status === "Expired" || l.status === "Rejected" || l.status === "Declined (doesn't work with brokers)") return 99;
  var y = function (v) { return v === "yes" ? 0 : v === "unknown" ? 1 : 2; };
  return y(l.available) * 9 + y(l.dogsOk) * 3 + y(l.furnishedOk);
}

export function cleanAnne(r) {
  const e = emptyAnne(), x = r && typeof r === "object" ? r : {};
  const seen = new Set(), leads = [];
  (Array.isArray(x.leads) ? x.leads : []).slice(0, MAX_LEADS).forEach((l) => { const c = cleanLead(l); c.updatedAt = S(l && l.updatedAt, 30); if (!seen.has(c.id)) { seen.add(c.id); leads.push(c); } });
  return Object.assign(e, { updatedAt: S(x.updatedAt, 30), title: S(x.title, 40).trim(), archived: !!x.archived, brief: cleanBrief(x.brief), tpl: cleanTpl(x.tpl), leads,
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
    case "set_answer": {   // v644 - one of the three questions, saved at once
      const i = find(b.id); if (i < 0) return { error: "No such lead.", status: 404 };
      if (!QUESTIONS.some(([k]) => k === b.q) || !ANSWERS.includes(b.v)) return { error: "Unknown answer.", status: 400 };
      rec.leads[i][b.q] = b.v; if (b.q === "dogsOk") rec.leads[i].dog = b.v; rec.leads[i].updatedAt = new Date().toISOString();
      await writeAnne(env, rec, (rec.leads[i].property || rec.leads[i].community) + ": " + QUESTIONS.find(([k]) => k === b.q)[1] + " " + b.v); return { ok: true, rec };
    }
    case "save_tpl": { rec.tpl = cleanTpl(b.tpl); await writeAnne(env, rec, "Message wording updated"); return { ok: true, rec }; }
    case "contacted": {   // v644 - she opened WhatsApp or copied the message: New becomes Contacted; the message itself is never stored
      const i = find(b.id); if (i < 0) return { error: "No such lead.", status: 404 };
      if (rec.leads[i].status === "New") rec.leads[i].status = "Contacted"; rec.leads[i].updatedAt = new Date().toISOString();
      await writeAnne(env, rec, (b.how === "copy" ? "Message copied: " : "WhatsApp opened: ") + (rec.leads[i].property || rec.leads[i].community)); return { ok: true, rec };
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
  + '.st{font-size:.72rem;font-weight:700;border-radius:999px;padding:3px 9px;background:#F3F0E8;color:#5F6B66;display:inline-block}.st.Available,.st.Viewing{background:#2F5D3F;color:#fff}.st.Rejected,.st.Expired{background:#F0E3E1;color:#8A3B32}.lc.good{background:#E8F5E9;border-color:#A5D6A7}.lc.decl{background:#FDECEA;border-color:#E57373;transition:opacity .6s}.lc.gone{opacity:0}.dl{display:block;margin:4px 0 12px;font-size:.8rem;color:#8A3B32;background:none;border:0;text-decoration:underline;cursor:pointer;padding:0}'
  + '.fm{background:#fff;border:1px solid #E3EBE4;border-radius:14px;padding:12px 14px;margin:12px 0}.fm label{display:block;font-size:.74rem;color:#5F6B66;margin:8px 0 2px}.lg{font-size:.78rem;color:#5F6B66;margin:6px 0 0}.fl{font-style:normal;font-size:.7rem;font-weight:600;border-radius:999px;padding:3px 9px;background:#FBF1DC;color:#7A5A12}.fl.mc{background:#F0E3E1;color:#8A3B32}.ag{border:1px dashed #D8D1C4;border-radius:14px;padding:18px;text-align:center;color:#5F6B66}.qa{display:flex;align-items:center;gap:4px;font-size:.76rem;color:#5F6B66;flex:1 1 140px}.lc .qa select{width:auto;padding:4px 6px;font-size:.78rem}.fm textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:10px;padding:8px;font:inherit;font-size:.85rem;background:#FFFDF6}</style>';

export const ANNE_BODY = ANNE_CSS + '<a class=back href="/momo" id=aback>&#8592; Momo</a><div class=tag>MOMO</div><h1 id=atitle>Client card</h1><p class=ah id=aupd></p><div class=ac id=abrief></div><div id=aarch></div><div class=af id=acom></div><div class=af id=asta></div><div id=alist></div>'
  + '<div class=fm><b>Add a lead</b><label>Property</label><input id=n_prop><label>Community</label><input id=n_com><label>Asking rent a year (AED)</label><input id=n_rent inputmode=numeric><label>Agent</label><input id=n_agent><label>Agency</label><input id=n_agency><label>Phone</label><input id=n_phone><label>Advert link</label><input id=n_url><div class=row style="margin-top:10px"><button class="ab p" id=n_add type=button>Add lead</button> <span class=ah id=n_msg></span></div></div>'
  + '<div class=fm><b>Message wording</b><p class=ah style="margin:4px 0 0">Used by WhatsApp the agent and Copy message on every lead. You press send yourself; nothing is sent from Momo. Placeholders: {agent_first} {agent} {ref} {property} {rent} {community} {broker_name} {broker_agency}.</p><label>Your name</label><input id=w_name><label>Your agency</label><input id=w_agency><label>Message</label><textarea id=w_text rows=5 maxlength=600></textarea><div class=row style="margin-top:10px"><button class="ab p" id=w_save type=button>Save wording</button> <span class=ah id=w_msg></span></div></div>'
  + '<div class=fm><b>Recent changes</b><div id=alog class=lg></div><div class=row style="margin-top:10px"><button class=ab id=aret type=button>Retire this card</button></div></div>'
  + '<div class=fm><b>Download</b><p class=ah style="margin:4px 0 8px">The register as a page you can save or print. It follows the filters picked above.</p><div class=row><a class="ab p" id=adl href="#" target=_blank rel=noopener>Download (HTML)</a> <a class=ab id=apdf href="#" target=_blank rel=noopener>Save as PDF</a></div></div>';

// v647 - wrangler's bundler wraps functions with __name(fn,"name"); embedding fn.toString() in the page carries that call, so the page must define __name or it throws before drawing (Speaking showed "Could not load", 27 Oct).
export const ANNE_JS = "var __name=function(f){return f};var waDigits=" + waDigits.toString() + ";var fillWa=" + fillWa.toString() + ";var bestRank=" + bestRank.toString() + ";" + String.raw`(function(){var KEY=new URLSearchParams(location.search).get("key")||"",REC=null,FC="All",FS="All",BEST=false;
var QS=[["available","Available?"],["furnishedOk","Furnished as advertised?"],["dogsOk","Dogs allowed?"]];
var $=function(i){return document.getElementById(i)};$("aback").href="/momo?door=1&key="+encodeURIComponent(KEY);
var STA=${JSON.stringify(STATUSES)},GOOD=${JSON.stringify(GOOD)},DECL=STA[STA.length-1],SHOWD=false;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function api(b){return fetch("/momo/work/anne/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()}).then(function(d){if(d.error)throw new Error(d.error);if(d.rec){REC=d.rec;draw()}return d})}
function digits(p){return String(p||"").replace(/[^0-9]/g,"")}
function fmt(n){return n?Number(n).toLocaleString("en"):""}
function link(href,txt,cls){var a=el("a",cls||"ab",txt);a.href=href;if(/^https?:/.test(href)){a.target="_blank";a.rel="noopener noreferrer"}return a}
function card(l){var c=el("div","lc"+(GOOD.indexOf(l.status)>=0?" good":l.status===DECL?" decl":""));c.appendChild(el("h3","",l.property||l.community));
var sub=[l.community,l.ref?"Ref "+l.ref:"",l.portalRef?"Portal "+l.portalRef:""].filter(Boolean).join("  |  ");c.appendChild(el("div","sub",sub));
var g=el("div","grid");function kv(k,v){if(!v)return;var d=el("div","");d.appendChild(el("span","",k+" "));d.appendChild(document.createTextNode(v));g.appendChild(d)}
kv("Rent",l.rent?"AED "+fmt(l.rent)+" / yr":"");kv("Beds",l.beds);kv("Baths",l.baths);kv("Size",l.sizeSqft?fmt(l.sizeSqft)+" sq ft":"");kv("Furnished",l.furnished);kv("Agent",l.agent);kv("Agency",l.agency);kv("Broker card no.",l.brokerLicence);kv("Advert permit",l.trakheesi);c.appendChild(g);
var fl=(l.flags||[]).slice();var dl=l.listingUrl||(l.contactUrl&&l.contactUrl.indexOf("/agent/")>=0);if(!l.phone&&!l.email&&!dl)fl.unshift("Missing contact");if(fl.length){var fr=el("div","row");fl.forEach(function(f){fr.appendChild(el("i","fl"+(f==="Missing contact"?" mc":""),f))});c.appendChild(fr)}
if(l.verified)c.appendChild(el("div","lg","Link: "+l.verified));
var msg=fillWa(REC.tpl||{},l);var r=el("div","row");if(l.phone){var pt=l.phoneType?" ("+l.phoneType+")":"";r.appendChild(link("tel:"+l.phone.replace(/[^0-9+]/g,""),"Call "+l.phone+pt,"ab p"));var wd=waDigits(l.phone,l.phoneType);if(wd){var wa=link("https://wa.me/"+wd+"?text="+encodeURIComponent(msg),"WhatsApp the agent");wa.onclick=function(){api({action:"contacted",id:l.id,how:"whatsapp"}).catch(function(){})};r.appendChild(wa)}}
var cp=el("button","ab","Copy message");cp.type="button";cp.onclick=function(){var done=function(){cp.textContent="Copied";api({action:"contacted",id:l.id,how:"copy"}).catch(function(){})};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(msg).then(done,function(){window.prompt("Copy the message:",msg);done()});else{window.prompt("Copy the message:",msg);done()}};r.appendChild(cp);c.appendChild(r);
var qa=el("div","row");QS.forEach(function(q){var w=el("label","qa");w.appendChild(el("span","",q[1]+" "));var s2=el("select","qs");[["unknown","Unknown"],["yes","Yes"],["no","No"]].forEach(function(o){var x=el("option","",o[1]);x.value=o[0];if((l[q[0]]||"unknown")===o[0])x.selected=true;s2.appendChild(x)});s2.onchange=function(){api({action:"set_answer",id:l.id,q:q[0],v:s2.value})};w.appendChild(s2);qa.appendChild(w)});c.appendChild(qa);
var r2=el("div","row");if(l.email)r2.appendChild(link("mailto:"+l.email,"Email"));if(l.listingUrl)r2.appendChild(link(l.listingUrl,"Open advert"));if(l.contactUrl)r2.appendChild(link(l.contactUrl,"Agent page"));if(r2.childNodes.length)c.appendChild(r2);
if(l.verification)c.appendChild(el("div","lg",l.verification));
var s=el("select");STA.forEach(function(x){var o=el("option","",x);o.value=x;if(x===l.status)o.selected=true;s.appendChild(o)});s.onchange=function(){api({action:"set_status",id:l.id,status:s.value})};
var sw=el("div","row");sw.appendChild(s);if(l.status!==DECL){var dc=el("button","ab","Declined");dc.type="button";dc.title="They do not work with brokers";dc.onclick=function(){c.className="lc decl";setTimeout(function(){c.className="lc decl gone"},700);setTimeout(function(){api({action:"set_status",id:l.id,status:DECL}).catch(function(e){alert(e.message)})},1300)};sw.appendChild(dc)}else{var ud=el("button","ab","Undo declined");ud.type="button";ud.onclick=function(){api({action:"set_status",id:l.id,status:"Contacted"})};sw.appendChild(ud)}c.appendChild(sw);
var ta=el("textarea");ta.value=l.notes||"";ta.placeholder="Notes: agent said, dog policy, viewing time";var sv=el("button","ab","Save notes");sv.type="button";sv.onclick=function(){api({action:"set_notes",id:l.id,notes:ta.value})};c.appendChild(ta);var r3=el("div","row");r3.appendChild(sv);var rm=el("button","ab","Remove");rm.type="button";rm.onclick=function(){if(confirm("Remove this lead?"))api({action:"delete_lead",id:l.id})};r3.appendChild(rm);c.appendChild(r3);return c}
function count(f){return REC.leads.filter(f).length}
function draw(){$("atitle").textContent=REC.title||"Client card";$("aupd").textContent=REC.updatedAt?"Updated "+REC.updatedAt.slice(0,10)+" "+REC.updatedAt.slice(11,16)+" UTC":"No leads yet";
var b=$("abrief");b.textContent="";var br=REC.brief||{};if(br.budgetMin||br.budgetMax)b.appendChild(el("i","","AED "+fmt(br.budgetMin)+" to "+fmt(br.budgetMax)+" / yr"));(br.chips||[]).forEach(function(x){b.appendChild(el("i","",x))});
var ar=$("aarch");ar.textContent="";if(REC.archived){var d=el("div","ag","This card is retired and hidden from the Momo front door. ");var bt=el("button","ab p","Restore it");bt.type="button";bt.onclick=function(){api({action:"unarchive"})};d.appendChild(bt);ar.appendChild(d)}
var coms=["All"];REC.leads.forEach(function(l){if(l.community&&coms.indexOf(l.community)<0)coms.push(l.community)});var cf=$("acom");cf.textContent="";coms.forEach(function(c){var x=el("button",c===FC?"on":"",c+" "+(c==="All"?REC.leads.length:count(function(l){return l.community===c})));x.type="button";x.onclick=function(){FC=c;draw()};cf.appendChild(x)});
var sf=$("asta");sf.textContent="";["All"].concat(STA.filter(function(x){return x!==DECL})).forEach(function(s){var n=s==="All"?count(function(l){return l.status!==DECL}):count(function(l){return l.status===s});if(s!=="All"&&!n)return;var x=el("button",s===FS?"on":"",s+" "+n);x.type="button";x.onclick=function(){FS=s;draw()};sf.appendChild(x)});
var bb=el("button",BEST?"on":"","Best first");bb.type="button";bb.onclick=function(){BEST=!BEST;draw()};sf.appendChild(bb);
var L=$("alist");L.textContent="";var ls=REC.leads.filter(function(l){return(FC==="All"||l.community===FC)&&(SHOWD?l.status===DECL:l.status!==DECL&&(FS==="All"||l.status===FS))});if(BEST)ls=ls.map(function(l,i){return[bestRank(l),i,l]}).sort(function(a,b){return a[0]-b[0]||a[1]-b[1]}).map(function(x){return x[2]});
var tp=REC.tpl||{};$("w_name").value=tp.brokerName||"";$("w_agency").value=tp.brokerAgency||"";if(document.activeElement!==$("w_text"))$("w_text").value=tp.whatsapp||"";if(!ls.length)L.appendChild(el("div","ag","No leads here yet."));ls.forEach(function(l){L.appendChild(card(l))});var nd=count(function(l){return l.status===DECL});if(nd||SHOWD){var dv=el("button","dl",SHOWD?"Back to the list":"Declined ("+nd+")");dv.type="button";dv.onclick=function(){SHOWD=!SHOWD;draw()};L.appendChild(dv)}
var qs="?key="+encodeURIComponent(KEY)+(SHOWD?"&status="+encodeURIComponent(DECL):FS!=="All"?"&status="+encodeURIComponent(FS):"")+(FC!=="All"?"&community="+encodeURIComponent(FC):"");$("adl").href="/momo/work/anne/report"+qs;$("apdf").href="/momo/work/anne/report"+qs+"&print=1";
var lg=$("alog");lg.textContent="";(REC.log||[]).slice(0,8).forEach(function(x){lg.appendChild(el("div","",x.at.slice(0,10)+": "+x.text))});$("aret").style.display=REC.archived?"none":""}
$("n_add").onclick=function(){var m=$("n_msg");api({action:"save_lead",lead:{property:$("n_prop").value,community:$("n_com").value,rent:$("n_rent").value,agent:$("n_agent").value,agency:$("n_agency").value,phone:$("n_phone").value,listingUrl:$("n_url").value}}).then(function(){["n_prop","n_com","n_rent","n_agent","n_agency","n_phone","n_url"].forEach(function(i){$(i).value=""});m.textContent="Added."}).catch(function(e){m.textContent=e.message})};
$("w_save").onclick=function(){var m=$("w_msg");api({action:"save_tpl",tpl:{whatsapp:$("w_text").value,brokerName:$("w_name").value,brokerAgency:$("w_agency").value}}).then(function(){m.textContent="Saved."}).catch(function(e){m.textContent=e.message})};
$("aret").onclick=function(){if(confirm("Retire this card? It disappears from the Momo front door; you can restore it from this page."))api({action:"archive"})};
fetch("/momo/work/anne/rec?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(d){REC=d.rec||{leads:[],brief:{},log:[]};draw()}).catch(function(){$("aupd").textContent="Could not load the card. Try again in a minute."})})();`;


// v642 - the card as a printable register (Kendall: "downloadable as PDF or HTML"). Server-rendered from the record, grouped by community; ?status= and ?community= narrow it; ?print=1 opens the print dialog.
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => (n ? Number(n).toLocaleString("en") : "");
const RI = (d) => '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
const RICON = { phone: RI('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'), mail: RI('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'), link: RI('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'), home: RI(ANNE_ICON) };
const REPORT_CSS = '@page{size:A4 portrait;margin:14mm}body{margin:0;background:#FAF7F1;color:#1C2321;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:12.5px;padding:20px 16px 40px}.w{max-width:760px;margin:0 auto}'
  + '.tag{font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.14em;color:#8A6F3E;font-weight:600}h1{font-family:Georgia,serif;font-weight:600;font-size:1.6rem;margin:4px 0 6px;color:#0A4F4A}h2{font-size:1.05rem;color:#2F5D3F;margin:18px 0 8px;border-bottom:1px solid #CFE0D2;padding-bottom:4px;display:flex;align-items:center;gap:6px}h2 small{color:#5F6B66;font-weight:400}'
  + '.sub{color:#5F6B66;margin:0 0 6px}.chips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}.chips i,.flags i{font-style:normal;background:#EAF2EC;color:#2F5D3F;border-radius:999px;padding:3px 9px;font-size:.72rem;font-weight:600}.flags i{background:#FBF1DC;color:#7A5A12}'
  + '.lead{background:#fff;border:1px solid #E3EBE4;border-radius:12px;padding:10px 12px;margin:0 0 8px;page-break-inside:avoid;break-inside:avoid}.lead h3{margin:0 0 4px;font-size:1rem;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.lead h3 small{color:#5F6B66;font-weight:400;font-size:.78rem}.st{margin-left:auto;font-style:normal;font-size:.7rem;font-weight:700;border-radius:999px;padding:2px 8px;background:#F3F0E8;color:#5F6B66}'
  + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px}.grid div span{color:#5F6B66;margin-right:4px}.links{display:flex;gap:12px;flex-wrap:wrap;margin:6px 0 2px}.links a{color:#2F5D3F;text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-weight:600}.flags{display:flex;gap:5px;flex-wrap:wrap;margin:5px 0}.vf,.nt{margin:4px 0 0;color:#5F6B66;font-size:.78rem}'
  + '.bar{display:flex;gap:8px;margin:0 0 14px}.bar button,.bar a{border:1px solid #2F5D3F;background:#2F5D3F;color:#fff;border-radius:999px;padding:8px 14px;font:600 .82rem "IBM Plex Sans",Arial,sans-serif;cursor:pointer;text-decoration:none}.bar a{background:#fff;color:#2F5D3F}footer{margin-top:18px;padding-top:8px;border-top:1px solid #CFE0D2;color:#5F6B66;font-size:.76rem}'
  + '@media print{.bar{display:none}body{background:#fff;padding:0}.lead{border-color:#CFE0D2}}';
export function anneReport(rec, q) {
  const st = q && STATUSES.includes(q.status) ? q.status : "", cm = q && q.community ? S(q.community, 60) : "";
  const leads = rec.leads.filter((l) => (st ? l.status === st : l.status !== DECLINED) && (!cm || l.community === cm));
  const groups = []; leads.forEach((l) => { let g = groups.find((x) => x.name === (l.community || "Other")); if (!g) { g = { name: l.community || "Other", leads: [] }; groups.push(g); } g.leads.push(l); });
  const b = rec.brief || {}, upd = rec.updatedAt ? rec.updatedAt.slice(0, 10) : "";
  const row = (k, v) => (v ? "<div><span>" + k + "</span>" + v + "</div>" : "");
  const lead = (l) => {
    const tel = l.phone ? '<a href="tel:' + esc(l.phone.replace(/[^0-9+]/g, "")) + '">' + RICON.phone + " " + esc(l.phone) + (l.phoneType ? " (" + esc(l.phoneType) + ")" : "") + "</a>" : "";
    const mail = l.email ? '<a href="mailto:' + esc(l.email) + '">' + RICON.mail + " " + esc(l.email) + "</a>" : "";
    const adv = l.listingUrl ? '<a href="' + esc(l.listingUrl) + '">' + RICON.link + " Advert</a>" : "", ag = l.contactUrl ? '<a href="' + esc(l.contactUrl) + '">' + RICON.link + " Agent page</a>" : "";
    const fl = (l.flags || []).concat(!l.phone && !l.email && !l.listingUrl && !(l.contactUrl && l.contactUrl.indexOf("/agent/") >= 0) ? ["Missing contact"] : []);
    return '<section class=lead><h3>' + esc(l.property || l.community) + " <small>" + esc([l.ref ? "Ref " + l.ref : "", l.portalRef ? "Portal " + l.portalRef : "", l.trakheesi ? "Permit " + l.trakheesi : ""].filter(Boolean).join("  |  ")) + "</small><em class=st>" + esc(l.status) + "</em></h3>"
      + "<div class=grid>" + row("Rent", l.rent ? "AED " + fmtN(l.rent) + " / yr" : "") + row("Beds / baths", esc([l.beds, l.baths].filter(Boolean).join(" / "))) + row("Size", l.sizeSqft ? fmtN(l.sizeSqft) + " sq ft" : "") + row("Furnished", esc(l.furnished))
      + QUESTIONS.map(([k, q]) => row(q, esc((l[k] || "unknown") === "unknown" ? "not confirmed" : l[k]))).join("") + row("Agent", esc(l.agent)) + row("Agency", esc(l.agency)) + row("Broker card", esc(l.brokerLicence)) + "</div>"
      + (tel || mail || adv || ag ? "<div class=links>" + [tel, mail, adv, ag].filter(Boolean).join(" ") + "</div>" : "")
      + (fl.length ? "<div class=flags>" + fl.map((f) => "<i>" + esc(f) + "</i>").join("") + "</div>" : "")
      + (l.verification ? "<p class=vf>" + esc(l.verification) + "</p>" : "") + (l.notes ? "<p class=nt>" + esc(l.notes).replace(/\n/g, "<br>") + "</p>" : "") + "</section>";
  };
  const body = "<header><div class=tag>NAJMA / CLIENT REGISTER</div><h1>" + esc(rec.title || "Client card") + "</h1>"
    + "<p class=sub>" + (upd ? "Updated " + esc(upd) + ". " : "") + leads.length + " lead" + (leads.length === 1 ? "" : "s") + (st ? ", status " + esc(st) : "") + (cm ? ", " + esc(cm) : "") + "</p>"
    + ((b.budgetMin || b.budgetMax) || (b.chips || []).length ? "<div class=chips>" + ((b.budgetMin || b.budgetMax) ? "<i>AED " + fmtN(b.budgetMin) + " to " + fmtN(b.budgetMax) + " / yr</i>" : "") + (b.chips || []).map((c) => "<i>" + esc(c) + "</i>").join("") + "</div>" : "")
    + (b.summary ? "<p class=sub>" + esc(b.summary) + "</p>" : "") + "</header>"
    + (groups.length ? groups.map((g) => "<h2>" + RICON.home + " " + esc(g.name) + " <small>" + g.leads.length + "</small></h2>" + g.leads.map(lead).join("")).join("") : "<p class=sub>No leads match.</p>")
    + "<footer>Advertised leads, not confirmed availability. Rents are as advertised; agent, furnishing, pet policy and viewing must be confirmed before travel.</footer>";
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + esc(rec.title || "Client card") + " register</title><style>" + REPORT_CSS + "</style></head><body><div class=w>"
    + '<div class=bar><button type=button onclick="window.print()">Save as PDF</button><a href="javascript:history.back()">Back</a></div>' + body
    + '</div><script>if(/[?&]print=1/.test(location.search))setTimeout(function(){window.print()},400)</script></body></html>';
}

export async function anneRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "najjuko") return new Response("not found", { status: 404 });   // v643 - Najjuko's key only (Kendall 27 Oct: "the Anne-Marie was for Najjuko, not for me")
  if (p === "/momo/work/anne" && request.method === "GET") return new Response(deps.page(key, rk, ANNE_BODY + "<script>" + ANNE_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/anne/report" && request.method === "GET") return new Response(anneReport((await readAnne(env)) || emptyAnne(), { status: url.searchParams.get("status") || "", community: url.searchParams.get("community") || "" }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (p === "/momo/work/anne/rec" && request.method === "GET") return J({ rec: (await readAnne(env)) || emptyAnne() });
  if (p === "/momo/work/anne/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await anneApi(env, b || {}); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  return new Response("not found", { status: 404 });
}
