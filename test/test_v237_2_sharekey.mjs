// v237.2 — THE SHARE KEY, END TO END, ON A BUILDING WITH NO DOSSIER.
//
// Raised in review by two sessions on 22 Sep 2026, and the point was about scope, not logic: the guarantee
// that a handover link never carries the owner key had only ever been verified on DOSSIER pages — 206
// buildings. v237 widened that surface to every building in Dubai, and the verification did not widen with
// it. So this renders a building through the real Worker route, with NO dossier in the store, and checks
// what the page is actually handed.
//
// Two things are pinned:
//   1. The page's shareKey is the CLIENT key, and the owner key appears nowhere in the page.
//   2. clientKeysOf() cannot hand back the owner key even when CLIENT_KEY is misconfigured to contain it.
//      test_v156 proves such a key is refused at the door; this proves it also never becomes the thing a
//      share would carry. Those are different failures: the first locks a client out, the second hands a
//      buyer the owner's key, and only the second is silent.
//
// The fixtures are synthetic and inline on purpose — the real register files only exist on the machine that
// builds the pipeline, and a check that silently skips elsewhere is not a check.
import worker from "../src/index.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";
const SLUG = "businessbay", ID = "6";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const stack = {
  district: SLUG, generated: "2026-09-22", sources: [], levels: {},
  buildings_by_id: { [ID]: { name: "Windsor Manor", basis: "dm_floors", dm: 423650, basements: 2, label: "2B+ G +29 +1R", level_shift: 0, conflict: null, uses: ["homes"], mixed: false, podium: false, labour: false, staff: false, area_sqm: 17010, height_m: 110,
    floors: [{ l: "G", n: null, u: "hotel", k: 9, a: 1304, t: [] }, { l: "1", n: 1, u: "services", k: 0, a: 0, t: [] },
             { l: "5", n: 5, u: "homes", k: 8, a: 1200, t: ["1 bedroom"] }, { l: "6", n: 6, u: "homes", k: 8, a: 1200, t: ["2 bedroom"] }],
    types: [{ t: "1 bedroom", c: "1", units: 164, lo: 5, hi: 14, sqm: 103.5, aed: 1256938, est: false, rent: 80000, yield: 6.4 }],
    total_units: 760, developer: "Windsor Developments" } },
};
const unitmix = {
  district: SLUG, generated: "2026-09-22",
  buildings_by_id: { [ID]: { status: "verified", name: "Windsor Manor", total_units: 760, asset_classes: { residential: 338 }, floors: 37, car_parks: 988, rows: [{ type: "1 bedroom", configuration: "102 m² median", median_sqm: 103.5, levels: "5–14 (9 levels)", units: 164, basis: "DLD units register", median_aed: 1256938 }] } },
};

const mkEnv = (clientKey) => {
  const store = new Map();
  store.set("img_stack_" + SLUG, JSON.stringify(stack));
  store.set("img_unitmix_" + SLUG, JSON.stringify(unitmix));
  const KV = {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
  };
  return { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: clientKey, RESIDENTS_KEY: "residents_key_long_enough_012345", INGEST_TOKEN: "ING" };
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const page = async (clientKey, withKey) => {
  const r = await worker.fetch(new Request("https://x/building/" + SLUG + "/" + ID + "?key=" + withKey), mkEnv(clientKey), { waitUntil() {} });
  return { status: r.status, html: await r.text() };
};

// The route must actually render, or everything below passes vacuously.
const owner = await page(CLIENT, READ);
ok(owner.status === 200 && owner.html.includes("Windsor Manor"), "the building renders through the real route (no dossier in the store)");
ok(!owner.html.includes("sheetm_") && !/"dossier":/.test(owner.html), "this building genuinely has no dossier - the case v237 was written for");

// 1. what a share would carry
const shareKeyOf = (html) => { const m = html.match(/"shareKey"\s*:\s*"([^"]*)"/); return m ? m[1] : null; };
ok(shareKeyOf(owner.html) === CLIENT, "the page is handed the client key as its share key, on a building with no dossier");
// NOT "the owner key is absent from the page": a page Kendall opened legitimately carries his key for its
// own navigation, and asserting otherwise would be asserting a bug. The invariant is narrower and sharper -
// the key a SHARE is built from is never his.
ok(shareKeyOf(owner.html) !== READ, "the share key is not the owner key, on a page the owner opened with his own");

// 2. the misconfiguration that would be silent
const polluted = await page(READ + "," + CLIENT, READ);
ok(shareKeyOf(polluted.html) === CLIENT,
  "CLIENT_KEY containing the owner key: the owner key is filtered out and the real client key is chosen");
ok(shareKeyOf(polluted.html) !== READ, "CLIENT_KEY containing the owner key: it is never what a share would carry");

const onlyOwner = await page(READ, READ);
ok(shareKeyOf(onlyOwner.html) === "",
  "CLIENT_KEY set to nothing but the owner key: no share key at all, rather than the owner's - the row then says sharing needs a client key");

const tooShort = await page("short", READ);
ok(shareKeyOf(tooShort.html) === "", "a CLIENT_KEY under 12 characters is not offered as a share key either");

// 3. and the client's own view stays clean
const asClient = await page(CLIENT, CLIENT);
ok(asClient.status === 200 && !asClient.html.includes(READ), "opened with the client key: still no owner key anywhere");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
