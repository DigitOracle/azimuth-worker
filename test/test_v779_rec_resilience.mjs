// v779 / v779a: a recording is not finished while the phone owes parts (6 h window); an added audio file becomes the next part and closes the gap
import { workRoute, recExpected, recOwed } from "../src/work_log.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, JSON.stringify(x)); } else console.log("ok", m); };
const store = {}, put = (k, v) => { store[k] = typeof v === "string" ? v : JSON.stringify(v); };
const ID = "20261105testabcd";
put("recw_" + ID, { id: ID, date: "2026-11-05", title: "", started: "2026-11-05T09:01:38Z", status: "recording", secs: 0, attendees: [{ n: "Vishant Singh" }],
  log: ["300s part 1 ended: 1281431 bytes, 300s", "1153s part 3 ended: 1080883 bytes, 253s"] });
put("recs_" + ID + "_000", { n: 0, secs: 300, text: "hello part zero" }); put("recs_" + ID + "_001", { n: 1, secs: 300, text: "hello part one" });
const env = { INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd", MEETINGS: { get: async (k, t) => store[k] ?? null, put: async (k, v) => { store[k] = typeof v === "string" ? v : JSON.stringify(v); }, delete: async (k) => { delete store[k]; },
  list: async ({ prefix }) => ({ keys: Object.keys(store).filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) } };
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b };
const api = async (b) => { const u = new URL("https://x/momo/work/rec/api?key=ins_najjuko_TESTKEY0123456789abcd"); const r = await workRoute(new Request(u, { method: "POST", body: JSON.stringify(b) }), env, u, deps); return [r.status, await r.json()]; };
const m0 = JSON.parse(store["recw_" + ID]);
ok(recExpected(m0) === 4, "expected parts read from the phone log (4)");
ok(recOwed(m0, [{ n: 0, secs: 300 }, { n: 1, secs: 300 }], Date.parse("2026-11-05T10:30:00Z")).waiting === true, "owes 2 parts, inside 6 h: waiting");
ok(recOwed(m0, [{ n: 0, secs: 300 }, { n: 1, secs: 300 }], Date.parse("2026-11-05T17:00:00Z")).waiting === false, "after 6 h: no longer waiting");
let [st, j] = await api({ action: "finish", id: ID, secs: 1153 });
ok(st === 409 && j.waiting && j.owed === 2, "Finish refused while 2 parts are owed", j);
[st, j] = await api({ action: "addfile_slot", id: ID });
ok(j.ok && j.n === 2, "an added file becomes part 2", j);
put("recs_" + ID + "_002", { n: 2, secs: 553, text: "the last ten minutes" });   // what rec/chunk stores once the file is read
[st, j] = await api({ action: "addfile_done", id: ID, n: 2, secs: 553, name: "Vishant end.m4a" });
const m1 = JSON.parse(store["recw_" + ID]);
ok(j.ok && j.parts === 3 && m1.status === "transcribed" && m1.added_files.length === 1 && !m1.parts_missing, "file added: finished from 3 parts, nothing owed", { j, m1 });
[st, j] = await api({ action: "addfile_done", id: ID, n: 9 });
ok(st === 409, "a file that never arrived is refused");
process.exit(fail ? 1 : 0);
