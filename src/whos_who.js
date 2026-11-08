// v814 "WHO'S WHO?" (Najjuko 8 Nov) - after a recording is read, she names its speakers (Speaker A, B, C...) from her organogram in one card.
// Each speaker: 2-3 sample lines, a picker (her organogram people, "Me (Najjuko)", "Guest: type name", "Not sure"), and a SUGGESTED name read from what
// was said ("Thanks, Liam" just before that speaker talks; "I'm Liam"), never applied by itself. On Save: m.speakers groups get the names (the transcript
// shows them at once, through work_speakers.speakerName), m.speaker_map keeps her choices, "Speaker X" in the summary / minutes / draft tasks becomes the
// name, the draft tasks get their owners, and the summary and minutes are queued to be written again with the names (m.regen_names, done by the sweep).
// Voice hints: the audio is not kept after it is read, so there is no voiceprint; the cheap hint is a count of names she confirmed (rec_speaker_hints),
// used to order the picker so her usual people come first. No transcript text is logged.
import { partLabel } from "./work_speakers.js";

export const HINTS_KEY = "rec_speaker_hints";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const first = (n) => String(n || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0];

// utterances in order: [{ g: group id, x: text }]
export function utterances(m, segs) {
  const gOf = {}; for (const g of (m.speakers && m.speakers.groups) || []) for (const l of g.labels || []) gOf[l] = g.id;
  const out = []; for (const s of segs || []) for (const u of Array.isArray(s.utts) ? s.utts : []) out.push({ g: gOf[partLabel(s.n, u.s)] || "", x: String(u.x || "") });
  return out;
}
export function samples(m, segs, k) {
  const by = {}; for (const u of utterances(m, segs)) { if (!u.g || u.x.split(/\s+/).length < 4) continue; (by[u.g] = by[u.g] || []).push(u.x.length > 140 ? u.x.slice(0, 137) + "..." : u.x); }
  for (const g of Object.keys(by)) by[g] = by[g].slice(0, k || 3); return by;
}
// suggestions from what was said: the name used just before a speaker talks ("Thanks, Liam", "Liam, can you...") or a self-introduction ("I'm Liam")
export function suggest(m, segs, roster) {
  const names = (roster || []).map((n) => [first(n).toLowerCase(), n]).filter((x) => x[0].length > 2), votes = {}, us = utterances(m, segs);
  const vote = (g, n) => { if (!g) return; votes[g] = votes[g] || {}; votes[g][n] = (votes[g][n] || 0) + 1; };
  for (let i = 0; i < us.length; i++) {
    const t = us[i].x, lt = t.toLowerCase();
    for (const [f, full] of names) {
      if (new RegExp("\\b(i'm|i am|this is|my name is)\\s+" + f + "\\b").test(lt)) vote(us[i].g, full);
      const addressed = new RegExp("(\\b(thanks|thank you|over to you|go ahead|yes|okay|ok|hi|hello)\\s*,?\\s+" + f + "\\b)|(^" + f + "\\s*,)").test(lt);
      if (addressed && us[i + 1] && us[i + 1].g && us[i + 1].g !== us[i].g) vote(us[i + 1].g, full);
    }
  }
  const out = {}; for (const g of Object.keys(votes)) out[g] = Object.entries(votes[g]).sort((a, b) => b[1] - a[1])[0][0];
  return out;
}
// her choices -> the record. map: { A: { kind: "person"|"me"|"guest"|"unsure", name } }
export function applyWho(m, map, rosterNames) {
  const groups = (m.speakers && m.speakers.groups) || [], changes = [];
  for (const g of groups) {
    const c = map && map[g.id]; if (!c) continue;
    const name = c.kind === "me" ? "Najjuko" : c.kind === "person" && (rosterNames || []).includes(c.name) ? c.name : c.kind === "guest" ? String(c.name || "").replace(/\s+/g, " ").trim().slice(0, 60) : "";
    if (!name) { g.name = ""; g.confirmed = false; continue; }
    if (g.name !== name) changes.push(["Speaker " + g.id, name]);
    g.name = name; g.confirmed = true; g.confidence = 1;
  }
  m.speaker_map = Object.assign({}, m.speaker_map || {}, map || {}); m.speaker_map_at = new Date().toISOString();
  if (changes.length) m.regen_names = true;
  return changes;
}
// the card: on the meeting page and from the Work home
export function whoWhoHtml(m, segs, roster, hints, key) {
  const groups = (m.speakers && m.speakers.groups) || []; if (!groups.length) return "";
  const sm = samples(m, segs, 3), sg = suggest(m, segs, roster), h = hints || {};
  const ordered = (roster || []).slice().sort((a, b) => (h[b] || 0) - (h[a] || 0) || (a < b ? -1 : 1));
  const opts = (cur) => "<option value=''>Choose…</option><option value='me:'" + (cur === "Najjuko" ? " selected" : "") + ">Me (Najjuko)</option>"
    + ordered.filter((n) => n !== "Najjuko").map((n) => "<option value='person:" + esc(n) + "'" + (cur === n ? " selected" : "") + ">" + esc(n) + "</option>").join("")
    + "<option value='guest:'" + (cur && !ordered.includes(cur) && cur !== "Najjuko" ? " selected" : "") + ">Guest: type name</option><option value='unsure:'>Not sure</option>";
  const named = groups.filter((g) => g.confirmed && g.name).length;
  return "<div class=sf id=whowho><h3>Who's who?</h3><p class=m style='margin:0 0 8px'>" + (named === groups.length ? "Everyone is named. You can change it." : "Name each voice so the transcript, the summary, the minutes and the tasks use real names.") + "</p>"
    + groups.map((g) => "<div class=wwr data-g='" + esc(g.id) + "' style='border-top:1px solid #EFE6D6;padding:10px 0'><b>Speaker " + esc(g.id) + (g.confirmed && g.name ? " · " + esc(g.name) : "") + "</b>"
      + (sm[g.id] || []).map((x) => "<p class=m style='margin:4px 0;font-style:italic'>“" + esc(x) + "”</p>").join("")
      + (sg[g.id] && !(g.confirmed && g.name) ? "<p style='margin:4px 0;font-size:.82rem;color:#8A6F3E'>Sounds like " + esc(sg[g.id]) + "? <button type=button class=wsug data-n='" + esc(sg[g.id]) + "' style='border:1px solid #C5A56A;background:#F6EEDC;color:#8A6F3E;border-radius:99px;padding:2px 10px;font:600 .74rem IBM Plex Sans,sans-serif'>Use this</button></p>" : "")
      + "<select class=wsel style='width:100%;box-sizing:border-box;margin-top:6px;padding:8px;border:1px solid #E3DDD1;border-radius:10px;font:500 .9rem IBM Plex Sans,sans-serif;background:#fff'>" + opts(g.confirmed ? g.name : "") + "</select>"
      + "<input class=wguest placeholder='Guest name' value='" + esc(g.confirmed && g.name && !ordered.includes(g.name) && g.name !== "Najjuko" ? g.name : "") + "' style='display:none;width:100%;box-sizing:border-box;margin-top:6px;padding:8px;border:1px solid #E3DDD1;border-radius:10px'></div>").join("")
    + "<button type=button id=wwsave style='width:100%;border:0;border-radius:12px;padding:12px;background:#0A4F4A;color:#fff;font:600 .95rem IBM Plex Sans,sans-serif;margin-top:8px'>Save names</button></div>"
    + "<script>(function(){var W=document.getElementById('whowho');if(!W)return;var K=new URLSearchParams(location.search),ID=K.get('id')||" + JSON.stringify(m.id) + ",KY=K.get('key')||" + JSON.stringify(key || "") + ";"
    + "W.querySelectorAll('.wwr').forEach(function(r){var s=r.querySelector('.wsel'),gi=r.querySelector('.wguest');var sh=function(){gi.style.display=s.value==='guest:'?'block':'none'};s.onchange=sh;sh();var b=r.querySelector('.wsug');if(b)b.onclick=function(){s.value='person:'+b.getAttribute('data-n');sh()}});"
    + "document.getElementById('wwsave').onclick=function(){var map={};W.querySelectorAll('.wwr').forEach(function(r){var v=r.querySelector('.wsel').value;if(!v)return;var i=v.indexOf(':'),k=v.slice(0,i),n=v.slice(i+1);if(k==='guest')n=r.querySelector('.wguest').value.trim();map[r.getAttribute('data-g')]={kind:k,name:n}});"
    + "var b=this;b.disabled=true;b.textContent='Saving…';fetch('/momo/work/rec/api?key='+encodeURIComponent(KY),{method:'POST',headers:{'Content-Type':'application/json','X-Momo-Confirm':'page'},body:JSON.stringify({action:'who',id:ID,map:map})}).then(function(r){return r.json()}).then(function(j){if(j&&j.ok){if(window.momoToast)momoToast('Names saved. The summary and minutes are being written again with them.');setTimeout(function(){location.reload()},1500)}else{b.disabled=false;b.textContent='Save names';if(window.momoToast)momoToast('Not saved: '+((j&&j.error)||'try again'),{error:true})}}).catch(function(){b.disabled=false;b.textContent='Save names';if(window.momoToast)momoToast('Not saved: no connection',{error:true})})}})()</script>";
}
