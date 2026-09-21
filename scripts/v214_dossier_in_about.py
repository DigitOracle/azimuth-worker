"""The dossier comes off About the building, which is where Kendall looks for it.

"I still don't see the button for the detailed PDF" - on Aykon City tower B, which HAS a dossier, on a page that WAS serving
the button. It was in the filter panel under "The plans", on the right, below the fold; he was in the About the building card,
which is where he said the dossier comes from in the first place.

So the card gets it, at the top, where the building's name is - the one place you are certainly looking when you want the
document about that building. The filter panel keeps its copy, because that is where someone working through floors will
reach for it.

No gate change: Azimuth Rings' v212 already opens b_* dossiers to a client key, and the worker only offers the button when a
dossier actually exists, so it can never point at a 404.

  python scripts/v214_dossier_in_about.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

OLD = """    open_('<div class=t>' + esc(D.district) + "</div><h2>" + esc(D.name) + "</h2>" +
      (D.grade ? '<span class="pill n">' + esc(String(D.grade).toLowerCase().replace(/_/g, " ")) + "</span>" : "") +"""
NEW = """    open_('<div class=t>' + esc(D.district) + "</div><h2>" + esc(D.name) + "</h2>" +
      (D.grade ? '<span class="pill n">' + esc(String(D.grade).toLowerCase().replace(/_/g, " ")) + "</span>" : "") +
      // the whole building as one document, to keep or to send: at the top of the card about this building
      (D.dossier ? '<a class=dossier target=_blank rel=noopener href="/sheet/' + esc(D.dossier.slug) + ".pdf?key=" + K +
        '"><b>The dossier</b><span>everything on this page as a PDF' + (D.dossier.pages ? " \\u00b7 " + D.dossier.pages + " pages" : "") +
        "</span></a>" : "") +"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

OLD2 = """#dossbtn{display:block;"""
NEW2 = """.dossier{display:flex;align-items:baseline;gap:8px;margin:10px 0 2px;padding:9px 12px;border:1px solid var(--gold);
border-radius:10px;background:rgba(197,165,106,.12);text-decoration:none;color:var(--gold)}
.dossier:hover{background:rgba(197,165,106,.22)}
.dossier b{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase}
.dossier span{font:400 .56rem 'IBM Plex Mono',monospace;color:var(--mut)}
#dossbtn{display:block;"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("dossier on the About card:", len(s), "chars")
