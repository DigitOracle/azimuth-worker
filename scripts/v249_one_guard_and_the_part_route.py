"""One spelling of the tile-part guard, and /skyline/<slug>_p<n> stops answering with an empty viewer.

Both are residuals the Azimuth Rings session raised after deploying v247, and both are in this file.

1. THE GUARD EXISTED IN TWO SPELLINGS: a SKY_PART_KEY helper at one site and an inline /_p\\d+$/ at three others
   (one of them theirs, in the twin_audit route). One rule in two forms is how half of it decays later when someone
   widens the pattern and finds three of the four copies. Collapsed onto a single module-scope helper beside
   TWIN_TILE_PARENT, which the request handlers already read from that scope.

2. /skyline/althanyahfifth_p0 STILL RETURNED A PAGE. v247 stopped the parts being listed, counted and linked, which
   closed every path a client could reach them by - but the route itself still answered, titled "althanyahfifthp0",
   onto a viewer with no district. Rings left it deliberately because refusing unknown slugs at the route is a
   different change with its own blast radius. It is, and this does not do that: a district whose tile has not been
   built yet must keep its honest "no 3D massing for this community yet" page, and a broad refusal would take that
   away from every district waiting on CityEngine.

   So the guard is narrow to the point of being boring: a slug ending `_p<digits>` is a PART of a district, and the
   thing a person holding that link actually wants is the district. It redirects to the parent, keeping the query so
   a key on the URL survives.

   WHY THE TEST RUNS ON THE RAW PATH. The route sanitises with `replace(/[^a-z0-9]/gi, "")`, which strips the
   underscore - by the time _sk exists, "althanyahfifth_p0" has become "althanyahfifthp0" and the pattern cannot
   match. That is also exactly why the bad page was titled "althanyahfifthp0" rather than with the underscore. A
   guard placed after the sanitiser would have looked correct and done nothing, which is the same failure this
   session has now found four times in a day: the check that reads right and answers a narrower question than the
   one being asked.

  python scripts/v249_one_guard_and_the_part_route.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "index.js")
s = io.open(P, encoding="utf-8").read()

if "skyPartOf" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# 1. one helper, at module scope beside the other twin tables the handlers already read
sub("""const TWIN_TILE_PARENT = { jltnorth: "althanyahfifth", jltsouth: "althanyahfifth" };""",
    """const TWIN_TILE_PARENT = { jltnorth: "althanyahfifth", jltsouth: "althanyahfifth" };
// v247/v249 - a multi-part sky tile stores sky_<slug>_p0..p<n> beside sky_<slug>. Those parts are pieces of one
// district's geometry, never districts: they must not be listed, counted, linked or served as a page. ONE spelling,
// because the same rule in four places is three chances to update only some of them.
const SKY_PART_RE = /_p\\d+$/;
const skyPartOf = (sl) => SKY_PART_RE.test(String(sl || ""));
const skyParentOf = (sl) => String(sl || "").replace(SKY_PART_RE, "");""",
    "helper")

sub("""        // A multi-part tile stores sky_<slug>_p0..p<n> beside sky_<slug>; those parts are pieces of one district's
        // geometry, not districts. Without this every part shows up as a tile you can open onto an empty viewer.
        const SKY_PART_KEY = (sl) => /_p\\d+$/.test(sl);
        // rail: every sky_<slug> GLB in KV, named from the register where it can be""",
    """        // rail: every sky_<slug> GLB in KV, named from the register where it can be""",
    "drop local helper")

sub("""          const _have = new Set(_kl.keys.map(k => k.name.slice(8)).filter(sl => !SKY_PART_KEY(sl)));""",
    """          const _have = new Set(_kl.keys.map(k => k.name.slice(8)).filter(sl => !skyPartOf(sl)));""",
    "rail")

sub("""        try { const _kl2 = await env.MEETINGS.list({ prefix: "img_sky_" }); _sky64 = _kl2.keys.map(k => k.name.slice(8)).filter(sl => !/_p\\d+$/.test(sl)); } catch (e) {}""",
    """        try { const _kl2 = await env.MEETINGS.list({ prefix: "img_sky_" }); _sky64 = _kl2.keys.map(k => k.name.slice(8)).filter(sl => !skyPartOf(sl)); } catch (e) {}""",
    "map sky64")

sub("""      const slugs = new Set(_kl.keys.map(k => k.name.slice(8)).filter(sl => !/_p\\d+$/.test(sl)));   // v247 - a tile part is not a district""",
    """      const slugs = new Set(_kl.keys.map(k => k.name.slice(8)).filter(sl => !skyPartOf(sl)));   // v247 - a tile part is not a district""",
    "whatsapp deep links")

# 2. the route: a part is not a page. Tested on the RAW path, before the sanitiser eats the underscore.
sub("""        let _sk = url.pathname === "/skyline" ? (url.searchParams.get("d") || (_rail[0] && _rail[0].s) || "") : url.pathname.slice(9);
        _sk = _sk.replace(/[^a-z0-9]/gi, "").toLowerCase();""",
    """        let _sk = url.pathname === "/skyline" ? (url.searchParams.get("d") || (_rail[0] && _rail[0].s) || "") : url.pathname.slice(9);
        // A link to a PART of a district is a link to the district. Tested here, on the raw slug, because the
        // sanitiser below strips the underscore - after it, althanyahfifth_p0 is "althanyahfifthp0" and no pattern
        // for a part can match. That is why the bad page was titled without the underscore.
        if (skyPartOf(_sk)) {
          const _q = url.search || "";
          return Response.redirect(url.origin + "/skyline/" + skyParentOf(_sk).replace(/[^a-z0-9]/gi, "").toLowerCase() + _q, 302);
        }
        _sk = _sk.replace(/[^a-z0-9]/gi, "").toLowerCase();""",
    "route")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("one guard, and a tile part is no longer a page:", len(s), "chars")
