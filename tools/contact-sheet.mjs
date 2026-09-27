// Hoja de contacto para la revisión visual (docs/auditoria.md, sección 5):
// 4 estilos × 2 sexos × frente, 3/4 y perfil, sin ropa ni pelo, con el mismo
// sombreado cel y las mismas líneas que la app. Sin dependencias ni navegador.
//
// Uso:  node tools/contact-sheet.mjs [salida.png] [--vestido]
// Filas: realista, heroico, anime, shōjo; en cada fila hombre (frente, 3/4,
// perfil) y mujer (frente, 3/4, perfil).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2), dressed = args.includes('--vestido');
const out = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, 'out/hoja_contacto.png'));

const ctx = { SC: {}, Math, console, atob, performance };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/core/catalog', 'js/anat/canon', 'js/anat/math', 'js/anat/body', 'js/anat/rig', 'assets/mh/mh-data', 'js/render/camera', 'js/render/compose', 'js/mh/model', 'js/mh/raster', 'js/mh/dress', 'js/mh/engine']) {
  vm.runInContext(fs.readFileSync(path.join(root, f + '.js'), 'utf8'), ctx, { filename: f });
}
const { engine: E, compose: CO, AM: M, anatBody: B } = ctx.SC;

// Un fotograma con tonos cel (luz, sombra, sombra profunda) y líneas de 1 px.
function frame(params, yaw, W, H) {
  const look = dressed ? { hairStyle: 'bob', topStyle: 'camiseta', bottomStyle: params.s > 0.5 ? 'falda' : 'pantalon', shoeStyle: 'zapatos' }
    : { hairStyle: 'rapado', topStyle: 'ninguno', bottomStyle: 'ninguno', shoeStyle: 'ninguno' };
  const r = E.render({ params, look }, 'idle', 0, { W, H, view: yaw, tilt: 0.05 });
  const g = r.g, { T, I, matKey } = CO.shade(g, { hairMat: 1 });
  const colors = E.colorsOf(Object.assign({}, E.DEFAULT_LOOK, look)), pal = {};
  for (const [m, hex] of Object.entries(colors)) pal[m] = CO.tones(hex, E.KINDS[m]);
  const d = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if (matKey[i] < 0 || !pal[g.mat[i]]) continue;
    const p = pal[g.mat[i]], t = T[i];
    d.set([...M.hexToRgb(t === 0 ? p.base : t === 1 ? p.shadow : t === 2 ? p.deep : p.hi), 255], i * 4);
  }
  for (const [i] of CO.detectLines(g, matKey, I, {})) {
    const p = pal[g.mat[i]];
    if (p) d.set([...M.hexToRgb(CO.lineColor(p.base, E.KINDS[g.mat[i]])), 255], i * 4);
  }
  return d;
}

const styles = ['realista', 'heroico', 'anime', 'shojo'], views = ['front', 'three', 'side'];
const W = 150, H = 300, gap = 6, cols = 6, sheetW = cols * (W + gap) + gap, sheetH = styles.length * (H + gap) + gap;
const img = new Uint8Array(sheetW * sheetH * 4);
for (let i = 0; i < sheetW * sheetH; i++) img.set([236, 233, 242, 255], i * 4);
const t0 = performance.now();
styles.forEach((style, row) => {
  [0, 1].forEach((s, si) => {
    views.forEach((view, vi) => {
      const d = frame(B.params({ style, s }), view, W, H);
      const x0 = gap + (si * 3 + vi) * (W + gap), y0 = gap + row * (H + gap);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        if (d[k + 3]) img.set(d.subarray(k, k + 4), ((y0 + y) * sheetW + x0 + x) * 4);
      }
    });
  });
});

// PNG (RGBA, sin filtros) con zlib de Node.
function png(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let x = 0xffffffff; for (const v of b) x = table[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
png(out, sheetW, sheetH, img);
console.log(`${out}: ${styles.length * 6} vistas en ${((performance.now() - t0) / 1000).toFixed(1)} s`);
console.log('Filas: ' + styles.join(', ') + '. Columnas: hombre (frente, 3/4, perfil), mujer (frente, 3/4, perfil).');
