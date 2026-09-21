"""What has sold here, the Makani address, and the plot's permit (DDA session's cuts, 20 Sep 2026).

The transaction register carries no property id at all - only a building name - so these sales are bound by the same strict rule
the rents use, on this building's own name and nothing else, and the card says they are the sales registered against that NAME.
The permit is the PLOT's, because DM permits key on parcel and never on a building, and on a shared plot it may be a neighbour's.
The Makani is exact: it is bound to our own footprint id.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


sub("    rent: r.rent || null, project: r.project || null, land: r.land || null, districtLand: stack.district_land || null,",
    "    rent: r.rent || null, project: r.project || null, land: r.land || null, districtLand: stack.district_land || null,\n"
    "    sold: r.sales || null, makani: r.makani || null, permit: r.permit || null,")

# the Makani address sits with the facts, where the location already is
sub('''  if (a.lat && a.lon) facts.push(["Location", a.lat.toFixed(4) + " N " + a.lon.toFixed(4) + " E" + (a.cluster ? " · " + a.cluster : "")]);''',
    '''  if (a.lat && a.lon) facts.push(["Location", a.lat.toFixed(4) + " N " + a.lon.toFixed(4) + " E" + (a.cluster ? " · " + a.cluster : "")]);
  if (r.makani && r.makani.makani) facts.push(["Makani", String(r.makani.makani).replace(/(\\d{4})(\\d{5})/, "$1 $2") +
    (r.makani.dist_m ? " · entrance " + Math.round(r.makani.dist_m) + " m from the footprint" : "")]);''')

# what has actually sold, under the register's own name
sub('''      (D.rent ? "<h3>What it lets for</h3>" ''',
    '''      (D.sold ? "<h3>What has sold here</h3>" +
        '<div class=row><span>Registered sales</span><span>' + fmt(D.sold.n) + (D.sold.first ? " since " + esc(D.sold.first.slice(0, 4)) : "") + "</span></div>" +
        (D.sold.psf ? '<div class=row><span>Median</span><span>AED ' + fmt(D.sold.psf) + " per sq ft</span></div>" : "") +
        '<div class=row><span>Off-plan</span><span>' + D.sold.offplan_pct + "% of them</span></div>" +
        (D.sold.recent || []).map((x) => '<div class=row><span>' + esc(x.date) + " · " + esc(x.rooms || "") +
          (x.sqft ? "<br><small>" + fmt(x.sqft) + " sq ft · " + (x.offplan ? "off-plan" : "ready") + "</small>" : "") +
          "</span><span>" + (x.price ? aed(x.price) : "") + "</span></div>").join("") +
        '<div class=src>Dubai Land Department transactions registered against the name ' + esc(D.sold.name) +
        ". The transaction register carries no building id, only a name, so these are that name's sales rather than provably this footprint's. Settled prices, not asking.</div>" : "") +
      (D.rent ? "<h3>What it lets for</h3>" ''')

# the plot's permit, inside the construction section
sub('''        '<div class=src>Dubai Land Department project register, joined by project id, not by name.''',
    '''        (D.permit ? '<div class=row><span>' + esc(D.permit.type || "Permit") + "<br><small>the plot's permit" +
          (D.permit.new_on_plot > 1 ? ", " + D.permit.new_on_plot + " new-building permits on this plot" : "") + "</small></span><span>" +
          esc(D.permit.date || "") + (D.permit.status ? "<br><small>" + esc(D.permit.status) + "</small>" : "") + "</span></div>" : "") +
        '<div class=src>Dubai Land Department project register, joined by project id, not by name. The permit is Dubai Municipality\\u2019s and keys on the PLOT, not the building, so on a shared plot it may belong to a neighbour.''')

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("v197 page sections in:", len(s), "chars")
