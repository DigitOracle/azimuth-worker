"""A multi-part sky tile's parts are not districts, and three enumerations are currently counting them as such.

The CityEngine session shipped multi-key skyline tiles on 24 Sep 2026: a district too large for the 5 MB KV cap is
split into `sky_<slug>_p0 .. p<n>`, indexed by `skyparts_<slug>`. Al Thanyah Fifth is live as seven parts.

Every one of those parts is stored in KV as `img_sky_althanyahfifth_p0` ... `_p6`, and three places in this worker do:

    env.MEETINGS.list({ prefix: "img_sky_" })   ->   k.name.slice(8)   ->   a district slug

so seven fictional districts named `althanyahfifth_p0` through `_p6` are, right now:
  * listed in the /skyline rail as tiles you can open, each rendering an empty viewer with no name and no audit row
  * counted in /map's `_sky64`, the list of which districts have 3D
  * eligible for the WhatsApp "in 3D" deep links, which would send a client a URL to a slug that is not a place

None of that is the CityEngine session's error. The key naming is right - the parts SHOULD live under `sky_` because
they are served by the same /img route with the same encoding. The wrong assumption is here: this worker has always
read "a key under img_sky_" as "a district", and that stopped being true the moment a district needed more than one
key. The enumeration was never given a way to tell a tile from a part of a tile.

The guard is the key shape, not a list of known districts: `_p<digits>` at the end of a sky key is a part, because
that is the pattern `key_pattern: "sky_<slug>_p<n>"` guarantees. No district slug ends that way - checked against all
45 in the estate - and a new district cannot accidentally acquire the shape without someone naming it `..._p3`.

This is a defect fix and nothing more. It does NOT make the page read the parts; a district with parts still shows
its single `sky_<slug>` tile exactly as before, which is what every reader sees today. Wiring the multi-part loader
is separate and deliberately so: this one should be shippable on its own, immediately, because the fictional
districts are live now and will multiply with every district the CityEngine session parts up.

  python scripts/v247_tile_parts_are_not_districts.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "index.js")
s = io.open(P, encoding="utf-8").read()

if "SKY_PART_KEY" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# the shared test, next to the first use so it is findable from any of the three
sub("""        // rail: every sky_<slug> GLB in KV, named from the register where it can be""",
    """        // A multi-part tile stores sky_<slug>_p0..p<n> beside sky_<slug>; those parts are pieces of one district's
        // geometry, not districts. Without this every part shows up as a tile you can open onto an empty viewer.
        const SKY_PART_KEY = (sl) => /_p\\d+$/.test(sl);
        // rail: every sky_<slug> GLB in KV, named from the register where it can be""",
    "helper")

sub("""          const _kl = await env.MEETINGS.list({ prefix: "img_sky_" });
          const _have = new Set(_kl.keys.map(k => k.name.slice(8)));""",
    """          const _kl = await env.MEETINGS.list({ prefix: "img_sky_" });
          const _have = new Set(_kl.keys.map(k => k.name.slice(8)).filter(sl => !SKY_PART_KEY(sl)));""",
    "rail")

sub("""        try { const _kl2 = await env.MEETINGS.list({ prefix: "img_sky_" }); _sky64 = _kl2.keys.map(k => k.name.slice(8)); } catch (e) {}""",
    """        try { const _kl2 = await env.MEETINGS.list({ prefix: "img_sky_" }); _sky64 = _kl2.keys.map(k => k.name.slice(8)).filter(sl => !/_p\\d+$/.test(sl)); } catch (e) {}""",
    "map sky64")

sub("""      const _kl = await env.MEETINGS.list({ prefix: "img_sky_" });                 // same enumeration the /skyline rail uses
      const slugs = new Set(_kl.keys.map(k => k.name.slice(8)));""",
    """      const _kl = await env.MEETINGS.list({ prefix: "img_sky_" });                 // same enumeration the /skyline rail uses
      const slugs = new Set(_kl.keys.map(k => k.name.slice(8)).filter(sl => !/_p\\d+$/.test(sl)));   // v247 - a tile part is not a district""",
    "whatsapp deep links")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("tile parts are no longer counted as districts:", len(s), "chars")
