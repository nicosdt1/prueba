// Convierte los assets CC0 de MakeHuman (malla base, morphs macro, esqueleto y
// pesos) en assets/mh/mh-data.js, un único script que la app carga con doble
// clic (con file:// el navegador no deja leer archivos binarios ni JSON).
//
// Uso:
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh
//   (cd mh && git sparse-checkout set makehuman/data/3dobjs makehuman/data/rigs makehuman/data/targets/macrodetails makehuman/data/targets/breast makehuman/data/targets/armslegs)
//   node tools/build-mh.mjs mh/makehuman/data
//
// Sólo se usan los assets (CC0), nunca el código de MakeHuman (AGPL).
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, '3dobjs/base.obj'))) {
  console.error('Uso: node tools/build-mh.mjs <carpeta makehuman/data>');
  process.exit(1);
}
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../assets/mh/mh-data.js');
const Q = 2000; // posiciones y desplazamientos en decímetros × 2000 (Int16, ±16 dm)

// ---------- Malla base ----------
const obj = fs.readFileSync(path.join(SRC, '3dobjs/base.obj'), 'utf8').split('\n');
const V = [], faces = {};
let group = '';
for (const line of obj) {
  if (line.startsWith('v ')) V.push(line.slice(2).trim().split(/\s+/).map(Number));
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) (faces[group] = faces[group] || []).push(line.slice(2).trim().split(/\s+/).map((t) => parseInt(t, 10) - 1));
}
// Mallas que se conservan: cuerpo, ojos (tapan las cuencas) y las ayudas de
// MakeHuman que siguen a los morphs (casco de pelo, falda y mallas ceñidas).
const MESHES = { body: ['body'], eyes: ['helper-l-eye', 'helper-r-eye'], hair: ['helper-hair'], skirt: ['helper-skirt'], tights: ['helper-tights'] };

// ---------- Esqueleto ----------
const skel = JSON.parse(fs.readFileSync(path.join(SRC, 'rigs/default.mhskel'), 'utf8'));
const wfile = JSON.parse(fs.readFileSync(path.join(SRC, 'rigs', skel.weights_file), 'utf8'));
// Huesos que se conservan (el resto funde sus pesos en el antepasado conservado
// más cercano): cara, lengua, ojos, dedos de los pies, metacarpos y pecho.
const drop = (n) => /^(levator|oculi|orbicularis|oris|risorius|temporalis|special|tongue|eye\.|jaw|toe|metacarpal|breast)/.test(n);
const bones = Object.keys(skel.bones);
const parentOf = (n) => skel.bones[n].parent;
const keptAncestor = (n) => { let b = n; while (b && drop(b)) b = parentOf(b); return b; };
const order = [];
const visit = (n) => { if (order.includes(n)) return; const p = parentOf(n); if (p) visit(p); order.push(n); };
bones.filter((n) => !drop(n)).forEach(visit);
const boneIndex = new Map(order.map((n, i) => [n, i]));

// Vértices usados: mallas conservadas y cubos de articulación de todo el esqueleto
// (también los de la cara: sirven de puntos de referencia para ojos y boca).
const used = new Set();
for (const groups of Object.values(MESHES)) for (const g of groups) for (const f of faces[g] || []) f.forEach((i) => used.add(i));
for (const vs of Object.values(skel.joints)) vs.forEach((i) => used.add(i));
const keep = [...used].sort((a, b) => a - b);
const remap = new Int32Array(V.length).fill(-1);
keep.forEach((v, i) => { remap[v] = i; });
const NV = keep.length;
if (NV > 65535) throw new Error('demasiados vértices para Uint16');

const toI16 = (x) => { const q = Math.round(x * Q); if (q < -32768 || q > 32767) throw new Error('fuera de rango: ' + x); return q; };
const b64 = (typed) => Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString('base64');

const pos = new Int16Array(NV * 3);
keep.forEach((v, i) => { for (let k = 0; k < 3; k++) pos[i * 3 + k] = toI16(V[v][k]); });

// Triángulos de cada malla (los quads se parten por la diagonal más corta).
const tris = {};
for (const [name, groups] of Object.entries(MESHES)) {
  const out = [];
  for (const g of groups) {
    for (const f of faces[g] || []) {
      const q = f.map((i) => remap[i]);
      if (q.length === 3) out.push(q[0], q[1], q[2]);
      else {
        const d = (a, b) => Math.hypot(...[0, 1, 2].map((k) => V[f[a]][k] - V[f[b]][k]));
        if (d(0, 2) <= d(1, 3)) out.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        else out.push(q[0], q[1], q[3], q[1], q[2], q[3]);
      }
    }
  }
  tris[name] = b64(new Uint16Array(out));
}

// Pesos: se funden en los huesos conservados y se quedan los 4 mayores.
const acc = Array.from({ length: NV }, () => new Map());
for (const [bone, list] of Object.entries(wfile.weights)) {
  const b = boneIndex.get(keptAncestor(bone));
  for (const [v, w] of list) {
    const i = remap[v];
    if (i < 0 || b == null) continue;
    acc[i].set(b, (acc[i].get(b) || 0) + w);
  }
}
const wIdx = new Uint8Array(NV * 4), wVal = new Uint8Array(NV * 4);
for (let i = 0; i < NV; i++) {
  const top = [...acc[i]].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0);
  if (!sum) { wIdx[i * 4] = 0; wVal[i * 4] = 255; continue; }
  let rest = 255;
  top.forEach(([b, w], k) => { const q = k === top.length - 1 ? rest : Math.round((w / sum) * 255); wIdx[i * 4 + k] = b; wVal[i * 4 + k] = q; rest -= q; });
}

// Articulaciones: cabeza y cola de cada hueso como lista de vértices (media).
const joints = {};
for (const [name, vs] of Object.entries(skel.joints)) joints[name] = vs.map((v) => remap[v]);
const skeleton = order.map((n) => ({ name: n, parent: parentOf(n) ? boneIndex.get(keptAncestor(parentOf(n))) : -1, head: skel.bones[n].head, tail: skel.bones[n].tail }));

// ---------- Morphs ----------
function target(rel) {
  const idx = [], d = [];
  // Varios archivos se suman en un solo morph (lados izquierdo y derecho).
  for (const r of [].concat(rel)) for (const line of fs.readFileSync(path.join(SRC, 'targets', r), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const [v, x, y, z] = line.trim().split(/\s+/).map(Number);
    const i = remap[v];
    if (i < 0) continue;
    idx.push(i); d.push(toI16(x), toI16(y), toI16(z));
  }
  return { idx: b64(new Uint16Array(idx)), d: b64(new Int16Array(d)) };
}
const T = {};
const levels = ['min', 'average', 'max'];
for (const g of ['female', 'male']) {
  for (const m of levels) for (const w of levels) T[`universal-${g}-${m}muscle-${w}weight`] = target(`macrodetails/universal-${g}-young-${m}muscle-${w}weight.target`);
  for (const r of ['african', 'asian', 'caucasian']) T[`${r}-${g}`] = target(`macrodetails/${r}-${g}-young.target`);
  for (const h of ['min', 'max']) T[`${g}-${h}height`] = target(`macrodetails/height/${g}-young-averagemuscle-averageweight-${h}height.target`);
  T[`${g}-idealproportions`] = target(`macrodetails/proportions/${g}-young-averagemuscle-averageweight-idealproportions.target`);
}
for (const c of ['mincup', 'maxcup']) T[`breast-${c}`] = target(`breast/female-young-averagemuscle-averageweight-${c}-averagefirmness.target`);
for (const f of ['minfirmness', 'maxfirmness']) T[`breast-${f}`] = target(`breast/female-young-averagemuscle-averageweight-averagecup-${f}.target`);
// Definición muscular de brazos y piernas (gemelos, muslos, bíceps, antebrazo).
for (const seg of ['lowerleg', 'upperleg', 'upperarm', 'lowerarm']) T[`${seg}-muscle`] = target(['l', 'r'].map((sd) => `armslegs/${sd}-${seg}-muscle-incr.target`));

const data = {
  version: 1,
  license: 'Malla base, morphs, esqueleto y pesos de MakeHuman (makehumancommunity.org), CC0 1.0.',
  scale: 1 / Q, nv: NV,
  pos: b64(pos), tris, weights: { idx: b64(wIdx), val: b64(wVal) },
  bones: skeleton, joints, targets: T,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, '// Generado por tools/build-mh.mjs a partir de los assets CC0 de MakeHuman. No editar.\nSC.MH_DATA = ' + JSON.stringify(data) + ';\n');
console.log(`${OUT}: ${NV} vértices, ${order.length} huesos, ${Object.keys(T).length} morphs, ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`);
