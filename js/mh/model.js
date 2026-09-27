// Cuerpo paramétrico a partir de la malla base de MakeHuman (camino B de
// docs/auditoria.md). La forma la da una malla diseñada por un artista; aquí
// sólo se mezclan sus morphs, se ajustan las proporciones del estilo (cabezas
// de alto y fracción de pierna) y se posa con el rig anatómico propio.
//
// Unidades: los datos vienen en decímetros; la salida se normaliza a H (alto
// de la cabeza), con el origen en el suelo, +Y arriba, +X a la izquierda del
// personaje y +Z hacia delante, igual que el esqueleto de js/anat/body.js.
SC.mhModel = (() => {
  const M = SC.AM, C = SC.CANON;

  // ---------- Datos ----------
  let DATA = null;
  function data() {
    if (DATA) return DATA;
    const R = SC.MH_DATA;
    if (!R) throw new Error('Faltan los datos de MakeHuman (assets/mh/mh-data.js).');
    const bytes = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    const typed = (s, T) => { const u = bytes(s); return new T(u.buffer, 0, u.byteLength / T.BYTES_PER_ELEMENT); };
    const nv = R.nv, q = typed(R.pos, Int16Array), base = new Float32Array(nv * 3);
    for (let i = 0; i < q.length; i++) base[i] = q[i] * R.scale;
    const tris = {};
    for (const [k, s] of Object.entries(R.tris)) tris[k] = typed(s, Uint16Array);
    const wIdx = typed(R.weights.idx, Uint8Array), wv = typed(R.weights.val, Uint8Array), wVal = new Float32Array(wv.length);
    for (let i = 0; i < wv.length; i++) wVal[i] = wv[i] / 255;
    const targets = {};
    for (const [k, t] of Object.entries(R.targets)) {
      const d = typed(t.d, Int16Array), f = new Float32Array(d.length);
      for (let i = 0; i < d.length; i++) f[i] = d[i] * R.scale;
      targets[k] = { idx: typed(t.idx, Uint16Array), d: f };
    }
    const bones = R.bones.map((b, i) => Object.assign({ index: i }, b));
    const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
    // Hueso dominante de cada vértice y parte del cuerpo a la que pertenece.
    const dom = new Uint8Array(nv);
    for (let i = 0; i < nv; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (wVal[i * 4 + k] > wVal[i * 4 + best]) best = k;
      dom[i] = wIdx[i * 4 + best];
    }
    const partOfBone = bones.map((b) => boneToPart(b.name));
    const part = new Uint8Array(nv);
    for (let i = 0; i < nv; i++) part[i] = PARTS.indexOf(partOfBone[dom[i]]);
    // Vértices de cada malla.
    const inMesh = {};
    for (const [k, t] of Object.entries(tris)) { const s = new Uint8Array(nv); for (const i of t) s[i] = 1; inMesh[k] = s; }
    DATA = { nv, base, tris, wIdx, wVal, targets, bones, byName, joints: R.joints, dom, part, inMesh, license: R.license };
    return DATA;
  }

  const PARTS = ['torso', 'neck', 'head', 'arm_L', 'arm_R', 'hand_L', 'hand_R', 'leg_L', 'leg_R', 'foot_L', 'foot_R'];
  function boneToPart(n) {
    const side = /\.L$/.test(n) ? 'L' : /\.R$/.test(n) ? 'R' : '';
    if (n === 'head') return 'head';
    if (/^neck/.test(n)) return 'neck';
    if (/^(upperarm|lowerarm)/.test(n)) return 'arm_' + side;
    if (/^(wrist|finger)/.test(n)) return 'hand_' + side;
    if (/^(upperleg|lowerleg)/.test(n)) return 'leg_' + side;
    if (/^foot/.test(n)) return 'foot_' + side;
    return 'torso';
  }

  // ---------- Morphs macro ----------
  // Reparto de un valor 0..1 entre los morphs min / average / max (como
  // MakeHuman: 0.5 es el medio y no aplica nada de min ni de max).
  const levels = (x) => (x < 0.5 ? { min: 1 - 2 * x, average: 2 * x, max: 0 } : { min: 0, average: 2 - 2 * x, max: 2 * x - 1 });

  // Parámetros del personaje (js/anat/body.js) → pesos de los morphs.
  function macroWeights(P) {
    const W = {}, add = (k, w) => { if (w > 1e-4) W[k] = (W[k] || 0) + w; };
    const male = 1 - P.s, gw = { female: 1 - male, male };
    const mw = levels(P.m != null ? P.m : 0.5), ww = levels(M.clamp(0.5 + 0.5 * P.b, 0, 1));
    for (const [g, a] of Object.entries(gw)) {
      for (const [m, b] of Object.entries(mw)) for (const [w, c] of Object.entries(ww)) add(`universal-${g}-${m}muscle-${w}weight`, a * b * c);
      for (const r of ['african', 'asian', 'caucasian']) add(`${r}-${g}`, a / 3);
      add(`${g}-idealproportions`, a * 0.5);
    }
    // Busto: tamaño (copa) y firmeza, sólo con la parte femenina.
    const bust = P.bust || {}, fem = gw.female;
    const cup = levels(bust.c != null ? bust.c : 0.5), firm = levels(1 - (bust.g != null ? bust.g : 0.2));
    add('breast-mincup', cup.min * fem); add('breast-maxcup', cup.max * fem);
    add('breast-minfirmness', firm.min * fem); add('breast-maxfirmness', firm.max * fem);
    // Definición muscular de brazos y piernas: una base (la malla media apenas
    // marca los gemelos) que crece con la musculatura.
    const mus = P.m != null ? P.m : 0.5;
    add('lowerleg-muscle', 0.45 + 0.5 * mus); add('upperleg-muscle', 0.3 + 0.5 * mus);
    add('upperarm-muscle', 0.2 + 0.6 * mus); add('lowerarm-muscle', 0.2 + 0.5 * mus);
    return W;
  }

  function morph(P) {
    const D = data(), out = new Float32Array(D.base);
    for (const [k, w] of Object.entries(macroWeights(P))) {
      const t = D.targets[k];
      if (!t) continue;
      const { idx, d } = t;
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j] * 3;
        out[i] += w * d[j * 3]; out[i + 1] += w * d[j * 3 + 1]; out[i + 2] += w * d[j * 3 + 2];
      }
    }
    return out;
  }

  // ---------- Transformaciones afines {m: 3×3 por filas, t} ----------
  const aff = (m, t) => ({ m, t });
  const apply = (A, p) => M.add(M.mv(A.m, p), A.t);
  const compose = (A, B) => aff(M.mm(A.m, B.m), M.add(M.mv(A.m, B.t), A.t));
  const around = (m, c, c2) => aff(m, M.sub(c2, M.mv(m, c))); // p → m (p − c) + c2
  const I = () => aff(M.I3(), [0, 0, 0]);
  // Escala k_len a lo largo del eje a y k_w en perpendicular.
  function axisScale(a, kLen, kW) {
    const m = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m.push((r === c ? kW : 0) + (kLen - kW) * a[r] * a[c]);
    return m;
  }

  function jointPos(pos, name) {
    const vs = data().joints[name], c = [0, 0, 0];
    for (const v of vs) { c[0] += pos[v * 3]; c[1] += pos[v * 3 + 1]; c[2] += pos[v * 3 + 2]; }
    return M.mul(c, 1 / vs.length);
  }
  function boneEnds(pos) {
    const D = data();
    return D.bones.map((b) => ({ h: jointPos(pos, b.head), t: jointPos(pos, b.tail) }));
  }

  // Medidas en reposo (dm): coronilla, barbilla, entrepierna y suelo.
  function measure(pos) {
    const D = data(), body = D.inMesh.body, headI = PARTS.indexOf('head');
    let top = -1e9, floor = 1e9, crotch = 1e9, chin = 1e9;
    const neckZ = jointPos(pos, 'head____head')[2];
    for (let i = 0; i < D.nv; i++) {
      if (!body[i]) continue;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (y > top) top = y;
      if (y < floor) floor = y;
      if (Math.abs(x) < 0.08 && y < crotch && D.part[i] !== headI) crotch = y;
      if (D.part[i] === headI && z > neckZ + 0.5 && y < chin) chin = y;
    }
    return { top, chin, crotch, floor, H: top - chin, torso: chin - crotch, leg: crotch - floor };
  }

  // ---------- Proporciones del estilo ----------
  // Se conserva el tronco de la malla y se ajustan cabeza, piernas, brazos,
  // manos y pies para llegar a N cabezas y a la fracción de pierna λ del canon.
  function styleScales(meas, ends, style) {
    const st = C.styles[style] || C.styles.anime, N = st.N, lam = st.lambda;
    const chib = M.clamp((5 - N) / 2.5, 0, 1);
    const Hn = meas.torso / (N * (1 - lam) - 1); // alto de la cabeza nuevo (dm)
    const k = { head: Hn / meas.H, leg: (lam * N * Hn) / meas.leg };
    // Brazos: con el brazo colgando, la punta de los dedos a medio muslo.
    const D = data(), e = (n) => ends[D.byName[n].index];
    const armLen = ['upperarm01.L', 'upperarm02.L', 'lowerarm01.L', 'lowerarm02.L'].reduce((s, n) => s + M.dist(e(n).h, e(n).t), 0);
    const handLen = M.dist(e('wrist.L').h, e('finger3-3.L').t);
    const shoulderDrop = meas.chin - e('upperarm01.L').h[1]; // hombro bajo la barbilla (tronco sin tocar)
    const midThigh = meas.torso - shoulderDrop + 0.25 * lam * N * Hn; // del hombro a medio muslo
    const handWant = M.lerp(Math.min(handLen, 0.78 * Hn), C.chibi.hand * Hn, chib);
    k.hand = handWant / handLen;
    k.arm = Math.max(0.3, (midThigh - handWant) / armLen);
    const footLen = M.dist(e('foot.L').h, e('foot.L').t) * 1.6;
    k.foot = M.lerp(1, M.clamp((C.chibi.foot * Hn) / footLen, 1, 1.8), chib);
    // En chibi el cuerpo es más grueso respecto a su largo y casi no hay cuello.
    k.limbW = M.lerp(1, 1.5, chib); k.bodyW = M.lerp(1, 1.3, chib);
    k.neck = M.lerp(1, 0.35, chib); k.neckW = M.lerp(1, 1.3, chib);
    return { k, Hn, N, lam, chib };
  }

  // ---------- Silueta del canon ----------
  // Ancho frontal (dm) de la malla en reposo a una altura: 2·max|x| de los
  // vértices del tronco (y del deltoides para los hombros).
  function widthAt(pos, y, band, parts) {
    const D = data(), set = new Set(parts.map((n) => PARTS.indexOf(n)));
    let w = 0;
    for (let i = 0; i < D.nv; i++) {
      if (!D.inMesh.body[i] || !set.has(D.part[i])) continue;
      if (Math.abs(pos[i * 3 + 1] - y) < band) w = Math.max(w, 2 * Math.abs(pos[i * 3]));
    }
    return w;
  }
  // Factores de ancho del tronco para que la silueta frontal coincida con la
  // tabla 3.3 del canon (auditoría, sección 5): la malla aporta el detalle y
  // el canon las proporciones. Se mide en reposo y se aplica en reshape().
  function canonFit(pos, meas, Hn, P) {
    const sk = SC.anatBody.skeleton(P), yT = (t) => meas.chin - t * (meas.chin - meas.crotch), band = 0.06 * meas.H;
    const fit = (want, got) => M.clamp(want / Math.max(1e-6, got), 0.75, 1.35);
    const hip = fit(sk.w.hip * Hn, widthAt(pos, yT(sk.tau.hip), band, ['torso', 'leg_L', 'leg_R']));
    const waist = fit(sk.w.waist * Hn, widthAt(pos, yT(sk.tau.waist), band, ['torso']));
    const chest = fit(sk.w.chest * Hn, widthAt(pos, yT(sk.tau.nipple), band, ['torso']));
    // Hombros: la clavícula lleva la articulación del hombro a la x del canon.
    const hx = jointPos(pos, 'clavicle.L____head')[0], jx = jointPos(pos, 'upperarm01.L____head')[0];
    // El ancho de hombros del canon va de deltoides a deltoides: la articulación
    // queda a medio ancho menos el grosor real del deltoides de la malla.
    const J = jointPos(pos, 'upperarm01.L____head'), D = data(), aL = PARTS.indexOf('arm_L'), tL = PARTS.indexOf('torso');
    // El brazo se gira a la dirección de reposo del rig (unos 20°) antes de medir.
    const A = M.fromTo(M.sub(jointPos(pos, 'lowerarm01.L____head'), J), M.sub(sk.joints.elbow_L.rest, sk.joints.shoulder_L.rest));
    let deltoid = 0;
    for (let i = 0; i < D.nv; i++) {
      if (!D.inMesh.body[i] || (D.part[i] !== aL && D.part[i] !== tL)) continue;
      const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      if (M.dist(p, J) > 0.35 * meas.H) continue;
      const q = D.part[i] === aL ? M.add(J, M.mv(A, M.sub(p, J))) : p;
      if (Math.abs(q[1] - J[1]) < 0.1 * meas.H) deltoid = Math.max(deltoid, q[0] - J[0]);
    }
    const target = (sk.w.shoulders * Hn) / 2 - Math.max(0, deltoid);
    const shoulders = M.clamp((target - hx * chest) / Math.max(1e-6, jx - hx), 0.6, 1.6);
    return { hip, waist, chest, shoulders };
  }

  // Transformación de reposo de cada hueso (forma del estilo).
  function reshape(ends, meas, sc) {
    const D = data(), k = sc.k, W = new Array(D.bones.length), cf = sc.fit || { hip: 1, waist: 1, chest: 1, shoulders: 1 };
    const lat = (kx) => [kx, 0, 0, 0, 1, 0, 0, 0, 1 + (kx - 1) * 0.5]; // más ancho (y algo más hondo)
    for (const b of D.bones) {
      const P = b.parent >= 0 ? W[b.parent] : I();
      const { h, t } = ends[b.index], a = M.norm(M.sub(t, h));
      const n = b.name;
      let m = M.I3(), pivot = h;
      if (n === 'head') { m = axisScale([0, 1, 0], k.head, k.head); pivot = [0, meas.chin, h[2]]; }
      else if (/^neck/.test(n)) m = axisScale(a, k.neck, k.neckW);
      else if (/^(root|spine05|pelvis)/.test(n)) m = M.mm(lat(cf.hip), axisScale([0, 1, 0], 1, k.bodyW));
      else if (/^(spine04|spine03)/.test(n)) m = M.mm(lat(cf.waist), axisScale([0, 1, 0], 1, k.bodyW));
      else if (/^(spine02|spine01)/.test(n)) m = M.mm(lat(cf.chest), axisScale([0, 1, 0], 1, k.bodyW));
      else if (/^clavicle/.test(n)) m = axisScale(a, cf.shoulders, 1);
      else if (/^(upperleg|lowerleg)/.test(n)) m = axisScale(a, k.leg, k.limbW);
      else if (/^(upperarm|lowerarm)/.test(n)) m = axisScale(a, k.arm, k.limbW);
      else if (/^(wrist|finger)/.test(n)) m = axisScale(a, k.hand, k.hand);
      else if (/^foot/.test(n)) m = axisScale(a, k.foot, k.foot);
      W[b.index] = around(m, pivot, apply(P, pivot));
    }
    return W;
  }

  // ---------- Retarget de la pose ----------
  // Cada hueso de MakeHuman sigue a una articulación del rig anatómico.
  function anatJointOf(n) {
    const s = /\.L$/.test(n) ? '_L' : /\.R$/.test(n) ? '_R' : '';
    if (n === 'root' || n === 'spine05' || /^pelvis/.test(n)) return 'pelvis';
    if (n === 'spine04' || n === 'spine03') return 'spine';
    if (n === 'spine02' || n === 'spine01') return 'chest';
    if (/^neck/.test(n)) return 'neck';
    if (n === 'head') return 'head';
    if (/^(clavicle|shoulder01)/.test(n)) return 'clavicle' + s;
    if (/^upperarm/.test(n)) return 'shoulder' + s;
    if (/^lowerarm/.test(n)) return 'elbow' + s;
    if (/^(wrist|finger)/.test(n)) return 'wrist' + s;
    if (/^upperleg/.test(n)) return 'hip' + s;
    if (/^lowerleg/.test(n)) return 'knee' + s;
    if (/^foot/.test(n)) return 'ankle' + s;
    return 'pelvis';
  }
  // Segmento de MakeHuman (hueso inicial y final) que corresponde a cada
  // segmento del rig, para alinear sus direcciones de reposo.
  // Sólo los brazos: en reposo MakeHuman los abre unos 40° y el rig 20°. Las
  // piernas y el tronco ya coinciden y se les pasa sólo la rotación de la pose
  // (así la geometría de pierna de cada estilo no tuerce las rodillas).
  const SEGS = {
    clavicle: ['clavicle', 'clavicle', 'shoulder'], shoulder: ['upperarm01', 'upperarm02', 'elbow'], elbow: ['lowerarm01', 'lowerarm02', 'wrist'],
    wrist: ['wrist', 'finger3-1', 'hand'],
  };

  function alignments(ends, sk) {
    const D = data(), J = sk.joints, A = {};
    for (const S of ['L', 'R']) {
      for (const [j, [b0, b1, child]] of Object.entries(SEGS)) {
        const e0 = ends[D.byName[`${b0}.${S}`].index], e1 = ends[D.byName[`${b1}.${S}`].index];
        const dm = M.sub(b1 === 'finger3-1' ? e1.h : e1.t, e0.h);
        const da = M.sub(J[`${child}_${S}`].rest, J[`${j}_${S}`].rest);
        A[`${j}_${S}`] = M.fromTo(dm, da);
      }
    }
    return A;
  }

  // ---------- Cara estilizada ----------
  // Peso 0..1 de la zona de la cara (de la ceja a la barbilla, por delante de
  // las orejas) y óvalo de la cabeza. En esa zona el sombreado usa la normal
  // del óvalo y no se dibujan líneas: los rasgos anime se pintan encima.
  function faceZone(pos, meas) {
    const D = data(), head = PARTS.indexOf('head'), H = meas.H;
    let z0 = 1e9, z1 = -1e9, xs = 0;
    for (let i = 0; i < D.nv; i++) {
      if (!D.inMesh.body[i] || D.part[i] !== head) continue;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], v = (meas.top - y) / H;
      if (v > 0.2 && v < 0.45) xs = Math.max(xs, Math.abs(x));
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    const zc = (z0 + z1) / 2 - 0.08 * H;
    const sm = (t) => { t = M.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const w = new Float32Array(D.nv);
    for (let i = 0; i < D.nv; i++) {
      if (D.inMesh.eyes[i]) { w[i] = 1; continue; }
      if (!D.inMesh.body[i] || D.part[i] !== head) continue;
      const u = Math.abs(pos[i * 3]) / H, v = (meas.top - pos[i * 3 + 1]) / H, z = (pos[i * 3 + 2] - zc) / H;
      w[i] = sm((0.34 - u) / 0.08) * sm((v - 0.36) / 0.07) * sm(z / 0.12);
    }
    return { w, W: (2 * xs) / H, center: [0, meas.top - 0.52 * H, zc - 0.05 * H], radii: [xs * 1.02, 0.56 * H, (z1 - z0) * 0.52] };
  }

  // Modelo en reposo para unos parámetros (se guarda en caché).
  const cache = new Map();
  function rest(P) {
    const key = JSON.stringify([P.s, P.b, P.m, P.bust, P.style]);
    if (cache.has(key)) return cache.get(key);
    const pos = morph(P), meas = measure(pos), ends0 = boneEnds(pos);
    const sc = styleScales(meas, ends0, P.style);
    // En chibi el canon de anchos es otro cuerpo: se deja la malla.
    if (sc.chib < 1) sc.fit = canonFit(pos, meas, sc.Hn, P);
    const Wr = reshape(ends0, meas, sc);
    // Articulaciones ya con la forma del estilo.
    const ends = ends0.map((e, i) => ({ h: apply(Wr[i], e.h), t: apply(Wr[i], e.t) }));
    const face = faceZone(pos, meas);
    const out = { P, pos, meas, sc, Wr, ends, face };
    if (cache.size > 16) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out;
  }

  // Pose final: f es la salida de SC.anatRig.solve (rotaciones del mundo por
  // articulación). Devuelve posiciones y normales en H, con los pies en el suelo.
  function pose(P, f) {
    const D = data(), R = rest(P), sk = f.sk;
    const A = alignments(R.ends, sk);
    const F = new Array(D.bones.length), Wp = new Array(D.bones.length);
    for (const b of D.bones) {
      const j = anatJointOf(b.name), rot = f.rot[j] || M.I3();
      const Q = A[j] ? M.mm(rot, A[j]) : rot;
      const h = R.ends[b.index].h;
      const h2 = b.parent >= 0 ? apply(Wp[b.parent], h) : h;
      Wp[b.index] = around(Q, h, h2);
      F[b.index] = compose(Wp[b.index], R.Wr[b.index]);
    }
    // Skinning lineal con 4 influencias.
    const nv = D.nv, src = R.pos, out = new Float32Array(nv * 3), { wIdx, wVal } = D;
    const Fm = F.map((x) => [...x.m, ...x.t]);
    for (let i = 0; i < nv; i++) {
      let x = 0, y = 0, z = 0;
      const px = src[i * 3], py = src[i * 3 + 1], pz = src[i * 3 + 2];
      for (let k = 0; k < 4; k++) {
        const w = wVal[i * 4 + k];
        if (!w) continue;
        const m = Fm[wIdx[i * 4 + k]];
        x += w * (m[0] * px + m[1] * py + m[2] * pz + m[9]);
        y += w * (m[3] * px + m[4] * py + m[5] * pz + m[10]);
        z += w * (m[6] * px + m[7] * py + m[8] * pz + m[11]);
      }
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    // A unidades H, con el pie de apoyo en el suelo y el desplazamiento del rig.
    const s = 1 / R.sc.Hn, body = D.inMesh.body;
    const footL = PARTS.indexOf('foot_L'), footR = PARTS.indexOf('foot_R');
    let lowL = 1e9, lowR = 1e9;
    for (let i = 0; i < nv; i++) {
      if (!body[i]) continue;
      if (D.part[i] === footL) lowL = Math.min(lowL, out[i * 3 + 1]);
      else if (D.part[i] === footR) lowR = Math.min(lowR, out[i * 3 + 1]);
    }
    const ps = f.pose || {}, low = Math.min(lowL, lowR);
    const pelvisRest = sk.joints.pelvis.rest, pelvisNow = f.pos.pelvis;
    const off = [pelvisNow[0] - pelvisRest[0], -low * s + (ps.lift || 0), pelvisNow[2] - pelvisRest[2]];
    for (let i = 0; i < nv; i++) {
      out[i * 3] = out[i * 3] * s + off[0];
      out[i * 3 + 1] = out[i * 3 + 1] * s + off[1];
      out[i * 3 + 2] = out[i * 3 + 2] * s + off[2];
    }
    const xform = (p) => M.add(M.mul(p, s), off);
    // Marco de la cabeza (rotación pura del hueso) y espacio de cabeza
    // (u, v, z) en H: v desde la coronilla (0) hasta la barbilla (1), z hacia
    // delante desde el plano medio del cuello.
    const hb = D.byName.head.index, Hn = R.sc.Hn;
    const chinR = apply(R.Wr[hb], [0, R.meas.chin, R.ends[hb].h[2]]);
    const Rh = Wp[hb].m, fz = R.face, kh = R.sc.k.head;
    const fc = xform(apply(F[hb], fz.center)), fr = fz.radii.map((x) => (x * kh) / Hn);
    const head = {
      rot: Rh, W: fz.W,
      hs: (u, v, z) => xform(apply(Wp[hb], [u * Hn, chinR[1] + (1 - v) * Hn, chinR[2] + z * Hn])),
      // Normal del óvalo de la cabeza en un punto del mundo.
      faceNormal: (p) => {
        const d = M.sub(p, fc);
        const l = [Rh[0] * d[0] + Rh[3] * d[1] + Rh[6] * d[2], Rh[1] * d[0] + Rh[4] * d[1] + Rh[7] * d[2], Rh[2] * d[0] + Rh[5] * d[1] + Rh[8] * d[2]];
        return M.norm(M.mv(Rh, [l[0] / (fr[0] * fr[0]), l[1] / (fr[1] * fr[1]), l[2] / (fr[2] * fr[2])]));
      },
    };
    // Punto de reposo (dm) que sigue a un hueso → posición posada (H).
    const at = (bone, p) => xform(apply(F[D.byName[bone].index], p));
    return { pos: out, F, Wp, rest: R, head, xform, at, s };
  }

  // Normales por vértice (media ponderada por área) de las mallas indicadas.
  function normals(pos, meshes) {
    const D = data(), n = new Float32Array(pos.length);
    for (const k of meshes) {
      const t = D.tris[k];
      for (let i = 0; i < t.length; i += 3) {
        const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const q of [a, b, c]) { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; }
      }
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
    return n;
  }

  // Normales hacia fuera: si una malla auxiliar viene con las caras al revés,
  // se le da la vuelta (se comprueba contra la dirección radial del cuerpo).
  const flipCache = {};
  function orientedNormals(pos, meshes) {
    const D = data(), n = normals(pos, meshes);
    for (const k of meshes) {
      if (flipCache[k] == null) {
        const R = D.base, nr = normals(R, [k]), s = new Set(D.tris[k]);
        let acc = 0;
        for (const i of s) acc += nr[i * 3] * R[i * 3] + nr[i * 3 + 2] * (R[i * 3 + 2] - 0.3);
        flipCache[k] = acc < 0;
      }
      if (!flipCache[k]) continue;
      for (const i of new Set(D.tris[k])) { n[i * 3] *= -1; n[i * 3 + 1] *= -1; n[i * 3 + 2] *= -1; }
    }
    return n;
  }

  // Vecinos de cada vértice (de las mallas indicadas), para suavizar.
  const nbCache = {};
  function neighbors(meshes) {
    const key = meshes.join(',');
    if (nbCache[key]) return nbCache[key];
    const D = data(), sets = Array.from({ length: D.nv }, () => new Set());
    for (const k of meshes) {
      const t = D.tris[k];
      for (let i = 0; i < t.length; i += 3) for (let a = 0; a < 3; a++) { sets[t[i + a]].add(t[i + (a + 1) % 3]); sets[t[i + a]].add(t[i + (a + 2) % 3]); }
    }
    const start = new Uint32Array(D.nv + 1), list = [];
    for (let i = 0; i < D.nv; i++) { start[i] = list.length; for (const j of sets[i]) list.push(j); }
    start[D.nv] = list.length;
    return (nbCache[key] = { start, list: new Uint32Array(list) });
  }
  // Normales suavizadas: el sombreado cel da manchas grandes y limpias en vez
  // de marcar cada músculo; la silueta conserva toda la forma de la malla.
  function smoothNormals(n, meshes, iters = 6) {
    const { start, list } = neighbors(meshes);
    let a = n, b = new Float32Array(n.length);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < start.length - 1; i++) {
        let x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
        for (let k = start[i]; k < start[i + 1]; k++) { const j = list[k] * 3; x += a[j]; y += a[j + 1]; z += a[j + 2]; }
        const l = Math.hypot(x, y, z) || 1;
        b[i * 3] = x / l; b[i * 3 + 1] = y / l; b[i * 3 + 2] = z / l;
      }
      [a, b] = [b, a];
    }
    return a;
  }

  return { data, PARTS, smoothNormals, neighbors, orientedNormals, macroWeights, morph, measure, rest, pose, normals, jointPos, boneToPart, anatJointOf };
})();
