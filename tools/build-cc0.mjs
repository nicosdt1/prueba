// Convierte los packs CC0 de Quaternius (assets/cc0) en paquetes ligeros para la
// app (assets/mod). Uso:  cd tools && npm install && npm run build-cc0
//
// - Une cada grupo de piezas en un solo .glb (las texturas compartidas se guardan una vez).
// - Quita mapas de normales, rugosidad y oclusión (el render es toon) y reduce las texturas.
// - Guarda cada paquete como .js en base64: así la app funciona con doble clic
//   (file://), donde el navegador no deja leer archivos con fetch.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, textureCompress, resample, prune, dedup, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CC0 = path.join(ROOT, 'assets/cc0');
const OUT = path.join(ROOT, 'assets/mod');
const UBC = path.join(CC0, 'base/UniversalBase/Universal Base Characters[Standard]');
const BODY = path.join(UBC, 'Base Characters/Godot - UE');
const HAIR = path.join(UBC, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)');
const OUTFIT = path.join(CC0, 'outfits/Fantasy/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts');
// Las librerías de animación vienen en .zip: descomprímelas en assets/cc0/animations/UAL1 y UAL2.
const UAL1 = path.join(CC0, 'animations/UAL1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const UAL2 = path.join(CC0, 'animations/UAL2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Deja sólo el color base en los materiales.
function toonMaterials(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    m.setNormalTexture(null);
    m.setOcclusionTexture(null);
    m.setMetallicRoughnessTexture(null);
    m.setEmissiveTexture(null);
    m.setMetallicFactor(0);
    m.setRoughnessFactor(1);
  }
}

// Algunos .gltf apuntan a texturas que no vienen en el pack (p. ej. mapas de normales):
// se sustituyen por un píxel antes de leer (esos mapas se descartan igualmente).
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
async function read(file) {
  if (!file.endsWith('.gltf')) return io.read(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let patched = false;
  for (const img of json.images || []) {
    if (img.uri && !img.uri.startsWith('data:') && !fs.existsSync(path.join(path.dirname(file), decodeURIComponent(img.uri)))) { img.uri = PIXEL; patched = true; }
  }
  if (!patched) return io.read(file);
  const tmp = file.replace(/\.gltf$/, '.__tmp.gltf');
  fs.writeFileSync(tmp, JSON.stringify(json));
  try { return await io.read(tmp); } finally { fs.unlinkSync(tmp); }
}

// Rotaciones de animación en enteros de 16 bits normalizados (permitido por glTF):
// la mitad de tamaño sin pérdida visible.
function quantizeRotations(doc) {
  for (const a of doc.getRoot().listAnimations()) {
    for (const sm of a.listSamplers()) {
      const out = sm.getOutput();
      if (!out || out.getElementSize() !== 4 || out.getComponentType() !== 5126) continue;
      const src = out.getArray(), q = new Int16Array(src.length);
      for (let i = 0; i < src.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, src[i])) * 32767);
      out.setArray(q).setNormalized(true);
    }
  }
}

// Accesores que ya no usa nadie (restos de clips y pistas descartados).
function dropOrphans(doc) {
  const root = doc.getRoot(), used = new Set();
  for (const a of root.listAnimations()) for (const sm of a.listSamplers()) used.add(sm.getInput()).add(sm.getOutput());
  for (const sk of root.listSkins()) used.add(sk.getInverseBindMatrices());
  for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) { used.add(pr.getIndices()); for (const at of pr.listAttributes()) used.add(at); }
  let n = 0;
  for (const acc of root.listAccessors()) if (!used.has(acc)) { acc.dispose(); n++; }
  for (const a of root.listAnimations()) for (const sm of a.listSamplers()) if (!a.listChannels().some((c) => c.getSampler() === sm)) sm.dispose();
  return n;
}

// Tras unir varios archivos cada uno trae su propio esqueleto (con los mismos
// nombres de hueso). Se deja uno solo: las mallas, pieles y animaciones pasan a
// usar los huesos del primero y el resto se elimina. Así los nombres son únicos.
function unifySkeleton(doc) {
  const root = doc.getRoot(), scenes = root.listScenes();
  const [s0, ...others] = scenes;
  const arm0 = s0.listChildren()[0];
  const byName = {};
  arm0.traverse((n) => { if (!n.getMesh()) byName[n.getName()] = n; });
  const same = (n) => (n && byName[n.getName()]) || n;
  for (const sk of root.listSkins()) {
    const joints = sk.listJoints();
    for (const j of joints) sk.removeJoint(j);
    for (const j of joints) sk.addJoint(same(j));
    if (sk.getSkeleton()) sk.setSkeleton(same(sk.getSkeleton()));
  }
  for (const a of root.listAnimations()) for (const ch of a.listChannels()) ch.setTargetNode(same(ch.getTargetNode()));
  for (const s of others) {
    for (const arm of s.listChildren()) {
      for (const c of arm.listChildren()) if (c.getMesh()) arm0.addChild(c);
      const dead = [];
      arm.traverse((n) => { if (!n.getMesh()) dead.push(n); });
      for (const n of dead) n.dispose();
    }
    s.dispose();
  }
}

async function pack(id, files, { size = 1024, format = 'jpeg', anims = null } = {}) {
  const doc = await read(files[0]);
  for (const f of files.slice(1)) mergeDocuments(doc, await read(f));
  unifySkeleton(doc);
  const root = doc.getRoot();
  if (!anims) for (const a of root.listAnimations()) a.dispose();
  if (anims) {
    // Paquete de animaciones: fuera la malla del maniquí, sólo huesos y clips ('all' = todos).
    for (const n of root.listNodes()) if (n.getMesh()) n.setMesh(null);
    for (const a of root.listAnimations()) if (a.getName() === 'A_TPose' || (anims !== 'all' && !anims.includes(a.getName()))) a.dispose();
    // Nombres únicos (los dos paquetes traen A_TPose).
    const seen = new Set();
    for (const a of root.listAnimations()) { if (seen.has(a.getName())) a.dispose(); else seen.add(a.getName()); }
    // Sólo rotaciones (más la traslación de la cadera): la escala y el resto de
    // traslaciones no cambian y ocupan la mayor parte del archivo.
    for (const a of root.listAnimations()) {
      for (const ch of a.listChannels()) {
        const n = ch.getTargetNode(), p = ch.getTargetPath();
        if (p === 'scale' || (p === 'translation' && !/^(pelvis|root)$/.test(n && n.getName()))) {
          const sm = ch.getSampler(), out = sm.getOutput();
          ch.dispose();
          if (sm && !sm.listParents().some((q) => q.propertyType === 'AnimationChannel')) { sm.dispose(); if (out && !out.listParents().some((q) => q.propertyType !== 'Root')) out.dispose(); }
        }
      }
    }
  }
  toonMaterials(doc);
  await doc.transform(
    prune(),
    dedup(),
    ...(anims ? [resample({ tolerance: 4e-3 }), quantizeRotations, dropOrphans] : []),
    textureCompress({ encoder: sharp, targetFormat: format, resize: [size, size], quality: 82 }),
    unpartition(),
  );
  const glb = await io.writeBinary(doc);
  const js = `// Generado por tools/build-cc0.mjs a partir de assets de Quaternius (CC0).\n(window.SC_MOD_DATA = window.SC_MOD_DATA || {})[${JSON.stringify(id)}] = "${Buffer.from(glb).toString('base64')}";\n`;
  fs.writeFileSync(path.join(OUT, id + '.js'), js);
  console.log(id.padEnd(12), (glb.byteLength / 1024 / 1024).toFixed(2), 'MB');
}

fs.mkdirSync(OUT, { recursive: true });
const hairs = ['Hair_Long', 'Hair_SimpleParted', 'Hair_Buns', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Beard', 'Eyebrows_Female', 'Eyebrows_Regular'];
const parts = (sex) => fs.readdirSync(OUTFIT).filter((f) => f.startsWith(sex + '_') && f.endsWith('.gltf')).map((f) => path.join(OUTFIT, f));
await pack('body_f', [path.join(BODY, 'Superhero_Female_FullBody.gltf')]);
await pack('body_m', [path.join(BODY, 'Superhero_Male_FullBody.gltf')]);
await pack('hair', hairs.map((h) => path.join(HAIR, h + '.gltf')), { size: 512, format: 'png' });
await pack('outfit_f', parts('Female'), { size: 1024 });
await pack('outfit_m', parts('Male'), { size: 1024 });
await pack('anims', [UAL1, UAL2], { anims: 'all' });
