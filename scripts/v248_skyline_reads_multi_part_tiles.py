"""The skyline reads a district's tile in parts, so a district too big for one KV key stops being flat.

The CityEngine session shipped multi-key tiles on 24 Sep 2026. A district over the 5 MB cap is split into
`sky_<slug>_p0 .. p<n>` and indexed by `skyparts_<slug>`; every part is an ordinary per-building GLB with the same
b<i>_<class>_s<status> node names, and a building is never split across two parts. Al Thanyah Fifth is live as seven
parts, 3,548 buildings, 27.8 MB of LOD 3 geometry against the 1.35 MB flat tile it stands beside.

Kendall, on why any of this exists: "our visuals could be a lot, lot better." A district that did not fit in one key
has been showing a decimated tile - that is the flatness, and it was a storage limit rather than a modelling one.

HOW THIS LOADS THEM, and the shape is chosen for safety rather than speed. The existing onLoad callback does a great
deal of one-time setup from the COMPLETE bounding box: it centres the model, sizes the ground disc, frames the camera
on the tallest cluster, sets fog near/far, fits the sun's shadow frustum, counts buildings per status for the filter
chips and decides whether to build the bloom composer at all. Mounting parts one by one into a half-built world would
mean re-running all of that on every arrival, and getting the order wrong shows up as a camera that lurches or a
shadow frustum that clips the district it was fitted to.

So the parts are fetched, merged into one Group, and handed to the SAME callback, unchanged, exactly once. The
single-key path is untouched and is still what every district without an index does. Nothing renders until the last
part lands, which is the honest trade: a correct scene 20 seconds in beats a lurching one at 3.

WHAT IT COSTS THE READER, said out loud because it is not small. Al Thanyah Fifth is 27.8 MB gzipped against 1.35 MB,
about a twentyfold increase, and roughly 2 s per part on a good connection. So:

  * the parts are read ONLY where an index exists. The CityEngine session creates them for districts being filmed or
    demoed, so the index's existence is the opt-in - there is no separate list here to drift out of step with theirs.
  * `?flat=1` forces the single tile, for anyone on a connection where 28 MB is not reasonable.
  * Save-Data, or a connection the browser reports as 2g/slow-2g, takes the flat tile automatically and says so, with
    a link to load the full detail anyway. A page that decides for you and does not tell you is worse than either.
  * the progress readout counts parts and megabytes, because a 28 MB download behind the word "Loading" is how a
    person concludes the page is broken and leaves.

A PART THAT FAILS DOES NOT SINK THE DISTRICT. If any part 404s or fails to parse, what arrived is still mounted and
the message says how many parts are missing. The alternative - an empty viewer because one key of seven was absent -
is the failure the index was designed to avoid, and it would be a shame to reintroduce it at the reading end.

  python scripts/v248_skyline_reads_multi_part_tiles.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "index.js")
s = io.open(P, encoding="utf-8").read()

if "skyparts_" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# 1. the callback becomes a named function, so the same code can be fed one tile or many merged
sub("""const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);   // compressed GLBs load too
loader.load("/img/sky_${slugName}",g=>{
  msg.remove();""",
    """const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);   // compressed GLBs load too
// v248: one district can be several KV keys. This callback runs ONCE on a complete scene either way - it frames the
// camera, sizes the ground and fits the shadow frustum from the full bounding box, none of which survives being run
// against a model that is still arriving.
const onSky=g=>{
  msg.remove();""",
    "callback head")

# 2. the tail: dispatch between one key and many
sub("""  buildFeat();
},undefined,()=>{msg.textContent="No 3D massing for this community yet — it gets built the first time CityEngine runs for it."});""",
    """  buildFeat();
};
const _noSky=()=>{msg.textContent="No 3D massing for this community yet — it gets built the first time CityEngine runs for it."};
const _flatSky=(note)=>{if(note)msg.innerHTML=note;loader.load("/img/sky_${slugName}",onSky,undefined,_noSky)};
{
  const _q=new URLSearchParams(location.search);
  const _con=navigator.connection||{};
  const _slow=!!(_con.saveData||/^(slow-)?2g$/.test(_con.effectiveType||""));
  if(_q.get("flat")==="1"){_flatSky(null)}
  else fetch("/img/skyparts_${slugName}").then(r=>r.ok?r.json():null).then(ix=>{
    const items=(ix&&ix.items)||[];
    if(!items.length){_flatSky(null);return}
    const mb=items.reduce((t,i)=>t+(i.gz||0),0)/1e6;
    // A page that quietly spends 28 MB of someone's connection, or quietly withholds the detail, are both worse than
    // saying which one it did and offering the other.
    if(_slow){_flatSky('Showing the lighter model — this district\\'s full detail is '+mb.toFixed(0)+' MB. <a href="?'+(_q.toString()?_q.toString()+"&":"")+'full=1" style="color:#C5A56A">Load it anyway</a>');return}
    let done=0,failed=0;const group=new THREE.Group();
    msg.textContent="Loading "+items.length+" parts, "+mb.toFixed(0)+" MB of detail…";
    Promise.all(items.map(it=>loader.loadAsync("/img/"+it.key).then(p=>{group.add(p.scene)},()=>{failed++})
      .then(()=>{done++;msg.textContent="Loading detail… "+done+" of "+items.length+" parts"})))
      .then(()=>{
        if(!group.children.length){_flatSky(null);return}   // nothing arrived at all - the single tile is better than an empty viewer
        onSky({scene:group});
        // a missing part is a gap in a district, not a broken page: mount what came and say what did not
        if(failed){const w=document.createElement("div");w.style.cssText="position:absolute;left:12px;bottom:12px;z-index:9;background:rgba(20,26,24,.86);color:#C5A56A;padding:6px 10px;border-radius:6px;font:12px system-ui";
          w.textContent=failed+" of "+items.length+" parts of this district did not load — what you see is the rest.";document.body.appendChild(w)}
      });
  }).catch(()=>_flatSky(null));
}""",
    "callback tail and dispatch")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("the skyline reads multi-part tiles:", len(s), "chars")
