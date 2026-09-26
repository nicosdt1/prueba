// Importador de hojas LPC (Liberated Pixel Cup).
//
// El "Universal LPC Spritesheet Character Generator" produce hojas PNG con
// fotogramas de 64×64 en una disposición estándar (una fila por animación y
// dirección). Aquí se cargan esas hojas, se reproducen con las animaciones y
// vistas de la app y se reexportan con nuestro JSON. El arte LPC tiene licencia
// CC-BY-SA / GPL (y otras): hay que acreditar a sus autores, por eso se guarda
// y se incluye el archivo de créditos que genera la propia herramienta.
SC.lpc = (() => {
  const F = 64;
  // Filas base: [primera fila (arriba), nº de fotogramas]; direcciones: arriba, izquierda, abajo, derecha.
  const BASE = {
    spellcast: [0, 7], thrust: [4, 8], walk: [8, 9], slash: [12, 6], shoot: [16, 13], hurt: [20, 6],
  };
  // Hojas ampliadas (generador moderno): filas adicionales.
  const EXT = { idle: [22, 2], jump: [26, 5], run: [38, 8] };
  const DIR = { back: 0, threeBack: 0, left: 1, front: 2, three: 2, side: 3 };

  let img = null, credits = '', name = '';

  function load(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        if (im.width < F * 6 || im.height < F * 21) { rej(new Error('No parece una hoja LPC (mínimo 13×21 fotogramas de 64 px)')); return; }
        img = im;
        name = file.name.replace(/\.[^.]+$/, '');
        res({ name, frames: `${Math.floor(im.width / F)}×${Math.floor(im.height / F)}`, extended: extended() });
      };
      im.onerror = () => rej(new Error('No se pudo leer la imagen'));
      im.src = url;
    });
  }
  const extended = () => !!img && img.height >= F * 42;
  const setCredits = (text) => { credits = text; };

  // Qué filas LPC usa cada animación de la app.
  function source(animId) {
    const ext = extended();
    switch (animId) {
      case 'walk': return { rows: BASE.walk, from: 1, count: 8 };
      case 'run': return ext ? { rows: EXT.run, from: 0, count: 8 } : { rows: BASE.walk, from: 1, count: 8 };
      case 'jump': return ext ? { rows: EXT.jump, from: 0, count: 5 } : { rows: BASE.walk, from: 0, count: 1 };
      case 'wave': return { rows: BASE.spellcast, from: 0, count: 7 };
      case 'attack': return { rows: BASE.slash, from: 0, count: 6 };
      case 'idle': return ext ? { rows: EXT.idle, from: 0, count: 2 } : { rows: BASE.walk, from: 0, count: 1 };
      default: return { rows: BASE.walk, from: 0, count: 1 };
    }
  }

  function frameCount(animId) { return source(animId).count; }

  function frame(animId, view, i, w = F, h = F) {
    const src = source(animId);
    const row = src.rows[0] + (animId === 'hurt' ? 0 : DIR[view] != null ? DIR[view] : 2);
    const col = src.from + (i % src.count);
    const cv = SC.render.makeCanvas(w, h), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const k = Math.max(1, Math.floor(Math.min(w / F, h / F)));
    c.drawImage(img, col * F, row * F, F, F, Math.round((w - F * k) / 2), h - F * k, F * k, F * k);
    return cv;
  }

  function renderAnimation(ch, animId, mode, o = {}) {
    const n = frameCount(animId), out = [];
    for (let i = 0; i < n; i++) out.push(frame(animId, o.view || 'front', i));
    return out;
  }

  return {
    load, setCredits, frame, frameCount, renderAnimation,
    get loaded() { return !!img; },
    get credits() { return credits; },
    get name() { return name; },
    get extended() { return extended(); },
  };
})();
