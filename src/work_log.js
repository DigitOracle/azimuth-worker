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
// v578 (Najjuko 14 Oct: "from four till six I was responding to my leads ... the 15 hours I need to clock 100% ... highlight the difference between
// the PR/marketing/BD and the agent work ... in the office, at MTI's, at a site"). Hours are CLOCKED (start/end), never guessed; where is read
// from the words ("in the office", "from home", "at Imtiaz") and the contract's 15 h/week minimum (clause 8.1) is tracked as a meter.
export const WHERE = ["Office", "Home", "On site", "Other", "Unspecified"];
export const MIN_HOURS = 15;
const toMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };
export function clockedHours(e) {
  const a = toMin(e.start), b = toMin(e.end);
  if (a == null || b == null) return null;
  let d = b - a; if (d < 0) d += 24 * 60;
  return d > 0 && d <= 16 * 60 ? Math.round(d / 6) / 10 : null;
}
// hours of an entry: the clock when she gave one, else the effort bucket (marked estimated)
export function hoursOf(e) { const c = clockedHours(e); return c != null ? c : (EFFORT.find((x) => x[0] === e.effort) || EFFORT[1])[1]; }
export const isClocked = (e) => clockedHours(e) != null;
// the work-kind split for the first donut: her contract role vs broker work vs other departments
// v588 (Kendall 14 Oct: "add the items a broker does in the day ... organise these into drill-downs, she does not want a million pills"): the Broker
// button opens ONE row, "What kind of broker work?", whose sheet holds five collapsed groups; she opens a group and ticks what applies.
export const BROKER_TASKS = [
  { group: "Leads", items: [["lead_reply", "Replying to new leads"], ["lead_vet", "Vetting and qualifying leads"], ["cold_call", "Cold calling"], ["warm_follow", "Following up warm leads"], ["crm", "Updating the CRM"]] },
  { group: "Conversations", items: [["wa", "WhatsApp with a client"], ["call", "Phone call with a client"], ["email", "Email to a client"], ["online", "Online meeting (video call)"], ["offline", "In-person meeting"]] },
  { group: "Viewings", items: [["viewing", "Property viewing"], ["open_house", "Open house"], ["launch", "Developer launch or open house"], ["site_visit", "Site visit with a client"]] },
  { group: "Deals", items: [["offer", "Offer and negotiation"], ["booking", "Reservation or booking form"], ["paperwork", "Contracts and paperwork"], ["handover", "Handover and after-sales"]] },
  { group: "Listings and market", items: [["listing", "Preparing or posting a listing"], ["valuation", "Valuation or price comparison"], ["research", "Market and project research"], ["huddle", "Sales huddle or training"]] },
];
const BROKER_IDS = new Set(BROKER_TASKS.flatMap((g) => g.items.map((i) => i[0])));
export function kindOf(e) { return e.broker ? "Broker" : e.in_scope !== false ? "Strategic Lead" : (e.out_role === "Sales" ? "Broker" : "Other departments"); }
// v571 (Kendall 14 Oct: "if it's outside of role ... sales, HR ... map this back to the contract ... she will be using these for negotiating").
// Outside-role work is logged with WHICH role it was and the contract line it sits against, so the log is evidence at the review.
// v575 (Kendall 14 Oct: "scope of work should be at the top ... from there a set of responsibilities"): Role is the root. Outside her role, the
// second pick is WHOSE JOB it was - a department - so the Monday huddle deck the sales director asked for is logged as Sales, not marketing.
export const OUT_ROLES = [
  ["Sales", "The sales team's work: meetings, decks, showings, deals (not in Schedule 1; clause 5.3 covers commission when she acts as an agent)"],
  ["Marketing (hands-on)", "Filming, editing, design, publishing, comments and DMs (clause 2.3: hands-on work belongs to the Execution Team; clause 3.1: Company provides it)"],
  ["HR, Admin & Compliance", "Reception, admin, permits, visas (Schedule 4: Admin & compliance, not the Strategic Lead)"],
  ["Finance", "Invoices, payments, collections (no finance duty in Schedule 1)"],
  ["Leadership", "Deciding, negotiating or contracting for the Company (Schedule 4: Company management is accountable)"],
  ["Own ventures", "Her own brands and the Najma feed (clauses 12.2 and 12.4: hers, separate from FN)"],
  ["Other", "Anything else outside the eleven parts of Schedule 1"],
];
const OUT_ALIAS = { "Sales agent": "Sales", "Execution Team (hands-on)": "Marketing (hands-on)", "Leadership / management decisions": "Leadership" };
const SCHEMA = { type: "object", additionalProperties: false, required: ["title", "type", "summary", "people", "kpis", "scope", "works", "deliverables", "evidence", "next", "questions", "time_of_day", "alone", "in_scope", "external"], properties: {
  time_of_day: { type: "string", enum: TIMES }, alone: { type: "boolean" }, in_scope: { type: "boolean" }, broker: { type: "boolean" }, broker_tasks: { type: "array", items: { type: "string" } }, out_role: { type: "string" },
  start: { type: "string" }, end: { type: "string" }, where: { type: "string", enum: WHERE },
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
    + "start and end: 24-hour HH:MM when the entry gives a time span ('from 4 till 6' in the morning = 04:00-06:00; '10 to 3' at an open house = 10:00-15:00; '8 until 9:30' = 08:00-09:30; 'after lunch for an hour' has no clock: empty strings). Never invent a clock time. "
    + "where: Office (FN's office, Prime Tower), Home (home, remote, 'from my apartment'), On site (a developer's office, an open house, a client's premises, a venue, 'at Imtiaz'), Other, or Unspecified. "
    + "alone: true when she did it by herself with no staff or third party involved. in_scope: true when the activity sits inside the eleven parts of her role; false when it is outside them. "
    + "broker: true when the activity is BROKER work (leads, calls, showing a unit, viewings, open houses, client follow-up, a sales huddle): that is the second part of her role, so in_scope stays true. broker_tasks: for broker work, the ids that apply, from: " + BROKER_TASKS.flatMap((g) => g.items.map((i) => i[0] + " = " + i[1])).join("; ") + ". out_role: when in_scope is false, WHOSE JOB it really was, exactly one of: " + OUT_ROLES.map((r) => r[0]).join(" | ") + ". A sales meeting, a sales huddle, a deck or planner the sales director asked for, showing a unit, chasing a client's deal = Sales (even if it looked like marketing work); filming or designing herself = Marketing (hands-on); reception or paperwork = HR, Admin & Compliance. Empty string when in scope. "
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
// v578 - "from 4 till 6", "10 to 3", "8 until 9:30", "4am-6am", "between 2 and 4pm": a clock span. Morning words put ambiguous hours before noon,
// an open house / afternoon puts a small end after a larger start into the afternoon (10 to 3 = 10:00-15:00).
export function spanOf(t) {
  const m = /\b(?:from|between)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:till|til|until|to|-|–|and)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(t);
  if (!m) return { start: "", end: "" };
  let h1 = +m[1], h2 = +m[4]; const mm1 = m[2] || "00", mm2 = m[5] || "00", ap1 = (m[3] || "").toLowerCase(), ap2 = (m[6] || "").toLowerCase();
  if (h1 > 24 || h2 > 24) return { start: "", end: "" };
  const pm = (h, ap) => ap === "pm" && h < 12 ? h + 12 : ap === "am" && h === 12 ? 0 : h;
  h1 = pm(h1, ap1 || (ap2 && h1 <= 12 && h1 < h2 ? ap2 : "")); h2 = pm(h2, ap2);
  const eveningish = /\b(afternoon|evening|open house|after lunch|pm)\b/i.test(t), morningish = /\b(morning|woke|first thing|am)\b/i.test(t);
  if (!ap1 && !ap2) { if (h2 < h1 && h2 + 12 > h1) h2 += 12; if (eveningish && !morningish && h1 < 12 && h1 + 12 <= 23 && h2 <= 12) { h1 += 12; if (h2 + 12 <= 24) h2 += 12; } else if (eveningish && !morningish && h1 >= 8 && h1 < 12 && h2 < h1) h2 += 12; }
  if (h1 > 23 || h2 > 24) return { start: "", end: "" };
  const f = (h, mi) => String(h % 24).padStart(2, "0") + ":" + mi;
  return { start: f(h1, mm1), end: f(h2 === 24 ? 0 : h2, mm2) };
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
  const outside = /\b(my own|personal|reception|errand|outside (my )?scope|not my job|her recode|najjuko edit|be by her|as an agent|showed? (a|the) unit|viewing with (a|the|my) client|sales (meeting|huddle|workshop)|sales director asked)\b/.test(t);
  const outRole = !outside ? "" : /reception|paperwork|visa|permit/.test(t) ? "HR, Admin & Compliance" : /as an agent|showed? (a|the) unit|viewing with|sales (meeting|huddle|workshop|team)|client'?s deal|sales director/.test(t) ? "Sales" : /her recode|najjuko edit|be by her|my own brand/.test(t) ? "Own ventures" : /filmed|edited|designed it myself|posted it myself/.test(t) ? "Marketing (hands-on)" : "Other";
  return { title: ((v) => (v.length > 60 ? v.slice(0, 59).trimEnd() + "\u2026" : v))(text.split(/[.\n]/)[0].trim()), type: /meeting|huddle|call/.test(t) ? "Meeting" : "Update", summary: text.slice(0, 300), people, kpis: [...kp], scope: [...sc], works, deliverables: [], evidence: [], next: [], questions: [], check: true,
    time_of_day: tod, alone: people.length === 0 && !/\bwith\b/.test(t), in_scope: !outside, out_role: outRole, external: [],
    ...spanOf(t), where: /\b(in|at) the office\b|\bprime tower\b/.test(t) ? "Office" : /\bfrom home\b|\bat home\b|\bremote(ly)?\b|\bmy apartment\b|\bkendall'?s apartment\b/.test(t) ? "Home" : /\bopen house\b|\bon ?site\b|\bsite visit\b|\bat (imtiaz|mti|emaar|damac|sobha|nakheel|binghatti|danube|the (developer|client|venue))\b|\bshowroom\b|\bviewing\b/.test(t) ? "On site" : "Unspecified",
    prep: pm || dv ? { needed: true, developer: dv ? (/imtiaz|mti/.test(dv[1]) ? "Imtiaz Developments" : dv[1].replace(/^./, (c) => c.toUpperCase())) : "", project: "", area: "", event: pm ? pm[1] : "" } : null,
    effort: /all day|full day/.test(t) ? "Full day" : /meeting|huddle|deck|powerpoint/.test(t) ? "Half a day" : "1-2 hours",
    progress: works.map((w) => ({ work: w, status: p0 >= 100 ? "Done" : started && !half && !pct ? "Started" : "In progress", percent: p0, owners: people.filter((n) => n !== "All sales agents") })) };
}

function clean(x) {
  const ids = new Set(SCOPE.map((s) => s.id)), names = new Set(PEOPLE.map((p) => p[0]));
  const arr = (a, n) => (Array.isArray(a) ? a : []).map((v) => String(v).slice(0, 200)).filter(Boolean).slice(0, n || 12);
  return { title: (String(x.title || "").length > 90 ? String(x.title || "").slice(0, 89).trimEnd() + "\u2026" : String(x.title || "")), type: TYPES.includes(x.type) ? x.type : "Other", summary: String(x.summary || "").slice(0, 700),
    people: arr(x.people).filter((p) => names.has(p)), kpis: [...new Set((x.kpis || []).map(Number).filter((n) => n >= 1 && n <= 5))],
    scope: [...new Set(arr(x.scope).filter((s) => ids.has(s)))], works: [...new Set(arr(x.works).map((w) => w.slice(0, 80).trim()).filter(Boolean))].slice(0, 6),
    effort: EFFORT.some((e) => e[0] === x.effort) ? x.effort : "1-2 hours",
    time_of_day: TIMES.includes(x.time_of_day) ? x.time_of_day : "Unspecified", alone: !!x.alone, in_scope: x.in_scope !== false || !!x.broker, broker: !!x.broker, broker_tasks: (Array.isArray(x.broker_tasks) ? x.broker_tasks : []).map(String).filter((t) => BROKER_IDS.has(t)).slice(0, 10),
    start: toMin(x.start) != null ? x.start : "", end: toMin(x.end) != null ? x.end : "", where: WHERE.includes(x.where) ? x.where : "Unspecified",
    out_role: x.in_scope === false && !x.broker ? (OUT_ROLES.some((r) => r[0] === (OUT_ALIAS[x.out_role] || x.out_role)) ? (OUT_ALIAS[x.out_role] || x.out_role) : "Other") : "",
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
const TPFX = "work_naj_task_";   // v600 - a task's progress set directly (name, percent, status, updated); it wins over the entries until a newer entry moves the task
const STOP = new Set(["with", "from", "that", "this", "have", "will", "been", "were", "they", "their", "there", "what", "when", "which", "about", "agenda", "page", "date", "2026", "2025", "week", "team", "meeting", "report", "notes"]);
async function knownDocs(env) {
  const out = []; let cursor;
  do { const r = await env.MEETINGS.list({ prefix: "work_naj_doc_", cursor }); cursor = r.list_complete ? null : r.cursor; for (const k of r.keys) out.push(k.name); } while (cursor);
  return (await Promise.all(out.map((n) => env.MEETINGS.get(n).then((v) => { try { return JSON.parse(v); } catch (e) { return null; } })))).filter((d) => d && d.keys && d.keys.length);
}
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
    const hrs = hoursOf(e), ws = e.works || [];
    ws.forEach((w) => {
      const t = T[w] = T[w] || { name: w, first: e.date, last: e.date, days: new Set(), hours: 0, status: "In progress", percent: 0, entries: 0, kpis: new Set(), owners: new Set(), touched: new Set() };
      const p = (e.progress || []).find((x) => x.work === w);
      t.last = e.date; t.days.add(e.date); t.hours += hrs / ws.length; t.entries++; (e.kpis || []).forEach((k) => t.kpis.add(k)); (e.people || []).forEach((n) => t.touched.add(n));
      t.lastc = e.created || ""; if (p) { t.status = p.status; t.percent = p.percent; (p.owners || []).forEach((n) => t.owners.add(n)); }
    });
  });
  return Object.values(T).map((t) => ({ ...t, days: t.days.size, kpis: [...t.kpis], owners: [...t.owners], touched: [...t.touched], hours: Math.round(t.hours * 10) / 10 }))
    .sort((a, b) => (a.status === "Done") - (b.status === "Done") || (a.last < b.last ? 1 : -1));
}
// v600 - a progress set by hand wins over the entries until an entry newer than it moves the task again
export function applyOverrides(tasks, ovs) {
  const m = {}; (ovs || []).forEach((o) => { if (o && o.name) m[o.name] = o; });
  return tasks.map((t) => { const o = m[t.name]; if (!o || !(String(o.updated || "") > String(t.lastc || ""))) return t; const done = o.status === "Done" || o.percent >= 100;
    return { ...t, percent: done ? 100 : o.percent, status: done ? "Done" : o.status, set_by_hand: true, last: String(o.updated).slice(0, 10) > t.last ? String(o.updated).slice(0, 10) : t.last }; })
    .sort((a, b) => (a.status === "Done") - (b.status === "Done") || (a.last < b.last ? 1 : -1));
}
async function taskOverrides(env) {
  const out = []; let cursor;
  do { const r = await env.MEETINGS.list({ prefix: TPFX, cursor }); cursor = r.list_complete ? null : r.cursor; for (const k of r.keys) { try { out.push(JSON.parse(await env.MEETINGS.get(k.name))); } catch (e) {} } } while (cursor);
  return out;
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
  return KPIS.map((k) => ({ id: k.id, name: k.name, hours: Math.round(es.filter((e) => (e.kpis || []).includes(k.id)).reduce((s, e) => s + hoursOf(e) / Math.max(1, (e.kpis || []).length), 0) * 10) / 10 }));
}
// v578 - the hours picture for a set of entries: total, how much is clocked vs estimated, the 15 h meter, and the two splits (what kind of work; where)
export function hoursPicture(es) {
  const r1 = (n) => Math.round(n * 10) / 10, tot = r1(es.reduce((s, e) => s + hoursOf(e), 0)), clk = r1(es.filter(isClocked).reduce((s, e) => s + hoursOf(e), 0));
  const kinds = ["Strategic Lead", "Broker", "Other departments"].map((k) => ({ name: k, hours: r1(es.filter((e) => kindOf(e) === k).reduce((s, e) => s + hoursOf(e), 0)) }));
  const places = WHERE.map((w) => ({ name: w === "Unspecified" ? "Not stated" : w, hours: r1(es.filter((e) => (e.where || "Unspecified") === w).reduce((s, e) => s + hoursOf(e), 0)) }));
  return { total: tot, clocked: clk, estimated: r1(tot - clk), min: MIN_HOURS, kinds, places };
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

// ---- v617 RECORD: a meeting, briefing or interview recorded in the browser in five-minute parts, read on arrival, then turned into notes and a drafted entry -------------
// Kendall, 21 Oct 2026. Audio is read by the speech engine as each part arrives and is NOT kept once read (only if the engine failed, for 48 hours, so it can be retried);
// the transcript and the notes stay under her key until she deletes them. KV keys: recw_<id> (the recording), recs_<id>_<nnn> (a part's text), reca_<id>_<nnn> (audio awaiting a retry).
const RECW = "recw_", RECS = "recs_", RECA = "reca_", STT_MODEL = "@cf/openai/whisper-large-v3-turbo", REC_MAX_PART = 8 * 1024 * 1024, REC_MAX_PER_DAY = 40;
const dubaiHM = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(11, 16);
const recId = (v) => String(v || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
const recDateOf = (id) => id.slice(0, 4) + "-" + id.slice(4, 6) + "-" + id.slice(6, 8);
const escH = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
async function recGet(env, id) { try { return JSON.parse(await env.MEETINGS.get(RECW + id)); } catch (e) { return null; } }
async function recPut(env, m) { await env.MEETINGS.put(RECW + m.id, JSON.stringify(m)); }
function recB64(bytes) { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
async function recTranscribe(env, bytes) {
  const out = await env.AI.run(STT_MODEL, { audio: recB64(bytes), language: "en", vad_filter: true });
  return String(out && out.text || "").trim();
}
const segKey = (id, n) => RECS + id + "_" + String(n).padStart(3, "0");
async function recSegs(env, id) {
  const keys = []; let cursor;
  do { const r = await env.MEETINGS.list({ prefix: RECS + id + "_", cursor }); cursor = r.list_complete ? null : r.cursor; for (const k of r.keys) keys.push(k.name); } while (cursor);
  const vals = await Promise.all(keys.map((k) => env.MEETINGS.get(k).then((v) => { try { return JSON.parse(v); } catch (e) { return null; } })));
  return vals.filter(Boolean).sort((a, b) => a.n - b.n);
}
const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(Math.round(s % 60)).padStart(2, "0");
function recTranscriptText(segs, markers) {
  let t = 0; return segs.map((g) => { const head = markers ? "[" + mmss(t) + "] " : ""; t += g.secs || 0; return g.text ? head + g.text : ""; }).filter(Boolean).join(markers ? "\n\n" : "\n");
}
async function recChunk(request, env, url, J) {
  const id = recId(url.searchParams.get("id")), n = Math.max(0, Math.min(999, parseInt(url.searchParams.get("n"), 10) || 0)), secs = Math.max(0, Math.min(1800, parseInt(url.searchParams.get("secs"), 10) || 0));
  const m = id ? await recGet(env, id) : null; if (!m) return J({ error: "No recording with that id." }, 404);
  if (await env.MEETINGS.get(segKey(id, n))) return J({ ok: true, n, again: true });   // a retry of a part already read
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length < 1000) return J({ error: "That part was empty." }, 400);
  if (bytes.length > REC_MAX_PART) return J({ error: "That part is too big." }, 413);
  let text = null;
  try { text = await recTranscribe(env, bytes); } catch (e) { text = null; }
  if (text == null) {   // the speech engine failed: keep the audio for 48 hours so Stop can retry it
    await env.MEETINGS.put(RECA + id + "_" + String(n).padStart(3, "0"), bytes.buffer, { expirationTtl: 172800 });
    await env.MEETINGS.put(segKey(id, n), JSON.stringify({ n, secs, text: "", pending: true }));
    return J({ ok: true, n, pending: true });
  }
  await env.MEETINGS.put(segKey(id, n), JSON.stringify({ n, secs, text }));
  return J({ ok: true, n, chars: text.length });
}
const REC_NOTES_SCHEMA = { type: "object", additionalProperties: false, required: ["summary", "decisions", "actions", "people", "topics"], properties: {
  summary: { type: "string" }, decisions: { type: "array", items: { type: "string" } }, topics: { type: "array", items: { type: "string" } }, people: { type: "array", items: { type: "string" } },
  actions: { type: "array", items: { type: "object", additionalProperties: false, required: ["what", "owner", "due"], properties: { what: { type: "string" }, owner: { type: "string" }, due: { type: "string" } } } } } };
const REC_BLOCK_SCHEMA = { type: "object", additionalProperties: false, required: ["notes"], properties: { notes: { type: "string" } } };
async function recNotes(env, deps, m, transcript) {
  const names = PEOPLE.map((x) => x[0]).join(", ");
  const sys = "You write meeting notes for Najjuko, the Strategic Lead at FN Realty (a Dubai real-estate brokerage), from an AUTOMATIC transcript of a meeting, briefing or interview she attended or ran. "
    + "The speech engine mishears names and numbers: use a name only when the transcript clearly supports it, and prefer these team names when a spelling is close: " + names + ". "
    + "Never invent anything: no people, figures, dates, decisions or tasks that the transcript does not contain. If something is unclear, leave it out. Plain, third-person, specific; no filler. "
    + "summary: five to eight sentences on what the meeting was and what it decided. topics: the main subjects, a few words each. decisions: each decision taken. actions: each task or follow-up with its owner (a name, or 'Najjuko' when it is hers, or '' if unstated) and the due date or time as said ('' if none). people: everyone who clearly took part.";
  let input = transcript;
  if (transcript.length > 24000) {   // a long meeting: condense each part first, in parallel, then write the notes from the condensed parts
    const paras = [], blocks = []; let cur = "";
    for (const q of transcript.split(/\n+/)) { let t = q; while (t.length > 12000) { paras.push(t.slice(0, 12000)); t = t.slice(12000); } if (t) paras.push(t); }
    for (const p of paras) { if (cur && cur.length + p.length > 14000) { blocks.push(cur); cur = ""; } cur += (cur ? "\n\n" : "") + p; }
    if (cur) blocks.push(cur);
    const sysB = "Condense this part of a long meeting transcript into dense notes of at most 1500 characters: who said what that matters, decisions, tasks with owners and dates, figures, names, open questions. Never invent; the speech engine mishears names, so mark an uncertain one with a question mark.";
    const notes = await Promise.all(blocks.map(async (b, i) => { try { const x = await deps.claudeJSON(env, sysB, "Part " + (i + 1) + " of " + blocks.length + ":\n" + b, REC_BLOCK_SCHEMA, deps.model, 900); return x && x.notes ? String(x.notes) : b.slice(0, 1500); } catch (e) { return b.slice(0, 1500); } }));
    input = notes.map((t, i) => "[Part " + (i + 1) + " of " + notes.length + "]\n" + t).join("\n\n");
  }
  let x = null;
  try { x = await deps.claudeJSON(env, sys, "Meeting: " + (m.title || "untitled") + ", " + m.date + ", " + (m.started_hm || "") + (m.ended_hm ? " to " + m.ended_hm : "") + " (" + Math.round((m.secs || 0) / 60) + " minutes).\n\nTranscript" + (transcript.length > 24000 ? " (condensed)" : "") + ":\n" + input, REC_NOTES_SCHEMA, deps.model, 2500); } catch (e) { x = null; }
  if (!x || typeof x !== "object") return null;
  const arr = (a, k) => (Array.isArray(a) ? a : []).map((v) => String(v).slice(0, 300).trim()).filter(Boolean).slice(0, k);
  return { summary: String(x.summary || "").slice(0, 1800).trim(), topics: arr(x.topics, 10), decisions: arr(x.decisions, 15), people: arr(x.people, 20),
    actions: (Array.isArray(x.actions) ? x.actions : []).slice(0, 25).map((a) => ({ what: String(a.what || "").slice(0, 240).trim(), owner: String(a.owner || "").slice(0, 60).trim(), due: String(a.due || "").slice(0, 60).trim() })).filter((a) => a.what) };
}
async function recApi(request, env, J, deps) {
  let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
  if (b.action === "start") {
    const today = dubaiToday(), compact = today.replace(/-/g, "");
    const have = (await env.MEETINGS.list({ prefix: RECW + compact })).keys.length;
    if (have >= REC_MAX_PER_DAY) return J({ error: "That is forty recordings today. Delete some you no longer need." }, 429);
    const id = compact + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);
    const m = { id, date: today, title: String(b.title || "").slice(0, 90).trim(), started_hm: dubaiHM(), started: new Date().toISOString(), status: "recording", secs: 0 };
    await recPut(env, m); return J({ ok: true, id, date: today });
  }
  if (b.action === "list") {
    const date = okDate(b.date), compact = date.replace(/-/g, ""), out = [];
    for (const k of (await env.MEETINGS.list({ prefix: RECW + compact })).keys) { const m = await recGet(env, k.name.slice(RECW.length)); if (m) out.push(m); }
    const recs = [];
    for (const m of out.sort((a, c) => (a.started < c.started ? 1 : -1))) { const segs = await recSegs(env, m.id); recs.push({ id: m.id, title: m.title, started_hm: m.started_hm, status: m.status, secs: m.secs || segs.reduce((a, g) => a + (g.secs || 0), 0), parts: segs.length }); }
    return J({ ok: true, recs, date });
  }
  const id = recId(b.id), m = id ? await recGet(env, id) : null;
  if (!m) return J({ error: "I cannot find that recording." }, 404);
  if (b.action === "delete") {
    for (const g of await recSegs(env, id)) { await env.MEETINGS.delete(segKey(id, g.n)); await env.MEETINGS.delete(RECA + id + "_" + String(g.n).padStart(3, "0")); }
    await env.MEETINGS.delete(RECW + id); return J({ ok: true });
  }
  if (b.action === "finish") {
    let segs = await recSegs(env, id);
    for (const g of segs) if (g.pending) {   // retry the parts the speech engine could not read when they arrived
      const key = RECA + id + "_" + String(g.n).padStart(3, "0");
      try { const buf = await env.MEETINGS.get(key, "arrayBuffer"); if (buf) { const text = await recTranscribe(env, new Uint8Array(buf)); await env.MEETINGS.put(segKey(id, g.n), JSON.stringify({ n: g.n, secs: g.secs, text })); await env.MEETINGS.delete(key); } } catch (e) {}
    }
    segs = await recSegs(env, id);
    const missing = segs.filter((g) => g.pending && !g.text).map((g) => g.n), text = recTranscriptText(segs, false);
    m.secs = Math.max(Math.round(Number(b.secs) || 0), segs.reduce((a, g) => a + (g.secs || 0), 0)); m.ended_hm = dubaiHM(); m.chars = text.length; m.parts = segs.length;
    if (m.status === "recording") m.status = "transcribed";
    await recPut(env, m);
    if (text.length < 40) return J({ error: segs.length ? "I could not hear any speech in that recording. Check the microphone, or try again." : "No part of that recording reached the server. Check the connection and try again.", parts: segs.length }, 422);
    return J({ ok: true, parts: segs.length, chars: text.length, secs: m.secs, missing });
  }
  if (b.action === "entries") {
    const segs = await recSegs(env, id), transcript = recTranscriptText(segs, false);
    if (transcript.length < 40) return J({ error: "There is no speech to read in that recording yet." }, 422);
    if (!m.ended_hm) { m.ended_hm = dubaiHM(); m.secs = m.secs || segs.reduce((a, g) => a + (g.secs || 0), 0); }
    const notes = m.notes && m.notes.summary ? m.notes : await recNotes(env, deps, m, recTranscriptText(segs, true));
    if (notes) m.notes = notes;
    const date = m.date, mins = Math.max(1, Math.round((m.secs || 0) / 60));
    const prompt = "Date: " + date + " (" + dayName(date) + ")\nShe recorded " + (m.title ? "\"" + m.title + "\"" : "a meeting") + ", " + (m.started_hm || "") + " to " + (m.ended_hm || "") + " (" + mins + " minutes), and the notes below were written from the recording.\n\n"
      + (notes ? "Summary: " + notes.summary + "\nTopics: " + notes.topics.join("; ") + "\nDecisions: " + (notes.decisions.join("; ") || "none stated") + "\nTasks and follow-ups: " + (notes.actions.map((a) => a.what + (a.owner ? " (" + a.owner + ")" : "") + (a.due ? " by " + a.due : "")).join("; ") || "none stated") + "\nPeople present: " + (notes.people.join(", ") || "not stated")
        : "Transcript (automatic, may mishear names):\n" + transcript.slice(0, 12000))
      + "\n\nFile it as her work-log entry. ONE entry for the meeting itself (a briefing, interview or meeting she attended or ran is a Meeting). Add a separate entry only for something clearly separate that she herself did or was handed in it. "
      + "Every task or follow-up goes in works/progress with its owner and status; decisions and next steps go in the summary, evidence and next. Use only what the notes say.";
    let x = null; try { x = await deps.claudeJSON(env, sysPrompt(), prompt, DAY_SCHEMA, deps.model, 4000); } catch (e) {}
    let list = x && Array.isArray(x.entries) && x.entries.length ? x.entries.map(clean) : [clean(fallback((m.title || "Meeting") + ". " + (notes ? notes.summary : transcript.slice(0, 600))))];
    list.forEach((e, i) => { if (i === 0 && m.secs >= 60 && !e.start && toMin(m.started_hm) != null && toMin(m.ended_hm) != null && toMin(m.ended_hm) > toMin(m.started_hm)) { e.start = m.started_hm; e.end = m.ended_hm; }
      if (e.time_of_day === "Unspecified" && toMin(e.start || m.started_hm) != null) { const h = Math.floor(toMin(e.start || m.started_hm) / 60); e.time_of_day = h < 12 ? "Morning" : h < 14 ? "Midday" : h < 18 ? "Afternoon" : "Evening"; } });
    const known = await knownParties(env), seen = {};
    for (const e of list) for (const o of e.external) {
      const k = known.find((p) => slug(p.name) === slug(o.name) || (p.aliases || []).some((a) => slug(a) === slug(o.name)));
      if (k) { Object.assign(o, { name: k.name, kind: k.kind || o.kind, what: k.what || "", where: k.where || "", site: k.site || "", confirmed: true, known: true }); continue; }
      const key = slug(o.name); if (!seen[key]) seen[key] = lookupParty(env, o.name, o.kind);
      const f = await seen[key]; if (f) Object.assign(o, { suggested: f.name, kind: f.kind || o.kind, what: f.what, where: f.where, site: f.site, confidence: f.confidence, confirmed: false });
      else Object.assign(o, { suggested: "", what: "", confirmed: false, notfound: true });
    }
    if (m.status !== "filed") m.status = "drafted";
    await recPut(env, m);
    return J({ ok: true, entries: list.slice(0, 20), title: m.title, secs: m.secs, date, notes: !!notes });
  }
  if (b.action === "log") { m.log = (m.log || []).concat((Array.isArray(b.ev) ? b.ev : []).slice(0, 80).map((x) => String(x).replace(/[^ -~]/g, "").slice(0, 120))).slice(-120); await recPut(env, m); return J({ ok: true }); }   // v620 - the page's own step trail (event names and sizes only), so a stuck recording can be traced
  if (b.action === "filed") { m.status = "filed"; await recPut(env, m); return J({ ok: true }); }
  return J({ error: "Unknown action." }, 400);
}
async function recView(env, url) {
  const id = recId(url.searchParams.get("id")), m = id ? await recGet(env, id) : null;
  if (!m) return new Response("not found", { status: 404 });
  const segs = await recSegs(env, id), tx = recTranscriptText(segs, true), n = m.notes;
  const li = (a) => a.length ? "<ul>" + a.map((t) => "<li>" + escH(t) + "</li>").join("") + "</ul>" : "<p class=m>None stated.</p>";
  const body = "<h1>" + escH(m.title || "Recording") + "</h1><p class=m>" + escH(m.date) + " · " + escH(m.started_hm || "") + (m.ended_hm ? " to " + escH(m.ended_hm) : "") + " · " + Math.round((m.secs || 0) / 60) + " minutes · " + segs.length + " parts</p>"
    + (n ? "<h2>Summary</h2><p>" + escH(n.summary) + "</p><h2>Decisions</h2>" + li(n.decisions) + "<h2>Tasks and follow-ups</h2>" + li(n.actions.map((a) => a.what + (a.owner ? " (" + a.owner + ")" : "") + (a.due ? ", by " + a.due : ""))) + "<h2>People</h2><p>" + escH(n.people.join(", ") || "Not stated") + "</p>" : "<p class=m>Notes are written when you tap Make entry.</p>")
    + "<h2>Transcript</h2><p class=m>Written automatically: names and numbers may be misheard.</p><div class=tx>" + escH(tx).replace(/\n\n/g, "<br><br>") + "</div>";
  return new Response("<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>" + escH(m.title || "Recording") + "</title><meta name=robots content=noindex><style>body{font:16px/1.5 'IBM Plex Sans',system-ui,sans-serif;color:#1C2321;background:#FAF7F1;margin:0;padding:24px 16px 80px}.w{max-width:720px;margin:0 auto}h1{color:#0A4F4A;margin:0 0 4px}h2{font-size:1rem;color:#8A6F3E;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.08em}.m{color:#626B78;font-size:.9rem}.tx{background:#fff;border:1px solid #E3DDD1;border-radius:14px;padding:16px;font-size:.95rem}@media print{body{background:#fff}}</style></head><body><div class=w>" + body + "</div></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function workRoute(request, env, url, deps) {
  const p = url.pathname;
  if (!p.startsWith("/momo/work")) return null;
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!deps.isNaj(env, url)) {   // the owner (or anyone else): the room exists, the log is hers alone
    if (p !== "/momo/work") return new Response("not found", { status: 404 });
    return new Response(deps.page(key, rk, '<a class=back href="/momo?key=' + encodeURIComponent(key) + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Work</h1><div class=empty><p>Najjuko\'s work log is private to her link.</p></div>'), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (p.startsWith("/momo/work/plan")) return planRoute(request, env, url, deps, { agents: PEOPLE.filter((x) => deptOf(x[0]) === "Sales").map((x) => x[0]), team: PEOPLE.filter((x) => ["Marketing", "Leadership"].includes(deptOf(x[0]))).map((x) => [x[0], x[1]]) });   // v590 - the content plan
  if (p === "/momo/work/prep.js") return new Response(PREP_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work.js") return new Response(WORK_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/rec/chunk" && request.method === "POST") return recChunk(request, env, url, J);        // v617 - one part of a recording
  if (p === "/momo/work/rec/api" && request.method === "POST") return recApi(request, env, J, deps);
  if (p === "/momo/work/rec/view") return recView(env, url);
  if (p === "/momo/work/api") {
    if (request.method === "GET") {
      const [f, t] = weekOf(okDate(url.searchParams.get("week")));
      const week = await listEntries(env, f, t), all = await listEntries(env, PHASES[0].from, TERM_END);
      const tally = KPIS.map((k) => ({ id: k.id, name: k.name, week: week.filter((e) => e.kpis.includes(k.id)).length, term: all.filter((e) => e.kpis.includes(k.id)).length }));
      // v576 - outside-role work counted on its own, by whose job it was (the renewal evidence)
      const ow = week.filter((e) => e.in_scope === false), byD = {}; ow.forEach((e) => { const d = e.out_role || "Other"; byD[d] = (byD[d] || 0) + 1; });
      const outside = { week: ow.length, term: all.filter((e) => e.in_scope === false).length, by: Object.keys(byD).sort((a, b) => byD[b] - byD[a]).map((d) => ({ dept: d, n: byD[d] })) };
      return J({ from: f, to: t, today: dubaiToday(), start: PHASES[0].from, entries: week, tally, outside, hoursweek: hoursPicture(week), where: WHERE, tasks: applyOverrides(tasksOf(all), await taskOverrides(env)), depts: deptBoard(applyOverrides(tasksOf(all), await taskOverrides(env)), dubaiToday()), org: DEPTS.map((d) => ({ dept: d, people: PEOPLE.filter((x) => deptOf(x[0]) === d).map((x) => x[0]) })), hours: hoursByKpi(week), status: STATUS, effort: EFFORT.map((x) => x[0]), review_due: REVIEW_DUE, phase: PHASES.find((x) => dubaiToday() >= x.from && dubaiToday() <= x.to) || null, scope: SCOPE, kpis: KPIS, people: PEOPLE.map((x) => x[0]), works: WORKS, types: TYPES, times: TIMES, out_roles: OUT_ROLES, broker_tasks: BROKER_TASKS,
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
    if (b.action === "task_progress") {
      const name = String(b.name || "").trim().slice(0, 80); if (!name) return J({ error: "Which task?" }, 400);
      const pct = Math.max(0, Math.min(100, Math.round(Number(b.percent) || 0))); let st = STATUS.includes(b.status) ? b.status : (pct >= 100 ? "Done" : "In progress"); if (st === "Done") st = "Done";
      const rec = { name, percent: st === "Done" ? 100 : pct, status: st, updated: new Date().toISOString() };
      await env.MEETINGS.put(TPFX + slug(name), JSON.stringify(rec)); return J({ ok: true, task: rec });
    }
    // v583 UPLOAD (Kendall 14 Oct: "upload an existing PDF ... extract activities, tasks ... the morning huddle PDF ... build out a DNA for that type of
    // meeting"). The file's text is read in the Worker (Workers AI toMarkdown for PDF, Word, Excel, CSV; the OCR lane for scans), then filed through
    // the SAME step as typed text, so a huddle deck comes back as activities and tasks. A recurring document is remembered by its shape (doc DNA).
    if (b.action === "upload") {
      const name = String(b.name || "file").slice(0, 120), ct = String(b.type || "").toLowerCase(), b64 = String(b.data || "");
      if (!b64 || b64.length > 9_000_000) return J({ error: b64 ? "That file is too big (6 MB limit)." : "No file." }, 400);
      let text = "";
      try { text = deps.toMd ? await deps.toMd(env, name, ct, b64) : ""; } catch (e) {}
      if (!text && /pdf|image/.test(ct) && deps.ocr) { try { text = await deps.ocr(env, name, ct, b64); } catch (e) {} }
      if (!text) return J({ error: "I could not read any text in that file. A scan needs the OCR lane; a photo of a page works too." }, 422);
      text = text.replace(/\s+\n/g, "\n").slice(0, 12000);
      // doc DNA: has she uploaded this kind of document before? (matched on the title words of the first lines)
      const dna = await knownDocs(env), head = text.split("\n").slice(0, 6).join(" ").toLowerCase(), hit = dna.find((d) => d.keys.filter((k) => head.includes(k)).length >= Math.max(2, Math.ceil(d.keys.length * 0.6)));
      let x = null;
      const prompt = "Date: " + okDate(b.date) + " (" + dayName(okDate(b.date)) + ")\nShe uploaded a document named \"" + name + "\"." + (hit ? " This is a recurring document she has filed before as \"" + hit.title + "\" (" + hit.kind + "); last time it was filed as: " + hit.summary + ". File it the same way unless the content differs." : "")
        + "\nFile its contents as her work-log entries: what she did (prepared, presented, ran, agreed), who was there, every task or action it lists with its owner and status, decisions, next steps. A deck or agenda she produced is a Deliverable AND the meeting it was for is a Meeting.\nDocument text:\n" + text;
      try { x = await deps.claudeJSON(env, sysPrompt(), prompt, DAY_SCHEMA, deps.model, 4000); } catch (e) {}
      const list = x && Array.isArray(x.entries) && x.entries.length ? x.entries.map(clean) : splitDay(text.slice(0, 3000)).slice(0, 8).map((s) => clean(fallback(s)));
      list.forEach((e) => { e.src_file = name; });
      return J({ entries: list.slice(0, 20), entry: list[0], file: name, chars: text.length, recognised: hit ? hit.title : "", excerpt: text.slice(0, 400) });
    }
    if (b.action === "doc_dna") {   // on save of an uploaded file's entries: remember the document's shape, so next time it is recognised
      const name = String(b.name || "").slice(0, 120), title = String(b.title || name).slice(0, 80), kind = String(b.kind || "document").slice(0, 40), summary = String(b.summary || "").slice(0, 400), head = String(b.head || "").toLowerCase();
      if (!name) return J({ error: "No name." }, 400);
      const keys = [...new Set((head + " " + title.toLowerCase()).match(/[a-z][a-z0-9&'-]{3,}/g) || [])].filter((w) => !STOP.has(w)).slice(0, 12);
      const key = "work_naj_doc_" + slug(title); let rec = null; try { rec = JSON.parse(await env.MEETINGS.get(key)); } catch (e) {}
      rec = Object.assign(rec || { title, first_seen: dubaiToday(), times: 0 }, { kind, summary, keys: keys.length ? keys : (rec && rec.keys) || [], last_file: name, last_seen: dubaiToday(), times: ((rec && rec.times) || 0) + 1 });
      await env.MEETINGS.put(key, JSON.stringify(rec));
      return J({ ok: true, doc: rec });
    }
    // v583 VET (Kendall 14 Oct: "if she mentions she's meeting with a particular vendor, you perform your due diligence") - the engine's /vet, same secret
    // v597 (Kendall 14 Oct: "the data thread wired into Momo Work"): an AREA card for any place an entry names. The engine's /area answers from lk_area_thread (a sentence per topic, with its
    // sources and as_of; expired Google rows are never returned; ambiguous names return candidates and pick none). Google-derived sentences must show the attribution line.
    if (b.action === "area") {
      if (!env.ASK_ENGINE_URL || !env.ASK_SECRET) return J({ status: "error", error: "not_connected" });
      const payload = b.list ? { list: true } : { name: String(b.name || "").trim().slice(0, 120) };
      if (!b.list && payload.name.replace(/[^a-z]/gi, "").length < 2) return J({ error: "Give the place name." }, 400);
      try {
        const r = await fetch(String(env.ASK_ENGINE_URL).replace(/\/+$/, "") + "/area", { method: "POST", headers: { "Content-Type": "application/json", "X-Ask-Secret": String(env.ASK_SECRET) }, body: JSON.stringify(payload) });
        return J(await r.json());
      } catch (e) { return J({ status: "error", error: "busy" }); }
    }
    if (b.action === "vet") {
      const name = String(b.name || "").trim().slice(0, 120), hint = String(b.hint || "").slice(0, 120);
      if (name.replace(/[^a-z]/gi, "").length < 3) return J({ error: "Give the company name." }, 400);
      if (!env.ASK_ENGINE_URL || !env.ASK_SECRET) return J({ status: "error", error: "not_connected" });
      const body = JSON.stringify({ name, hint, country: "AE", wait_s: 25 });
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await fetch(String(env.ASK_ENGINE_URL).replace(/\/+$/, "") + "/vet", { method: "POST", headers: { "Content-Type": "application/json", "X-Ask-Secret": String(env.ASK_SECRET) }, body });
          const j = await r.json();
          if (j.status === "pending") { await new Promise((s) => setTimeout(s, Math.min(10, j.retry_after_s || 10) * 1000)); continue; }
          return J(j);
        } catch (e) { await new Promise((s) => setTimeout(s, 1500)); }
      }
      return J({ status: "error", error: "busy" });
    }
    if (b.action === "save") {
      const e = clean(b.entry || {}); const date = okDate(b.date), text = String(b.text || "").slice(0, 4000), link = /^https?:\/\//.test(String(b.link || "")) ? String(b.link).slice(0, 500) : "";
      const id = String(b.id || "").replace(/[^a-z0-9]/g, "").slice(0, 16) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      const rec = { id, date, text, link, ...e, check: false, created: b.created || new Date().toISOString(), updated: new Date().toISOString() };
      if (b.id && b.oldDate && b.oldDate !== date) await env.MEETINGS.delete(PFX + okDate(b.oldDate) + "_" + id);
      await env.MEETINGS.put(PFX + date + "_" + id, JSON.stringify(rec));
      const rid = recId(b.rec); if (rid) { const rm = await recGet(env, rid); if (rm && rm.status !== "filed") { rm.status = "filed"; await recPut(env, rm); } }   // v617
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
    // v577 - ?days=2026-10-13,2026-10-14 picks exact days (Mon and Tue); otherwise from/to
    // v615 (Kendall 20 Oct 2026: "the ability to check more than one month at a time") - from/to may span months, and ?all=1 is everything
    // since the engagement began (2 Oct 2026) up to today. A span over more than one calendar month comes back as one summary of the whole
    // period followed by one page per month, so a single Save as PDF holds the whole record.
    const all = url.searchParams.get("all") === "1";
    const picked = all ? [] : String(url.searchParams.get("days") || "").split(",").map((d) => d.trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    let from = all ? PHASES[0].from : picked.length ? picked[0] : okDate(url.searchParams.get("from") || weekOf(dubaiToday())[0]);
    let to = all ? dubaiToday() : picked.length ? picked[picked.length - 1] : okDate(url.searchParams.get("to") || weekOf(from)[1]);
    if (to < from) { const x = from; from = to; to = x; }
    if ((Date.parse(to) - Date.parse(from)) / 864e5 > 400) to = new Date(Date.parse(from) + 400 * 864e5).toISOString().slice(0, 10);   // a span is at most about 13 months
    return new Response(reportHtml(await listEntries(env, from, to), from, to, applyOverrides(tasksOf(await listEntries(env, PHASES[0].from, to)), await taskOverrides(env)), picked), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  // v573 DEBRIEF (Kendall 14 Oct: "Ali ... wants a debrief of what happened because he wasn't there ... immediately create a PDF ... very quick").
  // One entry, one page, in FN's brand: what, when, who, outcome, next steps. Short on purpose.
  if (p === "/momo/work/debrief") {
    const id = String(url.searchParams.get("id") || "").replace(/[^a-z0-9]/g, ""), date = okDate(url.searchParams.get("date"));
    let e = null; try { e = JSON.parse(await env.MEETINGS.get(PFX + date + "_" + id)); } catch (x) {}
    if (!e) return new Response("not found", { status: 404 });
    return new Response(debriefHtml(e), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  // v583 - the vendor report page: one page in FN's frame from the engine's /vet answer
  if (p === "/momo/work/vet") {
    const name = String(url.searchParams.get("name") || "").slice(0, 120), hint = String(url.searchParams.get("hint") || "").slice(0, 120);
    return new Response(deps.page(key, rk, VET_BODY.replace(/__KEY__/g, esc(key)).replace("__NAME__", esc(name)).replace("__HINT__", esc(hint))), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (p === "/momo/work/vet.js") return new Response(VET_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
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
  const tasks = (e.progress || []).map((t) => esc(t.work) + ' — ' + esc(t.status) + ', ' + t.percent + '% at the time of this entry').join('<br>');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Debrief: ' + esc(e.title) + '</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>'
    + '@page{size:A4;margin:18mm 18mm 22mm}body{margin:0;background:#F9F1EF;color:#202020;font-family:Inter,sans-serif;font-size:11pt;line-height:1.55}.pg{max-width:720px;margin:0 auto;background:#fff;padding:28px 34px 36px}'
    + 'header{background:#1F2B44;color:#C9A97A;margin:-28px -34px 20px;padding:20px 34px}header h1{font-family:Anton,sans-serif;font-weight:400;font-size:22pt;letter-spacing:.02em;margin:0}header p{margin:4px 0 0;color:#EFE5D7;font-size:10pt}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:#1F2B44;font-size:15pt;letter-spacing:.02em;margin:0 0 10px}table{width:100%;border-collapse:collapse;margin:8px 0 14px}td{padding:6px 8px;border-bottom:1px solid #E9EAEC;vertical-align:top}td:first-child{font-weight:600;color:#1F2B44;width:26%}'
    + '.sum{font-size:12pt;margin:0 0 12px}ul{margin:0 0 0 18px;padding:0}footer{margin-top:22px;border-top:1px solid #E9EAEC;padding-top:8px;font-size:7.5pt;color:#626B7C}.pf{position:fixed;bottom:6mm;left:18mm;right:18mm;font-size:7pt;color:#626B7C;display:none}'
    + '.btn{position:fixed;right:16px;bottom:16px;background:#1F2B44;color:#C9A97A;border:0;border-radius:99px;padding:10px 18px;font:600 10pt Inter,sans-serif;cursor:pointer}@media print{body{background:#fff}.pg{padding:0;max-width:none}header{margin:0 0 16px}.btns{display:none}}</style></head><body><div class=pg>'
    + '<header><h1>DEBRIEF</h1><p>Serah Najjuko Ganyana · Strategic Lead – Marketing, PR &amp; Business Development</p></header>'
    + '<h2>' + esc(e.title) + '</h2><p class=sum>' + esc(e.summary) + '</p>'
    + '<table>' + row('When', esc(dayName(e.date)) + ' ' + esc(fmtD(e.date)) + (e.time_of_day && e.time_of_day !== "Unspecified" ? ', ' + esc(e.time_of_day.toLowerCase()) : '')) + row('Type', esc(e.type)) + row('Who', who || (e.alone ? 'Najjuko alone' : ''))
    + row('Role', e.in_scope === false ? 'Outside her role' + (e.out_role ? ' (' + esc(e.out_role) + ')' : '') : 'Within her role') + row('Progress', tasks) + row('Produced', (e.deliverables || []).map(esc).join('; ')) + (e.link ? row('File', '<a href="' + esc(e.link) + '">' + esc(e.link) + '</a>') : '') + '</table>'
    + ((e.next || []).length ? '<h2 style="font-size:12pt">NEXT STEPS</h2><ul>' + e.next.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '')
    + '<div class=note style="margin-top:22px;padding-top:8px;border-top:1px solid #E9EAEC;font-size:7.8pt;color:#626B7C;line-height:1.45">Prepared by Serah Najjuko Ganyana for FN Realty. The method, templates and tools that produced this debrief are her own (employment contract, clause 12.2) and are not part of what is provided.</div>'
    + '</div><div class=btns style="position:fixed;right:14px;bottom:14px;display:flex;gap:8px"><button class=btn id=bk>&#8592; Back</button><button class=btn onclick="print()">Share / Save as PDF</button></div><script>' + BACK_JS + '</script></body></html>';
}
// the weekly report: FN Realty's brand (navy #1F2B44, gold #C9A97A, Anton + Inter), internal confidentiality footer on every page
// v577 (Kendall 14 Oct: "senior management ... fifteen seconds maximum ... donut charts, line charts ... not text heavy") - THE 15-SECOND REPORT.
// Four headline numbers, a donut of where the time went (emphasis: in-role teal, outside-role warm, validated palette), activities per day,
// the tasks moved with progress bars, the outside-role line; then one line per activity grouped by day. Inline SVG so the PDF is crisp.
// Palettes validated with the dataviz skill's checker on #FFFFFF: emphasis #15948A / #D9782E (all pass); teal ordinal ramp
// #6FBFB4 #52ADA1 #3A968A #287C71 #15665C (all pass). Grey #B9B2A3 is the de-emphasis token, not a series.
const RAMP = ["#6FBFB4", "#52ADA1", "#3A968A", "#287C71", "#15665C"], TEAL = "#15948A", WARM = "#D9782E", GREY = "#B9B2A3";
// v582 - Back on a page opened from Momo: close the tab if the app opened it (window.close works on a script-opened tab), else history back,
// else straight to her Work log
const BACK_JS = 'document.getElementById("bk").onclick=function(){if(window.opener||history.length<=1){window.close()}if(history.length>1){history.back()}else{var k=new URLSearchParams(location.search).get("key")||"";location.href="/momo/work?key="+encodeURIComponent(k)}};';
// v580 - FN's own marks, cut from the Company Template she sent (src/fn_logo.js): the navy monogram, the gold lattice band, FN navy/peach/gold
import { planRoute } from "./work_plan.js";
import { REC_JS, REC_BTN } from "./work_rec_page.js";
import { FN_LOGO_B64 as FN_LOGO, FN_LATTICE_B64 as FN_LATTICE, FN_NAVY, FN_PEACH, FN_GOLD } from "./fn_logo.js";
// soft language for the work-kind split (Kendall 14 Oct: "very soft language when you're differentiating these things")
const KIND_SOFT = { "Strategic Lead": "As Strategic Lead", "Broker": "As a broker", "Other departments": "Supporting other departments" };
function donut(parts, total, label) {   // parts: [{v, color, name}] - a ring with a hero number in the middle; 2px surface gaps between segments
  const R = 54, r = 36, C = 2 * Math.PI * R; let acc = 0; const segs = [];
  parts.filter((p) => p.v > 0).forEach((p) => { const f = p.v / Math.max(total, 1), len = Math.max(0, C * f - 2); segs.push('<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + p.color + '" stroke-width="' + (R - r) + '" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-acc * C) + '" transform="rotate(-90 70 70)"/>'); acc += f; });
  return '<svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="' + esc(label) + '">' + (segs.length ? segs.join("") : '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="#EFE9DE" stroke-width="' + (R - r) + '"/>')
    + '<text x="70" y="66" text-anchor="middle" font-family="Inter,sans-serif" font-size="26" font-weight="600" fill="#1C2321">' + esc(total) + '</text><text x="70" y="84" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#626B7C">' + esc(label) + '</text></svg>';
}
function dayBars(days) {   // days: [{d, n, out}] - thin columns, rounded ends, in-role teal with outside-role warm stacked on top, 2px gap
  const W = 320, H = 110, pad = 18, max = Math.max(1, ...days.map((x) => x.n)), bw = Math.min(34, (W - pad * 2) / days.length - 8);
  return '<svg viewBox="0 0 ' + W + ' ' + (H + 22) + '" width="100%" style="max-width:' + W + 'px" role="img" aria-label="Activities per day">'
    + '<line x1="' + pad + '" y1="' + H + '" x2="' + (W - pad) + '" y2="' + H + '" stroke="#E9EAEC"/>'
    + days.map((x, i) => { const cx = pad + (i + 0.5) * ((W - pad * 2) / days.length), inn = x.n - x.out, hi = (inn / max) * (H - 14), ho = (x.out / max) * (H - 14);
      return (inn > 0 ? '<rect x="' + (cx - bw / 2) + '" y="' + (H - hi) + '" width="' + bw + '" height="' + hi + '" rx="4" fill="' + TEAL + '"/>' : '')
        + (x.out > 0 ? '<rect x="' + (cx - bw / 2) + '" y="' + (H - hi - ho - (inn > 0 ? 2 : 0)) + '" width="' + bw + '" height="' + ho + '" rx="4" fill="' + WARM + '"/>' : '')
        + (x.n > 0 ? '<text x="' + cx + '" y="' + (H - hi - ho - 6) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="600" fill="#1C2321">' + x.n + '</text>' : '')
        + '<text x="' + cx + '" y="' + (H + 15) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="9.5" fill="#626B7C">' + esc(x.d) + '</text>'; }).join("") + '</svg>';
}
// v586 (Kendall 14 Oct, approved mock-up Momo_Work_donuts_mockup_14OCT2026): the report's donuts are a GRID. Row 1 the Strategic Lead role broken
// out by its three contract areas (Marketing, PR, Business Development), row 2 the Broker role broken out by what the work was, row 3 the two roles
// together (and anything that was neither, grey). Left column counts activities, right column counts hours. Same colours throughout: the teal family is
// always the Strategic Lead, the warm family always the Broker. A short "In short" summary follows, written from the same figures.
const AREA_COL = { "Marketing": RAMP[0], "PR": RAMP[2], "Business Development": RAMP[4] }, BROKER_RAMP = ["#F2B27A", "#E08F4A", "#C46A1E", "#8F4A12", "#5E300B"];
const areaOf = (e) => { const sc = SCOPE.find((s) => s.id === (e.scope || [])[0]); return sc ? sc.area : ((e.kpis || [])[0] && /^m/.test(e.kpis[0]) ? "Marketing" : "Unassigned"); };
export function roleGrid(es) {
  const r1 = (n) => Math.round(n * 10) / 10, H = (list) => r1(list.reduce((s, e) => s + hoursOf(e), 0));
  const SL = es.filter((e) => kindOf(e) === "Strategic Lead"), BR = es.filter((e) => kindOf(e) === "Broker"), OT = es.filter((e) => kindOf(e) === "Other departments");
  const areas = ["Marketing", "PR", "Business Development", "Unassigned"].map((a) => ({ name: a, es: SL.filter((e) => areaOf(e) === a), color: AREA_COL[a] || GREY })).filter((x) => x.es.length);
  const grpOf = (e) => { const t = (e.broker_tasks || [])[0], g = BROKER_TASKS.find((x) => x.items.some((i) => i[0] === t)); return g ? g.group : "Not specified"; };
  const kinds = {}; BR.forEach((e) => { const k = grpOf(e); (kinds[k] = kinds[k] || []).push(e); });
  const bparts = Object.keys(kinds).sort((a, b) => kinds[b].length - kinds[a].length).map((k, i) => ({ name: k, es: kinds[k], color: BROKER_RAMP[Math.min(i, 4)] }));
  const both = [{ name: "Strategic Lead", es: SL, color: TEAL }, { name: "Broker", es: BR, color: WARM }, { name: "Other departments", es: OT, color: GREY }].filter((x) => x.es.length);
  const cell = (parts, byH, centre, sub) => { const tot = byH ? r1(parts.reduce((s, p) => s + H(p.es), 0)) : parts.reduce((s, p) => s + p.es.length, 0);
    const ps = parts.map((p) => ({ name: p.name, v: byH ? H(p.es) : p.es.length, color: p.color }));
    return '<td>' + (tot ? '<div class=two style="margin:0;grid-template-columns:118px 1fr;gap:10px">' + donut(ps, tot, centre || (byH ? 'hours' : 'activities')) + '<div class=leg>' + ps.filter((p) => p.v).map((p) => '<div><i style="background:' + p.color + '"></i>' + esc(p.name) + '<b>' + p.v + (byH ? ' h' : '') + '</b></div>').join("") + (sub ? '<div style="color:#626B7C;font-size:8pt;margin-top:4px">' + sub + '</div>' : '') + '</div></div>' : '<div style="color:#9AA0B5;font-size:9pt">Nothing logged</div>') + '</td>'; };
  const pct = (a, b) => (a + b ? Math.round(a / (a + b) * 100) : 0);
  const sh = H(SL), bh = H(BR), oh = H(OT), sn = SL.length, bn = BR.length, on = OT.length;
  const rows = '<tr class=sl><th>Strategic Lead<small>Marketing · PR · Business Development</small></th>' + cell(areas, false) + cell(areas, true) + '</tr>'
    + '<tr class=bk><th>Broker<small>leads, calls, viewings, open houses</small></th>' + cell(bparts, false) + cell(bparts, true) + '</tr>'
    + '<tr class=al><th>Both roles<small>the week as a whole</small></th>' + cell(both, false, pct(sn, bn) + '% · ' + pct(bn, sn) + '%', 'Strategic Lead · Broker') + cell(both, true, sh + ' h · ' + bh + ' h', 'Strategic Lead · Broker') + '</tr>';
  const top = areas.slice().sort((a, b) => H(b.es) - H(a.es)).slice(0, 2), topb = bparts.slice().sort((a, b) => H(b.es) - H(a.es)).slice(0, 2), tot = r1(sh + bh + oh);
  const summary = !es.length ? 'Nothing logged for these days.' : (sh >= bh ? 'Most of the time went to the Strategic Lead role' : 'Most of the time went to broker work') + ' — ' + (sh >= bh ? sh : bh) + ' of ' + tot + ' hours'
    + (top.length && sh ? ', within it mainly ' + top.map((a) => esc(a.name) + ' (' + H(a.es) + ' h)').join(' and ') : '') + '. '
    + (bh ? 'Broker work took ' + bh + ' h across ' + bn + (bn === 1 ? ' activity' : ' activities') + (topb.length ? ', led by ' + topb.map((a) => esc(a.name.toLowerCase()) + ' (' + H(a.es) + ' h)' ).join(' and ') : '') + '. ' : 'No broker work was logged. ')
    + (oh ? oh + ' h went to other departments, outside both roles. ' : '')
    + (sh >= MIN_HOURS ? 'The 15 h line for the Strategic Lead role was met' + (sh - MIN_HOURS >= 0.5 ? ' with ' + r1(sh - MIN_HOURS) + ' h to spare.' : '.') : 'The Strategic Lead role is ' + r1(MIN_HOURS - sh) + ' h short of the 15 h line (clause 8.1).');
  return '<h2>THE TWO ROLES</h2><table class=rg><tr><th></th><th class=ch>Activities</th><th class=ch>Time (hours)</th></tr>' + rows + '</table><div class=sum><b>IN SHORT</b>' + summary + '</div>';
}
// v615 - the report is built in three pieces so a span of months can repeat the middle one once per month: reportSection (the tiles,
// the 15 h meter, the two roles, the at-a-glance grid, the tasks, the days), reportDoc (the FN page around it) and reportHtml (which decides).
const REPORT_MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function reportSection(es, days, allTasks, opt) {
  opt = opt || {};
  const daily = days.length === 1, monthly = days.length > 7, HP = hoursPicture(es), totH = HP.total;
  // v581 - a month reads week by week: one row per week in the at-a-glance grid, the 15 h line judged per week
  const weeks = []; if (monthly) { let cur = null; days.forEach((d) => { const w = weekOf(d)[0]; if (!cur || cur.w !== w) { cur = { w, days: [] }; weeks.push(cur); } cur.days.push(d); }); }
  const KIND_COL = { "Strategic Lead": TEAL, "Broker": WARM, "Other departments": GREY };
  const tk = (allTasks || tasksOf(es)).filter((t) => days.some((d) => t.last >= d && t.first <= d) || es.some((e) => (e.works || []).includes(t.name)));
  const outRole = es.filter((e) => e.in_scope === false);
  const byD = {}; outRole.forEach((e) => { const d = e.out_role || "Other"; byD[d] = (byD[d] || 0) + 1; });
  const people = new Set(); es.forEach((e) => (e.people || []).forEach((n) => n !== "All sales agents" && people.add(n)));
  const perDay = days.map((d) => ({ d: dayName(d).slice(0, 3) + (days.length > 7 ? " " + (+d.slice(8)) : ""), n: es.filter((e) => e.date === d).length, out: es.filter((e) => e.date === d && e.in_scope === false).length }));
  const tile = (n, l) => '<div class=tile><b>' + n + '</b><span>' + l + '</span></div>';
  const pbar = (p, c) => '<div class=pb><i style="width:' + p + '%;background:' + c + '"></i></div>';
  const byDay = days.map((d) => ({ d, es: es.filter((e) => e.date === d) })).filter((x) => x.es.length);
  // v584 (Najjuko 14 Oct: "out of the six, three is the actual role - marketing, PR and business development - and the other three is the broker
  // role") - the split sits ON the hours tile, so the headline number is never read alone
  const head = '<div class=tiles>' + tile(es.length, 'activities')
    + '<div class=tile><b>' + totH + '</b><span>' + (HP.estimated ? 'hours · ' + HP.clocked + ' clocked, ' + HP.estimated + ' est.' : 'hours clocked') + '</span>'
      + (totH ? '<div class=split>' + HP.kinds.filter((k) => k.hours).map((k) => '<span><i style="background:' + (KIND_COL[k.name] || GREY) + '"></i>' + k.hours + ' h ' + esc(k.name === "Strategic Lead" ? "as Strategic Lead" : k.name === "Broker" ? "as a broker" : "supporting others") + '</span>').join('') + '</div>' : '') + '</div>'
    + tile(people.size, 'people met') + tile(tk.length, 'tasks moved') + '</div>'
    + (daily ? '' : monthly ? (() => { const full = weeks.filter((w) => w.days.length === 7), met = full.filter((w) => hoursPicture(es.filter((e) => w.days.includes(e.date))).total >= MIN_HOURS).length; return '<div class=meter><div class=mh><b>' + met + ' of ' + full.length + ' full weeks</b><span>at or above the 15 h weekly minimum (clause 8.1)</span></div><div class=pb style="height:10px"><i style="width:' + (full.length ? Math.round(met / full.length * 100) : 0) + '%;background:' + (full.length && met === full.length ? TEAL : '#D9A441') + '"></i></div></div>'; })()
      : '<div class=meter><div class=mh><b>' + totH + ' / ' + MIN_HOURS + ' h</b><span>' + (totH >= MIN_HOURS ? 'contract minimum met (clause 8.1)' : (Math.round((MIN_HOURS - totH) * 10) / 10) + ' h short of the 15 h minimum (clause 8.1)') + '</span></div><div class=pb style="height:10px"><i style="width:' + Math.min(100, Math.round(totH / MIN_HOURS * 100)) + '%;background:' + (totH >= MIN_HOURS ? TEAL : '#D9A441') + '"></i></div></div>')
    + roleGrid(es);
  if (opt.summaryOnly) return head;
  return head
    // v577.1 (the Excel idiom she reads: a Mon-Fri day-at-a-glance grid, one row per day: what, hours, with whom, outside-role flagged)
    + (monthly ? '<h2>MONTH AT A GLANCE</h2>' + dayBars(perDay)
      + '<table class=glance><tr><th>Week</th><th>Activities</th><th>Hours</th><th>Of 15 h</th><th>As Strategic Lead</th><th>As a broker</th><th>Supporting</th></tr>' + weeks.map((wkk) => { const we = es.filter((e) => wkk.days.includes(e.date)), wp = hoursPicture(we), k = (n) => (wp.kinds.find((x) => x.name === n) || {}).hours || 0;
        return '<tr' + (we.length ? '' : ' class=empty') + '><td><b>' + esc(fmtD(wkk.days[0]).slice(0, 6)) + '</b>–' + esc(fmtD(wkk.days[wkk.days.length - 1]).slice(0, 6)) + '</td><td class=num>' + we.length + '</td><td class=num>' + wp.total + '</td><td class=num>' + (wp.total >= MIN_HOURS ? '<span style="color:#15948A;font-weight:600">met</span>' : (wkk.days.length < 7 ? 'part week' : (Math.round((MIN_HOURS - wp.total) * 10) / 10) + ' short')) + '</td><td class=num>' + k("Strategic Lead") + '</td><td class=num>' + k("Broker") + '</td><td class=num>' + k("Other departments") + '</td></tr>'; }).join("") + '</table>'
    : days.length > 1 ? '<h2>WEEK AT A GLANCE</h2>' + dayBars(perDay)
      + '<table class=glance><tr><th>Day</th><th>Activities</th><th>Hours</th><th>With</th><th>Outside role</th></tr>' + days.map((d) => { const de = es.filter((e) => e.date === d), h = Math.round(de.reduce((s, e) => s + hoursOf(e), 0) * 10) / 10, who = [...new Set(de.flatMap((e) => (e.people || []).filter((n) => n !== "All sales agents").map((n) => n.replace(/\s*\(.*\)$/, "").split(" ")[0])))], o = de.filter((e) => e.in_scope === false).length;
        return '<tr' + (de.length ? '' : ' class=empty') + '><td><b>' + esc(dayName(d).slice(0, 3)) + '</b> ' + (+d.slice(8)) + '</td><td>' + (de.length ? de.map((e) => esc(e.title) + (isClocked(e) ? ' <span>' + esc(e.start) + '–' + esc(e.end) + '</span>' : '')).join('; ') : '<span>—</span>') + '</td><td class=num>' + (de.length ? h : '') + '</td><td>' + esc(who.slice(0, 4).join(', ')) + (who.length > 4 ? ' +' + (who.length - 4) : '') + '</td><td class=num>' + (o ? '<span class=og>' + o + '</span>' : '') + '</td></tr>'; }).join("") + '</table>' : '')
    + (tk.length ? '<h2>TASKS</h2>' + tk.slice(0, 8).map((t) => '<div class=tk><div><b>' + esc(t.name) + '</b><small>' + esc(t.status) + ' · ' + t.days + ' day' + (t.days === 1 ? '' : 's') + (t.owners && t.owners.length ? ' · with ' + esc(t.owners.slice(0, 3).join(", ")) : '') + '</small></div>' + pbar(t.percent, t.status === "Done" ? RAMP[4] : TEAL) + '<div class=pct>' + t.percent + '%</div></div>').join("") : '')
    + (outRole.length ? '<div class=out><b>Going beyond the role: ' + outRole.length + (outRole.length === 1 ? ' activity' : ' activities') + '</b> · ' + esc(Object.keys(byD).sort((a, b) => byD[b] - byD[a]).map((d) => (d === "Sales" ? "as a broker" : "for " + d) + ' ' + byD[d]).join(", ")) + ' · support given to the wider team, noted alongside the Strategic Lead work.</div>' : '')
    + (byDay.length ? '<div class=day>' + byDay.map((x) => '<h3>' + esc(dayName(x.d)) + ' ' + esc(fmtD(x.d)) + '</h3>' + x.es.map((e) => '<div class=li><i style="background:' + (e.in_scope === false ? WARM : TEAL) + '"></i><div>' + esc(e.title) + ' <span>· ' + esc(e.type) + (e.time_of_day && e.time_of_day !== "Unspecified" ? ' · ' + esc(e.time_of_day.toLowerCase()) : '') + ((e.people || []).length ? ' · ' + esc(e.people.map((n) => n.replace(/\s*\(.*\)$/, "").split(" ")[0]).slice(0, 3).join(", ")) : '') + '</span></div></div>').join("")).join("") + '</div>' : '');
}
export function reportDoc(kindWord, span, body, docTitle) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (kindWord === 'Daily' ? 'Daily' : 'Activity') + ' report</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>'
    // v579 (Najjuko 14 Oct, from her own PDF): the browser's print header stamped the Azimuth link (with her key) on every page - @page margin boxes are
    // emptied so no URL, date or page number prints; the confidentiality footer is gone; the FN wordmark (the real logo file replaces it when she sends it).
    + '@page{size:A4;margin:12mm 12mm 14mm}@page{@top-left{content:none}@top-center{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}'
    + 'body{margin:0;background:#F4F2EE;color:#1C2321;font-family:Inter,sans-serif;font-size:10.5pt;line-height:1.45}.pg{max-width:780px;margin:0 auto;background:#fff;padding:26px 30px 32px}'
    // v580 - FN's inside-page grammar (from the Company Template): white page, thin gold hairline frame, monogram top-right in navy, Anton title in
    // navy with a peach lead word, the gold lattice band beneath, Inter body. No navy header bar.
    + '.pg{position:relative;border:1px solid ' + FN_GOLD + ';border-radius:2px}header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin:0 0 10px}header h1{font-family:Anton,sans-serif;font-weight:400;font-size:26pt;letter-spacing:.02em;margin:0;color:' + FN_NAVY + ';line-height:1.05}header h1 em{font-style:normal;color:' + FN_PEACH + '}header p{margin:6px 0 0;color:' + FN_NAVY + ';font-size:10pt;font-weight:500}'
    + 'header .who{text-align:right;font-size:8.5pt;color:#626B7C;line-height:1.4}header .who b{display:block;color:' + FN_NAVY + ';font-weight:600}.fnmark img{height:46px;width:auto;display:block;margin:0 0 8px auto}'
    // v580.1 (Kendall: "this one especially, should be across the top, make it nice") - the lattice as a full-width band across the top of the page
    + '.latt{height:44px;margin:-26px -30px 18px;background:url("' + FN_LATTICE + '") center/auto 100% repeat-x;opacity:.85;border-bottom:1px solid ' + FN_GOLD + '}'
    + '.vr{border-left:1px solid ' + FN_GOLD + ';padding-left:14px}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:' + FN_NAVY + ';font-size:12pt;letter-spacing:.04em;margin:18px 0 8px}'
    + '.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.tile{background:#fff;border:1px solid ' + FN_GOLD + ';border-radius:4px;padding:10px 8px;text-align:center}.tile b{display:block;font-size:26pt;font-weight:600;color:' + FN_NAVY + ';line-height:1.1}.tile span{font-size:8pt;color:#626B7C}'
    + '.two{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:center;margin-top:12px}.leg{font-size:9pt;color:#3B4441}.leg div{display:flex;align-items:center;gap:8px;margin:4px 0}.leg i{display:inline-block;width:12px;height:12px;border-radius:3px}.leg b{margin-left:auto;color:#1C2321}'
    + '.tk{display:grid;grid-template-columns:1fr 150px 48px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #EFE9DE;font-size:9.5pt}.tk b{font-weight:600}.tk small{display:block;color:#626B7C;font-size:8pt;font-weight:400}.pb{height:8px;background:#EFE9DE;border-radius:4px;overflow:hidden}.pb i{display:block;height:8px;border-radius:4px}.pct{text-align:right;font-weight:600;color:#1C2321}'
    + '.out{margin-top:14px;padding:10px 12px;border-radius:10px;background:#FBF1EA;border-left:4px solid ' + WARM + ';font-size:9.5pt}.out b{color:#1C2321}'
    + '.meter{margin-top:12px}.mh{display:flex;justify-content:space-between;align-items:baseline;font-size:9.5pt;color:#626B7C}.mh b{font-size:14pt;color:#1C2321}'
    + '.split{margin-top:6px;padding-top:6px;border-top:1px solid #EFE9DE;font-size:7.6pt;color:#3B4441;line-height:1.5;text-align:left}.split span{display:flex;align-items:center;gap:5px;white-space:nowrap}.split i{display:inline-block;width:7px;height:7px;border-radius:2px;flex:none}'
    + '.rg{width:100%;border-collapse:separate;border-spacing:0 8px}.rg th{text-align:left;font-weight:600;color:' + FN_NAVY + ';font-size:10pt;vertical-align:middle;width:128px;padding:0 10px 0 10px;border-left:4px solid #E9EAEC}.rg th small{display:block;font-weight:400;color:#626B7C;font-size:7.8pt;line-height:1.3;margin-top:2px}.rg th.ch{width:auto;border:0;color:#626B7C;font-size:8pt;letter-spacing:.06em;text-transform:uppercase;padding:0 0 0 12px}.rg tr.sl th{border-left-color:' + TEAL + '}.rg tr.bk th{border-left-color:' + WARM + '}.rg tr.al th{border-left-color:' + FN_NAVY + '}.rg td{border:1px solid #EFE9DE;border-radius:8px;padding:8px 10px;vertical-align:top;width:42%}.sum{margin-top:10px;padding:10px 12px;border:1px solid ' + FN_GOLD + ';border-radius:8px;font-size:9.5pt;line-height:1.5}.sum b{display:block;font-size:7.5pt;letter-spacing:.1em;color:#8A6F3E;margin-bottom:3px}'
    + '.note{margin-top:22px;padding-top:8px;border-top:1px solid #E9EAEC;font-size:7.8pt;color:#626B7C;line-height:1.45}'
    + '.glance{width:100%;border-collapse:collapse;margin-top:10px;font-size:9pt}.glance th{text-align:left;font-weight:600;color:#626B7C;font-size:8pt;letter-spacing:.06em;text-transform:uppercase;padding:4px 6px;border-bottom:1px solid #E9EAEC}.glance td{padding:6px;border-bottom:1px solid #EFE9DE;vertical-align:top}.glance td:first-child{white-space:nowrap;width:52px}.glance .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.glance .empty td{color:#9AA0B5}.glance .og{display:inline-block;background:#FBF1EA;color:#9A4E1E;border-radius:99px;padding:1px 8px;font-weight:600}'
    + '.day{margin-top:12px}.day h3{font-size:9pt;color:#8A6F3E;letter-spacing:.08em;text-transform:uppercase;margin:10px 0 4px;font-weight:600}.li{display:flex;gap:8px;font-size:9.5pt;padding:3px 0}.li i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none}.li span{color:#626B7C}'
    + '.btns{position:fixed;right:14px;bottom:14px;display:flex;gap:8px}.btn{background:' + FN_NAVY + ';color:' + FN_PEACH + ';border:0;border-radius:99px;padding:10px 16px;font:600 10pt Inter,sans-serif;cursor:pointer}.btn:disabled{opacity:.6}'
    // v615 - a span of months: one section per month, each on its own printed page
    + '.mth{break-before:page;page-break-before:always;margin-top:26px;padding-top:14px;border-top:1px solid ' + FN_GOLD + '}.mh2{font-size:15pt;margin:0 0 8px}'
    + '@media print{body{background:#fff}.pg{padding:0;max-width:none}header{margin:0 0 14px}.btns{display:none}.mth{border-top:0;margin-top:0;padding-top:0}}</style></head><body><div class=pg>'
    + '<div class=latt></div><header><div><h1><em>' + kindWord + '</em> Report</h1><p>' + span + '</p></div><div class=who><div class=fnmark><img src="' + FN_LOGO + '" alt="FN Realty"></div><b>Serah Najjuko Ganyana</b>Strategic Lead – Marketing, PR &amp; Business Development</div></header>'
    + body
    + '</div>'
    // v579 - the Azimuth link (her key rides in it) is never what gets shared. The page title is "FN Daily report 14 Oct 2026", so the browser's
    // print-to-PDF names the file that way; on the phone, Save as PDF opens the share sheet with the PDF itself (email, WhatsApp). One path, no link.
    // v582 (Najjuko 14 Oct: "even though the data is for FN's use only ... just because I provide them with a report does not mean they have rights
    // to the platform I'm using to create this report" - contract clause 12.2: her frameworks, templates, AI tools and workflows stay hers).
    + '<div class=note>Prepared by Serah Najjuko Ganyana for FN Realty. The figures are FN Realty\'s to use. The method, templates and tools that produced this report are her own (employment contract, clause 12.2) and are not part of what is provided.</div>'
    // v582 (Kendall: "once she clicks on debrief, there's no way to exit back out of it") - Back on every report page: closes the tab it opened in,
    // or steps back where it was opened in place.
    + '<div class=btns><button class=btn id=bk>&#8592; Back</button><button class=btn onclick="print()">Share / Save as PDF</button></div>'
    + '<script>document.title=' + JSON.stringify(docTitle) + ';' + BACK_JS + '</script></body></html>';
}
export function reportHtml(es, from, to, allTasks, pickedDays) {
  const days = pickedDays && pickedDays.length ? pickedDays : (() => { const o = []; for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) o.push(d.toISOString().slice(0, 10)); return o; })();
  es = es.filter((e) => days.includes(e.date));
  const daily = days.length === 1, monthly = days.length > 7;
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  const lab = (ym) => REPORT_MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
  // v615 - more than one calendar month: the whole period summarised once, then one page per month
  if (months.length > 1) {
    const span = esc(lab(months[0]) + ' to ' + lab(months[months.length - 1]) + ' · ' + fmtD(days[0]) + ' to ' + fmtD(days[days.length - 1]) + ' · one page per month');
    const body = '<h2>THE WHOLE PERIOD · ' + months.length + ' MONTHS</h2>' + reportSection(es, days, allTasks, { summaryOnly: true })
      + months.map((ym) => { const md = days.filter((d) => d.slice(0, 7) === ym), me = es.filter((e) => md.includes(e.date));
        return '<section class=mth><h2 class=mh2>' + esc(lab(ym).toUpperCase()) + (me.length ? '' : ' · NOTHING LOGGED') + '</h2>' + reportSection(me, md, allTasks) + '</section>'; }).join("");
    return reportDoc('Activity', span, body, 'FN Activity report ' + lab(months[0]) + ' to ' + lab(months[months.length - 1]));
  }
  const span = daily ? esc(dayName(days[0])) + ' ' + esc(fmtD(days[0])) : monthly ? lab(months[0]) + ' · to ' + esc(fmtD(days[days.length - 1])) : (days.length === 7 && weekOf(days[0])[0] === days[0] ? 'Week of ' + esc(fmtD(days[0])) : days.map((d) => dayName(d).slice(0, 3)).join(", ") + ' · ' + esc(fmtD(days[0])) + ' to ' + esc(fmtD(days[days.length - 1])));
  const kindWord = daily ? 'Daily' : monthly ? 'Monthly' : days.length === 7 ? 'Weekly' : 'Activity';
  const title = (daily ? 'FN Daily report ' : monthly ? 'FN Monthly report ' : days.length === 7 ? 'FN Weekly report ' : 'FN Activity report ') + (daily ? fmtD(days[0]) : monthly ? lab(months[0]) : fmtD(days[0]) + ' to ' + fmtD(days[days.length - 1]));
  return reportDoc(kindWord, span, reportSection(es, days, allTasks), title);
}

// v577 (Kendall 14 Oct: "at the very top of the hierarchy it's what did you do? And then something else that says report") - two tabs, that is the whole first screen
const WORK_BODY = '<div class=tag>MOMO · WORK</div>'
  + '<div class=seg id=wtabs style="margin:8px 0 14px;grid-template-columns:1fr 1fr 1fr"><button type=button id=tlog class=on>What did you do?</button><button type=button id=trep>Report</button><button type=button id=tplan>Plan</button></div>'
  + '<div id=vrep style="display:none"><h1 style="font-size:1.35rem">Make a report</h1><div class=seg style="grid-template-columns:1fr 1fr 1fr 1fr;gap:6px"><button type=button class="on" data-rp=today style="padding:12px 4px;font-size:.85rem">Today</button><button type=button data-rp=week style="padding:12px 4px;font-size:.85rem">Week</button><button type=button data-rp=month style="padding:12px 4px;font-size:.85rem">Months</button><button type=button data-rp=pick style="padding:12px 4px;font-size:.85rem">Pick days</button></div>'
  + '<div id=rpick style="display:none"><div class=line>Tap the days to include</div><div class=grid id=rdays style="grid-template-columns:repeat(7,1fr);gap:6px"></div></div>'
  + '<div id=rmonths style="display:none"><div class=line>From</div><div class=grid id=rmfrom style="grid-template-columns:repeat(3,1fr);gap:6px"></div><div class=line style="margin-top:8px">To</div><div class=grid id=rmto style="grid-template-columns:repeat(3,1fr);gap:6px"></div><button type=button id=rall class=ghost style="width:100%;margin-top:10px">Everything since 2 Oct 2026</button></div>'
  + '<div class=line id=rsum style="margin:10px 2px"></div><a id=rgo class=gold style="display:block;text-align:center;text-decoration:none" target=_blank>Make report</a>'
  + '<div class=line style="margin-top:10px">Opens as a page with charts: Share sends it by email or WhatsApp; Save as PDF keeps a copy. Senior-management length: one page.</div></div>'
  + '<div id=vlog><h1>My work log</h1>'
  + '<div class=wk id=wkhead></div>'
  + '<form id=wf class=box><label>What did you do? <button type=button id=wmic class=mic aria-label="Speak instead of typing"><svg viewBox="0 0 24 24" width=18 height=18 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Speak</span></button></label><textarea id=wt rows=4 placeholder="e.g. Monday huddle: built the PowerPoint, ran the meeting with Ali and the team, laid out the week."></textarea>'
  + '<div class=row><input id=wd type=date><label class=ghost id=wupl style="text-align:center;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width=16 height=16 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg><span>Upload a file</span><input id=wfile type=file accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,image/*" style="display:none"></label></div>' + REC_BTN + '<div class=row2><button type=button id=wreset class=ghost>Start over</button><button type=submit id=wb class=gold>File it</button></div></form>'
  + '<div id=wprev></div><a id=wday class=gold style="display:block;text-align:center;text-decoration:none;margin-top:12px" target=_blank>Today\'s summary</a>'
  + '<a href="/momo/work/prep?key=__KEY__" class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:8px">Prepare me for a client, project or open house</a>'
  + '<div class=sec>MY TASKS</div><div id=wtasks></div>'
  + '<div class=sec>BY DEPARTMENT · OPEN TASKS, LONGEST QUIET FIRST</div><div id=wdept></div>'
  + '<div class=sec>FOCUS AREAS · THIS WEEK / SINCE 2 OCT</div><div id=wtally class=tally></div>'
  + '<div class=sec id=wlisth>THIS WEEK</div><div id=wlist></div>'
  + '<div class=row2><button type=button id=wprevw class=ghost>&#8592; Previous week</button><button type=button id=wnextw class=ghost>Next week &#8594;</button></div>'
  + '<a id=wrep class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:12px" target=_blank>This week\'s report</a>'
  + '</div><script src="/momo/work.js?key=__KEY__"></script>';

// v583 - Vet this vendor: a name, a hint, one button; the answer drawn as FN-framed cards with every figure's source
const VET_BODY = '<a class=back href="/momo/work?key=__KEY__">&#8592; Work</a><div class=tag>MOMO · VET A VENDOR</div><h1>Due diligence</h1>'
  + '<form id=vf class=box><label>Who are you meeting?</label><input id=vn placeholder="Company name (e.g. Allsopp & Allsopp)" value="__NAME__"><input id=vh placeholder="What they do, or their licence number (optional)" value="__HINT__" style="margin-top:8px">'
  + '<button type=submit id=vb class=gold style="margin-top:10px">Check them</button><div class=line style="margin-top:6px">Licence registers, advertising permits, their website, public social pages, reviews and news. Every figure with its source; nothing invented. About 20 seconds.</div></form>'
  + '<div id=vout></div><script src="/momo/work/vet.js?key=__KEY__"></script>';
const VET_JS = String.raw`(function(){var KEY=decodeURIComponent((document.currentScript.src.split("key=")[1]||"").split("&")[0]);var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function src(u){return u?' <a style="color:#8A6F3E;font-size:.72rem" href="'+esc(u)+'" target=_blank rel=noopener>source</a>':''}
function card(l,v,s){return '<div class=tl style="display:block"><span style="color:#8A6F3E;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase">'+esc(l)+'</span><div style="font-weight:600;margin-top:2px">'+v+(s?src(s):'')+'</div></div>'}
function run(){var n=$("vn").value.trim(),h=$("vh").value.trim();if(n.replace(/[^a-z]/gi,"").length<3)return;$("vb").disabled=true;$("vb").textContent="Checking the registers and the web…";$("vout").innerHTML="";
 fetch("/momo/work/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"vet",name:n,hint:h})}).then(function(r){return r.json()}).then(function(j){$("vb").disabled=false;$("vb").textContent="Check them";
  if(j.error&&!j.status){alert(j.error);return}
  if(j.status==="not_found"){$("vout").innerHTML='<div class=ent><h3>Nothing found</h3><p>'+esc(j.verdict||"Nothing found for this name in the registers or on the web.")+'</p><div class=line>'+esc(j.disclaimer||"")+'</div></div>';return}
  if(j.status!=="ok"){$("vout").innerHTML='<div class=ent><h3>Could not check just now</h3><p>'+esc(j.error||"The checker is busy. Try again in a minute.")+'</p></div>';return}
  var L=j.licence||{},P=j.advertising_permits||{},S=j.social||{},R=j.reviews||{},conf={high:"#15948A",medium:"#D9A441",low:"#B04A3A"}[j.confidence]||"#8FA39B";
  var h='<div class=ent style="border-left-color:'+conf+'"><div class=m style="color:'+conf+';font-weight:600;text-transform:uppercase;letter-spacing:.08em;font-size:.72rem">Confidence: '+esc(j.confidence||"")+(j.cached?' · checked earlier this week':'')+'</div><h3 style="margin-top:4px">'+esc(j.legal_name||j.trade_name||n)+'</h3><p>'+esc(j.verdict||"")+'</p>'+((j.confidence_reasons||[]).length?'<div class=line>'+esc(j.confidence_reasons.join(" · "))+'</div>':'')+'</div>';
  h+='<div class=tally>'+card("Licence",esc((L.authority||"")+(L.status?" · "+L.status:"")+(L.expiry_date?" · to "+L.expiry_date:"")),L.source)+card("Registered since",esc(j.registered_since||j.founded||"not stated"),j.legal_name_source)
   +card("Advertising permits",esc(P.permits!=null?P.permits+" on record, "+(P.current||0)+" current":"none found"),P.source)+card("Website",j.website?'<a style="color:#0A4F4A" href="'+esc(j.website)+'" target=_blank rel=noopener>'+esc(j.website.replace(/^https?:\/\//,""))+'</a>':"not found",null)+'</div>';
  var soc=["instagram","linkedin","facebook","tiktok"].filter(function(k){return S[k]&&(S[k].followers||S[k].url)}).map(function(k){var x=S[k];return card(k.charAt(0).toUpperCase()+k.slice(1),x.followers?esc(String(x.followers))+(x.followers_approx?" approx.":"")+" followers":(x.note?esc(x.note):"page found"),x.url)}).join("");
  var rev=["google","trustpilot"].filter(function(k){return R[k]&&R[k].rating}).map(function(k){return card(k.charAt(0).toUpperCase()+k.slice(1),esc(R[k].rating+" of 5 ("+(R[k].count||0)+")"),R[k].source)}).join("");
  if(soc||rev)h+='<div class=sec>FOOTPRINT</div><div class=tally>'+soc+rev+'</div>';
  if((j.directors_or_owners||[]).length)h+='<div class=sec>PEOPLE</div>'+j.directors_or_owners.map(function(o){return '<div class=tk><b>'+esc(o.name)+'</b><div class=m>'+esc(o.role||"")+src(o.source)+'</div></div>'}).join("");
  h+='<div class=sec>RED FLAGS</div>'+((j.red_flags||[]).length?j.red_flags.map(function(f){return '<div class=tk style="border-left:3px solid #B04A3A"><b>'+esc(f.flag)+'</b><div class=m>'+esc(f.quote||f.note||"")+src(f.evidence_url)+'</div></div>'}).join(""):'<div class=tk><b style="color:#15948A">None found</b><div class=m>in the sources checked</div></div>');
  if((j.news||[]).length)h+='<div class=sec>IN THE NEWS</div>'+j.news.slice(0,5).map(function(x){return '<div class=tk><b>'+esc(x.title)+'</b><div class=m>'+esc(x.date||"")+src(x.url)+'</div></div>'}).join("");
  h+='<details class=more><summary>What was checked ('+(j.checked||[]).length+')</summary>'+(j.checked||[]).map(function(c){return '<div class=line>'+esc(typeof c==="string"?c:JSON.stringify(c))+'</div>'}).join("")+'</details>';
  h+='<div class=line style="margin-top:12px">'+esc(j.disclaimer||"")+(j.as_of?' As of '+esc(j.as_of)+'.':'')+'</div><button type=button class=ghost style="width:100%;margin-top:12px" onclick="print()">Save as PDF</button>';
  $("vout").innerHTML=h}).catch(function(){$("vb").disabled=false;$("vb").textContent="Check them";alert("Could not check just now. Try again.")})}
$("vf").onsubmit=function(e){e.preventDefault();run()};if($("vn").value.trim())run()})();`;
const PREP_BODY ='<a class=back href="/momo/work?key=__KEY__">&#8592; Work</a><div class=tag>MOMO · PREPARE ME</div><h1>__EVT__</h1>'
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
// v576 (Kendall 14 Oct, approved mock-up Momo_Work_mockup_14OCT2026.html): LIGHT. Cream page, white cards, ink text; teal #0A4F4A and gold
// #C5A56A as accents only. One row per field (Toggl), a 2-column grid for one-tap picks (Daylio), a bottom sheet for choices, a tick to save.
export const WORK_CSS = '.wk{color:#5F6B66;font-size:.85rem;margin:-8px 0 14px}.box{border:1px solid #E3DDD1;border-radius:16px;padding:14px;background:#fff}.box label{display:block;color:#8A6F3E;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;font-weight:600}'
  + 'textarea,input,select{width:100%;box-sizing:border-box;background:#FAF7F1;border:1px solid #E3DDD1;border-radius:12px;color:#1C2321;font:inherit;padding:11px 12px}textarea:focus,input:focus{outline:2px solid #C5A56A;outline-offset:0}.row{display:grid;grid-template-columns:150px 1fr;gap:8px;margin:8px 0}'
  + '.gold{background:#0A4F4A;color:#fff;border:0;border-radius:12px;padding:13px;font:600 .95rem inherit;width:100%;cursor:pointer}.ghost{background:#fff;border:1px solid #E3DDD1;color:#3B4441;border-radius:12px;padding:11px;cursor:pointer;font:inherit}'
  + '.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.sec{color:#8A6F3E;font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.12em;margin:22px 0 8px;font-weight:600}'
  + '.tally{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tl{border:1.5px solid #E3DDD1;border-radius:14px;padding:10px 12px;background:#fff;display:flex;align-items:center;gap:8px}.tl b{font-family:Fraunces,serif;font-size:1.35rem;color:#0A4F4A;margin-left:auto}.tl i{font-style:normal;color:#5F6B66;font-size:.8rem}.tl span{font-size:.8rem;color:#1C2321;font-weight:500}.tl.on{border-color:#C5A56A;background:#FBF4E6}'
  + '.ent{border:1px solid #E3DDD1;border-left:4px solid #C5A56A;border-radius:14px;padding:12px 14px;margin:8px 0;background:#fff}.ent h3{margin:0 0 3px;font-size:1rem;color:#1C2321}.ent .m{color:#5F6B66;font-size:.78rem}.ent .m .warn{color:#B04A3A}.ent p{margin:6px 0;color:#3B4441;font-size:.9rem}'
  + '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.chip{border:1px solid #E3DDD1;border-radius:99px;padding:5px 11px;font-size:.78rem;color:#3B4441;background:#FAF7F1;cursor:pointer}.chip.on{border-color:#C5A56A;color:#1C2321;background:#FBF4E6;font-weight:500}'
  + '.prev{margin-top:12px;padding-bottom:70px}.lab{color:#5F6B66;font-size:.76rem;margin:12px 2px 6px}.warn{color:#B04A3A;font-size:.8rem}.acts{display:flex;gap:10px;margin-top:8px}.acts button{flex:1}.del{color:#5F6B66;background:none;border:0;font-size:.78rem;cursor:pointer;padding:0;margin-top:6px}'
  + '.tk{border:1px solid #E3DDD1;border-radius:14px;padding:10px 12px;margin:6px 0;background:#fff}.tk b{color:#1C2321;font-weight:600}.tk .m{color:#5F6B66;font-size:.76rem;margin-top:3px}.pb{height:6px;background:#EFE9DE;border-radius:4px;margin-top:7px;overflow:hidden}.pb i{display:block;height:6px;background:#C5A56A}.tk.done{opacity:.55}'
  + '.box label{display:flex!important;justify-content:space-between;align-items:center}.mic{display:inline-flex;align-items:center;gap:6px;border:1px solid #C5A56A;border-radius:99px;background:#fff;color:#8A6F3E;padding:6px 12px;font:600 .78rem inherit;letter-spacing:0;text-transform:none;cursor:pointer}'
  + '.mic.rec{background:#C5A56A;color:#1C2321;animation:micp 1.2s ease-in-out infinite}@keyframes micp{50%{opacity:.6}}'
  + '.dp{border:1px solid #E3DDD1;border-radius:14px;margin:6px 0;background:#fff;overflow:hidden}.dp summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;justify-content:space-between;gap:8px;align-items:center}.dp summary::-webkit-details-marker{display:none}'
  + '.dp summary b{color:#1C2321}.dp summary small{color:#5F6B66;font-size:.76rem}.dp .n{color:#0A4F4A;font-family:Fraunces,serif;font-size:1.3rem}.dpt{border-top:1px solid #EFE9DE;padding:9px 14px}.dpt b{color:#1C2321;font-weight:600;font-size:.9rem}.dpt .m{color:#5F6B66;font-size:.76rem;margin-top:2px}.chase{color:#B04A3A}'
  + '.bg{border:1px solid #EFE9DE;border-radius:12px;margin:8px 0;padding:2px 10px}.bg summary{cursor:pointer;padding:10px 0;font-weight:600;color:#0A4F4A;list-style:none;display:flex;justify-content:space-between}.bg summary::-webkit-details-marker{display:none}.bg summary b{background:#0A4F4A;color:#fff;border-radius:99px;padding:0 8px;font-size:.78rem}'
  + '.more{text-align:center;margin-top:14px}.more summary{list-style:none;cursor:pointer;color:#8A6F3E;font-size:.85rem;padding:8px 0}.more summary::-webkit-details-marker{display:none}'
  + '.pg{border-top:1px solid #EFE9DE;padding-top:8px;margin-top:8px}.pg input[type=range]{padding:0;accent-color:#0A4F4A}.addw{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:6px}'
  // the approved screen: segments, grid, rows, sheet, tick
  + '.seg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 10px}.seg button{text-align:center;padding:14px 8px;border-radius:14px;border:1.5px solid #E3DDD1;background:#fff;font:600 .95rem inherit;color:#1C2321;cursor:pointer}.seg button.on{background:#0A4F4A;color:#fff;border-color:#0A4F4A}'
  + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0}.grid button{background:#fff;border:1.5px solid #E3DDD1;border-radius:14px;padding:12px;font:500 .84rem inherit;color:#1C2321;display:flex;gap:8px;align-items:center;text-align:left;cursor:pointer}.grid button svg{color:#8A6F3E;flex:none}.grid button.on{border-color:#C5A56A;background:#FBF4E6}'
  + '.fr{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #E3DDD1;border-radius:14px;padding:13px 14px;margin:8px 0;cursor:pointer;-webkit-tap-highlight-color:transparent}.fr svg{width:18px;height:18px;color:#8A6F3E;flex:none}.fr b{font-weight:600;flex:1;font-size:.95rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fr span{color:#5F6B66;font-size:.8rem;white-space:nowrap}.fr i{color:#B8955A;font-style:normal;font-size:1.1rem}'
  + '.line{font-size:.8rem;color:#5F6B66;margin:4px 2px 0;line-height:1.45}.line b{color:#1C2321}'
  + '.tick{position:fixed;right:18px;bottom:calc(84px + env(safe-area-inset-bottom));width:62px;height:62px;border-radius:50%;background:#0A4F4A;border:0;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(10,79,74,.35);cursor:pointer;z-index:45}.tick svg{width:30px;height:30px;color:#C5A56A}.tick:disabled{opacity:.9}.tick.saving svg{opacity:.35}.tick.saving::before{content:"";position:absolute;inset:-5px;border-radius:50%;border:4px solid rgba(197,165,106,.25);border-top-color:#C5A56A;animation:tickspin .9s linear infinite}.tick.saving::after{content:"Saving";position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:6px;font:600 .7rem monospace;letter-spacing:.1em;color:#0A4F4A;text-transform:uppercase;white-space:nowrap}.tick.saved{background:#15948A}.tick.saved::after{content:"Saved";position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:6px;font:600 .7rem monospace;letter-spacing:.1em;color:#15948A;text-transform:uppercase}@keyframes tickspin{to{transform:rotate(360deg)}}'
  + '.sheetbg{position:fixed;inset:0;background:rgba(28,35,33,.35);z-index:60}.sheet{position:fixed;left:0;right:0;bottom:0;background:#fff;border-radius:22px 22px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom));max-height:72vh;overflow:auto;z-index:61;box-shadow:0 -8px 30px rgba(0,0,0,.15)}.sheet h4{margin:0 0 10px;font:600 .95rem inherit;color:#0A4F4A}.sheet .opt{display:flex;align-items:center;gap:10px;padding:12px 6px;border-bottom:1px solid #EFE9DE;font-size:.95rem;cursor:pointer}.sheet .opt.on{color:#0A4F4A;font-weight:600}.sheet .opt svg{color:#8A6F3E}.sheet .grp{color:#8A6F3E;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin:12px 0 2px;font-weight:600}.sheet .done{margin-top:12px}';

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
  broker: WI('<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>'), kpi1: WI('<path d="M4 7h16M4 12h10M4 17h7"/>'), kpi2: WI('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'), kpi3: WI('<path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>'),
  kpi4: WI('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'), kpi5: WI('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'),
  Morning: WI('<path d="M12 3v2M4.2 6.2l1.4 1.4M3 13h2M19 13h2M18.4 6.2L17 7.6M6 17a6 6 0 0 1 12 0M3 21h18"/>'), Midday: WI('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  Afternoon: WI('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 7l2.1-2.1M4 20h16"/>'), Evening: WI('<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>'), Unspecified: WI('<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>'),
};
const WORK_JS = String.raw`var ICON=` + JSON.stringify(WORK_ICONS) + String.raw`;(function(){
var KEY=(document.currentScript.src.split("key=")[1]||"").split("&")[0];KEY=decodeURIComponent(KEY);
var $=function(i){return document.getElementById(i)};var D=null,WEEK=null,PREV=null,EDIT=null;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function fd(d){var p=d.split("-");return DN[new Date(d+"T00:00:00Z").getUTCDay()]+" "+(+p[2])+" "+M[+p[1]-1]}
function api(o){return fetch("/momo/work/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json().then(function(j){if(!r.ok&&!j.error)j.error="The server answered "+r.status;return j},function(){return {error:"The server sent something unexpected (status "+r.status+")."}})})}
// v599 (Kendall 14 Oct, with Najjuko: "she entered something at 12 and wasn't sure it was saved"): a saved entry now says so, in words, at the top of the screen; a save that did not happen says that instead
// and keeps what she wrote; and an entry being checked survives leaving the app (a draft kept on the phone until it is saved or discarded)
function toast(msg,bad){var old=document.getElementById("wtoast");if(old)old.remove();var t=document.createElement("div");t.id="wtoast";t.setAttribute("role","status");t.textContent=msg;
 t.style.cssText="position:fixed;left:12px;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:90;padding:14px 16px;border-radius:14px;font:600 .95rem 'IBM Plex Sans',sans-serif;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:center;background:"+(bad?"#B04A3A":"#0A4F4A");
 document.body.appendChild(t);setTimeout(function(){if(t.parentNode)t.remove()},bad?9000:4500)}
function saveDraft(){try{if(PREV)localStorage.setItem("momo_work_draft",JSON.stringify({q:QUEUE,qi:QI,prev:PREV,date:$("wd")?$("wd").value:"",at:Date.now()}))}catch(e){}}
function clearDraft(){try{localStorage.removeItem("momo_work_draft")}catch(e){}}
function resumeDraft(){var d=null;try{d=JSON.parse(localStorage.getItem("momo_work_draft")||"null")}catch(e){}if(!d||!d.prev||Date.now()-d.at>864e5||PREV)return;
 var when=new Date(d.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
 $("wprev").innerHTML='<div class=prev><div class=line style="margin:0 0 8px"><b>You have an entry that was not saved</b> (from '+esc(when)+'): '+esc(d.prev.title||"untitled")+'.</div><div class=acts><button type=button class=ghost id=dd>Discard</button><button type=button class=gold id=dc>Continue it</button></div></div>';
 $("dd").onclick=function(){clearDraft();$("wprev").innerHTML=""};
 $("dc").onclick=function(){QUEUE=d.q&&d.q.length?d.q:[d.prev];QI=Math.min(d.qi||0,QUEUE.length-1);if(d.date&&$("wd"))$("wd").value=d.date;preview(QUEUE[QI]||d.prev);scrollTo(0,0)}}
function load(w){fetch("/momo/work/api?key="+encodeURIComponent(KEY)+(w?"&week="+w:"")).then(function(r){return r.json()}).then(function(j){D=j;WEEK=j.from;draw()})}
function shift(n){var t=new Date(WEEK+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+7*n);load(t.toISOString().slice(0,10))}
function draw(){var days=Math.round((Date.parse(D.review_due)-Date.parse(D.today))/864e5);
 $("wkhead").textContent=(D.phase?D.phase.name+" · ":"")+(days>=0?days+" days to the day-75 review (15 Dec)":"Review due date passed");
 if(!$("wd").value)$("wd").value=D.today;
 $("wtally").innerHTML=D.tally.map(function(t){return '<div class="tl'+(t.week?' on':'')+'">'+(ICON["kpi"+t.id]||ICON.kpi)+'<span>'+esc(t.name)+'</span><b>'+t.week+'</b></div>'}).join("")
  // v578 - the 15-hour meter (clause 8.1): clocked hours first, green when met
  +(D.hoursweek?'<div class=line style="grid-column:1/3;margin-top:8px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:1rem">'+D.hoursweek.total+' / '+D.hoursweek.min+' h this week</b><span>'+(D.hoursweek.estimated?D.hoursweek.clocked+' h clocked, '+D.hoursweek.estimated+' h estimated':D.hoursweek.clocked+' h clocked')+'</span></div><div class=pb style="height:8px"><i style="width:'+Math.min(100,Math.round(D.hoursweek.total/D.hoursweek.min*100))+'%;background:'+(D.hoursweek.total>=D.hoursweek.min?'#15948A':'#D9A441')+'"></i></div>'
   +'<div style="margin-top:4px">'+D.hoursweek.kinds.filter(function(k){return k.hours}).map(function(k){return k.hours+' h '+(k.name==="Strategic Lead"?"as Strategic Lead":k.name==="Broker"?"as a broker":"supporting others")}).join(' · ')+'</div></div>':'')
  // v576 - the running outside-role tally, by department: what she brings to the renewal
  +(D.outside&&D.outside.week?'<div class=line style="grid-column:1/3;margin-top:6px"><b>Outside your role this week: '+D.outside.week+'</b> · '+esc(D.outside.by.map(function(x){return x.dept+" "+x.n}).join(", "))+' · since 2 Oct: '+D.outside.term+' · kept for your review</div>':'');
 $("wlisth").textContent="WEEK OF "+fd(D.from).toUpperCase()+" · "+D.entries.length+" ENTR"+(D.entries.length===1?"Y":"IES");
 $("wlist").innerHTML=D.entries.length?D.entries.map(function(e,i){return '<div class=ent><h3>'+esc(e.title)+'</h3><div class=m>'+esc(fd(e.date))+(e.time_of_day&&e.time_of_day!=="Unspecified"?' '+esc(e.time_of_day.toLowerCase()):'')+' · '+esc(e.type)+(e.people.length?' · '+esc(e.people.join(", ")):(e.alone?' · by yourself':''))+((e.external||[]).length?' · '+esc(e.external.map(function(o){return o.name}).join(", ")):'')+(e.in_scope===false?' · <span class=warn>outside role'+(e.out_role?' ('+esc(e.out_role)+')':'')+'</span>':'')+'</div><p>'+esc(e.summary)+'</p>'
  +'<div class=chips>'+e.kpis.map(function(k){var x=D.kpis.filter(function(y){return y.id===k})[0];return '<span class="chip on">'+esc(x?x.name:k)+'</span>'}).join("")+'</div>'
  +(e.deliverables.length?'<div class=m style="margin-top:6px">Produced: '+esc(e.deliverables.join("; "))+'</div>':'')+(e.link?'<div class=m><a style="color:#C5A56A" href="'+esc(e.link)+'" target=_blank rel=noopener>Open the file</a></div>':'')
  +((e.external||[]).length?e.external.slice(0,2).map(function(o){return '<a class=mic style="text-decoration:none;margin:8px 6px 2px 0" href="/momo/work/vet?key='+encodeURIComponent(KEY)+'&name='+encodeURIComponent(o.name)+'&hint='+encodeURIComponent(o.kind||"")+'">Vet '+esc(o.name.split(" ").slice(0,2).join(" "))+' &#8594;</a>'}).join("")+'<br>':'')
  +(e.prep&&e.prep.needed?'<a class=mic style="text-decoration:none;margin:8px 0 2px" href="/momo/work/prep?key='+encodeURIComponent(KEY)+'&dev='+encodeURIComponent(e.prep.developer||"")+'&project='+encodeURIComponent(e.prep.project||"")+'&area='+encodeURIComponent(e.prep.area||"")+'&event='+encodeURIComponent(e.prep.event||e.title)+'">Prepare me &#8594;</a><br>':'')
  +'<a class=del style="text-decoration:none" href="/momo/work/debrief?key='+encodeURIComponent(KEY)+'&id='+encodeURIComponent(e.id)+'&date='+e.date+'" target=_blank>Debrief</a> &middot; <button class=del data-e='+i+'>Edit</button> &middot; <button class=del data-d='+i+'>Delete</button></div>'}).join(""):'<p style="color:#8FA39B">Nothing logged this week yet.</p>';
 $("wlist").querySelectorAll("[data-d]").forEach(function(b){b.onclick=function(){var e=D.entries[+b.getAttribute("data-d")];if(!confirm("Delete \""+e.title+"\"?"))return;api({action:"delete",id:e.id,date:e.date}).then(function(){load(WEEK)})}});
 $("wlist").querySelectorAll("[data-e]").forEach(function(b){b.onclick=function(){var e=D.entries[+b.getAttribute("data-e")];EDIT=e;$("wt").value=e.text;$("wd").value=e.date;if($("wl"))$("wl").value=e.link||"";preview(e);scrollTo(0,0)}});
 $("wtasks").innerHTML=(D.tasks||[]).length?D.tasks.map(function(t,ti){return '<div class="tk'+(t.status==="Done"?' done':'')+'" data-tk='+ti+' style="cursor:pointer"><b>'+esc(t.name)+'</b> <span style="color:#C5A56A;float:right">'+t.percent+'% &#9998;</span><div class=pb><i style="width:'+t.percent+'%"></i></div>'
  +'<div class=m>'+esc(t.status)+' · started '+esc(fd(t.first))+' · '+t.days+' day'+(t.days===1?'':'s')+' worked · about '+t.hours+' h'+(t.last!==t.first?' · last '+esc(fd(t.last)):'')+'</div>'
  +(t.owners.length?'<div class=m>With: '+esc(t.owners.join(", "))+'</div>':'')+'</div>'}).join(""):'<p style="color:#8FA39B">Tasks appear here as you log work on them.</p>';
 $("wtasks").querySelectorAll("[data-tk]").forEach(function(r){r.onclick=function(){taskSheet(D.tasks[+r.getAttribute("data-tk")])}});
 $("wdept").innerHTML=(D.depts||[]).map(function(d){return '<details class=dp><summary><span><b>'+esc(d.dept)+'</b><br><small>'+(d.people.length?esc(d.people.slice(0,4).join(", "))+(d.people.length>4?" +"+(d.people.length-4):""):"No open tasks")+'</small></span><span class=n>'+d.open+'</span></summary>'
  +d.tasks.map(function(t){return '<div class=dpt><b>'+esc(t.name)+'</b> <span style="color:#C5A56A;float:right">'+t.percent+'%</span><div class=m>'+esc(t.status)+' · with '+esc(t.who.join(", "))+'</div><div class="m'+(t.quiet>=5?' chase':'')+'">'+(t.quiet<=0?'Moved today':'Last moved '+esc(fd(t.last))+' · '+t.quiet+' day'+(t.quiet===1?'':'s')+' quiet'+(t.quiet>=5?' · chase':''))+'</div></div>'}).join("")+'</details>'}).join("");
 $("wday").href="/momo/work/report?key="+encodeURIComponent(KEY)+"&from="+D.today+"&to="+D.today;
 var to=new Date(Date.parse(D.from)+6*864e5).toISOString().slice(0,10);$("wrep").href="/momo/work/report?key="+encodeURIComponent(KEY)+"&from="+D.from+"&to="+to}
function chips(list,on,attr){return list.map(function(x){var id=x.id!=null?x.id:x,nm=x.name||x,ic=(attr==="t"||attr==="tod")&&ICON[id]?ICON[id]+' ':'';return '<button type=button class="chip'+(on.indexOf(id)>=0?' on':'')+'" data-'+attr+'="'+esc(id)+'">'+ic+esc(nm)+'</button>'}).join("")}
function lab(k,t){return '<div class=lab>'+(ICON[k]||'')+' '+t+'</div>'}
// v573 (Kendall 14 Oct: "move away from the pills and put dropdowns") - one native picker per single-choice field; chips stay only where she picks several
function sel(id,list,cur){return '<select class=who id='+id+' style="margin-top:0">'+list.map(function(x){var v=x.id!=null?x.id:(Array.isArray(x)?x[0]:x),nm=x.name||(Array.isArray(x)?x[0]:x);return '<option value="'+esc(v)+'"'+(String(v)===String(cur)?' selected':'')+'>'+esc(nm)+'</option>'}).join("")+'</select>'}
function deptsOf(e){var ds=[];(e.people||[]).forEach(function(n){var g=(D.org||[]).filter(function(x){return x.people.indexOf(n)>=0})[0];if(g&&ds.indexOf(g.dept)<0)ds.push(g.dept)});if((e.external||[]).length&&ds.indexOf("External")<0)ds.push("External");return ds}
function wireParties(e){$("wprev").querySelectorAll("[data-py]").forEach(function(b){b.onclick=function(){var o=(PREV.external||[]).filter(function(x){return x.name===b.getAttribute("data-py")})[0];if(!o)return;b.disabled=true;b.textContent="Remembering…";
  api({action:"party_confirm",name:o.suggested||o.name,typed:o.name,kind:o.kind,what:o.what,where:o.where,site:o.site}).then(function(j){if(j.ok){o.name=j.party.name;o.confirmed=true;o.known=true;if(QUEUE.length)QUEUE[QI]=PREV;preview(PREV)}else{b.disabled=false;b.textContent="Yes, that's it"}})}});
 // v585 (Kendall 14 Oct: "it's extracted a company that I don't want there; I should be able to click on that and change it") - tap a party to rename or remove it
 $("wprev").querySelectorAll("[data-pr]").forEach(function(b){b.onclick=function(){PREV.external=(PREV.external||[]).filter(function(x){return x.name!==b.getAttribute("data-pr")});if(QUEUE.length)QUEUE[QI]=PREV;preview(PREV)}});
 $("wprev").querySelectorAll("[data-px]").forEach(function(r){r.onclick=function(){var o=(PREV.external||[]).filter(function(x){return x.name===r.getAttribute("data-px")})[0];if(!o)return;
  sheet("Outside party",'<input id=pxn class=sin value="'+esc(o.name)+'" placeholder="Company or person"><div class=line style="margin:6px 0 10px">Change the name, or remove it if it does not belong in this entry.</div><button type=button class=ghost id=pxr style="width:100%;margin-bottom:8px">Remove from this entry</button>',function(sh){var inp=sh.querySelector("#pxn");inp.oninput=function(){o.name=inp.value.trim()||o.name;o.known=false};sh.querySelector("#pxr").onclick=function(){PREV.external=(PREV.external||[]).filter(function(x){return x!==o});if(QUEUE.length)QUEUE[QI]=PREV;SHEET()}})}});
 $("wprev").querySelectorAll("[data-pn]").forEach(function(b){b.onclick=function(){var o=(PREV.external||[]).filter(function(x){return x.name===b.getAttribute("data-pn")})[0];if(!o)return;o.suggested="";o.what="";o.site="";o.confirmed=true;if(QUEUE.length)QUEUE[QI]=PREV;preview(PREV)}})}
var QUEUE=[],QI=0;   // v570 - a whole day comes back as several activities; she confirms and saves them one at a time
function queueHead(){return QUEUE.length>1?'<div style="color:#C5A56A;font-family:\'IBM Plex Mono\',monospace;font-size:.72rem;letter-spacing:.12em;margin-bottom:8px">ACTIVITY '+(QI+1)+' OF '+QUEUE.length+'</div>':''}
function nextInQueue(){QI++;if(QI<QUEUE.length){preview(QUEUE[QI]);scrollTo(0,0)}else{QUEUE=[];QI=0;$("wprev").innerHTML="";$("wt").value="";if($("wl"))$("wl").value=""}}
// v576 - THE APPROVED SCREEN (mock-up 14 Oct). Role first as two segments; within -> a 2-column grid of her five areas (one tap); outside -> one
// row, whose job it was. Then one row per field: when, with, type and length; each row opens a bottom sheet. Tick to save. Nothing else on screen.
var SHEET=null;
function sheet(title,html,onopen){var bg=document.createElement("div");bg.className="sheetbg";var s=document.createElement("div");s.className="sheet";s.innerHTML='<h4>'+title+'</h4>'+html+'<button type=button class="gold done">Done</button>';
 document.body.appendChild(bg);document.body.appendChild(s);SHEET=function(){bg.remove();s.remove();SHEET=null;preview(PREV)};bg.onclick=SHEET;s.querySelector(".done").onclick=SHEET;if(onopen)onopen(s)}
function opt(v,nm,on,ic){return '<div class="opt'+(on?' on':'')+'" data-v="'+esc(v)+'">'+(ic||'')+esc(nm)+(on?'<span style="margin-left:auto;color:#0A4F4A">&#10003;</span>':'')+'</div>'}
function kpiOf(id){return D.kpis.filter(function(k){return k.id===id})[0]}
function brokerLabel(id){var r="";(D.broker_tasks||[]).forEach(function(g){g.items.forEach(function(i){if(i[0]===id)r=i[1]})});return r}
function brokerSummary(){var t=PREV.broker_tasks||[];return t.length?brokerLabel(t[0])+(t.length>1?" +"+(t.length-1):""):"What kind of broker work?"}
// v600 - set a task's progress directly (Najjuko 14 Oct: "the edit button on the task is not working, I can't change something to fix the progress"). Its own overlay: the log has no entry open behind it.
function taskSheet(t){if(!t)return;var pct=t.percent,st=t.status,bg=document.createElement("div");bg.className="sheetbg";var s=document.createElement("div");s.className="sheet";
 var close=function(){bg.remove();s.remove()};
 var draw=function(){s.innerHTML='<h4>'+esc(t.name)+'</h4><div class=line style="color:#1C2321;font-weight:500">Progress <b id=tp_v style="color:#0A4F4A;float:right">'+pct+'%</b></div><input type=range min=0 max=100 step=5 value='+pct+' id=tp_r style="width:100%;margin:6px 0 10px"><div class=chips>'
   +D.status.map(function(x){return '<button type=button class="chip'+(x===st?' on':'')+'" data-s="'+esc(x)+'">'+esc(x)+'</button>'}).join("")+'</div><div class=line style="margin-top:8px">Saved when you tap Save progress. Your next activity on this task moves it again.</div><button type=button class="gold done" id=tp_ok style="margin-top:8px">Save progress</button>';
  s.querySelector("#tp_r").oninput=function(){pct=+this.value;s.querySelector("#tp_v").textContent=pct+"%";if(pct>=100)st="Done";else if(st==="Done")st="In progress"};
  s.querySelectorAll("[data-s]").forEach(function(b){b.onclick=function(){st=b.getAttribute("data-s");if(st==="Done")pct=100;draw()}});
  s.querySelector("#tp_ok").onclick=function(){var b=this;b.disabled=true;b.textContent="Saving...";api({action:"task_progress",name:t.name,percent:pct,status:st}).then(function(j){if(!j.ok){b.disabled=false;b.textContent="Save progress";toast("Not saved: "+(j.error||"something went wrong")+". Tap Save progress again.",true);return}
    close();toast("\u2713 Saved: "+t.name+" is at "+j.task.percent+"% ("+j.task.status+").");load(WEEK)}).catch(function(){b.disabled=false;b.textContent="Save progress";toast("Not saved: no connection. Tap Save progress again.",true)})}};
 bg.onclick=close;draw();document.body.appendChild(bg);document.body.appendChild(s)}
function areaSheet(){
 var start=(PREV.prep&&(PREV.prep.area||PREV.prep.project))||"";
 sheet("About the area",'<input id=ar_n class=sin value="'+esc(start)+'" placeholder="A district or community: JVC, Business Bay, Damac Hills..." style="width:100%;margin-bottom:8px"><button type=button class=gold id=ar_go style="width:100%">Look it up</button><div id=ar_out style="margin-top:10px"></div>',function(s){
  var out=s.querySelector("#ar_out"),inp=s.querySelector("#ar_n");
  var draw=function(j){
   if(!j||j.error||j.status==="error"){out.innerHTML='<div class=line>I could not reach the area data just now. Try again in a minute.</div>';return}
   if(j.status==="ambiguous"){out.innerHTML='<div class=line>Which one?</div>'+(j.candidates||[]).map(function(c,k){return '<div class=fr data-c="'+k+'"><b>'+esc(c.name||c)+'</b><span>'+esc(c.level||"")+'</span><i>&#8250;</i></div>'}).join("");
    out.querySelectorAll("[data-c]").forEach(function(e){e.onclick=function(){var c=j.candidates[+e.getAttribute("data-c")];inp.value=c.name||c;go()}});return}
   if(j.status!=="ok"){out.innerHTML='<div class=line>'+(j.status==="stale"?"The figures for this place have expired and are being refreshed.":"I do not hold this place. The area data covers 37 Dubai districts and their communities and buildings.")+'</div>';return}
   var m=j.matched||{},h='<h4 style="margin:0 0 6px;color:#0A4F4A">'+esc(m.name||"")+(m.district_name&&m.level!=="district"?' <small style="color:#5F6B66">in '+esc(m.district_name)+'</small>':'')+'</h4>';
   (j.items||[]).forEach(function(i){h+='<div class=ent style="margin:6px 0"><div class=m>'+esc(i.label||i.topic)+'</div><div class=line style="margin:2px 0">'+esc(i.summary)+'</div><div class=line style="margin:2px 0;font-size:.74rem;color:#5F6B66">'+esc((i.sources||[]).join(" · "))+(i.as_of?' · as of '+esc(i.as_of):'')+'</div></div>'});
   if(!(j.items||[]).length)h+='<div class=line>Nothing recorded for this place yet.</div>';
   if(j.communities&&j.communities.length)h+='<div class=line style="margin-top:8px">Communities here: '+j.communities.slice(0,8).map(function(c){return esc(c.name)}).join(", ")+(j.communities.length>8?" and "+(j.communities.length-8)+" more":"")+'</div>';
   h+='<div class=line style="margin-top:8px;font-size:.72rem;color:#5F6B66">'+esc(j.attribution||"Includes Google Maps Platform data. Google ratings and counts are shown as of the date given and are refreshed every 30 days.")+'</div>';
   out.innerHTML=h};
  var go=function(){var n=inp.value.trim();if(!n)return;out.innerHTML='<div class=line>Looking up...</div>';api({action:"area",name:n}).then(draw).catch(function(){draw(null)})};
  s.querySelector("#ar_go").onclick=go;if(start)go()})}
function outOf(r){return (D.out_roles||[]).filter(function(x){return x[0]===r})[0]}
function clocked(e){var m=function(s){var x=/^(\d{1,2}):(\d{2})$/.exec(s||"");return x?(+x[1])*60+(+x[2]):null},a=m(e.start),b=m(e.end);if(a==null||b==null)return null;var d=b-a;if(d<0)d+=1440;return d>0&&d<=960?Math.round(d/6)/10:null}
function fieldRow(ic,main,sub,id){return '<div class=fr id='+id+'>'+(ICON[ic]||'')+'<b>'+esc(main)+'</b><span>'+esc(sub)+'</span><i>&#8250;</i></div>'}
function preview(e){PREV=JSON.parse(JSON.stringify(e));saveDraft();PREV.works=PREV.works||[];PREV.progress=PREV.progress||[];PREV.kpis=PREV.kpis||[];PREV.people=PREV.people||[];
 var within=PREV.in_scope!==false,k0=kpiOf(PREV.kpis[0]),orr=outOf(PREV.out_role),sc0=D.scope.filter(function(s){return s.id===(PREV.scope||[])[0]})[0];
 var h='<div class=prev>'+queueHead()+(PREV.check?'<div class=warn style="margin-bottom:8px">Filed by keyword only: check it before saving.</div>':'')
 +'<h1 style="font-size:1.35rem;margin:0 0 6px">'+esc(PREV.title)+'</h1><textarea id=ps rows=2>'+esc(PREV.summary)+'</textarea>'
 +'<div class=seg style="margin-top:12px"><button type=button id=sw'+(within?' class=on':'')+'>Within my role</button><button type=button id=so'+(within?'':' class=on')+'>Outside my role</button></div>'
 +(within
   ?'<div class=line>Which part of your role?</div><div class=grid>'+D.kpis.map(function(k){return '<button type=button data-k='+k.id+(PREV.kpis.indexOf(k.id)>=0?' class=on':'')+'>'+(ICON["kpi"+k.id]||ICON.kpi)+esc(k.name)+'</button>'}).join("")+'<button type=button id=bro class="'+(PREV.broker?'on ':'')+'brk">'+(ICON.broker||ICON.party)+'Broker</button></div>'
    +(PREV.broker?fieldRow("task",brokerSummary(),(PREV.broker_tasks||[]).length?"tap to change":"leads, calls, viewings, deals","frb"):'')
    +(PREV.broker?'':k0?'<div class=line>'+(sc0&&sc0.name?'Schedule 1: <b>'+esc(sc0.name)+'</b>. ':'')+'Evidence: '+esc(k0.ev)+'.</div>':'<div class=line class=warn style="color:#B04A3A">Tap one so it counts at your review.</div>')
   :fieldRow("party",PREV.out_role||"Whose job was it?",PREV.out_role?"whose job it was":"tap to choose","frw")
    +(orr?'<div class=line>'+esc(orr[1])+'.</div>':''))
 +fieldRow("time",PREV.start&&PREV.end?PREV.start+" – "+PREV.end:(PREV.time_of_day&&PREV.time_of_day!=="Unspecified"?PREV.time_of_day:"Start and end time"),PREV.start&&PREV.end?(clocked(PREV)+" h"+(PREV.time_of_day&&PREV.time_of_day!=="Unspecified"?" · "+PREV.time_of_day.toLowerCase():"")):"tap to clock it","frt")
 +fieldRow("party",PREV.where&&PREV.where!=="Unspecified"?PREV.where:"Where were you?",PREV.where&&PREV.where!=="Unspecified"?"where":"office, home, on site","frl")
 +fieldRow("people",PREV.people.length?PREV.people.map(function(n){return n.replace(/\s*\(.*\)$/,"").split(" ")[0]}).join(", "):(PREV.alone?"By yourself":"Who was there?"),PREV.people.length?"with":(PREV.alone?"":"tap to add"),"frp")
 +fieldRow("where",(PREV.prep&&(PREV.prep.area||PREV.prep.project))||"About the area","tap to look up","fra")
 +fieldRow("type",PREV.type,PREV.effort||"","fry")
 +((PREV.external||[]).length?(PREV.external).map(function(o){return o.confirmed?'<div class=fr data-px="'+esc(o.name)+'">'+(ICON.party||'')+'<b>'+esc(o.name)+'</b><span>'+(o.known?"outside party · known · tap to change":"outside party · tap to change")+'</span><i>&#8250;</i></div>':
   '<div class=fr style="flex-wrap:wrap;cursor:default;border-color:#C5A56A"><div style="flex:1 1 100%;font-size:.85rem">You wrote <b>'+esc(o.name)+'</b>. '+(o.notfound?'I could not find it online; it will be logged as written.':'Is this the right one?')+'</div>'
   +(o.notfound?'':'<div style="flex:1 1 100%"><b>'+esc(o.suggested)+'</b>'+(o.kind?' <span>· '+esc(o.kind)+'</span>':'')+(o.what?'<div class=line>'+esc(o.what)+'</div>':'')+'</div><div class=acts style="flex:1 1 100%"><button type=button class=ghost data-pr="'+esc(o.name)+'">Remove</button><button type=button class=ghost data-pn="'+esc(o.name)+'">No, keep mine</button><button type=button class=gold data-py="'+esc(o.name)+'">Yes</button></div>')+'</div>'}).join(""):'')
 +(PREV.works.length?fieldRow("task",PREV.works[0]+(PREV.works.length>1?" +"+(PREV.works.length-1):""),"change task","frk"):'')
 +'<div id=pprog></div>'
 +'<details class=more><summary>More &#9662;</summary>'
 +(!PREV.works.length?fieldRow("task","Link a campaign or task","optional","frk"):'')
 +lab("scope","Part of the role (Schedule 1)")+'<div class=chips>'+chips(D.scope,PREV.scope||[],"s")+'</div>'
 +((PREV.questions||[]).length?lab("ask","A few questions so nothing is missed")+PREV.questions.map(function(q,i){return '<div class=line style="margin:6px 0 4px">'+esc(q)+'</div><input class=pq data-q='+i+' placeholder="Your answer (optional)">'}).join("")+'<button type=button class=ghost id=pa style="width:100%;margin-top:6px">Answer and refile</button>':'')
 +(PREV.deliverables.length?lab("task","Produced")+'<div class=line>'+esc(PREV.deliverables.join("; "))+'</div>':'')
 +(PREV.next.length?lab("out","Next steps")+'<div class=line>'+esc(PREV.next.join("; "))+'</div>':'')
 +'<div class=acts style="margin-top:14px"><button type=button class=ghost id=pc>'+(QUEUE.length>1?'Skip this one':'Cancel')+'</button></div></details></div>'
 +'<button type=button class=tick id=pv aria-label="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg></button>';
 $("wprev").innerHTML=h;
 $("ps").onchange=function(){PREV.summary=this.value};
 $("sw").onclick=function(){PREV.in_scope=true;PREV.out_role="";PREV.broker=false;preview(PREV)};$("so").onclick=function(){PREV.in_scope=false;PREV.broker=false;PREV.kpis=[];preview(PREV)};
 if($("fra"))$("fra").onclick=areaSheet;
 if($("frb"))$("frb").onclick=function(){PREV.broker_tasks=PREV.broker_tasks||[];sheet("What kind of broker work?",(D.broker_tasks||[]).map(function(g,gi){var n=g.items.filter(function(i){return PREV.broker_tasks.indexOf(i[0])>=0}).length;return '<details class=bg'+(n?' open':'')+'><summary>'+esc(g.group)+(n?' <b>'+n+'</b>':'')+'</summary>'+g.items.map(function(i){return opt(i[0],i[1],PREV.broker_tasks.indexOf(i[0])>=0)}).join("")+'</details>'}).join(""),function(s){s.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){var v=o.getAttribute("data-v"),i=PREV.broker_tasks.indexOf(v);if(i>=0)PREV.broker_tasks.splice(i,1);else PREV.broker_tasks.push(v);o.classList.toggle("on");var chk=o.querySelector("span");if(i>=0){if(chk)chk.remove()}else{o.insertAdjacentHTML("beforeend",'<span style="margin-left:auto;color:#0A4F4A">&#10003;</span>')}var d=o.closest("details"),c=d.querySelectorAll(".opt.on").length,sm=d.querySelector("summary");sm.innerHTML=sm.firstChild.textContent+(c?' <b>'+c+'</b>':'')}})})};
 if($("bro"))$("bro").onclick=function(){PREV.broker=!PREV.broker;if(PREV.broker){PREV.kpis=[];PREV.in_scope=true;PREV.out_role=""}else{PREV.broker_tasks=[]}if(QUEUE.length)QUEUE[QI]=PREV;preview(PREV)};
 $("wprev").querySelectorAll("[data-k]").forEach(function(b){b.onclick=function(){PREV.broker=false;var v=+b.getAttribute("data-k"),i=PREV.kpis.indexOf(v);if(i>=0)PREV.kpis.splice(i,1);else PREV.kpis.unshift(v);preview(PREV)}});
 if($("frw"))$("frw").onclick=function(){sheet("Whose job was it?",(D.out_roles||[]).map(function(r){return opt(r[0],r[0],PREV.out_role===r[0])}).join(""),function(s){s.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){PREV.out_role=o.getAttribute("data-v");SHEET()}})})};
 // v578 - clock it: start and end pickers first (the hours that count), the part-of-day words underneath
 $("frt").onclick=function(){sheet("When?",'<div class=grp>Clock it (the hours that count)</div><div class=row style="grid-template-columns:1fr 1fr;margin:0 0 8px"><input type=time id=pst value="'+esc(PREV.start||"")+'"><input type=time id=pen value="'+esc(PREV.end||"")+'"></div><div class=line id=phrs>'+(PREV.start&&PREV.end?clocked(PREV)+' hours':'Start and end, 24-hour')+'</div><div class=grp>Part of the day</div>'+(D.times||[]).map(function(t){return opt(t,t==="Unspecified"?"Not stated":t,(PREV.time_of_day||"Unspecified")===t,ICON[t])}).join(""),
  function(s){var st=s.querySelector("#pst"),en=s.querySelector("#pen");function upd(){PREV.start=st.value||"";PREV.end=en.value||"";var h=clocked(PREV);s.querySelector("#phrs").textContent=h!=null?h+" hours":"Start and end, 24-hour";if(h!=null){var hh=+st.value.slice(0,2);PREV.time_of_day=hh<12?"Morning":hh<14?"Midday":hh<18?"Afternoon":"Evening"}}st.onchange=upd;en.onchange=upd;
   s.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){PREV.time_of_day=o.getAttribute("data-v");SHEET()}})})};
 $("frl").onclick=function(){sheet("Where were you?",(D.where||[]).map(function(w){return opt(w,w==="Unspecified"?"Not stated":w,(PREV.where||"Unspecified")===w)}).join("")+'<div class=line style="margin-top:8px">Work counts wherever it is done (clause 8.1, hybrid). This is only so the office days show.</div>',function(s){s.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){PREV.where=o.getAttribute("data-v");SHEET()}})})};
 $("frp").onclick=function(){sheet("Who was there?",'<div class=opt data-v="__alone"'+(PREV.alone&&!PREV.people.length?' class="opt on"':'')+'>By yourself</div>'+(D.people_tree||[]).map(function(g){return '<div class=grp>'+esc(g.dept)+'</div>'+g.people.map(function(n){return opt(n,n,PREV.people.indexOf(n)>=0)}).join("")}).join(""),
  function(s){s.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){var v=o.getAttribute("data-v");if(v==="__alone"){PREV.people=[];PREV.alone=true}else{var i=PREV.people.indexOf(v);if(i>=0)PREV.people.splice(i,1);else PREV.people.push(v);PREV.alone=false}s.querySelectorAll(".opt").forEach(function(x){var dv=x.getAttribute("data-v"),on=dv==="__alone"?(PREV.alone&&!PREV.people.length):PREV.people.indexOf(dv)>=0;x.classList.toggle("on",on);var c=x.querySelector("span");if(on&&!c)x.insertAdjacentHTML("beforeend",'<span style="margin-left:auto;color:#0A4F4A">&#10003;</span>');if(!on&&c)c.remove()})}})})};
 $("fry").onclick=function(){sheet("What kind, and how long?",'<div class=grp>Type</div>'+D.types.map(function(t){return opt("t:"+t,t,PREV.type===t,ICON[t])}).join("")+'<div class=grp>About how long</div>'+(D.effort||[]).map(function(x){return opt("e:"+x,x,PREV.effort===x)}).join(""),
  function(s){s.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){var v=o.getAttribute("data-v");if(v.indexOf("t:")===0)PREV.type=v.slice(2);else PREV.effort=v.slice(2);s.querySelectorAll(".opt").forEach(function(x){var xv=x.getAttribute("data-v");x.classList.toggle("on",xv==="t:"+PREV.type||xv==="e:"+PREV.effort)})}})})};
 $("wprev").querySelectorAll("#frk").forEach(function(el){el.onclick=function(){sheet("Campaign or task",(PREV.works.filter(function(w){return D.works.indexOf(w)<0}).concat(D.works)).map(function(w){return opt(w,w,PREV.works.indexOf(w)>=0)}).join("")+'<div class=addw style="margin-top:10px"><input id=pnw placeholder="Add a new task"><button type=button class=ghost id=pnb>Add</button></div>',
  function(s){s.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){var v=o.getAttribute("data-v"),i=PREV.works.indexOf(v);if(i>=0)PREV.works.splice(i,1);else PREV.works.push(v);o.classList.toggle("on")}});s.querySelector("#pnb").onclick=function(){var v=s.querySelector("#pnw").value.trim();if(!v||PREV.works.indexOf(v)>=0)return;PREV.works.push(v);SHEET()}})}});
 function tog(attr,arr){$("wprev").querySelectorAll("[data-"+attr+"]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-"+attr),i=PREV[arr].indexOf(v);if(i>=0)PREV[arr].splice(i,1);else PREV[arr].push(v);b.classList.toggle("on")}})}
 PREV.scope=PREV.scope||[];tog("s","scope");
 wireParties(e);
 function prog(){PREV.progress=PREV.works.map(function(w){var p=PREV.progress.filter(function(x){return x.work===w})[0];if(p)return p;var old=(D.tasks||[]).filter(function(t){return t.name===w})[0];return {work:w,status:old&&old.percent>0?"In progress":"Started",percent:old?old.percent:10,owners:old&&old.owners.length?old.owners.slice():PREV.people.slice()}});
  $("pprog").innerHTML=PREV.progress.map(function(p,i){return '<div class=pg><div class=line style="color:#1C2321;font-weight:500">'+esc(p.work)+' <b id=pp'+i+' style="color:#0A4F4A;float:right">'+p.percent+'%</b></div><input type=range min=0 max=100 step=5 value='+p.percent+' data-pc='+i+'><div class=chips>'+D.status.map(function(s){return '<button type=button class="chip'+(s===p.status?' on':'')+'" data-st="'+i+'|'+esc(s)+'">'+esc(s)+'</button>'}).join("")+'</div>'
   +'</div>'}).join("");
  // v572 (Najjuko: "you still put all of the people ... too much noise") - no second people list: the people under With are the people on the task
  PREV.progress.forEach(function(p){p.owners=PREV.people.filter(function(n){return n!=="All sales agents"})});
  $("pprog").querySelectorAll("[data-pc]").forEach(function(r){r.oninput=function(){var i=+r.getAttribute("data-pc");PREV.progress[i].percent=+r.value;$("pp"+i).textContent=r.value+"%";if(+r.value===100){PREV.progress[i].status="Done"}}});
  $("pprog").querySelectorAll("[data-st]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-st").split("|"),i=+v[0];PREV.progress[i].status=v[1];if(v[1]==="Done"){PREV.progress[i].percent=100}prog()}})}
 prog();
 if($("pa"))$("pa").onclick=function(){var qa=[];$("wprev").querySelectorAll(".pq").forEach(function(i){if(i.value.trim())qa.push("Q: "+e.questions[+i.getAttribute("data-q")]+"\nA: "+i.value.trim())});
  if(!qa.length)return;var one=(e.summary||$("wt").value).trim()+"\n\n"+qa.join("\n");$("pa").disabled=true;$("pa").textContent="Refiling…";
  api({action:"parse",text:one,date:$("wd").value}).then(function(j){if(j.entry){j.entry.src=one;if(QUEUE.length)QUEUE[QI]=j.entry;preview(j.entry)}})};
 $("pc").onclick=function(){clearDraft();EDIT=null;if(QUEUE.length>1)nextInQueue();else{QUEUE=[];QI=0;$("wprev").innerHTML=""}};
 $("pv").onclick=function(){PREV.summary=$("ps").value;if(PREV.in_scope!==false&&!PREV.broker&&!PREV.kpis.length){alert("Tap which part of your role this counts towards, or mark it outside your role.");return}if(PREV.in_scope===false&&!PREV.out_role){alert("Tap whose job it was.");return}$("pv").disabled=true;$("pv").classList.add("saving");
  api({action:"save",entry:PREV,text:PREV.src||$("wt").value,date:$("wd").value,link:($("wl")?$("wl").value:""),id:EDIT&&EDIT.id,oldDate:EDIT&&EDIT.date,created:EDIT&&EDIT.created,rec:PREV.src_rec||""}).then(function(j){if(!j.ok){toast("Not saved: "+(j.error||"something went wrong")+". What you wrote is still here; tap the tick again.",true);$("pv").disabled=false;$("pv").classList.remove("saving");return}
   var _dn=new Date(j.entry.date+"T00:00:00Z"),_lab=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][_dn.getUTCDay()]+" "+_dn.getUTCDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][_dn.getUTCMonth()];
   toast("\u2713 Saved: "+(j.entry.title||"your entry")+" is filed under "+_lab+".");var _tk=$("pv");if(_tk){_tk.classList.remove("saving");_tk.classList.add("saved");setTimeout(function(){var t2=$("pv");if(t2)t2.classList.remove("saved")},1800)}if(!(QUEUE.length>1&&QI<QUEUE.length-1))clearDraft();
   // v583 - the first save from an uploaded document teaches its DNA, so the same kind of file is recognised next time
   if(UPL&&PREV.src_file===UPL.name){api({action:"doc_dna",name:UPL.name,title:PREV.works&&PREV.works[0]||PREV.title,kind:PREV.type,summary:PREV.summary,head:UPL.head}).catch(function(){});UPL=null}
   EDIT=null;if(QUEUE.length>1){var moreToCome=QI<QUEUE.length-1}else{QUEUE=[];QI=0}
   if(QUEUE.length>1)nextInQueue();else{$("wprev").innerHTML="";$("wt").value="";if($("wl"))$("wl").value=""}
   var t=new Date(j.entry.date+"T00:00:00Z"),dow=(t.getUTCDay()+6)%7;var wk=new Date(t.getTime()-dow*864e5).toISOString().slice(0,10);
   if(wk===D.from){D.entries=[j.entry].concat(D.entries.filter(function(x){return x.id!==j.entry.id}));D.tally.forEach(function(x){x.week=D.entries.filter(function(e){return e.kpis.indexOf(x.id)>=0}).length});draw();setTimeout(function(){load(WEEK)},1500)}else load(wk);setTimeout(function(){var l=$("wlist");if(l&&l.scrollIntoView)l.scrollIntoView({behavior:"smooth",block:"start"})},400)}).catch(function(){$("pv").disabled=false;$("pv").classList.remove("saving");toast("Not saved: no connection. What you wrote is still here; tap the tick again.",true)})}}
$("wf").onsubmit=function(ev){ev.preventDefault();var t=$("wt").value.trim();if(!t)return;$("wb").disabled=true;$("wb").textContent="Filing…";
 api({action:"parse",text:t,date:$("wd").value}).then(function(j){$("wb").disabled=false;$("wb").textContent="File it";if(j.error){alert(j.error);return}
  QUEUE=(j.entries&&j.entries.length?j.entries:[j.entry]).map(function(e){e.src=e.summary;return e});QI=0;if(QUEUE.length===1)QUEUE[0].src=t;preview(QUEUE[0])}).catch(function(){$("wb").disabled=false;$("wb").textContent="File it";alert("Could not file it just now. Try again.")})};
// v567 - speak instead of typing: the browser's own speech-to-text (Safari and Chrome); where it is missing, the keyboard's microphone still works
// v574 (Kendall 14 Oct: "once it starts, how does it stop? If you click on it, it should stop") - the second tap is decisive: on=false FIRST so the
// auto-restart cannot race it, then abort (not stop, which waits for the engine). Also stops on File it, Start over, and after 45 s of silence.
(function(){var SR=window.SpeechRecognition||window.webkitSpeechRecognition,b=$("wmic"),r=null,on=false,base="",quiet=null;
 if(!SR){b.onclick=function(){alert("Tap the text box, then use the microphone on your keyboard to speak.");$("wt").focus()};return}
 function stop(){on=false;clearTimeout(quiet);b.classList.remove("rec");b.querySelector("span").textContent="Speak";var x=r;r=null;if(x){x.onend=null;x.onresult=null;try{x.abort()}catch(e){try{x.stop()}catch(e2){}}}}
 function armQuiet(){clearTimeout(quiet);quiet=setTimeout(stop,45000)}
 function start(){var x=new SR();x.lang="en-GB";x.continuous=true;x.interimResults=true;base=$("wt").value.trim();base=base?base+" ":"";
  x.onresult=function(ev){var fin="",tmp="";for(var i=0;i<ev.results.length;i++){if(ev.results[i].isFinal)fin+=ev.results[i][0].transcript;else tmp+=ev.results[i][0].transcript}$("wt").value=base+fin+tmp;armQuiet()};
  x.onend=function(){if(on&&r===x){base=$("wt").value.trim();base=base?base+" ":"";try{start()}catch(e){stop()}}};
  x.onerror=function(e){if(e.error==="not-allowed"){alert("Allow the microphone for this page to speak your entry.");stop()}else if(e.error==="no-speech"){/* engine timed out: onend restarts */}else{stop()}};
  r=x;try{x.start()}catch(e){stop();return}on=true;b.classList.add("rec");b.querySelector("span").textContent="Stop";armQuiet()}
 b.onclick=function(){if(on){stop()}else{start()}};
 $("wf").addEventListener("submit",stop,true);var rs=$("wreset");if(rs)rs.addEventListener("click",stop,true)})();
// v577 - the two tabs (What did you do? / Report) and the Report tab: Today, This week, or tap the days; one button makes the page
// v615 - Months: one month, from one month to another, or everything since the engagement began; a span of months comes back as one summary and one page per month
(function(){var mode="today",picked={},MF=null,MT=null,ALL=false;function show(rep){$("vlog").style.display=rep?"none":"block";$("vrep").style.display=rep?"block":"none";$("tlog").classList.toggle("on",!rep);$("trep").classList.toggle("on",rep);if(rep)rdraw()}
 $("tplan").onclick=function(){location.href="/momo/work/plan?key="+encodeURIComponent(KEY)};
 $("tlog").onclick=function(){show(false)};$("trep").onclick=function(){show(true)};
 function tdy(){return D?D.today:new Date(Date.now()+4*3600e3).toISOString().slice(0,10)}
 function start(){return (D&&D.start)||"2026-10-02"}
 function wk(){var d=tdy(),t=new Date(d+"T00:00:00Z"),dow=(t.getUTCDay()+6)%7,m=new Date(t.getTime()-dow*864e5),o=[];for(var i=0;i<7;i++){o.push(new Date(m.getTime()+i*864e5).toISOString().slice(0,10))}return o}
 function nextYm(y){var yy=+y.slice(0,4),mm=+y.slice(5,7)+1;if(mm>12){mm=1;yy++}return yy+"-"+String(mm).padStart(2,"0")}
 function months(){var s=start().slice(0,7),t=tdy().slice(0,7),o=[];while(s<=t&&o.length<24){o.push(s);s=nextYm(s)}return o}
 function span(a,b){var o=[],d=new Date(a+"T00:00:00Z");while(o.length<420){var s=d.toISOString().slice(0,10);if(s>b)break;o.push(s);d.setUTCDate(d.getUTCDate()+1)}return o}
 function lastOf(ym){return new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).toISOString().slice(0,10)}
 function ml(y){return M[+y.slice(5,7)-1]+" "+y.slice(0,4)}
 // v581 - month at a glance: the calendar month to date (1st to today); v615 - or from one month to another, the last one to date, or everything
 function mo(){var ms=months(),t=tdy();if(ALL)return span(start(),t);if(!MF||ms.indexOf(MF)<0)MF=ms[ms.length-1];if(!MT||ms.indexOf(MT)<0||MT<MF)MT=MF;var last=lastOf(MT);return span(MF+"-01",last>t?t:last)}
 function chips(id,cur,set){var ms=months();$(id).innerHTML=ms.map(function(y){return '<button type=button data-ym="'+y+'"'+(y===cur&&!ALL?' class=on':'')+' style="padding:10px 4px;justify-content:center"><span style="font-size:.7rem;color:#8A6F3E">'+y.slice(0,4)+'</span><b>'+M[+y.slice(5,7)-1]+'</b></button>'}).join("");$(id).querySelectorAll("[data-ym]").forEach(function(b){b.onclick=function(){ALL=false;set(b.getAttribute("data-ym"));rdraw()}})}
 function rdraw(){var days=wk(),today=tdy(),sel=mode==="today"?[today]:mode==="week"?days:mode==="month"?mo():days.filter(function(d){return picked[d]});
  $("rpick").style.display=mode==="pick"?"block":"none";$("rmonths").style.display=mode==="month"?"block":"none";
  if(mode==="pick")$("rdays").innerHTML=days.map(function(d){return '<button type=button data-rd="'+d+'"'+(picked[d]?' class=on':'')+' style="padding:10px 4px;justify-content:center"><span style="font-size:.7rem;color:#8A6F3E">'+DN[new Date(d+"T00:00:00Z").getUTCDay()]+'</span><b>'+(+d.slice(8))+'</b></button>'}).join("");
  $("rdays").querySelectorAll("[data-rd]").forEach(function(b){b.onclick=function(){var d=b.getAttribute("data-rd");picked[d]=!picked[d];rdraw()}});
  if(mode==="month"){chips("rmfrom",MF,function(y){MF=y;if(MT<MF)MT=MF});chips("rmto",MT,function(y){MT=y;if(MT<MF)MF=MT});$("rall").className=ALL?"gold":"ghost";$("rall").textContent=(ALL?"✓ ":"")+"Everything since "+fd(start());$("rall").onclick=function(){ALL=!ALL;rdraw()}}
  var many=sel.length>1&&sel[0].slice(0,7)!==sel[sel.length-1].slice(0,7),perMonth=many?", one page per month":"";
  $("rsum").textContent=sel.length?(sel.length===1?fd(sel[0]):mode==="month"?(ALL?"Everything since "+fd(sel[0])+", "+sel.length+" days"+perMonth:MF===MT?ml(MF)+(sel[sel.length-1]===today?" to date":"")+", "+sel.length+" days":ml(MF)+" to "+ml(MT)+", "+sel.length+" days"+perMonth):sel.length+" days: "+sel.map(function(d){return DN[new Date(d+"T00:00:00Z").getUTCDay()]}).join(", ")):"Tap at least one day";
  $("rgo").style.opacity=sel.length?"1":".5";$("rgo").href=sel.length?"/momo/work/report?key="+encodeURIComponent(KEY)+(mode==="month"?(ALL?"&all=1":"&from="+sel[0]+"&to="+sel[sel.length-1]):"&days="+sel.join(",")):"javascript:void(0)"}
 $("vrep").querySelectorAll("[data-rp]").forEach(function(b){b.onclick=function(){mode=b.getAttribute("data-rp");$("vrep").querySelectorAll("[data-rp]").forEach(function(x){x.classList.toggle("on",x===b)});rdraw()}});
 window.__rdraw=rdraw})();
// v583 - Upload a file: PDF, Word, Excel, CSV, a photo of a page. Read in the app, filed through the same step; each activity confirmed in turn.
$("wfile").onchange=function(){var f=this.files&&this.files[0];if(!f)return;if(f.size>6*1024*1024){alert("That file is over 6 MB. Export a smaller PDF or a page photo.");this.value="";return}
 var lab=$("wupl").querySelector("span");lab.textContent="Reading "+f.name.slice(0,22)+"…";var rd=new FileReader();rd.onload=function(){var b64=String(rd.result).split(",")[1]||"";
  api({action:"upload",name:f.name,type:f.type||"",data:b64,date:$("wd").value}).then(function(j){lab.textContent="Upload a file";$("wfile").value="";if(j.error){alert(j.error);return}
   QUEUE=(j.entries||[]).map(function(e){e.src=(e.summary||"")+"\n\n[from "+f.name+"]";e.src_file=f.name;return e});QI=0;if(!QUEUE.length){alert("Nothing to file from that document.");return}
   UPL={name:f.name,head:(j.excerpt||"").slice(0,300),recognised:j.recognised||""};
   $("wt").value=(j.recognised?"Recognised as your "+j.recognised+". ":"")+j.entries.length+(j.entries.length===1?" activity":" activities")+" read from "+f.name+" ("+Math.round(j.chars/1000)+"k characters). Check each one.";
   preview(QUEUE[0]);scrollTo(0,0)}).catch(function(){lab.textContent="Upload a file";$("wfile").value="";alert("Could not read that file just now.")})};rd.readAsDataURL(f)};
var UPL=null;
// v571 - Start over: clears the box and anything being checked; saved entries are untouched
$("wreset").onclick=function(){clearDraft();if(($("wt").value.trim()||QUEUE.length)&&!confirm("Clear what you have typed and start again? Anything already saved stays."))return;QUEUE=[];QI=0;EDIT=null;PREV=null;UPL=null;$("wprev").innerHTML="";$("wt").value="";if($("wl"))$("wl").value="";$("wd").value=D?D.today:"";$("wt").focus()};
$("wprevw").onclick=function(){shift(-1)};$("wnextw").onclick=function(){shift(1)};
` + REC_JS + String.raw`load();resumeDraft()})();`;
