// v637 - MOMO WORK - JOBS, the two drafting helpers (Kendall 27 Oct 2026): "What I do" (her Work log turned into suggested CV lines she approves) and "Create CV" (a draft CV for one advert).
// PRIVACY (Kendall: "keep it for her only"): everything here is reachable ONLY with Najjuko's own key; the owner's insider key gets 404 (work_jobs.js gate). The approved lines live in her own KV key.
// THIS REPO IS PUBLIC: no person's details are in code. The Work log is read through deps.listEntries (passed in by workRoute), the model through deps.claudeJSON (stubbed in tests).
export const WHATIDO_KEY = "jobs_whatido_najjuko";
const S = (v, n) => String(v == null ? "" : v).slice(0, n);

export const emptyWhat = () => ({ v: 1, updatedAt: "", lines: [], skills: [] });
export function cleanWhat(w) {
  w = w && typeof w === "object" ? w : {};
  const seen = new Set(), lines = [];
  (Array.isArray(w.lines) ? w.lines : []).slice(0, 80).forEach((l, i) => {
    const text = S(l && l.text, 240).replace(/\s+/g, " ").trim(); if (!text || seen.has(text.toLowerCase())) return; seen.add(text.toLowerCase());
    lines.push({ id: S(l && l.id, 12) || "l" + i, text, state: l && l.state === "keep" ? "keep" : "suggested" });
  });
  const skills = [...new Set((Array.isArray(w.skills) ? w.skills : []).map((x) => S(x, 40).replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 40);
  return { v: 1, updatedAt: S(w.updatedAt, 30), lines, skills };
}
export async function readWhat(env) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(WHATIDO_KEY)); } catch (e) {} return r ? cleanWhat(r) : emptyWhat(); }

// A suggested line must be general. Anything that still carries a name from the Work log's own lists, a money amount or a long number is dropped (the model is told, this is the backstop).
export function generalise(lines, names) {
  const bad = (names || []).map((n) => String(n).toLowerCase()).filter((n) => n.length >= 3);
  return (lines || []).map((t) => S(t, 240).replace(/\s+/g, " ").trim()).filter((t) => {
    const low = t.toLowerCase();
    if (!t || /\b(aed|usd|dhs?)\b|\d{5,}|https?:\/\//i.test(t)) return false;
    return !bad.some((n) => low.includes(n));
  });
}

const WHAT_SCHEMA = { type: "object", additionalProperties: false, required: ["lines", "skills"], properties: { lines: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } } } };
const WHAT_SYS = "You turn one professional's own work-log entries into short, honest CV lines. Rules: use only what the entries show; each line is one sentence of 10 to 25 words starting with a strong verb; "
  + "GENERALISE: never name a client, colleague, company, project, listing, building or campaign, and never give a money amount, price or internal figure; describe the kind of work, the kind of team or counterpart, and the "
  + "regular frequency in words (weekly, monthly) only when the counts given support it. 8 to 14 lines, no duplicates. Also list up to 15 skills as 1 to 3 word labels. Plain business English.";

export async function whatApi(env, b, deps) {
  const action = S(b && b.action, 20);
  if (action === "save") { const w = cleanWhat(b); w.updatedAt = new Date().toISOString(); await env.MEETINGS.put(WHATIDO_KEY, JSON.stringify(w)); return { ok: true, what: w }; }
  if (action === "suggest") {
    if (typeof deps.listEntries !== "function" || typeof deps.claudeJSON !== "function") return { error: "Not available right now.", status: 503 };
    const es = (await deps.listEntries(env, "", "")).slice(0, 150);
    if (!es.length) return { error: "Nothing in your Work log yet, so there is nothing to build from.", status: 400 };
    const byType = {}; es.forEach((e) => { const t = S(e.type, 30) || "Other"; byType[t] = (byType[t] || 0) + 1; });
    const kp = {}; es.forEach((e) => (e.kpis || []).forEach((k) => { const n = (deps.kpiName ? deps.kpiName(k) : "Focus area " + k); kp[n] = (kp[n] || 0) + 1; }));
    const facts = "Entries: " + es.length + ". By type: " + JSON.stringify(byType) + ". By focus area: " + JSON.stringify(kp) + ".\n\nEntries (title - summary):\n"
      + es.map((e) => "- " + S(e.title, 90) + " - " + S(e.summary, 260)).join("\n").slice(0, 14000);
    let x = null; try { x = await deps.claudeJSON(env, WHAT_SYS, facts, WHAT_SCHEMA, deps.model, 1500); } catch (e) {}
    if (!x || !Array.isArray(x.lines)) return { error: "Could not read the log just now. Try again in a minute.", status: 502 };
    const cur = await readWhat(env), keep = cur.lines.filter((l) => l.state === "keep"), have = new Set(keep.map((l) => l.text.toLowerCase()));
    const add = generalise(x.lines, deps.names).filter((t) => !have.has(t.toLowerCase())).slice(0, 16).map((t, i) => ({ id: "s" + Date.now().toString(36) + i, text: t, state: "suggested" }));
    const skills = [...new Set(cur.skills.concat(generalise(Array.isArray(x.skills) ? x.skills : [], deps.names).map((s) => S(s, 40))))].slice(0, 40);
    const w = cleanWhat({ lines: keep.concat(add), skills }); w.updatedAt = new Date().toISOString();
    await env.MEETINGS.put(WHATIDO_KEY, JSON.stringify(w)); return { ok: true, what: w, from: es.length };
  }
  return { error: "Unknown action.", status: 400 };
}

const CV_SCHEMA = { type: "object", additionalProperties: false, required: ["headline", "profile", "bullets", "skills", "gaps"], properties: {
  headline: { type: "string" }, profile: { type: "string" }, bullets: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } }, gaps: { type: "array", items: { type: "string" } } } };
const CV_SYS = "You draft a tailored CV for one job advert from a person's own record. Facts you may use: ONLY the record given (her details, the approved experience lines and skills). You may reword, reorder and emphasise to match the advert. "
  + "You must NOT invent or imply any employer, job title, date, number, qualification, tool or achievement that is not in the record. Output: a one-line headline; a profile of 3 to 4 lines; 6 to 8 achievement bullets drawn from the approved lines and ordered by "
  + "relevance to the advert; a skills list ordered to match the advert; and 'gaps': each requirement in the advert for which the record shows no evidence (short phrases) so the person can address it in her cover letter. "
  + "Plain business English, no jargon, no mention of any AI, tool or vendor.";

export async function cvDraftApi(env, b, deps, rec, opts) {
  const title = S(b && b.title, 200).trim(), company = S(b && b.company, 120).trim(), desc = S(b && b.desc, 6000).replace(/\s+/g, " ").trim(), group = S(b && b.group, 4);
  if (!title) return { error: "Choose a role first.", status: 400 };
  if (desc.length < 80) return { error: "Paste the advert text first (the description is too short).", status: 400 };
  if (typeof deps.claudeJSON !== "function") return { error: "Not available right now.", status: 503 };
  // v639 - the Work-log lines ('What I do') belong to the one person who has a Work log; anyone else drafts from their own record: bio plus their own letter facts (proof lines)
  const own = !(opts && opts.what === false), what = own ? await readWhat(env) : { lines: [], skills: [] }, p = (rec && rec.profile) || {};
  let keep = what.lines.filter((l) => l.state === "keep").map((l) => l.text);
  if (!own) { const lt = (rec && rec.tpl && rec.tpl.letters) || {}; keep = Object.keys(lt).map((g) => S(lt[g] && lt[g].proof, 600).trim()).filter(Boolean).slice(0, 8); }
  if (!keep.length && !p.bio) return { error: own ? "Approve some lines under 'What I do' first, or add a short bio to your details, so the draft has facts to work from." : "Add a short bio or your letter wording to your details first, so the draft has facts to work from.", status: 400 };
  const record = "Record (the only facts allowed):\nName: " + S(p.name, 80) + "\nCurrent headline: " + S(p.headline, 120) + "\nLocation: " + S(p.location, 60) + "\nBio: " + S(p.bio, 800)
    + "\nTeam: " + (p.direct ? S(p.direct, 6) + " direct reports" : "") + (p.indirect ? ", " + S(p.indirect, 6) + " indirect" : "")
    + "\nApproved experience lines:\n" + (keep.length ? keep.map((t) => "- " + t).join("\n") : "(none)") + "\nSkills: " + what.skills.join(", ");
  const user = record + "\n\nJob advert for " + title + (company ? " at " + company : "") + (group ? " (group " + group + ")" : "") + ":\n" + desc;
  let x = null; try { x = await deps.claudeJSON(env, CV_SYS, user, CV_SCHEMA, deps.model, 1800); } catch (e) {}
  if (!x || typeof x !== "object" || !Array.isArray(x.bullets)) return { error: "Could not draft just now. Try again in a minute.", status: 502 };
  const list = (a, n, m) => (Array.isArray(a) ? a : []).map((t) => S(t, m).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, n);
  return { ok: true, draft: { headline: S(x.headline, 140).trim(), profile: S(x.profile, 700).trim(), bullets: list(x.bullets, 10, 260), skills: list(x.skills, 20, 40), gaps: list(x.gaps, 10, 160) } };
}
