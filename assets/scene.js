// The staged passage, shared by the World page and the map's pop-up preview.
// It renders only what it is given: a list of stages and, for each, how strongly it is present.
// Nothing here invents a number; the caller supplies them from the cited data.
window.TAScene = (function () {
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

  // opts: { canvas, box, stages:[[key,strength 0..1 | null]], cold:bool, stageMs, onStage(i,key,strength), loop:bool }
  function create(opts) {
    const { canvas, box } = opts;
    if (!window.THREE) return null;
    let stages = opts.stages.filter(s => s[1] !== null && s[1] !== undefined);
    if (!stages.length) stages = [["peace", 0.4]];
    const cold = !!opts.cold, stageMs = opts.stageMs || 9000;
    let idx = 0, t0 = performance.now(), paused = false, dead = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x06050d, 0.05);
    const cam = new THREE.PerspectiveCamera(70, 16 / 10, 0.1, 300);

    const tex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,245,220,1)"); g.addColorStop(.3, "rgba(255,230,170,.8)"); g.addColorStop(1, "rgba(255,220,150,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const N = 2200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[3 * i + 2] = -Math.random() * 140; seed[i] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const dustMat = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(geo, dustMat));

    const sp = (color, fog) => new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, fog: !!fog, blending: THREE.AdditiveBlending }));
    const halo = sp(0xfff0cf), light = sp(0xffffff), core = sp(0xffffff);
    [halo, light, core].forEach(s => { s.position.z = -58; scene.add(s); });

    const room = new THREE.Group(); scene.add(room);
    const mats = [];
    const addRoom = (geom, color, y, z) => { const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })); m.position.set(0, y, z); mats.push(m.material); room.add(m); return m; };
    const floor = addRoom(new THREE.PlaneGeometry(14, 10), 0x1a1830, -2.2, -6); floor.rotation.x = -Math.PI / 2;
    addRoom(new THREE.BoxGeometry(2.2, .4, 5), 0x2b2746, -1.9, -6);
    const body = addRoom(new THREE.CapsuleGeometry(.42, 2.6, 6, 12), 0x3a3560, -1.45, -6); body.rotation.x = Math.PI / 2;

    const beings = [];
    for (let i = 0; i < 20; i++) { const s = sp(cold ? 0x6b7390 : 0xbfd8ff, true); s.scale.set(.6, 1.6, 1); s.position.set((Math.random() - .5) * 7, (Math.random() - .5) * 3, -15 - Math.random() * 40); s.material.opacity = 0; s.userData.phase = Math.random() * 6; beings.push(s); scene.add(s); }

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 36, 36), new THREE.MeshBasicMaterial({ color: cold ? 0x4a4a62 : 0x5a7fb8, wireframe: true, transparent: true, opacity: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -3;
    const gp = ground.geometry.attributes.position;
    for (let i = 0; i < gp.count; i++) gp.setZ(i, Math.sin(gp.getX(i) * .15) * Math.cos(gp.getY(i) * .12) * 2.5);
    gp.needsUpdate = true; scene.add(ground);

    const frames = [];
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .9), new THREE.MeshBasicMaterial({ color: 0xefe9dc, transparent: true, opacity: 0, side: THREE.DoubleSide })); f.position.set((Math.random() - .5) * 9, (Math.random() - .5) * 5, -8 - Math.random() * 50); f.rotation.y = Math.random(); frames.push(f); scene.add(f); }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, .05, 8, 64), new THREE.MeshBasicMaterial({ color: cold ? 0x4a5478 : 0xd8a84a, transparent: true, opacity: 0 }));
    ring.position.z = -25; scene.add(ring);

    let yaw = 0, pitch = 0, drag = false, lx = 0, ly = 0;
    const down = e => { drag = true; lx = e.clientX; ly = e.clientY; };
    const move = e => { if (!drag) return; yaw -= (e.clientX - lx) * .004; pitch = Math.max(-1, Math.min(1, pitch - (e.clientY - ly) * .004)); lx = e.clientX; ly = e.clientY; };
    const up = () => drag = false;
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); addEventListener("pointerup", up);

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function resize() { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    addEventListener("resize", resize); resize();

    const ALIAS = { messengers: "beings", ledger: "realm", error: "review" };
    const cur = { dead: 0, obe: 0, peace: 0, tunnel: 0, light: 0, beings: 0, realm: 0, review: 0, border: 0, ret: 0 };
    const lerp = (a, b, k) => a + (b - a) * k;
    function announce() { opts.onStage && opts.onStage(idx, stages[idx][0], stages[idx][1], LABEL[stages[idx][0]], (cold ? DARK : DESC)[stages[idx][0]] || DESC[stages[idx][0]] || ""); }
    announce();

    let t = 0, last = performance.now();
    (function frame(now) {
      if (dead) return;
      requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!paused) {
        t += dt;
        if (now - t0 > stageMs) { t0 = now; idx++; if (idx >= stages.length) { if (opts.loop === false) { idx = stages.length - 1; paused = true; } else idx = 0; } announce(); }
      }
      const pos2 = {}; stages.forEach(([k], i) => pos2[ALIAS[k] || k] = i);
      const tgt = k => { const i = pos2[k]; if (i === undefined) return 0; const d = idx - i; return d === 0 ? stages[i][1] : (d > 0 && d <= 2 ? stages[i][1] * .3 : 0); };
      const kk = 1 - Math.pow(.001, dt);
      cur.dead = lerp(cur.dead, tgt("dead"), kk);
      cur.obe = lerp(cur.obe, tgt("obe"), kk);
      cur.peace = lerp(cur.peace, cold ? 0 : Math.max(tgt("peace"), pos2.peace !== undefined && idx > pos2.peace ? stages[pos2.peace][1] * .5 : 0), kk);
      cur.tunnel = lerp(cur.tunnel, tgt("tunnel"), kk);
      cur.light = lerp(cur.light, (cold ? .12 : 1) * Math.max(tgt("light"), pos2.light !== undefined && idx > pos2.light ? stages[pos2.light][1] * .5 : 0), kk);
      cur.beings = lerp(cur.beings, tgt("beings"), kk);
      cur.realm = lerp(cur.realm, tgt("realm"), kk);
      cur.review = lerp(cur.review, tgt("review"), kk);
      cur.border = lerp(cur.border, tgt("border"), kk);
      cur.ret = lerp(cur.ret, tgt("return"), kk);

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
      dustMat.opacity = .4 + .6 * Math.max(cur.tunnel, cur.light, cur.dead * .5, cur.realm * .5);

      const L = cur.light, near = -58 + 40 * L;
      [halo, light, core].forEach(s => s.position.z = near);
      halo.scale.setScalar((14 + 70 * L) * (1 + .04 * Math.sin(t * .8))); halo.material.opacity = .14 * L + .4 * L;
      light.scale.setScalar(7 + 34 * L); light.material.opacity = .9 * L;
      core.scale.setScalar(2.2 + 11 * L); core.material.opacity = L;
      scene.fog.density = .012 + .045 * cur.tunnel - .008 * L + .03 * cur.dead;
      mats.forEach(m => m.opacity = cur.obe * .9);
      beings.forEach((s, i) => { const on = i < Math.round(cur.beings * 20 + .49); s.visible = on; if (on) { s.position.z += speed * dt * (cold ? .08 : .3); if (s.position.z > (cold ? -6 : 1)) s.position.z = -60; s.material.opacity = cur.beings * (.3 + .4 * Math.sin(t + s.userData.phase) ** 2); } });
      ground.material.opacity = cur.realm * .4; ground.position.z = (t * 2) % 3;
      frames.forEach((f, i) => { f.visible = cur.review > .02; f.material.opacity = cur.review * (.12 + .12 * Math.sin(t * .7 + i)); f.position.z += speed * dt * .4; if (f.position.z > 1) f.position.z = -58; f.rotation.y += .002; });
      ring.material.opacity = cur.border * .8; ring.scale.setScalar(1 + .08 * Math.sin(t * 1.5));
      const rise = cur.obe * 3.2;
      cam.rotation.set(pitch * .5 - rise * .18, yaw * .5, 0, "YXZ");
      cam.position.set(Math.sin(t * .4) * .25 * (1 - cur.peace), rise + Math.cos(t * .3) * .15 * (1 - cur.peace), 0);
      renderer.render(scene, cam);
    })(performance.now());

    return {
      next() { idx = (idx + 1) % stages.length; t0 = performance.now(); paused = false; announce(); },
      pause(v) { paused = v === undefined ? !paused : v; return paused; },
      destroy() { dead = true; removeEventListener("resize", resize); removeEventListener("pointerup", up); renderer.dispose(); },
      stages, LABEL
    };
  }
  return { create, LABEL, DESC };
})();
