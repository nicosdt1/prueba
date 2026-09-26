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

## Requisitos

Ninguno. Es HTML + JavaScript puro con Canvas 2D: sin dependencias, sin WebGL, sin conexión
a internet. Funciona en cualquier PC con un navegador moderno (Chrome, Edge, Firefox) y no
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
  gravedad sin atravesar el cuerpo y acaban en punta, cada uno con su sombra y su brillo.
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
