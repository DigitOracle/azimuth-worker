// v644 - the client card's WhatsApp wording, Copy message, the three questions and Best first. FAKE data and fake keys only (the repo is public).
const worker = (await import("../src/index.js")).default;
const { waDigits, fillWa, bestRank, cleanTpl, DEFAULT_WA, ANNE_JS, anneReport, cleanAnne } = await import("../src/work_anne.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const K = "ins_najjuko_TESTKEY0123456789abcd", N = "ins_kendall_TESTKEY0123456789abcd", O = "ins_other_TESTKEY0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [K, N, O].join(",") }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (p, k) => worker.fetch(new Request("https://w" + p + (p.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(k)), env, ctx);
const post = (b, k) => worker.fetch(new Request("https://w/momo/work/anne/api?key=" + encodeURIComponent(k), { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }), env, ctx);
const rec = async () => (await (await get("/momo/work/anne/rec", K)).json()).rec;

// wa.me numbers
ok(waDigits("+971 50 000 0001") === "971500000001", "UAE mobile with +971", waDigits("+971 50 000 0001"));
ok(waDigits("050 000 0001") === "971500000001", "05x becomes 9715x", waDigits("050 000 0001"));
ok(waDigits("00971500000001") === "971500000001", "00 prefix stripped");
ok(waDigits("+971 4 000 0000") === "", "UAE landline: no WhatsApp link");
ok(waDigits("+971 50 000 0001", "portal line") === "", "portal call line: never a WhatsApp link");
ok(waDigits("") === "" && waDigits("abc") === "", "empty or junk: no link");
ok(waDigits("+44 7700 900000") === "447700900000", "a foreign mobile keeps its digits");

// template
const t = cleanTpl({ brokerName: "Test Broker", brokerAgency: "Test Agency" });
ok(t.whatsapp === DEFAULT_WA, "default wording when none is saved");
const m = fillWa(t, { agent: "Jo Example Person", ref: "REF-1", property: "Fake Villa", rent: 250000, community: "Fake Town" });
ok(m.startsWith("Hi Jo, this is Test Broker from Test Agency.") && m.includes("listing REF-1 (Fake Villa, AED 250,000/yr)") && !/\{/.test(m), "placeholders filled, rent with thousands", m);
ok(fillWa(t, { agent: "", listingUrl: "https://example.com/ad/9", property: "P" }).includes("listing https://example.com/ad/9"), "ref falls back to the advert link");
ok(fillWa(cleanTpl({ whatsapp: "{agent} {community} {property}" }), { agent: "A B", community: "C", property: "D" }) === "A B C D", "custom wording with other placeholders");
ok(cleanTpl({ whatsapp: "x".repeat(900) }).whatsapp.length === 600, "wording capped at 600");
ok(!/Najjuko|FN Realty/i.test(DEFAULT_WA), "no broker name or agency in the repo");

// gate
for (const k of [N, O, "", "wrong"]) { const r = await post({ action: "save_tpl", tpl: { brokerName: "x" } }, k); ok(r.status === 404 || r.status === 401, "save_tpl refused for key '" + k.slice(0, 10) + "'", r.status); }
for (const k of [N, O]) { const r = await get("/momo/work/anne", k); ok(r.status === 404, "page 404 for key '" + k.slice(0, 10) + "'", r.status); }

// her key: import, wording, contacted, answers
await post({ action: "import_leads", title: "Fake Client", leads: [
  { id: "A", community: "C1", property: "House A", agent: "Ann Agent", phone: "050 000 0001", phoneType: "agent", rent: 100000, ref: "RA" },
  { id: "B", community: "C1", property: "House B", agent: "Ben Agent", phone: "+971 55 000 0002", phoneType: "portal line", rent: 200000 },
  { id: "C", community: "C2", property: "House C", status: "Expired", available: "yes", dogsOk: "yes", furnishedOk: "yes" },
  { id: "D", community: "C2", property: "House D", dog: "yes" }] }, K);
let r0 = await rec(); ok(r0.leads.find((l) => l.id === "d").dogsOk === "yes" && r0.leads.find((l) => l.id === "a").available === "unknown", "dog maps to dogsOk; answers default unknown", r0.leads);
let r = await (await post({ action: "save_tpl", tpl: { brokerName: "Test Broker", brokerAgency: "Test Agency", whatsapp: "Hello {agent_first} about {ref}" } }, K)).json();
ok(r.ok && r.rec.tpl.brokerName === "Test Broker" && r.rec.tpl.whatsapp === "Hello {agent_first} about {ref}", "wording saved in the record", r.rec && r.rec.tpl);
r = await (await post({ action: "contacted", id: "A", how: "whatsapp" }, K)).json();
let la = r.rec.leads.find((l) => l.id === "a"); ok(la.status === "Contacted", "WhatsApp opened: New becomes Contacted", la.status);
ok(r.rec.log[0].text === "WhatsApp opened: House A" && !/Hello/.test(JSON.stringify(r.rec.log)), "log line, no message content", r.rec.log[0]);
await post({ action: "set_status", id: "A", status: "Viewing booked" }, K);
r = await (await post({ action: "contacted", id: "A", how: "copy" }, K)).json();
ok(r.rec.leads.find((l) => l.id === "a").status === "Viewing booked" && r.rec.log[0].text === "Message copied: House A", "a later status is not pushed back to Contacted");
r = await (await post({ action: "set_answer", id: "B", q: "available", v: "yes" }, K)).json();
ok(r.ok && r.rec.leads.find((l) => l.id === "b").available === "yes", "answer saved");
r = await (await post({ action: "set_answer", id: "B", q: "dogsOk", v: "no" }, K)).json();
ok(r.rec.leads.find((l) => l.id === "b").dogsOk === "no" && r.rec.leads.find((l) => l.id === "b").dog === "no", "dogsOk keeps the dog field in step");
ok((await post({ action: "set_answer", id: "B", q: "available", v: "maybe" }, K)).status === 400, "unknown answer refused");
ok((await post({ action: "set_answer", id: "B", q: "price", v: "yes" }, K)).status === 400, "unknown question refused");
ok((await post({ action: "contacted", id: "nope" }, K)).status === 404, "contacted on a missing lead is 404");

// Best first
const L = (await rec()).leads, order = L.map((l, i) => [bestRank(l), i, l.id]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
ok(order[0] === "b" && order[order.length - 1] === "c", "Best first: available first, expired last", order);
ok(bestRank({ available: "yes", dogsOk: "yes", furnishedOk: "yes" }) < bestRank({ available: "yes", dogsOk: "no", furnishedOk: "yes" }) && bestRank({ available: "yes", dogsOk: "no" }) < bestRank({ available: "unknown", dogsOk: "yes" }), "availability outranks dogs, dogs outrank furnishing");

// page script and register
ok(/var waDigits=function waDigits/.test(ANNE_JS) && /WhatsApp the agent/.test(ANNE_JS) && /Copy message/.test(ANNE_JS) && /Best first/.test(ANNE_JS), "page carries the shared functions and buttons");
ok(/wa\.me\/"\+wd\+"\?text="\+encodeURIComponent\(msg\)/.test(ANNE_JS), "wa.me link carries the encoded message");
const page = await (await get("/momo/work/anne", K)).text();
ok(/id=w_text/.test(page) && /Message wording/.test(page), "the page has the wording box");
const rep = await (await get("/momo/work/anne/report", K)).text();
ok(/Available\?<\/span>yes/.test(rep) && /Dogs allowed\?<\/span>no/.test(rep) && /Furnished as advertised\?<\/span>not confirmed/.test(rep), "register shows the three answers");
ok(cleanAnne({ leads: [{ id: "x", property: "p", available: "bogus" }] }).leads[0].available === "unknown", "bad answer sanitised");

console.log("v644 anne whatsapp: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
