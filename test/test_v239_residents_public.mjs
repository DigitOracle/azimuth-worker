// v239 — RESIDENTS IS FULLY PUBLIC (Kendall, 22 Sep 2026: "i do not want any key, residents is fully public,
// there is only one najma page, period").
//
// v152 put this map behind RESIDENTS_KEY; v235 opened it to any app key; both gates are gone. What is behind it
// is community-level DEWA aggregate — floored at 500 residential accounts and a 5% share, banded, no counts, no
// address, nobody identifiable — and "where do the Egyptians live" is a question a client asks out loud.
//
// THE HAZARD THIS SUITE EXISTS FOR. Making a page public changes what its own markup may contain. The route used
// to build its back-links from clientLinkKey(env), which is safe only while a key-holder is the only visitor:
// that helper falls back to READ_KEY when CLIENT_KEY is unset, so public + fallback = the OWNER key printed into
// a page anyone on the internet can open. A gate removed is a key leak waiting unless the key fallback goes too.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
globalThis.fetch = async () => new Response("{}", { status: 200 });

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "azimuth2_rd_client_key_for_naj_to_forward";
const RESK = "residents_key_twenty_four_plus_chars_long";
const MIX = JSON.stringify({ generated: "2026-09-15", communities: [{ comm: "126", name: "ABU HAIL", mix: [["India", 21]] }] });

const mk = (over) => {
  const store = new Map([["priv_community_resident_mix", MIX]]);
  const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
  return Object.assign({ MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, RESIDENTS_KEY: RESK, PUBLIC_ORIGIN: "https://x" }, over || {});
};
const get = async (p, env) => {
  const r = await worker.fetch(new Request("https://x" + p), env || mk(), { waitUntil() {} });
  return { status: r.status, body: await r.text() };
};

// ---- no key at all ----------------------------------------------------------------------------------------
const page = await get("/residents");
ok(page.status === 200, "/residents opens with NO key at all: " + page.status);
const data = await get("/residents/data");
ok(data.status === 200 && /ABU HAIL/.test(data.body), "/residents/data opens with no key and serves the mix: " + data.status);

// ---- and it does not hand out a key in exchange ---------------------------------------------------------
ok(!page.body.includes(READ), "the anonymous page does NOT contain the owner key");
ok(!page.body.includes(CLIENT), "nor a client key - a public page invents no key for its own links");
ok(!page.body.includes(RESK), "nor the residents key");

// The fallback this replaced: clientLinkKey() returns READ_KEY when no CLIENT_KEY is set. If the route still
// called it, an anonymous visitor to a worker with no client key would be shown the owner key.
const noClient = await get("/residents", mk({ CLIENT_KEY: "" }));
ok(noClient.status === 200, "still public on a worker with no CLIENT_KEY at all: " + noClient.status);
ok(!noClient.body.includes(READ), "and STILL no owner key in it - the clientLinkKey fallback cannot reach the page");

// ---- a visitor who brought a key keeps it -------------------------------------------------------------------
const owner = await get("/residents?key=" + READ);
ok(owner.status === 200, "the owner's own link still opens it: " + owner.status);
const client = await get("/residents?key=" + CLIENT);
ok(client.status === 200 && !client.body.includes(READ), "a client link opens it and carries no owner key: " + client.status);

// ---- the data is what it claims to be ----------------------------------------------------------------------
ok(!/\b(emirates_id|passport|account_no|meter|premise|villa_no|flat_no)\b/i.test(data.body),
  "nothing identifying in what the public route serves");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
