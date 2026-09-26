# Forja de Sprites

Creador modular de personajes y sprites 2D para **novelas visuales** y **juegos**.

Un mismo personaje se puede exportar de dos formas:

- **Novela visual**: ilustración detallada con volumen y sombreado, anatomía completa, 9+ expresiones,
  vistas de frente, 3/4, perfil y espalda, hasta 1800 × 3000 px, cuerpo completo o busto.
- **Retrato pixel art**: bustos de 96×120 a 200×250 para novelas visuales en pixel art, con
  pack de expresiones para Ren'Py.
- **Juego (pixel art)**: sprites de baja resolución (de 32×32 a 96×128) con menos detalle,
  proporciones chibi opcionales, contorno exterior y animaciones en **4 direcciones**
  (abajo, izquierda, derecha, arriba) listas en hojas de sprites.

## Motores de dibujo

| Motor | Para qué | Requisitos |
| --- | --- | --- |
| **Modelo VRM (anime 3D)** | Máxima calidad: anatomía y caras de nivel profesional, pelo con física, expresiones reales. Carga modelos `.vrm` (por ejemplo creados gratis con [VRoid Studio](https://vroid.com/en/studio)) y los pone en pose, gira, cambia de expresión y exporta con las mismas opciones. Incluye un modelo de ejemplo. | WebGL (cualquier gráfica integrada) |
| **Anatómico SDF (nuevo)** | Motor propio según [docs/correccion-visual.md](docs/correccion-visual.md): el mismo esqueleto medido de la base matemática, pero el cuerpo es **una sola superficie** (campo de distancias con unión suave) en lugar de polígonos pegados. Se renderiza un G-buffer (profundidad, normales, parte, material) y de ahí salen las líneas y el sombreado cel; cara anime proyectada sobre la cabeza, pelo por mechones, ropa por capas, falda que reacciona a las piernas, poses clave y pixel art reducido desde el buffer. Es el motor por defecto. | WebGL2 (con respaldo en CPU, más lento) |
| **Anatómico clásico** | El primer motor de [docs/base-matematica.md](docs/base-matematica.md), por volúmenes 2D: se conserva para comparar. | Sólo Canvas 2D |
| **Modular CC0 (piezas combinables)** | Personajes 3D montados con piezas intercambiables (cuerpo femenino o masculino, peinados, barba, torso, brazos, piernas, calzado, capucha y accesorios) y **84 animaciones** (caminar, correr, combos de espada, hechizos, disparar, bailar, sentarse, trabajos de granja…). Todo es **CC0** (dominio público, de [Quaternius](https://quaternius.com)): se puede vender sin dar crédito. | WebGL (cualquier gráfica integrada) |
| **Generado (ligero)** | Personajes 100 % procedurales con ropa y accesorios intercambiables. | Sólo Canvas 2D |
| **Hoja LPC (pixel art)** | Importa hojas del [Universal LPC Spritesheet Character Generator](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator), las reproduce con nuestras animaciones y vistas y las reexporta con créditos. | Sólo Canvas 2D |

El motor VRM usa [three.js](https://github.com/mrdoob/three.js) y
[three-vrm](https://github.com/pixiv/three-vrm) (licencia MIT), empaquetados en
`vendor/vrm-bundle.js` para que todo funcione sin conexión. La app muestra la licencia de cada
modelo al cargarlo y añade un archivo de créditos a las exportaciones.

### Motor anatómico SDF

Implementa [docs/correccion-visual.md](docs/correccion-visual.md) siguiendo su orden de trabajo
(12.3). Reutiliza el esqueleto, el canon y el rig del motor anatómico:

| Capa | Archivo | Secciones |
| --- | --- | --- |
| Primitivas SDF | `js/sdf/core.js` | 2.1–2.3: cono redondeado elíptico, elipsoide, caja, plano; unión/resta/intersección suaves, unión localizada entre partes |
| Cuerpo | `js/sdf/build.js` | 2.4, 4, 6, 7: cráneo, cara, mandíbula, nariz, labios, cuello, torso con caja torácica, pelvis y cintura escapular, brazos y manos con LOD, piernas y pies con volumen |
| G-buffer CPU | `js/sdf/march.js` | 2.5, 9.3: cámara ortográfica, trazado de esferas, oclusión ambiental, sombra suave |
| G-buffer GPU | `js/sdf/gl.js` | 2.5: el mismo campo en un shader WebGL2 (MRT de 3 texturas flotantes) |
| Líneas y sombreado | `js/sdf/compose.js` | 3, 9: líneas de silueta, oclusión, material, mechón y pliegue; luz envolvente, 2 tonos + profundo, limpieza de islas, rampas OKLCH |
| Cara | `js/sdf/face.js` | 4: rasgos anime anclados a la superficie con escorzo; sellos para cabezas pequeñas |
| Pelo | `js/sdf/hair.js` | 5: casco base + mechones con gravedad que chocan con el cuerpo |
| Ropa | `js/sdf/clothes.js` | 8: prendas como capas infladas del cuerpo con planos de corte; falda que se abomba con los muslos |
| Motor | `js/sdf/engine.js` | 6.5, 11: encuadres, vistas, pixel art a 4× con reducción por mayoría y paleta ≤ 24 colores |

El panel «Depuración del G-buffer» muestra normales, partes, materiales o profundidad en lugar
del render final. Las pruebas de aceptación de la sección 12.1 están en `tests/sdf.test.mjs`
(sin costuras en hombros, caderas y cuello; perfil con ≥ 5 inflexiones; cuello ≥ 0.3 H; manos
0.65–0.80 H; pie con volumen; la falda no se atraviesa al andar ni al correr; sin manchas de
sombra; reposo asimétrico; chibi con pierna ≥ 0.4 H y pie ≥ 4 px a 32 px).

Diferencias con el documento: la luz se fija respecto al personaje (no a la cámara) para que
la inclinación del pixel art no la mande detrás de la cabeza; el pelo sólo proyecta sombra a
menos de 0.12 H (la banda bajo el flequillo, no media cara); los umbrales de línea nunca bajan
de lo que sube una superficie inclinada en un píxel, para que los sprites pequeños no salgan
rayados; y los labios en relieve sólo se modelan en el estilo realista (en anime la boca se
dibuja).

### Motor anatómico clásico

Implementa el documento [docs/base-matematica.md](docs/base-matematica.md) por capas, cada una
lee sólo de la anterior:

| Capa | Archivo | Secciones |
| --- | --- | --- |
| Tablas del canon | `js/anat/canon.js` | 3–8, 10, 11 (todas las constantes; se ajustan sin tocar código) |
| Matemática | `js/anat/math.js` | Catmull-Rom centrípeta, Hermite monótono, rotaciones Y→X→Z, OKLCH |
| Esqueleto | `js/anat/body.js` | 3–4: parámetros → landmarks → articulaciones, SHR y WHR |
| Rig | `js/anat/rig.js` | 4.4 límites, 8.4 centro de masas y contrapposto, 10 FK, IK, ciclo de andar |
| Formas | `js/anat/shapes.js` | 6 torso y busto, 7 brazos y manos (15 articulaciones), 8 piernas y pies |
| Cabeza | `js/anat/head.js` | 5: contorno, perfil, rasgos, expresiones y pelo paramétrico |
| Render | `js/anat/render.js` | 6.5 encuadres, 9.6 orden de dibujo, 11 proyección y rampas |
| Piezas | `js/anat/parts.js` | 9: colocación con 2 anclajes, Procrustes, lectura por momentos |
| Validador | `js/anat/validate.js` | 12.6 (se muestra en el panel «Validación anatómica») |

Diferencias con el documento: el núcleo está en JavaScript (no TypeScript) y el canon en
`canon.js` (no `canon.json`) para que la app siga funcionando con doble clic sin compilar. Se
añadió una escala de anchos por estilo (`widthScale`) porque los anchos de 3.3 están medidos en
el canon adulto y un chibi necesita un cuerpo más estrecho respecto a la cabeza.

Tests (13.2), con Node 18 o superior:

```bash
node --test
```

Comprueban, entre otros: Catmull-Rom pasa por sus puntos, Hermite no se sale de los valores,
SHR 1.40 (hombre) y 0.97 (mujer), huesos del canon de 8 cabezas, codo a la altura de la
cintura, simetría exacta, IK con error < 1e-4, longitud de los huesos constante en todas las
animaciones, contrapposto en equilibrio, rampas OKLCH legibles y Procrustes con ε ≈ 0.

### Motor modular CC0

Las piezas comparten el mismo esqueleto, así que se "cosen" al cuerpo por nombre de hueso y se
animan juntas. La piel que queda bajo la ropa se oculta por zonas (torso, brazos, piernas, pies)
para que no la atraviese. Cada pieza se puede recolorear conservando su textura pintada.

Los paquetes de `assets/mod/` se generan a partir de los packs originales de `assets/cc0/`:

```bash
cd tools
npm install
npm run build-cc0
```

El script une las piezas, quita los mapas que el render toon no usa, reduce las texturas y
comprime las animaciones (de ~570 MB de origen a ~11 MB). Para añadir más packs de Quaternius
(u otros CC0 con el mismo esqueleto), cópialos en `assets/cc0/` y añádelos a `tools/build-cc0.mjs`.

### Personalizar un modelo VRM

En el panel **Personalizar** se cambia el color del pelo, los ojos, las cejas y pestañas, la
piel y cada prenda, y se puede ocultar cada prenda. El color se aplica sobre las texturas
originales del modelo: el color principal pasa a ser el elegido y el resto de tonos se reparten
a su alrededor, así se conservan los mechones, brillos, pliegues, sombras y líneas pintados, y
los detalles de otro color (lazos, botones) no cambian. ↺ devuelve el color original. Si la
licencia del modelo no permite modificarlo, el panel no deja recolorear.

### Rendimiento

La vista previa se dibuja a un máximo de 900 px de alto y sólo se calcula el fotograma que se
ve; los demás se preparan en segundo plano. Las exportaciones siempre usan la resolución
completa.

> Las condiciones de VRoid Studio permiten usar los modelos que exportes (también
> comercialmente), pero no crear aplicaciones que generen modelos combinando piezas hechas con
> VRoid. Por eso la app no mezcla piezas: renderiza el modelo que tú cargas.

## Requisitos

Ninguno que instalar. Es HTML + JavaScript: se abre con doble clic y funciona sin conexión. El
motor generado y el de LPC sólo usan Canvas 2D; el motor VRM necesita WebGL, disponible en
cualquier gráfica integrada. Funciona en cualquier PC con un navegador moderno (Chrome, Edge, Firefox) y no
necesita tarjeta gráfica dedicada (≈20 ms por fotograma en CPU).

## Cómo usarlo

1. Abre `index.html` con doble clic (o sírvelo con cualquier servidor estático).
2. Elige el modo arriba: **Novela visual** o **Juego · pixel art**.
3. Personaliza el cuerpo, la cara, el pelo, la ropa y los accesorios en el panel izquierdo.
4. Cambia la **vista** (frente, 3/4, perfil, espalda...) y previsualiza las animaciones
   (espacio = pausa).
5. Exporta desde el panel derecho.

El personaje se guarda automáticamente en el navegador. Con **Guardar** / **Cargar** puedes
llevarte el archivo `.json` a otro equipo.

## Qué incluye

| Apartado | Opciones |
| --- | --- |
| Anatomía | Femenina / masculina (hombros, caja torácica, busto o pectorales, cintura, pelvis, glúteos, cuello, mandíbula y cejas distintos) |
| Proporciones | Cabezas de altura (2,5 chibi – 8 realista), altura, complexión, musculatura, busto, hombros, cintura, caderas |
| Cuerpo | Humano, Elfo · tono de piel |
| Ojos | Shōjo, Shōnen, Tsurime (rasgados), Tareme (caídos), Jitome (entornados), Sanpaku, Seinen (realista), Kawaii (grandes), Felino (pupila rasgada), Kitsune (afilados), Puntos |
| Expresiones | Neutral, Feliz, Muy feliz, Triste, Enfadado, Sorprendido, Avergonzado, Pensativo, Guiño, Serio, Presumido |
| Peinado | Corto, Largo, Media melena, Coletas, Coleta, De punta, Moño, Rizado, Trenza lateral, Hacia atrás, Rapado |
| Parte superior | Camiseta, Camisa, Sudadera, Uniforme marinero, Vestido, Kimono, Túnica, Armadura |
| Abrigo | Chaqueta, Chaleco, Abrigo largo (se abren por delante y dejan ver la ropa de debajo) |
| Parte inferior | Pantalón, Pantalón corto, Falda, Falda larga |
| Calzado | Zapatillas, Botas, Zapatos |
| Accesorios | Gorra, Sombrero de mago, Lazo, Orejas de gato, Corona, Diadema, Gafas, Gafas de sol, Parche, Bufanda, Corbata, Colgante, Capa, Alas, Mochila, Espada |

Cada pieza tiene sus propios colores editables.

**Detalle anatómico:** clavículas, esternón, pectorales o curva del busto, abdominales según
musculatura, ombligo, oblicuos, columna y omóplatos, rodillas, codos, manos con pulgar y
dedos, pies con dedos, orejas, nariz con volumen en perfil y pómulos.

**Animaciones:** reposo, caminar y correr (ciclo real de cadera y rodilla, braceo opuesto y
torsión del torso), saltar, saludar, atacar, hablar y parpadear.

## Exportación

| Botón | Resultado |
| --- | --- |
| PNG de la pose actual | Imagen de novela visual a la resolución y vista elegidas |
| Pack de expresiones | ZIP con un PNG por expresión y un `.rpy` con las definiciones `image` para **Ren'Py** |
| Hoja de animación | ZIP con hoja de sprites (300×500 por fotograma) + JSON |
| PNG del fotograma | Sprite de pixel art (×1, ×2 o ×4) |
| Hoja de sprites + JSON | ZIP con hoja (una fila por animación y dirección) + JSON con tamaño de fotograma, fila, número de fotogramas, fps y si se repite |

Ejemplo del JSON de la hoja de sprites:

```json
{
  "image": "personaje_sprites.png",
  "frameWidth": 48,
  "frameHeight": 64,
  "animations": {
    "walk_abajo": { "row": 4, "frames": 8, "fps": 10, "loop": true },
    "walk_izquierda": { "row": 5, "frames": 8, "fps": 10, "loop": true }
  }
}
```

Se puede importar en Godot (`SpriteFrames` / `AnimatedSprite2D`), Unity (Sprite Editor →
Grid by Cell Size), GameMaker, RPG Maker, Phaser, etc.

## Cómo funciona

```
js/
  vrm/engine.js    motor VRM (three-vrm): carga, poses, expresiones, vistas y encuadres
  vrm/recolor.js   recoloreado de texturas conservando el dibujo (VRM y modular)
  mod/engine.js    motor modular CC0: montaje de piezas, zonas de piel, animaciones
  anat/            esqueleto, canon y rig; motor anatómico clásico
  sdf/             motor anatómico SDF (ver «Motor anatómico SDF»)
docs/
  base-matematica.md   especificación del sistema anatómico
  correccion-visual.md corrección visual: cuerpo SDF, G-buffer, líneas, cara, pelo y ropa
tests/
  anat.test.mjs    tests del núcleo anatómico (node --test)
  sdf.test.mjs     pruebas de aceptación del motor SDF (sección 12.1)
assets/
  cc0/             packs originales de Quaternius (CC0)
  mod/             paquetes optimizados que carga la app (generados con tools/build-cc0.mjs)
tools/
  build-cc0.mjs    convierte los packs CC0 en paquetes ligeros
  lpc/lpc.js       importador de hojas LPC
  core/
    util.js        colores, vectores 3D, matrices de rotación y primitivas 2D
    volume.js      motor 2.5D: secciones, proyección, siluetas, sombreado y calcos de superficie
    skeleton.js    esqueleto 3D y proporciones anatómicas (femeninas / masculinas / chibi)
    registry.js    ranuras, registro de piezas y expresiones
    animations.js  poses 3D por fotograma
    renderer.js    orden por profundidad, modo vectorial y conversión a pixel art
    exporter.js    PNG, hojas de sprites, ZIP (sin dependencias) y script de Ren'Py
  parts/
    body.js        torso, extremidades con perfiles musculares, manos, pies, cabeza y orejas
    face.js        estilos de ojos, cejas, nariz, boca y rubor
    hair.js        peinados (casco, flequillo, melena, coletas, trenza, moño...)
    clothes.js     ropa y calzado
    accessories.js accesorios
  app.js           interfaz
```

- **Volúmenes por secciones.** Cada parte del cuerpo se describe con secciones transversales
  (anchura, frente y espalda) colocadas sobre un esqueleto 3D. Al proyectarlas desde cualquier
  ángulo la silueta sale sola: el busto o el pecho, los glúteos, los gemelos, los deltoides...
  Por eso hay vistas de frente, 3/4, perfil y espalda sin dibujar nada a mano.
- **Ropa como capas.** Las prendas son superficies desplazadas un grosor sobre el cuerpo, así que
  siguen la anatomía, cualquier proporción y cualquier animación.
- **Calcos de superficie.** Los detalles (clavículas, cuellos, botones, estampados, pliegues) se
  definen sobre la superficie 3D y se ocultan solos cuando quedan detrás.
- **Orden por profundidad.** Brazos, piernas, pelo, capas o alas se ordenan según su profundidad
  real tras girar, así que de espaldas la melena y la capa quedan delante del cuerpo.
- **Iluminación.** La luz se calcula con las normales reales de la superficie: sombra con
  terminador limpio, sombra profunda, brillo según el material (piel, tela, pelo, metal, cuero),
  degradado suave y sombras proyectadas de unas piezas sobre otras (flequillo sobre la frente,
  cabeza sobre el cuello, mangas sobre los brazos, falda sobre las piernas). La piel lleva rubor
  cálido en mejillas, rodillas y codos, y el contorno exterior es más grueso que las líneas
  interiores, como en una ilustración.
- **Pelo por mechones.** Cada peinado se construye con decenas de mechones (flequillo,
  coronilla, laterales y nuca) que nacen en el cuero cabelludo, siguen la cabeza, caen por
  gravedad sin atravesar el cuerpo y acaban en punta. Se dibujan como una sola masa, al estilo
  anime: contorno sólo por fuera, líneas de separación sólo hacia las puntas, sombras en cuña,
  un degradado general de volumen y una banda de brillo común ("anillo de ángel"). El
  flequillo se detiene a la altura de las cejas para no tapar los ojos.
- **Pose natural.** Por defecto el personaje está en contrapposto (peso en una pierna, hombros
  compensados, cabeza ladeada) en lugar de rígido.
- **Pixel art.** Se hace un pase de identificadores (cada pieza con un color único) y un pase de
  color con sombreado en 3 tonos a 4×; al reducir se elige la pieza dominante de cada bloque.
  Después se eliminan píxeles sueltos, se colocan ojos y boca píxel a píxel y se trazan contornos
  selectivos: por fuera y sólo entre piezas distintas (la línea va en la pieza que queda detrás),
  así las partes del mismo material se unen sin cortes.

## Añadir una pieza nueva

Crea (o edita) un archivo en `js/parts/` y regístrala. Por ejemplo, un cinturón:

```js
SC.registerPart({
  slot: 'neckAcc',            // body, eyes, hair, top, outer, bottom, shoes, headAcc, faceAcc, neckAcc, backAcc
  id: 'cinturon',
  name: 'Cinturón',
  colors: { main: { label: 'Cuero', value: '#5a3d2b' } },
  // Se dibuja sobre el torso: T.shell(grosor, nivelDesde, nivelHasta) crea una capa 3D.
  torso(ctx, rig, c, T) {
    const band = T.shell(rig.B * 0.02, T.L.waist - 0.02, T.L.waist + 0.02);
    SC.V.fill(ctx, rig, band, c.main);
  },
});
```

Otras funciones disponibles: `arm(ctx, rig, c, A)` y `leg(ctx, rig, c, L)` para cada
extremidad, `hat` y `glasses` para la cabeza, e `items(rig, c, body)` para elementos sueltos
ordenados por profundidad (capas, alas...). Si es un archivo nuevo, añádelo con un `<script>`
en `index.html` después de los demás archivos de `js/parts/`. La pieza aparecerá sola en el
editor, en el aleatorio y en todas las exportaciones.
