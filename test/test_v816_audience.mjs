// v816 - "Who gets this" and Contacts for campaigns (Kendall 8 Nov): owner only, rows in queue order with masked numbers and why, totals, CSV,
// delivery status once live; Contacts filter by tag, import, opt-out flag, soft remove. Through the REAL worker; FAKE keys and numbers; no network.
const worker = (await import("../src/index.js")).default;
const C = await import("../src/campaigns.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
  put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN].join(","), WA_DESK_PHONE_ID: "100000000000001", WA_PHONE_ID: "100000000000002", WHATSAPP_TOKEN: "TEST_TOKEN", PUBLIC_ORIGIN: "https://w" };
const ctx = { waitUntil() {}, passThroughOnException() {} };
globalThis.fetch = async (u) => { throw new Error("network blocked in test: " + String(u && u.url || u)); };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), env, ctx);
const post = (path, key, body) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, ctx);
const put = (k, v) => store.set(k, JSON.stringify(v));
const consent = (d) => ({ text: "Yes, I agree to WhatsApp messages", date: "2026-10-20", by: "Big5 QR", import_id: "imp1" });
const people = [["971500000101", "Owner One", ["pja"], consent()], ["971500000102", "Owner Two", ["pja", "pilot"], consent()], ["971500000103", "Owner Three", ["pja"], null], ["971500000104", "Owner Four", ["pja"], consent()], ["971500000105", "Owner Five", ["other"], consent()]];
for (const [d, name, tags, cs] of people) put("camp_contact_" + d, { e164: "+" + d, name, tags, source: "Big5 QR", consent: cs, added: "2026-10-20" });
put("camp_contact_index", people.map((p) => p[0]));
const s4 = JSON.parse(store.get("camp_contact_971500000104")); s4.opted_out = true; put("camp_contact_971500000104", s4);
put("camp_imports", [{ id: "imp1", at: "2026-10-20T08:00:00Z", accepted: 5 }]);
put("camp_index", ["c1"]);
put("camp_c1", { id: "c1", name: "PJA owners", status: "draft", tags: ["pja"], template: "t", vars: [], cap: 50, window: "10:00-17:30", owner_tz: false, freq_days: 7 });

// owner only
ok((await get("/momo/campaigns/audience?c=c1", NAJ)).status === 404, "Najjuko's key does not open Who gets this (owner only)");
ok((await get("/momo/campaigns/contacts", NAJ)).status === 404, "nor Contacts");
let r = await get("/momo/campaigns/audience?c=c1", KEN), h = await r.text();
ok(r.status === 200 && h.includes("Who gets this") && h.includes("&#8592; Campaign") && h.includes(">Home<"), "the owner sees it, with Back and Home");
const rows = (await C.audienceRows(env, JSON.parse(store.get("camp_c1")), Date.now())).rows;
ok(rows.map((x) => x.name).join() === "Owner One,Owner Two,Owner Three,Owner Four", "queue order first, then the tagged ones it leaves out; untagged not listed");
ok(rows[0].why === "ok" && rows[2].why === "no_consent" && rows[3].why === "opted_out", "why each is in or out");
ok(h.includes("+971 ••• 0101") && !h.includes(">+971500000101<") && h.includes("data-full='+971500000101'") && h.includes(">show</button>"), "numbers masked to the last 4 digits; the owner can show them");
ok(h.includes("Consent 2026-10-20 · Big5 QR") && h.includes("No consent on file") && h.includes("Opted out"), "consent date and source; reasons shown");
ok(/<b>4<\/b><i>In the audience<\/i>/.test(h) && /<b>2<\/b><i>Will receive it<\/i>/.test(h) && /<b>2<\/b><i>Left out<\/i>/.test(h), "totals at the top");
// frequency rule and already sent
const s2 = JSON.parse(store.get("camp_contact_971500000102")); s2.last_mkt = new Date(Date.now() - 2 * 864e5).toISOString(); put("camp_contact_971500000102", s2);
ok((await C.audienceRows(env, JSON.parse(store.get("camp_c1")), Date.now())).rows[1].why === "messaged_this_week", "frequency rule");
// CSV
r = await get("/momo/campaigns/audience?c=c1&csv=1", KEN); const csv = await r.text();
ok(/text\/csv/.test(r.headers.get("Content-Type")) && csv.split("\n")[0].startsWith("name,company,number") && csv.includes("+971 ••• 0101") && !csv.includes("+971500000101"), "CSV export, masked by default");
ok((await (await get("/momo/campaigns/audience?c=c1&csv=1&full=1", KEN)).text()).includes("+971500000101"), "full numbers only when asked");
// live: statuses from camp_msgs / camp_msg / camp_status
const c1 = JSON.parse(store.get("camp_c1")); c1.status = "live"; put("camp_c1", c1);
put("camp_msgs_c1", ["w1"]); put("camp_msg_w1", { cid: "c1", d: "971500000101", st: "sent", replied: true }); put("camp_status_w1", { sent: 1, delivered: 2, read: 3 });
const s2b = JSON.parse(store.get("camp_contact_971500000102")); delete s2b.last_mkt; put("camp_contact_971500000102", s2b);
h = await (await get("/momo/campaigns/audience?c=c1", KEN)).text();
const lr = (await C.audienceRows(env, c1, Date.now())).rows;
ok(lr[0].status === "replied" && lr[0].why === "already_sent" && lr[1].status === "queued", "once live: replied / queued per row");
ok(h.includes("chp st'>replied") && h.includes("chp st'>queued") && /Sent so far/.test(h), "statuses on the page");
// the campaign card links (owner)
h = await (await get("/momo/campaigns?c=c1", KEN)).text();
ok(h.includes("id=aud_link") && h.includes("/momo/campaigns/contacts"), "the campaign card has Who gets this and Contacts");
ok(!(await (await get("/momo/campaigns?c=c1", NAJ)).text()).includes("id=aud_link"), "not for Najjuko's key");
// Contacts: filter, import, opt-out flag, soft remove + restore; the sender skips a removed contact
h = await (await get("/momo/campaigns/contacts", KEN)).text();
ok(h.includes("Owner Five") && h.includes("import 2026-10-20") && h.includes("chp no'>Opted out") && h.includes("pja (4)"), "all contacts, the import, the opt-out flag, tag counts");
h = await (await get("/momo/campaigns/contacts?tag=other", KEN)).text();
ok(h.includes("Owner Five") && !h.includes("Owner One"), "filter by tag");
ok((await (await post("/momo/campaigns/api", NAJ, { action: "contact_remove", d: "971500000102" })).json()).ok === false, "remove is owner only");
r = await (await post("/momo/campaigns/api", KEN, { action: "contact_remove", d: "971500000102" })).json();
ok(r.ok && store.has("camp_contact_971500000102") && JSON.parse(store.get("camp_contact_971500000102")).removed, "soft remove: the record stays");
ok(!(await C.audienceRows(env, c1, Date.now())).rows.find((x) => x.name === "Owner Two").in_queue, "a removed contact is not queued");
ok((await (await get("/momo/campaigns/contacts", KEN)).text()).includes("Removed (1)"), "shown under Removed");
r = await (await post("/momo/campaigns/api", KEN, { action: "contact_restore", d: "971500000102" })).json();
ok(r.ok && !JSON.parse(store.get("camp_contact_971500000102")).removed, "restore");
console.log("test_v816_audience: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
