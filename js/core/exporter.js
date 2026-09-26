// Exportación: PNG, hojas de sprites con metadatos JSON y paquetes ZIP.
// El ZIP se genera sin dependencias (método "store", sin compresión: los PNG
// ya vienen comprimidos).
SC.exporter = (() => {
  const enc = new TextEncoder();

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // files: [{ name, data: Uint8Array | string }]
  function dosDateTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  function zip(files) {
    const parts = [], central = [];
    const { time, date } = dosDateTime(new Date());
    let offset = 0;
    for (const f of files) {
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // nombres en UTF-8
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(12, time, true);
      cen.setUint16(14, date, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cenSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  function canvasBlob(canvas) {
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  }

  async function canvasBytes(canvas) {
    return new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function slug(s) {
    return (String(s || 'personaje').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')) || 'personaje';
  }

  // Escala un canvas de pixel art sin suavizado.
  function upscale(canvas, k) {
    if (k === 1) return canvas;
    const out = SC.render.makeCanvas(canvas.width * k, canvas.height * k);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  }

  // Hoja de sprites: una fila por animación (y por dirección). Devuelve { canvas, meta }.
  // dirs: [{ view: 'front', dir: 'abajo' }, ...]
  function spritesheet(ch, animIds, mode, o, name, dirs) {
    const D = dirs && dirs.length ? dirs : [{ view: o.view || 'front', dir: null }];
    const rows = [];
    for (const id of animIds) {
      for (const d of D) {
        rows.push({ anim: SC.ANIMS[id], key: d.dir ? `${id}_${d.dir}` : id, frames: SC.render.renderAnimation(ch, id, mode, Object.assign({}, o, { view: d.view })) });
      }
    }
    const fw = rows[0].frames[0].width, fh = rows[0].frames[0].height;
    const cols = Math.max(...rows.map((r) => r.frames.length));
    const sheet = SC.render.makeCanvas(fw * cols, fh * rows.length);
    const ctx = sheet.getContext('2d');
    const animations = {};
    rows.forEach((r, y) => {
      r.frames.forEach((f, x) => ctx.drawImage(f, x * fw, y * fh));
      animations[r.key] = { row: y, frames: r.frames.length, fps: r.anim.fps, loop: r.anim.id !== 'attack' && r.anim.id !== 'jump' };
    });
    const meta = {
      generator: 'Forja de Sprites',
      image: name + '.png',
      frameWidth: fw,
      frameHeight: fh,
      columns: cols,
      rows: rows.length,
      animations,
    };
    return { canvas: sheet, meta };
  }

  function renpyScript(name, files) {
    const lines = ['# Generado por Forja de Sprites', '# Copia la carpeta en game/images/ de tu proyecto Ren\'Py.', ''];
    for (const f of files) lines.push(`image ${name} ${f.expr} = "images/${name}/${f.file}"`);
    lines.push('', '# Ejemplo de uso en tu guion:', `#   show ${name} ${files[0].expr}`, '');
    return lines.join('\n');
  }

  return { zip, crc32, canvasBlob, canvasBytes, download, slug, upscale, spritesheet, renpyScript };
})();
