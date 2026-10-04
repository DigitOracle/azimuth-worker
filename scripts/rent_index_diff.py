"""v314 - compare two rent index files (e.g. the live 2-month one and the rebuilt 12-month one): what changes in the figures a client sees.
  python scripts\\rent_index_diff.py <old.json> <new.json>
Prints: records in each / added / dropped; for records in both, per bedroom band with 3+ contracts in both, how the figure the app shows
(median of new lettings where 3+, else all) moves, and how many bands gain a figure (3+ contracts) the old window could not give."""
import json, sys, statistics
old, new = (json.load(open(p, encoding="utf-8")) for p in sys.argv[1:3])
key = lambda it: (it.get("p"), it.get("area"))
O = {key(i): i for i in old["items"]}; N = {key(i): i for i in new["items"]}
print("window old", old.get("window"), "new", new.get("window"))
print("records old", len(O), "new", len(N), "| added", len(set(N) - set(O)), "dropped", len(set(O) - set(N)))
fig = lambda s: s["mn"] if s.get("nn", 0) >= 3 and s.get("mn") else s["m"]
ratios, gained, lost, tot_old, tot_new = [], 0, 0, 0, 0
for k in set(O) & set(N):
    for kind in ("b", "v"):
        for bd in set((O[k].get(kind) or {})) | set((N[k].get(kind) or {})):
            so, sn = (O[k].get(kind) or {}).get(bd), (N[k].get(kind) or {}).get(bd)
            ok_o, ok_n = bool(so and so["n"] >= 3), bool(sn and sn["n"] >= 3)
            tot_old += ok_o; tot_new += ok_n
            if ok_n and not ok_o: gained += 1
            if ok_o and not ok_n: lost += 1
            if ok_o and ok_n: ratios.append(fig(sn) / fig(so))
print("bands with a figure (3+ contracts) in records present in both: old", tot_old, "new", tot_new, "| gained", gained, "lost", lost)
if ratios:
    ratios.sort(); q = lambda p: ratios[int(p * (len(ratios) - 1))]
    print("figure new/old over", len(ratios), "bands: median %.3f  p10 %.3f  p90 %.3f  share within +-10%%: %.0f%%" % (statistics.median(ratios), q(.1), q(.9), 100 * sum(1 for r in ratios if .9 <= r <= 1.1) / len(ratios)))
