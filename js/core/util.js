// Utilidades de dibujo 2D. Se usa un espacio de nombres global (SC) para que
// la app funcione abriendo index.html directamente, sin servidor ni módulos ES.
window.SC = window.SC || {};

// Primitivas 2D (rasgos de la cara).
SC.draw = (() => {
  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.ellipse(x, y, Math.max(0.01, Math.abs(rx)), Math.max(0.01, Math.abs(ry)), rot, 0, Math.PI * 2);
  }
  function stroke(ctx, color, width, build) {
    ctx.beginPath();
    build(ctx);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  function fill(ctx, color, build) {
    ctx.beginPath();
    build(ctx);
    ctx.fillStyle = color;
    ctx.fill();
  }
  return { ellipse, stroke, fill };
})();

// Lienzo nuevo (en el navegador).
SC.makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};
