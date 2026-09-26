# Forja de Sprites

Creador modular de personajes y sprites 2D para **novelas visuales** y **juegos**.

Un mismo personaje se puede exportar de dos formas:

- **Novela visual**: ilustración vectorial detallada (sombreado, brillos en ojos y pelo,
  expresiones faciales), hasta 1800 × 3000 px, cuerpo completo o busto.
- **Juego (pixel art)**: sprites de baja resolución (de 32×32 a 96×128) con menos detalle,
  proporciones chibi opcionales, contorno exterior y animaciones listas en hojas de sprites.

## Requisitos

Ninguno. Es HTML + JavaScript puro con Canvas 2D: sin dependencias, sin WebGL, sin conexión
a internet. Funciona en cualquier PC con un navegador moderno (Chrome, Edge, Firefox) y no
necesita tarjeta gráfica dedicada.

## Cómo usarlo

1. Abre `index.html` con doble clic (o sírvelo con cualquier servidor estático).
2. Elige el modo arriba: **Novela visual** o **Juego · pixel art**.
3. Personaliza el cuerpo, la cara, el pelo, la ropa y los accesorios en el panel izquierdo.
4. Previsualiza las animaciones en la barra inferior (espacio = pausa).
5. Exporta desde el panel derecho.

El personaje se guarda automáticamente en el navegador. Con **Guardar** / **Cargar** puedes
llevarte el archivo `.json` a otro equipo.

## Qué incluye

| Ranura | Opciones |
| --- | --- |
| Cuerpo | Humano, Elfo · proporción (2,5–8 cabezas), altura, complexión, hombros, caderas, piel |
| Ojos | Anime, Redondos, Afilados, Puntos · color de iris |
| Expresiones | Neutral, Feliz, Muy feliz, Triste, Enfadado, Sorprendido, Avergonzado, Pensativo, Guiño |
| Peinado | Corto, Largo, Media melena, Coletas, Coleta, De punta, Moño, Rizado, Rapado |
| Parte superior | Camiseta, Camisa, Sudadera, Uniforme marinero, Vestido, Túnica, Armadura |
| Abrigo | Chaqueta, Chaleco, Abrigo largo |
| Parte inferior | Pantalón, Pantalón corto, Falda, Falda larga |
| Calzado | Zapatillas, Botas, Zapatos |
| Accesorios | Gorra, Sombrero de mago, Lazo, Orejas de gato, Corona, Diadema, Gafas, Gafas de sol, Parche, Bufanda, Corbata, Colgante, Capa, Alas, Mochila, Espada |

Cada pieza tiene sus propios colores editables.

**Animaciones:** reposo, caminar, correr, saltar, saludar, atacar, hablar y parpadear.

## Exportación

| Botón | Resultado |
| --- | --- |
| PNG de la pose actual | Imagen de novela visual a la resolución elegida |
| Pack de expresiones | ZIP con un PNG por expresión y un `.rpy` con las definiciones `image` para **Ren'Py** |
| Hoja de animación | ZIP con hoja de sprites (300×500 por fotograma) + JSON |
| PNG del fotograma | Sprite de pixel art (×1, ×2 o ×4) |
| Hoja de sprites + JSON | ZIP con hoja (una fila por animación) + JSON con tamaño de fotograma, fila, número de fotogramas, fps y si se repite |

Ejemplo del JSON de la hoja de sprites:

```json
{
  "image": "personaje_sprites.png",
  "frameWidth": 48,
  "frameHeight": 64,
  "animations": {
    "walk": { "row": 1, "frames": 4, "fps": 7, "loop": true }
  }
}
```

Con estos datos se puede importar en Godot (`SpriteFrames` / `AnimatedSprite2D`), Unity
(Sprite Editor → Grid by Cell Size), GameMaker, RPG Maker, Phaser, etc.

## Cómo funciona

```
js/
  core/
    util.js        colores, geometría y primitivas de dibujo (contorno, sombreado)
    skeleton.js    esqueleto 2D: calcula las articulaciones a partir de proporciones + pose
    registry.js    ranuras, orden de capas, registro de piezas y expresiones
    animations.js  poses por fotograma de cada animación
    renderer.js    dibujo por capas; modo vectorial y conversión a pixel art
    exporter.js    PNG, hojas de sprites, ZIP (sin dependencias) y script de Ren'Py
  parts/
    body.js        cuerpo base y rasgos de la cara
    eyes.js        estilos de ojos
    hair.js        peinados (capa trasera y delantera)
    clothes.js     ropa y calzado
    accessories.js accesorios
  app.js           interfaz
```

- Todas las piezas se dibujan **relativas al esqueleto**, así que cualquier prenda se adapta a
  cualquier cuerpo (chibi o realista) y a cualquier animación sin dibujar nada a mano.
- El personaje se pinta en **capas** (pelo trasero, piernas, torso, ropa, brazos, cabeza, cara,
  flequillo, sombrero…), lo que permite combinar ropa libremente.
- El modo pixel art dibuja el personaje con menos detalle a 4× y lo reduce eligiendo el color
  más frecuente de cada bloque, lo que conserva colores planos y líneas limpias.

## Añadir una pieza nueva

Crea (o edita) un archivo en `js/parts/` y regístrala. Por ejemplo, un cinturón:

```js
SC.registerPart({
  slot: 'neckAcc',            // ranura: body, eyes, hair, top, outer, bottom, shoes, headAcc, faceAcc, neckAcc, backAcc
  id: 'cinturon',
  name: 'Cinturón',
  colors: { main: { label: 'Cuero', value: '#5a3d2b' } },
  layers: {
    // Capa donde se dibuja (ver SC.LAYERS en registry.js).
    outer(ctx, rig, c) {
      const t = rig.torso, y = rig.hip.y - t.len * 0.1;
      SC.draw.limb(ctx, rig, [{ x: t.L.waist.x, y }, { x: t.R.waist.x, y }], t.len * 0.06, c.main, { cap: 'butt' });
    },
  },
});
```

Si es un archivo nuevo, añádelo con un `<script>` en `index.html` después de los demás
archivos de `js/parts/`. La pieza aparecerá sola en el editor, en el aleatorio y en todas
las exportaciones.
