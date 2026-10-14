// v564 MOMO WORK (Kendall 14 Oct 2026): Najjuko's FN Realty work log. "For each day ... any meetings, any updates, anything she
// organizes, anything that she does ... enter in that activity, and then it needs to map directly to her KPIs ... and FN Realty's
// overall goals ... at the end of the week, she could create a report of her activities."
// Private to Najjuko's own link (Kendall's choice, 14 Oct): nobody else, the owner included, can read the log.
// The reference data below comes from "FN Realty – HANDOVER.md" (14 Oct 2026): contract V1.2 Schedule 1 (scope), Schedule 2 (review
// framework, soft ratings, no weights) and org chart draft v8. No ID numbers, salary slips or personal documents are held here.

export const KPIS = [
  { id: 1, name: "Marketing direction", good: "A clear marketing strategy guiding activity; a sharper, more consistent advisory story", ev: "Strategy and plan shared with leadership; regular updates" },
  { id: 2, name: "Content & creative", good: "A steady content rhythm; a recognisable look; video directed and produced with the videographer", ev: "Content calendar; published content" },
  { id: 3, name: "Digital growth", good: "Reach, engagement and community on @fn.realty trending up against the Sept 2026 audit (2,785 followers; median 54 engagements a post)", ev: "Instagram and Meta insights, read as a trend" },
  { id: 4, name: "PR & leadership visibility", good: "Key messages agreed; media relationships started; stories pitched; leaders more visible", ev: "Pitch and activity log; coverage, appearances, articles" },
  { id: 5, name: "Growth, visibility & partnerships", good: "Opportunities identified and shared; speaking building the profile; relationships and AI ideas brought in", ev: "Opportunity notes, engagement log, introductions" },
];
export const SCOPE = [
  { id: "m1", area: "Marketing", name: "Marketing" }, { id: "m2", area: "Marketing", name: "Content & Creative Production" },
  { id: "m3", area: "Marketing", name: "Digital Growth & Distribution" }, { id: "p1", area: "PR", name: "PR Strategy" },
  { id: "p2", area: "PR", name: "Media Relations & Press Office" }, { id: "p3", area: "PR", name: "Leadership Visibility & Thought Leadership" },
  { id: "p4", area: "PR", name: "Stakeholder & Community Relations" }, { id: "b1", area: "Business Development", name: "Growth Strategy & Markets" },
  { id: "b2", area: "Business Development", name: "Strategic Visibility & Partnerships" }, { id: "b3", area: "Business Development", name: "AI-Enabled Growth" },
  { id: "b4", area: "Business Development", name: "Events & Community Impact" },
];
export const PEOPLE = [
  ["Ali Kalhor", "Managing Director (her manager)", "manager"], ["Faez Noorzad", "General Manager, part-owner", "owner"], ["Sultan Ahmad Noorzad", "Co-Founder", "owner"],
  ["Sousan Khatibzadeh", "Social Media Management", "team"], ["Vishant Singh", "Editor / Head of Visuals", "team"], ["Monaza", "Graphic Designer (remote)", "team"],
  ["Nare Kirakosyan", "On-camera presenter", "team"], ["Akash", "Lead Generation & Campaigns (dotted line)", "dotted"], ["Karim", "Video editing support", "team"],
  ["Fatu", "External consultant, sales structure (dotted line)", "dotted"], ["Ilona Dorothy Biro", "Team Leader, Premium team; Business Development", "peer"],
  ["Ruzanna Avanyan (Rose)", "Sales Team Leader", "sales"], ["Ellie", "Sales Team Leader", "sales"], ["Savia Gomes", "HR, Admin & Compliance", "admin"],
  ["Khadija", "Temporary HR cover", "admin"], ["Jaffer", "PRO (government relations)", "admin"], ["Mekhrona Sharipova", "Front desk", "admin"],
  ["Raihana Taheri", "Office assistant", "admin"], ["Nousheen", "PR contact", "external"], ["Babak Hassan", "Premium team", "sales"],
  // v564 (Kendall 14 Oct: "the breast cancer ... directly touches the employee Sally ... interrogate it to ensure that you're capturing everything") - every agent by name
  ...["Revant Vaish", "Hanieh Haghighi", "Youssef Farouk", "Adnan Shafi", "Najibullah Musa Jan", "Sally Zehil", "Irfan Sayyed", "Akrama Ahmad Ijaz", "Abubakar Irfan", "Hafiz Muhammad", "Parminder Kaur", "Seyedeh Elham"].map((n) => [n, "Sales agent, Rose's team", "sales"]),
  ...["Hussien Alfayadh", "Igwenagha Ogochukwu", "Mina Rahimi", "Charry Enriquez Poquita", "Sadaf Kazi", "Sunny Fernandes", "Amir Nadiri", "Syed Ali Mudassir", "Simran Singh", "Haidy Essam", "Khatija Musa Habib"].map((n) => [n, "Sales agent, Ellie's team", "sales"]),
  ["Zumer Balkan", "Role to confirm", "other"], ["Rouba Hochane", "Candidate, Property Management Coordinator", "external"], ["All sales agents", "The whole sales floor", "sales"],
];
// v566 (Kendall 14 Oct: "a card per department ... check on the tasks that are relevant for that particular department ... run meetings ... chase people down")
export const DEPTS = ["Leadership", "Marketing", "Sales", "HR, Admin & Compliance", "External"];
const DEPT_OF = { manager: "Leadership", owner: "Leadership", team: "Marketing", dotted: "Marketing", sales: "Sales", peer: "Sales", admin: "HR, Admin & Compliance", external: "External", other: "External" };
export const deptOf = (name) => { if (name === "Fatu") return "Sales"; const p = PEOPLE.find((x) => x[0] === name); return p ? DEPT_OF[p[2]] || "External" : "External"; };
// FN Realty's campaigns and running tasks (task board, 14 Oct 2026), so an entry links to the work it belongs to
export const WORKS = ["Employment agreement", "Org chart", "90-day plan", "Execution Team hiring (videographer, designer)", "Social content pillars and calendar",
  "Breast Cancer Awareness (October)", "Halloween (31 Oct)", "November 30/30", "December campaign (UAE National Day)", "Team building: bowling", "Quarterly top-agent appreciation",
  "Monday Weekly Huddle", "Business Development needs proposal", "PR launch: Faez and Sultan", "Brand and digital footprint", "Peer brokerage benchmark",
  "Property Management Coordinator hire", "Meeting recording pipeline", "Big 5 Global (23-26 Nov)"];
export const PHASES = [
  { name: "Month 1 · Foundation", from: "2026-10-02", to: "2026-11-01", aim: "Execution Team in place; Instagram audit refreshed; strategy, key messages and spokespeople agreed" },
  { name: "Month 2 · Build", from: "2026-11-02", to: "2026-12-01", aim: "Content and video rhythm running; media outreach and speaking pipeline; first scan of growth opportunities" },
  { name: "Month 3 · Grow & Review", from: "2026-12-02", to: "2027-01-01", aim: "Refine using the data; leadership visibility and AI ideas; day-75 review and renewal" },
];
export const REVIEW_DUE = "2026-12-15", TERM_END = "2027-01-01";
const TYPES = ["Meeting", "Deliverable", "Update", "Organising", "Outreach", "Event", "Other"];
// v565 (Najjuko 14 Oct: "my videographer ... will say 50% ... I need to be able to communicate, I started this task ... it took five days") -
// each entry moves its tasks on (status + percent) and carries a rough effort, so a task shows how far along it is and how many days it took
export const STATUS = ["Started", "In progress", "Waiting on others", "Done"];
export const EFFORT = [["Under 1 hour", 0.5], ["1-2 hours", 1.5], ["Half a day", 4], ["Full day", 8]];

// v571 (Kendall 14 Oct: "time of day, the department it affects, who I did this with or by myself, within or outside scope, third parties off-site")
export const TIMES = ["Morning", "Midday", "Afternoon", "Evening", "Unspecified"];
// v571 (Kendall 14 Oct: "if it's outside of role ... sales, HR ... map this back to the contract ... she will be using these for negotiating").
// Outside-role work is logged with WHICH role it was and the contract line it sits against, so the log is evidence at the review.
export const OUT_ROLES = [
  ["Sales agent", "Selling or showing property as a broker (clause 5.3: her own leads 70/30; Company leads 50/50)"],
  ["Execution Team (hands-on)", "Filming, editing, design, publishing, comments and DMs (clause 2.3: hands-on work belongs to the Execution Team; clause 3.1: Company provides it)"],
  ["HR, Admin & Compliance", "Reception, admin, permits, visas (Schedule 4: Admin & compliance, not the Strategic Lead)"],
  ["Finance", "Invoices, payments, collections (no finance duty in Schedule 1)"],
  ["Leadership / management decisions", "Deciding, negotiating or contracting for the Company (Schedule 4: Company management is accountable)"],
  ["Own ventures", "Her own brands and the Najma feed (clauses 12.2 and 12.4: hers, separate from FN)"],
  ["Other", "Anything else outside the eleven parts of Schedule 1"],
];
const SCHEMA = { type: "object", additionalProperties: false, required: ["title", "type", "summary", "people", "kpis", "scope", "works", "deliverables", "evidence", "next", "questions", "time_of_day", "alone", "in_scope", "external"], properties: {
  time_of_day: { type: "string", enum: TIMES }, alone: { type: "boolean" }, in_scope: { type: "boolean" }, out_role: { type: "string" },
  external: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "kind", "person"], properties: { name: { type: "string" }, kind: { type: "string" }, person: { type: "string" } } } },
  works: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "string" } },
  effort: { type: "string", enum: EFFORT.map((x) => x[0]) },
  prep: { type: "object", additionalProperties: false, required: ["needed", "developer", "project", "area", "event"], properties: { needed: { type: "boolean" }, developer: { type: "string" }, project: { type: "string" }, area: { type: "string" }, event: { type: "string" } } },
  progress: { type: "array", items: { type: "object", additionalProperties: false, required: ["work", "status", "percent", "owners"], properties: { work: { type: "string" }, status: { type: "string", enum: STATUS }, percent: { type: "integer" }, owners: { type: "array", items: { type: "string" } } } } },
  title: { type: "string" }, type: { type: "string", enum: TYPES }, summary: { type: "string" },
  people: { type: "array", items: { type: "string" } }, kpis: { type: "array", items: { type: "integer" } },
  scope: { type: "array", items: { type: "string" } }, deliverables: { type: "array", items: { type: "string" } },
  evidence: { type: "array", items: { type: "string" } }, next: { type: "array", items: { type: "string" } } } };
// v570 (Kendall 14 Oct: "she entered in a whole day at once ... multiple meetings, briefings, phone calls") - the model returns ONE ENTRY PER ACTIVITY
const DAY_SCHEMA = { type: "object", additionalProperties: false, required: ["entries"], properties: { entries: { type: "array", items: SCHEMA } } };

function sysPrompt() {
  return "You file work-log entries for Serah Najjuko Ganyana, Strategic Lead - Marketing, PR & Business Development at FN Realty (a Dubai off-plan real estate advisory). "
    + "She reports to Ali Kalhor. Her role is strategic: she strategises, manages, delegates and reviews; hands-on work belongs to the Execution Team.\n"
    + "She often types a WHOLE DAY in one go: several meetings, calls, briefings, posts, chases. SPLIT it: one entry per distinct activity (a meeting, a call, a deliverable, an event, a chase), "
    + "in the order she wrote them. Two sentences about the same meeting are one entry; a meeting and then a call to someone else are two. A single activity gives a one-entry list. Never merge unrelated activities.\n"
    + "Her five review focus areas (kpis, use the numbers):\n" + KPIS.map((k) => k.id + ". " + k.name + ": " + k.good + ". Evidence: " + k.ev).join("\n")
    + "\nThe eleven parts of her role (scope, use the ids):\n" + SCOPE.map((s) => s.id + " = " + s.area + ": " + s.name).join("\n")
    + "\nPeople (use these exact names when the entry mentions them, including first names, nicknames or roles):\n" + PEOPLE.map((p) => p[0] + " - " + p[1]).join("\n")
    + "\nFN Realty campaigns and running work (works, use these exact names):\n" + WORKS.join("\n")
    + "\nRead the entry closely and capture EVERYTHING: every person named, even by first name only (Sally = Sally Zehil); every campaign it touches; anything produced. "
    + "A huddle or all-hands touches 'All sales agents' and the team leaders. Where one person is ambiguous or something material is missing (who attended, the outcome, a decision, a file, a date), "
    + "put up to three short, specific questions in questions; otherwise leave questions empty. Never ask about something the entry already answers."
    + "\nworks may also include a NEW task in a few words when the entry is about something not on the list (e.g. 'Rebrand of the office reception'). "
    + "progress: one item per task in works: status (" + STATUS.join(", ") + ") and percent complete as she describes it (started or kicked off about 10, drafted or halfway about 50, sent for approval about 80, finished or delivered 100); "
    + "if the entry gives a percentage, use it; owners: the people who hold or share the task (assigned to, doing it, in collaboration with), from the people list, Najjuko herself not included. effort: a rough time for the whole entry (" + EFFORT.map((x) => x[0]).join(", ") + "), judged from what was done; a meeting plus preparing a deck is about half a day."
    + "\nprep: needed = true when the entry involves a client-facing event or deal with a developer, project or area (an open house, a launch, a viewing, a client meeting about a project); "
    + "developer, project and area as named in the entry (empty string if not named; Imtiaz = Imtiaz Developments, MTI = Imtiaz), event in a few words. Otherwise needed = false with empty strings."
    + "\ntime_of_day: from the entry's own words or a stated clock time (morning, before lunch, at 3pm, after work ...); Unspecified if none. "
    + "alone: true when she did it by herself with no staff or third party involved. in_scope: true when the activity sits inside the eleven parts of her role; false when it is outside them. "
    + "out_role: when in_scope is false, which role she was really doing, exactly one of: " + OUT_ROLES.map((r) => r[0]).join(" | ") + " (attending or running a sales meeting, showing a unit, chasing a client's deal = Sales agent; filming or designing herself = Execution Team (hands-on); reception or paperwork = HR, Admin & Compliance). Empty string when in scope. "
    + "external: companies, organisations or outside people NOT on the FN staff list that she dealt with (a charity, a developer's office, a venue, a journalist, a supplier): name as written, kind in two or three words (charity, developer, venue, media, supplier, client), person if one is named, else empty string. A team member of FN is never external."
    + "\nRules: use only what the entry says; never invent people, figures or outcomes. title: under 8 words. summary: one or two plain sentences in the third person (\"Najjuko ...\"). "
    + "people: everyone she dealt with. kpis: only the areas the activity genuinely advances, usually one or two. deliverables: things she produced (e.g. a PowerPoint). "
    + "evidence: what this adds to her day-75 review evidence, in the review's own words (e.g. 'Strategy and plan shared with leadership'). next: follow-ups the entry mentions. "
    + "Spell out abbreviations. Plain English.";
}

// v570 - without the model, split the day on line breaks, bullets, numbering and "then / after that / also"
export function splitDay(text) {
  const parts = String(text).replace(/\r/g, "").split(/\n+|(?:^|\s)[-•*]\s+|(?:^|\n)\s*\d+[.)]\s+|;\s+|\.\s+(?=(?:then|after that|also|next|later|afterwards|in the afternoon|in the morning|in the evening|after lunch|before lunch|at lunch|at midday|this morning|this afternoon|tonight|at \d)\b)/i)
    .map((s) => s.trim().replace(/^[-•*\d.)\s]+/, "")).filter((s) => s.length > 3);
  return parts.length ? parts : [String(text).trim()];
}
// keyword fallback when the writing model is unavailable: still files the entry, marked for her to check
function fallback(text) {
  const t = text.toLowerCase(), kp = new Set(), sc = new Set();
  if (/strateg|plan|positioning|message/.test(t)) { kp.add(1); sc.add("m1"); }
  if (/content|video|film|edit|design|creative|calendar|shoot/.test(t)) { kp.add(2); sc.add("m2"); }
  if (/instagram|social|followers|engagement|post|reel|tiktok|linkedin/.test(t)) { kp.add(3); sc.add("m3"); }
  if (/press|media|pr\b|journalist|pitch|interview|podcast|article/.test(t)) { kp.add(4); sc.add("p2"); }
  if (/partner|event|speak|developer|opportunit|referral|network|ai\b/.test(t)) { kp.add(5); sc.add("b2"); }
  if (/huddle|team|staff|internal|meeting/.test(t)) { kp.add(1); sc.add("p4"); }
  const allHands = /huddle|all[- ]hands|whole team|the agents|sales floor/.test(t);
  // v570.1 - whole words only ("Ali" must not match "Syed Ali Mudassir" or "Alfayadh"); the full name or a distinctive first name counts
  const hasWord = (w) => new RegExp("(^|[^a-z])" + w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)").test(t);
  const firstNames = PEOPLE.map((p) => p[0].split(/[ (]/)[0].toLowerCase());
  const people = PEOPLE.filter((p) => { const full = p[0].replace(/\s*\(.*\)$/, ""); const first = full.split(" ")[0]; const nick = /\((\w+)\)/.exec(p[0]);
    if (hasWord(full)) return true; if (nick && hasWord(nick[1])) return true;
    return first.length > 2 && firstNames.filter((f) => f === first.toLowerCase()).length === 1 && hasWord(first); }).map((p) => p[0]);
  const works = WORKS.filter((w) => w.toLowerCase().split(/[ ():,]+/).some((x) => x.length > 5 && t.indexOf(x) >= 0));
  const pm = /(open house|launch|viewing|site visit|roadshow)/.exec(t), dv = /\b(imtiaz|mti|emaar|damac|sobha|nakheel|meraas|binghatti|danube|ellington|aldar|azizi|samana|omniyat|select)\b/.exec(t);
  if (allHands && people.indexOf("All sales agents") < 0) people.push("All sales agents");
  const pct = /(\d{1,3})\s*%/.exec(t), done = /\b(finished|done|delivered|completed|sent it|sent the|signed off)\b/.test(t), started = /\b(started|kicked off|began|initiated|kick-off)\b/.test(t), half = /half ?(done|way|complete)|halfway/.test(t);
  const p0 = pct ? Math.min(100, +pct[1]) : done ? 100 : half ? 50 : started ? 10 : 50;
  const tod = /\b(afternoon|after lunch|[1-5]\s*pm|1[3-7]:\d\d)\b/.test(t) ? "Afternoon" : /\b(evening|tonight|after work|[6-9]\s*pm|1[89]:\d\d|2[0-2]:\d\d)\b/.test(t) ? "Evening" : /\b(morning|breakfast|first thing|before lunch|\d{1,2}\s*am|0?[6-9]:\d\d|1[01]:\d\d)\b/.test(t) ? "Morning" : /\b(lunch|midday|noon|12\s*pm|12:\d\d)\b/.test(t) ? "Midday" : "Unspecified";
  const outside = /\b(my own|personal|reception|errand|outside (my )?scope|not my job|her recode|najjuko edit|be by her|as an agent|showed? (a|the) unit|viewing with (a|the|my) client|sales meeting)\b/.test(t);
  const outRole = !outside ? "" : /reception|paperwork|visa|permit/.test(t) ? "HR, Admin & Compliance" : /as an agent|showed? (a|the) unit|viewing with|sales meeting|client'?s deal/.test(t) ? "Sales agent" : /her recode|najjuko edit|be by her|my own brand/.test(t) ? "Own ventures" : /filmed|edited|designed it myself|posted it myself/.test(t) ? "Execution Team (hands-on)" : "Other";
  return { title: text.split(/[.\n]/)[0].slice(0, 60), type: /meeting|huddle|call/.test(t) ? "Meeting" : "Update", summary: text.slice(0, 300), people, kpis: [...kp], scope: [...sc], works, deliverables: [], evidence: [], next: [], questions: [], check: true,
    time_of_day: tod, alone: people.length === 0 && !/\bwith\b/.test(t), in_scope: !outside, out_role: outRole, external: [],
    prep: pm || dv ? { needed: true, developer: dv ? (/imtiaz|mti/.test(dv[1]) ? "Imtiaz Developments" : dv[1].replace(/^./, (c) => c.toUpperCase())) : "", project: "", area: "", event: pm ? pm[1] : "" } : null,
    effort: /all day|full day/.test(t) ? "Full day" : /meeting|huddle|deck|powerpoint/.test(t) ? "Half a day" : "1-2 hours",
    progress: works.map((w) => ({ work: w, status: p0 >= 100 ? "Done" : started && !half && !pct ? "Started" : "In progress", percent: p0, owners: people.filter((n) => n !== "All sales agents") })) };
}

function clean(x) {
  const ids = new Set(SCOPE.map((s) => s.id)), names = new Set(PEOPLE.map((p) => p[0]));
  const arr = (a, n) => (Array.isArray(a) ? a : []).map((v) => String(v).slice(0, 200)).filter(Boolean).slice(0, n || 12);
  return { title: String(x.title || "").slice(0, 90), type: TYPES.includes(x.type) ? x.type : "Other", summary: String(x.summary || "").slice(0, 700),
    people: arr(x.people).filter((p) => names.has(p)), kpis: [...new Set((x.kpis || []).map(Number).filter((n) => n >= 1 && n <= 5))],
    scope: [...new Set(arr(x.scope).filter((s) => ids.has(s)))], works: [...new Set(arr(x.works).map((w) => w.slice(0, 80).trim()).filter(Boolean))].slice(0, 6),
    effort: EFFORT.some((e) => e[0] === x.effort) ? x.effort : "1-2 hours",
    time_of_day: TIMES.includes(x.time_of_day) ? x.time_of_day : "Unspecified", alone: !!x.alone, in_scope: x.in_scope !== false,
    out_role: x.in_scope === false ? (OUT_ROLES.some((r) => r[0] === x.out_role) ? x.out_role : "Other") : "",
    external: (Array.isArray(x.external) ? x.external : []).map((o) => ({ name: String(o.name || "").slice(0, 100).trim(), kind: String(o.kind || "").slice(0, 40), person: String(o.person || "").slice(0, 80), confirmed: !!o.confirmed, note: String(o.note || "").slice(0, 300) })).filter((o) => o.name).slice(0, 6),
    prep: x.prep && x.prep.needed ? { needed: true, developer: String(x.prep.developer || "").slice(0, 80), project: String(x.prep.project || "").slice(0, 80), area: String(x.prep.area || "").slice(0, 80), event: String(x.prep.event || "").slice(0, 80) } : null,
    progress: (Array.isArray(x.progress) ? x.progress : []).map((p) => ({ work: String(p.work || "").slice(0, 80).trim(), status: STATUS.includes(p.status) ? p.status : "In progress", percent: Math.max(0, Math.min(100, Math.round(Number(p.percent) || 0))), owners: (Array.isArray(p.owners) ? p.owners : []).map(String).filter((n) => names.has(n)).slice(0, 12) })).filter((p) => p.work).slice(0, 6), questions: arr(x.questions, 3), answers: arr(x.answers, 3), deliverables: arr(x.deliverables, 8), evidence: arr(x.evidence, 8), next: arr(x.next, 8), check: !!x.check };
}
const dubaiToday = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : dubaiToday();
function weekOf(d) { const t = new Date(d + "T00:00:00Z"); const dow = (t.getUTCDay() + 6) % 7; const m = new Date(t.getTime() - dow * 864e5); return [m.toISOString().slice(0, 10), new Date(m.getTime() + 6 * 864e5).toISOString().slice(0, 10)]; }
const PFX = "work_naj_";
// v571 - third parties she deals with off-site (a charity, a venue, a developer's office). Looked up on the web once, confirmed by her, then
// remembered under work_naj_party_<slug> so the next entry recognises the name without asking. Nothing is remembered until she confirms.
const PPFX = "work_naj_party_";
const slug = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
async function knownParties(env) {
  const out = []; let cursor;
  do { const r = await env.MEETINGS.list({ prefix: PPFX, cursor }); cursor = r.list_complete ? null : r.cursor; for (const k of r.keys) out.push(k.name); } while (cursor);
  return (await Promise.all(out.map((n) => env.MEETINGS.get(n).then((v) => { try { return JSON.parse(v); } catch (e) { return null; } })))).filter(Boolean);
}
const LOOKUP_SCHEMA = { type: "object", additionalProperties: false, required: ["found", "name", "kind", "what", "where", "site", "confidence"], properties: {
  found: { type: "boolean" }, name: { type: "string" }, kind: { type: "string" }, what: { type: "string" }, where: { type: "string" }, site: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] } } };
// the Claude API's own web search: one call, the model searches and returns a short card. Returns null when no key or nothing found.
async function lookupParty(env, name, hint) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const body = { model: "claude-sonnet-5", max_tokens: 1200, thinking: { type: "disabled" }, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "AE", city: "Dubai", timezone: "Asia/Dubai" } }],
    system: "Identify an organisation that a Dubai real-estate advisory's marketing lead dealt with. Search the web, prefer the UAE entity. Answer ONLY as JSON matching this shape, no prose: " + JSON.stringify(LOOKUP_SCHEMA.properties)
      + ". name = official name; kind = two or three words (charity, developer, hotel venue, media, supplier, government); what = one plain sentence; where = city or area; site = official website or empty string; found = false with empty strings if nothing credible. Never invent.",
    messages: [{ role: "user", content: "Organisation as she wrote it: " + name + (hint ? " (" + hint + ")" : "") }] };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { if (r.status >= 500 || r.status === 429 || r.status === 403) { await new Promise((s) => setTimeout(s, 700)); continue; } return null; }
      const j = await r.json(); const txt = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
      const m = /\{[\s\S]*\}/.exec(txt); if (!m) return null;
      const o = JSON.parse(m[0]); if (!o.found) return null;
      return { name: String(o.name || name).slice(0, 100), kind: String(o.kind || "").slice(0, 40), what: String(o.what || "").slice(0, 300), where: String(o.where || "").slice(0, 80), site: /^https?:\/\//.test(String(o.site || "")) ? String(o.site).slice(0, 200) : "", confidence: o.confidence || "medium" };
    } catch (e) {}
  }
  return null;
}

async function listEntries(env, from, to) {
  const out = []; let cursor;
  do {
    const r = await env.MEETINGS.list({ prefix: PFX, cursor }); cursor = r.list_complete ? null : r.cursor;
    for (const k of r.keys) { const d = k.name.slice(PFX.length, PFX.length + 10); if ((!from || d >= from) && (!to || d <= to)) out.push(k.name); }
  } while (cursor);
  const vals = await Promise.all(out.map((n) => env.MEETINGS.get(n).then((v) => { try { return JSON.parse(v); } catch (e) { return null; } })));
  return vals.filter(Boolean).sort((a, b) => (a.date + a.created < b.date + b.created ? 1 : -1));
}

// v565 - every task across her entries: latest status and percent, first and last day, the distinct days worked, rough hours
export function tasksOf(es) {
  const T = {};
  [...es].sort((a, b) => (a.date + a.created < b.date + b.created ? -1 : 1)).forEach((e) => {
    const hrs = (EFFORT.find((x) => x[0] === e.effort) || EFFORT[1])[1], ws = e.works || [];
    ws.forEach((w) => {
      const t = T[w] = T[w] || { name: w, first: e.date, last: e.date, days: new Set(), hours: 0, status: "In progress", percent: 0, entries: 0, kpis: new Set(), owners: new Set(), touched: new Set() };
      const p = (e.progress || []).find((x) => x.work === w);
      t.last = e.date; t.days.add(e.date); t.hours += hrs / ws.length; t.entries++; (e.kpis || []).forEach((k) => t.kpis.add(k)); (e.people || []).forEach((n) => t.touched.add(n));
      if (p) { t.status = p.status; t.percent = p.percent; (p.owners || []).forEach((n) => t.owners.add(n)); }
    });
  });
  return Object.values(T).map((t) => ({ ...t, days: t.days.size, kpis: [...t.kpis], owners: [...t.owners], touched: [...t.touched], hours: Math.round(t.hours * 10) / 10 }))
    .sort((a, b) => (a.status === "Done") - (b.status === "Done") || (a.last < b.last ? 1 : -1));
}
// v566 - one card per department: the open tasks its people hold or touched, who, how far along, how long since anything moved
export function deptBoard(tasks, today) {
  return DEPTS.map((d) => {
    const ts = tasks.filter((t) => t.status !== "Done" && [...t.owners, ...t.touched].some((n) => deptOf(n) === d))
      .map((t) => ({ name: t.name, percent: t.percent, status: t.status, last: t.last, quiet: Math.round((Date.parse(today) - Date.parse(t.last)) / 864e5),
        who: [...new Set([...t.owners, ...t.touched])].filter((n) => deptOf(n) === d), owners: t.owners.filter((n) => deptOf(n) === d) }))
      .sort((a, b) => b.quiet - a.quiet);
    return { dept: d, open: ts.length, people: [...new Set(ts.flatMap((t) => t.who))], tasks: ts };
  });
}
export function hoursByKpi(es) {
  return KPIS.map((k) => ({ id: k.id, name: k.name, hours: Math.round(es.filter((e) => (e.kpis || []).includes(k.id)).reduce((s, e) => s + (EFFORT.find((x) => x[0] === e.effort) || EFFORT[1])[1] / Math.max(1, (e.kpis || []).length), 0) * 10) / 10 }));
}
// v569 PREPARE ME (Kendall 14 Oct: "MTI's open house ... understand the project itself, all its USPs, the sizes, the typology, why that location,
// what is beneficial to the investor or the end user, three or four comparisons within the area ... a plan B ... create content at the location").
// Every figure comes from Najma's records through the question engine (the same one Ask Najma uses), each with its own as-of line.
export function prepQuestions(f) {
  const P = f.project, A = f.area, V = f.developer, Q = [];
  if (P) Q.push(["The project", "Tell me about " + P]);
  if (A) {
    Q.push(["Prices in the area", "Average price per square foot in " + A]);
    Q.push(["One-bedroom prices", "Average price of a 1 bedroom in " + A]);
    Q.push(["Two-bedroom prices", "Average price of a 2 bedroom in " + A]);
    Q.push(["Rents", "Rent for a 2 bedroom in " + A]);
    Q.push(["Rental yield (investor)", "Gross yield for a 1 bed in " + A]);
    Q.push(["Price trend", "Have prices gone up in " + A + " this year?"]);
    Q.push(["Developers in the area (comparisons and plan B)", "How many developers in " + A]);
    Q.push(["Buildings selling most", "Which buildings in " + A + " sell the most?"]);
    Q.push(["Supply coming", "Which projects complete in 2027 in " + A]);
    Q.push(["Schools nearby", "How many schools are in " + A]);
    Q.push(["Adverts for rent now", "How many flats are for rent in " + A]);
  }
  if (V) { Q.push(["The developer's record", "How many projects has " + V + " registered?"]); Q.push(["Off-plan sales by the developer", "Off-plan projects by " + V]); }
  return Q;
}
// v569.1 - one engine session per question: a shared session made the engine carry one answer's context into the next
async function askEngine(env, q) {
  if (!env.ASK_ENGINE_URL || !env.ASK_SECRET) return { status: "error", headline: "The question engine is not connected." };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(String(env.ASK_ENGINE_URL).replace(/\/+$/, "") + "/ask", { method: "POST", headers: { "Content-Type": "application/json", "X-Ask-Secret": String(env.ASK_SECRET) }, body: JSON.stringify({ question: q, mode: "analyst", session_id: "prep" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }), signal: ctl.signal });
      clearTimeout(tm);
      if (r.ok) return await r.json();
    } catch (e) {}
    await new Promise((s) => setTimeout(s, 1500));
  }
  return { status: "error", headline: "No answer just now." };
}
export async function prepBrief(env, f) {
  const Q = prepQuestions(f);
  const ans = await Promise.all(Q.map((x) => askEngine(env, x[1])));
  return Q.map((x, i) => { const a = ans[i] || {}; const ao = a.as_of && typeof a.as_of === "object" ? Object.values(a.as_of).sort().pop() : "";
    return { title: x[0], question: x[1], status: a.status || "error", headline: a.headline || String(a.answer_md || "").split("\n").find((l) => l.trim() && !/^[#*_]/.test(l.trim())) || "", cards: Array.isArray(a.cards) ? a.cards.slice(0, 5) : [], note: a.note || "", as_of: ao }; });
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtD = (d) => { const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const p = String(d).split("-"); return (+p[2]) + " " + M[+p[1] - 1] + " " + p[0]; };
const dayName = (d) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(d + "T00:00:00Z").getUTCDay()];

export async function workRoute(request, env, url, deps) {
  const p = url.pathname;
  if (!p.startsWith("/momo/work")) return null;
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!deps.isNaj(env, url)) {   // the owner (or anyone else): the room exists, the log is hers alone
    if (p !== "/momo/work") return new Response("not found", { status: 404 });
    return new Response(deps.page(key, rk, '<a class=back href="/momo?key=' + encodeURIComponent(key) + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Work</h1><div class=empty><p>Najjuko\'s work log is private to her link.</p></div>'), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (p === "/momo/work/prep.js") return new Response(PREP_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work.js") return new Response(WORK_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/api") {
    if (request.method === "GET") {
      const [f, t] = weekOf(okDate(url.searchParams.get("week")));
      const week = await listEntries(env, f, t), all = await listEntries(env, PHASES[0].from, TERM_END);
      const tally = KPIS.map((k) => ({ id: k.id, name: k.name, week: week.filter((e) => e.kpis.includes(k.id)).length, term: all.filter((e) => e.kpis.includes(k.id)).length }));
      return J({ from: f, to: t, today: dubaiToday(), entries: week, tally, tasks: tasksOf(all), depts: deptBoard(tasksOf(all), dubaiToday()), org: DEPTS.map((d) => ({ dept: d, people: PEOPLE.filter((x) => deptOf(x[0]) === d).map((x) => x[0]) })), hours: hoursByKpi(week), status: STATUS, effort: EFFORT.map((x) => x[0]), review_due: REVIEW_DUE, phase: PHASES.find((x) => dubaiToday() >= x.from && dubaiToday() <= x.to) || null, scope: SCOPE, kpis: KPIS, people: PEOPLE.map((x) => x[0]), works: WORKS, types: TYPES, times: TIMES, out_roles: OUT_ROLES,
        // v571 - the people picker in hierarchy: Ali and Faez (and Sultan) on their own at the top, then each department's people
        people_tree: [{ dept: "Leadership", people: PEOPLE.filter((x) => deptOf(x[0]) === "Leadership").map((x) => x[0]) }].concat(DEPTS.filter((d) => d !== "Leadership").map((d) => ({ dept: d, people: PEOPLE.filter((x) => deptOf(x[0]) === d).map((x) => x[0]) }))) });
    }
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    if (b.action === "parse") {
      const text = String(b.text || "").trim().slice(0, 4000);
      if (!text) return J({ error: "Write what happened first." }, 400);
      let x = null;
      try { x = await deps.claudeJSON(env, sysPrompt(), "Date: " + okDate(b.date) + " (" + dayName(okDate(b.date)) + ")\nWhat she wrote:\n" + text, DAY_SCHEMA, deps.model, 4000); } catch (e) {}
      const list = x && Array.isArray(x.entries) && x.entries.length ? x.entries.map(clean) : splitDay(text).map((s) => clean(fallback(s)));
      // v571 - third parties: a name she has confirmed before is recognised at once; a new one is looked up on the web and shown for her to confirm
      const known = await knownParties(env), seen = {};
      for (const e of list) for (const o of e.external) {
        const k = known.find((p) => slug(p.name) === slug(o.name) || (p.aliases || []).some((a) => slug(a) === slug(o.name)));
        if (k) { Object.assign(o, { name: k.name, kind: k.kind || o.kind, what: k.what || "", where: k.where || "", site: k.site || "", confirmed: true, known: true }); continue; }
        const key = slug(o.name); if (!seen[key]) seen[key] = lookupParty(env, o.name, o.kind);
        const f = await seen[key]; if (f) Object.assign(o, { suggested: f.name, kind: f.kind || o.kind, what: f.what, where: f.where, site: f.site, confidence: f.confidence, confirmed: false });
        else Object.assign(o, { suggested: "", what: "", confirmed: false, notfound: true });
      }
      return J({ entries: list.slice(0, 20), entry: list[0] });
    }
    if (b.action === "party_confirm") {   // she says "yes, that's the company": remember it, with the name she typed as an alias
      const name = String(b.name || "").slice(0, 100).trim(), typed = String(b.typed || "").slice(0, 100).trim(); if (!name) return J({ error: "No name." }, 400);
      const key = PPFX + slug(name); let rec = null; try { rec = JSON.parse(await env.MEETINGS.get(key)); } catch (e) {}
      rec = Object.assign(rec || { name, aliases: [], first_seen: dubaiToday() }, { kind: String(b.kind || "").slice(0, 40), what: String(b.what || "").slice(0, 300), where: String(b.where || "").slice(0, 80), site: /^https?:\/\//.test(String(b.site || "")) ? String(b.site).slice(0, 200) : "", last_seen: dubaiToday() });
      if (typed && slug(typed) !== slug(name) && !(rec.aliases || []).some((a) => slug(a) === slug(typed))) rec.aliases = (rec.aliases || []).concat(typed).slice(0, 10);
      await env.MEETINGS.put(key, JSON.stringify(rec));
      return J({ ok: true, party: rec });
    }
    if (b.action === "parties") return J({ parties: await knownParties(env) });
    if (b.action === "save") {
      const e = clean(b.entry || {}); const date = okDate(b.date), text = String(b.text || "").slice(0, 4000), link = /^https?:\/\//.test(String(b.link || "")) ? String(b.link).slice(0, 500) : "";
      const id = String(b.id || "").replace(/[^a-z0-9]/g, "").slice(0, 16) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      const rec = { id, date, text, link, ...e, check: false, created: b.created || new Date().toISOString(), updated: new Date().toISOString() };
      if (b.id && b.oldDate && b.oldDate !== date) await env.MEETINGS.delete(PFX + okDate(b.oldDate) + "_" + id);
      await env.MEETINGS.put(PFX + date + "_" + id, JSON.stringify(rec));
      return J({ ok: true, entry: rec });
    }
    if (b.action === "prep") {
      const f = { developer: String(b.developer || "").slice(0, 80).trim(), project: String(b.project || "").slice(0, 80).trim(), area: String(b.area || "").slice(0, 80).trim() };
      if (!f.developer && !f.project && !f.area) return J({ error: "Name the project, the area or the developer." }, 400);
      return J({ sections: await prepBrief(env, f), fields: f });
    }
    if (b.action === "delete") { await env.MEETINGS.delete(PFX + okDate(b.date) + "_" + String(b.id || "").replace(/[^a-z0-9]/g, "")); return J({ ok: true }); }
    return J({ error: "Unknown action." }, 400);
  }
  if (p === "/momo/work/report") {
    const from = okDate(url.searchParams.get("from") || weekOf(dubaiToday())[0]), to = okDate(url.searchParams.get("to") || weekOf(from)[1]);
    return new Response(reportHtml(await listEntries(env, from, to), from, to, tasksOf(await listEntries(env, PHASES[0].from, to))), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  // v573 DEBRIEF (Kendall 14 Oct: "Ali ... wants a debrief of what happened because he wasn't there ... immediately create a PDF ... very quick").
  // One entry, one page, in FN's brand: what, when, who, outcome, next steps. Short on purpose.
  if (p === "/momo/work/debrief") {
    const id = String(url.searchParams.get("id") || "").replace(/[^a-z0-9]/g, ""), date = okDate(url.searchParams.get("date"));
    let e = null; try { e = JSON.parse(await env.MEETINGS.get(PFX + date + "_" + id)); } catch (x) {}
    if (!e) return new Response("not found", { status: 404 });
    return new Response(debriefHtml(e), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/prep") {
    const v = (n) => esc(url.searchParams.get(n) || "");
    return new Response(deps.page(key, rk, PREP_BODY.replace("__DEV__", v("dev")).replace("__PRJ__", v("project")).replace("__AREA__", v("area")).replace("__EVT__", v("event") || "Client briefing").replace(/__KEY__/g, esc(key))), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (p === "/momo/work") return new Response(deps.page(key, rk, WORK_BODY.replace(/__KEY__/g, esc(key))), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return new Response("not found", { status: 404 });
}

export function debriefHtml(e) {
  const FOOT = "<b>CONFIDENTIAL · FN Realty internal use only.</b> Not to be copied, distributed, modified, reissued or shared outside FN Realty without prior written approval from FN Realty management. © 2026 FN Realty. All rights reserved.";
  const row = (k, v) => v ? '<tr><td>' + k + '</td><td>' + v + '</td></tr>' : '';
  const who = (e.people || []).concat((e.external || []).map((o) => o.name)).map(esc).join(", ");
  const tasks = (e.progress || []).map((t) => esc(t.work) + ' — ' + esc(t.status) + ', ' + t.percent + '%').join('<br>');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Debrief: ' + esc(e.title) + '</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>'
    + '@page{size:A4;margin:18mm 18mm 22mm}body{margin:0;background:#F9F1EF;color:#202020;font-family:Inter,sans-serif;font-size:11pt;line-height:1.55}.pg{max-width:720px;margin:0 auto;background:#fff;padding:28px 34px 36px}'
    + 'header{background:#1F2B44;color:#C9A97A;margin:-28px -34px 20px;padding:20px 34px}header h1{font-family:Anton,sans-serif;font-weight:400;font-size:22pt;letter-spacing:.02em;margin:0}header p{margin:4px 0 0;color:#EFE5D7;font-size:10pt}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:#1F2B44;font-size:15pt;letter-spacing:.02em;margin:0 0 10px}table{width:100%;border-collapse:collapse;margin:8px 0 14px}td{padding:6px 8px;border-bottom:1px solid #E9EAEC;vertical-align:top}td:first-child{font-weight:600;color:#1F2B44;width:26%}'
    + '.sum{font-size:12pt;margin:0 0 12px}ul{margin:0 0 0 18px;padding:0}footer{margin-top:22px;border-top:1px solid #E9EAEC;padding-top:8px;font-size:7.5pt;color:#626B7C}.pf{position:fixed;bottom:6mm;left:18mm;right:18mm;font-size:7pt;color:#626B7C;display:none}'
    + '.btn{position:fixed;right:16px;bottom:16px;background:#1F2B44;color:#C9A97A;border:0;border-radius:99px;padding:10px 18px;font:600 10pt Inter,sans-serif;cursor:pointer}@media print{body{background:#fff}.pg{padding:0;max-width:none}header{margin:0 0 16px}.btn{display:none}.pf{display:block}footer{display:none}}</style></head><body><div class=pg>'
    + '<header><h1>DEBRIEF</h1><p>Serah Najjuko Ganyana · Strategic Lead – Marketing, PR &amp; Business Development</p></header>'
    + '<h2>' + esc(e.title) + '</h2><p class=sum>' + esc(e.summary) + '</p>'
    + '<table>' + row('When', esc(dayName(e.date)) + ' ' + esc(fmtD(e.date)) + (e.time_of_day && e.time_of_day !== "Unspecified" ? ', ' + esc(e.time_of_day.toLowerCase()) : '')) + row('Type', esc(e.type)) + row('Who', who || (e.alone ? 'Najjuko alone' : ''))
    + row('Role', e.in_scope === false ? 'Outside her role' + (e.out_role ? ' (' + esc(e.out_role) + ')' : '') : 'Within her role') + row('Progress', tasks) + row('Produced', (e.deliverables || []).map(esc).join('; ')) + (e.link ? row('File', '<a href="' + esc(e.link) + '">' + esc(e.link) + '</a>') : '') + '</table>'
    + ((e.next || []).length ? '<h2 style="font-size:12pt">NEXT STEPS</h2><ul>' + e.next.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '')
    + '<footer>' + FOOT + '</footer></div><div class=pf>' + FOOT + '</div><button class=btn onclick="print()">Save as PDF</button></body></html>';
}
// the weekly report: FN Realty's brand (navy #1F2B44, gold #C9A97A, Anton + Inter), internal confidentiality footer on every page
export function reportHtml(es, from, to, allTasks) {
  const byK = KPIS.map((k) => ({ k, es: es.filter((e) => e.kpis.includes(k.id)) }));
  const daily = from === to, hk = hoursByKpi(es), totH = Math.round(hk.reduce((s, x) => s + x.hours, 0) * 10) / 10;
  const tk = (allTasks || tasksOf(es)).filter((t) => t.last >= from && t.first <= to);
  const bar = (p) => '<span style="display:inline-block;width:70px;height:7px;background:#E9EAEC;border-radius:4px;vertical-align:middle"><span style="display:block;width:' + p + '%;height:7px;background:#C9A97A;border-radius:4px"></span></span> ' + p + '%';
  const people = {}; es.forEach((e) => e.people.forEach((n) => { (people[n] = people[n] || []).push(e.title); }));
  const dels = es.flatMap((e) => e.deliverables.map((d) => ({ d, e })));
  const next = es.flatMap((e) => e.next);
  const sc = SCOPE.map((s) => ({ s, n: es.filter((e) => e.scope.includes(s.id)).length })).filter((x) => x.n);
  const FOOT = "<b>CONFIDENTIAL · FN Realty internal use only.</b> Not to be copied, distributed, modified, reissued or shared outside FN Realty without prior written approval from FN Realty management. © 2026 FN Realty. All rights reserved.";
  const li = (a) => a.length ? "<ul>" + a.map((x) => "<li>" + x + "</li>").join("") + "</ul>" : "<p class=none>None this week.</p>";
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (from === to ? 'Daily' : 'Weekly') + ' activity report</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>'
    + '@page{size:A4;margin:16mm 16mm 22mm}body{margin:0;background:#F9F1EF;color:#202020;font-family:Inter,sans-serif;font-size:10.5pt;line-height:1.5}.pg{max-width:780px;margin:0 auto;background:#fff;padding:28px 34px 40px}'
    + 'header{background:#1F2B44;color:#C9A97A;margin:-28px -34px 22px;padding:22px 34px}header h1{font-family:Anton,sans-serif;font-weight:400;font-size:26pt;letter-spacing:.02em;margin:0}header p{margin:4px 0 0;color:#EFE5D7;font-size:10pt}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:#1F2B44;font-size:14pt;letter-spacing:.03em;margin:22px 0 8px;border-bottom:2px solid #C9A97A;padding-bottom:3px}'
    + '.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.tile{background:#FAF6F2;border:1px solid #EFE5D7;border-radius:8px;padding:9px 8px;text-align:center}.tile b{display:block;font-family:Anton,sans-serif;font-weight:400;font-size:20pt;color:#1F2B44}.tile span{font-size:8pt;color:#626B7C}'
    + '.e{border-left:3px solid #C9A97A;padding:4px 0 4px 12px;margin:8px 0}.e .m{font-size:8.5pt;color:#626B7C}.e b{color:#1F2B44}ul{margin:4px 0 0 18px;padding:0}.none{color:#626B7C;font-style:italic;margin:4px 0}'
    + 'table{width:100%;border-collapse:collapse}td{padding:5px 6px;border-bottom:1px solid #E9EAEC;vertical-align:top}td:first-child{font-weight:600;color:#1F2B44;width:34%}'
    + 'footer{margin-top:26px;border-top:1px solid #E9EAEC;padding-top:8px;font-size:7.5pt;color:#626B7C}.pf{position:fixed;bottom:6mm;left:16mm;right:16mm;font-size:7pt;color:#626B7C;display:none}'
    + '.btn{position:fixed;right:16px;bottom:16px;background:#1F2B44;color:#C9A97A;border:0;border-radius:99px;padding:10px 18px;font:600 10pt Inter,sans-serif;cursor:pointer}'
    + '@media print{body{background:#fff}.pg{padding:0;max-width:none}header{margin:0 0 18px}.btn{display:none}.pf{display:block}footer{display:none}}</style></head><body><div class=pg>'
    + '<header><h1>' + (daily ? 'DAILY' : 'WEEKLY') + ' ACTIVITY REPORT</h1><p>Serah Najjuko Ganyana · Strategic Lead – Marketing, PR &amp; Business Development · ' + (daily ? esc(dayName(from)) + ' ' + esc(fmtD(from)) : esc(fmtD(from)) + ' to ' + esc(fmtD(to))) + '</p></header>'
    + '<p>' + es.length + ' logged ' + (es.length === 1 ? 'activity' : 'activities') + (daily ? ' this day' : ' this week') + ', about ' + totH + ' hours of work, mapped to the five focus areas of the Review Framework (Schedule 2) and the scope of the role (Schedule 1).</p>'
    + '<div class=tiles>' + byK.map((x, i) => '<div class=tile><b>' + x.es.length + '</b><span>' + esc(x.k.name) + '<br>about ' + hk[i].hours + ' h</span></div>').join("") + '</div>'
    + '<h2>TASK PROGRESS</h2>' + (tk.length ? '<table><tr><td style="color:#626B7C;font-weight:500">Task</td><td style="color:#626B7C">Status</td><td style="color:#626B7C">Complete</td><td style="color:#626B7C">Started</td><td style="color:#626B7C">Days worked</td><td style="color:#626B7C">Time</td></tr>'
      + tk.map((t) => '<tr><td>' + esc(t.name) + (t.owners && t.owners.length ? '<div style="font-weight:400;color:#626B7C;font-size:8.5pt">With ' + esc(t.owners.join(", ")) + '</div>' : '') + '</td><td>' + esc(t.status) + '</td><td style="white-space:nowrap">' + bar(t.percent) + '</td><td style="white-space:nowrap">' + esc(fmtD(t.first)) + '</td><td>' + t.days + '</td><td style="white-space:nowrap">about ' + t.hours + ' h</td></tr>').join("") + '</table>'
      + '<p style="font-size:8pt;color:#626B7C">Complete is the percentage logged with the latest entry for the task. Time is a rough estimate from each entry (under 1 hour, 1-2 hours, half a day or a full day).</p>' : '<p class=none>No tasks logged.</p>')
    + '<h2>BY FOCUS AREA</h2>' + byK.map((x) => '<h3 style="color:#1F2B44;margin:14px 0 2px;font-size:11pt">' + x.k.id + '. ' + esc(x.k.name) + '</h3><div class=m style="font-size:8.5pt;color:#626B7C">Evidence sought: ' + esc(x.k.ev) + '</div>'
      + (x.es.length ? x.es.map((e) => '<div class=e><b>' + esc(e.title) + '</b> <span class=m>· ' + esc(dayName(e.date)) + ' ' + esc(fmtD(e.date)) + ' · ' + esc(e.type) + '</span><div>' + esc(e.summary) + '</div></div>').join("") : '<p class=none>Nothing logged against this area this week.</p>')).join("")
    + '<h2>DELIVERABLES</h2>' + li(dels.map((x) => esc(x.d) + ' <span style="color:#626B7C">(' + esc(fmtD(x.e.date)) + ')</span>'))
    + '<h2>CAMPAIGNS AND TASKS</h2>' + (() => { const w = {}; es.forEach((e) => (e.works || []).forEach((n) => { (w[n] = w[n] || []).push(e.title); })); return Object.keys(w).length ? '<table>' + Object.keys(w).map((n) => '<tr><td>' + esc(n) + '</td><td>' + w[n].map(esc).join('; ') + '</td></tr>').join("") + '</table>' : '<p class=none>None recorded.</p>'; })()
    + '<h2>PEOPLE AND TOUCHPOINTS</h2>' + (Object.keys(people).length ? '<table>' + Object.keys(people).sort().map((n) => '<tr><td>' + esc(n) + '</td><td>' + people[n].map(esc).join('; ') + '</td></tr>').join("") + '</table>' : '<p class=none>None recorded.</p>')
    + '<h2>SCOPE OF THE ROLE COVERED</h2>' + (sc.length ? '<table>' + sc.map((x) => '<tr><td>' + esc(x.s.area) + '</td><td>' + esc(x.s.name) + ' (' + x.n + ')</td></tr>').join("") + '</table>' : '<p class=none>None recorded.</p>')
    + '<h2>NEXT STEPS</h2>' + li(next.map(esc))
    + '<footer>' + FOOT + '</footer></div><div class=pf>' + FOOT + '</div><button class=btn onclick="print()">Save as PDF</button></body></html>';
}

const WORK_BODY = '<div class=tag>MOMO · WORK</div><h1>My work log</h1>'
  + '<div class=wk id=wkhead></div>'
  + '<form id=wf class=box><label>What did you do? <button type=button id=wmic class=mic aria-label="Speak instead of typing"><svg viewBox="0 0 24 24" width=18 height=18 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Speak</span></button></label><textarea id=wt rows=4 placeholder="e.g. Monday huddle: built the PowerPoint, ran the meeting with Ali and the team, laid out the week."></textarea>'
  + '<div class=row><input id=wd type=date><input id=wl type=url placeholder="Link to a file (optional)"></div><div class=row2><button type=button id=wreset class=ghost>Start over</button><button type=submit id=wb class=gold>File it</button></div></form>'
  + '<div id=wprev></div><a id=wday class=gold style="display:block;text-align:center;text-decoration:none;margin-top:12px" target=_blank>Today\'s summary</a>'
  + '<a href="/momo/work/prep?key=__KEY__" class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:8px">Prepare me for a client, project or open house</a>'
  + '<div class=sec>MY TASKS</div><div id=wtasks></div>'
  + '<div class=sec>BY DEPARTMENT · OPEN TASKS, LONGEST QUIET FIRST</div><div id=wdept></div>'
  + '<div class=sec>FOCUS AREAS · THIS WEEK / SINCE 2 OCT</div><div id=wtally class=tally></div>'
  + '<div class=sec id=wlisth>THIS WEEK</div><div id=wlist></div>'
  + '<div class=row2><button type=button id=wprevw class=ghost>&#8592; Previous week</button><button type=button id=wnextw class=ghost>Next week &#8594;</button></div>'
  + '<a id=wrep class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:12px" target=_blank>This week\'s report</a>'
  + '<script src="/momo/work.js?key=__KEY__"></script>';

const PREP_BODY = '<a class=back href="/momo/work?key=__KEY__">&#8592; Work</a><div class=tag>MOMO · PREPARE ME</div><h1>__EVT__</h1>'
  + '<form id=pf class=box><label>What are you preparing for?</label><input id=fd placeholder="Developer (e.g. Imtiaz Developments)" value="__DEV__">'
  + '<input id=fp placeholder="Project (e.g. the open house project)" value="__PRJ__" style="margin-top:8px"><input id=fa placeholder="Area or community (e.g. JVC, Dubai Hills)" value="__AREA__" style="margin-top:8px">'
  + '<button type=submit id=fb class=gold style="margin-top:10px">Build my briefing</button><div style="color:#8FA39B;font-size:.78rem;margin-top:6px">Every figure is from Najma\'s records, with its date. Selling points that are not in the records stay for you to add.</div></form>'
  + '<div id=pout></div><script src="/momo/work/prep.js?key=__KEY__"></script>';
const PREP_JS = String.raw`(function(){var KEY=decodeURIComponent((document.currentScript.src.split("key=")[1]||"").split("&")[0]);var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
$("pf").onsubmit=function(ev){ev.preventDefault();var f={developer:$("fd").value.trim(),project:$("fp").value.trim(),area:$("fa").value.trim()};if(!f.developer&&!f.project&&!f.area)return;
 $("fb").disabled=true;$("fb").textContent="Gathering the figures (about half a minute)…";$("pout").innerHTML="";
 fetch("/momo/work/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({action:"prep"},f))}).then(function(r){return r.json()}).then(function(j){$("fb").disabled=false;$("fb").textContent="Build my briefing";
  if(j.error){alert(j.error);return}
  var h=j.sections.map(function(s){var ok=s.status==="answer";return '<div class=ent'+(ok?'':' style="opacity:.6"')+'><div class=m style="color:#C5A56A;text-transform:uppercase;letter-spacing:.08em;font-size:.7rem">'+esc(s.title)+'</div><h3 style="margin-top:4px">'+esc(s.headline||"Not covered yet")+'</h3>'
   +(s.cards.length?'<div class=tally style="margin-top:8px">'+s.cards.map(function(c){return '<div class=tl><span style="margin:0">'+esc(c.label)+'</span><b style="font-size:1.05rem">'+esc(c.value)+'</b>'+(c.sub?'<span>'+esc(c.sub)+'</span>':'')+'</div>'}).join("")+'</div>':'')
   +'<div class=m style="margin-top:6px">'+(s.note?esc(s.note)+' · ':'')+(s.as_of?'As of '+esc(s.as_of):'')+'</div></div>'}).join("");
  var dev=j.sections.filter(function(s){return /Developers in the area/.test(s.title)})[0];
  h+='<div class=sec>PLAN B</div><div class=ent><p>If the open house does not land with the client, the strongest alternatives in the same area are the other developers there'+(dev&&dev.cards.length?': '+esc(dev.cards.map(function(c){return c.value}).join(", ")):'')+'. Compare them on price per square foot, completion and rent above, and on the buildings that sell most.</p></div>';
  h+='<div class=sec>CONTENT ON SITE</div><div class=ent><p>1. A 30-second walk-through: the view, the finishes, one figure from this briefing (the area price or the yield).<br>2. "Three things investors ask about '+esc(f.area||f.project||f.developer)+'": price, rent, what is being built next.<br>3. For clients not at the venue: a short voice note or video answering their own question, with the figure and its date.</p></div>';
  h+='<button type=button class=ghost style="width:100%;margin-top:12px" onclick="print()">Save as PDF</button><div class=m style="margin-top:8px;color:#8FA39B;font-size:.75rem">Research use only: figures from Najma\'s records; selling points from the developer\'s own sheets, never from portals.</div>';
  $("pout").innerHTML=h}).catch(function(){$("fb").disabled=false;$("fb").textContent="Build my briefing";alert("Could not build it just now. Try again.")})};
if($("fd").value||$("fp").value||$("fa").value){}})();`;
export const WORK_CSS = '.wk{color:#8FA39B;font-size:.85rem;margin:-12px 0 16px}.box{border:1px solid #24352F;border-radius:16px;padding:14px;background:#0E1918}.box label{display:block;color:#C5A56A;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px}'
  + 'textarea,input{width:100%;box-sizing:border-box;background:#0C1413;border:1px solid #24352F;border-radius:10px;color:#E8E4D8;font:inherit;padding:10px}.row{display:grid;grid-template-columns:150px 1fr;gap:8px;margin:8px 0}'
  + '.gold{background:#C5A56A;color:#0C1413;border:0;border-radius:12px;padding:12px;font:600 .95rem inherit;width:100%;cursor:pointer}.ghost{background:transparent;border:1px solid #24352F;color:#B9B2A3;border-radius:10px;padding:9px;cursor:pointer;font:inherit}'
  + '.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.sec{color:#C5A56A;font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.12em;margin:22px 0 8px}'
  + '.tally{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tl{border:1px solid #24352F;border-radius:12px;padding:10px 12px;background:#0E1918}.tl b{font-family:Fraunces,serif;font-size:1.5rem;color:#F3EFE4}.tl i{font-style:normal;color:#8FA39B;font-size:.8rem}.tl span{display:block;font-size:.78rem;color:#B9B2A3;margin-top:2px}'
  + '.ent{border:1px solid #24352F;border-left:3px solid #C5A56A;border-radius:12px;padding:12px;margin:8px 0;background:#0E1918}.ent h3{margin:0 0 4px;font-size:1rem;color:#F3EFE4}.ent .m{color:#8FA39B;font-size:.78rem}.ent p{margin:6px 0;color:#D8D2C4;font-size:.9rem}'
  + '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.chip{border:1px solid #24352F;border-radius:99px;padding:4px 10px;font-size:.75rem;color:#B9B2A3;background:transparent;cursor:pointer}.chip.on{border-color:#C5A56A;color:#C5A56A;background:#15231F}'
  + '.prev{border:1px solid #C5A56A;border-radius:16px;padding:14px;margin-top:12px;background:#0E1918}.prev input{margin-bottom:8px}.lab{color:#8FA39B;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;margin:10px 0 4px}.warn{color:#E3A08F;font-size:.8rem}.acts{display:flex;gap:10px;margin-top:8px}.acts button{flex:1}.del{color:#8FA39B;background:none;border:0;font-size:.78rem;cursor:pointer;padding:0;margin-top:6px}'
  + '.tk{border:1px solid #24352F;border-radius:12px;padding:10px 12px;margin:6px 0;background:#0E1918}.tk b{color:#F3EFE4;font-weight:600}.tk .m{color:#8FA39B;font-size:.76rem;margin-top:3px}.pb{height:6px;background:#1B2A26;border-radius:4px;margin-top:7px;overflow:hidden}.pb i{display:block;height:6px;background:#C5A56A}.tk.done{opacity:.6}'
  + '.box label{display:flex!important;justify-content:space-between;align-items:center}.mic{display:inline-flex;align-items:center;gap:6px;border:1px solid #C5A56A;border-radius:99px;background:transparent;color:#C5A56A;padding:6px 12px;font:600 .78rem inherit;letter-spacing:0;text-transform:none;cursor:pointer}'
  + '.mic.rec{background:#C5A56A;color:#0C1413;animation:micp 1.2s ease-in-out infinite}@keyframes micp{50%{opacity:.6}}'
  + '.dp{border:1px solid #24352F;border-radius:12px;margin:6px 0;background:#0E1918;overflow:hidden}.dp summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;justify-content:space-between;gap:8px;align-items:center}.dp summary::-webkit-details-marker{display:none}'
  + '.dp summary b{color:#F3EFE4}.dp summary small{color:#8FA39B;font-size:.76rem}.dp .n{color:#C5A56A;font-family:Fraunces,serif;font-size:1.3rem}.dpt{border-top:1px solid #1B2A26;padding:9px 14px}.dpt b{color:#E8E4D8;font-weight:600;font-size:.9rem}.dpt .m{color:#8FA39B;font-size:.76rem;margin-top:2px}.chase{color:#E3A08F}'
  + '.who{width:100%;margin-top:6px;background:#0C1413;border:1px solid #24352F;border-radius:10px;color:#E8E4D8;padding:8px;font:inherit}'
  + '.pdp{border:1px solid #24352F;border-radius:10px;margin:4px 0;background:#0C1413}.pdp summary{list-style:none;cursor:pointer;padding:8px 10px;color:#C5A56A;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase}.pdp summary::-webkit-details-marker{display:none}.pdp summary small{color:#8FA39B;letter-spacing:0;text-transform:none}.pdp summary:before{content:"+ ";color:#8FA39B}.pdp[open] summary:before{content:"\\2212 "}.pdp .chips{padding:0 10px 10px}'
  + '.more{border-top:1px solid #24352F;margin-top:14px;padding-top:4px}.more summary{list-style:none;cursor:pointer;color:#8FA39B;font-size:.8rem;padding:8px 0;display:flex;align-items:center;gap:6px}.more summary::-webkit-details-marker{display:none}.more summary svg{color:#C5A56A}'
  + '.pg{border-top:1px solid #24352F;padding-top:8px;margin-top:8px}.pg input[type=range]{padding:0;accent-color:#C5A56A}.addw{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:6px}';

// v571 - a little flair, kept quiet on a phone: one small line icon per section label and per key pill (our icon set, never emoji)
const WI = (d) => '<svg viewBox="0 0 24 24" width=14 height=14 fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + '</svg>';
export const WORK_ICONS = {
  title: WI('<path d="M4 7h16M4 12h10M4 17h7"/>'), type: WI('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>'), kpi: WI('<path d="M12 3l2.6 5.4 6 .8-4.3 4.2 1 6-5.3-2.8L6.7 19.4l1-6L3.4 9.2l6-.8z"/>'),
  scope: WI('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'), role: WI('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
  time: WI('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'), effort: WI('<path d="M6 3h12M6 21h12M8 3c0 5 8 5 8 10s-8 5-8 8M16 3c0 5-8 5-8 10s8 5 8 8"/>'),
  task: WI('<path d="M9 11l2 2 4-4"/><rect x="3" y="4" width="18" height="16" rx="2"/>'), people: WI('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-5-5.9"/>'),
  party: WI('<path d="M3 21V8l7-4 7 4v13M10 21v-6h4v6M3 21h18"/>'), ask: WI('<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'),
  out: WI('<path d="M14 3h7v7M21 3l-9 9M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>'),
  Meeting: WI('<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0"/>'), Deliverable: WI('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  Update: WI('<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>'), Organising: WI('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'), Outreach: WI('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
  Event: WI('<path d="M12 3l2 4 4 .5-3 3 .8 4.5L12 13l-3.8 2 .8-4.5-3-3L10 7z"/><path d="M5 21h14"/>'), Other: WI('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  Morning: WI('<path d="M12 3v2M4.2 6.2l1.4 1.4M3 13h2M19 13h2M18.4 6.2L17 7.6M6 17a6 6 0 0 1 12 0M3 21h18"/>'), Midday: WI('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  Afternoon: WI('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 7l2.1-2.1M4 20h16"/>'), Evening: WI('<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>'), Unspecified: WI('<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>'),
};
const WORK_JS = String.raw`var ICON=` + JSON.stringify(WORK_ICONS) + String.raw`;(function(){
var KEY=(document.currentScript.src.split("key=")[1]||"").split("&")[0];KEY=decodeURIComponent(KEY);
var $=function(i){return document.getElementById(i)};var D=null,WEEK=null,PREV=null,EDIT=null;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function fd(d){var p=d.split("-");return DN[new Date(d+"T00:00:00Z").getUTCDay()]+" "+(+p[2])+" "+M[+p[1]-1]}
function api(o){return fetch("/momo/work/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json()})}
function load(w){fetch("/momo/work/api?key="+encodeURIComponent(KEY)+(w?"&week="+w:"")).then(function(r){return r.json()}).then(function(j){D=j;WEEK=j.from;draw()})}
function shift(n){var t=new Date(WEEK+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+7*n);load(t.toISOString().slice(0,10))}
function draw(){var days=Math.round((Date.parse(D.review_due)-Date.parse(D.today))/864e5);
 $("wkhead").textContent=(D.phase?D.phase.name+" · ":"")+(days>=0?days+" days to the day-75 review (15 Dec)":"Review due date passed");
 if(!$("wd").value)$("wd").value=D.today;
 $("wtally").innerHTML=D.tally.map(function(t){return '<div class=tl><b>'+t.week+'</b> <i>/ '+t.term+'</i><span>'+esc(t.id+". "+t.name)+'</span></div>'}).join("");
 $("wlisth").textContent="WEEK OF "+fd(D.from).toUpperCase()+" · "+D.entries.length+" ENTR"+(D.entries.length===1?"Y":"IES");
 $("wlist").innerHTML=D.entries.length?D.entries.map(function(e,i){return '<div class=ent><h3>'+esc(e.title)+'</h3><div class=m>'+esc(fd(e.date))+(e.time_of_day&&e.time_of_day!=="Unspecified"?' '+esc(e.time_of_day.toLowerCase()):'')+' · '+esc(e.type)+(e.people.length?' · '+esc(e.people.join(", ")):(e.alone?' · by yourself':''))+((e.external||[]).length?' · '+esc(e.external.map(function(o){return o.name}).join(", ")):'')+(e.in_scope===false?' · <span class=warn>outside role'+(e.out_role?' ('+esc(e.out_role)+')':'')+'</span>':'')+'</div><p>'+esc(e.summary)+'</p>'
  +'<div class=chips>'+e.kpis.map(function(k){var x=D.kpis.filter(function(y){return y.id===k})[0];return '<span class="chip on">'+esc(x?x.name:k)+'</span>'}).join("")+'</div>'
  +(e.deliverables.length?'<div class=m style="margin-top:6px">Produced: '+esc(e.deliverables.join("; "))+'</div>':'')+(e.link?'<div class=m><a style="color:#C5A56A" href="'+esc(e.link)+'" target=_blank rel=noopener>Open the file</a></div>':'')
  +(e.prep&&e.prep.needed?'<a class=mic style="text-decoration:none;margin:8px 0 2px" href="/momo/work/prep?key='+encodeURIComponent(KEY)+'&dev='+encodeURIComponent(e.prep.developer||"")+'&project='+encodeURIComponent(e.prep.project||"")+'&area='+encodeURIComponent(e.prep.area||"")+'&event='+encodeURIComponent(e.prep.event||e.title)+'">Prepare me &#8594;</a><br>':'')
  +'<a class=del style="text-decoration:none" href="/momo/work/debrief?key='+encodeURIComponent(KEY)+'&id='+encodeURIComponent(e.id)+'&date='+e.date+'" target=_blank>Debrief</a> &middot; <button class=del data-e='+i+'>Edit</button> &middot; <button class=del data-d='+i+'>Delete</button></div>'}).join(""):'<p style="color:#8FA39B">Nothing logged this week yet.</p>';
 $("wlist").querySelectorAll("[data-d]").forEach(function(b){b.onclick=function(){var e=D.entries[+b.getAttribute("data-d")];if(!confirm("Delete \""+e.title+"\"?"))return;api({action:"delete",id:e.id,date:e.date}).then(function(){load(WEEK)})}});
 $("wlist").querySelectorAll("[data-e]").forEach(function(b){b.onclick=function(){var e=D.entries[+b.getAttribute("data-e")];EDIT=e;$("wt").value=e.text;$("wd").value=e.date;$("wl").value=e.link||"";preview(e);scrollTo(0,0)}});
 $("wtasks").innerHTML=(D.tasks||[]).length?D.tasks.map(function(t){return '<div class="tk'+(t.status==="Done"?' done':'')+'"><b>'+esc(t.name)+'</b> <span style="color:#C5A56A;float:right">'+t.percent+'%</span><div class=pb><i style="width:'+t.percent+'%"></i></div>'
  +'<div class=m>'+esc(t.status)+' · started '+esc(fd(t.first))+' · '+t.days+' day'+(t.days===1?'':'s')+' worked · about '+t.hours+' h'+(t.last!==t.first?' · last '+esc(fd(t.last)):'')+'</div>'
  +(t.owners.length?'<div class=m>With: '+esc(t.owners.join(", "))+'</div>':'')+'</div>'}).join(""):'<p style="color:#8FA39B">Tasks appear here as you log work on them.</p>';
 $("wdept").innerHTML=(D.depts||[]).map(function(d){return '<details class=dp><summary><span><b>'+esc(d.dept)+'</b><br><small>'+(d.people.length?esc(d.people.slice(0,4).join(", "))+(d.people.length>4?" +"+(d.people.length-4):""):"No open tasks")+'</small></span><span class=n>'+d.open+'</span></summary>'
  +d.tasks.map(function(t){return '<div class=dpt><b>'+esc(t.name)+'</b> <span style="color:#C5A56A;float:right">'+t.percent+'%</span><div class=m>'+esc(t.status)+' · with '+esc(t.who.join(", "))+'</div><div class="m'+(t.quiet>=5?' chase':'')+'">'+(t.quiet<=0?'Moved today':'Last moved '+esc(fd(t.last))+' · '+t.quiet+' day'+(t.quiet===1?'':'s')+' quiet'+(t.quiet>=5?' · chase':''))+'</div></div>'}).join("")+'</details>'}).join("");
 $("wday").href="/momo/work/report?key="+encodeURIComponent(KEY)+"&from="+D.today+"&to="+D.today;
 var to=new Date(Date.parse(D.from)+6*864e5).toISOString().slice(0,10);$("wrep").href="/momo/work/report?key="+encodeURIComponent(KEY)+"&from="+D.from+"&to="+to}
function chips(list,on,attr){return list.map(function(x){var id=x.id!=null?x.id:x,nm=x.name||x,ic=(attr==="t"||attr==="tod")&&ICON[id]?ICON[id]+' ':'';return '<button type=button class="chip'+(on.indexOf(id)>=0?' on':'')+'" data-'+attr+'="'+esc(id)+'">'+ic+esc(nm)+'</button>'}).join("")}
function lab(k,t){return '<div class=lab>'+(ICON[k]||'')+' '+t+'</div>'}
// v573 (Kendall 14 Oct: "move away from the pills and put dropdowns") - one native picker per single-choice field; chips stay only where she picks several
function sel(id,list,cur){return '<select class=who id='+id+' style="margin-top:0">'+list.map(function(x){var v=x.id!=null?x.id:(Array.isArray(x)?x[0]:x),nm=x.name||(Array.isArray(x)?x[0]:x);return '<option value="'+esc(v)+'"'+(String(v)===String(cur)?' selected':'')+'>'+esc(nm)+'</option>'}).join("")+'</select>'}
function confirmLine(e){var ks=e.kpis.map(function(k){var x=D.kpis.filter(function(y){return y.id===k})[0];return x?x.name:k});
 var ts=(e.works||[]).map(function(w){var old=(D.tasks||[]).filter(function(t){return t.name===w})[0];var p=(e.progress||[]).filter(function(x){return x.work===w})[0];return '<b>'+esc(w)+'</b> '+(old?'(existing task, '+old.percent+'% before'+(p?', now '+p.percent+'%':'')+')':'(new task'+(p?', '+p.percent+'%':'')+')')});
 return '<div style="background:#15231F;border-radius:12px;padding:12px;margin-bottom:10px"><div style="color:#C5A56A;font-weight:600;margin-bottom:6px">Here\'s how I\'ll log this. Is it right?</div><div style="color:#E8E4D8;font-size:.9rem;line-height:1.5">'
  // v572 (Najjuko 14 Oct, live: a sales workshop as an agent fits no contract area and no task - that is the right answer, not a warning)
  +(e.in_scope===false
    ?'<span class=warn>Outside your role'+(e.out_role?': '+esc(e.out_role):'')+'</span>'+(orl(e.out_role)?' <span style="color:#8FA39B">('+esc(orl(e.out_role))+')</span>':'')+'. No focus area or task applies. '
    :(ks.length?'Counts towards: '+esc(ks.join(', '))+'. ':'<span class=warn>No focus area yet: tap one below. </span>')+(ts.length?'Task: '+ts.join('; ')+'. ':''))
  +(e.people.length?'With: '+esc(e.people.join(', '))+'.':(e.alone?'By yourself.':'No people named.'))+'</div>'
  +'<div style="color:#B9B2A3;font-size:.82rem;margin-top:6px">'+esc(e.time_of_day&&e.time_of_day!=="Unspecified"?e.time_of_day:"Time not stated")+' · '+esc(deptsOf(e).join(", ")||"No department")+'</div>'
  +(e.external||[]).map(function(o){return '<div style="margin-top:8px;padding:8px 10px;border:1px solid '+(o.confirmed?'#24352F':'#C5A56A')+';border-radius:10px"><div style="color:#C5A56A;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase">Outside party'+(o.known?' · known':'')+'</div>'
   +(o.confirmed?'<b>'+esc(o.name)+'</b>'+(o.kind?' <span style="color:#8FA39B">· '+esc(o.kind)+'</span>':'')+(o.what?'<div class=m>'+esc(o.what)+'</div>':''):
     o.notfound?'<b>'+esc(o.name)+'</b><div class=m>I could not find this organisation online. It will be logged as you wrote it.</div>':
     '<div class=m>You wrote <b style="color:#E8E4D8">'+esc(o.name)+'</b>. Is this the right one?</div><b>'+esc(o.suggested)+'</b>'+(o.kind?' <span style="color:#8FA39B">· '+esc(o.kind)+'</span>':'')+(o.what?'<div class=m>'+esc(o.what)+(o.where?' ('+esc(o.where)+')':'')+'</div>':'')+(o.site?'<div class=m><a style="color:#C5A56A" href="'+esc(o.site)+'" target=_blank rel=noopener>'+esc(o.site.replace(/^https?:\/\//,""))+'</a></div>':'')
     +'<div class=acts style="margin-top:6px"><button type=button class=ghost data-pn="'+esc(o.name)+'">No, keep as I wrote it</button><button type=button class=gold data-py="'+esc(o.name)+'">Yes, that\'s it</button></div>')+'</div>'}).join("")
  +'<div style="color:#8FA39B;font-size:.78rem;margin-top:6px">Nothing is saved until you press Save. Change anything below first.</div></div>'}
function orl(r){var x=(D.out_roles||[]).filter(function(y){return y[0]===r})[0];return x?x[1].replace(/\s*\(.*$/,""):""}
function deptsOf(e){var ds=[];(e.people||[]).forEach(function(n){var g=(D.org||[]).filter(function(x){return x.people.indexOf(n)>=0})[0];if(g&&ds.indexOf(g.dept)<0)ds.push(g.dept)});if((e.external||[]).length&&ds.indexOf("External")<0)ds.push("External");return ds}
function wireParties(e){$("wprev").querySelectorAll("[data-py]").forEach(function(b){b.onclick=function(){var o=(PREV.external||[]).filter(function(x){return x.name===b.getAttribute("data-py")})[0];if(!o)return;b.disabled=true;b.textContent="Remembering…";
  api({action:"party_confirm",name:o.suggested||o.name,typed:o.name,kind:o.kind,what:o.what,where:o.where,site:o.site}).then(function(j){if(j.ok){o.name=j.party.name;o.confirmed=true;o.known=true;if(QUEUE.length)QUEUE[QI]=PREV;preview(PREV)}else{b.disabled=false;b.textContent="Yes, that's it"}})}});
 $("wprev").querySelectorAll("[data-pn]").forEach(function(b){b.onclick=function(){var o=(PREV.external||[]).filter(function(x){return x.name===b.getAttribute("data-pn")})[0];if(!o)return;o.suggested="";o.what="";o.site="";o.confirmed=true;if(QUEUE.length)QUEUE[QI]=PREV;preview(PREV)}})}
var QUEUE=[],QI=0;   // v570 - a whole day comes back as several activities; she confirms and saves them one at a time
function queueHead(){return QUEUE.length>1?'<div style="color:#C5A56A;font-family:\'IBM Plex Mono\',monospace;font-size:.72rem;letter-spacing:.12em;margin-bottom:8px">ACTIVITY '+(QI+1)+' OF '+QUEUE.length+'</div>':''}
function nextInQueue(){QI++;if(QI<QUEUE.length){preview(QUEUE[QI]);scrollTo(0,0)}else{QUEUE=[];QI=0;$("wprev").innerHTML="";$("wt").value="";$("wl").value=""}}
function preview(e){PREV=JSON.parse(JSON.stringify(e));var h='<div class=prev>'+queueHead()+confirmLine(e)+(e.check?'<div class=warn>Filed by keyword only: please check the areas and people.</div>':'')
 // v572 (Najjuko 14 Oct: "you're getting too deep ... simplify") - four rows she always sees: What, When, With, Role. Focus area only when within
 // her role. Everything else under one closed More.
 +lab("title","What")+'<input id=pt value="'+esc(e.title)+'"><textarea id=ps rows=2 style="margin-top:6px">'+esc(e.summary)+'</textarea>'
 +'<div class=row style="grid-template-columns:1fr 1fr;margin-top:6px">'+sel("st",D.types,e.type)+sel("stod",D.times||[],e.time_of_day||"Unspecified")+'</div>'
 +lab("people","With")+(e.people.length?'<div class=chips style="margin-bottom:6px">'+chips(e.people,e.people,"p")+'</div>':'')
 +(D.people_tree||[]).map(function(g,gi){var rest=g.people.filter(function(p){return e.people.indexOf(p)<0});if(!rest.length)return '';return '<details class=pdp'+(gi===0&&!e.people.length?' open':'')+'><summary>'+esc(g.dept)+' <small>'+rest.length+'</small></summary><div class=chips>'+chips(rest,[],"p")+'</div></details>'}).join("")
 +lab("role","Role")+sel("ssc",[{id:"1",name:"Within my role"},{id:"0",name:"Outside my role"}],e.in_scope===false?"0":"1")
 +'<div id=pout style="display:'+(e.in_scope===false?'block':'none')+';margin-top:6px">'+sel("sor",(D.out_roles||[]).map(function(r){return {id:r[0],name:r[0]}}),e.out_role||"Other")+'<div id=porn class=m style="margin-top:4px">'+esc(((D.out_roles||[]).filter(function(r){return r[0]===e.out_role})[0]||[])[1]||"")+'</div></div>'
 +'<div id=pkpi style="display:'+(e.in_scope===false?'none':'block')+'">'+lab("kpi","Counts towards")+'<div class=chips>'+chips(D.kpis,e.kpis,"k")+'</div></div>'
 +'<details class=more><summary>'+(ICON.out||'')+' More (part of the role, how long, task progress, questions)</summary>'
 +lab("scope","Part of the role")+'<div class=chips>'+chips(D.scope,e.scope,"s")+'</div>'
 +lab("effort","About how long")+sel("sef",D.effort,e.effort)
 +lab("task","Campaign or task")+'<div class=chips>'+chips((e.works||[]).filter(function(w){return D.works.indexOf(w)<0}).concat(D.works),e.works||[],"w")+'</div>'
 +'<div class=addw><input id=pnw placeholder="Add a new task"><button type=button class=ghost id=pnb>Add</button></div><div id=pprog></div>'
 +((e.questions||[]).length?lab("ask","A few questions so nothing is missed")+''+e.questions.map(function(q,i){return '<div class=m style="color:#D8D2C4;margin:6px 0 4px">'+esc(q)+'</div><input class=pq data-q='+i+' placeholder="Your answer (optional)">'}).join("")+'<button type=button class=ghost id=pa style="width:100%;margin-top:6px">Answer and refile</button>':'')
 +(e.deliverables.length?lab("task","Produced")+'<div class=m style="color:#D8D2C4">'+esc(e.deliverables.join("; "))+'</div>':'')
 +(e.next.length?lab("out","Next steps")+'<div class=m style="color:#D8D2C4">'+esc(e.next.join("; "))+'</div>':'')
 +'</details>'
 +'<div class=acts><button type=button class=ghost id=pc>'+(QUEUE.length>1?'Skip this one':'Cancel')+'</button><button type=button class=gold id=pv>'+(QUEUE.length>1&&QI<QUEUE.length-1?'Save and next':'Save')+'</button></div></div>';
 $("wprev").innerHTML=h;
 $("st").onchange=function(){PREV.type=this.value};$("stod").onchange=function(){PREV.time_of_day=this.value};$("sef").onchange=function(){PREV.effort=this.value};
 $("ssc").onchange=function(){PREV.in_scope=this.value==="1";if(PREV.in_scope)PREV.out_role="";else if(!PREV.out_role)PREV.out_role=$("sor").value||"Other";$("pout").style.display=PREV.in_scope?"none":"block";$("pkpi").style.display=PREV.in_scope?"block":"none"};
 $("sor").onchange=function(){PREV.out_role=this.value;var r=(D.out_roles||[]).filter(function(x){return x[0]===PREV.out_role})[0];$("porn").textContent=r?r[1]:""};
 function tog(attr,arr,num){$("wprev").querySelectorAll("[data-"+attr+"]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-"+attr);if(num)v=+v;var i=PREV[arr].indexOf(v);if(i>=0)PREV[arr].splice(i,1);else PREV[arr].push(v);b.classList.toggle("on")}})}
 PREV.works=PREV.works||[];PREV.progress=PREV.progress||[];tog("k","kpis",1);tog("s","scope",0);tog("p","people",0);
 wireParties(e);
 function prog(){PREV.progress=PREV.works.map(function(w){var p=PREV.progress.filter(function(x){return x.work===w})[0];if(p)return p;var old=(D.tasks||[]).filter(function(t){return t.name===w})[0];return {work:w,status:old&&old.percent>0?"In progress":"Started",percent:old?old.percent:10,owners:old&&old.owners.length?old.owners.slice():PREV.people.slice()}});
  $("pprog").innerHTML=PREV.progress.map(function(p,i){return '<div class=pg><div class=m style="color:#E8E4D8">'+esc(p.work)+' <b id=pp'+i+' style="color:#C5A56A;float:right">'+p.percent+'%</b></div><input type=range min=0 max=100 step=5 value='+p.percent+' data-pc='+i+'><div class=chips>'+D.status.map(function(s){return '<button type=button class="chip'+(s===p.status?' on':'')+'" data-st="'+i+'|'+esc(s)+'">'+esc(s)+'</button>'}).join("")+'</div>'
   +'</div>'}).join("");
  // v572 (Najjuko: "you still put all of the people ... too much noise") - no second people list: the people under With are the people on the task
  PREV.progress.forEach(function(p){p.owners=PREV.people.filter(function(n){return n!=="All sales agents"})});
  $("pprog").querySelectorAll("[data-pc]").forEach(function(r){r.oninput=function(){var i=+r.getAttribute("data-pc");PREV.progress[i].percent=+r.value;$("pp"+i).textContent=r.value+"%";if(+r.value===100){PREV.progress[i].status="Done"}}});
  $("pprog").querySelectorAll("[data-st]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-st").split("|"),i=+v[0];PREV.progress[i].status=v[1];if(v[1]==="Done"){PREV.progress[i].percent=100}prog()}})}
 prog();
 $("wprev").querySelectorAll("[data-w]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-w"),i=PREV.works.indexOf(v);if(i>=0)PREV.works.splice(i,1);else PREV.works.push(v);b.classList.toggle("on");prog()}});
 $("pnb").onclick=function(){var v=$("pnw").value.trim();if(!v||PREV.works.indexOf(v)>=0)return;PREV.works.push(v);$("pnw").value="";var c=document.createElement("button");c.type="button";c.className="chip on";c.textContent=v;c.onclick=function(){var i=PREV.works.indexOf(v);if(i>=0)PREV.works.splice(i,1);else PREV.works.push(v);c.classList.toggle("on");prog()};$("pnw").parentNode.previousSibling.appendChild(c);prog()};
 if($("pa"))$("pa").onclick=function(){var qa=[];$("wprev").querySelectorAll(".pq").forEach(function(i){if(i.value.trim())qa.push("Q: "+e.questions[+i.getAttribute("data-q")]+"\nA: "+i.value.trim())});
  if(!qa.length)return;var one=(e.summary||$("wt").value).trim()+"\n\n"+qa.join("\n");$("pa").disabled=true;$("pa").textContent="Refiling…";
  api({action:"parse",text:one,date:$("wd").value}).then(function(j){if(j.entry){j.entry.src=one;if(QUEUE.length)QUEUE[QI]=j.entry;preview(j.entry)}})};
 $("pc").onclick=function(){EDIT=null;if(QUEUE.length>1)nextInQueue();else{QUEUE=[];QI=0;$("wprev").innerHTML=""}};
 $("pv").onclick=function(){PREV.title=$("pt").value;PREV.summary=$("ps").value;$("pv").disabled=true;$("pv").textContent="Saving…";
  api({action:"save",entry:PREV,text:PREV.src||$("wt").value,date:$("wd").value,link:$("wl").value,id:EDIT&&EDIT.id,oldDate:EDIT&&EDIT.date,created:EDIT&&EDIT.created}).then(function(j){if(!j.ok){alert(j.error||"Could not save");$("pv").disabled=false;$("pv").textContent="Save";return}
   EDIT=null;if(QUEUE.length>1){var moreToCome=QI<QUEUE.length-1}else{QUEUE=[];QI=0}
   if(QUEUE.length>1)nextInQueue();else{$("wprev").innerHTML="";$("wt").value="";$("wl").value=""}
   var t=new Date(j.entry.date+"T00:00:00Z"),dow=(t.getUTCDay()+6)%7;var wk=new Date(t.getTime()-dow*864e5).toISOString().slice(0,10);
   if(wk===D.from){D.entries=[j.entry].concat(D.entries.filter(function(x){return x.id!==j.entry.id}));D.tally.forEach(function(x){x.week=D.entries.filter(function(e){return e.kpis.indexOf(x.id)>=0}).length});draw();setTimeout(function(){load(WEEK)},1500)}else load(wk)})}}
$("wf").onsubmit=function(ev){ev.preventDefault();var t=$("wt").value.trim();if(!t)return;$("wb").disabled=true;$("wb").textContent="Filing…";
 api({action:"parse",text:t,date:$("wd").value}).then(function(j){$("wb").disabled=false;$("wb").textContent="File it";if(j.error){alert(j.error);return}
  QUEUE=(j.entries&&j.entries.length?j.entries:[j.entry]).map(function(e){e.src=e.summary;return e});QI=0;if(QUEUE.length===1)QUEUE[0].src=t;preview(QUEUE[0])}).catch(function(){$("wb").disabled=false;$("wb").textContent="File it";alert("Could not file it just now. Try again.")})};
// v567 - speak instead of typing: the browser's own speech-to-text (Safari and Chrome); where it is missing, the keyboard's microphone still works
(function(){var SR=window.SpeechRecognition||window.webkitSpeechRecognition,b=$("wmic"),r=null,on=false,base="";
 if(!SR){b.onclick=function(){alert("Tap the text box, then use the microphone on your keyboard to speak.");$("wt").focus()};return}
 function stop(){on=false;b.classList.remove("rec");b.querySelector("span").textContent="Speak";try{r&&r.stop()}catch(e){}}
 b.onclick=function(){if(on){stop();return}r=new SR();r.lang="en-GB";r.continuous=true;r.interimResults=true;base=$("wt").value.trim();base=base?base+" ":"";
  r.onresult=function(ev){var fin="",tmp="";for(var i=0;i<ev.results.length;i++){if(ev.results[i].isFinal)fin+=ev.results[i][0].transcript;else tmp+=ev.results[i][0].transcript}$("wt").value=base+fin+tmp};
  r.onend=function(){if(on){try{r.start()}catch(e){stop()}}};r.onerror=function(e){if(e.error==="not-allowed"){alert("Allow the microphone for this page to speak your entry.")}stop()};
  try{r.start();on=true;b.classList.add("rec");b.querySelector("span").textContent="Stop"}catch(e){stop()}};
 $("wf").addEventListener("submit",stop,true)})();
// v571 - Start over: clears the box and anything being checked; saved entries are untouched
$("wreset").onclick=function(){if(($("wt").value.trim()||QUEUE.length)&&!confirm("Clear what you have typed and start again? Anything already saved stays."))return;QUEUE=[];QI=0;EDIT=null;PREV=null;$("wprev").innerHTML="";$("wt").value="";$("wl").value="";$("wd").value=D?D.today:"";$("wt").focus()};
$("wprevw").onclick=function(){shift(-1)};$("wnextw").onclick=function(){shift(1)};
load()})();`;
