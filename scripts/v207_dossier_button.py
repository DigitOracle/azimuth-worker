"""The building page can hand you the building's dossier (Kendall, 21 Sep 2026, on Prive by DAMAC: "should I be able to pull a
PDF from that ... a more comprehensive PDF that we can capture everything about the building, and send to an individual").

naj-market-pulse/scripts/build_building_dossier.py builds it and pushes it up the sheet rail as b_<district>_<id>, so the file
already has a home, a preview route and the WhatsApp send Naj uses for the three-page sheets. What was missing was the way in
from the building itself.

The button is OWNER ONLY, and deliberately: the sheet rail's rule since v157 is that a client is handed the file, never the
route that lists them. So the worker decides server-side - the request must carry READ_KEY, and the dossier must actually exist
in KV - and a client key simply never sees the button.

  python scripts/v207_dossier_button.py
"""
import io, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sub(s, old, new):
    assert s.count(old) == 1, old[:90]
    return s.replace(old, new)


# --- the worker decides who may see it -------------------------------------------------------------------------------------
P = os.path.join(HERE, "src", "index.js")
s = io.open(P, encoding="utf-8").read()
s = sub(s, """        const _bd = (_st && _um && _bi) ? buildingData(_bs, _bi, _st, _um, _bf, _ac, _pp, _bn, _px, _uu, _pl) : null;
        if (!_bd) return new Response("no register record for this building yet", { status: 404 });""",
        """        const _bd = (_st && _um && _bi) ? buildingData(_bs, _bi, _st, _um, _bf, _ac, _pp, _bn, _px, _uu, _pl) : null;
        if (!_bd) return new Response("no register record for this building yet", { status: 404 });
        // the dossier PDF: hers to pull and forward, so it is offered only to the owner key and only when one has been built
        try {
          const _kk = url.searchParams.get("key") || "";
          if (env.READ_KEY && ctEq(_kk, env.READ_KEY)) {
            const _dm = JSON.parse((await env.MEETINGS.get("sheetm_b_" + _bs + "_" + _bi)) || "null");
            if (_dm && _dm.bytes) _bd.dossier = { slug: "b_" + _bs + "_" + _bi, pages: _dm.pages || 0, at: _dm.built_at || "" };
          }
        } catch (e) {}""")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("index.js:", len(s), "chars")

# --- the button --------------------------------------------------------------------------------------------------------------
Q = os.path.join(HERE, "src", "building_page.js")
t = io.open(Q, encoding="utf-8").read()
# This inserts AFTER an anchor that survives the insert, so a second run appends a second button and a third a third -
# which is exactly what shipped: three "The dossier" buttons on the live page, found by Kendall, not by a test.
if "id=dossbtn" in t:
    print("already applied - nothing to do")
    raise SystemExit(0)
t = sub(t, """      (D.plans ? '<button id=plansbtn>The plans · ' + D.plans.plans.length + "</button>" : "") +""",
        """      (D.plans ? '<button id=plansbtn>The plans · ' + D.plans.plans.length + "</button>" : "") +
      (D.dossier ? '<a id=dossbtn target=_blank rel=noopener href="/sheet/' + esc(D.dossier.slug) + ".pdf?key=" + K +
        '">The dossier · PDF' + (D.dossier.pages ? " · " + D.dossier.pages + "pp" : "") + "</a>" : "") +""")
t = sub(t, """#plansbtn:hover{background:rgba(197,165,106,.12)}""",
        """#plansbtn:hover{background:rgba(197,165,106,.12)}
#dossbtn{display:block;text-align:center;border:1px solid var(--gold);border-radius:99px;padding:6px 0;margin-top:6px;
background:rgba(197,165,106,.1);color:var(--gold);text-decoration:none;font:600 .56rem 'IBM Plex Mono',monospace;
letter-spacing:.12em;text-transform:uppercase}#dossbtn:hover{background:rgba(197,165,106,.22)}""")
io.open(Q, "w", encoding="utf-8", newline="").write(t)
print("building_page.js:", len(t), "chars")
