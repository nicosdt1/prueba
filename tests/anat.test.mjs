// Tests del núcleo anatómico (docs/base-matematica.md, sección 13.2).
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = { SC: {}, Math, console };
vm.createContext(ctx);
for (const f of ['canon', 'math', 'body', 'rig']) {
  const file = path.join(root, 'js/anat', f + '.js');
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
const { AM: M, anatBody: B, anatRig: R } = ctx.SC;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} ≠ ${b} ± ${tol}`);

test('Catmull-Rom centrípeta pasa exactamente por sus puntos', () => {
  const pts = [[0, 0], [1, 2], [3, 3], [4, 0], [6, 1]];
  const out = M.catmullRom(pts, { samples: 10 });
  for (let i = 0; i < pts.length; i++) {
    const q = out[Math.min(out.length - 1, i * 10)];
    near(q[0], pts[i][0], 1e-9, 'x'); near(q[1], pts[i][1], 1e-9, 'y');
  }
});

test('Hermite monótono nunca supera los valores de entrada', () => {
  const xs = [0, 1, 2, 3, 4, 5], ys = [0, 0.5, 3, 3.1, 3.1, 8];
  const f = M.monotone(xs, ys);
  for (let k = 0; k < xs.length - 1; k++) {
    const lo = Math.min(ys[k], ys[k + 1]), hi = Math.max(ys[k], ys[k + 1]);
    for (let t = 0; t <= 1; t += 0.05) {
      const v = f(xs[k] + t * (xs[k + 1] - xs[k]));
      assert.ok(v >= lo - 1e-9 && v <= hi + 1e-9, `sobrepasa en tramo ${k}: ${v}`);
    }
  }
});

test('Índices de dimorfismo del canon (s=0 → SHR 1.40, s=1 → SHR 0.97)', () => {
  const m = B.skeleton({ s: 0, e: 1, b: 0 }), f = B.skeleton({ s: 1, e: 1, b: 0 });
  near(m.indices.SHR, 1.40, 0.01, 'SHR hombre');
  near(f.indices.SHR, 0.97, 0.01, 'SHR mujer');
  near(m.indices.WHR, 0.90, 0.01, 'WHR hombre');
  near(f.indices.WHR, 0.66, 0.01, 'WHR mujer');
  assert.equal(B.sexLabel(m), 'masculino');
  assert.equal(B.sexLabel(f), 'femenino');
});

test('Canon de 8 cabezas: huesos clásicos', () => {
  const sk = B.skeleton({ style: 'heroico', s: 0, e: 1 });
  near(sk.bones.upperArm, 1.47, 0.01, 'brazo'); near(sk.bones.forearm, 1.20, 0.01, 'antebrazo');
  near(sk.bones.hand, 0.75, 0.01, 'mano'); near(sk.bones.foot, 1.08, 0.01, 'pie');
});

test('El codo cae a la altura de la cintura con el brazo vertical (± 0.1 L_torso)', () => {
  for (const style of Object.keys(ctx.SC.CANON.styles)) {
    for (const s of [0, 1]) {
      const sk = B.skeleton({ style, s });
      const sh = sk.joints.shoulder_L.rest[1];
      near(sh - sk.bones.upperArm, sk.yT(sk.tau.waist), 0.1 * sk.Ltorso, `${style} s=${s}`);
    }
  }
});

test('Simetría exacta: cada punto R es el espejo de su L', () => {
  for (const s of [0, 0.3, 1]) {
    const sk = B.skeleton({ s, b: 0.4, e: 1.3 });
    for (const [n, j] of Object.entries(sk.joints)) {
      if (!n.endsWith('_L')) continue;
      const r = sk.joints[n.replace(/_L$/, '_R')].rest;
      near(r[0], -j.rest[0], 1e-6, n); near(r[1], j.rest[1], 1e-6, n); near(r[2], j.rest[2], 1e-6, n);
    }
  }
});

test('Todos los estilos cumplen L_torso ≥ 0.8 H', () => {
  for (const style of Object.keys(ctx.SC.CANON.styles)) assert.ok(B.skeleton({ style }).valid, style);
});

test('IK de dos huesos: alcanza objetivos alcanzables con error < 1e-4 y conserva longitudes', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < 200; i++) {
    const A = [rnd(), rnd(), rnd()], L1 = 1 + Math.abs(rnd()), L2 = 0.5 + Math.abs(rnd());
    const dir = M.norm([rnd(), rnd(), rnd()]), d = Math.abs(L1 - L2) + 0.01 + Math.abs(rnd()) * (L1 + L2 - Math.abs(L1 - L2) - 0.02);
    const P = M.add(A, M.mul(dir, d));
    const r = R.ik2(A, P, L1, L2, [rnd(), rnd(), rnd()]);
    near(M.dist(r.end, P), 0, 1e-4, 'alcance');
    near(M.dist(A, r.mid), L1, 1e-6, 'L1'); near(M.dist(r.mid, r.end), L2, 1e-6, 'L2');
  }
});

test('Las animaciones conservan la longitud de los huesos (±0.5 %)', () => {
  const sk = B.skeleton({ s: 1 });
  const pairs = [['shoulder_L', 'elbow_L'], ['elbow_R', 'wrist_R'], ['hip_L', 'knee_L'], ['knee_R', 'ankle_R']];
  const rest = pairs.map(([a, b]) => M.dist(sk.joints[a].rest, sk.joints[b].rest));
  for (const id of ['idle', 'walk', 'run', 'jump', 'wave', 'attack']) {
    for (let i = 0; i < 8; i++) {
      const f = R.solve(sk, R.animate(sk, id, i / 8));
      pairs.forEach(([a, b], k) => near(M.dist(f.pos[a], f.pos[b]) / rest[k], 1, 0.005, `${id} ${a}`));
    }
  }
});

test('Límites articulares: la rodilla y el codo nunca se doblan al revés', () => {
  assert.equal(R.clampJoint('knee_L', { flex: -30 }).flex, 0);
  assert.equal(R.clampJoint('elbow_R', { flex: 200 }).flex, 145);
});

test('Reposo en contrapposto: pies en el suelo y centro de masas sobre el apoyo', () => {
  for (const s of [0, 1]) {
    const sk = B.skeleton({ s });
    const f = R.solve(sk, R.animate(sk, 'idle', 0));
    const feet = ['L', 'R'].map((S) => R.footPoints(f, S));
    near(Math.min(...feet.flatMap((q) => [q.heel[1], q.toe[1]])), 0, 1e-9, 'suelo');
    assert.ok(R.balanced(f), 'equilibrio');
    near(R.centerOfMass(f)[0], f.pos.ankle_L[0], 0.02, 'CM sobre el tobillo de apoyo');
  }
});

test('Rampas OKLCH: tonos vecinos separados ΔL ≥ 0.06 y sombras más frías', () => {
  for (const base of ['#f2c9a8', '#3a6fd6', '#6b3f2a', '#e0445e']) {
    const L = [-2, -1, 0, 1, 2].map((k) => M.hexToOklch(M.ramp(base, k))[0]);
    for (let i = 1; i < L.length; i++) assert.ok(L[i] - L[i - 1] >= 0.06 - 0.01, `${base} ${L}`);
  }
  const [, , h] = M.hexToOklch('#f2c9a8');
  const [, , hs] = M.hexToOklch(M.ramp('#f2c9a8', -2));
  assert.ok(Math.abs(((hs - 280 + 540) % 360) - 180) < Math.abs(((h - 280 + 540) % 360) - 180), 'la sombra se acerca al azul');
});

test('OKLCH ida y vuelta', () => {
  for (const hex of ['#000000', '#ffffff', '#3a6fd6', '#f2c9a8', '#7a3cc8']) {
    const back = M.oklchToHex(M.hexToOklch(hex));
    const a = M.hexToRgb(hex), b = M.hexToRgb(back);
    a.forEach((v, i) => near(v, b[i], 1, hex));
  }
});

const P = ctx.SC.anatParts;

// ---------- docs/auditoria.md, sección 5: proporciones de hueso ----------
const ADULT = ['realista', 'heroico', 'anime', 'shojo'];

test('Brazo mayor que antebrazo en los dos sexos (húmero ≈ 1.2 × antebrazo)', () => {
  for (const style of ADULT) {
    for (const s of [0, 0.5, 1]) {
      const b = B.skeleton({ style, s }).bones;
      const r = b.upperArm / b.forearm;
      assert.ok(r > 1.1 && r < 1.35, `${style} s=${s}: brazo/antebrazo ${r.toFixed(2)}`);
    }
  }
});

test('Con el brazo colgando, la punta de los dedos llega a medio muslo (± 0.3 H)', () => {
  for (const style of ADULT) {
    for (const s of [0, 1]) {
      const sk = B.skeleton({ style, s });
      const tip = sk.joints.shoulder_L.rest[1] - (sk.bones.upperArm + sk.bones.forearm + sk.bones.hand);
      near(tip, sk.yL(sk.eta.midThigh), 0.3, `${style} s=${s}: dedos`);
    }
  }
});

test('Anchos del tronco escalados a su largo: cadera / tronco ≈ 0.58 (± 0.06) en mujer', () => {
  for (const style of ADULT) {
    const sk = B.skeleton({ style, s: 1 });
    near(sk.w.hip / sk.Ltorso, 0.58, 0.06, `${style}: cadera/tronco`);
  }
});

test('Entrepierna del anime a unas 3.5 cabezas de la coronilla (λ 0.50)', () => {
  const sk = B.skeleton({ style: 'anime', s: 1 });
  near((sk.T - sk.Lleg) / sk.H, 3.5, 0.05, 'entrepierna');
  const sj = B.skeleton({ style: 'shojo', s: 1 });
  near(sj.Lleg / sj.T, 0.52, 1e-9, 'λ shōjo');
});
