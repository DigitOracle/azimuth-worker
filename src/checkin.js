// v764 WHATSAPP CHECK-IN (Kendall, 5 Nov 2026). On a task, or on one step of a planner item, Najjuko taps a WhatsApp button, picks a teammate
// from her own short list, and HER OWN WhatsApp opens with a prefilled message (a wa.me link: no API, no template, nothing sent by Momo). The
// message carries a link to /momo/checkin/<token>: a page with no key and no login that knows ONE thing - this task (or this step) for this
// person - and expires after 7 days (the KV entry lives 7 days, so an old link is simply gone). Three big buttons: Done / Not yet / Stuck, plus an
// optional note. The answer updates the task (Done -> Done 100%, Stuck -> Stuck) or ticks the planner step (Done), and is logged on it as
// "Vishant: Done, 11:42". The page shows only the item's name and the person's own name: never another task, never her data.
// The message opens "Najjuko here." - never "Black Coffee", which is only how Kendall's messages TO her open.
import { applyAction, fmtDay } from "./content_planner.js";

const TEAM = "ck_team", TOK = "ck_tok_", TTL = 7 * 86400;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ANS = { done: "Done", notyet: "Not yet", stuck: "Stuck", progress: "In progress", note: "Note" };   // v770 - progress / note come from the desk buttons and replies
const gst = () => new Date(Date.now() + 4 * 3600e3).toISOString();

export function phoneDigits(p) {
  let d = String(p || "").replace(/[^0-9+]/g, "");
  if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("00")) d = d.slice(2); else if (/^05\d{8}$/.test(d)) d = "971" + d.slice(1); else if (/^5\d{8}$/.test(d)) d = "971" + d;
  return /^\d{8,15}$/.test(d) ? d : "";
}
export async function readTeam(env) { try { return JSON.parse((await env.MEETINGS.get(TEAM)) || "[]"); } catch (e) { return []; } }
export async function saveTeam(env, list) {
  const out = [], seen = new Set();
  for (const p of (Array.isArray(list) ? list : []).slice(0, 30)) {
    const name = String(p && p.name || "").replace(/\s+/g, " ").trim().slice(0, 40), phone = phoneDigits(p && p.phone);
    if (!name || !phone || seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase()); out.push({ name, phone });
  }
  await env.MEETINGS.put(TEAM, JSON.stringify(out)); return out;
}
function newToken() { const b = new Uint8Array(18); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

// what = the task status or the step name; due = a date/time line, when there is one
export function ckMessage(subject, what, due, link) {
  return "Najjuko here. Quick check on " + subject + (what ? ", " + what : "") + (due ? ", due " + due : "") + ". Is it done? Tap your answer: " + link;
}
// make one link for one person and one task/step; returns the wa.me address her phone opens
async function ckBuild(env, b, tasks) {
  const team = await readTeam(env), person = team.find((p) => p.name === String(b.person || ""));
  if (!person) return { err: [400, { error: "Add that person to your team list first." }] };
  let rec, subject, what = "", due = "";
  if (b.kind === "task") {
    const name = String(b.name || "").trim().slice(0, 80), t = (tasks || []).find((x) => x.name === name);
    if (!t) return { err: [404, { error: "No task called that." }] };
    rec = { kind: "task", name }; subject = name; what = t.status === "Done" ? "" : t.status.toLowerCase() + " at " + t.percent + "%";
  } else if (b.kind === "step") {
    const code = String(b.code || "").toUpperCase(), step = String(b.step || "").slice(0, 40);
    let it = null; try { it = JSON.parse((await env.MEETINGS.get("cp_item_" + code)) || "null"); } catch (e) {}
    if (!it || it.deleted) return { err: [404, { error: "No planner item " + code + "." }] };
    rec = { kind: "step", code, step }; subject = code + (it.topic ? " (" + String(it.topic).slice(0, 60) + ")" : ""); what = step; due = [fmtDay(it.date), it.time].filter(Boolean).join(" ");
  } else return { err: [400, { error: "A task or a planner step." }] };
  return { person, rec, subject, what, due };
}
async function ckToken(env, x, via) {
  const tok = newToken();
  await env.MEETINGS.put(TOK + tok, JSON.stringify({ ...x.rec, person: x.person.name, phone: x.person.phone, via: via || "link", made: new Date().toISOString(), exp: new Date(Date.now() + TTL * 1000).toISOString(), answers: [] }), { expirationTtl: TTL });
  return tok;
}
export async function ckMake(env, origin, b, tasks) {
  const x = await ckBuild(env, b, tasks); if (x.err) return x.err;
  const { person, subject, what, due } = x, tok = await ckToken(env, x, "link");
  const link = origin + "/momo/checkin/" + tok;
  return [200, { ok: true, url: "https://wa.me/" + person.phone + "?text=" + encodeURIComponent(ckMessage(subject, what, due, link)), link }];
}

const PAGE_CSS = 'body{margin:0;background:#FAF6EE;color:#1C2826;font-family:"IBM Plex Sans",system-ui,sans-serif;padding:28px 16px}.w{max-width:440px;margin:0 auto}.tag{font:600 .7rem "IBM Plex Mono",monospace;letter-spacing:.14em;color:#8A6F3E}h1{font:600 1.5rem Fraunces,Georgia,serif;color:#0A4F4A;margin:6px 0 4px}.s{color:#5F6B66;margin:0 0 20px;font-size:.95rem}'
  + '.b{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;border:2px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:18px;padding:18px;font:600 1.15rem "IBM Plex Sans",sans-serif;margin:0 0 12px;cursor:pointer}.b.d{background:#0A4F4A;color:#fff}.b.st{border-color:#B4533C;color:#B4533C}'
  + 'textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:14px;padding:12px;font:500 1rem "IBM Plex Sans",sans-serif;min-height:80px;margin:4px 0 16px;background:#fff}.ok{border:1px solid #C5A56A;border-radius:16px;padding:18px;background:#FFFDF9;text-align:center}.ok b{font:600 1.2rem Fraunces,Georgia,serif;color:#0A4F4A}';
const ICK = '<svg viewBox="0 0 24 24" width=22 height=22 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M4 12l5 5L20 6"/></svg>';
const ICL = '<svg viewBox="0 0 24 24" width=22 height=22 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICS = '<svg viewBox="0 0 24 24" width=22 height=22 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8"/></svg>';
function page(inner) {
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><meta name=theme-color content="#FAF6EE"><title>Check-in</title><style>' + PAGE_CSS + '</style></head><body><div class=w>' + inner + '</div></body></html>';
}
const H = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };

// v770 - one answer, from the link page OR a desk button / reply: moves the task or ticks the step, logs "Vishant: Done, 11:42".
// The Approved step is never ticked this way (applyAction refuses anyone but Najjuko): the answer is only logged there.
export async function ckApply(env, tok, c, ans, note, hooks) {
  const at = gst(), hm = at.slice(11, 16), line = c.person + ": " + ANS[ans] + ", " + hm + (note ? " (" + note + ")" : "");
  if (c.kind === "task") await hooks.taskAnswer(c.name, ans, c.person, note, line);
  else {
    let it = null; try { it = JSON.parse((await env.MEETINGS.get("cp_item_" + c.code)) || "null"); } catch (e) {}
    if (it) {
      const doneAlready = it.done && it.done[c.step] && it.done[c.step].done;
      if (ans === "done" && !doneAlready) await applyAction(env, { action: "tick", code: c.code, step: c.step, on: 1 }, c.person + " (check-in)");
      try { it = JSON.parse((await env.MEETINGS.get("cp_item_" + c.code)) || "null"); } catch (e) {}
      if (it) { it.checkins = [{ step: c.step, who: c.person, ans, at, note }].concat(it.checkins || []).slice(0, 40); it.log = [{ at: new Date().toISOString(), who: c.person + " (check-in)", what: c.step + ": " + line }].concat(it.log || []).slice(0, 200); await env.MEETINGS.put("cp_item_" + c.code, JSON.stringify(it)); }
    }
  }
  c.answers = (c.answers || []).concat({ ans, note, at }).slice(-10);
  await env.MEETINGS.put(TOK + tok, JSON.stringify(c), { expirationTtl: Math.max(60, Math.round((Date.parse(c.exp) - Date.now()) / 1000)) });
  return line;
}

// ---------- v770 DESK CHECK-IN (Kendall, 5 Nov 2026: "build it out once ... automate that") ----------
// "Ask (desk)" sends from the desk number (WA_DESK_PHONE_ID) with three reply buttons: Done / In progress / Stuck. Inside the person's 24-hour
// window (they wrote to the desk in the last 24 h: ck_in_<digits>) it is a free interactive message; outside it, the one approved utility
// template najjuko_task_checkin. Until Meta approves it the button says so and offers "Ask on my WhatsApp". Each button carries "ck:<token>:<ans>",
// the token being the same unguessable 7-day ck_tok_ record as the link (one task, one person); the webhook only accepts it from that person's own
// number, so the text of a button is never trusted. A plain text reply within 24 h of a check-in becomes a note on it. STOP opts the number out
// (the campaign opt-out store). Team messages, not marketing: never in campaign stats; counted in the shared 24 h cap camp_sent24.
// She taps to send; nothing here sends by itself.
export const CK_TEMPLATE = "najjuko_task_checkin";
const DIGS = (x) => String(x || "").replace(/[^0-9]/g, "");
const DAY = 86400e3;
export function ckDeskText(first, subject, due) {
  return "Hi " + first + ", Najjuko here. Quick check on " + subject + ", due " + due + ". Where is it?";
}
const BTNS = [["done", "Done"], ["progress", "In progress"], ["stuck", "Stuck"]];
export function ckInteractive(to, tok, text) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text },
    action: { buttons: BTNS.map(([a, t]) => ({ type: "reply", reply: { id: "ck:" + tok + ":" + a, title: t } })) } } };
}
export function ckTemplatePayload(to, tok, first, subject, due) {
  const v = (x) => String(x == null || x === "" ? "-" : x).replace(/\s+/g, " ").trim().slice(0, 200);
  return { messaging_product: "whatsapp", to, type: "template", template: { name: CK_TEMPLATE, language: { code: "en" }, components: [
    { type: "body", parameters: [v(first), v(subject), v(due)].map((t) => ({ type: "text", text: t })) }]
    .concat(BTNS.map(([a], i) => ({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: "ck:" + tok + ":" + a }] }))) } };
}
async function tplApproved(env, deps) {
  if (await env.MEETINGS.get("ck_tpl_ok")) return true;
  if (await env.MEETINGS.get("ck_tpl_no")) return false;
  let st = null; try { st = deps && deps.tplStatus ? await deps.tplStatus() : null; } catch (e) {}
  const ok = !!(st && st.ok && st.status === "APPROVED");
  await env.MEETINGS.put(ok ? "ck_tpl_ok" : "ck_tpl_no", st && st.status ? String(st.status) : "?", { expirationTtl: ok ? 6 * 3600 : 600 });
  return ok;
}
// deps: { post(payload) -> Response (sent from the desk), tplStatus() -> {ok,status}, optedOut(digits) -> bool, cap }
export async function ckDesk(env, b, tasks, deps) {
  const x = await ckBuild(env, b, tasks); if (x.err) return x.err;
  const d = DIGS(x.person.phone);
  if (!DIGS(env.WA_DESK_PHONE_ID)) return [503, { ok: false, error: "The desk number is not set up on this instance." }];
  if (deps && deps.optedOut && await deps.optedOut(d)) return [409, { ok: false, error: x.person.name + " asked for no more messages from the desk. Use Ask on my WhatsApp." }];
  const now = Date.now(); let s24 = []; try { s24 = (JSON.parse((await env.MEETINGS.get("camp_sent24")) || "[]") || []).filter((t) => now - t < DAY); } catch (e) {}
  if (s24.length >= ((deps && deps.cap) || 250)) return [429, { ok: false, error: "The desk has sent its daily limit. Use Ask on my WhatsApp for now." }];
  const open = !!(await env.MEETINGS.get("ck_in_" + d));
  if (!open && !(await tplApproved(env, deps))) return [409, { ok: false, waiting: true, error: "The desk message is waiting for Meta approval. Use Ask on my WhatsApp for now." }];
  const tok = await ckToken(env, x, "desk"), first = x.person.name.split(" ")[0];
  const due = x.due || "today";
  const subj = x.subject + (x.what && x.rec.kind === "step" ? " (" + x.what + ")" : "");
  const payload = open ? ckInteractive(d, tok, ckDeskText(first, subj, due)) : ckTemplatePayload(d, tok, first, subj, due);
  let r = null, j = null; try { r = await deps.post(payload); j = r && r.clone ? await r.clone().json().catch(() => null) : null; } catch (e) {}
  if (!r || !r.ok) { await env.MEETINGS.delete(TOK + tok); return [502, { ok: false, error: "WhatsApp did not take it: " + String((j && j.error && (j.error.error_user_msg || j.error.message)) || (r ? "HTTP " + r.status : "no connection")).slice(0, 160) }]; }
  const wamid = j && j.messages && j.messages[0] && j.messages[0].id || "";
  s24.push(now); await env.MEETINGS.put("camp_sent24", JSON.stringify(s24));
  await env.MEETINGS.put("ck_last_" + d, JSON.stringify({ tok, at: new Date(now).toISOString(), wamid }), { expirationTtl: 86400 });
  return [200, { ok: true, sent: open ? "buttons" : "template", to: x.person.name }];
}
const ACK = { done: "Thank you. Najjuko can see it is done.", progress: "Thank you. Najjuko can see it is in progress.", stuck: "Thank you. Najjuko can see it is stuck; reply here with what is in the way.", note: "Thank you, your note is with Najjuko." };
// the desk webhook: consumes ONLY check-in buttons, and text from a teammate inside 24 h of a check-in. Everything else falls through untouched.
// hooks: { taskAnswer }; deps: { send(to, text) from the desk, optOut(digits) }
export async function ckWebhook(env, body, hooks, deps) {
  const val = body && body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value;
  if (!val || !Array.isArray(val.messages) || !val.messages.length) return null;
  if (DIGS(val.metadata && val.metadata.phone_number_id) !== DIGS(env.WA_DESK_PHONE_ID) || !DIGS(env.WA_DESK_PHONE_ID)) return null;
  const out = { consumed: false, answers: [] }, owners = [DIGS(env.WA_DESK_OWNER), DIGS(env.WA_ALLOWED)].filter(Boolean);
  for (const msg of val.messages) {
    const d = DIGS(msg.from); if (!d) continue;
    const pay = msg.type === "button" ? String(msg.button && msg.button.payload || "") : msg.type === "interactive" && msg.interactive && msg.interactive.button_reply ? String(msg.interactive.button_reply.id || "") : "";
    let tok = "", ans = "", note = "";
    const m = /^ck:([A-Za-z0-9_-]{20,40}):(done|progress|stuck)$/.exec(pay);
    if (m) { tok = m[1]; ans = m[2]; }
    else if (msg.type === "text" && !owners.includes(d)) {
      let last = null; try { last = JSON.parse((await env.MEETINGS.get("ck_last_" + d)) || "null"); } catch (e) {}
      const ctx = msg.context && msg.context.id ? String(msg.context.id) : "";
      if (!last || (ctx && last.wamid && ctx !== last.wamid)) continue;
      const t = String(msg.text && msg.text.body || "").replace(/\s+/g, " ").trim();
      if (/^(stop|unsubscribe|stop messages)$/i.test(t)) { if (deps && deps.optOut) await deps.optOut(d); await env.MEETINGS.delete("ck_last_" + d); out.consumed = true; if (deps && deps.send) await deps.send(d, "Done. The desk will not message you again."); continue; }
      tok = last.tok; ans = "note"; note = t.slice(0, 300);
    } else continue;
    let c = null; try { c = JSON.parse((await env.MEETINGS.get(TOK + tok)) || "null"); } catch (e) {}
    out.consumed = true;   // a ck: button is ours even when its token is gone - never handed to another handler
    if (!c || Date.parse(c.exp) < Date.now()) { if (deps && deps.send) await deps.send(d, "That check-in has expired. Najjuko will send a new one."); continue; }
    if (DIGS(c.phone) !== d) continue;   // only the person it was sent to may answer it
    await env.MEETINGS.put("ck_in_" + d, "1", { expirationTtl: 86400 });
    await env.MEETINGS.put("ck_last_" + d, JSON.stringify({ tok, at: new Date().toISOString(), wamid: "" }), { expirationTtl: 86400 });
    out.answers.push(await ckApply(env, tok, c, ans, note, hooks));
    if (deps && deps.send) await deps.send(d, ACK[ans]);
  }
  return out;
}

// hooks: { taskAnswer(name, ans, who, note) } from work_log.js (its own task store)
export async function ckRoute(request, env, url, hooks) {
  const tok = url.pathname.slice("/momo/checkin/".length).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  let c = null; if (tok.length >= 20) { try { c = JSON.parse((await env.MEETINGS.get(TOK + tok)) || "null"); } catch (e) {} }
  if (!c || Date.parse(c.exp) < Date.now()) return new Response(page('<div class=tag>FN REALTY · CHECK-IN</div><h1>This link has expired</h1><p class=s>Check-in links last 7 days. Ask Najjuko for a new one.</p>'), { status: 404, headers: H });
  const subject = c.kind === "task" ? c.name : c.code + " · " + c.step;
  if (request.method === "POST") {
    let b = {}; try { b = Object.fromEntries(new URLSearchParams(await request.text())); } catch (e) {}
    const ans = ANS[b.a] ? b.a : "", note = String(b.note || "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!ans) return new Response(page('<h1>Choose an answer</h1>'), { status: 400, headers: H });
    await ckApply(env, tok, c, ans, note, hooks);
    return new Response(page('<div class=tag>FN REALTY · CHECK-IN</div><div class=ok>' + ICK + '<p><b>Thank you, ' + esc(c.person) + '</b></p><p class=s style="margin:6px 0 0">Najjuko can see your answer: ' + esc(ANS[ans]) + '.</p></div>'), { headers: H });
  }
  const last = (c.answers || []).slice(-1)[0];
  return new Response(page('<div class=tag>FN REALTY · CHECK-IN</div><h1>' + esc(subject) + '</h1><p class=s>Hi ' + esc(c.person) + ', Najjuko is asking: is it done?' + (last ? ' You answered ' + esc(ANS[last.ans]) + ' earlier; you can change it.' : '') + '</p>'
    + '<form method=post><button class="b d" name=a value=done>' + ICK + 'Done</button><button class=b name=a value=notyet>' + ICL + 'Not yet</button><button class="b st" name=a value=stuck>' + ICS + 'Stuck</button>'
    + '<label for=nt class=s style="display:block;margin:10px 0 0">Note (optional)</label><textarea id=nt name=note maxlength=300 placeholder="What is left, or what is in the way"></textarea></form>'), { headers: H });
}

// the client picker, shared by Work and the planner: data-ck="task|<name>" or data-ck="step|<code>|<step>"
export const CK_JS = String.raw`;(function(){
var K=(new URLSearchParams(location.search)).get("key")||"";
function capi(o){return fetch("/momo/work/api?key="+encodeURIComponent(K),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json()})}
function h(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]})}
var st=document.createElement("style");st.textContent=".ckb{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1px solid #1F8F5F;color:#1F8F5F;background:#fff;cursor:pointer;padding:0;vertical-align:middle;margin-left:6px}.ckbg{position:fixed;inset:0;background:rgba(28,40,38,.35);z-index:95;display:flex;align-items:flex-end;justify-content:center}.ckp{background:#FAF6EE;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:18px 16px 22px;box-sizing:border-box;font-family:'IBM Plex Sans',sans-serif;color:#1C2826;max-height:88vh;overflow:auto}.ckp h3{font:600 1.15rem Fraunces,serif;color:#0A4F4A;margin:0 0 4px}.ckp p{margin:0 0 10px;font-size:.84rem;color:#5F6B66}.ckg{display:grid;grid-template-columns:1fr;gap:8px}.ckr{display:flex;flex-direction:column;gap:6px;border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:12px}.ckr b{font:600 1rem Fraunces,serif;color:#0A4F4A}.ckr small{color:#5F6B66;font-size:.78rem}.ckr span{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ckr span button{border:1px solid #1F8F5F;background:#fff;color:#1F8F5F;border-radius:999px;padding:10px 8px;font:600 .86rem 'IBM Plex Sans',sans-serif;cursor:pointer}.ckr span button.ckd{background:#1F8F5F;color:#fff}.ckg button{border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:14px 10px;font:600 .95rem 'IBM Plex Sans',sans-serif;color:#0A4F4A;cursor:pointer;text-align:left}.ckg button small{display:block;font-weight:500;color:#5F6B66;font-size:.74rem;margin-top:2px}.cka{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.cka input{border:1px solid #D8D1C4;border-radius:12px;padding:11px;font:500 .95rem 'IBM Plex Sans',sans-serif;min-width:0}.ckx{display:block;width:100%;margin-top:12px;border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:11px;font:600 .9rem 'IBM Plex Sans',sans-serif}.ckx.go{background:#0A4F4A;color:#fff}.ckm{font-size:.84rem;color:#8A3E3E;min-height:1em}.ckchip{display:inline-block;font:600 .62rem 'IBM Plex Mono',monospace;border-radius:999px;padding:2px 8px;border:1px solid #1F8F5F;color:#1F8F5F;margin-left:4px}.ckchip.stuck{border-color:#B4533C;color:#B4533C}.ckchip.notyet{border-color:#C5A56A;color:#8A6F3E}";document.head.appendChild(st);
window.CK_ICON='<svg viewBox="0 0 24 24" width=16 height=16 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 1.8 1.7 3.6 3.6 4.4l1.2-1.1 1.8.8-.4 1.6c-3 .2-6.4-2.8-6.8-6l1.5-.6.9 1.7z"/></svg>';
window.ckBtn=function(v,label){return '<button type=button class=ckb data-ck="'+h(v)+'" aria-label="Check in on WhatsApp'+(label?": "+h(label):"")+'">'+window.CK_ICON+'</button>'};
window.ckChip=function(c){if(!c)return "";return '<span class="ckchip '+h(c.ans)+'">'+h(c.who)+": "+h({done:"Done",notyet:"Not yet",stuck:"Stuck"}[c.ans]||c.ans)+" "+h(String(c.at||"").slice(11,16))+'</span>'};
function close(){var x=document.getElementById("ck_bg");if(x)x.remove()}
function open(v){var p=v.split("|"),b=p[0]==="task"?{kind:"task",name:p.slice(1).join("|")}:{kind:"step",code:p[1],step:p.slice(2).join("|")};
capi({action:"ck_team"}).then(function(j){draw(b,j.team||[])}).catch(function(){draw(b,[])})}
function draw(b,team){close();var bg=document.createElement("div");bg.className="ckbg";bg.id="ck_bg";bg.onclick=function(e){if(e.target===bg)close()};
bg.innerHTML='<div class=ckp role=dialog aria-modal=true aria-label="Check in on WhatsApp"><h3>Check in on WhatsApp</h3><p>'+h(b.kind==="task"?b.name:b.code+" · "+b.step)+'. <b>Ask (desk)</b> sends it now from the desk number with Done / In progress / Stuck buttons, and the answer updates this by itself. <b>My WhatsApp</b> opens your own chat with the message ready.</p><div class=ckg id=ck_g>'+(team.length?team.map(function(t,i){return '<div class=ckr><b>'+h(t.name)+'</b><small>+'+h(t.phone)+'</small><span><button type=button class=ckd data-i='+i+' data-w=desk>Ask (desk)</button><button type=button data-i='+i+' data-w=me>My WhatsApp</button></span></div>'}).join(""):'<p style="grid-column:1/-1">No one on your team list yet. Add them below.</p>')+'</div><div class=cka><input id=ck_n placeholder="Name" maxlength=40 autocomplete=off><input id=ck_p placeholder="Phone, e.g. 0501234567" inputmode=tel maxlength=20 autocomplete=off></div><button type=button class=ckx id=ck_add>Add to my team</button>'+(team.length?'<button type=button class=ckx id=ck_ed>Remove someone</button>':'')+'<p class=ckm id=ck_m></p></div>';document.body.appendChild(bg);
var m=document.getElementById("ck_m");
[].forEach.call(bg.querySelectorAll("#ck_g [data-i]"),function(x){x.onclick=function(){var t=team[+x.getAttribute("data-i")],w=x.getAttribute("data-w");if(bg.getAttribute("data-rm")){if(!confirm("Remove "+t.name+" from your team list?"))return;var L=team.filter(function(y){return y!==t});capi({action:"ck_team",team:L}).then(function(j){draw(b,j.team||L)});return}
if(w==="desk"){m.style.color="#5F6B66";m.textContent="Sending from the desk...";var od={action:"ck_desk",person:t.name};for(var kd in b)od[kd]=b[kd];capi(od).then(function(j){if(!j.ok){m.style.color="#B4533C";m.textContent=(j.error||"Not sent.")+(j.waiting?" Tap My WhatsApp beside "+t.name+".":"");return}m.style.color="#1F8F5F";m.textContent="\u2713 Sent to "+t.name+" from the desk. Their answer shows here.";setTimeout(close,1800)}).catch(function(){m.textContent="No connection."});return}
m.textContent="Opening WhatsApp...";var o={action:"ck_make",person:t.name};for(var k in b)o[k]=b[k];capi(o).then(function(j){if(!j.ok){m.textContent=j.error||"Could not make the link.";return}close();location.href=j.url}).catch(function(){m.textContent="No connection."})}});
document.getElementById("ck_add").onclick=function(){var n=document.getElementById("ck_n").value.trim(),ph=document.getElementById("ck_p").value.trim();if(!n||!ph){m.textContent="Type a name and a phone number.";return}capi({action:"ck_team",team:team.concat({name:n,phone:ph})}).then(function(j){if(!j.ok){m.textContent=j.error||"Not saved.";return}if((j.team||[]).length===team.length){m.textContent="That phone number does not look right, or the name is already on the list.";return}draw(b,j.team)})};
var ed=document.getElementById("ck_ed");if(ed)ed.onclick=function(){bg.setAttribute("data-rm","1");m.textContent="Tap the person to remove.";m.style.color="#5F6B66"}}
document.addEventListener("click",function(e){var x=e.target.closest?e.target.closest("[data-ck]"):null;if(!x)return;e.preventDefault();e.stopPropagation();open(x.getAttribute("data-ck"))},true);
})();`;
