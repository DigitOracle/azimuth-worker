// v790 (Kendall 6 Nov 2026: "we were supposed to have that really nice workflow picture in there") - the FN Realty workflow card that rides
// on a desk check-in: the task or planner item as a row of steps (done / you are here / next) with who owns each and its date.
// ckCardModel() is pure (tested); ckCardHtml() is the 1200 x 628 page the renderer screenshots. Names and dates come only from the record.
import { stepsOf, doneSet, ownerOf, fmtDay } from "./content_planner.js";
import { FN_LOGO_B64, FN_LATTICE_B64, FN_NAVY, FN_PEACH, FN_GOLD } from "./fn_logo.js";

const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const dm = (iso) => { const d = String(iso || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDay(d).replace(/^\w+ /, "") : ""; };
const ICON = { flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>', pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M5 12l5 5 9-10"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>' };
const STEP_ICON = { "Planned": "flag", "Who & how": "pen", "Brief": "pen", "Made": "pen", "Caption": "pen", "Approved": "eye", "Trial": "clock", "Scheduled": "clock", "Live": "send", "Posted": "send", "Results": "check" };

// rec: { kind: "step", code, step } | { kind: "task", name } | { kind: "test" }; ctx: { item } | { task } | {}; asked = the person being asked
export function ckCardModel(rec, ctx, asked) {
  if (rec && rec.kind === "step" && ctx && ctx.item) {
    const it = ctx.item, all = stepsOf(it), done = doneSet(it), at = all.indexOf(rec.step);
    // at most five circles: the asked step in the middle of what is shown, earlier done steps folded into the first circle
    let from = Math.max(0, Math.min(at - 2, all.length - 5)); const shown = all.slice(from, from + 5);
    const steps = shown.map((s) => ({ label: s, who: first(ownerOf(it, s)), date: s === rec.step ? "" : dm(it.done && it.done[s] && it.done[s].at), state: s === rec.step ? "now" : done.has(s) ? "done" : "next", icon: STEP_ICON[s] || "check" }));
    const live = [fmtDay(it.date), it.time].filter(Boolean).join(" ");
    return { kicker: "Task check-in", title: String(it.code || rec.code || ""), accent: String(it.topic || "").slice(0, 44), steps,
      foot: "Step " + (at + 1) + " of " + all.length + (live ? "  ·  Goes out " + live : "") };
  }
  if (rec && rec.kind === "task" && ctx && ctx.task) {
    const t = ctx.task, stuck = t.status === "Stuck", pct = Math.max(0, Math.min(100, +t.percent || 0));
    const steps = [{ label: "Started", who: first((t.owners || [])[0] || "Najjuko"), date: "", state: "done", icon: "flag" },
      { label: stuck ? "Stuck" : "In progress", who: first(asked), date: pct + "%", state: "now", icon: stuck ? "clock" : "pen" },
      { label: "Done", who: "", date: t.due ? "Due " + dm(t.due) : "", state: "next", icon: "check" }];
    return { kicker: "Task check-in", title: String(t.name || rec.name || "").slice(0, 46), accent: "", steps, foot: (t.due ? "Due " + fmtDay(t.due) : "No due date set") + "  ·  " + pct + "% so far" };
  }
  return { kicker: "Task check-in · test", title: "FD-12", accent: "DAMAC Lagoons reel", foot: "Step 3 of 4  ·  Sample only", steps: [
    { label: "Brief set", who: "Najjuko", date: "3 Nov", state: "done", icon: "flag" }, { label: "Footage shot", who: "Najjuko", date: "5 Nov", state: "done", icon: "pen" },
    { label: "Edit", who: first(asked) || "You", date: "Due today", state: "now", icon: "eye" }, { label: "Goes live", who: "Najjuko", date: "7 Nov", state: "next", icon: "send" }] };
}

export function ckCardHtml(m) {
  const n = Math.max(1, m.steps.length), big = n <= 4, colW = Math.floor(1160 / n), dot = big ? 92 : 78;
  const svg = (k, c) => '<svg viewBox="0 0 24 24" width="' + (big ? 34 : 30) + '" height="' + (big ? 34 : 30) + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICON[k] || ICON.check) + "</svg>";
  const lastDone = m.steps.map((s) => s.state).lastIndexOf("done"), nowAt = m.steps.findIndex((s) => s.state === "now"), upto = Math.max(lastDone, nowAt);
  const pct = n > 1 ? Math.round((Math.max(0, upto) / (n - 1)) * 100) : 0;
  const node = (s) => { const bg = s.state === "done" ? FN_NAVY : s.state === "now" ? FN_PEACH : "#fff", fg = s.state === "done" ? "#fff" : FN_NAVY;
    return '<div class="st ' + s.state + '" style="width:' + colW + 'px"><div class=dot style="width:' + dot + "px;height:" + dot + "px;background:" + bg + ";border-color:" + (s.state === "next" ? FN_GOLD : bg) + '">' + svg(s.icon, fg) + "</div>"
      + "<div class=t>" + esc(s.label) + "</div><div class=w>" + esc(s.who) + "</div><div class=d>" + esc(s.date) + "</div>" + (s.state === "now" ? "<div class=you>You are here</div>" : "") + "</div>"; };
  return '<!doctype html><html><head><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap" rel=stylesheet><style>'
    + "*{box-sizing:border-box;margin:0}body{width:1200px;height:628px;background:#FBF6EE;font-family:Inter,Arial,sans-serif;color:" + FN_NAVY + ";position:relative;overflow:hidden}"
    + ".band{height:44px;background:url(" + FN_LATTICE_B64 + ") repeat-x;background-size:auto 44px}.logo{position:absolute;top:62px;right:52px;height:64px}"
    + ".k{position:absolute;top:62px;left:60px;font-size:24px;letter-spacing:3px;color:" + FN_GOLD + ";font-weight:700;text-transform:uppercase}"
    + "h1{position:absolute;top:92px;left:60px;right:150px;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:" + ((m.title + m.accent).length > 34 ? 50 : 64) + "px;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}h1 span{color:" + FN_PEACH + "}"
    + ".row{position:absolute;top:204px;left:20px;right:20px;display:flex;justify-content:space-between}"
    + ".line{position:absolute;top:" + (204 + dot / 2 - 3) + "px;left:" + (20 + colW / 2) + "px;right:" + (20 + colW / 2) + "px;height:6px;border-radius:3px;background:linear-gradient(90deg," + FN_NAVY + " 0 " + pct + "%," + FN_GOLD + " " + pct + "% 100%)}"
    + ".st{text-align:center;position:relative}.dot{border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;border:4px solid}.now .dot{box-shadow:0 0 0 10px rgba(242,196,143,.35)}"
    + ".t{font-weight:700;font-size:" + (big ? 38 : 30) + "px;line-height:1.1}.w{font-size:" + (big ? 34 : 27) + "px;margin-top:5px}.d{font-size:" + (big ? 32 : 25) + "px;color:#4a4a4a;margin-top:2px;font-weight:600;min-height:1em}"
    + ".you{display:inline-block;margin-top:10px;background:" + FN_NAVY + ";color:#fff;font-size:" + (big ? 26 : 22) + "px;font-weight:700;padding:6px 14px;border-radius:20px}"
    + ".foot{position:absolute;bottom:0;left:0;right:0;height:76px;background:" + FN_NAVY + ";color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 50px;font-size:30px}.foot b{color:" + FN_PEACH + ";font-weight:600}"
    + "</style></head><body><div class=band></div><img class=logo src=\"" + FN_LOGO_B64 + "\"><div class=k>" + esc(m.kicker) + "</div><h1>" + esc(m.title) + (m.accent ? " <span>" + esc(m.accent) + "</span>" : "") + "</h1>"
    + "<div class=line></div><div class=row>" + m.steps.map(node).join("") + "</div><div class=foot><b>" + esc(m.foot) + "</b><span>FN Realty</span></div></body></html>";
}
