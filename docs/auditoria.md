# Auditoría del motor anatómico

Sep 27, 2026 · @Nicolas

Tu impresión es correcta: el código respeta los documentos y la figura sale mal igualmente. Los fallos vienen de tres sitios que se suman: errores de proporción en la base matemática (que escribí yo), un método de construcción que coloca unas 60 primitivas a ciegas por coordenadas y unas pruebas que miden números aislados y no el aspecto. Cada corrección hace pasar una prueba y rompe otra zona. Por eso la figura empeora con cada cambio.

Auditoría hecha sobre la copia de C:\Users\nicos\Desktop\prueba-claude-cloud-r3j3vy: leí el código de js/anat/ y js/sdf/, ejecuté las pruebas (25 de 25 pasan) y rendí el motor SDF (el que está por defecto) en un navegador sin interfaz, con el cuerpo sin ropa para ver la anatomía.

## 1. Veredicto

| Causa | Peso en el resultado | Dónde |
| Anchos del cuerpo sin escalar al largo del tronco: todos los estilos salen con cuerpo de barril | Alto | canon.js, body.js (base matemática 3.3) |
| Parte alta del pecho vacía: la caja torácica empieza por debajo de los hombros y quedan huecos junto al cuello | Alto | sdf/build.js, torso |
| Hombros como bolas sueltas y brazos pegados por fuera del tronco | Alto | sdf/build.js, brazos |
| Cabeza: la barbilla cuelga como un bulto aparte y la cara queda plana | Alto | sdf/build.js, cabeza |
| Uniones suaves demasiado grandes (k de hasta 0.25H) que inflan todo el tronco y borran la cintura | Medio | sdf/build.js |
| Mujer con antebrazo más largo que el brazo | Medio | body.js (base matemática 4.3) |
| Pruebas que se cumplen deformando otras zonas | Estructural | tests/sdf.test.mjs |

Lo más importante no se arregla ajustando números: modelar un cuerpo creíble colocando primitivas a mano sin una referencia visual es escultura a ciegas. Mi recomendación (sección 6) es cambiar la fuente de la forma y conservar todo lo demás que ya funciona: esqueleto, rig, poses, render de línea y sombreado, pixel art y exportación.

## 2. Evidencia

Renders del motor SDF con los valores por defecto, estilo Anime / VN, sin ropa ni pelo, para ver solo la anatomía.

- Tronco de barril: la cintura es casi tan ancha como el pecho y la cadera, y el tronco es corto para esos anchos.

- Hombros como bolas encima del tronco; los brazos cuelgan por fuera, sin axila.

- Dos barras sueltas delante del pecho (las clavículas) con el fondo visible debajo.

- Piernas como tubos rectos, sin rodilla ni forma de pantorrilla.

- De perfil: sin curva en S de la espalda y el glúteo como un bulto aislado.

La vista de partes (centro) muestra el fallo principal: el tronco (verde oscuro) es un huevo que empieza por debajo de los hombros. Entre el cuello y los hombros solo hay dos conos finos, así que se ven huecos y barras. Los brazos (azul y naranja) son cilindros pegados por fuera del huevo.

- En los dos perfiles la barbilla cuelga como un bulto bajo la cara, y la cara es un plano vertical con el ojo en el borde.

- De espaldas se repiten los huecos junto a los hombros.

## 3. Errores de la base matemática

Estos fallos están en los documentos que escribí, no en cómo los programó Claude Code. Los números salen de volcar el esqueleto que calcula body.js para cada estilo.

### 3.1 Los anchos no se escalan con el largo del cuerpo (el más grave)

La tabla de anchos (hombros, cintura, cadera, muslo) está medida sobre un canon adulto de 8 cabezas, cuyo tronco mide 3.0H de la barbilla a la entrepierna. El documento aplica esos anchos tal cual a estilos con el tronco más corto. El resultado es un cuerpo ancho y bajo, como un barril.

| Estilo | Tronco (H) | Cadera mujer (H) | Cadera / tronco | Canon real |
| Heroico | 3.00 | 1.88 | 0.63 | ≈ 0.58 |
| Realista | 2.75 | 1.82 | 0.66 | ≈ 0.58 |
| Anime / VN (por defecto) | 2.29 | 1.76 | 0.77 | ≈ 0.58 |
| Shōjo | 2.38 | 1.82 | 0.76 | ≈ 0.58 |

En el estilo por defecto el tronco es un 33 % más ancho de lo que corresponde a su largo. Corrección: multiplicar los anchos del tronco por L_torso / 3.0 y los de las piernas por L_leg / 4.0. El cuello y la cabeza no se escalan, porque se miden contra la cabeza.

### 3.2 Piernas demasiado largas en el estilo Anime

Con N = 7 y λ = 0.53, el tronco queda en 2.29H (la entrepierna a 3.29 cabezas de la coronilla). En una figura anime de 7 cabezas la entrepierna cae hacia las 3.5 cabezas (λ ≈ 0.50). Con λ = 0.53 el tronco es corto y con 3.1 encima también ancho.

| Estilo | λ actual | λ propuesto |
| Anime / VN | 0.53 | 0.50 |
| Shōjo | 0.55 | 0.52 |
| Realista y Heroico | 0.50 | 0.50 (sin cambio) |

### 3.3 La mujer tiene el antebrazo más largo que el brazo

El documento calcula el brazo como "del hombro a la cintura" y el antebrazo como "de la cintura a la entrepierna". Como la cintura femenina está más alta, en mujer sale brazo 1.28H y antebrazo 1.36H (Heroico). En la anatomía real el húmero es un 20 % más largo que el antebrazo en ambos sexos. Corrección: longitudes fijas sin dimorfismo de cintura, L_brazo = 0.49 · L_torso y L_antebrazo = 0.40 · L_torso.

### 3.4 Caja torácica demasiado alta

El documento corrección visual (7.1) da a la caja torácica una semialtura de 0.42 L_torso con el centro en τ 0.30. Así su borde superior sube por encima de la barbilla. Claude Code la bajó (a τ 0.41) para que pasara la prueba del cuello, y al bajarla se abrió el hueco entre cuello y hombros. Valores correctos: centro en τ 0.31 y semialtura 0.24 L_torso (del esternón, τ 0.07, a las costillas flotantes, τ 0.55).

### 3.5 Falta la masa que da forma a la parte alta del tronco

El documento describe la caja torácica como un huevo "más ancho abajo". Eso es cierto para el hueso, pero la silueta visible del tronco es más ancha arriba: la dan la cintura escapular, los pectorales y el dorsal ancho, que bajan en cuña desde la axila hasta la cintura. Sin esa cuña, el tronco se lee como un huevo con los brazos pegados por fuera.

### 3.6 Masa de la cara demasiado alta

La elipse de la cara (centro v 0.62, radio vertical 0.25) termina en v 0.87, pero la barbilla está en v 1.0. El último 13 % de la cabeza lo forman solo los conos de la mandíbula, por eso la barbilla cuelga como un bulto aparte. Corrección: centro en v 0.68 y radio vertical 0.32, de modo que la cara cubra de la ceja a la barbilla.

## 4. Errores de construcción del motor SDF

Estos fallos están en js/sdf/build.js. Algunos vienen de valores del documento, pero la mayoría son de cómo se combinan las primitivas.

| Problema | Código | Efecto visible | Corrección |
| Los músculos quedan dentro del cilindro base | Gemelos de radio 0.09–0.10 sobre un cono de pierna de radio ≈ 0.20; vasto interno de 0.09 dentro de un muslo de 0.30 | Piernas como tubos: los músculos existen, pero no asoman | Reducir el cono base al hueso más tejido fino (≈ 60 % del ancho) y dar la forma con los músculos, o usar los perfiles de ancho del documento (tablas 8.1 y 8.2) |
| Uniones suaves mayores que las formas que unen | Abdomen y pelvis con k = 0.25; mandíbula con k = 0.14 sobre un cono de radio 0.035–0.06 | Tronco inflado sin cintura; bultos en mejillas y barbilla | k nunca mayor que el radio de la forma más fina de la unión |
| El hombro no tiene tronco con el que fundirse | Brazo unido con k 0.12 en un radio de 0.45, pero la caja torácica empieza por debajo | Bola de hombro suelta y axila abierta | Arreglar la parte alta del tronco (3.4 y 3.5) antes de tocar el hombro |
| Clavículas como barras sueltas | Conos de radio 0.035 que cruzan el hueco del pecho | Barras con fondo visible debajo | Hundirlas en la masa del pecho: con el tronco corregido solo se ve un relieve |
| Unidades mezcladas | Unas medidas se multiplican por la escala del estilo y otras no (maléolos 0.035, cintura escapular −0.13, desplazamiento del deltoides 0.05) | En estilos pequeños o chibi esas piezas quedan enormes | Todas las medidas relativas al hueso o al ancho que acompañan |
| Ajustes para pasar pruebas | Tres comentarios "Ajuste" en build.js; en el de la caja torácica el comentario dice τ 0.38 y el código usa τ 0.41 | Cada ajuste arregla una prueba y abre un hueco en otra zona | Deshacerlos al corregir la base |

El problema de fondo: son unas 60 primitivas con posiciones y tamaños escritos a mano, sin ninguna imagen de referencia con la que compararlas. Un escultor ve lo que hace; este código no. Por eso cada corrección local tiene efectos que nadie mira hasta que se renderiza.

## 5. Por qué las pruebas pasan y aun así sale mal

Las 25 pruebas pasan. Cada una mide un número aislado y ninguna mira la forma completa, así que se pueden cumplir deformando otra zona. Las pruebas de aceptación las propuse yo en el documento de corrección visual (12.1), así que este fallo también es mío.

| Prueba | Qué comprueba | Cómo se cumple sin arreglar nada |
| Cuello ≥ 0.3H | Distancia entre la barbilla y el primer píxel de hombro | Bajando la caja torácica, que abre el hueco del pecho |
| Sin costuras | No hay línea dibujada cerca de hombros y caderas | Un hueco sin línea también cuenta como "sin costura" |
| Manos 0.65–0.80H | Largo del hueso de la mano | Se cumple con una mano en forma de garra |
| Pie con volumen | Alto en el tobillo comparado con el alto en los dedos | No mira la forma de la pierna encima |
| Reposo asimétrico | Los ángulos izquierdo y derecho son distintos | Una pose asimétrica puede seguir siendo rígida |

Pruebas que faltan:

- Silueta contra referencia: medir el ancho de la silueta frontal y lateral a la altura de cada landmark y compararlo con la tabla del canon (tolerancia ± 8 %). Detecta el barril, la cintura inflada y las piernas tubo.

- Sin huecos: entre el cuello y la entrepierna, cada fila de la silueta del tronco debe ser un solo tramo continuo (sin contar los brazos). Detecta los huecos junto al cuello.

- Músculos visibles: el perfil de ancho de la pantorrilla y del muslo debe tener un máximo local donde indica la tabla. Detecta los músculos enterrados en el cilindro.

- Proporciones de hueso: brazo mayor que antebrazo en ambos sexos; punta de los dedos a medio muslo con el brazo colgando.

- Revisión visual obligatoria: cada cambio genera una hoja de contacto (4 estilos × 2 sexos × frente, 3/4 y perfil, sin ropa) y una persona la mira antes de aceptarlo. Ninguna prueba numérica sustituye esto.

## 6. Recomendación

Recomiendo que la forma del cuerpo salga de una malla diseñada por un artista, deformada por parámetros, en vez de construirla con primitivas. Todo lo demás que ya existe se conserva: esqueleto, poses, rig, línea y sombreado cel desde el G-buffer, cara anime proyectada, pixel art y exportación.

| Camino | Calidad máxima | Esfuerzo | Hombre / mujer continuo | Licencia |
| A. Seguir corrigiendo el SDF | Media: aceptable en sprites de 64 px o menos, flojo en novela visual | Alto y sin final claro | Sí | Propio |
| B. Malla base de MakeHuman con sus morphs | Alta en cuerpo; la cara es realista y necesita estilizarse | Medio | Sí: sexo, edad, musculatura, peso y proporciones son deslizadores continuos | CC0, uso libre incluso para crear otro generador (fuente) |
| C. Motor VRM que ya tienes (modelos de VRoid) | Muy alta en anime | Bajo: ya funciona | No: cada personaje se hace en VRoid | Las condiciones de VRoid impiden combinar sus piezas para generar personajes |

Qué haría yo:

- Para novela visual ahora mismo, usar el motor VRM. Es el único que hoy da anatomía de nivel profesional.

- Para el generador paramétrico propio, el camino B: cargar la malla base de MakeHuman en el visor WebGL que ya usan los motores VRM y Modular, aplicar sus morphs de sexo, complexión y proporciones, y pasarla por tu pipeline de líneas y sombreado. La cabeza se estiliza con un morph propio (ojos más grandes, nariz y boca reducidas) y los ojos y la boca siguen siendo los rasgos anime proyectados que ya tienes.

- Conservar el SDF solo para pixel art pequeño (64 px o menos), donde sus errores apenas se ven, después de aplicar las correcciones de la sección 3.

- Reducir el número de motores. Hoy hay seis (SDF, clásico, generado, modular, VRM y LPC). Mantener seis motores a la vez reparte el esfuerzo y ninguno llega a estar pulido.

El camino B es trabajo real: convertir la malla y sus morphs a un formato web, crear el morph de cabeza anime y ajustar el rig. Pero el límite de calidad ya no depende de adivinar números, sino de una malla que un artista ya resolvió.

## 7. Correcciones y orden de trabajo

Este orden vale en cualquiera de los caminos, porque los pasos 1 y 2 corrigen la base que todos comparten.

- Pruebas nuevas primero (sección 5): silueta contra referencia, sin huecos, músculos visibles, proporciones de hueso y generador de hoja de contacto. Deben fallar con el código actual; si pasan, están mal escritas.

- Base matemática (sección 3), en canon.js y body.js:

- Anchos del tronco × L_torso / 3.0 y de las piernas × L_leg / 4.0, sin escalar cuello ni cabeza.

- λ: Anime 0.50 y Shōjo 0.52.

- L_brazo = 0.49 · L_torso y L_antebrazo = 0.40 · L_torso en ambos sexos.

- Tronco SDF (secciones 3.4, 3.5 y 4): caja torácica en τ 0.31 con semialtura 0.24 L_torso; añadir la cuña de pectoral y dorsal de la axila a la cintura; uniones suaves nunca mayores que la forma más fina; deshacer los tres "Ajuste".

- Piernas y brazos SDF: cono base al 60 % del ancho y forma dada por los músculos, o por los perfiles de ancho de las tablas 8.1 y 8.2.

- Cabeza SDF: cara con centro en v 0.68 y radio vertical 0.32; k de la mandíbula ≤ 0.04.

- Revisión visual de la hoja de contacto antes de dar nada por terminado.

- Decidir el camino (sección 6) con la hoja de contacto corregida delante. Si el SDF corregido sigue sin convencer en novela visual, empezar el camino B.

### Instrucción para Claude Code

Lee docs/auditoria.md. Implementa solo los pasos 1 y 2. Escribe primero las pruebas del paso 1 y comprueba que fallan con el código actual. Después corrige canon.js y body.js según el paso 2. No toques js/sdf/ todavía. Al terminar, genera la hoja de contacto (4 estilos × 2 sexos × frente, 3/4 y perfil, sin ropa ni pelo) como PNG en out/ y no digas que está arreglado: yo la revisaré.

Para usar esa instrucción, descarga este documento como Markdown y guárdalo como docs/auditoria.md en el proyecto. Luego pídele un paso cada vez.

## Fuentes

- MakeHuman: licencia actual (código AGPL; malla base, targets y demás assets CC0)

- MakeHuman: reutilizar sus assets para otro generador de personajes

Usa solo los assets, no el código de MakeHuman, que es AGPL. Una página antigua de su web todavía dice que los assets son AGPL, pero la propia página avisa de que está desactualizada.

