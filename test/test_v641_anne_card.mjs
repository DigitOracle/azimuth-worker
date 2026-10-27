// v641 - the temporary client card in Momo: the owner's (Najjuko's) key only; front-door card while the record exists and is not retired. FAKE data and fake keys only (the repo is public).
const worker = (await import("../src/index.js")).default;
const { cleanLead, STATUSES, MAX_LEADS } = await import("../src/work_anne.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const K = "ins_najjuko_TESTKEY0123456789abcd", N = "ins_kendall_TESTKEY0123456789abcd", O = "ins_other_TESTKEY0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [K, N, O].join(",") }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (p, k) => worker.fetch(new Request("https://w" + p + (p.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(k)), env, ctx);
const post = (b, k) => worker.fetch(new Request("https://w/momo/work/anne/api?key=" + encodeURIComponent(k), { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }), env, ctx);
const door = async (k) => (await (await get("/momo?door=1", k)).text());
const cards = (h) => (h.match(/class=card/g) || []).length;
// gate
for (const k of [N, O, "", "wrong"]) for (const p of ["/momo/work/anne", "/momo/work/anne/rec"]) { const r = await get(p, k); ok(r.status === 404, "404 on " + p + " for key '" + k.slice(0, 10) + "'", r.status); }
for (const k of [N, O, "wrong"]) { const r = await post({ action: "archive" }, k); ok(r.status === 404 || r.status === 401, "POST refused for key '" + k.slice(0, 10) + "'", r.status); }
ok((await get("/momo/work/anne", K)).status === 200, "the owner's (Najjuko's) key opens the page");
const rec0 = await (await get("/momo/work/anne/rec", K)).json(); ok(rec0.rec && rec0.rec.leads.length === 0, "an empty card before any data", rec0);
// front door: no record -> no card
let h = await door(K); ok(cards(h) === 3, "no record: 3 cards for Najjuko", cards(h));
// import and merge by id
let r = await (await post({ action: "import_leads", title: "Fake Client", brief: { budgetMin: 100, budgetMax: 200, chips: ["a", "b"] }, leads: [
  { id: "L1", community: "Fake Community", property: "Fake House 1", rent: "AED 150,000", agent: "Fake Agent", phone: "+000 0 000 0000", phoneType: "agent", listingUrl: "https://example.com/1", status: "Contacted", dog: "yes" },
  { id: "L2", community: "Fake Community", property: "Fake House 2", rent: 120000, listingUrl: "javascript:alert(1)", email: "not-an-email", status: "Bogus", dog: "maybe" }] }, K)).json();
ok(r.ok && r.added === 2 && r.merged === 0, "import adds 2", r);
let rec = (await (await get("/momo/work/anne/rec", K)).json()).rec;
ok(rec.title === "Fake Client" && rec.leads.length === 2, "title and leads stored");
ok(rec.leads[0].rent === 150000 && rec.leads[0].status === "Contacted", "rent parsed, status kept", rec.leads[0]);
ok(rec.leads[1].listingUrl === "" && rec.leads[1].email === "" && rec.leads[1].status === "New" && rec.leads[1].dog === "unknown", "bad url/email/status/dog sanitised", rec.leads[1]);
r = await (await post({ action: "import_leads", leads: [{ id: "L1", rent: 140000, agent: "Other Agent" }, { id: "L3", property: "Fake House 3", community: "C2" }] }, K)).json();
ok(r.added === 1 && r.merged === 1, "second import merges by id", r);
rec = r.rec; const l1 = rec.leads.find((l) => l.id === "l1");
ok(l1 && l1.rent === 140000 && l1.agent === "Other Agent" && l1.status === "Contacted" && l1.dog === "yes" && l1.phone === "+000 0 000 0000", "merge updates given fields, keeps status, dog, phone", l1);
// actions
r = await (await post({ action: "set_status", id: "l1", status: "Viewing booked" }, K)).json(); ok(r.ok && r.rec.leads.find((l) => l.id === "l1").status === "Viewing booked", "set_status");
r = await post({ action: "set_status", id: "l1", status: "Nope" }, K); ok(r.status === 400, "bad status refused", r.status);
r = await (await post({ action: "add_note", id: "l1", note: "Agent said dogs ok" }, K)).json(); ok(/Agent said dogs ok/.test(r.rec.leads.find((l) => l.id === "l1").notes), "add_note appends");
r = await (await post({ action: "save_lead", lead: { property: "Fake House 4", community: "C2", rent: 99000, dog: "no" } }, K)).json(); ok(r.ok && r.rec.leads.length === 4, "save_lead adds");
r = await (await post({ action: "delete_lead", id: "l3" }, K)).json(); ok(r.ok && r.rec.leads.length === 3, "delete_lead");
r = await (await post({ action: "save_brief", brief: { budgetMin: 1, budgetMax: 2, chips: ["x"] } }, K)).json(); ok(r.rec.brief.chips.length === 1, "save_brief");
ok(r.rec.updatedAt && r.rec.log.length >= 5, "updatedAt bumped and a log kept", r.rec.log.length);
r = await post({ action: "bogus" }, K); ok(r.status === 400, "unknown action 400");
// cap
const many = Array.from({ length: 200 }, (_, i) => ({ id: "m" + i, property: "P" + i })); r = await (await post({ action: "import_leads", leads: many }, K)).json(); ok(r.rec.leads.length <= MAX_LEADS, "lead cap", r.rec.leads.length);
// front door: record present -> 4 cards for Najjuko, still 3 for Kendall and the other key
h = await door(K); ok(cards(h) === 4 && /Fake Client/.test(h) && /\/momo\/work\/anne\?key=/.test(h), "4 cards for Najjuko with the client's title", cards(h));
ok(cards(await door(N)) === 5 && !/Fake Client/.test(await door(N)), "5 cards for Kendall (v646: + Speaking, v650: + GGU), no client card");
ok(cards(await door(O)) === 3, "3 cards for another insider");
// archive hides the card; unarchive brings it back
await post({ action: "archive" }, K); h = await door(K); ok(cards(h) === 3 && !/Fake Client/.test(h), "archived: card gone from the front door", cards(h));
ok((await get("/momo/work/anne", K)).status === 200, "archived page still opens (to restore)");
await post({ action: "unarchive" }, K); ok(cards(await door(K)) === 4, "restored: card back");
// the page code holds no lead data
const pg = await (await get("/momo/work/anne", K)).text(); ok(!/Fake House/.test(pg), "page code holds no lead data");
ok(STATUSES.length === 7, "7 statuses"); ok(cleanLead({ phone: "<script>+1 (2)" }).phone === "+1 (2)", "phone chars cleaned");
const fl = cleanLead({ id: "f1", property: "P", trakheesi: "123", verified: "exact advert", flags: ["a", "", "b"], phoneType: "DLD registered" });
ok(fl.trakheesi === "123" && fl.verified === "exact advert" && fl.flags.length === 2 && fl.phoneType === "DLD registered", "trakheesi, verified, flags and DLD registered type kept", fl);
ok(cleanLead({ verified: "made up", flags: "x" }).verified === "" && cleanLead({ flags: "x" }).flags.length === 0, "bad verified and non-array flags sanitised");
await post({ action: "delete_lead", id: "m0" }, K);
const mp = await (await post({ action: "save_lead", lead: { property: "No Contact House", community: "C" } }, K)).json(); ok(mp.ok && mp.lead.flags.length === 0, "a lead without a phone saves (the Missing contact chip is drawn by the page)");
ok(/Missing contact/.test(await (await get("/momo/work/anne", K)).text()), "page code draws the Missing contact chip");
// v642 - the printable register
for (const k of [N, O, "", "wrong"]) { const r = await get("/momo/work/anne/report", k); ok(r.status === 404, "report 404 for key '" + k.slice(0, 10) + "'", r.status); }
{ const r = await get("/momo/work/anne/report", K), t = await r.text();
  ok(r.status === 200 && /text\/html/.test(r.headers.get("content-type")) && /Fake Client/.test(t) && /Fake House 1/.test(t) && /Fake Community/.test(t), "his key gets the report with the record", r.status);
  ok(/Advertised leads, not confirmed availability/.test(t) && /Updated \d{4}-\d\d-\d\d/.test(t) && /window\.print\(\)/.test(t) && /page-break-inside:avoid/.test(t) && /@page\{size:A4 portrait/.test(t), "footer, updated line, print button, A4 and page-break rules");
  ok(/href="tel:\+00000000000"/.test(t) && /\(agent\)/.test(t) && /href="https:\/\/example\.com\/1"/.test(t), "phone as tel link with its type, advert link");
  ok(!/<img/.test(t) && !/[\u{1F300}-\u{1FAFF}]/u.test(t), "no images, no emojis");
  ok(/Missing contact/.test(t), "Missing contact chip in the report for a lead without a route"); }
{ const t = await (await get("/momo/work/anne/report?status=Viewing%20booked", K)).text(); ok(/Fake House 1/.test(t) && !/Fake House 2/.test(t) && /status Viewing booked/.test(t), "status filter narrows the report"); }
{ const t = await (await get("/momo/work/anne/report?community=C2", K)).text(); ok(/Fake House 4/.test(t) && !/Fake House 1/.test(t), "community filter narrows the report"); }
{ const t = await (await get("/momo/work/anne/report?status=Bogus", K)).text(); ok(/Fake House 1/.test(t) && /Fake House 2/.test(t), "an unknown status is ignored"); }
{ const t = await (await get("/momo/work/anne/report?community=Nowhere", K)).text(); ok(/No leads match/.test(t), "an empty filter says so"); }
{ const t = await (await get("/momo/work/anne", K)).text(); ok(/id=adl/.test(t) && /id=apdf/.test(t) && /\/momo\/work\/anne\/report/.test(t), "the page has Download and Save as PDF"); }

// v643 - her Work page carries the client button while the record is active; Kendall's Work page never does
{ const wk = await (await get("/momo/work", K)).text(); ok(/id=tanne/.test(wk) && /\/momo\/work\/anne\?key=/.test(wk), "her Work page shows the client button"); }
{ const wk = await (await get("/momo/work", N)).text(); ok(!/id=tanne/.test(wk), "Kendall's Work page has no client button"); }
{ const a0 = await post({ action: "archive" }, K); ok(a0.status === 200, "archive ok", a0.status);
  const wk = await (await get("/momo/work", K)).text(); ok(!/id=tanne/.test(wk), "archived: no client button on her Work page");
  const u0 = await post({ action: "unarchive" }, K); ok(u0.status === 200, "unarchive ok", u0.status); }
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
