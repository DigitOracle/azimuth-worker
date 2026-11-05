// v785: the shared Thailand trip card - one record for Kendall's and Najjuko's keys, nobody else; saves are logged with who; passport numbers refused.
import { tripRoute, TRIP_SECTIONS, emptyTrip } from "../src/trip_card.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("ok", m); };
const store = {};
const env = { MEETINGS: { get: async (k, t) => { const v = store[k]; if (v == null) return null; if (t === "json") return JSON.parse(v); if (t === "arrayBuffer") return v; return v; }, put: async (k, v) => { store[k] = v; }, delete: async (k) => { delete store[k]; } } };
const mk = (who) => ({ page: (k, r, b) => "<html>" + b + "</html>", person: () => who });
const call = async (who, path, method, body, headers) => { const u = new URL("https://x" + path + (path.includes("?") ? "&" : "?") + "key=k"); const r = await tripRoute(new Request(u, { method: method || "GET", body, headers: headers || (body ? { "Content-Type": "application/json" } : {}) }), env, u, mk(who)); return r; };
const json = async (r) => JSON.parse(await r.text());

// page + script parse
const page = await (await call("kendall", "/momo/work/trip")).text();
const scr = (page.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";
let parsed = true; try { new Function(scr); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed, "the trip page script parses");
ok(page.includes("Thailand") && page.includes("Tech Horizons 2030"), "page titled Thailand · Tech Horizons 2030");

// seed
const d0 = await json(await call("najjuko", "/momo/work/trip/data"));
ok(d0.trip.conference.includes("Tech Horizons 2030") && d0.trip.event.start === "2026-12-03" && d0.trip.event.end === "2026-12-04", "seed: conference and dates 3-4 Dec");
ok(d0.trip.items.presentations.length === 2 && d0.trip.items.presentations[0].presenter === "Kendall" && d0.trip.items.presentations[1].presenter === "Najjuko", "seed: Kendall keynote + Najjuko panel");
ok(d0.trip.items.people.some((p) => p.contact === "sanam@konceptconference.com"), "seed: organiser contacts");

// others refused
ok((await call("anne", "/momo/work/trip/data")).status === 404, "another key is refused");
ok((await call("", "/momo/work/trip")).status === 404, "no key is refused");

// Kendall adds a flight, Najjuko sees it, log says who
let r = await json(await call("kendall", "/momo/work/trip/api", "POST", JSON.stringify({ action: "add", section: "flights", item: { traveller: "Kendall", airline: "Emirates", flight_no: "EK378", from: "DXB", to: "HKT", dep_date: "2026-12-02", dep_time: "09:40", dep_tz: "Dubai (GST)" } })));
ok(r.ok && r.trip.items.flights.length === 1, "Kendall adds a flight");
const d1 = await json(await call("najjuko", "/momo/work/trip/data"));
ok(d1.trip.items.flights.length === 1 && d1.trip.items.flights[0].flight_no === "EK378", "Najjuko sees the same flight (shared record)");
ok(d1.trip.log[0].who === "Kendall" && /Flights/.test(d1.trip.log[0].what), "the change is logged with who", d1.trip.log[0]);
const fid = d1.trip.items.flights[0].id;
r = await json(await call("najjuko", "/momo/work/trip/api", "POST", JSON.stringify({ action: "edit", section: "flights", id: fid, item: Object.assign({}, d1.trip.items.flights[0], { seat: "23A" }) })));
ok(r.ok && r.trip.items.flights[0].seat === "23A" && r.trip.log[0].who === "Najjuko", "Najjuko edits it, logged as Najjuko");

// checklist tick, budget, delete
r = await json(await call("najjuko", "/momo/work/trip/api", "POST", JSON.stringify({ action: "add", section: "checklist", item: { what: "Visa on arrival check", who: "Both" } })));
const cid = r.trip.items.checklist[0].id;
r = await json(await call("kendall", "/momo/work/trip/api", "POST", JSON.stringify({ action: "tick", id: cid, done: true })));
ok(r.ok && r.trip.items.checklist[0].done === true, "checklist tick saves");
r = await json(await call("kendall", "/momo/work/trip/api", "POST", JSON.stringify({ action: "add", section: "budget", item: { item: "Hotel", amount: "3,200", currency: "AED", paid_by: "Company" } })));
ok(r.ok && r.trip.items.budget[0].amount === 3200, "budget amount parsed");

// passports: no numbers
r = await json(await call("kendall", "/momo/work/trip/api", "POST", JSON.stringify({ action: "add", section: "documents", item: { kind: "Passport (valid until only)", who: "Kendall", valid_until: "2031-05-01", notes: "number A36851870" } })));
ok(!r.ok && /passport number/i.test(r.error), "a passport number is refused", r);
ok(!TRIP_SECTIONS.find((s) => s.id === "documents").fields.some((f) => /number/i.test(f[0])), "documents have no passport-number field");

// upload a file to the flight, then fetch it
const up = await json(await call("kendall", "/momo/work/trip/upload?section=flights&id=" + fid + "&name=eticket.pdf", "POST", new Uint8Array([37, 80, 68, 70]), { "Content-Type": "application/pdf" }));
ok(up.ok && up.trip.items.flights[0].file && up.trip.items.flights[0].file.name === "eticket.pdf", "e-ticket attaches to the flight");
const fr = await call("najjuko", "/momo/work/trip/file?f=" + up.trip.items.flights[0].file.id);
ok(fr.status === 200 && fr.headers.get("Content-Type") === "application/pdf", "Najjuko can open the attached file");
const pp = await json(await call("kendall", "/momo/work/trip/upload?section=documents&id=x&name=passport.jpg", "POST", new Uint8Array([1]), { "Content-Type": "image/jpeg" }));
ok(!pp.ok, "passport scans are not stored");

ok(emptyTrip().items.checklist.length === 0, "seed leaves the checklist empty");
process.exit(fail ? 1 : 0);
