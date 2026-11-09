// v819 (Kendall and Najjuko, 8 Nov 2026) - CAMPAIGN FOLLOW-UP GROUPS. Every person a campaign reached falls into exactly one group, worked out
// on the server from what is already stored, so Najjuko can follow up personally from her OWN WhatsApp:
//   started    tapped a button / answered part of the flow but never reached a handover or end node  -> warmest, shown first
//   opened     read the message, no tap, no reply
//   delivered  delivered, not opened
//   completed  reached a handover ("I will be in touch personally") or an end node; handovers are also in camp_handover_index
//   optout     opted out / Stop / forgotten: a COUNT only, never a name or number, never contacted
//   (not delivered: failed or still only "sent" - a count, nothing to follow up)
// Sources (read only): camp_msgs_<cid> -> camp_msg_<wamid> {d, read, delivered, st, replied, tap, optout}, camp_status_<wamid> {delivered, read, failed},
// camp_state_<cid>_<d> {path:["node.option"...], node, followed_node, at}, camp_handover_index, camp_optout_<d>, camp_contact_<d>.
// The only thing this writes is her own follow-up notes: camp_fu_<cid>_<d> = {contacted:[iso...], removed_at?, follow_on?, task?}
// and, when she sets "follow up on <date>", a Momo task through the v814 quick-task rules (action + what + for whom, start and due dates).
// The suggested message is only text she copies or opens in wa.me on her own phone: nothing here sends through the business number.
import { isOptedOut, audMask } from "./campaigns.js";

const DIG = (s) => String(s || "").replace(/[^0-9]/g, "");
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
const getJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
export const fuKey = (cid, d) => "camp_fu_" + cid + "_" + DIG(d);
export const GROUPS = [
  ["started", "Started but didn't finish", "Warmest: call or message them first"],
  ["opened", "Opened, no reply", "Read it but did not answer; a gentle nudge later"],
  ["delivered", "Delivered, not opened", "On their phone, not opened yet"],
  ["completed", "Completed", "Reached the end of the flow; call these"],
];

// The topic for the suggested message: the campaign's own topic, else its name before ":" without "owners" ("Palm Jebel Ali").
export function campTopic(c) { const t = String((c && (c.topic || c.name)) || "").split(":")[0].replace(/\s+owners?\b.*$/i, "").trim(); return t || "our"; }
const firstOf = (name) => String(name || "").trim().split(/\s+/)[0] || "";
// Kendall's wording, 8 Nov (started); the opened wording is the same voice without "clicked".
export function suggestedMessage(group, name, c) {
  const hi = "Hi" + (firstOf(name) ? " " + firstOf(name) : "") + ", this is Najjuko. ", topic = campTopic(c);
  if (group === "started") return hi + "I saw you clicked on our " + topic + " message but didn't get to finish. I just wanted to check whether there's anything of interest to you, or would you prefer I remove you completely?";
  if (group === "opened") return hi + "I sent you a message about " + topic + " recently. I just wanted to check whether there's anything of interest to you, or would you prefer I remove you completely?";
  return "";
}
export const waLink = (d, text) => "https://wa.me/" + DIG(d) + (text ? "?text=" + encodeURIComponent(text) : "");

// Where a person's flow stopped. Walks from state.node through the nodes that need no answer (text, doc, brief, handover), the way flowRun sends them.
// Returns {terminal, stoppedAt (node id), question (that node's text), answers [titles], optout}.
export function flowProgress(f, st) {
  const out = { terminal: false, stoppedAt: "", question: "", answers: [], optout: false, started: false };
  const path = (st && st.path) || []; if (!f || !f.nodes) return out;
  for (const t of path) { const [nid, oid] = String(t).split("."); const n = f.nodes[nid], o = n && (n.buttons || n.rows || []).find((x) => String(x.id) === oid);
    if (o) { out.answers.push(o.title); if (o.optout) out.optout = true; } }
  out.started = path.length > 0; if (!out.started) return out;
  const [ln, lo] = String(path[path.length - 1]).split("."), lnode = f.nodes[ln], lopt = lnode && (lnode.buttons || lnode.rows || []).find((x) => String(x.id) === lo);
  let cur = lopt ? lopt.next : st.node;
  if (lopt && !lopt.next) { out.terminal = !lopt.optout; return out; }
  for (let i = 0; cur && i < 10; i++) {
    const n = f.nodes[cur]; if (!n) { out.terminal = true; return out; }
    if (n.type === "handover" || n.type === "end") { out.terminal = true; out.stoppedAt = cur; return out; }
    if (n.buttons || n.rows || n.type === "template") { out.stoppedAt = cur; out.question = n.text || n.body || ""; return out; }
    if (!n.next) { out.terminal = true; out.stoppedAt = cur; return out; }
    cur = n.next;
  }
  return out;
}

// The groups for one campaign. Each person once (a campaign may hold an opener and a follow-up message for the same number).
export async function followupGroups(env, c, now) {
  now = now || Date.now();
  const f = c.flow ? await getJ(env, "camp_flow_" + c.flow, null) : null;
  const ho = (await getJ(env, "camp_handover_index", [])).filter((h) => h && h.cid === c.id && h.node);   // flow handovers only (not the "follow_up" flags)
  const hoD = new Set(ho.map((h) => h.d));
  const per = {}; let optout = 0, notDelivered = 0; const optoutD = [], notDeliveredD = [];   // v828 - the numbers too, so a parent can de-duplicate
  for (const w of await getJ(env, "camp_msgs_" + c.id, [])) {
    const m = await getJ(env, "camp_msg_" + w, null); if (!m || !m.d) continue;
    const s = await getJ(env, "camp_status_" + w, {}) || {};
    const p = per[m.d] || (per[m.d] = { d: m.d, delivered: false, read: false, failed: false, replied: false, tap: "", optout: false, at: "" });
    if (m.delivered || m.read || s.delivered || s.read || m.st === "delivered" || m.st === "read") p.delivered = true;
    if (m.read || s.read || m.st === "read") p.read = true;
    if (m.st === "failed" || s.failed) p.failed = true;
    if (m.replied) p.replied = true; if (m.tap) p.tap = typeof m.tap === "string" ? m.tap : p.tap || "tapped";
    if (m.optout) p.optout = true; if (m.optin) p.optin = true;   // v821 - they messaged first (wa.me opt-in)
    const at = String(s.read || s.delivered || m.at || ""); if (at > p.at) p.at = at;
  }
  const groups = { started: [], opened: [], delivered: [], completed: [] }, removed = [];
  for (const d of Object.keys(per)) {
    const p = per[d];
    if (/^h:/.test(d)) { optout++; optoutD.push(d); continue; }   // a forgotten person: the number is gone, only the opt-out counts
    if (p.optout || (await isOptedOut(env, d))) { optout++; optoutD.push(d); continue; }
    const st = await getJ(env, "camp_state_" + c.id + "_" + d, null), pr = flowProgress(f, st);
    if (pr.optout) { optout++; optoutD.push(d); continue; }
    let g = "";
    if (hoD.has(d) || (pr.started && pr.terminal)) g = "completed";
    else if (pr.started || p.replied || p.tap || p.optin) g = "started";   // v821 - an opt-in owner wrote to us first: warm even before a tap
    else if (p.read) g = "opened";
    else if (p.delivered) g = "delivered";
    else { notDelivered++; notDeliveredD.push(d); continue; }
    const k = await getJ(env, "camp_contact_" + d, null) || {}, fu = await getJ(env, fuKey(c.id, d), null) || {};
    const lastAt = String((st && st.at) || p.at || "");
    const row = { d, name: k.name || "", masked: audMask(k.e164 || d), full: "+" + DIG(k.e164 || d), group: g, answers: pr.answers,
      stoppedAt: pr.stoppedAt, question: pr.question, replied_text: !pr.started && p.replied, last_at: lastAt,
      contacted: (fu.contacted || [])[0] || "", follow_on: fu.follow_on || "", removed: !!fu.removed_at };
    row.message = suggestedMessage(g, row.name, c); row.wa = waLink(d, row.message);
    if (row.removed) removed.push(row); else groups[g].push(row);
  }
  for (const g of Object.keys(groups)) groups[g].sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
  const counts = { started: groups.started.length, opened: groups.opened.length, delivered: groups.delivered.length, completed: groups.completed.length, optout, not_delivered: notDelivered, removed: removed.length };
  return { groups, counts, removed, optoutD, notDeliveredD };
}

// The line on the campaign card: warm group first ("3 started but didn't finish · follow up").
export function followupLine(counts, href) {
  if (!counts) return "";
  const n = counts.started + counts.opened + counts.delivered + counts.completed + counts.optout; if (!n) return "";
  const chip = (v, lab, cls) => "<span class='fuc " + cls + "'><b>" + v + "</b> " + lab + "</span>";
  return "<style>" + FU_LINE_CSS + "</style><a class=fuw id=fu_link href='" + href + "'>" + (counts.started ? chip(counts.started, "started but didn't finish · follow up", "w") : "")
    + (counts.opened ? chip(counts.opened, "opened, no reply", "o") : "") + (counts.delivered ? chip(counts.delivered, "delivered, not opened", "o") : "")
    + (counts.completed ? chip(counts.completed, "completed", "o") : "") + (counts.optout ? chip(counts.optout, "opted out", "x") : "")
    + "<span class=fug>Follow-up groups &#8594;</span></a>";
}
export const FU_LINE_CSS = ".fuw{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0;padding:10px;border:1px solid #C5A56A;border-radius:12px;background:#FBF6EA;text-decoration:none;color:#1C2321}.fuc{font:500 .76rem 'IBM Plex Sans',sans-serif;border-radius:999px;padding:3px 9px;background:#fff;border:1px solid #E7E1D6}.fuc.w{background:#0A4F4A;color:#fff;border-color:#0A4F4A}.fuc.x{color:#5F6B66}.fug{width:100%;font:600 .8rem 'IBM Plex Sans',sans-serif;color:#0A4F4A}";

const ICON = { copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1 2 1-.5 1.5c-3 .5-7.5-4-7-7L10.5 8l1 2z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5.5 1 1 1.5 2 1.5 3 1-2 1.5-4.5 1.5-7.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>', inbox: '<path d="M3.5 13.5l2.5-8h12l2.5 8v5h-17z"/><path d="M3.5 13.5H9l1 2h4l1-2h5.5"/>', done: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>' };
const ic = (d, s) => '<svg viewBox="0 0 24 24" width=' + (s || 18) + ' height=' + (s || 18) + ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + '</svg>';
const GICON = { started: ICON.flame, opened: ICON.eye, delivered: ICON.inbox, completed: ICON.done };
const shortQ = (q) => { const s = String(q || "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim(); return s.length > 60 ? s.slice(0, 57).trimEnd() + "..." : s; };
export function pathText(r) {
  const a = r.answers.slice(); if (r.replied_text) a.push("replied in their own words");
  if (r.group === "started" && r.question) a.push("stopped at \u2018" + shortQ(r.question) + "\u2019");
  return a.join(" \u2192 ");
}
const dDate = (iso) => String(iso || "").slice(0, 10);

function personCard(r, cid) {
  cid = r.cid || cid;   // v828 - on a parent page each person belongs to the run that reached them furthest
  const warm = r.group === "started" || r.group === "opened";
  return "<div class='fp " + r.group + "' data-d='" + esc(r.d) + "' data-c='" + esc(cid) + "'><div class=fph><b>" + esc(r.name || "(no name)") + "</b>"
    + (r.contacted ? "<span class='chp ok'>Contacted " + esc(dDate(r.contacted)) + "</span>" : "") + (r.follow_on ? "<span class='chp no'>Follow up " + esc(r.follow_on) + "</span>" : "") + "</div>"
    + "<span class=n><span class=num data-full='" + esc(r.full) + "' data-mask='" + esc(r.masked) + "'>" + esc(r.masked) + "</span><button type=button class=shw>show</button></span>"
    + (pathText(r) ? "<div class=fpp><i>" + (r.group === "completed" ? "Their answers" : "Last step reached") + "</i>" + esc(pathText(r)) + "</div>" : "")
    + (r.last_at ? "<span class=m>Last activity " + esc(String(r.last_at).slice(0, 16).replace("T", " ")) + " UTC</span>" : "")
    + (warm && r.message ? "<div class=fpm><i>Suggested message, from your own WhatsApp</i><p class=msg>" + esc(r.message) + "</p></div>" : "")
    + "<div class=fpb>" + (warm && r.message ? "<button type=button class='fb cpy'>" + ic(ICON.copy) + "Copy message</button>" : "")
    + "<a class='fb wa' target=_blank rel=noopener href='" + esc(warm ? r.wa : waLink(r.d, "")) + "'>" + ic(ICON.wa) + "Open in WhatsApp</a>"
    + "<button type=button class='fb mc'>" + ic(ICON.check) + "Mark contacted</button><button type=button class='fb rm'>" + ic(ICON.x) + "Remove from list</button></div>"
    + "<div class=fpd><label>" + ic(ICON.cal) + "Follow up on <input type=date class=fdt value='" + esc(r.follow_on) + "'></label><button type=button class='fb fs'>Set</button></div></div>";
}
export async function followupBody(env, c, key, rk, now, toastJs, runs, title) {   // v828 - runs: every child run of the parent (de-duplicated per person)
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const { groups, counts, removed } = runs && runs.length > 1 ? await (await import("./camp_parents.js")).followupGroupsMulti(env, runs, now, followupGroups) : await followupGroups(env, c, now);
  const nav = "<div class=nav2><a class=back href='/momo/campaigns" + q + "&c=" + encodeURIComponent(c.id) + "'>&#8592; Campaign</a><a href='/momo" + q + "'>Home</a></div>";
  const tiles = GROUPS.map(([g, lab]) => "<a class='agc" + (g === "started" ? " warm" : "") + "' href='#g_" + g + "'>" + ic(GICON[g], 20) + "<b>" + counts[g] + "</b><i>" + esc(lab) + "</i></a>").join("")
    + "<div class='agc x'>" + ic(ICON.ban, 20) + "<b>" + counts.optout + "</b><i>Opted out: never contact</i></div>";
  const sec = GROUPS.map(([g, lab, sub]) => "<section class=fgs id='g_" + g + "'><h2>" + ic(GICON[g], 20) + esc(lab) + " <span>" + counts[g] + "</span></h2><p class=m>" + esc(sub) + "</p>"
    + (groups[g].length ? groups[g].map((r) => personCard(r, c.id)).join("") : "<p class='m nd'>Nobody here.</p>") + "</section>").join("");
  return nav + "<div class=tag>CAMPAIGN · FOLLOW-UP</div><h1>Follow-up groups</h1><p class=m style='margin:0 0 4px'>" + esc(title || c.name || c.id) + (runs && runs.length > 1 ? " · all " + runs.length + " runs, each person once" : "") + "</p>"
    + "<p class=m>Messages here go from your own WhatsApp, not the business number. Opted-out people are counted only and never shown." + (counts.not_delivered ? " " + counts.not_delivered + " did not receive the message (not delivered), so there is nothing to follow up." : "") + "</p>"
    + FU_CSS + "<div class=ag>" + tiles + "</div>" + sec
    + (removed.length ? "<details class=fgs><summary class=m>Removed from this list (" + removed.length + ")</summary>" + removed.map((r) => "<div class='fp x' data-d='" + esc(r.d) + "' data-c='" + esc(r.cid || c.id) + "'><b>" + esc(r.name || "(no name)") + "</b><span class=m>" + esc(r.masked) + "</span><button type=button class='fb rs'>Bring back</button></div>").join("") + "</details>" : "")
    + "<script>" + (toastJs || "") + "</script><script>" + FU_JS + "</script>";
}
const FU_CSS = "<style>.nav2{display:flex;gap:10px;margin:0 0 6px}.nav2 a{color:#0A4F4A;font-weight:600;text-decoration:none}.m{font:500 .8rem 'IBM Plex Sans',sans-serif;color:#5F6B66;margin:2px 0 8px}"
  + ".ag{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0 14px}.agc{display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:1px solid #E3DDD1;border-radius:14px;background:#FFFDF9;padding:10px;color:#0A4F4A;text-decoration:none;min-width:0}.agc b{font:600 1.35rem 'IBM Plex Sans',sans-serif}.agc i{font:500 .74rem 'IBM Plex Sans',sans-serif;color:#5F6B66;font-style:normal}.agc.warm{background:#0A4F4A;color:#fff;border-color:#C5A56A}.agc.warm i{color:#E8DCC0}.agc.x{grid-column:1/-1;flex-direction:row;align-items:center;gap:8px;color:#5F6B66}"
  + ".fgs{margin:0 0 14px}.fgs h2{display:flex;align-items:center;gap:6px;font:600 1rem Fraunces,serif;color:#0A4F4A;margin:0}.fgs h2 span{font:600 .72rem 'IBM Plex Mono',monospace;background:#F3EFE7;border-radius:99px;padding:2px 8px;color:#5F6B66}"
  + ".fgs,.fp,.fpm,.msg{max-width:100%;box-sizing:border-box}.fp{border:1px solid #E3DDD1;border-radius:14px;background:#FFFDF9;padding:12px;margin:8px 0;display:flex;flex-direction:column;gap:6px;min-width:0}.fp.started{border-color:#C5A56A;box-shadow:0 1px 0 #C5A56A}.fph{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.fph b{font:600 .98rem 'IBM Plex Sans',sans-serif;color:#0A4F4A;overflow-wrap:anywhere;margin-right:auto}"
  + ".n{font:500 .82rem 'IBM Plex Mono',monospace;color:#1C2321;display:flex;gap:8px;align-items:center}.n button{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:8px;padding:2px 8px;font:600 .72rem 'IBM Plex Sans',sans-serif}"
  + ".fpp,.fpm{font:500 .84rem 'IBM Plex Sans',sans-serif;color:#1C2321;overflow-wrap:anywhere}.fpp i,.fpm i{display:block;font-style:normal;font-size:.68rem;font-weight:600;color:#8A6F3E}.msg{margin:2px 0 0;padding:8px 10px;background:#F6F1E6;border-radius:10px;line-height:1.4}"
  + ".fpb{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.fb{display:flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #0A4F4A;border-radius:12px;padding:9px 8px;font:600 .8rem 'IBM Plex Sans',sans-serif;color:#0A4F4A;background:#fff;text-decoration:none;cursor:pointer;min-width:0;text-align:center;white-space:normal}.fb.wa{background:#0A4F4A;color:#fff}.fb.rm{border-color:#E3DDD1;color:#5F6B66}"
  + ".fpd{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.fpd label{display:flex;align-items:center;gap:6px;font:600 .8rem 'IBM Plex Sans',sans-serif;color:#0A4F4A;flex:1;min-width:0}.fpd input{border:1px solid #E3DDD1;border-radius:10px;padding:6px;font:inherit;min-width:0;width:0;flex:1}.fpd .fb{padding:7px 14px}"
  + ".chp{border-radius:99px;padding:2px 9px;font:600 .68rem 'IBM Plex Mono',monospace;background:#F3EFE7;color:#5F6B66}.chp.ok{background:#E6F2EC;color:#2F7D5B}.chp.no{background:#F6EEDC;color:#8A6F3E;border:1px solid #C5A56A}.fp.x{flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap}</style>";
const FU_JS = "(function(){function toast(t,o){if(window.momoToast)momoToast(t,o)}"
  + "document.querySelectorAll('.shw').forEach(function(b){b.onclick=function(){var s=b.previousSibling,on=s.textContent===s.getAttribute('data-full');s.textContent=on?s.getAttribute('data-mask'):s.getAttribute('data-full');b.textContent=on?'show':'hide'}});"
  + "function api(b){return fetch('/momo/campaigns/api'+location.search,{method:'POST',headers:{'Content-Type':'application/json','X-Momo-Confirm':'page'},body:JSON.stringify(b)}).then(function(r){return r.json()}).catch(function(){return{ok:false,error:'no connection'}})}"
  + "document.querySelectorAll('.fp').forEach(function(c){var d=c.getAttribute('data-d'),id=c.getAttribute('data-c'),nm=(c.querySelector('b')||{}).textContent||'';function q(s){return c.querySelector(s)}"
  + "if(q('.cpy'))q('.cpy').onclick=function(){var t=q('.msg').textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('Message copied')},function(){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');toast('Message copied')}catch(e){toast('Copy did not work: select the text',{error:true})}a.remove()})};"
  + "if(q('.mc'))q('.mc').onclick=function(){api({action:'fu_contacted',id:id,d:d}).then(function(j){if(!j.ok){toast('Not saved: '+j.error,{error:true});return}toast('Marked contacted: '+nm);setTimeout(function(){location.reload()},900)})};"
  + "if(q('.rm'))q('.rm').onclick=function(){api({action:'fu_remove',id:id,d:d}).then(function(j){if(!j.ok){toast('Not saved: '+j.error,{error:true});return}c.style.display='none';toast('Removed from the list: '+nm,{ms:5000,undo:function(){api({action:'fu_restore',id:id,d:d}).then(function(k){if(k.ok){c.style.display='';toast('Back on the list: '+nm)}})}})})};"
  + "if(q('.rs'))q('.rs').onclick=function(){api({action:'fu_restore',id:id,d:d}).then(function(j){if(j.ok){toast('Back on the list');setTimeout(function(){location.reload()},900)}})};"
  + "if(q('.fs'))q('.fs').onclick=function(){var v=q('.fdt').value;if(!v){toast('Pick a date first',{error:true});return}api({action:'fu_date',id:id,d:d,date:v}).then(function(j){if(!j.ok){toast('Not saved: '+j.error,{error:true});return}toast('Follow-up set for '+v+'; added to your tasks')})};"
  + "})})()";

// The POST actions (both viewers): fu_contacted / fu_remove / fu_restore / fu_date. The contact must be one this campaign messaged.
export async function followupAction(env, c, b, viewer, now) {
  const d = DIG(b.d); if (!d) return [400, { ok: false, error: "no contact" }];
  let mine = false; for (const w of await getJ(env, "camp_msgs_" + c.id, [])) { const m = await getJ(env, "camp_msg_" + w, null); if (m && m.d === d) { mine = true; break; } }
  if (!mine) return [404, { ok: false, error: "not in this campaign" }];
  const k = fuKey(c.id, d), fu = await getJ(env, k, null) || {}, at = new Date(now).toISOString(), by = viewer === "kendall" ? "Kendall" : "Najjuko";
  if (b.action === "fu_contacted") { fu.contacted = [at].concat(fu.contacted || []).slice(0, 20); fu.by = by; }
  else if (b.action === "fu_remove") fu.removed_at = at;
  else if (b.action === "fu_restore") delete fu.removed_at;
  else if (b.action === "fu_date") {
    const due = String(b.date || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return [400, { ok: false, error: "pick a date" }];
    const start = new Date(now + 4 * 3600e3).toISOString().slice(0, 10); if (due < start) return [400, { ok: false, error: "The date is in the past." }];
    const ct = await getJ(env, "camp_contact_" + d, null) || {};
    const text = "Call " + (ct.name || "owner") + " (\u2022\u2022\u2022 " + d.slice(-4) + ") back about the " + campTopic(c) + " campaign";
    const { quickTaskAdd } = await import("./work_log.js");   // v814 rules: action + what + for whom, start and due dates
    const [code, r] = await quickTaskAdd(env, { text, start, due }, [], { person: viewer === "kendall" ? "kendall" : "najjuko" });
    if (code !== 200 && code !== 409) return [code, { ok: false, error: r.error }];
    fu.follow_on = due; fu.task = text;
  } else return [400, { ok: false, error: "unknown action" }];
  await env.MEETINGS.put(k, JSON.stringify(fu)); return [200, { ok: true, followup: fu }];
}
