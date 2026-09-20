"""The hero, closer to the render Kendall wants (20 Sep 2026: "this was the way that I wanted the building to look", the Imtiaz
Universe shot - a photoreal render with the units tinted on it).

We cannot invent a marketing render for 164 buildings, but the v3 CityEngine export carries real facade photographs (22 textures
in Business Bay), and the twin already lights them properly. The page was throwing them away: every band got a flat colour, on
black, with the neighbours as grey ghosts. Now:

  - a floor band KEEPS the facade photo and is tinted towards its colour, the way the twin's v76 pass does it
  - the neighbours stand in their own materials, dimmed, so the tower is in a city instead of in the dark
  - sky, sun and a ground plane, with the same palette as the twin

What is still not the reference: the reference is a photograph-grade render of one tower shot by the developer's visualiser. Ours
is surveyed massing with photographic facades. For buildings whose developer publishes a render - Symphony today - the render can
be used as the hero exactly as the pilot does.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


# 1. scene: sky, sun, shadows
sub("""  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0C1413); scene.fog = new THREE.Fog(0x0C1413, 900, 4200);""",
    """  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0C1413); scene.fog = new THREE.Fog(0x101B19, 900, 4200);""")

sub("""  const sun = new THREE.DirectionalLight(0xFFF2DA, 1.5); sun.position.set(-260, 420, 220); scene.add(sun); scene.add(new THREE.HemisphereLight(0x9FB6AE, 0x0C1413, 0.5));""",
    """  const sun = new THREE.DirectionalLight(0xFFF2DA, 2.1); sun.position.set(-260, 420, 220); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; scene.add(sun); scene.add(new THREE.HemisphereLight(0x9FB6AE, 0x121D1B, 0.55));
  ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
  // the twin's own sky: teal-black at the horizon, ink overhead, a breath of gold along the skyline
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { horizon: { value: new THREE.Color(0x1B332E) }, zenith: { value: new THREE.Color(0x121D1B) }, warm: { value: new THREE.Color(0xC5A56A) } },
    vertexShader: "varying vec3 vW;void main(){vW=normalize((modelMatrix*vec4(position,1.0)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform vec3 horizon,zenith,warm;varying vec3 vW;void main(){float h=clamp(vW.y,0.0,1.0);vec3 c=mix(horizon,zenith,pow(h,0.45));c+=warm*0.05*exp(-h*13.0);gl_FragColor=vec4(c,1.0);}" }));
  sky.scale.setScalar(9000); scene.add(sky);""")

# 2. the neighbours keep their own materials, dimmed, and take shadow
sub("""    const ghost = new THREE.MeshStandardMaterial({ color: 0x55605d, roughness: 1, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false });
    for (const m of others) m.material = ghost;""",
    """    // the neighbours keep their own facades so the tower stands in a city, only quieter than the subject
    const dim = (mt) => { const c = mt.clone(); if (c.map) { c.map.colorSpace = THREE.SRGBColorSpace; c.color.multiplyScalar(0.72); } else { c.color.lerp(new THREE.Color(0x2b3533), 0.55); }
      c.roughness = Math.min(1, (c.roughness || 0.8) + 0.1); c.metalness = 0; return c; };
    for (const m of others) { m.material = Array.isArray(m.material) ? m.material.map(dim) : dim(m.material); m.castShadow = true; m.receiveShadow = true; }""")

# 3. a ground plane under it all
sub("""    scene.add(root);
    MESH = mine;""",
    """    scene.add(root);
    MESH = mine;
    { const b0 = new THREE.Box3().setFromObject(root), c0 = b0.getCenter(new THREE.Vector3()), s0 = b0.getSize(new THREE.Vector3());
      const g = new THREE.Mesh(new THREE.CircleGeometry(Math.max(s0.x, s0.z) * 1.3, 64),
        new THREE.MeshStandardMaterial({ color: 0x16211E, roughness: 1, metalness: 0 }));
      g.rotation.x = -Math.PI / 2; g.position.set(c0.x, b0.min.y + 0.05, c0.z); g.receiveShadow = true; scene.add(g); }""")

# 4. the bands keep the facade photograph and are tinted, instead of being painted flat
sub("""      MESH.forEach((m, k) => {
        const mt = new THREE.MeshStandardMaterial({ color: q.col, emissive: q.col, emissiveIntensity: q.em, roughness: 0.6, metalness: 0.02,
          flatShading: true, side: THREE.FrontSide, transparent: q.op < 1, opacity: q.op, depthWrite: q.op >= 1, clippingPlanes: cp,
          polygonOffset: k > 0, polygonOffsetFactor: -k, polygonOffsetUnits: -4 * k });
        const b = new THREE.Mesh(m.geometry, mt); b.matrixAutoUpdate = false; b.matrix.copy(m.matrixWorld);
        b.userData.bp = { j0: q.j0, j1: q.j1, lo, hi }; scene.add(b); BANDS.push(b); MATS.push(mt);
      });""",
    """      MESH.forEach((m, k) => {
        const src = Array.isArray(m.material) ? m.material[0] : m.material;
        let mt;
        if (src && src.map) {                       // v3 export: a real facade photograph. Keep it and tint it, as the twin does.
          mt = src.clone();
          mt.map.colorSpace = THREE.SRGBColorSpace;
          mt.color = new THREE.Color(q.col); mt.color.lerp(new THREE.Color(0xFFFFFF), 0.34);
          mt.emissive = new THREE.Color(q.col); mt.emissiveIntensity = Math.max(0.12, q.em);
          mt.roughness = 0.85; mt.metalness = 0;
        } else {
          mt = new THREE.MeshStandardMaterial({ color: q.col, emissive: q.col, emissiveIntensity: q.em, roughness: 0.6, metalness: 0.02, flatShading: true });
        }
        mt.side = THREE.FrontSide; mt.transparent = q.op < 1; mt.opacity = q.op; mt.depthWrite = q.op >= 1; mt.clippingPlanes = cp;
        mt.polygonOffset = k > 0; mt.polygonOffsetFactor = -k; mt.polygonOffsetUnits = -4 * k; mt.needsUpdate = true;
        const b = new THREE.Mesh(m.geometry, mt); b.matrixAutoUpdate = false; b.matrix.copy(m.matrixWorld);
        b.castShadow = true; b.receiveShadow = true;
        b.userData.bp = { j0: q.j0, j1: q.j1, lo, hi }; scene.add(b); BANDS.push(b); MATS.push(mt);
      });""")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("hero pass in:", len(s), "chars")
