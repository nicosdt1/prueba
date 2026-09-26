// Pruebas de aceptación de docs/correccion-visual.md (sección 12.1) sobre el
// G-buffer calculado en CPU. Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = { SC: {}, Math, console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['core/util', 'core/skeleton', 'anat/canon', 'anat/math', 'anat/body', 'anat/rig', 'sdf/core', 'sdf/build', 'sdf/march', 'sdf/hair', 'sdf/clothes', 'sdf/compose']) {
  const file = path.join(root, 'js', f + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
const { AM: M, anatBody: B, anatRig: R, sdfBuild: SB, sdfMarch: MA, sdfClothes: CL, sdfHair: HR, sdfCompose: CO, SDF: S, CANON: C } = ctx.SC;

const NONE = { topStyle: 'ninguno', bottomStyle: 'ninguno', shoeStyle: 'ninguno', hairStyle: 'rapado' };
function scene(f, look = NONE) {
  const body = SB.scene(f, { lod: 30 });
  return S.finalize({ parts: body.parts.concat(CL.parts(f, body, look), look.hairStyle ? HR.parts(f, body, look.hairStyle) : []) });
}
function camFull(sk, yaw, W, H) {
  const top = sk.T + 0.25, bot = -0.12, scale = Math.min(H / (top - bot), W / (sk.w.shoulders + 1.6));
  return MA.camera(yaw, 0.05, W, H, { cx: 0, cy: (top + bot) / 2, scale });
}
const partIdx = (sc, name) => sc.parts.findIndex((p) => p.name === name);

test('Sin costuras: 0 líneas internas alrededor de hombros, caderas y cuello', () => {
  for (const s of [0, 1]) {
    const sk = B.skeleton({ style: 'anime', s });
    const pose = R.animate(sk, 'idle', 0);
    pose.joints.shoulder_L = { abd: 40 - C.aPose }; pose.joints.shoulder_R = { abd: 40 - C.aPose }; // brazos sin tapar el torso
    const f = R.solve(sk, pose), sc = scene(f), cam = camFull(sk, 0, 150, 260);
    const g = MA.gbuffer(sc, cam);
    const { matKey, I } = CO.shade(g, {});
    const marks = CO.detectLines(g, matKey, I, {}).filter((m) => m[2] !== 'silueta');
    const band = 0.1 * cam.scale;
    const spots = ['shoulder_L', 'shoulder_R', 'hip_L', 'hip_R'].map((j) => cam.project(f.pos[j]));
    spots.push(cam.project(f.xf('chest')([0, sk.yT(0.1), 0])));
    let bad = 0;
    for (const [i] of marks) {
      const x = i % g.W, y = (i - x) / g.W;
      if (spots.some((p) => Math.hypot(p.x - x - 0.5, p.y - y - 0.5) < band)) bad++;
    }
    assert.equal(bad, 0, `s=${s}: ${bad} píxeles de línea en las uniones`);
  }
});

test('Perfil de la cabeza con al menos 5 inflexiones (frente, puente, nariz, labios, barbilla)', () => {
  const sk = B.skeleton({ style: 'realista', s: 0 });
  const f = R.solve(sk, { joints: {} });
  const sc = scene(f);
  const hc = f.xf('head')([0, sk.T - 0.5, 0]);
  const cam = MA.camera(Math.PI / 2, 0, 160, 180, { cx: hc[2], cy: hc[1], scale: 150 });
  const g = MA.gbuffer(sc, cam), head = partIdx(sc, 'head');
  const xs = [];
  for (let y = 0; y < g.H; y++) {
    let mx = -1;
    for (let x = 0; x < g.W; x++) { const i = y * g.W + x; if (g.part[i] === head) mx = x; }
    if (mx >= 0) xs.push(mx);
  }
  // Extremos locales del contorno delantero (con histéresis de 1 px).
  let ext = 0, dir = 0, ref = xs[0];
  for (const x of xs) {
    if (dir >= 0 && x < ref - 1) { if (dir > 0) ext++; dir = -1; ref = x; } else if (dir <= 0 && x > ref + 1) { if (dir < 0) ext++; dir = 1; ref = x; } else if ((dir > 0 && x > ref) || (dir < 0 && x < ref)) ref = x;
  }
  assert.ok(ext >= 5, `${ext} inflexiones`);
});

test('Cuello visible ≥ 0.3 H entre la barbilla y los hombros (vista frontal)', () => {
  for (const s of [0, 1]) {
    const sk = B.skeleton({ style: 'anime', s }), f = R.solve(sk, { joints: {} }), sc = scene(f);
    const hc = f.xf('head')([0, sk.T - 1.2, 0]);
    const cam = MA.camera(0, 0, 60, 160, { cx: hc[0], cy: hc[1], scale: 100 });
    const g = MA.gbuffer(sc, cam), neck = partIdx(sc, 'neck');
    let rows = 0;
    const x = Math.floor(g.W / 2);
    for (let y = 0; y < g.H; y++) if (g.part[y * g.W + x] === neck) rows++;
    assert.ok(rows / cam.scale >= 0.3, `s=${s}: cuello de ${(rows / cam.scale).toFixed(2)} H`);
  }
});

test('Manos adultas de 0.65 a 0.80 H', () => {
  for (const style of ['realista', 'heroico', 'anime', 'shojo']) {
    for (const s of [0, 1]) {
      const h = B.skeleton({ style, s }).bones.hand;
      assert.ok(h >= 0.65 && h <= 0.8, `${style} s=${s}: ${h.toFixed(2)} H`);
    }
  }
});

test('Pie con volumen: alto en el tobillo > 2 × alto en los dedos', () => {
  const sk = B.skeleton({ style: 'anime', s: 0.5 }), f = R.solve(sk, { joints: {} });
  const leg = SB.legPart(f, 'L');
  const part = { prims: leg.prims.slice(-5) };
  const Lf = sk.bones.foot, a = sk.joints.ankle_L.rest;
  const heightAt = (z) => {
    for (let y = 0.6; y > 0; y -= 0.002) if (S.partDist(part, [a[0], y, z]) < 0) return y;
    return 0;
  };
  const hA = heightAt(0.05 * Lf), hT = heightAt(0.68 * Lf);
  assert.ok(hA > 2 * hT, `tobillo ${hA.toFixed(3)} vs dedos ${hT.toFixed(3)}`);
});

test('La falda no se atraviesa: 0 píxeles de pierna delante de la falda al andar y correr', () => {
  const sk = B.skeleton({ style: 'anime', s: 1 });
  const look = { topStyle: 'camiseta', bottomStyle: 'falda', shoeStyle: 'zapatos' };
  let bad = 0;
  for (const anim of ['walk', 'run']) {
    for (let i = 0; i < 8; i++) {
      const f = R.solve(sk, R.animate(sk, anim, i / 8)), sc = scene(f, look), cam = camFull(sk, Math.PI / 2, 90, 150);
      const g = MA.gbuffer(sc, cam);
      const yW = cam.project(f.xf('pelvis')([0, sk.yT(sk.tau.waist), 0])).y, yHem = Math.min(...[-0.4, 0, 0.4].map((z) => cam.project(f.xf('pelvis')([0, sk.yL(0.35), z])).y)); // el bajo se inclina con la pelvis
      const legs = [partIdx(sc, 'leg_L'), partIdx(sc, 'leg_R')];
      for (let y = Math.ceil(yW); y < Math.floor(yHem) - 2; y++) for (let x = 0; x < g.W; x++) if (legs.includes(g.part[y * g.W + x])) bad++;
    }
  }
  assert.equal(bad, 0, `${bad} píxeles de pierna atraviesan la falda`);
});

test('Sin manchas de sombra menores de 0.002 H² y sombra nunca negra', () => {
  const sk = B.skeleton({ style: 'anime', s: 1 }), f = R.solve(sk, R.animate(sk, 'idle', 0));
  const sc = scene(f, { topStyle: 'camiseta', bottomStyle: 'pantalon', shoeStyle: 'zapatos', hairStyle: 'bob' }), cam = camFull(sk, 0.72, 150, 260);
  const g = MA.gbuffer(sc, cam, { ao: true, shadow: true });
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
    // Una mancha es un tono rodeado de otro tono del mismo material; un trozo
    // diminuto de un mechón que asoma entero en un solo tono no lo es.
    if (n <= minArea && other) small++;
  }
  assert.equal(small, 0, `${small} manchas pequeñas`);
  for (const hex of ['#101014', '#2f3542', '#000000']) assert.ok(M.hexToOklch(CO.tones(hex, 'cloth').shadow)[0] >= 0.18 - 1e-3, hex);
});

test('Pose de reposo no rígida: asimetría y línea de acción', () => {
  for (const s of [0, 1]) {
    const sk = B.skeleton({ style: 'anime', s }), pose = R.animate(sk, 'idle', 0), f = R.solve(sk, pose);
    const j = pose.joints;
    const same = ['shoulder', 'elbow', 'hip', 'knee'].filter((k) => JSON.stringify(j[k + '_L'] || {}) === JSON.stringify(j[k + '_R'] || {}));
    assert.ok(same.length < 4, 'articulaciones simétricas: ' + same.join(', '));
    const a = f.pos.head_top, b = f.pos.ankle_L, p = f.pos.pelvis;
    const ab = M.sub(b, a), t = M.dot(M.sub(p, a), ab) / M.dot(ab, ab);
    const dist = M.dist(p, M.add(a, M.mul(ab, t)));
    assert.ok(dist > 0.03, `línea de acción recta (${dist.toFixed(3)} H)`);
  }
});

test('Chibi: pierna ≥ 0.40 H y pie ≥ 4 px en un sprite de 32 px', () => {
  const sk = B.skeleton({ style: 'chibi', s: 0.5 });
  assert.ok(sk.Lleg >= 0.4, `pierna ${sk.Lleg.toFixed(2)} H`);
  const px = (sk.bones.foot * 32) / (sk.T + 0.37);
  assert.ok(px >= 4, `pie de ${px.toFixed(1)} px`);
});
