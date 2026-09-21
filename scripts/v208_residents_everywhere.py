"""The residents key rides every tab, so the ethnicities page is one tap away from anywhere in the app.

Kendall, 21 Sep 2026: "We had built a full page out for ethnicities ... we kind of locked it out a bit. She's trying to get to
it now and can't find it." Then, when told the key was pinned to the MAP, RESIDENTS and TWIN tabs on purpose and that three
tests held that line: "So remove it, it's okay to be on every single thing. We can't have like two different versions of this
running around. Myself and Naj are the only two people that use this."

That reverses v152.2 (15 Sep 2026), which kept the key off FIND, HOMES, PULSE, PLANS, CHARTS, BOARD and TIME. The reasoning
then was that a private key should touch as few pages as possible; the reasoning now is that the app has exactly two users, and
a control that disappears when you tap the wrong room is worse than the exposure. The owner's call, and the tests move with it
rather than being deleted, so the next reader sees the decision and its date.

What does NOT change: rk is still only honoured when it matches RESIDENTS_KEY exactly (residentsKeyOf), a client key or
READ_KEY passed as rk is still 404, and a session that never had the key still sees nothing anywhere.

Worth Kendall knowing: the key now appears in the address bar in every room, so anything recorded or screen-shared from the
app carries it. The standing rule about keys on camera now applies to every page, not just three.

  python scripts/v208_residents_everywhere.py
"""
import io, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sub(s, old, new):
    assert s.count(old) == 1, old[:100]
    return s.replace(old, new)


P = os.path.join(HERE, "src", "index.js")
s = io.open(P, encoding="utf-8").read()
s = sub(s, """const najNav = (key, active, rk) => {   // v152.2 - rk: a private page carries the residents key on its MAP and TWIN tabs only, never to the other rooms""",
        """const najNav = (key, active, rk) => {   // v208 (Kendall, 21 Sep 2026) - rk rides EVERY tab: pinned to MAP and TWIN it vanished the moment Naj tapped another room, and this app has two users""")
s = sub(s, """(rk && (i[0] === "map" || i[0] === "twin") ? '&rk=' + encodeURIComponent(rk) : '')""",
        """(rk ? '&rk=' + encodeURIComponent(rk) : '')""")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("index.js:", len(s), "chars")

# --- the tests move with the decision ---------------------------------------------------------------------------------------
Q = os.path.join(HERE, "test", "test_v152_2_stack.mjs")
t = io.open(Q, encoding="utf-8").read()
t = sub(t, """ok(nav.length === 11 && nav.filter(h => h.includes("rk=")).map(h => h.split("?")[0]).sort().join() === "/map,/residents,/skyline" && nav.filter(h => h.includes("rk=")).every(h => h.includes("rk=" + encodeURIComponent(RES))) && nav.indexOf("/residents?rk=" + encodeURIComponent(RES)) === nav.findIndex(h => h.startsWith("/map")) + 1, "MAP private: the key rides on the MAP, RESIDENTS (right after MAP) and TWIN tabs only, never to FIND, HOMES, PULSE, PLANS, CHARTS, BOARD or TIME");""",
        """// v208 (Kendall, 21 Sep 2026): reverses v152.2. The key rides EVERY tab, because pinned to three it disappeared the
// moment Naj tapped a fourth. Still every link, still only ever the real residents key, and RESIDENTS still sits after MAP.
ok(nav.length === 11 && nav.filter(h => h.includes("rk=")).length === nav.length
  && nav.every(h => h.includes("rk=" + encodeURIComponent(RES)))
  && nav.indexOf("/residents?rk=" + encodeURIComponent(RES)) === nav.findIndex(h => h.startsWith("/map")) + 1,
  "MAP private: the residents key rides every tab, and RESIDENTS sits right after MAP");""")
t = sub(t, """ok(r.status === 200 && r.headers.get("Referrer-Policy") === "strict-origin-when-cross-origin" && pr.includes("window.__RKQ=") && nv.filter(h => h.includes("rk=")).map(h => h.split("?")[0]).sort().join() === "/map,/residents,/skyline", label + ", private link: origin-only referrer, and the key rides on the MAP, RESIDENTS and TWIN tabs only");""",
        """ok(r.status === 200 && r.headers.get("Referrer-Policy") === "strict-origin-when-cross-origin" && pr.includes("window.__RKQ=")
    && nv.length > 3 && nv.every(h => h.includes("rk=")), label + ", private link: origin-only referrer, and the key rides every tab (v208)");""")
io.open(Q, "w", encoding="utf-8", newline="").write(t)
print("test_v152_2_stack.mjs:", len(t), "chars")
