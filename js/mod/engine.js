// Motor modular 3D: personajes montados con piezas CC0 (cuerpo, peinado, ropa y
// accesorios de Quaternius) que comparten un mismo esqueleto, animados con las
// Universal Animation Library. Todo es dominio público (CC0): se puede vender.
//
// - Las piezas se "cosen" al esqueleto del cuerpo por nombre de hueso.
// - La piel que queda bajo la ropa se oculta por zonas (evita que atraviese).
// - Sombreado toon de 3 tonos y contorno exterior, como el resto de la app.
// - Mismas vistas y exportaciones que los demás motores.
SC.mod = (() => {
  const T = window.THREE, X = window.SCVRM;
  const available = !!(T && X && (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  })());

  // ---------- Catálogo ----------
  const SETS = { Peasant: 'Campesino', Ranger: 'Explorador' };
  const SLOTS = [
    { id: 'top', label: 'Torso', key: 'Body', hides: ['chest'] },
    { id: 'arms', label: 'Brazos', key: 'Arms', hides: ['upperarm', 'lowerarm', 'hand'] },
    { id: 'bottom', label: 'Piernas', key: 'Legs', hides: ['hips', 'thigh', 'calf'] },
    { id: 'shoes', label: 'Calzado', key: 'Feet', hides: ['foot'] },
    { id: 'head', label: 'Cabeza', key: 'Head', hides: [] },
    { id: 'acc', label: 'Accesorios', key: 'Acc', hides: [] },
  ];
  const HAIRS = {
    Hair_Long: 'Largo', Hair_SimpleParted: 'Raya al lado', Hair_Buns: 'Moños', Hair_Buzzed: 'Rapado', Hair_BuzzedFemale: 'Rapado corto',
  };
  const DEFAULT = {
    sex: 'f', hair: 'Hair_Long', beard: false,
    parts: { top: 'Ranger', arms: 'Ranger', bottom: 'Ranger', shoes: 'Ranger', head: null, acc: null },
    colors: {},
  };

  // Animaciones de la app → clips de la Universal Animation Library, más clips extra.
  const CLIP_FOR = {
    idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', jump: 'NinjaJump_Start', wave: 'Interact',
    attack: 'Sword_Attack', talk: 'Idle_Talking_Loop', blink: 'Idle_Loop',
  };
  const EXTRA = [
    ['Sprint_Loop', 'Esprintar'], ['Walk_Formal_Loop', 'Caminar formal'], ['Crouch_Fwd_Loop', 'Andar agachado'], ['Crouch_Idle_Loop', 'Agachado'],
    ['Roll', 'Rodar'], ['Jump_Start', 'Salto (inicio)'], ['Jump_Land', 'Salto (caída)'], ['Sword_Regular_Combo', 'Combo de espada'], ['Sword_Block', 'Bloquear'],
    ['Sword_Heavy_Combo', 'Combo pesado'], ['Punch_Jab', 'Puñetazo'], ['Punch_Cross', 'Directo'], ['Melee_Hook', 'Gancho'],
    ['Spell_Simple_Shoot', 'Lanzar hechizo'], ['Spell_Simple_Idle_Loop', 'Preparar hechizo'], ['Pistol_Shoot', 'Disparar'], ['Pistol_Idle_Loop', 'Apuntar'],
    ['OverhandThrow', 'Lanzar'], ['Shield_Dash', 'Carga con escudo'], ['Hit_Chest', 'Recibir golpe'], ['Hit_Knockback', 'Salir despedido'],
    ['Death01', 'Morir'], ['Dance_Loop', 'Bailar'], ['Yes', 'Asentir'], ['Idle_No_Loop', 'Negar'], ['Idle_FoldArms_Loop', 'Brazos cruzados'],
    ['Idle_TalkingPhone_Loop', 'Hablar por teléfono'], ['Sitting_Idle_Loop', 'Sentado'], ['Sitting_Talking_Loop', 'Sentado hablando'],
    ['PickUp_Table', 'Coger objeto'], ['Consume', 'Beber'], ['Walk_Carry_Loop', 'Cargar'], ['Push_Loop', 'Empujar'],
    ['Farm_Watering', 'Regar'], ['Farm_Harvest', 'Cosechar'], ['TreeChopping_Loop', 'Talar'], ['Fixing_Kneeling', 'Reparar'],
    ['Chest_Open', 'Abrir cofre'], ['ClimbUp_1m', 'Trepar'], ['Swim_Fwd_Loop', 'Nadar'], ['Idle_Lantern_Loop', 'Con farol'],
    ['Zombie_Walk_Fwd_Loop', 'Zombi'], ['Zombie_Scratch', 'Zombi ataca'],
  ];

  // Zona del cuerpo según el hueso que más pesa en cada vértice.
  function regionOf(bone) {
    if (/^(Head|neck)/.test(bone)) return 'head';
    if (/^(spine|clavicle)/.test(bone)) return 'chest';
    if (/^(pelvis|root)/.test(bone)) return 'hips';
    if (/^upperarm/.test(bone)) return 'upperarm';
    if (/^lowerarm/.test(bone)) return 'lowerarm';
    if (/^(hand|index|middle|ring|pinky|thumb)/.test(bone)) return 'hand';
    if (/^thigh/.test(bone)) return 'thigh';
    if (/^calf/.test(bone)) return 'calf';
    return 'foot';
  }

  // ---------- Carga de paquetes (assets/mod/*.js) ----------
  const packs = {};
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('No se encontró ' + src));
      document.head.appendChild(s);
    });
  }
  async function pack(id) {
    if (packs[id]) return packs[id];
    const D = window.SC_MOD_DATA || {};
    if (!D[id]) await loadScript('assets/mod/' + id + '.js');
    const bin = atob(window.SC_MOD_DATA[id]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    delete window.SC_MOD_DATA[id];
    const gltf = await new X.GLTFLoader().parseAsync(buf.buffer, '');
    // Guarda la matriz de unión de cada malla con piel: se vuelven a unir al
    // esqueleto del cuerpo en modo "detached" (sólo cuentan los huesos).
    for (const sc of gltf.scenes) {
      sc.updateMatrixWorld(true);
      sc.traverse((o) => {
        o.frustumCulled = false;
        if (o.isSkinnedMesh) { o.userData.bindWorld = o.matrixWorld.clone(); o.userData.skel0 = o.skeleton; }
        if (o.isMesh) o.material = toon(o.material);
      });
    }
    // Lista fija de mallas: al montar un personaje se mueven a otra escena.
    gltf.userData.meshes = [];
    for (const sc of gltf.scenes) sc.traverse((o) => { if (o.isSkinnedMesh) gltf.userData.meshes.push(o); });
    packs[id] = gltf;
    return gltf;
  }

  // Material toon de 3 tonos con la textura original.
  let ramp = null;
  function toon(m) {
    if (m.userData && m.userData.isToon) return m;
    if (!ramp) {
      ramp = new T.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat);
      ramp.minFilter = ramp.magFilter = T.NearestFilter;
      ramp.needsUpdate = true;
    }
    const t = new T.MeshToonMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, gradientMap: ramp, name: m.name, side: T.DoubleSide });
    t.userData.isToon = true;
    t.userData.map0 = t.map;
    return t;
  }

  // ---------- Escena ----------
  let renderer = null, scene = null, camera = null, root = null, parts = null;
  let body = null, mixer = null, clips = {}, rest = null, cfg = null, built = false, info = null;
  let groups = [];

  function setup() {
    if (renderer) return;
    const canvas = document.createElement('canvas');
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    scene = new T.Scene();
    const key = new T.DirectionalLight(0xffffff, 2.2);
    key.position.set(-1, 1.4, 1.2).normalize();
    scene.add(key);
    scene.add(new T.AmbientLight(0xffffff, 1.1));
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
    root = new T.Group();
    parts = new T.Group();
    scene.add(root, parts);
  }

  // Parte la malla del cuerpo en zonas que se pueden ocultar bajo la ropa.
  function splitBody(mesh) {
    if (mesh.userData.regions) return mesh.userData.regions;
    const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const bones = mesh.skeleton.bones.map((b) => b.name);
    const vreg = new Array(si.count);
    for (let v = 0; v < si.count; v++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
      vreg[v] = regionOf(bones[best] || '');
    }
    const idx = g.index ? g.index.array : Array.from({ length: si.count }, (_, i) => i);
    const lists = {};
    for (let t = 0; t < idx.length; t += 3) {
      const a = vreg[idx[t]], b = vreg[idx[t + 1]], c = vreg[idx[t + 2]];
      const r = a === b || a === c ? a : b === c ? b : a;
      (lists[r] = lists[r] || []).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    const regions = {};
    for (const [r, list] of Object.entries(lists)) {
      const geo = new T.BufferGeometry();
      for (const [name, attr] of Object.entries(g.attributes)) geo.setAttribute(name, attr);
      geo.setIndex(list);
      const m = new T.SkinnedMesh(geo, mesh.material);
      m.name = mesh.name + ':' + r;
      m.frustumCulled = false;
      m.userData.bindWorld = mesh.userData.bindWorld;
      m.userData.skel0 = mesh.userData.skel0;
      regions[r] = m;
    }
    mesh.userData.regions = regions;
    return regions;
  }

  // Une una malla al esqueleto del cuerpo actual por nombre de hueso.
  function attach(mesh, byName) {
    const s0 = mesh.userData.skel0;
    const bones = s0.bones.map((b) => byName[b.name] || b);
    mesh.bindMode = T.DetachedBindMode || 'detached';
    mesh.bind(new T.Skeleton(bones, s0.boneInverses), mesh.userData.bindWorld);
    // Fuera del grupo que gira: los huesos ya llevan el giro de la vista.
    parts.add(mesh);
  }

  const meshesOf = (gltf) => gltf.userData.meshes;

  // Monta el personaje con la configuración actual.
  async function build(c) {
    if (!available) throw new Error('Este navegador no tiene WebGL');
    setup();
    cfg = JSON.parse(JSON.stringify(Object.assign({}, DEFAULT, c || cfg || {})));
    const sex = cfg.sex === 'm' ? 'm' : 'f';
    const [bodyPack, hairPack, outfitPack, animPack] = await Promise.all([pack('body_' + sex), pack('hair'), pack('outfit_' + sex), pack('anims')]);
    root.clear();
    parts.clear();
    body = bodyPack.scene;
    body.position.set(0, 0, 0);
    root.add(body);
    body.updateMatrixWorld(true);
    const byName = {};
    body.traverse((o) => { if (o.isBone) byName[o.name] = o; });

    // Qué zonas del cuerpo tapa la ropa elegida.
    const hide = new Set();
    const chosen = [];
    for (const sl of SLOTS) {
      const set = cfg.parts[sl.id];
      if (!set) continue;
      const prefix = (sex === 'm' ? 'Male_' : 'Female_') + set + '_' + sl.key;
      const ms = meshesOf(outfitPack).filter((m) => m.name.startsWith(prefix));
      if (!ms.length) continue;
      sl.hides.forEach((h) => hide.add(h));
      if (ms.some((m) => /Boots/.test(m.name))) hide.add('calf');
      chosen.push(...ms.map((m) => ({ mesh: m, group: 'part:' + sl.id, label: sl.label + ' · ' + (SETS[set] || set) })));
    }
    const hood = !!cfg.parts.head;
    // Cuerpo por zonas (y ojos y cejas tal cual).
    const bodyMeshes = meshesOf(bodyPack);
    for (const m of bodyMeshes) {
      m.visible = false;
      if (/Eyes|Eyebrows/.test(m.name)) continue;
      for (const [r, rm] of Object.entries(splitBody(m))) {
        if (hide.has(r)) continue;
        chosen.push({ mesh: rm, group: 'skin', label: 'Piel' });
      }
    }
    for (const m of bodyMeshes) if (/Eyes/.test(m.name)) chosen.push({ mesh: m, group: 'eyes', label: 'Ojos' });
    // Pelo (la capucha lo oculta), barba y cejas: mismo color.
    for (const m of meshesOf(hairPack)) {
      if ((m.name === cfg.hair && !hood) || (m.name === 'Hair_Beard' && cfg.beard && sex === 'm')) chosen.push({ mesh: m, group: 'hair', label: 'Pelo' });
    }
    for (const m of bodyMeshes) if (/Eyebrows/.test(m.name)) chosen.push({ mesh: m, group: 'hair', label: 'Pelo' });
    for (const it of chosen) {
      it.mesh.visible = true;
      attach(it.mesh, byName);
      // La ropa trae también trozos de piel (manos, cuello): van con la piel.
      if (/Regular_(Female|Male)|Superhero/.test(it.mesh.material.name)) { it.group = 'skin'; it.label = 'Piel'; }
    }

    // Animaciones.
    mixer = new T.AnimationMixer(body);
    clips = {};
    for (const a of animPack.animations) clips[a.name] = a;
    collectGroups(chosen);
    measure();
    built = true;
    info = {
      name: 'Personaje modular', authors: ['Quaternius'], license: 'CC0 1.0 (dominio público)',
      commercial: 'permitido', redistribution: 'permitida', credit: 'no obligatorio',
    };
    return info;
  }

  // ---------- Colores por grupo (piel, pelo, ojos y cada prenda) ----------
  function collectGroups(items) {
    const prev = {};
    for (const g of groups) prev[g.id] = g.color;
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.group)) map.set(it.group, { id: it.group, label: it.label, meshes: [], cloth: it.group.startsWith('part:') });
      map.get(it.group).meshes.push(it.mesh);
    }
    groups = [...map.values()];
    const order = ['hair', 'eyes', 'skin'];
    groups.sort((a, b) => (order.indexOf(a.id) + 1 || 9) - (order.indexOf(b.id) + 1 || 9));
    for (const g of groups) {
      // Cada grupo con su propio material para recolorear sin afectar a otros.
      const own = new Map();
      for (const m of g.meshes) {
        if (!m.userData.ownMat) {
          // clone() copia userData como JSON: la textura original se vuelve a enlazar.
          const orig = m.material;
          m.material = orig.clone();
          m.material.userData = Object.assign({}, orig.userData);
          m.userData.ownMat = true;
        }
        own.set(m.material.uuid, m.material);
      }
      g.mats = [...own.values()];
      const m0 = g.mats.find((m) => m.userData.map0 && m.userData.map0.image);
      const uv = g.meshes[0].geometry.attributes.uv;
      g.base = m0 ? SC.recolor.baseColor(m0.userData.map0.image, uv ? sampleUV(g.meshes[0]) : null) : '#888888';
      g.color = (cfg.colors && cfg.colors[g.id]) || null;
      if (g.color) applyColor(g);
      else for (const m of g.mats) { m.map = m.userData.map0; m.needsUpdate = true; }
    }
  }

  // Coordenadas UV de los triángulos de una malla (sólo los que usa).
  function sampleUV(mesh) {
    const g = mesh.geometry, uv = g.attributes.uv, idx = g.index ? g.index.array : null;
    const n = idx ? idx.length : uv.count, out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const v = idx ? idx[i] : i; out[i * 2] = uv.getX(v); out[i * 2 + 1] = uv.getY(v); }
    return out;
  }

  function applyColor(g) {
    for (const m of g.mats) {
      if (m.userData.recolored) { m.userData.recolored.dispose(); m.userData.recolored = null; }
      const t0 = m.userData.map0;
      if (g.color && t0 && t0.image) {
        m.userData.recolored = SC.recolor.recolorTexture(t0, g.color, g.base);
        m.map = m.userData.recolored;
      } else {
        m.map = t0;
      }
      m.needsUpdate = true;
    }
  }

  function setGroupColor(id, hex) {
    const g = groups.find((q) => q.id === id);
    if (!g) return;
    g.color = hex;
    cfg.colors = cfg.colors || {};
    if (hex) cfg.colors[id] = hex; else delete cfg.colors[id];
    applyColor(g);
  }

  // ---------- Medidas, pose y render ----------
  const bone = (n) => body.getObjectByName(n);
  const wpos = (n) => { const b = bone(n); return b ? b.getWorldPosition(new T.Vector3()) : new T.Vector3(); };

  function measure() {
    root.rotation.set(0, 0, 0);
    mixer.stopAllAction();
    posePose('idle', 0);
    const box = new T.Box3();
    const head = wpos('Head'), foot = wpos('foot_l'), pel = wpos('pelvis');
    // Altura: de los pies a la coronilla (la cabeza mide ~1/7 del cuerpo).
    const top = head.y + (head.y - wpos('neck_01').y) * 3.1 * 1.12 + 0.04;
    box.set(new T.Vector3(-0.5, Math.min(foot.y - 0.08, 0), -0.3), new T.Vector3(0.5, top, 0.3));
    rest = { top, ground: 0, height: top, head, hips: pel, pelvis: pel.clone() };
  }

  const clipOf = (animId) => clips[CLIP_FOR[animId] || animId] || clips.Idle_Loop;

  // Los clips se muestrean a FPS fotogramas por segundo (entre 4 y 16 fotogramas).
  const FPS = 8;
  function frameCount(animId) {
    const c = clipOf(animId);
    return c ? Math.max(4, Math.min(16, Math.round(c.duration * FPS))) : 4;
  }
  const isLoop = (animId) => { const c = clipOf(animId); return !!c && /Loop|Idle|Sword_Idle/.test(c.name); };

  // Coloca el personaje en el instante t (0..1) del clip, sin desplazarse.
  function posePose(animId, t) {
    const c = clipOf(animId);
    mixer.stopAllAction();
    body.position.set(0, 0, 0);
    if (c) {
      const a = mixer.clipAction(c);
      a.reset().play();
      mixer.setTime(t * c.duration);
    }
    body.updateMatrixWorld(true);
    if (rest) {
      // Animación en el sitio: la cadera no avanza (sí sube y baja).
      const p = wpos('pelvis');
      body.position.x -= p.x - rest.pelvis.x;
      body.position.z -= p.z - rest.pelvis.z;
      body.updateMatrixWorld(true);
    }
  }

  function frameBox(frame) {
    if (frame === 'bust') {
      const top = rest.top + rest.height * 0.03;
      const bottom = rest.head.y - (rest.head.y - rest.hips.y) * 0.62;
      const h = top - bottom;
      return { cx: 0, cy: (top + bottom) / 2, h, w: h * 0.85 };
    }
    const h = rest.height / 0.9;
    return { cx: 0, cy: rest.ground + h * 0.46, h, w: h * 0.6 };
  }

  function renderRaw(W, H, pose, o = {}) {
    setup();
    const P = pose || {};
    posePose(P.animId || 'idle', P.t || 0);
    root.rotation.y = (SC.VIEWS[o.view || 'front'] || SC.VIEWS.front).yaw;
    const head = bone('Head');
    // Cabeza algo mayor que la del modelo (más cerca de las proporciones anime).
    if (head) head.scale.setScalar((o.chibiHead || 1) * (o.headScale || 1.12));
    body.updateMatrixWorld(true);
    const box = frameBox(o.frame);
    if ((o.chibiHead || 1) > 1) { const k = 1 + (o.chibiHead - 1) * 0.22; box.cy += (box.h * (k - 1)) / 2; box.h *= k; }
    const aspect = W / H, hh = box.h / 2, hw = Math.max(box.w / 2, hh * aspect);
    camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
    camera.updateProjectionMatrix();
    const tilt = o.tilt != null ? o.tilt : 0.1, dist = 10;
    camera.position.set(box.cx, box.cy + Math.sin(tilt) * dist, Math.cos(tilt) * dist);
    camera.lookAt(box.cx, box.cy, 0);
    renderer.setSize(W, H, false);
    renderer.render(scene, camera);
    if (head) head.scale.setScalar(1);
    const out = SC.render.makeCanvas(W, H);
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    return out;
  }

  function renderView(W, H, pose, o = {}) {
    const img = renderRaw(W, H, pose, o);
    const out = SC.render.makeCanvas(W, H);
    SC.render.outlineImage(out.getContext('2d'), img, Math.max(1, 1.4 * (H / 1000) * (o.lineWidth != null ? o.lineWidth : 1)), '#3b2a44');
    return out;
  }

  function renderVN(ch, pose, o = {}) {
    const scale = o.scale || 1, Hh = (o.height || SC.CANVAS_H) * scale;
    const W = Math.round(Hh * (o.frame === 'bust' ? 0.85 : 0.6));
    return renderView(W, Math.round(Hh), pose, Object.assign({}, o, { lineWidth: ch && ch.style ? ch.style.lineWidth : 1 }));
  }

  function renderPixelPortrait(ch, pose, o = {}) {
    const W = o.w || 128, H = o.h || 160;
    return SC.render.pixelize(renderRaw(W * 4, H * 4, pose, Object.assign({}, o, { frame: 'bust' })), W, H, Object.assign({ darkBoost: 0.5 }, o));
  }

  function renderPixel(ch, pose, o = {}) {
    const W = o.w || 48, H = o.h || 64;
    return SC.render.pixelize(renderRaw(W * 4, H * 4, pose, Object.assign({}, o, { frame: 'full', tilt: 0.2, chibiHead: o.chibi ? 1.7 : 1 })), W, H, Object.assign({ colors: 32, darkBoost: 0.3 }, o));
  }

  const poseAt = (animId, i, n) => ({ animId, t: i / n });

  function renderAnimation(ch, animId, mode, o = {}) {
    const n = frameCount(animId), frames = [];
    for (let i = 0; i < n; i++) {
      const pose = poseAt(animId, i, n);
      frames.push(mode === 'pixel' ? (o.portrait ? renderPixelPortrait(ch, pose, o) : renderPixel(ch, pose, o)) : renderVN(ch, pose, o));
    }
    return frames;
  }

  // Animaciones extra (sólo en este motor): se añaden a la lista de la app.
  function registerAnims() {
    for (const [clip, name] of EXTRA) {
      if (SC.ANIMS[clip]) continue;
      SC.ANIMS[clip] = { id: clip, name, frames: 8, fps: 10, modOnly: true, pose: () => SC.restPose() };
    }
  }
  registerAnims();

  return {
    available, build, renderView, renderVN, renderPixel, renderPixelPortrait, renderAnimation, frameCount, isLoop, setGroupColor,
    get fps() { return FPS; },
    SLOTS, SETS, HAIRS,
    get config() { return cfg ? JSON.parse(JSON.stringify(cfg)) : JSON.parse(JSON.stringify(DEFAULT)); },
    get groups() { return groups.map(({ id, label, color, base, cloth }) => ({ id, label, color, base, cloth })); },
    get loaded() { return built; },
    get info() { return info; },
  };
})();
