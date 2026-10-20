// v615 (Kendall 20 Oct 2026: "the ability to check more than one month at a time ... pull them all, everything as PDFs") - a report may run from one
// month to another or over everything since 2 Oct 2026, coming back as one summary and one page per month; the plan's PDF for Ali does the same;
// the Months picker on the phone exists in the markup the script reads; every month page still carries clause 12.2 and no key.
const m = await import("../src/work_log.js");
const plan = await import("../src/work_plan.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV };
const deps = { isNaj: () => true, model: "m", page: (k, rk, b) => "<html>" + b + "</html>", claudeJSON: async () => null };
const req = (path) => m.workRoute(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"), env, new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"), deps);
const entry = (date, title, extra) => Object.assign({ date, created: date + "T09:00:00Z", title, type: "Meeting", summary: "", people: ["Ali Al Mansoori"], kpis: [1], scope: [], works: ["Plan " + date.slice(0, 7)], effort: "1-2 hours", time_of_day: "Morning", alone: false, in_scope: true, broker: false, broker_tasks: [], start: "", end: "", where: "Office", out_role: "", external: [], prep: null, progress: [], questions: [], answers: [], deliverables: [], evidence: [], next: [], check: false }, extra || {});
store.set("work_naj_2026-10-06_a1", JSON.stringify(entry("2026-10-06", "Monday huddle")));
store.set("work_naj_2026-10-13_a2", JSON.stringify(entry("2026-10-13", "Content review")));
store.set("work_naj_2026-11-04_b1", JSON.stringify(entry("2026-11-04", "November kickoff")));
store.set("work_naj_2026-12-02_c1", JSON.stringify(entry("2026-12-02", "National Day post", { in_scope: false, out_role: "Sales" })));

// 1. a span of three months: one summary, one section per month, each month on its own printed page
let r = await req("/momo/work/report?from=2026-10-01&to=2026-12-31");
let h = await r.text();
ok(r.status === 200 && (h.match(/<section class=mth>/g) || []).length === 3, "October to December comes back as three month sections", (h.match(/<section class=mth>/g) || []).length);
ok(h.includes("THE WHOLE PERIOD · 3 MONTHS"), "the whole period is summarised once at the top");
ok(h.includes("OCTOBER 2026") && h.includes("NOVEMBER 2026") && h.includes("DECEMBER 2026"), "every month is named");
ok(h.includes("Monday huddle") && h.includes("November kickoff") && h.includes("National Day post"), "entries from each month appear");
ok(/\.mth\{[^}]*page-break-before:always/.test(h), "each month section breaks onto a new printed page");
ok(h.includes('document.title="FN Activity report October 2026 to December 2026"'), "the PDF is named by its span", h.match(/document\.title=[^;]*/)?.[0]);
ok(h.includes("clause 12.2") && !h.includes("key=K"), "clause 12.2 stays and her key never prints");
ok(h.includes("<em>Activity</em> Report"), "a span is an Activity report");

// 2. a single calendar month is the monthly report it always was: no month sections
r = await req("/momo/work/report?from=2026-10-01&to=2026-10-31"); h = await r.text();
ok(r.status === 200 && !h.includes("class=mth") && h.includes("<em>Monthly</em> Report") && h.includes("MONTH AT A GLANCE"), "one month is still the Monthly report");
ok(h.includes('document.title="FN Monthly report October 2026"'), "the monthly PDF keeps its name");

// 3. reversed dates are put in order; a span is capped at about 13 months; a month with nothing logged says so
r = await req("/momo/work/report?from=2026-12-31&to=2026-10-01"); h = await r.text();
ok((h.match(/<section class=mth>/g) || []).length === 3, "from and to the wrong way round still works");
r = await req("/momo/work/report?from=2024-01-01&to=2026-12-31"); h = await r.text();
ok(r.status === 200 && (h.match(/<section class=mth>/g) || []).length <= 14, "a span longer than about 13 months is cut to that", (h.match(/<section class=mth>/g) || []).length);
r = await req("/momo/work/report?from=2026-10-01&to=2026-11-30"); h = await r.text();
ok(!h.includes("NOTHING LOGGED"), "months with entries are not marked empty");
store.delete("work_naj_2026-11-04_b1");
r = await req("/momo/work/report?from=2026-10-01&to=2026-11-30"); h = await r.text();
ok(h.includes("NOVEMBER 2026 · NOTHING LOGGED"), "a month with nothing logged is marked");
store.set("work_naj_2026-11-04_b1", JSON.stringify(entry("2026-11-04", "November kickoff")));

// 4. everything since the engagement began
r = await req("/momo/work/report?all=1"); h = await r.text();
ok(r.status === 200 && h.includes("Monday huddle"), "all=1 runs from 2 Oct 2026 and includes the first entries");
const api = await (await req("/momo/work/api")).json();
ok(api.start === "2026-10-02", "the API tells the page when the engagement began", api.start);

// 5. the Months picker: the markup the script reads exists (the v602 rule), and the script builds the span links
const page = await (await req("/momo/work")).text(), js = await (await req("/momo/work.js")).text();
for (const id of ["rmonths", "rmfrom", "rmto", "rall"]) ok(page.includes("id=" + id), "the page has #" + id) ;
ok(page.includes(">Months</button>"), "the tab says Months");
for (const id of ["rmonths", "rall"]) ok(js.includes('$("' + id + '")'), "the script drives #" + id);
ok(js.includes('chips("rmfrom"') && js.includes('chips("rmto"'), "the script fills the from and to month chips");
ok(js.includes("&all=1") && js.includes('"&from="+sel[0]+"&to="+sel[sel.length-1]'), "the script links a span by from/to and everything by all=1");
ok(js.includes("D.start"), "the first month comes from the API");

// 6. the plan: one month, a span, everything
const preq = (path) => m.workRoute(new Request("https://w" + path + "&key=K"), env, new URL("https://w" + path + "&key=K"), deps);
r = await preq("/momo/work/plan/month?month=2026-10"); h = await r.text();
ok(r.status === 200 && !h.includes('class="mth') && h.includes("<title>FN Events for October 2026</title>"), "one month is the PDF it always was");
r = await preq("/momo/work/plan/month?from=2026-10&to=2026-12"); h = await r.text();
ok(r.status === 200 && (h.match(/<section class="mth/g) || []).length === 3 && h.includes("<title>FN Events October 2026 to December 2026</title>"), "a span of months is one page per month", (h.match(/<section class="mth/g) || []).length);
ok(h.includes("OCTOBER 2026") && h.includes("DECEMBER 2026") && h.includes("UAE National Day"), "each month is named and the seeded events appear");
ok(/\.mth\{[^}]*page-break-before:always/.test(h) && h.includes(".mth.first{"), "months break onto new printed pages, the first one not");
r = await preq("/momo/work/plan/month?from=2026-12&to=2026-10"); h = await r.text();
ok((h.match(/<section class="mth/g) || []).length === 3, "from and to the wrong way round still works for the plan");
r = await preq("/momo/work/plan/month?all=1"); h = await r.text();
ok(r.status === 200 && (h.match(/<section class="mth/g) || []).length >= 2 && h.includes("clause 12.2") && !h.includes("key=K"), "everything in the plan is one PDF, clause 12.2, no key", (h.match(/<section class="mth/g) || []).length);

// 7. the plan page script: the range sheet and the share rows exist
const pjs = await (await preq("/momo/work/plan?x=1")).text();
for (const id of ["mr_f", "mr_t", "mr_all", "mrange", "s_all", "mone"]) ok(pjs.includes(id), "the plan script has " + id);
ok(pjs.includes("&all=1") && pjs.includes('"&from="+MR.from+"&to="+MR.to'), "the plan links a span and everything");

console.log("v615 month range: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
