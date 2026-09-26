// Interfaz de la aplicación: editor de piezas, vista previa animada y exportación.
(() => {
  const U = SC.util, X = SC.exporter;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'forja-sprites:personaje:v2';

  const PALETTES = {
    skin: ['#fde6d4', '#f3cdb0', '#e8b48f', '#c98d64', '#a26a45', '#7a4a2e', '#553223', '#a9c8e8', '#a8cf93'],
    hair: ['#1f1a24', '#4a3226', '#6b3f2a', '#a0522d', '#d9a441', '#f0dc9a', '#e8e4df', '#c23b3b', '#e57fb0', '#4f7fd6', '#5aa36b', '#8e5bc8'],
    eyes: ['#3f7fd6', '#4c9a5a', '#8a5a2b', '#b03a48', '#7b4fc9', '#2aa7a0', '#d69a2a', '#555566'],
    cloth: ['#4f86d9', '#e04848', '#f2f2f5', '#2b2233', '#34405e', '#5f8f4e', '#e8b93a', '#8e5bc8', '#e87a9b', '#9b7a52', '#3c4c63', '#39b3a8', '#d8513f', '#27386f', '#f4e1c1'],
  };

  const pct = (v) => Math.round(v * 100) + '%';
  const BODY_SLIDERS = [
    { key: 'heads', label: 'Proporción', min: 2.5, max: 8, step: 0.1, fmt: (v) => v.toFixed(1) + ' cab.' },
    { key: 'height', label: 'Altura', min: 0.75, max: 1, step: 0.01, fmt: pct },
    { key: 'build', label: 'Complexión', min: 0.75, max: 1.4, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'muscle', label: 'Musculatura', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'bust', label: 'Busto', min: 0, max: 1, step: 0.01, fmt: pct, only: 'f' },
    { key: 'shoulders', label: 'Hombros', min: 0.8, max: 1.35, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'waist', label: 'Cintura', min: 0.8, max: 1.35, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'hips', label: 'Caderas', min: 0.8, max: 1.35, step: 0.01, fmt: (v) => v.toFixed(2) },
  ];
  const SEXES = { f: 'Femenino', m: 'Masculino' };

  const defaultCharacter = () => ({
    name: 'Personaje',
    body: Object.assign({}, SC.BODY_DEFAULTS),
    expression: 'feliz',
    style: { lineMode: 'colored', lineWidth: 1 },
    slots: {
      body: { part: 'humano', colors: {} },
      eyes: { part: 'shoujo', colors: {} },
      hair: { part: 'largo', colors: {} },
      top: { part: 'marinero', colors: {} },
      bottom: { part: 'falda', colors: {} },
      shoes: { part: 'zapatos', colors: {} },
      headAcc: { part: 'lazo', colors: {} },
    },
  });

  const state = {
    ch: loadStored() || defaultCharacter(),
    mode: 'vn',
    anim: 'idle',
    view: 'front',
    dirs: true,
    playing: true,
    frame: 0,
    exportAnims: new Set(['idle', 'walk', 'run', 'jump', 'wave', 'attack']),
    pxCache: { key: '', frames: [] },
  };

  // ---------- Persistencia ----------
  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  function store() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ch)); } catch { /* almacenamiento no disponible */ }
  }

  // Asegura que un personaje cargado tenga una estructura válida.
  function sanitize(obj) {
    const ch = obj && obj.character ? obj.character : obj;
    if (!ch || typeof ch !== 'object' || !ch.slots) return null;
    const def = defaultCharacter();
    const out = {
      name: typeof ch.name === 'string' ? ch.name.slice(0, 40) : def.name,
      body: Object.assign({}, def.body),
      expression: SC.EXPRESSIONS[ch.expression] ? ch.expression : 'neutral',
      style: Object.assign({}, def.style, ch.style || {}),
      slots: {},
    };
    for (const s of BODY_SLIDERS) {
      const v = Number(ch.body && ch.body[s.key]);
      if (Number.isFinite(v)) out.body[s.key] = U.clamp(v, s.min, s.max);
    }
    if (ch.body && SEXES[ch.body.sex]) out.body.sex = ch.body.sex;
    for (const slot of SC.SLOTS) {
      const sel = ch.slots[slot.id];
      if (sel && SC.getPart(slot.id, sel.part)) {
        const colors = {};
        for (const [k, v] of Object.entries(sel.colors || {})) if (/^#[0-9a-f]{6}$/i.test(v)) colors[k] = v;
        out.slots[slot.id] = { part: sel.part, colors };
      } else if (slot.required) {
        out.slots[slot.id] = def.slots[slot.id];
      }
    }
    return out;
  }

  // ---------- Editor ----------
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) e.append(c);
    return e;
  }

  function colorInputs(slotId, def) {
    const sel = state.ch.slots[slotId];
    const resolved = SC.resolveColors(def, sel);
    const wrap = el('div', { class: 'colors' });
    for (const [key, info] of Object.entries(def.colors || {})) {
      const input = el('input', { type: 'color', value: resolved[key], 'aria-label': info.label });
      input.addEventListener('input', () => {
        sel.colors[key] = input.value;
        changed();
      });
      wrap.append(el('label', { class: 'color' }, [input, info.label]));
      const pal = key === 'skin' ? PALETTES.skin : slotId === 'hair' && key === 'main' ? PALETTES.hair : key === 'iris' ? PALETTES.eyes : null;
      if (pal) {
        const sw = el('div', { class: 'swatches' });
        for (const col of pal) {
          sw.append(el('button', {
            class: 'swatch', style: `background:${col}`, title: col, 'aria-label': `${info.label} ${col}`,
            onclick: () => { sel.colors[key] = col; input.value = col; changed(); },
          }));
        }
        wrap.append(sw);
      }
    }
    return wrap;
  }

  function slotBlock(slot) {
    const sel = state.ch.slots[slot.id];
    const block = el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: slot.name })]);
    const chips = el('div', { class: 'chips' });
    if (!slot.required) {
      chips.append(el('button', {
        class: 'chip' + (!sel ? ' active' : ''), text: 'Ninguno',
        onclick: () => { delete state.ch.slots[slot.id]; changed(true); },
      }));
    }
    for (const def of SC.partList(slot.id)) {
      chips.append(el('button', {
        class: 'chip' + (sel && sel.part === def.id ? ' active' : ''), text: def.name,
        onclick: () => {
          const prev = state.ch.slots[slot.id];
          state.ch.slots[slot.id] = { part: def.id, colors: prev ? prev.colors : {} };
          changed(true);
        },
      }));
    }
    block.append(chips);
    if (sel) block.append(colorInputs(slot.id, SC.getPart(slot.id, sel.part)));
    return block;
  }

  function buildEditor() {
    const root = $('editor');
    const open = new Set([...root.querySelectorAll('details[open]')].map((d) => d.dataset.group));
    const first = !root.children.length;
    root.innerHTML = '';
    const groups = {};
    const group = (name) => {
      if (!groups[name]) {
        groups[name] = el('details', { class: 'group', 'data-group': name }, [el('summary', { text: name })]);
        if (first || open.has(name)) groups[name].open = true;
        root.append(groups[name]);
      }
      return groups[name];
    };

    // Cuerpo: sexo, proporciones y colores.
    const g = group('Cuerpo');
    const sexChips = el('div', { class: 'chips' });
    for (const [id, name] of Object.entries(SEXES)) {
      sexChips.append(el('button', {
        class: 'chip' + (state.ch.body.sex === id ? ' active' : ''), text: name,
        onclick: () => { state.ch.body.sex = id; changed(true); },
      }));
    }
    g.append(el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: 'Anatomía' }), sexChips]));
    for (const s of BODY_SLIDERS) {
      if (s.only && s.only !== state.ch.body.sex) continue;
      const out = el('output', { text: s.fmt(state.ch.body[s.key]) });
      const input = el('input', { type: 'range', min: s.min, max: s.max, step: s.step, value: state.ch.body[s.key], 'aria-label': s.label });
      input.addEventListener('input', () => {
        state.ch.body[s.key] = Number(input.value);
        out.textContent = s.fmt(state.ch.body[s.key]);
        changed();
      });
      g.append(el('label', { class: 'slider' }, [s.label, input, out]));
    }
    for (const slot of SC.SLOTS) {
      group(slot.group).append(slotBlock(slot));
      if (slot.id === 'eyes') {
        const chips = el('div', { class: 'chips' });
        for (const [id, e] of Object.entries(SC.EXPRESSIONS)) {
          chips.append(el('button', {
            class: 'chip' + (state.ch.expression === id ? ' active' : ''), text: e.name,
            onclick: () => { state.ch.expression = id; changed(true); },
          }));
        }
        group('Cara').append(el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: 'Expresión' }), chips]));
      }
    }
  }

  function buildViewUI() {
    const chips = $('viewChips');
    chips.innerHTML = '';
    for (const [id, v] of Object.entries(SC.VIEWS)) {
      chips.append(el('button', {
        class: 'chip' + (state.view === id ? ' active' : ''), text: v.name,
        onclick: () => { state.view = id; buildViewUI(); draw(); },
      }));
    }
  }

  function buildAnimUI() {
    const chips = $('animChips');
    chips.innerHTML = '';
    for (const a of Object.values(SC.ANIMS)) {
      chips.append(el('button', {
        class: 'chip' + (state.anim === a.id ? ' active' : ''), text: a.name,
        onclick: () => { state.anim = a.id; state.frame = 0; state.playing = true; buildAnimUI(); },
      }));
    }
    $('btnPlay').textContent = state.playing ? '❚❚' : '▶';
    const checks = $('animChecks');
    if (!checks.children.length) {
      for (const a of Object.values(SC.ANIMS)) {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = state.exportAnims.has(a.id);
        cb.addEventListener('change', () => { if (cb.checked) state.exportAnims.add(a.id); else state.exportAnims.delete(a.id); });
        checks.append(el('label', { class: 'check' }, [cb, a.name]));
      }
    }
  }

  // ---------- Vista previa ----------
  const view = $('view');
  const vctx = view.getContext('2d');

  function resize() {
    const r = $('stage').getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = Math.max(1, Math.round(r.width * dpr));
    view.height = Math.max(1, Math.round(r.height * dpr));
    draw();
  }

  function pxOptions() {
    const [w, h] = $('pxSize').value.split('x').map(Number);
    return {
      w, h,
      chibi: $('pxChibi').checked,
      outline: $('pxOutline').checked,
      innerLines: $('pxInner').checked,
      lineMode: state.ch.style.lineMode,
      view: state.view,
    };
  }

  function vnOptions() {
    return { frame: $('vnFrame').value, scale: Number($('vnScale').value), view: state.view };
  }

  // Direcciones típicas de un juego 2D (vista cenital o lateral).
  const DIRS = [{ view: 'front', dir: 'abajo' }, { view: 'left', dir: 'izquierda' }, { view: 'side', dir: 'derecha' }, { view: 'back', dir: 'arriba' }];

  function pixelFrames() {
    const o = pxOptions();
    const key = JSON.stringify([state.ch, o, state.anim, state.view]);
    if (state.pxCache.key !== key) {
      state.pxCache = { key, frames: SC.render.renderAnimation(state.ch, state.anim, 'pixel', o) };
    }
    return state.pxCache.frames;
  }

  function currentPose() {
    const a = SC.ANIMS[state.anim];
    return a.pose(state.frame % a.frames, a.frames);
  }

  function draw() {
    const W = view.width, H = view.height;
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.clearRect(0, 0, W, H);
    const anim = SC.ANIMS[state.anim];
    if (state.mode === 'vn') {
      const box = $('vnFrame').value === 'bust' ? SC.render.bustBox(state.ch) : { x: 0, y: 0, w: SC.CANVAS_W, h: SC.CANVAS_H };
      const k = Math.min(W / box.w, H / box.h) * 0.94;
      vctx.setTransform(k, 0, 0, k, (W - box.w * k) / 2 - box.x * k, (H - box.h * k) / 2 - box.y * k);
      SC.render.drawCharacter(vctx, state.ch, currentPose(), SC.render.vnDrawOpts(state.ch, { view: state.view }));
    } else {
      const frames = pixelFrames();
      const f = frames[state.frame % frames.length];
      const zoom = Math.max(1, Math.floor(Math.min(W / f.width, H / f.height) * 0.85));
      vctx.imageSmoothingEnabled = false;
      vctx.drawImage(f, Math.round((W - f.width * zoom) / 2), Math.round((H - f.height * zoom) / 2), f.width * zoom, f.height * zoom);
    }
    $('frameInfo').textContent = `${(state.frame % anim.frames) + 1}/${anim.frames}`;
  }

  let last = 0;
  function tick(t) {
    const anim = SC.ANIMS[state.anim];
    if (state.playing && t - last >= 1000 / anim.fps) {
      last = t;
      state.frame = (state.frame + 1) % anim.frames;
      draw();
    }
    requestAnimationFrame(tick);
  }

  let storeTimer = 0;
  function changed(rebuild = false) {
    if (rebuild) buildEditor();
    draw();
    clearTimeout(storeTimer);
    storeTimer = setTimeout(store, 300);
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('vnOptions').hidden = mode !== 'vn';
    $('pxOptions').hidden = mode !== 'pixel';
    draw();
  }

  // ---------- Aleatorio ----------
  function randomCharacter() {
    const r = U.rng((Math.random() * 2 ** 32) >>> 0);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const ch = defaultCharacter();
    ch.name = state.ch.name;
    ch.style = state.ch.style;
    ch.expression = pick(Object.keys(SC.EXPRESSIONS));
    const sex = r() < 0.5 ? 'f' : 'm';
    ch.body = {
      sex,
      heads: +(3 + r() * 4.5).toFixed(1),
      height: +(0.85 + r() * 0.15).toFixed(2),
      build: +(0.85 + r() * 0.35).toFixed(2),
      muscle: +(r() * 0.8).toFixed(2),
      bust: +(r()).toFixed(2),
      shoulders: +(0.9 + r() * 0.25).toFixed(2),
      waist: +(0.9 + r() * 0.25).toFixed(2),
      hips: +(0.9 + r() * 0.25).toFixed(2),
    };
    const chance = { hair: 0.95, top: 1, outer: 0.3, bottom: 1, shoes: 1, headAcc: 0.35, faceAcc: 0.2, neckAcc: 0.3, backAcc: 0.25 };
    ch.slots = {};
    for (const slot of SC.SLOTS) {
      if (!slot.required && r() > chance[slot.id]) continue;
      const def = pick(SC.partList(slot.id));
      const colors = {};
      for (const key of Object.keys(def.colors || {})) {
        if (key === 'skin') colors[key] = pick(PALETTES.skin.slice(0, 7));
        else if (key === 'iris') colors[key] = pick(PALETTES.eyes);
        else if (slot.id === 'hair' && key === 'main') colors[key] = pick(PALETTES.hair);
        else if (key !== 'under') colors[key] = pick(PALETTES.cloth);
      }
      ch.slots[slot.id] = { part: def.id, colors };
    }
    const top = ch.slots.top && ch.slots.top.part;
    if (['vestido', 'tunica', 'kimono'].includes(top) && r() < 0.7) delete ch.slots.bottom;
    return ch;
  }

  // ---------- Exportación ----------
  function status(msg) { $('status').textContent = msg; }

  async function doExport(kind) {
    const ch = state.ch;
    const name = X.slug(ch.name);
    const anims = [...state.exportAnims].filter((id) => SC.ANIMS[id]);
    try {
      status('Generando…');
      await new Promise((res) => setTimeout(res, 20));
      if (kind === 'vn-png') {
        const cv = SC.render.renderVN(ch, currentPose(), vnOptions());
        X.download(await X.canvasBlob(cv), `${name}_${ch.expression}.png`);
      } else if (kind === 'vn-expr') {
        const files = [], list = [];
        for (const id of Object.keys(SC.EXPRESSIONS)) {
          const cv = SC.render.renderVN(ch, null, Object.assign(vnOptions(), { expression: id }));
          const file = `${name}_${id}.png`;
          files.push({ name: `${name}/${file}`, data: await X.canvasBytes(cv) });
          list.push({ expr: id, file });
        }
        files.push({ name: `${name}.rpy`, data: X.renpyScript(name, list) });
        X.download(X.zip(files), `${name}_expresiones.zip`);
      } else if (kind === 'vn-sheet') {
        if (!anims.length) return status('Selecciona al menos una animación.');
        const { canvas, meta } = X.spritesheet(ch, anims, 'vn', { frame: $('vnFrame').value, height: 500, view: state.view }, `${name}_hoja`);
        X.download(X.zip([
          { name: `${name}_hoja.png`, data: await X.canvasBytes(canvas) },
          { name: `${name}_hoja.json`, data: JSON.stringify(meta, null, 2) },
        ]), `${name}_animaciones_vn.zip`);
      } else if (kind === 'px-png') {
        const k = Number($('pxExportScale').value);
        const f = SC.render.renderPixel(ch, currentPose(), pxOptions());
        X.download(await X.canvasBlob(X.upscale(f, k)), `${name}_${state.anim}_${state.frame + 1}.png`);
      } else if (kind === 'px-sheet') {
        if (!anims.length) return status('Selecciona al menos una animación.');
        const k = Number($('pxExportScale').value);
        const { canvas, meta } = X.spritesheet(ch, anims, 'pixel', pxOptions(), `${name}_sprites`, $('pxDirs').checked ? DIRS : null);
        meta.frameWidth *= k;
        meta.frameHeight *= k;
        X.download(X.zip([
          { name: `${name}_sprites.png`, data: await X.canvasBytes(X.upscale(canvas, k)) },
          { name: `${name}_sprites.json`, data: JSON.stringify(meta, null, 2) },
        ]), `${name}_sprites.zip`);
      }
      status('¡Exportado!');
    } catch (err) {
      console.error(err);
      status('Error al exportar: ' + err.message);
    }
  }

  // ---------- Eventos ----------
  document.querySelectorAll('.mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => doExport(b.dataset.export)));
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; buildAnimUI(); });
  $('btnRandom').addEventListener('click', () => { state.ch = randomCharacter(); $('charName').value = state.ch.name; changed(true); });
  $('btnSave').addEventListener('click', () => {
    const data = JSON.stringify({ format: 'forja-sprites', version: 1, character: state.ch }, null, 2);
    X.download(new Blob([data], { type: 'application/json' }), `${X.slug(state.ch.name)}.json`);
  });
  $('fileLoad').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const ch = sanitize(JSON.parse(await file.text()));
      if (!ch) throw new Error('formato no reconocido');
      state.ch = ch;
      $('charName').value = ch.name;
      syncStyleInputs();
      changed(true);
      status('Personaje cargado.');
    } catch (err) {
      status('No se pudo cargar: ' + err.message);
    }
  });
  $('charName').addEventListener('input', (e) => { state.ch.name = e.target.value; changed(); });
  $('lineMode').addEventListener('change', (e) => { state.ch.style.lineMode = e.target.value; changed(); });
  $('lineWidth').addEventListener('input', (e) => { state.ch.style.lineWidth = Number(e.target.value); changed(); });
  for (const id of ['vnFrame', 'pxSize', 'pxChibi', 'pxOutline', 'pxInner']) $(id).addEventListener('change', draw);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault();
      state.playing = !state.playing;
      buildAnimUI();
    }
  });

  function syncStyleInputs() {
    $('lineMode').value = state.ch.style.lineMode;
    $('lineWidth').value = state.ch.style.lineWidth;
  }

  // ---------- Inicio ----------
  $('charName').value = state.ch.name;
  syncStyleInputs();
  buildEditor();
  buildViewUI();
  buildAnimUI();
  new ResizeObserver(resize).observe($('stage'));
  resize();
  requestAnimationFrame(tick);

  // Acceso desde la consola para depurar o automatizar.
  window.forja = { state, draw, randomCharacter, doExport, setMode, buildEditor, buildViewUI };
})();
