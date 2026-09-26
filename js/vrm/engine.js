// Motor VRM: carga modelos anime 3D en formato VRM (por ejemplo creados gratis
// con VRoid Studio) y los dibuja con el sombreado toon MToon usando three.js y
// three-vrm (empaquetados en vendor/vrm-bundle.js).
//
// Reutiliza el resto de la app: las mismas poses y animaciones (se traducen a
// rotaciones de huesos humanoides), las mismas vistas y expresiones, y las
// mismas exportaciones (novela visual, retrato pixel art, sprites, Ren'Py).
SC.vrm = (() => {
  const T = window.THREE, X = window.SCVRM;
  const available = !!(T && X && (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  })());

  let renderer = null, scene = null, camera = null, vrm = null, info = null, rest = null;

  function setup() {
    if (renderer) return;
    const canvas = document.createElement('canvas');
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    scene = new T.Scene();
    const key = new T.DirectionalLight(0xffffff, Math.PI);
    key.position.set(-1, 1.4, 1.2).normalize();
    scene.add(key);
    scene.add(new T.AmbientLight(0xffffff, 0.35));
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
  }

  // Lee los metadatos de licencia (VRM 1.0 y VRM 0.x) para mostrarlos.
  function readMeta(m) {
    if (!m) return {};
    if (m.metaVersion === '0' || m.title !== undefined) {
      return {
        name: m.title || 'Modelo VRM', authors: m.author ? [m.author] : [],
        license: m.licenseName || '', licenseUrl: m.otherLicenseUrl || '',
        commercial: m.commercialUssageName === 'Allow' ? 'permitido' : 'no permitido',
        redistribution: '—', credit: '—',
      };
    }
    const com = { personalNonProfit: 'solo personal sin ánimo de lucro', personalProfit: 'personal con ánimo de lucro', corporation: 'permitido (también empresas)' };
    return {
      name: m.name || 'Modelo VRM', authors: m.authors || [],
      license: 'VRM Public License 1.0', licenseUrl: m.licenseUrl || '',
      commercial: com[m.commercialUsage] || m.commercialUsage || '—',
      redistribution: m.allowRedistribution ? 'permitida' : 'no permitida',
      credit: m.creditNotation === 'required' ? 'obligatorio' : 'no obligatorio',
      copyright: m.copyrightInformation || '',
    };
  }

  async function load(arrayBuffer) {
    if (!available) throw new Error('Este navegador no tiene WebGL');
    setup();
    const loader = new X.GLTFLoader();
    loader.register((parser) => new X.VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(arrayBuffer, '');
    const v = gltf.userData.vrm;
    if (!v) throw new Error('El archivo no es un modelo VRM');
    X.VRMUtils.removeUnnecessaryVertices(gltf.scene);
    if (X.VRMUtils.combineSkeletons) X.VRMUtils.combineSkeletons(gltf.scene);
    X.VRMUtils.rotateVRM0(v);
    v.scene.traverse((o) => { o.frustumCulled = false; });
    if (vrm) { scene.remove(vrm.scene); X.VRMUtils.deepDispose(vrm.scene); }
    vrm = v;
    scene.add(vrm.scene);
    info = readMeta(vrm.meta);
    info.canModify = canModify(vrm.meta);
    collectGroups();
    measure();
    return info;
  }

  function canModify(m) {
    if (!m) return true;
    if (m.modification) return m.modification !== 'prohibited';
    return true; // VRM 0.x no tiene este campo: la licencia del modelo decide.
  }

  // ---------- Personalización: recolorear texturas conservando el dibujo ----------
  // Los modelos de VRoid nombran sus materiales con sufijos (_HAIR, _EYE, _SKIN,
  // _CLOTH, _FACE). Se agrupan para poder cambiar el color del pelo, los ojos,
  // la piel o cada prenda sin perder sombras, mechones, brillos ni pliegues.
  const CLOTH_NAMES = { Tops: 'Parte superior', Bottoms: 'Parte inferior', Shoes: 'Calzado', Onepiece: 'Vestido', Accessory: 'Accesorios', Accessories: 'Accesorios' };
  let groups = [];

  function groupOf(name) {
    const n = name || '';
    if (/HAIR/i.test(n)) return { id: 'hair', label: 'Pelo' };
    if (/EyeIris/i.test(n)) return { id: 'iris', label: 'Ojos (iris)' };
    if (/FaceBrow|FaceEyeline|FaceEyelash/i.test(n)) return { id: 'lines', label: 'Cejas y pestañas' };
    if (/SKIN/i.test(n)) return { id: 'skin', label: 'Piel' };
    const m = n.match(/^([A-Za-z]+?)_\d+_CLOTH/);
    if (m || /CLOTH/i.test(n)) { const key = m ? m[1] : n; return { id: 'cloth:' + key, label: CLOTH_NAMES[key] || key, cloth: true }; }
    if (/FACE|EYE/i.test(n)) return null; // boca, blanco del ojo, brillos: se dejan como están
    return { id: 'mat:' + n, label: n, cloth: true };
  }

  function collectGroups() {
    const map = new Map();
    vrm.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const mat of [].concat(o.material)) {
        const g = groupOf(mat.name);
        if (!g) continue;
        if (!map.has(g.id)) map.set(g.id, Object.assign(g, { mats: new Set() }));
        map.get(g.id).mats.add(mat);
        if (mat.map && !mat.userData.scOrig) mat.userData.scOrig = { map: mat.map, shade: mat.shadeMultiplyTexture || null };
      }
    });
    groups = [...map.values()].map((g) => {
      g.mats = [...g.mats];
      return Object.assign(g, { color: null, visible: true, base: baseColor(g) });
    });
    const order = ['hair', 'iris', 'lines', 'skin'];
    groups.sort((a, b) => (order.indexOf(a.id) + 1 || 9) - (order.indexOf(b.id) + 1 || 9));
  }

  function imageData(img) {
    const c = SC.render.makeCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    return { c, x, d: x.getImageData(0, 0, c.width, c.height) };
  }

  const toHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  };
  const fromHsl = (h, s, l) => {
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  };

  // Color medio (ponderado) de las texturas de un grupo, para el selector.
  // Color dominante de la textura: tono medio ponderado por saturación y
  // luminosidad mediana de los píxeles visibles.
  function baseColor(g) {
    const m = g.mats.find((x) => x.userData.scOrig && x.userData.scOrig.map && x.userData.scOrig.map.image);
    if (!m) return '#888888';
    const { d } = imageData(m.userData.scOrig.map.image);
    const hist = new Float64Array(256);
    let hx = 0, hy = 0, n = 0;
    for (let i = 0; i < d.data.length; i += 4 * 7) {
      if (d.data[i + 3] < 128) continue;
      const [h, s, l] = toHsl(d.data[i], d.data[i + 1], d.data[i + 2]);
      // Los rellenos negros o blancos del atlas no cuentan.
      if (l < 0.05 || l > 0.985) continue;
      hist[Math.round(l * 255)] += 0.3 + s; n += 0.3 + s;
      hx += Math.cos(h * 2 * Math.PI) * s; hy += Math.sin(h * 2 * Math.PI) * s;
    }
    if (!n) return '#888888';
    let acc = 0, li = 0;
    while (li < 255 && (acc += hist[li]) < n / 2) li++;
    const h = (Math.atan2(hy, hx) / (2 * Math.PI) + 1) % 1, s = Math.hypot(hx, hy) / n;
    const [r, gg, b] = fromHsl(h, Math.min(1, s), li / 255);
    return SC.util.rgbToHex(r, gg, b);
  }

  // Recolorea una textura. El color base del grupo pasa a ser el color elegido y el
  // resto de tonos se reparten a su alrededor (negro sigue negro, blanco sigue
  // blanco), así se conservan las luces, sombras y líneas pintadas. Los detalles
  // de otro tono (lazos, botones, reflejos) mantienen su color.
  function recolorTexture(tex, hex, base) {
    const { c, x, d } = imageData(tex.image);
    const C = SC.util.hexToRgb(hex), B = SC.util.hexToRgb(base);
    const [th, ts, tl] = toHsl(C.r, C.g, C.b), [bh, bs, bl0] = toHsl(B.r, B.g, B.b);
    // Croma (máx − mín): a diferencia de la saturación HSL, no se dispara cerca
    // del blanco o del negro. Una base sin color (tela blanca, gris o negra) se
    // tiñe entera; si es clara, el blanco pasa a ser el color elegido.
    const chroma = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const neutral = chroma(B.r, B.g, B.b) < 0.08;
    const bl = neutral && bl0 > 0.8 ? 1 : bl0;
    const mapL = (l) => (l <= bl ? tl * (l / Math.max(bl, 1e-3)) : tl + (1 - tl) * ((l - bl) / Math.max(1 - bl, 1e-3)));
    // Tabla de conversión (64³ colores) calculada una sola vez por recoloreado:
    // mucho más rápido que convertir a HSL cada píxel de texturas de 2048².
    const lut = new Uint8Array(64 * 64 * 64 * 3);
    for (let r = 0; r < 64; r++) for (let g = 0; g < 64; g++) for (let b = 0; b < 64; b++) {
      const R = r * 4 + 2, G = g * 4 + 2, Bb = b * 4 + 2;
      const [h, s, l] = toHsl(R, G, Bb), cr = chroma(R, G, Bb);
      // Cuánto pertenece este tono al color base (los grises siempre).
      const dh = Math.min(Math.abs(h - bh), 1 - Math.abs(h - bh));
      const k = neutral || cr < 0.1 ? 1 : 1 - SC.util.smoothstep(0.07, 0.16, dh);
      const ns = neutral ? ts : Math.min(1, s * (ts / Math.max(bs, 0.05)));
      const c3 = fromHsl(th, ns, mapL(l));
      const o = ((r << 12) | (g << 6) | b) * 3;
      lut[o] = R + (c3[0] - R) * k; lut[o + 1] = G + (c3[1] - G) * k; lut[o + 2] = Bb + (c3[2] - Bb) * k;
    }
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const o = (((px[i] >> 2) << 12) | ((px[i + 1] >> 2) << 6) | (px[i + 2] >> 2)) * 3;
      px[i] = lut[o]; px[i + 1] = lut[o + 1]; px[i + 2] = lut[o + 2];
    }
    x.putImageData(d, 0, 0);
    // clone() comparte la fuente de imagen con el original: se le da una propia
    // para no pisar la textura original.
    const t = tex.clone();
    t.source = new T.Source(c);
    t.needsUpdate = true;
    return t;
  }

  function setGroupColor(id, hex) {
    const g = groups.find((q) => q.id === id);
    if (!g || !info.canModify) return;
    g.color = hex;
    for (const m of g.mats) {
      const o = m.userData.scOrig;
      if (!o || !o.map) continue;
      if (m.userData.scTex) m.userData.scTex.dispose();
      const t = hex ? recolorTexture(o.map, hex, g.base) : null;
      m.userData.scTex = t;
      m.map = t || o.map;
      if (o.shade && o.shade === o.map) m.shadeMultiplyTexture = t || o.map;
      m.needsUpdate = true;
    }
  }

  function setGroupVisible(id, visible) {
    const g = groups.find((q) => q.id === id);
    if (!g) return;
    g.visible = visible;
    for (const m of g.mats) m.visible = visible;
  }

  async function loadDemo() {
    if (!window.SC_VRM_DEMO) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'models/vrm-demo.js';
        s.onload = res;
        s.onerror = () => rej(new Error('No se encontró models/vrm-demo.js'));
        document.head.appendChild(s);
      });
    }
    const bin = atob(window.SC_VRM_DEMO);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return load(buf.buffer);
  }

  const bone = (name) => vrm.humanoid.getNormalizedBoneNode(name);
  const raw = (name) => vrm.humanoid.getRawBoneNode(name);
  const wpos = (name) => { const n = raw(name); return n ? n.getWorldPosition(new T.Vector3()) : null; };

  // Medidas del modelo en su pose de descanso (para encuadrar y mover la cadera).
  function measure() {
    vrm.scene.rotation.set(0, 0, 0);
    vrm.humanoid.resetNormalizedPose();
    vrm.update(0);
    vrm.scene.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(vrm.scene);
    const head = wpos('head'), hips = wpos('hips'), foot = wpos('leftFoot') || wpos('rightFoot');
    rest = {
      top: box.max.y, ground: box.min.y, height: box.max.y - box.min.y,
      head, hips, legLen: hips.y - foot.y + (foot.y - box.min.y),
      hipsPos: bone('hips').position.clone(),
    };
  }

  // ---------- Pose: de nuestras poses a huesos humanoides ----------
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const qFrom = (a, b) => new T.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize());
  const orth = (h, d) => {
    const p = h.clone().sub(d.clone().multiplyScalar(h.dot(d)));
    return p.lengthSq() < 1e-6 ? V3(0, 0, 1) : p.normalize();
  };

  function setRot(name, q) { const n = bone(name); if (n) n.quaternion.copy(q); }

  function applyPose(P) {
    vrm.humanoid.resetNormalizedPose();
    const half = new T.Quaternion().setFromEuler(new T.Euler(P.pitch * 0.5, P.twist * 0.5, -P.roll * 0.5, 'YXZ'));
    setRot('spine', half);
    setRot('chest', half);
    setRot('neck', new T.Quaternion().setFromEuler(new T.Euler(P.headNod * 0.4, P.headYaw * 0.4, -P.headTilt * 0.4, 'YXZ')));
    setRot('head', new T.Quaternion().setFromEuler(new T.Euler(P.headNod * 0.6, P.headYaw * 0.6, -P.headTilt * 0.6, 'YXZ')));

    // Brazos: índice 0 = lado derecho del personaje (-x), 1 = izquierdo (+x).
    const sides = [['right', -1], ['left', 1]];
    sides.forEach(([side, s], i) => {
      const A = P.arms[i];
      const d1 = V3(s * Math.sin(A.abd), -Math.cos(A.abd) * Math.cos(A.flex), Math.cos(A.abd) * Math.sin(A.flex));
      const hint = A.hint === 'up' ? V3(0, 1, 0) : A.hint === 'in' ? V3(-s, 0, 0.3) : A.hint === 'back' ? V3(0, 0, -1) : V3(0, 0, 1);
      const p = orth(hint, d1);
      const d2 = d1.clone().multiplyScalar(Math.cos(A.bend)).add(p.multiplyScalar(Math.sin(A.bend)));
      const restDir = V3(s, 0, 0);
      const qu = qFrom(restDir, d1), ql = qFrom(restDir, d2);
      setRot(side + 'UpperArm', qu);
      setRot(side + 'LowerArm', qu.clone().invert().multiply(ql));
      // Dedos: relajados o en puño.
      const curl = 0.25 + (A.fist || 0) * 1.1;
      for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
        for (const seg of ['Proximal', 'Intermediate', 'Distal']) {
          setRot(side + f + seg, new T.Quaternion().setFromAxisAngle(V3(0, 0, 1), -s * curl));
        }
      }
    });
    // Piernas
    sides.forEach(([side, s], i) => {
      const L = P.legs[i];
      const flex = L.flex + P.crouch * 0.9, knee = L.knee + P.crouch * 1.8, abd = L.abd;
      const d1 = V3(s * Math.sin(abd), -Math.cos(abd) * Math.cos(flex), Math.cos(abd) * Math.sin(flex));
      const d2 = V3(s * Math.sin(abd), -Math.cos(abd) * Math.cos(flex - knee), Math.cos(abd) * Math.sin(flex - knee));
      const down = V3(0, -1, 0);
      const qu = qFrom(down, d1), ql = qFrom(down, d2);
      setRot(side + 'UpperLeg', qu);
      setRot(side + 'LowerLeg', qu.clone().invert().multiply(ql));
      setRot(side + 'Foot', ql.clone().invert());
    });
    // Cadera: baja al flexionar las rodillas (el pie más bajo toca el suelo).
    const ext = [0, 1].map((i) => {
      const L = P.legs[i], flex = L.flex + P.crouch * 0.9, knee = L.knee + P.crouch * 1.8;
      return 0.5 * Math.cos(L.abd) * Math.cos(flex) + 0.5 * Math.cos(L.abd) * Math.cos(flex - knee);
    });
    const B = rest.height * 0.88, leg = rest.legLen;
    const hips = bone('hips');
    hips.position.copy(rest.hipsPos);
    hips.position.y += -(1 - Math.max(...ext)) * leg - P.bob * B + P.jump * B;
    hips.position.x += P.sway * B;
  }

  // Expresiones de la app → expresiones estándar de VRM.
  const EXPR = {
    neutral: {}, feliz: { happy: 0.55 }, alegre: { happy: 1 }, triste: { sad: 0.9 }, enfadado: { angry: 0.9 },
    sorprendido: { surprised: 0.9 }, avergonzado: { sad: 0.35, happy: 0.25 }, pensativo: { relaxed: 0.5, lookLeft: 0.6 },
    guino: { blinkLeft: 1, happy: 0.4 }, serio: { angry: 0.3 }, presumido: { relaxed: 0.7 },
  };
  const MOUTH = { talkA: { aa: 0.8 }, talkB: { ih: 0.5, ou: 0.3 } };

  function applyExpression(id, P) {
    const em = vrm.expressionManager;
    if (!em) return;
    for (const e of em.expressions) em.setValue(e.expressionName, 0);
    const set = Object.assign({}, EXPR[id] || {}, P.mouth ? MOUTH[P.mouth] : {}, P.blink ? { blink: 1 } : {});
    for (const [k, v] of Object.entries(set)) if (em.getExpression(k)) em.setValue(k, v);
  }

  // ---------- Render ----------
  // frame: 'full' (lienzo 600x1000 como el motor generado) o 'bust'.
  function frameBox(frame) {
    if (frame === 'bust') {
      const top = rest.top + rest.height * 0.01;
      const bottom = rest.head.y - (rest.head.y - rest.hips.y) * 0.72;
      const h = top - bottom;
      return { cx: rest.head.x, cy: (top + bottom) / 2, h, w: h * 0.85 };
    }
    const h = rest.height / 0.9;
    return { cx: 0, cy: rest.ground + h * 0.46, h, w: h * 0.6 };
  }

  function renderRaw(W, H, pose, o = {}) {
    setup();
    const P = Object.assign(SC.defaultPose(), pose || SC.restPose());
    applyPose(P);
    applyExpression(o.expression, P);
    vrm.scene.rotation.y = (SC.VIEWS[o.view || 'front'] || SC.VIEWS.front).yaw + (P.yaw || 0);
    // Deja que el pelo y la ropa con física (spring bones) se asienten.
    if (vrm.springBoneManager) vrm.springBoneManager.reset();
    for (let i = 0; i < 16; i++) vrm.update(1 / 30);
    // Chibi para sprites de juego: cabeza más grande.
    const head = raw('head');
    if (head) head.scale.setScalar(o.chibiHead || 1);
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
    const out = SC.render.makeCanvas(W, H);
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    return out;
  }

  // Imagen de novela visual con contorno exterior, al tamaño pedido.
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

  function renderAnimation(ch, animId, mode, o = {}) {
    const anim = SC.ANIMS[animId], frames = [];
    for (let i = 0; i < anim.frames; i++) {
      const pose = anim.pose(i, anim.frames);
      frames.push(mode === 'pixel' ? (o.portrait ? renderPixelPortrait(ch, pose, o) : renderPixel(ch, pose, o)) : renderVN(ch, pose, o));
    }
    return frames;
  }

  return {
    available, load, loadDemo, renderView, renderVN, renderPixel, renderPixelPortrait, renderAnimation,
    setGroupColor, setGroupVisible,
    get groups() { return groups.map(({ id, label, color, visible, base, cloth }) => ({ id, label, color, visible, base, cloth })); },
    get loaded() { return !!vrm; },
    get info() { return info; },
  };
})();
