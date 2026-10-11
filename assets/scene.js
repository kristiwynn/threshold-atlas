// The staged passage, shared by the World page and the map's pop-up preview.
//
// It renders only what it is given. A walk is a list of stages; each stage names
// a visual key, how strongly it is present, the place it happens in, and the words
// the source itself uses. Nothing here invents a number or a detail: a garden is
// built only where the source describes a garden, and fire only where it describes fire.
window.TAScene = (function () {
  // Generic wording, used for the collective walks built from study percentages.
  // A single reported vision overrides these with its own text.
  const DESC = {
    dead: "Many realise at once that they have died.",
    obe: "The view lifts away from the body. People describe watching the scene from above.",
    peace: "A feeling of peace, relief or joy, usually described as stronger than anything felt before.",
    tunnel: "Darkness that draws inward, often described as a tunnel or passage, pulling toward a light.",
    light: "A brilliant light that does not hurt the eyes, often felt as welcoming or as a presence.",
    beings: "Deceased relatives, religious figures, or beings of light, sensed or seen.",
    realm: "A landscape or place unlike anything on earth, or a journey across one.",
    review: "Scenes from one's own life, replayed, shown in a mirror, or read aloud by others.",
    border: "A line, gate, river or threshold, with a sense that crossing it would mean not returning.",
    return: "Being sent back, choosing to go back, or being pulled back into the body.",
    messengers: "Figures arrive to take the person away, matter-of-fact and sometimes rough.",
    ledger: "The person is brought before someone with a book or record of their life.",
    error: "The record is checked and a mistake is found: the wrong person was brought.",
  };
  const DARK = {
    dead: "Realising you have died, with dread rather than calm.",
    obe: "Watching your body from above, unable to get back to it.",
    peace: "No peace comes, only a cold and a sense of being very alone.",
    tunnel: "A darkness that pulls, with nothing at the end of it.",
    light: "No welcoming light. In 'void' accounts this is where the experience stays.",
    beings: "Presences that keep their distance, or that threaten.",
    realm: "A barren or hostile place rather than a garden.",
    review: "Scenes from life felt as judgment rather than understanding.",
    border: "A drop rather than a gate.",
    return: "Being pulled back, usually with relief.",
  };
  const LABEL = {
    dead: "Knowing you have died", obe: "Leaving the body", peace: "Peace", tunnel: "The tunnel",
    light: "The light", beings: "Presences", realm: "Another place", review: "The life review",
    border: "The border", return: "The return", messengers: "Taken by messengers",
    ledger: "Before the record", error: "A mistake is found",
  };
  // Named so a page can print where a stage happens.
  const PLACE = {
    garden: "a flowering garden", torment: "a place of fire and rock", meadow: "open grassland",
    coast: "grassland above the sea", city: "a walled city", underworld: "a dim land of the dead",
    bridge: "a narrow bridge over dark water", hall: "a hall of judgment",
    abstract: "no place the source describes",
    lattice: "a lattice of light, which stands for an idea and not a place",
    voidless: "nothing, which is what the dying-brain account predicts",
  };

  // ------------------------------------------------------------------ helpers
  // Every terrain material starts invisible and is faded in by the manager, so each
  // builder registers its materials with the opacity they should reach.
  const track = (list, mat, base) => { mat.transparent = true; mat.opacity = 0; list.push([mat, base === undefined ? 1 : base]); return mat; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  function skyDome(list, top, horizon) {
    const g = new THREE.SphereGeometry(400, 24, 16), p = g.attributes.position;
    const ct = new THREE.Color(top), ch = new THREE.Color(horizon), col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const k = Math.max(0, Math.min(1, (p.getY(i) / 400 + 0.2) / 0.85));
      c.copy(ch).lerp(ct, k * k);
      col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(g, track(list, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }), 1));
  }

  // A rolling ground. hFn(x, z) gives height; the mesh is tinted by height so the
  // shape of the land reads even before the sun catches it.
  function groundMesh(list, hFn, lo, hi, size, seg) {
    const g = new THREE.PlaneGeometry(size || 460, size || 460, seg || 72, seg || 72), p = g.attributes.position;
    const cl = new THREE.Color(lo), ch = new THREE.Color(hi), col = new Float32Array(p.count * 3), c = new THREE.Color();
    let min = 1e9, max = -1e9; const hs = [];
    for (let i = 0; i < p.count; i++) { const h = hFn(p.getX(i), -p.getY(i)); hs.push(h); p.setZ(i, h); if (h < min) min = h; if (h > max) max = h; }
    for (let i = 0; i < p.count; i++) { c.copy(cl).lerp(ch, (hs[i] - min) / (max - min || 1)); col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, track(list, new THREE.MeshLambertMaterial({ vertexColors: true })));
    m.rotation.x = -Math.PI / 2; m.position.y = -3;
    return m;
  }

  function scatter(list, n, size, colors, place, opacity, additive) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color(), out = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      place(out, i); pos[3 * i] = out[0]; pos[3 * i + 1] = out[1]; pos[3 * i + 2] = out[2];
      c.set(pick(colors)); col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, track(list, new THREE.PointsMaterial({
      size, vertexColors: true, depthWrite: false, sizeAttenuation: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }), opacity === undefined ? 1 : opacity));
  }

  // Many copies of one shape, each with its own position, scale and tint.
  function clump(list, geom, color, n, place) {
    const m = new THREE.InstancedMesh(geom, track(list, new THREE.MeshLambertMaterial({ color })), n);
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { place(o, c, i); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c); }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    return m;
  }

  function flatSheet(list, w, d, seg, color, y, z, opacity) {
    const g = new THREE.PlaneGeometry(w, d, seg, Math.max(2, seg >> 1));
    const m = new THREE.Mesh(g, track(list, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }), opacity));
    m.rotation.x = -Math.PI / 2; m.position.set(0, y, z);
    m.userData.base = Float32Array.from(g.attributes.position.array);
    return m;
  }
  // Slow swell on a water surface, so a river reads as moving without any texture.
  function ripple(mesh, t, amp, freq) {
    const p = mesh.geometry.attributes.position, b = mesh.userData.base;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(b[3 * i] * freq + t * 1.1) * amp + Math.cos(b[3 * i + 1] * freq * 1.4 - t * 0.8) * amp * 0.7);
    p.needsUpdate = true;
  }

  // A soft standing figure, used for the shades and the presences.
  let FIG = null;
  function figureTexture() {
    if (FIG) return FIG;
    const c = document.createElement("canvas"); c.width = 64; c.height = 160; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 160);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.2, "rgba(255,255,255,.78)");
    g.addColorStop(0.78, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.beginPath(); x.ellipse(32, 96, 15, 62, 0, 0, 6.3); x.fill();
    x.fillStyle = "rgba(255,255,255,.8)"; x.beginPath(); x.arc(32, 24, 11, 0, 6.3); x.fill();
    FIG = new THREE.CanvasTexture(c); return FIG;
  }

  // ------------------------------------------------------------------ the places
  // Each builder returns its group, the colour the air takes, how thick that air is,
  // and the light the place stands under. update() runs each frame while it shows.
  const BUILD = {
    // A flowering paradise: trees either side of a path, a stream crossing it.
    garden(list) {
      const g = new THREE.Group(), h = (x, z) => Math.sin(x * 0.05) * 1.7 + Math.cos(z * 0.042) * 1.4 + Math.sin((x + z) * 0.021) * 2.1;
      g.add(skyDome(list, 0x6ea9d4, 0xf2e0ae));
      g.add(groundMesh(list, h, 0x2d5c33, 0x568e4a));
      const path = flatSheet(list, 5.4, 440, 2, 0xc6b184, -2.84, 0);
      const pp = path.geometry.attributes.position;
      for (let i = 0; i < pp.count; i++) pp.setZ(i, h(pp.getX(i), -pp.getY(i)) - 0.06);
      pp.needsUpdate = true; g.add(path);
      // trees: a trunk clump and a foliage clump on the same 96 spots
      const spots = [];
      for (let i = 0; i < 96; i++) { const x = (i % 2 ? 1 : -1) * rnd(5.5, 72), z = rnd(-215, 22); spots.push([x, z, rnd(0.8, 1.5), rnd(0, 6.3)]); }
      g.add(clump(list, new THREE.CylinderGeometry(0.17, 0.33, 3.4, 6), 0x5b4530, 96, (o, c, i) => {
        const [x, z, s, ry] = spots[i];
        o.position.set(x, h(x, z) - 3 + 1.7 * s, z); o.scale.setScalar(s); o.rotation.y = ry;
        c.setHSL(0.08, 0.3, rnd(0.16, 0.28));
      }));
      g.add(clump(list, new THREE.ConeGeometry(2.1, 4.6, 7), 0x3f7d42, 96, (o, c, i) => {
        const [x, z, s, ry] = spots[i], t = rnd(0.9, 1.5);
        o.position.set(x, h(x, z) - 3 + 3.4 * s + 2.3 * s * t, z);
        o.scale.set(s, s * t, s); o.rotation.y = ry;
        c.setHSL(rnd(0.24, 0.33), rnd(0.35, 0.6), rnd(0.22, 0.42));
      }));
      g.add(scatter(list, 9000, 0.1, ["#4d8a3e", "#5f9c45", "#3d7334", "#7fae55"], o => {
        const a = rnd(0, 6.3), r = rnd(3, 105), x = Math.cos(a) * r, z = Math.sin(a) * r - 60;
        o[0] = x; o[1] = h(x, z) - 3 + rnd(0.05, 0.5); o[2] = z;
      }, 0.95));
      g.add(scatter(list, 1700, 0.34, ["#f6efd6", "#f0c75a", "#e58aa0", "#c79ae0", "#f5f1e4"], o => {
        const a = rnd(0, 6.3), r = rnd(3, 95), x = Math.cos(a) * r, z = Math.sin(a) * r - 60;
        o[0] = x; o[1] = h(x, z) - 3 + rnd(0.15, 0.7); o[2] = z;
      }, 0.9));
      const stream = flatSheet(list, 300, 9, 48, 0x6fb4c6, -2.62, -58, 0.92);
      stream.rotation.z = 0.06; g.add(stream);
      return {
        group: g, fog: 0xd9e4ea, density: 0.004, hemi: [0xdce9f5, 0x53713f, 0.95], sun: [0xfff3d6, 1.05],
        update(dt, t) { ripple(stream, t, 0.26, 0.5); },
      };
    },

    // Rock, fire and smoke, with a pit in the distance.
    torment(list) {
      const g = new THREE.Group(), h = (x, z) => Math.sin(x * 0.1) * 2.5 + Math.cos(z * 0.085) * 2.2 + Math.sin(x * 0.31 + z * 0.24) * 1.3;
      g.add(skyDome(list, 0x160708, 0x74200c));
      g.add(groundMesh(list, h, 0x180b09, 0x3c1d14));
      g.add(clump(list, new THREE.ConeGeometry(1.0, 6.2, 5), 0x1a0e0b, 150, (o, c) => {
        const a = rnd(0, 6.3), r = rnd(7, 110), x = Math.cos(a) * r, z = Math.sin(a) * r - 50;
        o.position.set(x, h(x, z) - 3 + 2.4, z); o.scale.set(rnd(0.5, 1.8), rnd(0.5, 2.4), rnd(0.5, 1.8));
        o.rotation.set(rnd(-0.2, 0.2), rnd(0, 6.3), rnd(-0.2, 0.2));
        c.setHSL(0.03, rnd(0.2, 0.5), rnd(0.04, 0.12));
      }));
      const fire = scatter(list, 2600, 0.42, ["#ffd27a", "#ff9a3c", "#f0541f", "#b32410"], o => {
        const a = rnd(0, 6.3), r = rnd(4, 95), x = Math.cos(a) * r, z = Math.sin(a) * r - 50;
        o[0] = x; o[1] = h(x, z) - 3 + rnd(0, 14); o[2] = z;
      }, 0.95, true);
      const fp = fire.geometry.attributes.position, fb = Float32Array.from(fp.array); g.add(fire);
      const smoke = scatter(list, 1100, 2.6, ["#2e211d", "#43322c", "#1d1512"], o => {
        const a = rnd(0, 6.3), r = rnd(4, 105), x = Math.cos(a) * r, z = Math.sin(a) * r - 50;
        o[0] = x; o[1] = rnd(-2, 26); o[2] = z;
      }, 0.3);
      const sp2 = smoke.geometry.attributes.position; g.add(smoke);
      const pit = new THREE.Mesh(new THREE.CircleGeometry(21, 48), track(list, new THREE.MeshBasicMaterial({ color: 0x000000 })));
      pit.rotation.x = -Math.PI / 2; pit.position.set(0, -2.55, -84); g.add(pit);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(21, 0.9, 6, 48), track(list, new THREE.MeshBasicMaterial({ color: 0xd4541c }), 0.9));
      lip.rotation.x = Math.PI / 2; lip.position.set(0, -2.45, -84); g.add(lip);
      return {
        group: g, fog: 0x340d07, density: 0.016, hemi: [0x6b2a14, 0x160805, 0.75], sun: [0xff8a4a, 0.55],
        update(dt, t) {
          for (let i = 0; i < fp.count; i++) {
            let y = fp.getY(i) + dt * (3 + (i % 7));
            if (y > fb[3 * i + 1] + 16) y = fb[3 * i + 1];
            fp.setY(i, y); fp.setX(i, fb[3 * i] + Math.sin(t * 1.6 + i) * 0.5);
          }
          fp.needsUpdate = true;
          for (let i = 0; i < sp2.count; i++) { let y = sp2.getY(i) + dt * 1.3; if (y > 30) y = -3; sp2.setY(i, y); }
          sp2.needsUpdate = true;
        },
      };
    },

    // Ordinary earthly country: grass, low hills, daylight.
    meadow(list) {
      const g = new THREE.Group(), h = (x, z) => Math.sin(x * 0.028) * 2.6 + Math.cos(z * 0.024) * 2.2 + Math.sin((x - z) * 0.011) * 1.6;
      g.add(skyDome(list, 0x8bb9db, 0xe9eef0));
      g.add(groundMesh(list, h, 0x4a6440, 0x7a8d5e));
      g.add(clump(list, new THREE.ConeGeometry(34, 22, 9), 0x51664f, 26, (o, c, i) => {
        const a = (i / 26) * 6.283 + rnd(-0.1, 0.1), r = rnd(155, 215);
        o.position.set(Math.cos(a) * r, -5, Math.sin(a) * r - 40);
        o.scale.set(rnd(0.7, 1.7), rnd(0.5, 1.3), rnd(0.7, 1.7));
        c.setHSL(rnd(0.26, 0.34), rnd(0.1, 0.25), rnd(0.2, 0.34));
      }));
      g.add(scatter(list, 9000, 0.11, ["#6f8c4c", "#86a05a", "#5c7840", "#9bae6a"], o => {
        const a = rnd(0, 6.3), r = rnd(2, 120), x = Math.cos(a) * r, z = Math.sin(a) * r - 50;
        o[0] = x; o[1] = h(x, z) - 3 + rnd(0.05, 0.45); o[2] = z;
      }, 0.95));
      return { group: g, fog: 0xdbe4e8, density: 0.006, hemi: [0xdfeaf2, 0x5d7044, 0.9], sun: [0xfff6e2, 0.9] };
    },

    // Grassland running out to the sea, with a headland: the geography the Pacific
    // and Maori accounts actually name.
    coast(list) {
      const g = new THREE.Group(), h = (x, z) => Math.sin(x * 0.026) * 2.4 + Math.cos(z * 0.022) * 2.0 - Math.max(0, (-z - 110) * 0.09);
      g.add(skyDome(list, 0x7eb4dd, 0xf0e3c8));
      g.add(groundMesh(list, h, 0x4d6540, 0x80905e, 320, 60));
      const sea = flatSheet(list, 820, 460, 60, 0x24506f, -7.4, -330); g.add(sea);
      g.add(clump(list, new THREE.ConeGeometry(16, 30, 7), 0x3f4a40, 16, (o, c) => {
        o.position.set(rnd(-120, -46), rnd(-10, -2), rnd(-230, -130));
        o.scale.set(rnd(0.6, 1.6), rnd(0.6, 1.5), rnd(0.6, 1.6));
        c.setHSL(0.3, 0.12, rnd(0.14, 0.26));
      }));
      g.add(scatter(list, 7000, 0.11, ["#74904f", "#8aa35c", "#5f7a42"], o => {
        const a = rnd(0, 6.3), r = rnd(2, 100), x = Math.cos(a) * r, z = Math.min(-8, Math.sin(a) * r - 40);
        o[0] = x; o[1] = h(x, z) - 3 + rnd(0.05, 0.4); o[2] = z;
      }, 0.95));
      const foam = scatter(list, 1400, 0.5, ["#dfeaf0", "#b9ccd8"], o => { o[0] = rnd(-200, 200); o[1] = -6.5; o[2] = rnd(-170, -118); }, 0.5, true);
      g.add(foam);
      return {
        group: g, fog: 0xd3e0e8, density: 0.0055, hemi: [0xe2eef6, 0x5d7044, 0.95], sun: [0xfff1d8, 1.0],
        update(dt, t) { ripple(sea, t, 0.5, 0.11); },
      };
    },

    // A walled city with lit windows and a gate.
    city(list) {
      const g = new THREE.Group();
      g.add(skyDome(list, 0x2b2a4e, 0xe8bd78));
      g.add(groundMesh(list, (x, z) => Math.sin(x * 0.02) * 0.6 + Math.cos(z * 0.02) * 0.5, 0x4e483c, 0x7d7463));
      [-30, 30].forEach(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, 20, 330), track(list, new THREE.MeshLambertMaterial({ color: 0xd9caa0 }))); m.position.set(x, 4.5, -70); g.add(m); });
      g.add(clump(list, new THREE.BoxGeometry(9, 26, 9), 0xe0d2aa, 14, (o, c, i) => {
        o.position.set(i % 2 ? 30 : -30, 7, -220 + i * 26); c.setHSL(0.11, 0.26, rnd(0.6, 0.78));
      }));
      g.add(clump(list, new THREE.BoxGeometry(7, 1, 7), 0xcfc0a0, 80, (o, c) => {
        const x = rnd(-26, 26), z = rnd(-215, -14), hh = rnd(6, 34);
        o.position.set(x, -3 + hh / 2, z); o.scale.set(rnd(0.6, 1.6), hh, rnd(0.6, 1.6)); o.rotation.y = rnd(-0.2, 0.2);
        c.setHSL(0.1, rnd(0.14, 0.3), rnd(0.52, 0.76));
      }));
      const win = scatter(list, 1800, 0.3, ["#ffd79a", "#ffefc4", "#f0b45a"], o => { o[0] = rnd(-27, 27); o[1] = rnd(-2, 28); o[2] = rnd(-214, -14); }, 0.9, true);
      g.add(win);
      [-5.5, 5.5].forEach(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(3, 16, 3), track(list, new THREE.MeshLambertMaterial({ color: 0xe6d8ae }))); m.position.set(x, 2.5, -10); g.add(m); });
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(14, 2.6, 3.4), track(list, new THREE.MeshLambertMaterial({ color: 0xe6d8ae })));
      lintel.position.set(0, 11.5, -10); g.add(lintel);
      return { group: g, fog: 0x3a3450, density: 0.007, hemi: [0xf0d8a8, 0x3a3346, 0.9], sun: [0xffdca0, 0.8] };
    },

    // A dim land of the dead: grey floor under a low roof, shades standing about,
    // dust falling. Built for the House of Dust and the asphodel meadow.
    underworld(list) {
      const g = new THREE.Group(), h = (x, z) => Math.sin(x * 0.05) * 0.5 + Math.cos(z * 0.04) * 0.4;
      g.add(skyDome(list, 0x07070e, 0x16161f));
      g.add(groundMesh(list, h, 0x1b1b24, 0x35353f));
      g.add(flatSheet(list, 460, 460, 4, 0x0e0e15, 19, -40));
      const tex = figureTexture(), shades = [];
      for (let i = 0; i < 90; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x8e8e9c, transparent: true, depthWrite: false }));
        list.push([s.material, 0.5]); s.material.opacity = 0;
        const a = rnd(0, 6.3), r = rnd(6, 90);
        s.position.set(Math.cos(a) * r, -2.1, Math.sin(a) * r - 45); s.scale.set(1.1, 2.6, 1);
        s.userData.ph = rnd(0, 6.3); shades.push(s); g.add(s);
      }
      const dust = scatter(list, 2600, 0.14, ["#9a958c", "#7d7a74", "#b5b0a4"], o => { o[0] = rnd(-110, 110); o[1] = rnd(-3, 19); o[2] = rnd(-150, 20); }, 0.5);
      const dp = dust.geometry.attributes.position; g.add(dust);
      return {
        group: g, fog: 0x101017, density: 0.026, hemi: [0x3a3a4a, 0x14141b, 0.7], sun: [0x6a6a80, 0.25],
        update(dt, t) {
          shades.forEach(s => { s.position.y = -2.1 + Math.sin(t * 0.5 + s.userData.ph) * 0.1; });
          for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) - dt * 0.7; if (y < -3) y = 19; dp.setY(i, y); }
          dp.needsUpdate = true;
        },
      };
    },

    // A narrow span over black water.
    bridge(list) {
      const g = new THREE.Group();
      g.add(skyDome(list, 0x090b14, 0x1f2534));
      const river = flatSheet(list, 700, 700, 64, 0x050c17, -7.5, -60); g.add(river);
      const span = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 230), track(list, new THREE.MeshLambertMaterial({ color: 0x6f6757 })));
      span.position.set(0, -1.9, -95); g.add(span);
      [-0.78, 0.78].forEach(x => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 230), track(list, new THREE.MeshLambertMaterial({ color: 0x565040 }))); r.position.set(x, -1.6, -95); g.add(r); });
      [-34, 34].forEach(x => { const b = new THREE.Mesh(new THREE.BoxGeometry(48, 10, 120), track(list, new THREE.MeshLambertMaterial({ color: 0x1d1d26 }))); b.position.set(x, -6, -40); g.add(b); });
      const mist = scatter(list, 1800, 1.9, ["#c6cedb", "#9aa4b4"], o => { o[0] = rnd(-70, 70); o[1] = rnd(-7, 1); o[2] = rnd(-200, 20); }, 0.11);
      const mp = mist.geometry.attributes.position; g.add(mist);
      return {
        group: g, fog: 0x0b0f1a, density: 0.021, hemi: [0x2a3344, 0x080b12, 0.7], sun: [0x8fa0c0, 0.35],
        update(dt, t) {
          ripple(river, t, 0.3, 0.1);
          for (let i = 0; i < mp.count; i++) { let x = mp.getX(i) + dt * 1.6; if (x > 70) x = -70; mp.setX(i, x); }
          mp.needsUpdate = true;
        },
      };
    },

    // A columned hall with a balance: the Hall of the Two Truths, and the public
    // reckonings of the Indian, Chinese, Japanese and Tibetan accounts.
    hall(list) {
      const g = new THREE.Group();
      g.add(skyDome(list, 0x15111c, 0x3f331f));
      g.add(groundMesh(list, x => Math.sin(x * 0.4) * 0.03, 0x2b2722, 0x463f35, 240, 24));
      g.add(flatSheet(list, 240, 400, 4, 0x1a1610, 23, -60));
      g.add(clump(list, new THREE.CylinderGeometry(1.5, 1.8, 26, 12), 0xb9a279, 24, (o, c, i) => {
        o.position.set(i % 2 ? 13 : -13, 10, -8 - ((i / 2) | 0) * 19);
        c.setHSL(0.09, rnd(0.2, 0.4), rnd(0.42, 0.62));
      }));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 9, 10), track(list, new THREE.MeshLambertMaterial({ color: 0xd8c389 })));
      post.position.set(0, 1.5, -34); g.add(post);
      const beam = new THREE.Group(); beam.position.set(0, 6, -34); g.add(beam);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.16, 0.16), track(list, new THREE.MeshLambertMaterial({ color: 0xe6cf92 }))); beam.add(bar);
      const pans = [-1, 1].map(s => {
        const grp = new THREE.Group(); grp.position.x = s * 3.5; beam.add(grp);
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.2, 0.04), track(list, new THREE.MeshLambertMaterial({ color: 0xcbb57c }))); w.position.y = -1.1; grp.add(w);
        const pan = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.0, 0.1, 18), track(list, new THREE.MeshLambertMaterial({ color: 0xe0c98c }))); pan.position.y = -2.2; grp.add(pan);
        return grp;
      });
      g.add(scatter(list, 700, 0.6, ["#ffdda0", "#f0bf6a"], o => { o[0] = rnd(-9, 9); o[1] = rnd(-2, 16); o[2] = rnd(-60, -24); }, 0.5, true));
      return {
        group: g, fog: 0x1b1710, density: 0.013, hemi: [0x6a5637, 0x14100c, 0.8], sun: [0xffd48a, 0.55],
        update(dt, t) { const a = Math.sin(t * 0.45) * 0.12; beam.rotation.z = a; pans.forEach(p => p.rotation.z = -a); },
      };
    },

    // A lattice of nodes and links, for the physics hypotheses. Nobody reports this;
    // it stands for an idea, and the page says so in as many words.
    lattice(list) {
      const g = new THREE.Group();
      g.add(skyDome(list, 0x05060f, 0x0d1226));
      const NX = 13, NY = 7, NZ = 13, SP = 11, pos = [];
      for (let x = 0; x < NX; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++)
        pos.push([(x - (NX - 1) / 2) * SP, (y - (NY - 1) / 2) * SP * 0.8, -z * SP - 6]);
      const pa = new Float32Array(pos.length * 3), ca = new Float32Array(pos.length * 3), c = new THREE.Color();
      pos.forEach((q, i) => {
        pa[3 * i] = q[0]; pa[3 * i + 1] = q[1]; pa[3 * i + 2] = q[2];
        c.setHSL(0.52 + Math.random() * 0.12, 0.7, 0.6);
        ca[3 * i] = c.r; ca[3 * i + 1] = c.g; ca[3 * i + 2] = c.b;
      });
      const ng = new THREE.BufferGeometry();
      ng.setAttribute("position", new THREE.BufferAttribute(pa, 3));
      ng.setAttribute("color", new THREE.BufferAttribute(ca, 3));
      g.add(new THREE.Points(ng, track(list, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending }), 0.95)));
      // links to the next neighbour along each axis
      const seg = [], at = (x, y, z) => ((x * NY) + y) * NZ + z;
      for (let x = 0; x < NX; x++) for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
        if (x + 1 < NX) seg.push(at(x, y, z), at(x + 1, y, z));
        if (y + 1 < NY) seg.push(at(x, y, z), at(x, y + 1, z));
        if (z + 1 < NZ) seg.push(at(x, y, z), at(x, y, z + 1));
      }
      const la = new Float32Array(seg.length * 3);
      seg.forEach((n, i) => { la[3 * i] = pa[3 * n]; la[3 * i + 1] = pa[3 * n + 1]; la[3 * i + 2] = pa[3 * n + 2]; });
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(la, 3));
      g.add(new THREE.LineSegments(lg, track(list, new THREE.LineBasicMaterial({ color: 0x3f6fa8, depthWrite: false, blending: THREE.AdditiveBlending }), 0.22)));
      // a few pairs that brighten together, however far apart they sit
      const tex = figureTexture(), pairs = [];
      for (let i = 0; i < 7; i++) {
        const two = [], ph = rnd(0, 6.3);
        [pos[(Math.random() * pos.length) | 0], pos[(Math.random() * pos.length) | 0]].forEach(q => {
          const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xaef0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          s2.position.set(q[0], q[1], q[2]); s2.scale.set(3.4, 3.4, 1); s2.material.opacity = 0;
          list.push([s2.material, 0.8]); g.add(s2); two.push(s2);
        });
        pairs.push({ two, ph });
      }
      return {
        group: g, fog: 0x070a16, density: 0.009, hemi: [0x24406a, 0x05060f, 0.5], sun: [0x7fb0e0, 0.2],
        update(dt, t) {
          g.rotation.y = Math.sin(t * 0.05) * 0.12;
          pairs.forEach(pr => { const k = 0.25 + 0.75 * Math.sin(t * 1.3 + pr.ph) ** 8; pr.two.forEach(x => x.scale.setScalar(2.2 + 4 * k)); });
        },
      };
    },

    // Nothing: the dying-brain account, where the experience is the last thing the
    // brain does and there is no afterwards to walk into.
    voidless(list) {
      const g = new THREE.Group();
      g.add(skyDome(list, 0x030308, 0x05050a));
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 30, 30), track(list, new THREE.MeshBasicMaterial({ color: 0x1d2030, wireframe: true }), 0.16));
      grid.rotation.x = -Math.PI / 2; grid.position.y = -3; g.add(grid);
      const motes = scatter(list, 1200, 0.2, ["#5a6a86", "#3d4860"], o => { o[0] = rnd(-60, 60); o[1] = rnd(-3, 16); o[2] = rnd(-120, 4); }, 0.3, true);
      const mp = motes.geometry.attributes.position; g.add(motes);
      return {
        group: g, fog: 0x04040a, density: 0.03, hemi: [0x10131c, 0x020205, 0.3], sun: [0x2a3246, 0.1],
        update(dt, t) {
          for (let i = 0; i < mp.count; i++) { let y = mp.getY(i) - dt * 1.4; if (y < -4) y = 16; mp.setY(i, y); }
          mp.needsUpdate = true;
        },
      };
    },

    // No place: the collective walks, where the sources publish rates and not scenery.
    abstract(list) {
      const g = new THREE.Group();
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 40, 40), track(list, new THREE.MeshBasicMaterial({ color: 0x5a7fb8, wireframe: true }), 0.42));
      grid.rotation.x = -Math.PI / 2; grid.position.y = -3;
      const gp = grid.geometry.attributes.position;
      for (let i = 0; i < gp.count; i++) gp.setZ(i, Math.sin(gp.getX(i) * 0.15) * Math.cos(gp.getY(i) * 0.12) * 2.5);
      gp.needsUpdate = true; g.add(grid);
      return {
        group: g, fog: 0x06050d, density: 0.012, hemi: [0x303048, 0x0a0a12, 0.35], sun: [0x8899cc, 0.2],
        update(dt, t) { grid.position.z = (t * 2) % 4; },
      };
    },
  };

  // ------------------------------------------------------------------ the borders
  // What stands at the threshold differs by source: a gate, a wall, a river, a drop.
  const BORDER = {
    ring(list) { const m = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.06, 8, 64), track(list, new THREE.MeshBasicMaterial({ color: 0xd8a84a }), 0.85)); m.position.z = -25; return { group: m }; },
    gate(list) {
      const g = new THREE.Group(); g.position.z = -30;
      [-3.2, 3.2].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 11, 1.1), track(list, new THREE.MeshLambertMaterial({ color: 0xe0cfa0 }), 0.95)); p.position.set(x, 2.5, 0); g.add(p); });
      const l = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.3, 1.4), track(list, new THREE.MeshLambertMaterial({ color: 0xe0cfa0 }), 0.95)); l.position.y = 8.6; g.add(l);
      const o = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 10.4), track(list, new THREE.MeshBasicMaterial({ color: 0xfff2cf, blending: THREE.AdditiveBlending, depthWrite: false }), 0.45)); o.position.y = 2.4; g.add(o);
      return { group: g };
    },
    wall(list) {
      const g = new THREE.Group(); g.position.z = -32;
      [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(44, 22, 2.4), track(list, new THREE.MeshLambertMaterial({ color: 0xa89a7c }), 0.95)); w.position.set(s * 25, 5, 0); g.add(w); });
      const top = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 2.4), track(list, new THREE.MeshLambertMaterial({ color: 0xa89a7c }), 0.95)); top.position.y = 11.5; g.add(top);
      return { group: g };
    },
    river(list) {
      const g = new THREE.Group();
      const r = flatSheet(list, 300, 26, 48, 0x070e1a, -2.75, -34, 0.95); g.add(r);
      g.add(scatter(list, 700, 1.6, ["#cdd5e2"], o => { o[0] = rnd(-90, 90); o[1] = rnd(-2.6, 1.5); o[2] = rnd(-46, -22); }, 0.14));
      return { group: g, update(dt, t) { ripple(r, t, 0.2, 0.3); } };
    },
    cliff(list) {
      const g = new THREE.Group();
      const lip = new THREE.Mesh(new THREE.BoxGeometry(200, 1.2, 2), track(list, new THREE.MeshLambertMaterial({ color: 0x5a5244 }), 0.95)); lip.position.set(0, -2.9, -30); g.add(lip);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), track(list, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }), 1));
      v.rotation.x = -Math.PI / 2; v.position.set(0, -3.2, -92); g.add(v);
      return { group: g };
    },
    bridge(list) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 70), track(list, new THREE.MeshLambertMaterial({ color: 0x7a7160 }), 0.95)); s.position.set(0, -2.1, -48); g.add(s);
      const r = flatSheet(list, 260, 160, 40, 0x050b16, -6.5, -60, 0.95); g.add(r);
      return { group: g, update(dt, t) { ripple(r, t, 0.25, 0.12); } };
    },
  };

  // ------------------------------------------------------------------ the walk
  // opts: { canvas, box, stages, cold, stageMs, onStage(i,key,v,label,text,place), loop }
  // stages: [key, strength] for a collective walk, or
  //         { key, v, terrain, border, text } for one reported vision.
  function create(opts) {
    const { canvas, box } = opts;
    if (!window.THREE) return null;
    let stages = (opts.stages || []).map(s => Array.isArray(s) ? { key: s[0], v: s[1] } : Object.assign({}, s))
      .filter(s => s.v !== null && s.v !== undefined);
    if (!stages.length) stages = [{ key: "peace", v: 0.4 }];
    const cold = !!opts.cold, stageMs = opts.stageMs || 9000;
    let idx = 0, t0 = performance.now(), paused = false, gone = false;

    // The place you are in carries forward until the walk names a new one.
    let carry = opts.terrain || null;
    stages.forEach(s => { if (s.terrain) carry = s.terrain; s.place = carry; });
    const first = stages.find(s => s.place);
    stages.forEach(s => { if (!s.place) s.place = first ? first.place : "abstract"; });
    // A walk can cross more than one kind of threshold: Drythelm meets a pit and
    // then a wall, Tundale two bridges. Each named kind is built.
    stages.forEach(s => { if (s.key === "border" && !s.border) s.border = opts.border || "ring"; });

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x06050d, 0.05);
    const cam = new THREE.PerspectiveCamera(70, 16 / 10, 0.1, 700);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404050, 0); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0); sun.position.set(-50, 70, -40); scene.add(sun);

    const tex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,245,220,1)"); g.addColorStop(.3, "rgba(255,230,170,.8)"); g.addColorStop(1, "rgba(255,220,150,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();

    // The air: motes that carry the tunnel and the light.
    const N = 2200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[3 * i + 2] = -Math.random() * 140; seed[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const dustMat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(geo, dustMat));

    const sp = color => new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    const halo = sp(0xfff0cf), light = sp(0xffffff), core = sp(0xffffff);
    [halo, light, core].forEach(s => { s.position.z = -58; scene.add(s); });

    // The bedside you leave.
    const room = new THREE.Group(); scene.add(room);
    const mats = [];
    const addRoom = (geom, color, y, z) => { const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })); m.position.set(0, y, z); mats.push(m.material); room.add(m); return m; };
    const floor = addRoom(new THREE.PlaneGeometry(14, 10), 0x1a1830, -2.2, -6); floor.rotation.x = -Math.PI / 2;
    addRoom(new THREE.BoxGeometry(2.2, .4, 5), 0x2b2746, -1.9, -6);
    const body = addRoom(new THREE.CapsuleGeometry(.42, 2.6, 6, 12), 0x3a3560, -1.45, -6); body.rotation.x = Math.PI / 2;

    // The presences, as standing figures rather than smudges of light.
    const figures = [];
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: figureTexture(), color: cold ? 0x7b8299 : 0xdce9ff, transparent: true, depthWrite: false, fog: true }));
      s.scale.set(1.1, 2.7, 1); s.position.set((Math.random() - .5) * 9, -1.6, -14 - Math.random() * 46);
      s.material.opacity = 0; s.userData.phase = Math.random() * 6; figures.push(s); scene.add(s);
    }

    // The life review: scenes hanging in the air.
    const frames = [];
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .9), new THREE.MeshBasicMaterial({ color: 0xefe9dc, transparent: true, opacity: 0, side: THREE.DoubleSide })); f.position.set((Math.random() - .5) * 9, (Math.random() - .5) * 5, -8 - Math.random() * 50); f.rotation.y = Math.random(); frames.push(f); scene.add(f); }

    // Places and thresholds are built the first time the walk needs them.
    const built = {}, alpha = {};
    function ensure(name) {
      if (!BUILD[name]) name = "abstract";
      if (!built[name]) { const list = []; const o = BUILD[name](list); o.list = list; scene.add(o.group); o.group.visible = false; built[name] = o; alpha[name] = 0; }
      return built[name];
    }
    stages.forEach(s => { s.place = BUILD[s.place] ? s.place : "abstract"; ensure(s.place); });
    const bords = {}, bAlpha = {};
    stages.forEach(s => {
      if (!s.border) return;
      const k = BORDER[s.border] ? s.border : "ring"; s.border = k;
      if (bords[k]) return;
      const list = []; const o = BORDER[k](list); o.list = list; scene.add(o.group); o.group.visible = false;
      bords[k] = o; bAlpha[k] = 0;
    });

    let yaw = 0, pitch = 0, drag = false, lx = 0, ly = 0;
    const down = e => { drag = true; lx = e.clientX; ly = e.clientY; };
    const move = e => { if (!drag) return; yaw -= (e.clientX - lx) * .004; pitch = Math.max(-1, Math.min(1, pitch - (e.clientY - ly) * .004)); lx = e.clientX; ly = e.clientY; };
    const up = () => drag = false;
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); addEventListener("pointerup", up);

    function resize() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    addEventListener("resize", resize); resize();

    const ALIAS = { messengers: "beings", ledger: "review", error: "review" };
    const cur = { dead: 0, obe: 0, peace: 0, tunnel: 0, light: 0, beings: 0, realm: 0, review: 0, border: 0, ret: 0 };
    const lerp = (a, b, k) => a + (b - a) * k;
    const fogC = new THREE.Color(0x06050d), tmp = new THREE.Color();
    function announce() {
      const s = stages[idx];
      const text = s.text || (cold ? DARK : DESC)[s.key] || DESC[s.key] || "";
      opts.onStage && opts.onStage(idx, s.key, s.v, s.label || LABEL[s.key] || s.key, text, PLACE[s.place] || "");
    }
    announce();

    let t = 0, last = performance.now();
    (function frame(now) {
      if (gone) return;
      requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!paused) {
        t += dt;
        if (now - t0 > stageMs) {
          t0 = now; idx++;
          if (idx >= stages.length) {
            if (opts.loop === false) { idx = stages.length - 1; paused = true; opts.onEnd && opts.onEnd(); }
            else idx = 0;
          }
          announce();
        }
      }
      const at = {}; stages.forEach((s, i) => { const k = ALIAS[s.key] || s.key; if (at[k] === undefined) at[k] = i; });
      const tgt = k => { const i = at[k]; if (i === undefined) return 0; const d = idx - i; return d === 0 ? stages[i].v : (d > 0 && d <= 2 ? stages[i].v * .3 : 0); };
      const kk = 1 - Math.pow(.001, dt);
      cur.dead = lerp(cur.dead, tgt("dead"), kk);
      cur.obe = lerp(cur.obe, tgt("obe"), kk);
      cur.peace = lerp(cur.peace, cold ? 0 : Math.max(tgt("peace"), at.peace !== undefined && idx > at.peace ? stages[at.peace].v * .5 : 0), kk);
      cur.tunnel = lerp(cur.tunnel, tgt("tunnel"), kk);
      cur.light = lerp(cur.light, (cold ? .12 : 1) * Math.max(tgt("light"), at.light !== undefined && idx > at.light ? stages[at.light].v * .5 : 0), kk);
      cur.beings = lerp(cur.beings, tgt("beings"), kk);
      cur.realm = lerp(cur.realm, tgt("realm"), kk);
      cur.review = lerp(cur.review, tgt("review"), kk);
      cur.border = lerp(cur.border, tgt("border"), kk);
      cur.ret = lerp(cur.ret, tgt("return"), kk);

      // The place fades up when the walk reaches it and stays until it changes.
      const here = stages[idx].place;
      let tot = 0, fr = 0, fg = 0, fb = 0, hr = 0, hg = 0, hb = 0, gr = 0, gg = 0, gb = 0, sr = 0, sg = 0, sb = 0, hi = 0, si = 0, dens = 0;
      Object.keys(built).forEach(name => {
        const o = built[name];
        alpha[name] = lerp(alpha[name], name === here ? 1 : 0, kk * 0.5);
        const a = alpha[name];
        o.group.visible = a > 0.004;
        if (!o.group.visible) return;
        o.list.forEach(([m, base]) => m.opacity = base * a);
        o.update && o.update(dt, t);
        tot += a;
        tmp.set(o.fog); fr += tmp.r * a; fg += tmp.g * a; fb += tmp.b * a;
        tmp.set(o.hemi[0]); hr += tmp.r * a; hg += tmp.g * a; hb += tmp.b * a;
        tmp.set(o.hemi[1]); gr += tmp.r * a; gg += tmp.g * a; gb += tmp.b * a;
        tmp.set(o.sun[0]); sr += tmp.r * a; sg += tmp.g * a; sb += tmp.b * a;
        hi += o.hemi[2] * a; si += o.sun[1] * a; dens += o.density * a;
      });
      if (tot > 0.01) {
        tmp.setRGB(fr / tot, fg / tot, fb / tot);
        hemi.color.setRGB(hr / tot, hg / tot, hb / tot); hemi.groundColor.setRGB(gr / tot, gg / tot, gb / tot);
        sun.color.setRGB(sr / tot, sg / tot, sb / tot);
        const k = Math.min(1, tot);
        hemi.intensity = (hi / tot) * k; sun.intensity = (si / tot) * k;
        dens = dens / tot;
      } else { tmp.set(0x06050d); hemi.intensity = 0; sun.intensity = 0; dens = 0.012; }
      fogC.lerp(tmp, kk * 0.5);
      scene.fog.color.copy(fogC); renderer.setClearColor(fogC);

      const speed = (3 + 10 * cur.tunnel + 4 * cur.realm) * (1 - 1.8 * cur.ret);
      const p = geo.attributes.position.array, c = geo.attributes.color.array;
      for (let i = 0; i < N; i++) {
        p[3 * i + 2] += speed * dt; if (p[3 * i + 2] > 2) p[3 * i + 2] -= 140; if (p[3 * i + 2] < -140) p[3 * i + 2] += 140;
        const rr = 3 + (1 - cur.tunnel) * 9 + seed[i] * 3, a = seed[i] * 6.283 + t * .12 * (.5 + cur.tunnel);
        p[3 * i] = Math.cos(a) * rr; p[3 * i + 1] = Math.sin(a) * rr;
        const warm = cold ? .05 : .35 + .65 * cur.peace, lit = cold ? 0 : cur.light;
        const nr = Math.max(0, 1 + p[3 * i + 2] / 70) * lit;
        c[3 * i] = Math.min(1, (cold ? .25 : .4) + .6 * warm + .5 * nr);
        c[3 * i + 1] = Math.min(1, (cold ? .3 : .35) + .45 * warm * (.5 + lit) + .45 * nr);
        c[3 * i + 2] = Math.min(1, (cold ? .55 : .75) - .35 * warm + .25 * lit + .3 * nr);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      // Once you are standing somewhere, the motes get out of the way of it.
      dustMat.opacity = (.4 + .6 * Math.max(cur.tunnel, cur.light, cur.dead * .5)) * (1 - .72 * Math.min(1, tot));

      const L = cur.light, near = -58 + 40 * L;
      [halo, light, core].forEach(s => s.position.z = near);
      halo.scale.setScalar((14 + 70 * L) * (1 + .04 * Math.sin(t * .8))); halo.material.opacity = .54 * L;
      light.scale.setScalar(7 + 34 * L); light.material.opacity = .9 * L;
      core.scale.setScalar(2.2 + 11 * L); core.material.opacity = L;
      scene.fog.density = Math.max(.0025, dens + .045 * cur.tunnel - .006 * L + .02 * cur.dead);
      mats.forEach(m => m.opacity = cur.obe * .9);
      figures.forEach((s, i) => {
        const on = i < Math.round(cur.beings * 22 + .49); s.visible = on; if (!on) return;
        s.position.z += speed * dt * (cold ? .08 : .3);
        if (s.position.z > (cold ? -6 : 1)) s.position.z = -60;
        s.material.opacity = cur.beings * (.4 + .4 * Math.sin(t + s.userData.phase) ** 2);
      });
      frames.forEach((f, i) => { f.visible = cur.review > .02; f.material.opacity = cur.review * (.14 + .14 * Math.sin(t * .7 + i)); f.position.z += speed * dt * .4; if (f.position.z > 1) f.position.z = -58; f.rotation.y += .002; });
      // Whichever threshold the walk is at, or last was at, is the one that shows.
      let bHere = null;
      for (let i = idx; i >= 0; i--) if (stages[i].border) { bHere = stages[i].border; break; }
      Object.keys(bords).forEach(k => {
        const o = bords[k];
        bAlpha[k] = lerp(bAlpha[k], k === bHere ? cur.border : 0, kk);
        o.group.visible = bAlpha[k] > .01;
        o.list.forEach(([m, base]) => m.opacity = base * bAlpha[k]);
        if (o.group.visible && o.update) o.update(dt, t);
      });

      const rise = cur.obe * 3.2;
      cam.rotation.set(pitch * .5 - rise * .18, yaw * .5, 0, "YXZ");
      cam.position.set(Math.sin(t * .4) * .25 * (1 - cur.peace), rise + Math.cos(t * .3) * .15 * (1 - cur.peace), 0);
      renderer.render(scene, cam);
    })(performance.now());

    return {
      next() { idx = (idx + 1) % stages.length; t0 = performance.now(); paused = false; announce(); },
      // Append what comes after the account stops, and carry straight on into it.
      extend(more) {
        const from = stages.length;
        more.forEach(m => {
          const s2 = Object.assign({ v: 0.82 }, m);
          if (!s2.terrain) s2.terrain = stages[stages.length - 1].place;
          s2.place = BUILD[s2.terrain] ? s2.terrain : "abstract";
          ensure(s2.place);
          if (s2.border) {
            const k = BORDER[s2.border] ? s2.border : "ring"; s2.border = k;
            if (!bords[k]) { const l = []; const o = BORDER[k](l); o.list = l; scene.add(o.group); o.group.visible = false; bords[k] = o; bAlpha[k] = 0; }
          }
          stages.push(s2);
        });
        idx = from; t0 = performance.now(); paused = false; announce();
        return stages.length;
      },
      pause(v) { paused = v === undefined ? !paused : v; return paused; },
      destroy() { gone = true; removeEventListener("resize", resize); removeEventListener("pointerup", up); renderer.dispose(); },
      stages, LABEL
    };
  }
  return { create, LABEL, DESC, PLACE };
})();
