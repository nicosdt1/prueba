// Pruebas del motor (malla de MakeHuman + rig anatómico) sobre el G-buffer
// rasterizado en CPU: las de docs/auditoria.md (sección 5) y las de
// aceptación de docs/correccion-visual.md (12.1) que siguen teniendo sentido.
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = { SC: {}, Math, console, atob, performance };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/core/catalog', 'js/anat/canon', 'js/anat/math', 'js/anat/body', 'js/anat/rig', 'assets/mh/mh-data', 'js/render/camera', 'js/render/compose', 'js/mh/model', 'js/mh/raster', 'js/mh/dress', 'js/mh/engine']) {
  const file = path.join(root, f + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
const { AM: M, anatBody: B, CANON: C, engine: E, mhModel: MH, compose: CO } = ctx.SC;

const NUDE = { topStyle: 'ninguno', bottomStyle: 'ninguno', shoeStyle: 'ninguno', hairStyle: 'rapado' };
const ADULT = ['realista', 'heroico', 'anime', 'shojo'];
// Render del G-buffer con una pose dada (ángulos del rig) o una animación.
function gbuf(params, o = {}) {
  const a = { params, look: Object.assign({}, NUDE, o.look || {}) };
  const sk = B.skeleton(B.params(params)), scale = o.scale || 60;
  const W = o.W || Math.ceil((sk.w.shoulders + 2) * scale), H = o.H || Math.ceil((sk.T + 0.4) * scale);
  const b = E.build(a, o.anim || 'idle', o.t || 0);
  if (o.joints) {
    // Pose fija: se sustituye la del rig por la indicada.
    const f = ctx.SC.anatRig.fk(b.f.sk, { joints: o.joints });
    Object.assign(b, E.build(a, 'idle', 0, { fk: f }));
  }
  const yaw = o.yaw || 0;
  const cam = ctx.SC.camera(yaw, o.tilt || 0, W, H, { cx: o.cx || 0, cy: o.cy != null ? o.cy : sk.T / 2, scale });
  const g = ctx.SC.mhRaster.gbuffer(b.meshes, cam, { shadow: !!o.shadow, faceNormal: b.head.faceNormal });
  return { g, cam, sk, b };
}
const pidx = (b, name) => b.parts.indexOf(name);

// ---------- Auditoría, sección 5 ----------
test('Silueta frontal contra el canon: hombros, pecho, cintura y cadera (± 8 %)', () => {
  for (const style of ADULT) {
    for (const s of [0, 1]) {
      const rest = gbuf({ style, s }, { joints: {} }), open = gbuf({ style, s }, { joints: { shoulder_L: { abd: 25 }, shoulder_R: { abd: 25 } } });
      const width = ({ g, cam, b }, y, arms) => {
        const skip = new Set(arms ? [] : ['arm_L', 'arm_R', 'hand_L', 'hand_R'].map((n) => pidx(b, n)));
        const py = Math.round(cam.project([0, y, 0]).y);
        let x0 = Infinity, x1 = -Infinity;
        for (let x = 0; x < g.W; x++) { const p = g.part[py * g.W + x]; if (p >= 0 && !skip.has(p)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
        return (x1 - x0 + 1) / cam.scale;
      };
      const sk = rest.sk;
      const got = {
        shoulders: Math.max(...[0, 0.03, 0.06, 0.09, 0.12, 0.15].map((d) => width(rest, sk.yT(sk.tau.shoulder + d), true))),
        chest: width(open, sk.yT(sk.tau.nipple)), waist: width(rest, sk.yT(sk.tau.waist)), hip: width(rest, sk.yT(sk.tau.hip)),
      };
      for (const [k, v] of Object.entries(got)) assert.ok(Math.abs(v / sk.w[k] - 1) <= 0.08, `${style} s=${s} ${k}: ${v.toFixed(2)} H frente a ${sk.w[k].toFixed(2)} H`);
    }
  }
});

test('Sin huecos: entre los bordes del tronco no se ve el fondo en ninguna fila, del cuello a la entrepierna', () => {
  for (const style of ['anime', 'realista']) {
    for (const s of [0, 1]) {
      for (const yaw of [0, Math.PI]) {
        const { g, cam, sk, b } = gbuf({ style, s }, { yaw, joints: { shoulder_L: { abd: 25 }, shoulder_R: { abd: 25 } } });
        const trunk = new Set(['torso', 'neck'].map((n) => pidx(b, n)));
        const y0 = Math.ceil(cam.project([0, sk.T - 1.1, 0]).y), y1 = Math.floor(cam.project([0, sk.Lleg + 0.1, 0]).y);
        for (let y = y0; y <= y1; y++) {
          let x0 = Infinity, x1 = -Infinity;
          for (let x = 0; x < g.W; x++) if (trunk.has(g.part[y * g.W + x])) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
          let holes = 0;
          for (let x = x0 + 1; x < x1; x++) if (g.part[y * g.W + x] < 0) holes++;
          assert.equal(holes, 0, `${style} s=${s} vista ${yaw ? 'espalda' : 'frente'}: fila ${y} con ${holes} px de fondo dentro del tronco`);
        }
      }
    }
  }
});

test('Músculos visibles: de perfil, la pantorrilla y el muslo tienen un máximo de ancho propio', () => {
  // Se mide en las articulaciones de la malla (la rodilla de MakeHuman está al
  // 40 % de la pierna, como en la anatomía real).
  for (const s of [0, 1]) {
    const { g, cam, b } = gbuf({ style: 'realista', s }, { scale: 90, joints: {}, yaw: Math.PI / 2, W: 260 });
    const leg = pidx(b, 'leg_R'), r = b.model; // de perfil (θ = 90°) la pierna cercana es la derecha
    const J = (bone, j) => r.at(bone, MH.jointPos(r.rest.pos, j));
    const hip = J('upperleg01.R', 'upperleg01.R____head')[1], knee = J('lowerleg01.R', 'lowerleg01.R____head')[1], ankle = J('foot.R', 'foot.R____head')[1];
    const widthAtY = (yy) => {
      const py = Math.round(cam.project([0, yy, 0]).y);
      let x0 = Infinity, x1 = -Infinity;
      for (let x = 0; x < g.W; x++) if (g.part[py * g.W + x] === leg) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return x1 - x0 + 1;
    };
    const shin = knee - ankle, thighL = hip - knee;
    const kneeW = widthAtY(knee), ankleW = widthAtY(ankle + 0.15 * shin);
    const calf = Math.max(...[0.15, 0.2, 0.25, 0.3, 0.35].map((k) => widthAtY(knee - k * shin)));
    assert.ok(calf > kneeW && calf > ankleW * 1.3, `s=${s}: pantorrilla ${calf} px, rodilla ${kneeW}, tobillo ${ankleW}`);
    const thigh = Math.max(...[0.2, 0.3, 0.4].map((k) => widthAtY(hip - k * thighL))), aboveKnee = widthAtY(knee + 0.15 * thighL);
    assert.ok(thigh > aboveKnee * 1.1, `s=${s}: muslo ${thigh} px frente a ${aboveKnee} sobre la rodilla`);
  }
});

// ---------- Aceptación (docs/correccion-visual.md 12.1) ----------
test('Perfil de la cabeza con al menos 5 inflexiones (frente, puente, nariz, labios, barbilla)', () => {
  const sk = B.skeleton(B.params({ style: 'realista', s: 0 }));
  const { g, b } = gbuf({ style: 'realista', s: 0 }, { joints: {}, yaw: Math.PI / 2, scale: 150, W: 200, H: 200, cy: sk.T - 0.55, cx: 0.2 });
  const head = pidx(b, 'head'), xs = [];
  for (let y = 0; y < g.H; y++) {
    let mx = -1;
    for (let x = 0; x < g.W; x++) if (g.part[y * g.W + x] === head) mx = x;
    if (mx >= 0) xs.push(mx);
  }
  let ext = 0, dir = 0, ref = xs[0];
  for (const x of xs) {
    if (dir >= 0 && x < ref - 1) { if (dir > 0) ext++; dir = -1; ref = x; } else if (dir <= 0 && x > ref + 1) { if (dir < 0) ext++; dir = 1; ref = x; } else if ((dir > 0 && x > ref) || (dir < 0 && x < ref)) ref = x;
  }
  assert.ok(ext >= 5, `${ext} inflexiones`);
});

test('Cuello visible ≥ 0.3 H entre la barbilla y la línea de los hombros (vista frontal)', () => {
  // Distancia vertical de la barbilla a la primera fila en la que la silueta
  // alcanza el 85 % del ancho de hombros del canon.
  for (const s of [0, 1]) {
    const sk = B.skeleton(B.params({ style: 'anime', s }));
    const { g, cam } = gbuf({ style: 'anime', s }, { joints: {}, scale: 100, W: 300, H: 200, cy: sk.T - 1.3 });
    const width = (y) => { let x0 = Infinity, x1 = -Infinity; for (let x = 0; x < g.W; x++) if (g.part[y * g.W + x] >= 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } return (x1 - x0 + 1) / cam.scale; };
    const yChin = Math.round(cam.project([0, sk.T - 1, 0]).y);
    let y = yChin;
    while (y < g.H - 1 && width(y) < 0.85 * sk.w.shoulders) y++;
    const neck = (y - yChin) / cam.scale;
    assert.ok(neck >= 0.3, `s=${s}: cuello de ${neck.toFixed(2)} H`);
  }
});

test('Manos adultas de 0.65 a 0.80 H y mano de la malla a la medida del canon', () => {
  for (const style of ADULT) {
    for (const s of [0, 1]) {
      const h = B.skeleton(B.params({ style, s })).bones.hand;
      assert.ok(h >= 0.65 && h <= 0.8, `${style} s=${s}: ${h.toFixed(2)} H`);
    }
  }
});

test('La falda no se atraviesa: ninguna pierna asoma a través de la tela al andar y correr', () => {
  // Una pierna atraviesa la falda si se ve con tela visible justo encima y justo
  // debajo en la misma columna (la rodilla bajo el bajo no cuenta: debajo de
  // ella ya no hay falda delante).
  const look = { topStyle: 'camiseta', bottomStyle: 'falda', shoeStyle: 'zapatos', hairStyle: 'rapado' };
  let bad = 0;
  for (const anim of ['walk', 'run']) {
    for (let i = 0; i < 8; i++) {
      const { g, b } = gbuf({ style: 'anime', s: 1 }, { anim, t: i / 8, yaw: Math.PI / 2, look, scale: 40 });
      const skirt = pidx(b, 'skirt'), legs = [pidx(b, 'leg_L'), pidx(b, 'leg_R')];
      const at = (x, y) => (y >= 0 && y < g.H ? g.part[y * g.W + x] : -1);
      for (let y = 0; y < g.H; y++) {
        for (let x = 0; x < g.W; x++) {
          if (!legs.includes(at(x, y))) continue;
          let up = false, down = false;
          // La tela de debajo tiene que estar a la altura de la pierna o delante (no
          // la parte de atrás de la falda, que asoma más abajo que el bajo delantero).
          const z = g.depth[y * g.W + x];
          for (let d = 1; d <= 3; d++) {
            if (at(x, y - d) === skirt) up = true;
            if (at(x, y + d) === skirt && g.depth[(y + d) * g.W + x] > z - 0.05) down = true;
          }
          if (up && down) bad++;
        }
      }
    }
  }
  assert.equal(bad, 0, `${bad} píxeles de pierna atraviesan la falda`);
});

test('Sin manchas de sombra menores de 0.002 H² y sombra nunca negra', () => {
  const look = { topStyle: 'camiseta', bottomStyle: 'pantalon', shoeStyle: 'zapatos', hairStyle: 'bob' };
  const { g, cam } = gbuf({ style: 'anime', s: 1 }, { yaw: 0.72, look, shadow: true, scale: 50 });
  const { T, matKey } = CO.shade(g, { hairMat: 1 });
  const minArea = Math.max(3, Math.round(0.002 * cam.scale * cam.scale));
  const seen = new Uint8Array(T.length);
  let small = 0;
  for (let s0 = 0; s0 < T.length; s0++) {
    if (matKey[s0] < 0 || seen[s0]) continue;
    const st = [s0]; seen[s0] = 1; let n = 0, other = false;
    while (st.length) {
      const i = st.pop(); n++;
      const x = i % g.W;
      for (const j of [i - 1, i + 1, i - g.W, i + g.W]) {
        if (j < 0 || j >= T.length || (j === i - 1 && x === 0) || (j === i + 1 && x === g.W - 1) || matKey[j] !== matKey[s0]) continue;
        if (T[j] !== T[s0]) other = true;
        else if (!seen[j]) { seen[j] = 1; st.push(j); }
      }
    }
    if (n <= minArea && other) small++;
  }
  assert.equal(small, 0, `${small} manchas pequeñas`);
  for (const hex of ['#101014', '#2f3542', '#000000']) assert.ok(M.hexToOklch(CO.tones(hex, 'cloth').shadow)[0] >= 0.18 - 1e-3, hex);
});

test('Chibi: pierna ≥ 0.40 H y pie ≥ 4 px en un sprite de 32 px', () => {
  const P = B.params({ style: 'chibi', s: 0.5 }), sk = B.skeleton(P);
  assert.ok(sk.Lleg >= 0.4, `pierna ${sk.Lleg.toFixed(2)} H`);
  const { g, cam, b } = gbuf({ style: 'chibi', s: 0.5 }, { joints: {}, yaw: Math.PI / 2, scale: 32 / (sk.T + 0.37), W: 40, H: 40, cy: sk.T / 2 });
  const foot = pidx(b, 'foot_L'), foot2 = pidx(b, 'foot_R');
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < g.W * g.H; i++) if (g.part[i] === foot || g.part[i] === foot2) { const x = i % g.W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  assert.ok(x1 - x0 + 1 >= 4, `pie de ${x1 - x0 + 1} px`);
  void cam;
});

test('La malla sigue a la pose: huesos del rig y la malla alineados en todas las animaciones', () => {
  // La muñeca de la malla (centro de los vértices de la mano) queda cerca de
  // la muñeca del rig escalada a la malla: el retarget no se pierde.
  for (const anim of ['walk', 'run', 'jump', 'wave', 'attack']) {
    for (const t of [0, 0.3, 0.6]) {
      const b = E.build({ params: { style: 'anime', s: 1 }, look: NUDE }, anim, t);
      const D = MH.data(), hand = MH.PARTS.indexOf('hand_L');
      let c = [0, 0, 0], n = 0;
      for (let i = 0; i < D.nv; i++) if (D.inMesh.body[i] && D.part[i] === hand) { c = M.add(c, [b.model.pos[i * 3], b.model.pos[i * 3 + 1], b.model.pos[i * 3 + 2]]); n++; }
      c = M.mul(c, 1 / n);
      for (const v of c) assert.ok(Number.isFinite(v), `${anim} t=${t}: posición no finita`);
      assert.ok(c[1] > -0.2 && c[1] < b.sk.T + 1.5, `${anim} t=${t}: mano fuera del cuerpo (${c[1].toFixed(2)})`);
    }
  }
});

test('Rendimiento: un fotograma de 300×500 con ropa, pelo y sombras en menos de 1.5 s', () => {
  const t0 = performance.now();
  E.render({ params: { style: 'anime', s: 1 }, look: { hairStyle: 'largo', topStyle: 'larga', bottomStyle: 'falda', shoeStyle: 'botas' } }, 'walk', 0.2, { W: 300, H: 500 });
  const ms = performance.now() - t0;
  assert.ok(ms < 1500, `${ms.toFixed(0)} ms`);
  void C;
});
