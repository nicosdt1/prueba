# Forja de Sprites

Creador de personajes y sprites 2D para **novelas visuales** y **juegos**, con un solo motor
anatómico: la forma del cuerpo sale de la malla base de **MakeHuman** (CC0) deformada por sus
morphs, se ajusta al canon propio de proporciones, se posa con el rig anatómico y se dibuja con
sombreado cel, líneas y cara anime.

Un mismo personaje se exporta de tres formas:

- **Novela visual**: ilustración con sombreado cel y líneas, 11 expresiones, vistas de frente,
  3/4, perfil y espalda, hasta 1800 × 3000 px, cuerpo completo o busto.
- **Retrato pixel art**: bustos de 96×120 a 200×250, con pack de expresiones para Ren'Py.
- **Juego (pixel art)**: sprites de 32×32 a 96×128, proporciones chibi opcionales, contorno
  exterior y animaciones en **4 direcciones** listas en hojas de sprites.

## Cómo se construye un personaje

```
parámetros (estilo, sexo, complexión, musculatura, busto)
  → morphs de MakeHuman (sexo, músculo, peso, proporciones ideales, busto, definición de brazos y piernas)
  → proporciones del estilo: cabezas de alto N y fracción de pierna λ del canon; anchos de
    hombros, pecho, cintura y cadera ajustados a la tabla 3.3 (± 8 %)
  → pose del rig anatómico (reposo en contrapposto, andar, correr, saltar, saludar, atacar...)
  → skinning con los pesos de MakeHuman
  → ropa y pelo como capas sobre la malla posada
  → G-buffer (profundidad, normal, parte, material) rasterizado en CPU, con mapa de sombras
  → sombreado cel, líneas desde el buffer y rasgos anime proyectados sobre la cabeza
  → pixel art: G-buffer a 4×, reducción por mayoría, 3 tonos, línea de 1 px, ≤ 24 colores
```

Es el **camino B** de la auditoría ([docs/auditoria.md](docs/auditoria.md)): la forma la da
una malla diseñada por un artista y el código sólo decide proporciones, pose y estilo de
dibujo. La base matemática ([docs/base-matematica.md](docs/base-matematica.md)) sigue siendo
la fuente de las proporciones, con las correcciones de la auditoría (anchos escalados al largo
del tronco y de la pierna, λ del anime 0.50 y del shōjo 0.52, brazo = 0.49 · L_torso y
antebrazo = 0.40 · L_torso en los dos sexos).

| Capa | Archivo | Qué hace |
| --- | --- | --- |
| Datos | `assets/mh/mh-data.js` | Malla base, morphs, esqueleto y pesos de MakeHuman (generado, 4.3 MB) |
| Canon | `js/anat/canon.js` | Tablas de proporciones, anchos, expresiones, luz y color |
| Esqueleto | `js/anat/body.js` | Parámetros → landmarks → articulaciones |
| Rig | `js/anat/rig.js` | FK, IK, límites, equilibrio y animaciones por poses clave |
| Validador | `js/anat/validate.js` | Comprobaciones del panel «Validación anatómica» |
| Modelo | `js/mh/model.js` | Morphs, proporciones del estilo, ajuste al canon, retarget de la pose y skinning |
| Ropa y pelo | `js/mh/dress.js` | Prendas recortadas de las mallas auxiliares de MakeHuman; casco y mechones de pelo |
| G-buffer | `js/mh/raster.js` | Rasterizado en CPU, normales de la cara estilizada y mapa de sombras |
| Motor | `js/mh/engine.js` | Encuadres, vistas, novela visual, pixel art, animaciones y vista de depuración |
| Composición | `js/render/compose.js` | Luz cel, limpieza de manchas, rampas OKLCH y líneas |
| Cara | `js/render/face.js` | Ojos, cejas, boca, nariz y rubor anime anclados a la superficie |
| Pixel art | `js/render/pixel.js` | Reducción por mayoría y paleta máxima |

Detalles:

- **Proporciones del estilo.** Se conserva el tronco de la malla y se escalan cabeza, piernas,
  brazos, manos y pies para llegar a N y λ. En chibi además se acorta el cuello y se engrosan
  tronco y extremidades.
- **Retarget.** Cada hueso de MakeHuman sigue a una articulación del rig; los brazos se alinean
  antes con el A-pose del rig (MakeHuman los abre unos 40°, el rig 20°). El apoyo en el suelo se
  calcula con los pies de la malla.
- **Cara estilizada.** En la zona de la cara el sombreado usa la normal de un óvalo liso y no
  se dibujan líneas interiores: ojos, cejas, nariz y boca los pinta la capa de rasgos anime.
  El perfil conserva la nariz, los labios y la barbilla de la malla.
- **Ropa.** Camiseta, pantalón y calzado salen del traje ceñido de MakeHuman; cada vértice
  lleva coordenadas anatómicas (τ del tronco, fracción del brazo y de la pierna) y la prenda es
  la parte donde un campo es ≤ 0, con cortes rectos y separada del cuerpo. La falda sale de la
  falda auxiliar de MakeHuman, se abre según el vuelo y se empuja fuera de cápsulas alrededor de
  muslos y piernas: se abomba donde empuja la pierna.
- **Pelo.** El casco es el cuero cabelludo desplazado, fundido con la piel en el nacimiento del
  pelo; los mechones caen con la gravedad y esquivan el cuerpo. El pelo sólo proyecta sombra de
  cerca (la banda bajo el flequillo).
- **Rendimiento.** Unos 30 000 triángulos por fotograma rasterizados en CPU: ≈ 200 ms un
  fotograma de novela visual, ≈ 8 s una hoja de sprites completa en 4 direcciones. No necesita
  tarjeta gráfica.

## Requisitos

Ninguno que instalar. Es HTML + JavaScript: se abre con doble clic y funciona sin conexión en
cualquier navegador moderno (Chrome, Edge, Firefox).

## Cómo usarlo

1. Abre `index.html` con doble clic (o sírvelo con cualquier servidor estático).
2. Elige el modo arriba: **Novela visual** o **Juego · pixel art**.
3. Ajusta cuerpo, cara, pelo y ropa en el panel izquierdo.
4. Cambia la **vista** (frente, 3/4, perfil, espalda...) y previsualiza las animaciones
   (espacio = pausa).
5. Exporta desde el panel derecho.

El personaje se guarda automáticamente en el navegador. Con **Guardar** / **Cargar** puedes
llevarte el archivo `.json` a otro equipo. El grupo «Depuración del G-buffer» muestra normales,
partes, materiales o profundidad en lugar del render final.

## Qué incluye

| Apartado | Opciones |
| --- | --- |
| Estilo | Realista (7.5 cabezas), Heroico (8), Anime / VN (7), Shōjo (7.5), Pixel 64 (5), Pixel 32 (4), Chibi / SD (2.3) |
| Cuerpo | Sexo morfológico continuo, complexión, musculatura, busto (tamaño y caída), tono de piel |
| Cara | Tamaño de ojos, color de ojos, 11 expresiones |
| Peinado | Corto, Media melena, Largo, Coleta, Coletas, Moño, Rapado |
| Parte superior | Camiseta, Manga larga, Tirantes, Manga abullonada, Vestido |
| Parte inferior | Falda, Falda de capa, Falda larga, Pantalón, Pantalón corto |
| Calzado | Zapatos, Botas, Descalzo |

**Animaciones:** reposo, caminar, correr, saltar, saludar, atacar, hablar y parpadear.

## Exportación

| Botón | Resultado |
| --- | --- |
| PNG de la pose actual | Imagen de novela visual a la resolución y vista elegidas |
| Pack de expresiones | ZIP con un PNG por expresión y un `.rpy` con las definiciones `image` para **Ren'Py** |
| Hoja de animación | ZIP con hoja de sprites (300×500 por fotograma) + JSON |
| PNG del fotograma | Sprite de pixel art (×1, ×2 o ×4) |
| Hoja de sprites + JSON | ZIP con hoja (una fila por animación y dirección) + JSON con tamaño de fotograma, fila, número de fotogramas, fps y si se repite |

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

Se puede importar en Godot (`SpriteFrames` / `AnimatedSprite2D`), Unity (Sprite Editor → Grid
by Cell Size), GameMaker, RPG Maker, Phaser, etc.

**Licencia de lo exportado:** la malla, los morphs, el esqueleto y los pesos de MakeHuman son
CC0 (dominio público). Sólo se usan sus assets, nunca su código (AGPL). Lo que exportes se puede
usar y vender sin dar crédito.

## Pruebas y revisión visual

```bash
node --test                          # 28 pruebas
node tools/contact-sheet.mjs         # out/hoja_contacto.png (sin ropa ni pelo)
node tools/contact-sheet.mjs out/hoja_contacto_vestida.png --vestido
```

- `tests/anat.test.mjs`: núcleo matemático, canon y rig, y las proporciones de hueso de la
  auditoría (brazo mayor que antebrazo, dedos a medio muslo, cadera / tronco ≈ 0.58, λ).
- `tests/engine.test.mjs`: sobre el G-buffer en CPU. Silueta frontal contra el canon (± 8 %),
  sin huecos dentro del tronco, pantorrilla y muslo con máximo de ancho propio, perfil con
  ≥ 5 inflexiones, cuello ≥ 0.3 H, la falda no se atraviesa al andar ni al correr, sin manchas
  de sombra, chibi legible a 32 px, malla siempre alineada con la pose y rendimiento.
- La hoja de contacto (4 estilos × 2 sexos × frente, 3/4 y perfil) es la revisión visual que
  pide la auditoría: ninguna prueba numérica la sustituye. No lleva los rasgos de la cara
  (se dibujan con Canvas en el navegador).

## Regenerar los datos de MakeHuman

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git mh
(cd mh && git sparse-checkout set makehuman/data/3dobjs makehuman/data/rigs makehuman/data/targets/macrodetails makehuman/data/targets/breast makehuman/data/targets/armslegs)
node tools/build-mh.mjs mh/makehuman/data
```

## Estructura

```
index.html, css/        interfaz
js/app.js               panel, vista previa y exportación
js/core/                catálogo (vistas, expresiones, animaciones), exportador y utilidades
js/anat/                canon, esqueleto, rig y validador
js/mh/                  motor: modelo MakeHuman, ropa y pelo, G-buffer y motor
js/render/              cámara, composición cel y líneas, cara anime y pixel art
assets/mh/mh-data.js    datos de MakeHuman (generados con tools/build-mh.mjs)
tools/                  build-mh.mjs y contact-sheet.mjs
docs/                   base matemática, corrección visual y auditoría
tests/                  node --test
```
