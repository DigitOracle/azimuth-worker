// v659 LIVE ROOM (Kendall, 28 Oct 2026: "build the QR pages") - public phone pages for a live room: a QR code on the screen opens
// /live/<event>/<activity>, the attendee answers with no account and no sign-up, and /live/<event>/<activity>/screen shows the room
// the answers as they arrive. Four kinds: scale (place yourself 1-5), board (post a line, vote for others'), vote (each scenario
// safe / risky / off-limits), wall (one line each, shown as a wall). THIS REPO IS PUBLIC: the event, its activities and its texts
// live in KV (live_cfg_<event>, written by a loader kept outside git); the code holds only the engine and the pages. Answers are
// one KV key each (live_r_<event>_<activity>_<pid>), 30 days, overwritten when the same phone answers again; the screen needs
// the event's screen key (cfg.screenKey) so only the presenter sees the room's answers. Nothing here sends anything to anyone.
export const LIVE_BASE = "/live/";
// v666 (Kendall 29 Oct: "who is in the room" polls): choice = pick one of up to 12 options, bars per option; words = one short free-text answer, grouped and counted.
export const KINDS = ["scale", "board", "vote", "wall", "choice", "words"];
export const R_TTL = 30 * 86400, MAX_TEXT = 140, MAX_LIST = 400, RATE_PER_MIN = 30;

const S = (v, n) => String(v == null ? "" : v).slice(0, n);
const slug = (s) => S(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const J = (b, s) => new Response(JSON.stringify(b), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const H = (h) => new Response(h, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

export async function readCfg(env, event) { let c = null; try { c = JSON.parse(await env.MEETINGS.get("live_cfg_" + event)); } catch (e) {} return c && typeof c === "object" ? c : null; }
export function activityOf(cfg, id) { return (cfg && Array.isArray(cfg.activities) ? cfg.activities : []).find((a) => a && slug(a.id) === id) || null; }

// one id per phone, kept in a cookie, so a second tap updates the first answer instead of adding a second
function pidOf(request) { const m = /(?:^|;\s*)live_pid=([a-z0-9]{8,24})/.exec(request.headers.get("Cookie") || ""); return m ? m[1] : ""; }
function newPid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

async function rateOk(env, ip) { const k = "live_rate_" + ip + "_" + Math.floor(Date.now() / 60000); let n = 0; try { n = parseInt(await env.MEETINGS.get(k)) || 0; } catch (e) {} if (n >= RATE_PER_MIN) return false; await env.MEETINGS.put(k, String(n + 1), { expirationTtl: 120 }); return true; }

export function cleanAnswer(a, b) {   // what one phone may store for one activity
  const o = { at: new Date().toISOString() };
  if (a.kind === "choice") { const v = parseInt(b.value); if (!(v >= 0 && v < (a.options || []).length)) return null; o.value = v; return o; }
  if (a.kind === "words") { const t = S(b.text, 40).replace(/\s+/g, " ").trim(); if (t.length < 2) return null; o.text = t; return o; }
  if (a.kind === "scale") { const v = parseInt(b.value); if (!(v >= 1 && v <= (a.max || 5))) return null; o.value = v; }
  else if (a.kind === "wall" || a.kind === "board") { const t = S(b.text, MAX_TEXT).replace(/\s+/g, " ").trim(); if (t.length < 2) return null; o.text = t; if (a.kind === "board") { o.table = S(b.table, 20).trim(); o.votes = []; } }
  else if (a.kind === "vote") { const opts = a.options || ["safe", "risky", "off-limits"], v = {}; for (const s of a.items || []) { const x = S(b[s.id] || (b.answers || {})[s.id], 20); if (opts.includes(x)) v[s.id] = x; } if (!Object.keys(v).length) return null; o.answers = v; }
  else return null;
  return o;
}

export async function listAnswers(env, event, act) {
  const pre = "live_r_" + event + "_" + act + "_", out = [];
  let cursor; do { const l = await env.MEETINGS.list({ prefix: pre, cursor, limit: 1000 }); for (const k of l.keys) { if (out.length >= MAX_LIST) break; try { const r = JSON.parse(await env.MEETINGS.get(k.name)); if (r) { r.pid = k.name.slice(pre.length); out.push(r); } } catch (e) {} } cursor = l.list_complete ? null : l.cursor; } while (cursor && out.length < MAX_LIST);
  return out.sort((x, y) => String(x.at).localeCompare(String(y.at)));
}

export function summarise(a, rows) {   // what the screen draws
  if (a.kind === "scale") { const n = a.max || 5, c = Array(n).fill(0); rows.forEach((r) => { if (r.value >= 1 && r.value <= n) c[r.value - 1]++; }); return { kind: "scale", total: rows.length, counts: c, labels: a.labels || [] }; }
  if (a.kind === "vote") { const opts = a.options || ["safe", "risky", "off-limits"], items = (a.items || []).map((s) => { const c = {}; opts.forEach((o) => c[o] = 0); rows.forEach((r) => { const v = r.answers && r.answers[s.id]; if (v in c) c[v]++; }); return { id: s.id, text: s.text, key: s.key || "", counts: c }; }); return { kind: "vote", total: rows.length, options: opts, items }; }
  if (a.kind === "choice") { const opts = a.options || [], c = opts.map(() => 0); rows.forEach((r) => { if (r.value >= 0 && r.value < c.length) c[r.value]++; }); return { kind: "choice", total: rows.length, options: opts, counts: c }; }
  if (a.kind === "words") { const m = {}; rows.forEach((r) => { const k = String(r.text || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim(); if (!k) return; if (!m[k]) m[k] = { text: r.text, n: 0 }; m[k].n++; }); return { kind: "words", total: rows.length, words: Object.values(m).sort((x, y) => y.n - x.n).slice(0, 40) }; }
  if (a.kind === "board") { const votes = {}; rows.forEach((r) => (r.votes || []).forEach((p) => votes[p] = (votes[p] || 0) + 1)); return { kind: "board", total: rows.length, posts: rows.map((r) => ({ pid: r.pid, text: r.text, table: r.table, votes: votes[r.pid] || 0 })).sort((x, y) => y.votes - x.votes) }; }
  return { kind: "wall", total: rows.length, posts: rows.map((r) => ({ text: r.text, at: r.at })) };
}

export async function liveRoute(request, env, url) {
  if (!url.pathname.startsWith(LIVE_BASE)) return null;
  const parts = url.pathname.slice(LIVE_BASE.length).split("/").filter(Boolean), event = slug(parts[0] || ""), act = slug(parts[1] || ""), tail = parts[2] || "";
  if (!event) return H(page("Live room", "<p>Nothing here.</p>"));
  const cfg = await readCfg(env, event); if (!cfg) return H(page("Live room", "<p>This room is not open.</p>"));
  if (!act) return H(page(cfg.title || "Live room", "<ul class=l>" + (cfg.activities || []).map((a) => "<li><a href='" + LIVE_BASE + event + "/" + esc(slug(a.id)) + "'>" + esc(a.title) + "</a></li>").join("") + "</ul>"));
  const a = activityOf(cfg, act); if (!a) return H(page(cfg.title || "Live room", "<p>Unknown activity.</p>"));
  const screenOk = cfg.screenKey && url.searchParams.get("k") === cfg.screenKey;
  if (tail === "screen") { if (!screenOk) return new Response("unauthorized", { status: 401 }); return H(screenPage(cfg, a, event, act, url)); }
  if (tail === "data") { if (!screenOk) return J({ ok: false, error: "unauthorized" }, 401); return J({ ok: true, summary: summarise(a, await listAnswers(env, event, act)) }); }
  if (tail === "posts") { if (a.kind !== "board") return J({ ok: false, error: "not a board" }, 404); const s = summarise(a, await listAnswers(env, event, act)); return J({ ok: true, posts: s.posts.filter((p) => p.text) }); }   // the room's own board: public, so phones can vote
  if (tail === "api" && request.method === "POST") {
    const ip = request.headers.get("CF-Connecting-IP") || "0"; if (!(await rateOk(env, ip))) return J({ ok: false, error: "Slow down." }, 429);
    if (cfg.closed || a.closed) return J({ ok: false, error: "This activity is closed." }, 403);
    let b = {}; try { b = await request.json(); } catch (e) { return J({ ok: false, error: "Send JSON." }, 400); }
    let pid = pidOf(request) || S(b.pid, 24).replace(/[^a-z0-9]/g, "") || newPid();
    const key = "live_r_" + event + "_" + act + "_" + pid;
    if (a.kind === "board" && b.voteFor) {   // a vote for someone else's post: recorded on the voter's own row
      let mine = null; try { mine = JSON.parse(await env.MEETINGS.get(key)); } catch (e) {}
      if (!mine) mine = { at: new Date().toISOString(), text: "", votes: [] };
      const v = slug(b.voteFor); if (!v || v === pid) return J({ ok: false, error: "Vote for another table." }, 400);
      mine.votes = Array.from(new Set((mine.votes || []).concat([v]))).slice(0, a.maxVotes || 3);
      await env.MEETINGS.put(key, JSON.stringify(mine), { expirationTtl: R_TTL });
      return J({ ok: true, pid, votes: mine.votes });
    }
    const ans = cleanAnswer(a, b); if (!ans) return J({ ok: false, error: "Give an answer first." }, 400);
    if (a.kind === "board") { let prev = null; try { prev = JSON.parse(await env.MEETINGS.get(key)); } catch (e) {} if (prev && prev.votes) ans.votes = prev.votes; }
    await env.MEETINGS.put(key, JSON.stringify(ans), { expirationTtl: R_TTL });
    const res = J({ ok: true, pid }); res.headers.append("Set-Cookie", "live_pid=" + pid + "; Path=/live; Max-Age=86400; SameSite=Lax; Secure"); return res;
  }
  if (tail) return H(page(cfg.title || "Live room", "<p>Nothing here.</p>"));
  const pid = pidOf(request), res = H(phonePage(cfg, a, event, act, pid || ""));
  if (!pid) res.headers.append("Set-Cookie", "live_pid=" + newPid() + "; Path=/live; Max-Age=86400; SameSite=Lax; Secure");
  return res;
}

const CSS = "*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#FBF7EF;color:#1E2433}.w{max-width:560px;margin:0 auto;padding:20px 16px 40px}.tag{color:#B8925A;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;font-size:12px}h1{font-family:Georgia,serif;font-weight:400;font-size:26px;margin:4px 0 6px}p.s{color:#555;margin:0 0 16px;font-size:15px}.c{background:#fff;border-radius:12px;padding:14px;margin:10px 0;border-top:3px solid #B8925A;box-shadow:0 2px 8px rgba(30,36,51,.06)}button,.b{display:block;width:100%;padding:14px;border:0;border-radius:10px;background:#1E2433;color:#fff;font-size:17px;font-weight:600;margin:10px 0 0;cursor:pointer}button.o{background:#fff;color:#1E2433;border:2px solid #1E2433}button.on{background:#0F3D3A;border-color:#0F3D3A;color:#fff}textarea,input{width:100%;padding:12px;border:1.5px solid #cfc7bb;border-radius:10px;font-size:16px;font-family:inherit}.row{display:flex;gap:8px}.row button{margin:0;flex:1;padding:12px 4px;font-size:14px}.ok{background:#DDE6D5;color:#2D4A22;padding:12px;border-radius:10px;margin-top:12px;font-weight:600;display:none}.sc{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.sc button{margin:0;padding:18px 0;font-size:22px}.lab{display:flex;justify-content:space-between;font-size:12px;color:#555;margin-top:6px}ul.l{padding-left:18px;font-size:18px;line-height:2}.post{padding:10px 0;border-bottom:1px solid #eee;display:flex;gap:10px;align-items:center}.post b{min-width:36px;text-align:center;background:#F3E9DA;border-radius:8px;padding:6px 0}.post button{margin:0;width:auto;padding:8px 12px;font-size:13px}";

function page(title, body, cfg) { return "<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>" + esc(title) + "</title><style>" + CSS + "</style></head><body><div class=w><div class=tag>" + esc((cfg && cfg.tag) || "Live room") + "</div><h1>" + esc(title) + "</h1>" + body + "</div></body></html>"; }

function phonePage(cfg, a, event, act, pid) {
  const api = LIVE_BASE + event + "/" + act + "/api";
  let body = "<p class=s>" + esc(a.prompt || "") + "</p>";
  if (a.kind === "choice") {
    body += "<div class=c>" + (a.options || []).map((o, i) => "<button class=o data-v=" + i + " style='text-align:left'>" + esc(o) + "</button>").join("") + "</div><div class=ok id=ok>Thanks, you are counted. Tap another to change.</div>";
    body += "<script>var B=document.querySelectorAll('.c button');B.forEach(function(b){b.onclick=function(){B.forEach(function(x){x.className='o'});b.className='on';fetch('" + api + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:b.dataset.v})}).then(function(r){return r.json()}).then(function(j){document.getElementById('ok').style.display=j.ok?'block':'none';if(!j.ok)alert(j.error||'Try again')})}})</script>";
  } else if (a.kind === "words") {
    body += "<div class=c><input id=t maxlength=40 placeholder='" + esc(a.placeholder || "Type here") + "'><button id=go>" + esc(a.button || "Send") + "</button></div><div class=ok id=ok>Sent. Send again to change it.</div>";
    body += "<script>document.getElementById('go').onclick=function(){fetch('" + api + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:document.getElementById('t').value})}).then(function(r){return r.json()}).then(function(j){document.getElementById('ok').style.display=j.ok?'block':'none';if(!j.ok)alert(j.error||'Try again')})}</script>";
  } else if (a.kind === "scale") {
    const n = a.max || 5, L = a.labels || [];
    body += "<div class=c><div class=sc>" + Array.from({ length: n }, (_, i) => "<button class=o data-v=" + (i + 1) + ">" + (i + 1) + "</button>").join("") + "</div><div class=lab><span>" + esc(L[0] || "") + "</span><span>" + esc(L[1] || "") + "</span></div>" + (L.length > 2 ? "<ol style='font-size:13px;color:#555;padding-left:18px;margin:10px 0 0'>" + L.map((l) => "<li>" + esc(l) + "</li>").join("") + "</ol>" : "") + "</div><div class=ok id=ok>Thanks, you are on the board. Tap again to change.</div>";
    body += "<script>var B=document.querySelectorAll('.sc button');B.forEach(function(b){b.onclick=function(){B.forEach(function(x){x.className='o'});b.className='on';fetch('" + api + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:b.dataset.v})}).then(function(r){return r.json()}).then(function(j){document.getElementById('ok').style.display=j.ok?'block':'none';if(!j.ok)alert(j.error||'Try again')})}})</script>";
  } else if (a.kind === "wall") {
    body += "<div class=c><textarea id=t rows=3 maxlength=" + MAX_TEXT + " placeholder='" + esc(a.placeholder || "Type here") + "'></textarea><button id=go>" + esc(a.button || "Post it") + "</button></div><div class=ok id=ok>Posted. You can edit and post again to replace it.</div>";
    body += "<script>document.getElementById('go').onclick=function(){var t=document.getElementById('t').value;fetch('" + api + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})}).then(function(r){return r.json()}).then(function(j){document.getElementById('ok').style.display=j.ok?'block':'none';if(!j.ok)alert(j.error||'Try again')})}</script>";
  } else if (a.kind === "board") {
    body += "<div class=c><input id=tb placeholder='Your table (for example: Table 3)' maxlength=20><textarea id=t rows=3 maxlength=" + MAX_TEXT + " style='margin-top:8px' placeholder='" + esc(a.placeholder || "What did your tool produce? One line.") + "'></textarea><button id=go>" + esc(a.button || "Post our result") + "</button></div><div class=ok id=ok>Posted.</div><div class=c><b>Vote for the best (not your own table)</b><div id=list style='margin-top:8px;color:#555'>Loading…</div></div>";
    body += "<script>var API='" + api + "';function load(){fetch('" + LIVE_BASE + event + "/" + act + "/posts').then(function(r){return r.json()}).then(function(j){var L=document.getElementById('list');L.innerHTML='';(j.posts||[]).forEach(function(p){var d=document.createElement('div');d.className='post';d.innerHTML='<b>'+p.votes+'</b><span style=\"flex:1\">'+(p.table?'<i>'+p.table+'</i> · ':'')+p.text.replace(/</g,'&lt;')+'</span>';var b=document.createElement('button');b.textContent='Vote';b.onclick=function(){fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voteFor:p.pid})}).then(function(r){return r.json()}).then(function(j){if(!j.ok)alert(j.error||'Try again');load()})};d.appendChild(b);L.appendChild(d)});if(!(j.posts||[]).length)L.textContent='No posts yet.'})}document.getElementById('go').onclick=function(){fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:document.getElementById('t').value,table:document.getElementById('tb').value})}).then(function(r){return r.json()}).then(function(j){document.getElementById('ok').style.display=j.ok?'block':'none';if(!j.ok)alert(j.error||'Try again');load()})};load();setInterval(load,5000)</script>";
  } else if (a.kind === "vote") {
    const opts = a.options || ["safe", "risky", "off-limits"];
    body += (a.items || []).map((s) => "<div class=c data-id='" + esc(s.id) + "'><div style='font-weight:600;margin-bottom:8px'>" + esc(s.text) + "</div><div class=row>" + opts.map((o) => "<button class=o data-o='" + esc(o) + "'>" + esc(o) + "</button>").join("") + "</div></div>").join("") + "<button id=go>" + esc(a.button || "Send my answers") + "</button><div class=ok id=ok>Sent. Change any answer and send again.</div>";
    body += "<script>var A={};document.querySelectorAll('.c[data-id]').forEach(function(c){c.querySelectorAll('button').forEach(function(b){b.onclick=function(){c.querySelectorAll('button').forEach(function(x){x.className='o'});b.className='on';A[c.dataset.id]=b.dataset.o}})});document.getElementById('go').onclick=function(){fetch('" + api + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers:A})}).then(function(r){return r.json()}).then(function(j){document.getElementById('ok').style.display=j.ok?'block':'none';if(!j.ok)alert(j.error||'Try again')})}</script>";
  }
  return page(a.title, body, cfg);
}

const SCSS = "body{background:#1E2433;color:#fff;font-family:Inter,Arial,sans-serif;margin:0}.w{padding:28px 40px}.tag{color:#C5A56A;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:16px}h1{font-family:Georgia,serif;font-weight:400;font-size:46px;margin:6px 0 4px}.n{color:#C5A56A;font-size:22px;margin-bottom:18px}.bars{display:flex;gap:18px;align-items:flex-end;height:46vh}.bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.bar i{display:block;width:100%;background:#C5A56A;border-radius:10px 10px 0 0;transition:height .6s}.bar b{font-size:40px;margin:8px 0 4px}.bar span{font-size:15px;color:#d9d4cc;text-align:center}.wall{display:flex;flex-wrap:wrap;gap:12px}.wall div{background:rgba(255,255,255,.08);border-left:4px solid #C5A56A;padding:12px 16px;border-radius:8px;font-size:22px;max-width:46%}.vt{width:100%;border-collapse:collapse;font-size:20px}.vt td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.12)}.vt td.k{color:#C5A56A;width:120px;text-align:center}.hb{display:flex;flex-direction:column;gap:12px}.hr{display:flex;align-items:center;gap:14px;font-size:24px}.hl{width:34%;text-align:right}.ht{flex:1;height:30px;background:rgba(255,255,255,.08);border-radius:8px;overflow:hidden}.ht i{display:block;height:100%;background:#C5A56A;transition:width .6s}.hr b{width:60px;color:#C5A56A;font-size:30px}.wc{display:flex;flex-wrap:wrap;gap:14px 28px;align-items:center;justify-content:center;padding:20px}.wc span{color:#fff;font-weight:600}.wc small{color:#C5A56A;font-size:18px}.bd{font-size:24px}.bd div{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.12)}.bd b{color:#C5A56A;display:inline-block;min-width:60px}";

function screenPage(cfg, a, event, act, url) {
  const data = LIVE_BASE + event + "/" + act + "/data?k=" + encodeURIComponent(url.searchParams.get("k") || "");
  const join = (cfg.origin || url.origin) + LIVE_BASE + event + "/" + act;
  return "<!doctype html><html><head><meta charset=utf-8><title>" + esc(a.title) + "</title><style>" + SCSS + "</style></head><body><div class=w><div class=tag>" + esc(cfg.title || "") + " · " + esc(join) + "</div><h1>" + esc(a.title) + "</h1><div class=n id=n>Waiting for the room…</div><div id=v></div></div><script>var D='" + data + "';function e(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}function draw(s){document.getElementById('n').textContent=s.total+' answered';var v=document.getElementById('v'),h='';if(s.kind==='choice'){var mx=Math.max.apply(null,s.counts.concat([1]));h='<div class=hb>'+s.options.map(function(o,i){var c=s.counts[i];return '<div class=hr><span class=hl>'+e(o)+'</span><span class=ht><i style=\"width:'+Math.round(c/mx*100)+'%\"></i></span><b>'+c+'</b></div>'}).join('')+'</div>'}else if(s.kind==='words'){var mw=Math.max.apply(null,s.words.map(function(w){return w.n}).concat([1]));h='<div class=wc>'+s.words.map(function(w){return '<span style=\"font-size:'+(22+Math.round(w.n/mw*58))+'px\">'+e(w.text)+(w.n>1?' <small>'+w.n+'</small>':'')+'</span>'}).join('')+'</div>'}else if(s.kind==='scale'){var m=Math.max.apply(null,s.counts.concat([1]));h='<div class=bars>'+s.counts.map(function(c,i){return '<div class=bar><b>'+c+'</b><i style=\"height:'+Math.round(c/m*100)+'%\"></i><span>'+(i+1)+(s.labels[i]?'<br>'+e(s.labels[i]):'')+'</span></div>'}).join('')+'</div>'}else if(s.kind==='vote'){h='<table class=vt><tr><td></td>'+s.options.map(function(o){return '<td class=k>'+e(o)+'</td>'}).join('')+'</tr>'+s.items.map(function(it){return '<tr><td>'+e(it.text)+'</td>'+s.options.map(function(o){return '<td class=k>'+it.counts[o]+'</td>'}).join('')+'</tr>'}).join('')+'</table>'}else if(s.kind==='board'){h='<div class=bd>'+s.posts.map(function(p){return '<div><b>'+p.votes+'</b>'+(p.table?'<i>'+e(p.table)+'</i> · ':'')+e(p.text)+'</div>'}).join('')+'</div>'}else{h='<div class=wall>'+s.posts.slice(-60).reverse().map(function(p){return '<div>'+e(p.text)+'</div>'}).join('')+'</div>'}v.innerHTML=h}function tick(){fetch(D).then(function(r){return r.json()}).then(function(j){if(j.ok)draw(j.summary)}).catch(function(){})}tick();setInterval(tick,3000)</script></body></html>";
}
