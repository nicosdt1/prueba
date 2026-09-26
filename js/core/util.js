// Utilidades de color, geometría y dibujo compartidas por todo el proyecto.
// Se usa un espacio de nombres global (SC) para que la app funcione abriendo
// index.html directamente, sin servidor ni módulos ES.
window.SC = window.SC || {};

SC.util = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpPt = (p, q, t) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });

  function rotateAround(p, c, ang) {
    const s = Math.sin(ang), co = Math.cos(ang);
    const dx = p.x - c.x, dy = p.y - c.y;
    return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
  }

  function hexToRgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const t = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + t(r) + t(g) + t(b);
  }

  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(lerp(A.r, B.r, t), lerp(A.g, B.g, t), lerp(A.b, B.b, t));
  }

  // Sombra "anime": oscurece hacia un violeta frío en vez de hacia negro puro.
  function shade(hex, amt) {
    if (amt < 0) return mix(hex, '#2b1d3f', -amt);
    return mix(hex, '#fffaf0', amt);
  }

  // Generador pseudoaleatorio con semilla (para aleatorizar de forma reproducible).
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  return { clamp, lerp, lerpPt, add, rotateAround, hexToRgb, rgbToHex, mix, shade, rng, deepClone };
})();

// Primitivas de dibujo con contorno y sombreado. Todas respetan rig.detail
// ('high' para novela visual, 'low' para pixel art) y rig.line (grosor de línea).
SC.draw = (() => {
  const U = SC.util;

  function lineColor(rig, color) {
    return rig.lineMode === 'dark' ? '#1e1628' : U.shade(color, -0.62);
  }

  // Rellena un trazado, aplica sombreado opcional (recortado al trazado) y lo contornea.
  function shape(ctx, rig, color, build, opts = {}) {
    ctx.beginPath();
    build(ctx);
    if (opts.close !== false) ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (opts.shade && rig.detail === 'high') {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = U.shade(color, -0.14);
      ctx.beginPath();
      opts.shade(ctx);
      ctx.fill();
      if (opts.light) {
        ctx.fillStyle = U.shade(color, 0.28);
        ctx.beginPath();
        opts.light(ctx);
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      build(ctx);
      if (opts.close !== false) ctx.closePath();
    }
    if (rig.line > 0 && opts.stroke !== false) {
      ctx.lineWidth = rig.line * (opts.lineScale || 1);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = opts.lineColor || lineColor(rig, color);
      ctx.stroke();
    }
  }

  // Extremidad como trazo grueso que sigue una polilínea (hombro→codo→mano...).
  function limb(ctx, rig, pts, width, color, opts = {}) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = opts.cap || 'round';
    if (rig.line > 0) {
      path();
      ctx.lineWidth = width + rig.line * 2;
      ctx.strokeStyle = lineColor(rig, color);
      ctx.stroke();
    }
    path();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (rig.detail === 'high' && opts.shade !== false) {
      // Banda de sombra desplazada hacia abajo-derecha (luz desde arriba-izquierda).
      const off = pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b.y - a.y), ny = b.x - a.x;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len; ny /= len;
        if (nx + ny * 0.3 < 0) { nx = -nx; ny = -ny; }
        return { x: p.x + nx * width * 0.27, y: p.y + ny * width * 0.27 };
      });
      ctx.beginPath();
      ctx.moveTo(off[0].x, off[0].y);
      for (let i = 1; i < off.length; i++) ctx.lineTo(off[i].x, off[i].y);
      ctx.lineWidth = width * 0.42;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = U.shade(color, -0.12);
      ctx.stroke();
    }
  }

  // Línea de detalle (pliegues, mechones). Sólo en alto detalle salvo que se fuerce.
  function detailLine(ctx, rig, color, build, width = 1, force = false) {
    if (rig.detail !== 'high' && !force) return;
    ctx.beginPath();
    build(ctx);
    ctx.lineWidth = rig.line * width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  }

  function poly(ctx, pts) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  // Curva suave que pasa por los puntos (Catmull-Rom convertida a Bézier).
  function smooth(ctx, pts, closed = false, moveTo = true) {
    const n = pts.length;
    const P = (i) => closed ? pts[(i + n) % n] : pts[U.clamp(i, 0, n - 1)];
    if (moveTo) ctx.moveTo(pts[0].x, pts[0].y);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y
      );
    }
  }

  return { lineColor, shape, limb, detailLine, ellipse, poly, smooth };
})();
