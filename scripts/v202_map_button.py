"""A button on the map's building card that opens the new building page in its own window (Kendall, 21 Sep 2026:
"i want to be able to get to the new interface we built from here as well, build in a button, that brings up another window").

The card is built by a string of CLIENT javascript inside index.js, so the insert has to be written in that string's own
escaping - backslash-quote - or it closes the server string and the names (twinI, slug, KEY) get evaluated here, where they do
not exist. node --check does not catch that; the map page would throw at runtime.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "index.js")
s = io.open(P, encoding="utf-8").read()

Q = chr(92) + "'"                      # backslash-quote, as the client string writes a quote
MARK = "on the twin " + chr(92) + "u2192</a></div>"
assert s.count(MARK) == 1, "the map card's twin link moved: %d" % s.count(MARK)

BTN = ("on the twin " + chr(92) + "u2192</a>" + Q +
       "+(twinI!=null?" + Q + " &nbsp;<a target=_blank rel=noopener href=" + chr(34) + "/building/" + Q +
       "+encodeURIComponent(slug)+" + Q + "/" + Q + "+twinI+" + Q + "?key=" + Q +
       "+encodeURIComponent(KEY)+(window.__RKQ||" + chr(34) + chr(34) + ")+" + Q + chr(34) + ">the building page " +
       chr(92) + "u2197</a>" + Q + ":" + Q + Q + ")+" + Q + "</div>")

s = s.replace(MARK, BTN)
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("map card button added, client-side")
