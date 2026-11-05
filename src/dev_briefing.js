// v786a - the developer briefing page (approved mock-up, Operations\Research\Developer_Briefing_Mockup_05NOV2026). Data: KV dbr_<slug> (built from najma.duckdb, same rules as the mock-up NOTES.md).
// Rules: Land Department figures carry their source line and end date; stock only from the developer's own sheet, with its date; missing facts are left off.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const E = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const n = (v) => Number(v || 0).toLocaleString("en-US");
const fdate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? (+m[3]) + " " + MON[+m[2] - 1] + " " + m[1] : ""; };
const ic = (p, s, c) => `<svg viewBox="0 0 24 24" width=${s || 18} height=${s || 18} fill="none" stroke="${c || "#0A4F4A"}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>${p}</svg>`;
const I = { bld: '<path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-5h6v5M8 9h1M15 9h1M8 13h1M15 13h1"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  q: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/>', back: '<path d="M15 18l-6-6 6-6"/>' };
function spark(months) {
  const v = (months || []).map((x) => x[1]); if (v.length < 2) return ""; const mx = Math.max(...v) || 1, w = 120, h = 30;
  const pts = v.map((y, i) => `${(i * (w - 4) / (v.length - 1) + 2).toFixed(1)},${(h - 2 - (y / mx) * (h - 6)).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width=${w} height=${h} aria-hidden=true><polyline points="${pts}" fill="none" stroke="#C5A56A" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
const CSS = `:root{color-scheme:only light}*{box-sizing:border-box}body{margin:0;background:#F7F3EA;color:#1C2826;font:400 15px/1.45 "IBM Plex Sans",system-ui,sans-serif}
.w{max-width:560px;margin:0 auto;padding:14px 16px 40px}.tag{font:600 .66rem "IBM Plex Mono",monospace;letter-spacing:.14em;color:#8A6F3E}
h1{font:600 1.7rem Fraunces,Georgia,serif;color:#0A4F4A;margin:4px 0 2px}h2{font:600 1.05rem Fraunces,Georgia,serif;color:#0A4F4A;margin:22px 0 8px;display:flex;gap:8px;align-items:center}
.sub{color:#5F6B66;font-size:.86rem}.card{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;padding:14px;margin:0 0 10px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kpi{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;padding:12px}.kpi b{display:block;font:600 1.35rem Fraunces,Georgia,serif;color:#0A4F4A}.kpi span{font-size:.76rem;color:#5F6B66}
.src{font:500 .68rem "IBM Plex Mono",monospace;color:#8A6F3E;margin-top:6px}.pr{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.pr .n{font:600 .98rem Fraunces,Georgia,serif}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.chip{font:600 .7rem "IBM Plex Sans",sans-serif;border:1px solid #C5A56A;color:#8A6F3E;border-radius:999px;padding:2px 9px;text-decoration:none}.chip.t{border-color:#0A4F4A;color:#0A4F4A}
.ins{border-left:3px solid #C5A56A}.ins p{margin:0;font-size:.92rem}.ins b{color:#0A4F4A}.btn{display:flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:13px;font:600 .95rem "IBM Plex Sans",sans-serif;text-decoration:none}
.btn.p{background:#0A4F4A;color:#fff}.qa{display:grid;grid-template-columns:1fr 1fr;gap:8px}.qa .card{margin:0;font-size:.86rem}
.hd{background:#0A4F4A;color:#fff;border-radius:18px;padding:16px;margin-bottom:12px}.hd h1{color:#fff;margin:2px 0}.hd .sub{color:#D9E5E2}.hd .tag{color:#C5A56A}.hd .chip{color:#fff}
.note{font-size:.78rem;color:#5F6B66}.bk{display:inline-flex;align-items:center;gap:4px;color:#0A4F4A;font-weight:600;text-decoration:none;font-size:.88rem;margin-bottom:8px}`;
const page = (title, body) => `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=color-scheme content="only light"><title>${E(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel=stylesheet><style>${CSS}</style></head><body><div class=w>${body}</div></body></html>`;

export async function briefingPage(env, url) {
  const Q = "?key=" + encodeURIComponent(url.searchParams.get("key") || ""), dev = String(url.searchParams.get("dev") || "").trim();
  let idx = {}; try { idx = JSON.parse((await env.MEETINGS.get("dbr_index")) || "{}"); } catch (e) {}
  const name = Object.keys(idx).find((k) => k.toLowerCase() === dev.toLowerCase()) || Object.keys(idx).find((k) => dev.toLowerCase().includes(k.toLowerCase()));
  const back = `<a class=bk href="/momo/work${Q}">${ic(I.back, 16)}Today</a>`;
  let x = null; if (name) { try { x = JSON.parse((await env.MEETINGS.get("dbr_" + idx[name])) || "null"); } catch (e) {} }
  if (!x) return page("Briefing", back + `<h1>${E(dev || "Briefing")}</h1><div class=card>There is no briefing for this developer yet. Briefings are ready for: ${E(Object.keys(idx).join(", "))}.</div>`);
  const SRC = "Land Department register · to " + fdate(x.reg_to), when = url.searchParams.get("time") || "";
  const o = [back, `<div class=hd><div class=tag>BRIEFING FOR YOUR VISIT</div><h1>${E(x.brand)}</h1>${when ? `<div class=sub>Today · ${E(when)}</div>` : ""}<div class=chips style="margin-top:10px"><a class=chip href="/momo/work/rec${Q}">Record the visit</a></div></div>`];
  o.push(`<h2>${ic(I.chart)}At a glance · 2026 so far</h2><div class=g2><div class=kpi><b>${n(x.sales)}</b><span>sales registered</span></div><div class=kpi><b>AED ${n(x.psf)}</b><span>median per sq ft</span></div><div class=kpi><b>${x.offplan}%</b><span>bought off-plan</span></div><div class=kpi><b>${n(x.projects_selling)}</b><span>projects selling</span></div></div><div class=src>${E(SRC)}</div>`);
  o.push(`<h2>${ic(I.bld)}Their projects</h2>`);
  for (const p of x.top || []) {
    const a = (x.avail || []).find((a) => a.project && p.name.toLowerCase().includes(a.project.split(" ")[0].toLowerCase()));
    const m = p.months || [], lab = m.length > 1 ? `Monthly pace ${MON[m[0][0] - 1]}–${MON[m[m.length - 1][0] - 1]} · ` : "";
    o.push(`<div class=card><div class=pr><div><div class=n>${E(p.name)}</div><div class=sub>${E(p.area)}</div></div>${spark(m)}</div><div class=chips><span class="chip t">${n(p.sales)} sales</span>${p.psf ? `<span class=chip>AED ${n(p.psf)}/sq ft</span>` : ""}${p.handover ? `<span class="chip t">Handover ${E(p.handover)}</span>` : ""}${a ? `<span class=chip>${n(a.units)} units on their sheet · ${E(fdate(a.sheet_date))}</span>` : ""}</div><div class=src>${E(lab + SRC)}</div></div>`);
  }
  if ((x.avail || []).length) {
    o.push(`<h2>${ic(I.box)}Stock on their sheet</h2><div class=card>` + x.avail.map((a) => `<div class=pr style="padding:6px 0;border-top:1px solid #EFE9DE"><span>${E(a.project)}</span><span class=sub>${n(a.units)} units${a.psf ? " · AED " + n(a.psf) + "/sq ft" : ""}</span></div>`).join("") + `<div class=src>${E(x.brand)} availability sheet · ${E(fdate(x.avail[0].sheet_date))}</div></div>`);
  } else o.push(`<div class="card note">No ${E(x.brand)} availability sheet in the developer group yet: ask them to add one, so stock left shows here.</div>`);
  if ((x.insights || []).length) { o.push(`<h2>${ic(I.eye)}What they may not know</h2>`); for (const s of x.insights) o.push(`<div class="card ins"><p><b>${E(s.b)}</b> ${E(s.t)}</p><div class=src>${E(s.src === "both" ? x.brand + " availability sheet · " + SRC : SRC)}</div></div>`); }
  o.push(`<h2>${ic(I.star)}What you bring them</h2><div class=card><p style="margin:0 0 6px">Buyers who already ask about ${E((x.top[0] || {}).area || "their areas")}, owner campaigns on WhatsApp, and a content calendar that can feature their projects every week.</p><div class=chips><span class="chip t">Weekly content planner</span><span class="chip t">Monday market update</span><span class=chip>Owner campaigns on WhatsApp</span></div></div>`);
  const t0 = (x.top[0] || {}).name || "the top project", t1 = (x.top[1] || {}).name;
  const qs = [`Payment plan on ${t0}${t1 ? " and " + t1 : ""} now?`, "Next release: when and at what price?", "Can you hold units for my buyers?", "A joint video or site walk for my channels?"];
  o.push(`<h2>${ic(I.q)}Questions to ask</h2><div class=qa>` + qs.map((q) => `<div class=card>${E(q)}</div>`).join("") + `</div>`);
  o.push(`<h2>${ic(I.mic)}After the visit</h2><a class="btn p" href="/momo/work/rec${Q}">${ic(I.mic, 18, "#fff")}Record the meeting</a><p class=note style="text-align:center">Minutes, tasks and planner changes follow on their own. Nothing changes without your Yes.</p>`);
  return page(x.brand + " briefing", o.join(""));
}
