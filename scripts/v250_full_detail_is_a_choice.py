"""v248 assumed a parts index meant "someone chose this district for film". Fourteen districts later that is false.

**DO NOT SHIP v248 WITHOUT THIS.** v248 reads skyparts_<slug> wherever it exists and loads every part. When it was
written, Al Thanyah Fifth was the only district with an index and the reasoning was explicit: "the index's existence
is the opt-in - there is no separate list here to drift out of step with theirs." That held while parts meant a
district someone had picked for filming.

The CityEngine session has now published 14. Measured on the wire, 24 Sep 2026:

    businessbay              7 parts   654 bldgs   32.1 MB        liwan1                3   1,827   13.7 MB
    althanyahfifth           7       3,548        29.2 MB        alwasl                3   3,046   13.5 MB
    palmjumeirah             5       2,482        20.6 MB        meydanone             3   3,364   13.5 MB
    jumeirahvillagecircle    5       1,524        19.0 MB        bukadra               3     671   10.8 MB
    jltsouth                 4       3,576        18.4 MB        samaaljadaf           3   1,110    9.8 MB
    burjkhalifa              4         298        18.4 MB        alkhairanfirst        2     218    6.6 MB
    jabalalifirst            4       2,635        17.8 MB
    siliconoasis             4       2,284        15.5 MB        TOTAL  57 parts, 238.9 MB

So v248 as it stands would turn a third of the estate from a ~1.4 MB skyline into a 6.6-32.1 MB one, silently, for
every reader who opens it - including on a phone on hotel wifi. Business Bay alone is 32 MB for 654 buildings, more
than Al Thanyah Fifth's 3,548, because those towers carry that much facade.

The fault is mine and it is a specific kind: I read a signal correctly and then assumed it would keep meaning the
same thing. It did not, and it stopped meaning it within a day, without anyone doing anything wrong - the CityEngine
session published more districts, which is exactly what they should do.

SO THE DETAIL BECOMES A CHOICE RATHER THAN A DEFAULT:

  * the flat tile loads first, always, unless the parts are small enough to be free (AUTO_MB, 8 MB). The page is never
    slower than it is today.
  * where an index exists, a control says what the full model costs - "Full detail: 7 parts, 32 MB" - and loading it
    is a click. No size is hidden behind the word "detail".
  * that click goes to ?full=1, which takes the parts path from the start. It does NOT swap geometry into a live
    scene: the merged-once design exists because the loader frames the camera, sizes the ground and fits the shadow
    frustum from the complete bounding box, and re-running that against a scene being rebuilt underneath is the
    lurch v248 was written to avoid.
  * Save-Data and 2g still force flat, and now the offer they get is the same control everyone else sees.

WHAT THIS GIVES UP, honestly: a reader who would have been happy with the detail now has to ask for it. That is the
right way round. A page that spends 32 MB of someone's connection without asking cannot be undone by them; a page
that asks costs one click.

  python scripts/v250_full_detail_is_a_choice.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "index.js")
s = io.open(P, encoding="utf-8").read()

if "AUTO_MB" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


sub("""  const _q=new URLSearchParams(location.search);
  const _con=navigator.connection||{};
  const _slow=!!(_con.saveData||/^(slow-)?2g$/.test(_con.effectiveType||""));
  if(_q.get("flat")==="1"){_flatSky(null)}
  else fetch("/img/skyparts_${slugName}").then(r=>r.ok?r.json():null).then(ix=>{
    const items=(ix&&ix.items)||[];
    if(!items.length){_flatSky(null);return}
    const mb=items.reduce((t,i)=>t+(i.gz||0),0)/1e6;
    // A page that quietly spends 28 MB of someone's connection, or quietly withholds the detail, are both worse than
    // saying which one it did and offering the other.
    if(_slow&&_q.get("full")!=="1"){_flatSky('Showing the lighter model — this district\\'s full detail is '+mb.toFixed(0)+' MB. <a href="?'+(_q.toString()?_q.toString()+"&":"")+'full=1" style="color:#C5A56A">Load it anyway</a>');return}""",
    """  const _q=new URLSearchParams(location.search);
  const _con=navigator.connection||{};
  const _slow=!!(_con.saveData||/^(slow-)?2g$/.test(_con.effectiveType||""));
  const AUTO_MB=8;   // below this the detail is free enough to take without asking; above it, it is the reader's call
  const _offer=(mb,n)=>{const a=document.createElement("a");
    const q=new URLSearchParams(location.search);q.set("full","1");a.href="?"+q.toString();
    a.style.cssText="position:absolute;right:12px;bottom:12px;z-index:9;background:rgba(20,26,24,.9);color:#C5A56A;padding:7px 11px;border-radius:6px;font:12px system-ui;text-decoration:none;border:1px solid rgba(197,165,106,.35)";
    a.textContent="Full detail: "+n+" parts, "+mb.toFixed(0)+" MB";document.body.appendChild(a)};
  if(_q.get("flat")==="1"){_flatSky(null)}
  else fetch("/img/skyparts_${slugName}").then(r=>r.ok?r.json():null).then(ix=>{
    const items=(ix&&ix.items)||[];
    if(!items.length){_flatSky(null);return}
    const mb=items.reduce((t,i)=>t+(i.gz||0),0)/1e6;
    // v250: an index used to mean "a district someone picked for film". At 14 districts it does not, so the size
    // decides and the reader is told what it is. 32 MB spent without asking cannot be undone by them; asking costs a click.
    if(_q.get("full")!=="1"&&(_slow||mb>AUTO_MB)){_flatSky(null);_offer(mb,items.length);return}""",
    "dispatch")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("full detail is a choice:", len(s), "chars")
