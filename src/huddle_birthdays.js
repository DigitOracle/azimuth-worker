// v815 BIRTHDAYS INTO THE HUDDLE (Kendall 8 Nov). KV hud_birthdays = [{ name, md: "MM-DD", removed?, removed_at? }] for FN Realty staff. NO YEARS: no year is
// stored or shown, so no age ever appears. Birthdays are HR data (UAE PDPL): they live only in this list and inside her own huddle card; never in a log,
// a report or a test fixture with real names. The Celebrations section lists the birthdays in the huddle week (Mon-Sun) plus the ones missed since the
// previous huddle, pre-accepted as a Momo draft; she can untick any name. Names show as the organogram's first name when the person is on it.
// Remove is soft (removed:true, kept in KV; Undo restores).
export const BDAY_KEY = "hud_birthdays";
const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const okMd = (md) => { const m = /^(\d{2})-(\d{2})$/.exec(String(md || "")); if (!m) return false; const mo = +m[1], d = +m[2]; return mo >= 1 && mo <= 12 && d >= 1 && d <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]; };
export async function readBirthdays(env) { try { const l = JSON.parse(await env.MEETINGS.get(BDAY_KEY)); return Array.isArray(l) ? l.filter((x) => x && x.name && okMd(x.md)) : []; } catch (e) { return []; } }
async function save(env, l) { await env.MEETINGS.put(BDAY_KEY, JSON.stringify(l)); }
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
// the date in a given year a birthday falls on (29 Feb -> 28 Feb in a non-leap year)
const onYear = (md, y) => (md === "02-29" && !leap(y) ? y + "-02-28" : y + "-" + md);
export const niceDay = (d) => DOW[new Date(d + "T00:00:00Z").getUTCDay()] + " " + Number(d.slice(8)) + " " + MON[Number(d.slice(5, 7)) - 1];
export function inRange(md, from, to) {   // from/to inclusive, YYYY-MM-DD, may cross the new year
  for (const y of new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])) { const d = onYear(md, y); if (d >= from && d <= to) return d; }
  return "";
}
// first name as she knows them: the organogram name when the person is on it
export function shownName(name, people, match) { const hit = match ? match(name, people) : "", nick = (/\(([^)]+)\)/.exec(hit || "") || [])[1]; return nick || String(hit || name).replace(/\(.*?\)/g, "").trim().split(/\s+/)[0]; }   // the name she uses: the organogram nickname, else the first name
// the huddle's birthdays: this week (Mon-Sun) and missed since the previous huddle
export function birthdaysFor(list, monday, prevMonday, people, match) {
  const end = addDays(monday, 6), missFrom = prevMonday ? addDays(prevMonday, 7) : addDays(monday, -7), missTo = addDays(monday, -1), out = [];
  for (const p of list) {
    if (p.removed) continue;
    const d = inRange(p.md, monday, end); if (d) { out.push({ key: p.name, name: shownName(p.name, people, match), when: niceDay(d), date: d, missed: false, on: true }); continue; }
    if (missFrom <= missTo) { const m = inRange(p.md, missFrom, missTo); if (m) out.push({ key: p.name, name: shownName(p.name, people, match), when: "last week, " + niceDay(m), date: m, missed: true, on: true }); }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1)).map(({ date, ...x }) => x);
}
// the list page's actions (her key only): add, edit, remove (soft), restore
export async function birthdayAction(env, b) {
  const l = await readBirthdays(env), a = String(b.action || ""), name = clip(b.name, 60), md = String(b.md || "");
  const i = l.findIndex((x) => x.name === clip(b.key || b.name, 60));
  if (a === "bd_add") { if (!name || !okMd(md)) return [400, { ok: false, error: "A name and a month and day (no year)." }]; if (l.some((x) => x.name.toLowerCase() === name.toLowerCase() && !x.removed)) return [409, { ok: false, error: "That name is already on the list." }]; l.push({ name, md }); await save(env, l); return [200, { ok: true }]; }
  if (i < 0) return [404, { ok: false, error: "Not on the list." }];
  const prev = Object.assign({}, l[i]);
  if (a === "bd_edit") { if (name) l[i].name = name; if (b.md != null) { if (!okMd(md)) return [400, { ok: false, error: "Month and day as MM-DD." }]; l[i].md = md; } await save(env, l); return [200, { ok: true, prev }]; }
  if (a === "bd_remove") { l[i].removed = true; l[i].removed_at = new Date().toISOString(); await save(env, l); return [200, { ok: true, prev }]; }
  if (a === "bd_restore") { delete l[i].removed; delete l[i].removed_at; await save(env, l); return [200, { ok: true }]; }
  return [400, { ok: false, error: "Unknown action." }];
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function birthdaysPage(list, key, toastJs) {
  const kq = encodeURIComponent(key), act = list.filter((x) => !x.removed).sort((a, b) => (a.md < b.md ? -1 : 1)), rem = list.filter((x) => x.removed);
  const card = (p, removed) => "<div class=bdc" + (removed ? " off" : "") + " data-n='" + esc(p.name) + "'><b>" + esc(p.name) + "</b><span>" + MON[Number(p.md.slice(0, 2)) - 1] + " " + Number(p.md.slice(3)) + "</span>"
    + (removed ? "<button type=button data-bdr>Bring back</button>" : "<div class=bdb><button type=button data-bde>Edit</button><button type=button data-bdx>Remove</button></div><div class=bded hidden><input class=bn value='" + esc(p.name) + "'><input class=bm type=text inputmode=numeric placeholder=MM-DD value='" + esc(p.md) + "'><button type=button data-bds>Save</button></div>") + "</div>";
  return "<a class=back href='/momo/work/huddle?key=" + kq + "'>&#8592; Huddle</a> <a class=back href='/momo?key=" + kq + "' style='margin-left:12px'>Home</a><div class=tag>MONDAY HUDDLE · BIRTHDAYS · PRIVATE</div><h1>Birthdays list</h1>"
    + "<style>.bdg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bdc{border:1px solid #E3DDD1;border-radius:14px;background:#FFFDF9;padding:10px;display:flex;flex-direction:column;gap:4px;min-width:0}.bdc.off{opacity:.6}.bdc b{font:600 .9rem IBM Plex Sans,sans-serif;overflow-wrap:anywhere}.bdc span{font:500 .78rem IBM Plex Mono,monospace;color:#8A6F3E}.bdb{display:grid;grid-template-columns:1fr 1fr;gap:4px}.bdc button{border:1.5px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:9px;padding:6px 2px;font:600 .74rem IBM Plex Sans,sans-serif}.bded{display:grid;gap:4px}.bded[hidden]{display:none}.bded input{box-sizing:border-box;width:100%;min-width:0;border:1px solid #E3DDD1;border-radius:8px;padding:6px}.bda{border:1px solid #E3DDD1;border-radius:14px;background:#FFFDF9;padding:12px;margin:0 0 12px;display:grid;grid-template-columns:1fr 90px;gap:6px}.bda input{box-sizing:border-box;min-width:0;border:1px solid #E3DDD1;border-radius:8px;padding:8px}.bda button{grid-column:1/-1;border:0;border-radius:10px;padding:10px;background:#0A4F4A;color:#fff;font-weight:600}.nt{font-size:.82rem;color:#5F6B66}</style>"
    + "<p class=nt>Month and day only, never a year, so no age is ever shown. Shown only inside your huddle card.</p>"
    + "<div class=bda><input id=bdn placeholder='Name'><input id=bdm inputmode=numeric placeholder='MM-DD'><button type=button id=bdadd>Add</button></div>"
    + "<div class=bdg>" + act.map((p) => card(p, false)).join("") + "</div>"
    + (rem.length ? "<details style='margin-top:14px'><summary class=nt>Removed (" + rem.length + ")</summary><div class=bdg style='margin-top:8px'>" + rem.map((p) => card(p, true)).join("") + "</div></details>" : "")
    + "<script>" + (toastJs || "") + "</script><script>(function(){function api(b){return fetch('/momo/work/huddle/api'+location.search,{method:'POST',headers:{'Content-Type':'application/json','X-Momo-Confirm':'page'},body:JSON.stringify(b)}).then(function(r){return r.json()})}"
    + "function done(j,msg,undo){if(j&&j.ok){momoToast(msg,undo?{ms:5000,undo:undo}:{});setTimeout(function(){if(!undo)location.reload()},900)}else momoToast('Not saved: '+((j&&j.error)||'no connection'),{error:true})}"
    + "document.getElementById('bdadd').onclick=function(){var n=document.getElementById('bdn').value.trim(),m=document.getElementById('bdm').value.trim();api({action:'bd_add',name:n,md:m}).then(function(j){done(j,'Added: '+n)})};"
    + "document.querySelectorAll('.bdc').forEach(function(c){var n=c.getAttribute('data-n'),q=function(s){return c.querySelector(s)};"
    + "if(q('[data-bde]'))q('[data-bde]').onclick=function(){q('.bded').hidden=!q('.bded').hidden};"
    + "if(q('[data-bds]'))q('[data-bds]').onclick=function(){api({action:'bd_edit',key:n,name:q('.bn').value.trim(),md:q('.bm').value.trim()}).then(function(j){done(j,'Saved: '+q('.bn').value.trim())})};"
    + "if(q('[data-bdx]'))q('[data-bdx]').onclick=function(){api({action:'bd_remove',key:n}).then(function(j){if(j&&j.ok){c.style.display='none';momoToast('Removed: '+n,{ms:5000,undo:function(){api({action:'bd_restore',key:n}).then(function(){c.style.display='';momoToast('Back on the list: '+n)})}})}else done(j)})};"
    + "if(q('[data-bdr]'))q('[data-bdr]').onclick=function(){api({action:'bd_restore',key:n}).then(function(j){done(j,'Back on the list: '+n)})}})})()</script>";
}
