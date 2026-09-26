<!-- Texto extraído de Correccion_visual_motor_anatomico.docx (el original está en esta carpeta). Las tablas aparecen con celdas separadas por |. -->

Corrección visual del motor anatómico
Sep 26, 2026 · @Nicolas
Las proporciones ya son correctas; lo que falla es cómo se construye y se dibuja el volumen. Cada parte es un polígono 2D independiente con su propio contorno y su propia sombra, así que el ojo lee piezas pegadas y no un cuerpo. Este documento complementa la base matemática y no cambia sus medidas: cambia la representación, la dirección de arte y las poses.
1. Diagnóstico de las capturas
Los problemas se agrupan en cinco causas raíz. Arreglar las causas (columna 3) corrige varios síntomas a la vez; retocar cada síntoma por separado no.
Prioridad
 | Síntoma visible
 | Causa raíz
 | Dónde se corrige
 | P0
 | Cuerpo "ensamblado": costuras en hombros, cadera, cuello; cada pieza con su contorno
 | Polígonos separados, cada uno contorneado y sombreado por su cuenta
 | Secciones 2 y 3
 | P0
 | En 3/4 y perfil la cara es una calcomanía clara pegada al lateral de una esfera, con un recorte rectangular
 | Rasgos pintados sobre un círculo; no hay volumen de cara, nariz ni mandíbula en la silueta
 | Sección 4
 | P0
 | Pelo como casco, flequillo en bloques rectangulares
 | Pelo = polígono único pegado al cráneo, sin separación ni mechones
 | Sección 5
 | P0
 | Sombras como triángulos negros enormes en falda y pantalón
 | Sombra calculada por polígono plano, no por normales de una superficie curva
 | Sección 9
 | P1
 | Mangas como globos sueltos; el brazo sale por debajo como un tubo
 | Manga y brazo son formas distintas; falta el deltoides que une hombro y brazo
 | Sección 6
 | P1
 | Cuello casi inexistente, la cabeza parece encajada entre los hombros
 | Cuello tapado por el orden de dibujo y sin trapecios
 | Sección 4.5
 | P1
 | Manos diminutas en forma de garra
 | Mano dibujada con líneas finas y tamaño sin comprobar
 | Sección 6.3
 | P1
 | Pies como remos marrones sueltos al final de la pierna
 | Pie = elipse 2D rotada, sin volumen ni tobillo
 | Sección 7.4
 | P1
 | Falda rígida en forma de cono; el muslo la atraviesa al andar
 | La falda no depende de la posición de las piernas
 | Sección 8.2
 | P1
 | Pantalón como dos tubos paralelos, sin entrepierna ni rodilla
 | Pierneras sin forma propia ni pliegues
 | Sección 8.3
 | P2
 | Reposo en A-pose rígida, brazos separados del cuerpo
 | Se usa la pose de construcción (20°) como reposo
 | Sección 10.1
 | P2
 | Brazos de zombi al andar; saludo con el brazo recto hacia arriba
 | Amplitudes y poses clave sin revisar; codo casi recto
 | Sección 10
 | P2
 | Chibi aplastado: cuerpo de adulto encogido, pies desaparecidos
 | Canon adulto escalado en vez de un canon chibi propio
 | Sección 11.1
 | P2
 | Los estilos pixel no parecen pixel art (bordes suaves reducidos)
 | Se reescala una imagen suave en lugar de renderizar a baja resolución
 | Sección 11.2
 | Orden recomendado: primero la arquitectura de volúmenes (2) y la línea (3), porque sin ellas cualquier mejora de cara, pelo o ropa seguirá pareciendo pegada. Después cabeza y pelo, que es lo que más mira el espectador, y por último ropa y poses.
2. Arquitectura: volúmenes 3D con unión suave
El cuerpo debe dejar de ser un conjunto de polígonos y pasar a ser una sola superficie 3D definida por funciones de distancia (SDF), unidas con una unión suave que funde hombro con brazo o cadera con muslo sin costura. El esqueleto, las medidas y el rig actuales se conservan: solo cambia cómo se convierte el esqueleto en forma.
2.1 Qué es una SDF y por qué resuelve el problema
Una SDF devuelve, para cualquier punto p del espacio, la distancia a la superficie: negativa dentro, positiva fuera. Con ella se obtiene gratis y de forma coherente en cualquier vista la silueta, la profundidad (quién tapa a quién) y la normal (para sombrear). Dos formas se funden sin costura con una sola función de unión suave.
2.2 Primitivas
Cono redondeado (cada segmento de miembro, dedo, cuello, torso): de la articulación a (radio r_a) a la b (radio r_b). Los radios salen de las tablas de anchos de la base matemática (r = w/2).
t = \operatorname{clamp}\!\left(\frac{(p-a)\cdot(b-a)}{\lVert b-a\rVert^2},\,0,\,1\right), \qquad d = \lVert p - (a + t\,(b-a)) \rVert - \big(r_a + t\,(r_b - r_a)\big)
Para secciones no circulares (el muslo es más ancho que profundo), se evalúa en el espacio local del hueso con el eje de profundidad escalado por ancho/profundidad y se multiplica el resultado por la escala mínima.
Elipsoide (cráneo, caja torácica, pelvis, busto, músculos), con radios r = (r_x, r_y, r_z) en espacio local:
k_0 = \left\lVert \tfrac{p}{r} \right\rVert, \qquad k_1 = \left\lVert \tfrac{p}{r^2} \right\rVert, \qquad d = \frac{k_0\,(k_0 - 1)}{k_1}
2.3 Unión suave
h = \frac{\max(k - |d_1 - d_2|,\ 0)}{k}, \qquad \operatorname{smin}(d_1, d_2) = \min(d_1, d_2) - \frac{h^2\,k}{4}
k es el radio de fusión: cuanto mayor, más blanda la unión. Es el parámetro que da aspecto orgánico.
Unión
 | k (en H)
 | Nota
 | Caja torácica + abdomen + pelvis
 | 0.25
 | tronco continuo, cintura legible
 | Cuello + trapecios + torso
 | 0.15
 | sin cabeza "encajada"
 | Hombro (deltoides) + torso
 | 0.12
 | elimina la costura del hombro
 | Pelvis + muslo
 | 0.12
 | cadera continua (mayor en mujer: 0.16)
 | Busto + pecho
 | 0.10
 | sin contorno propio del busto
 | Codo, rodilla
 | 0.04
 | se mantiene la articulación visible
 | Muñeca, tobillo
 | 0.03
 | 
 | Dedos
 | 0.008
 | los dedos no se funden entre sí
 | Las uniones se hacen solo entre padre e hijo del esqueleto, nunca entre miembros distintos: si no, un brazo pegado al costado se fundiría con el torso. Brazo y torso se combinan con min normal (unión dura) salvo en el hombro.
2.4 Músculos como volumen añadido
Los músculos de la base matemática (deltoides, pectoral, bíceps, gemelos, glúteo, vasto interno) se modelan como elipsoides pequeños fijados al hueso en su t y lado, con smin de k = 0.03H. Su tamaño escala con complexión b y sexo s (en mujer, 60 % del volumen masculino salvo glúteo y muslo). Para estrechar la cintura se usa resta suave:
\operatorname{smax}(d_1, -d_2) = -\operatorname{smin}(-d_1, d_2)
2.5 Render
Camino principal (WebGL, sin compilar nada): un shader de fragmentos lanza un rayo ortográfico por píxel en la dirección de la vista y avanza con sphere tracing (máximo 64 pasos, parar si d < 0.001H). Cada hueso tiene una caja envolvente para descartar primitivas lejanas; así funciona en gráficas integradas.
Respaldo en CPU: para sprites de hasta 128 px se evalúa la misma SDF en JavaScript, un rayo por píxel (≈ 16 000 rayos, instantáneo).
El render produce un G-buffer por píxel: profundidad, normal, material (piel, pelo, ropa A…), identificador de pieza y coordenada t a lo largo del hueso. Todo lo demás (línea, sombra, color, pixel art) se calcula a partir de estos buffers.
Normal por diferencias centrales, con ε = 0.002H:
n = \operatorname{norm}\big(f(p+\epsilon e_x) - f(p-\epsilon e_x),\ f(p+\epsilon e_y) - f(p-\epsilon e_y),\ f(p+\epsilon e_z) - f(p-\epsilon e_z)\big)
2.6 Material en las zonas de fusión
En cada punto el material es el de la primitiva con menor distancia. Para evitar un corte brusco en las fusiones, se mezclan los dos materiales más cercanos con peso h de la unión suave. La ropa no se asigna aquí: tiene su propia superficie (sección 8).
3. Una silueta, un contorno
Las líneas no se dibujan pieza a pieza: se detectan en el G-buffer después del render. Solo aparece línea donde un dibujante la pondría: en el borde exterior, donde una forma tapa a otra y donde cambia el material. Donde dos primitivas del mismo material se funden no hay línea, y así desaparecen las costuras.
3.1 Tipos de línea
Tipo
 | Condición entre un píxel y su vecino
 | Grosor
 | Ejemplo
 | Silueta exterior
 | uno toca el cuerpo y el otro es fondo
 | W
 | contorno del personaje
 | Oclusión
 | salto de profundidad mayor que 0.05H
 | 0.75 W
 | brazo delante del torso, pierna delantera
 | Cambio de material
 | material distinto (piel, manga, falda, pelo)
 | 0.5 W
 | borde de la manga, cintura de la falda
 | Pliegue
 | ángulo entre normales vecinas > 50°
 | 0.35 W, solo en VN
 | bajo el busto, hueco de la rodilla
 | Nunca
 | mismo material y superficie continua
 | —
 | unión hombro-brazo, cadera-muslo
 | Clave: la comparación usa el identificador de material o región, nunca el de primitiva. Todas las primitivas de piel forman una sola región.
3.2 Grosor
W = \max\big(1,\ 0.004\,P\big)\ \text{px}, \qquad W_{final} = W\,\big(0.7 + 0.6\,(1 - I)\big)\,\big(1 - 0.3\,\hat z_{prof}\big)
P es el alto del sprite en píxeles, I la iluminación del píxel (sección 9) y ẑ_prof la profundidad normalizada. La línea es más fina en el lado iluminado y en lo que está lejos: es la variación de grosor que da el aspecto dibujado a mano. En pixel art W = 1 siempre.
3.3 Color de línea
Nunca negro puro. La línea toma el color del relleno adyacente oscurecido en OKLCH: L × 0.45, C × 0.8 y matiz desplazado 10° hacia el rojo en la piel, así la línea de la piel es marrón rojiza y la del pelo un tono profundo del propio pelo. En la silueta exterior se usa el material del lado del cuerpo.
3.4 Implementación
Detección de bordes con el operador de Sobel sobre los buffers de profundidad y de material.
Engrosado a W_final con jump flooding (una pasada por potencia de 2), que es rápido en GPU.
En VN, render a 2× y reducción con promedio para suavizar. En pixel art, sin suavizado.
Los rasgos de la cara (ojos, cejas, boca, nariz) no salen del buffer: se dibujan después como trazos vectoriales (sección 4), recortados por la máscara de la cabeza.
4. Cabeza, cara y cuello
La cabeza actual es una esfera con los rasgos pintados, por eso en 3/4 y perfil parece una calcomanía. Debe construirse con cinco masas (cráneo, cara, mandíbula, nariz y orejas) fundidas con unión suave, de modo que el perfil de frente, nariz y barbilla salga en la silueta. Los rasgos anime se proyectan sobre esa superficie con reglas de estilo, no con perspectiva realista.
4.1 Masas de la cabeza (espacio de cabeza: v desde la coronilla, z hacia delante, en H)
Masa
 | Primitiva
 | Centro o extremos
 | Tamaño
 | Fusión k
 | Cráneo
 | elipsoide
 | (0, v 0.42, z −0.04)
 | radios (W/2, 0.42, 0.46)
 | —
 | Cara (pómulos y maxilar)
 | elipsoide
 | (0, v 0.62, z +0.12)
 | (0.44 W, 0.25, 0.30)
 | 0.10
 | Mandíbula (×2)
 | cono redondeado
 | gonion (±x_g, v 0.84, z −0.05) → barbilla (0, v 0.97, z +0.30)
 | r 0.06 → 0.05 (M) · 0.045 → 0.035 (F)
 | 0.08
 | Nariz
 | cono redondeado
 | puente (0, v 0.50, z +0.38) → punta (0, v 0.70, z +0.48)
 | r 0.02 → 0.045 (realista) · 0.01 → 0.02 (anime)
 | 0.03
 | Orejas (×2)
 | elipsoide girado 15° hacia atrás
 | (±W/2, v 0.58, z −0.02)
 | (0.035, 0.15, 0.09)
 | 0.02
 | Arco superciliar (solo M)
 | cápsula
 | (±0.30 W, v 0.44, z +0.36)
 | r 0.03
 | 0.04
 | x_g es el gonion de la base matemática (tabla 5.4). Con estas masas, en perfil aparecen frente, puente, punta de nariz, labio y barbilla sin dibujarlos: salen de la silueta.
4.2 Cara anime proyectada
Ojos, cejas y boca son trazos vectoriales diseñados en un plano frontal y pegados a la superficie de la cara:
Para cada rasgo se lanza un rayo frontal en su (u, v) y se obtiene su punto de anclaje en la superficie y su normal.
En cada vista se proyecta el anclaje y se construye un marco tangente (derecha y arriba sobre la superficie).
El rasgo se dibuja en ese marco con un escorzo estilizado, no físico, porque en anime el ojo lejano se estrecha poco:
f = 0.55 + 0.45\,\max(0,\ n \cdot \hat v)
El ojo lejano se recorta con la máscara de la cabeza y con la profundidad del puente de la nariz: si queda detrás, desaparece la parte tapada, pero nunca se deja "fuera" de la silueta.
Reglas de 3/4 anime (θ = 30–45°):
La barbilla se desplaza hacia el lado lejano x = 0.30H · sin θ.
En el contorno lejano se ve el pómulo a la altura de los ojos y luego la línea baja a la barbilla. Sale solo de la masa de la cara si sus radios son correctos.
La boca se desplaza hacia el lado lejano y se acorta con el mismo f.
La nariz se reduce a una sombra pequeña en el lado contrario a la luz y un leve saliente en la silueta.
4.3 Diseño del ojo anime
Elemento
 | Especificación (en anchos de ojo e_w)
 | Diferencia M / F
 | Párpado superior
 | curva gruesa, 2–3× el grosor de línea en el extremo exterior
 | F: pestañas con 2–3 puntas hacia fuera; M: más fino y recto
 | Párpado inferior
 | línea fina, solo el 40 % exterior
 | 
 | Apertura del ojo
 | alto 0.9 e_w
 | M: 0.7 e_w; F: 1.0 e_w
 | Iris
 | elipse vertical, ancho 0.60 e_w, alto el 95 % de la apertura, cortado por el párpado
 | M: ancho 0.50 e_w
 | Pupila
 | elipse de 45 % del iris, desplazada un 5 % hacia arriba
 | 
 | Degradado del iris
 | oscuro arriba → claro abajo, 3 tonos de la rampa
 | 
 | Brillos
 | uno grande arriba en el lado de la luz (20 % del iris) y uno pequeño abajo en el lado contrario (8 %)
 | 
 | Esclera
 | blanca con sombra bajo el párpado superior (15 % del alto)
 | 
 | Las cejas son trazos con extremos afilados que siguen la superficie de la frente. En anime se dibujan por encima del flequillo al 50 % de opacidad, para que la expresión siga legible.
4.4 Piel de la cara
No existe una forma de "cara" con color propio: toda la cabeza es piel de la misma SDF. Esto elimina la placa clara y el recorte rectangular de las capturas. El rubor es una elipse difusa proyectada como los rasgos, en la mejilla (v 0.66, u ±0.28 W).
4.5 Cuello y trapecios
Parte
 | Primitiva
 | Posición
 | Tamaño
 | Cuello
 | cono redondeado inclinado 15–20° hacia delante
 | de la base del cuello en el torso al pivote de la cabeza
 | radio = mitad del ancho de cuello; profundidad 0.9 del ancho
 | Trapecios (×2)
 | cono redondeado
 | de (±0.12H) en la base del cuello al acromion
 | r 0.08H (M), 0.05H (F)
 | Nuez (solo M)
 | elipsoide
 | delante del cuello, a 1/3 bajo la barbilla
 | 0.03H
 | El frente del cuello nace bajo la mandíbula (v ≈ 0.90) y la nuca en el occipital (v ≈ 0.60). Por eso de perfil el cuello está inclinado y la cabeza queda delante de los hombros, no encima.
4.6 Comprobación
En perfil, la silueta de la cabeza debe mostrar al menos cinco inflexiones (frente, puente, punta de nariz, labios y barbilla) y el cuello debe verse con una altura visible de al menos 0.3H entre la barbilla y los hombros en vista frontal.
5. Pelo: mechones, no casco
El pelo parece un casco porque es un solo polígono pegado al cráneo. Debe tener volumen separado del cráneo y estar formado por mechones que nacen en el cuero cabelludo, caen con la gravedad, esquivan la cara y terminan en punta. Todo es paramétrico: cada peinado es una receta, no un dibujo.
5.1 Base de volumen
Una capa que envuelve el cráneo a una distancia τ solo dentro de la zona con pelo (por encima de la línea del nacimiento y por detrás de las orejas):
d_{base}(p) = d_{cráneo}(p) - \tau, \qquad \tau = 0.05H \text{ (corto)} \ \ldots\ 0.12H \text{ (voluminoso)}
Esto da la forma redondeada de arriba sin aplastar el pelo contra la cabeza. En la coronilla τ es máximo y en las sienes se reduce al 60 %.
5.2 Mechones
Cada mechón es una curva (espina) con una sección aplanada que se estrecha hasta la punta:
w(t) = w_0\,(1 - t)^{0.7}, \qquad \text{grosor} = w(t)/3
La espina se genera paso a paso desde la raíz, con tamaño de paso Δ = L/16:
x_{i+1} = x_i + \Delta\,d_i, \qquad d_{i+1} = \operatorname{norm}\!\big(d_i + \tfrac{\Delta}{\kappa}\,g + c_i\big)
Dirección inicial: desde la raya o el remolino hacia la raíz, tangente al cráneo.
g = (0, −1, 0) es la gravedad y κ la rigidez (alta en pelo corto y de punta, baja en pelo largo y liso).
c_i es la colisión: si d_cabeza(x_i) < τ_min, se empuja el punto hacia fuera por la normal. Así el pelo nunca atraviesa la cara ni los hombros.
Se añade un rizo opcional girando d_i alrededor de la espina con frecuencia ω.
La superficie del mechón es una cadena de conos redondeados con sección elíptica, que se funde con la base mediante smin (k = 0.03H) solo en la raíz.
5.3 Flequillo
El flequillo es lo que más define la cara anime. Se generan n mechones (5–9) con raíz en la franja delantera, y longitudes alternas para evitar el borde recto:
L_i = L_0\,\big(1 + 0.15\,\sin(2.3\,i + \text{semilla})\big), \qquad i = 0, \ldots, n-1
Las puntas apuntan abajo y ligeramente hacia el centro; entre mechones quedan huecos en V que dejan ver la frente.
L_0 se mide en líneas guía: hasta las cejas, hasta los ojos (nunca tapando el iris por completo) o apartado a un lado.
Los dos mechones laterales (enmarcando la cara) caen por delante de las orejas hasta la mandíbula o más.
5.4 Recetas de peinado
Cada peinado es una lista de grupos de mechones: zona de raíz, número, longitud, rigidez y forma de punta.
Peinado
 | Base τ
 | Grupos principales
 | Rigidez
 | Punta
 | Corto (M)
 | 0.06H
 | 12–18 mechones de 0.2–0.4H hacia atrás y arriba + flequillo de 5
 | alta
 | punta aguda
 | Media melena
 | 0.08H
 | flequillo 7 + laterales hasta la mandíbula + 10 traseros hasta la nuca
 | media
 | punta y horquilla
 | Largo
 | 0.09H
 | flequillo 7 + laterales + 14 traseros hasta la cintura, 2 por delante del hombro
 | baja
 | punta
 | Coleta
 | 0.06H
 | mechones del cráneo convergen en el lazo; del lazo sale un haz de 6–8
 | baja
 | punta
 | Coletas
 | 0.06H
 | raya central; dos lazos a los lados; un haz por lazo
 | baja
 | punta
 | Moño
 | 0.05H
 | mechones al lazo + elipsoide del moño + 2 mechones sueltos
 | media
 | —
 | Rapado
 | 0.015H
 | sin mechones; solo base con textura de sombra
 | —
 | —
 | Para coletas y moños, los mechones del cráneo terminan en el punto del lazo en vez de caer con la gravedad: su dirección se interpola hacia el lazo con peso creciente a lo largo de la espina.
5.5 Líneas y sombreado del pelo
Cada mechón tiene su propio identificador de región. Hay línea entre dos mechones solo si uno tapa al otro con un salto de profundidad de al menos 0.01H (línea fina, 0.5 W). Así se leen los mechones sin convertirse en una malla.
Sombra en 3 tonos a partir de las normales, más una sombra proyectada del flequillo sobre la frente (1 tono más oscuro que la piel en sombra).
Anillo de brillo: banda clara alrededor de la coronilla, donde n · h > 0.85 (h es el vector medio entre luz y vista). Su borde inferior se recorta en zigzag siguiendo los mechones, que es el brillo típico del pelo anime.
5.6 Movimiento
Cada mechón es una cadena de 4–6 puntos simulada con Verlet, con la raíz fija a la cabeza. Los mechones largos se retrasan al girar la cabeza o al andar, y se recolocan con amortiguación ζ = 0.4. La colisión con cabeza y hombros de la sección 5.2 se aplica en cada paso.
6. Hombros, brazos y manos
El hombro es el punto donde más se nota el ensamblaje: falta el deltoides, que es el músculo que envuelve la articulación y une el torso con el brazo. Además, al levantar el brazo el omóplato y la clavícula deben subir, y las manos necesitan tamaño y volumen reales.
6.1 Estructura del hombro
Parte
 | Primitiva
 | Posición
 | Tamaño (H)
 | Fusión k
 | Clavícula
 | cono redondeado
 | escotadura del esternón → acromion
 | r 0.035
 | 0.05 con el torso
 | Deltoides
 | elipsoide
 | centro 0.05 hacia fuera y 0.10 por debajo de la articulación del hombro
 | radios (0.14, 0.22, 0.16) en M; ×0.8 en F
 | 0.12 con torso, 0.06 con brazo
 | Inserción del deltoides
 | punta del elipsoide
 | a t = 0.45 del brazo
 | —
 | forma la V en la cara externa
 | Ritmo escapulohumeral: cuando el brazo sube más de 60°, la clavícula y el omóplato acompañan. Por cada 2° de brazo, 1° de omóplato:
\theta_{clavícula} = \tfrac{1}{3}\,\max(0,\ \theta_{abd} - 60^\circ), \qquad \theta_{hombro,real} = \theta_{abd} - \theta_{clavícula}
Esto corrige el saludo actual, donde el brazo sale recto de un hombro que no se mueve.
Axila: al separar el brazo aparecen dos pliegues, el pectoral por delante y el dorsal por detrás. Se añaden dos conos redondeados del torso a t = 0.3 del brazo, con peso de fusión proporcional a la abducción (0 con el brazo pegado, 1 a partir de 60°).
6.2 Sección del brazo
Brazo: sección casi circular (ancho igual a profundidad).
Antebrazo: se aplana hacia la muñeca (ancho/profundidad = 1.4 en la muñeca) y la sección gira con la pronación. Por eso de frente el antebrazo se ve ancho o estrecho según hacia dónde mire la palma.
Codo: elipsoide pequeño del olécranon detrás de la articulación (0.05H), visible al doblar el brazo. Así el codo doblado no se estrecha como una manguera.
6.3 Mano con volumen
Tamaño mínimo: el largo de la mano (muñeca → punta del corazón) debe estar entre 0.65H y 0.80H en anime y realista (aproximadamente la altura de la cara). En las capturas mide menos de la mitad; el validador debe dar error por debajo de 0.60H.
Parte
 | Primitiva
 | Tamaño (en L = largo de mano)
 | Palma
 | caja redondeada, ligeramente arqueada
 | ancho W_palma, largo 0.55, grosor 0.12 (M) / 0.10 (F), radio de esquina 0.05
 | Base del pulgar (eminencia tenar)
 | elipsoide
 | (0.12, 0.20, 0.08) en la base del pulgar; da la forma reconocible de mano
 | Falanges
 | conos redondeados
 | radios de la base matemática, cada una un 10 % más fina que la anterior
 | Yemas
 | elipsoide en la punta
 | 1.1× el radio de la falange distal
 | Nudillos
 | elipsoides pequeños en el dorso
 | 0.035; solo visibles con el puño cerrado
 | Caja redondeada con semitamaños b y radio de esquina r:
q = |p| - b + r, \qquad d = \lVert \max(q, 0) \rVert + \min\big(\max(q_x, q_y, q_z),\ 0\big) - r
Los dedos no se funden entre sí (sección 2.3). Solo se dibuja línea entre dos dedos cuando uno tapa al otro.
6.4 Pose y orientación por defecto
La mano en reposo usa la pose relajada (nunca la abierta) con la muñeca flexionada 10°.
Con el brazo colgando, las palmas miran hacia los muslos y el pulgar hacia delante (pronación de 0° respecto a la anatomía neutra). En las capturas las palmas miran hacia fuera, lo que da el aspecto de garra.
Al andar, la mano sigue relajada; solo se cierra en puño al correr o atacar.
6.5 Nivel de detalle
Largo de la mano en pantalla
 | Representación SDF
 | < 6 px
 | una elipse de piel
 | 6–20 px
 | manopla: palma + un bloque para los cuatro dedos + pulgar
 | 20–60 px
 | dedos agrupados: índice suelto, los otros tres juntos
 | > 60 px
 | mano completa
 | 7. Torso, pelvis, piernas y pies
El torso actual es una caja con la ropa encima y las piernas son tubos. Debe construirse con tres masas que giran por separado (caja torácica, abdomen y pelvis) sobre una columna con curva en S, y las piernas deben tener los músculos que dan su perfil característico: frente recto y parte trasera curva.
7.1 Masas del torso (τ según la base matemática)
Masa
 | Primitiva
 | Centro
 | Radios
 | Nota
 | Caja torácica
 | elipsoide inclinado 8° hacia atrás
 | τ 0.30
 | (0.45 w_pecho, 0.42 L_torso, profundidad de pecho / 2)
 | forma de huevo, más ancha abajo
 | Abdomen
 | cono redondeado
 | τ 0.45 → τ 0.75
 | ancho de cintura / 2
 | pequeña curva baja en la parte delantera
 | Pelvis
 | caja redondeada inclinada 10° (M) / 15° (F) hacia delante
 | τ 0.85
 | (0.42 w_cadera, 0.20 L_torso, 0.45H), radio de esquina 0.12H
 | 
 | Glúteos (×2)
 | elipsoide
 | detrás de la pelvis, τ 0.90
 | (0.20, 0.22, 0.18)H en M; ×1.2 en F
 | 
 | Pectorales o busto
 | los de la base matemática
 | —
 | —
 | fundidos con k 0.10
 | Curva en S: en perfil, la caja torácica se inclina hacia atrás y la pelvis hacia delante, con la cintura como punto de inflexión (lordosis lumbar 8° más marcada en mujer). Un torso vertical y recto es la señal principal de figura rígida.
Contrarrotación: la caja torácica (articulación chest) y la pelvis giran por separado. En reposo y al andar giran en sentidos opuestos (sección 10). Si se mueven como un solo bloque, el cuerpo parece de madera.
7.2 Pierna
Parte
 | Primitiva
 | Posición
 | Tamaño (H)
 | Muslo
 | cono redondeado de sección elíptica
 | cadera → rodilla
 | anchos de la base matemática; profundidad 1.05 × ancho
 | Masa de cadera
 | elipsoide
 | a los lados de la pelvis, altura del trocánter
 | (0.12, 0.18, 0.14) M; (0.16, 0.20, 0.15) F
 | Rótula
 | elipsoide
 | delante de la rodilla
 | 0.06
 | Vasto interno
 | elipsoide
 | interior del muslo, t = 0.8
 | 0.09
 | Gemelo externo
 | elipsoide
 | detrás y fuera, t = 0.25 de la pierna
 | (0.09, 0.20, 0.10)
 | Gemelo interno
 | elipsoide
 | detrás y dentro, t = 0.35
 | (0.10, 0.20, 0.11)
 | Tibia
 | cono redondeado
 | eje delantero de la pierna
 | recto: sin músculos delante
 | Maléolos (×2)
 | elipsoide
 | tobillo; interno 0.03H más alto
 | 0.035
 | La masa de cadera es la que da la curva continua de cadera a muslo en mujer; en hombre es menor y deja una ligera entrada bajo el trocánter.
7.3 Rodilla doblada
Al flexionar la rodilla, la rótula se desplaza hacia delante y abajo siguiendo el fémur, y los gemelos se comprimen contra el muslo (reducir su radio un 10 % a partir de 90°). Las capturas de andar muestran rodillas casi rectas: en la sección 10 se aumenta la flexión.
7.4 Pie con volumen
El pie actual es una elipse rotada. Debe ser una cuña con cuatro masas, aplanada por debajo:
Parte
 | Primitiva
 | Posición (z, y) × L_pie desde el tobillo
 | Tamaño (× L_pie)
 | Talón
 | elipsoide
 | (−0.18, −y_tobillo + 0.08)
 | (0.10, 0.09, 0.12)
 | Empeine
 | cono redondeado
 | tobillo → bola (+0.55, −y_tobillo + 0.06)
 | radio 0.12 → 0.07
 | Bola del pie
 | elipsoide
 | (+0.55, −y_tobillo + 0.05)
 | (0.19, 0.05, 0.08)
 | Dedos
 | caja redondeada
 | (+0.68, −y_tobillo + 0.03)
 | (0.17, 0.03, 0.08), radio 0.03
 | La planta se aplana cortando con el plano del suelo: d = smax(d_pie, −(y − y_suelo)). En reposo las puntas se abren 7° hacia fuera. En anime el pie femenino se reduce a 0.90 del largo de la base matemática.
El empeine baja en línea del tobillo a los dedos: en perfil el pie es un triángulo alargado, nunca un rectángulo ni un remo.
8. Ropa
La ropa no puede ser una forma aparte colocada encima: debe salir del cuerpo como una capa desplazada una holgura, recortada en su zona, y la falda debe apartarse cuando la pierna la empuja. Así la ropa sigue cualquier pose y proporción sin redibujarla.
8.1 Prenda ajustada = cuerpo + holgura
d_{prenda}(p) = d^{*}_{cuerpo}(p) - e(p)
e(p) es la holgura: 0.01–0.02H ajustada, 0.04–0.08H holgada.
d* es el cuerpo con los huecos rellenos: la tela no se mete bajo el busto ni entre los omóplatos, sino que cuelga de los puntos salientes. Se obtiene rehaciendo la unión suave de las primitivas cubiertas con un k mayor (0.15H) antes de restar la holgura.
La prenda se limita a su zona con los parámetros t de cada hueso (por ejemplo, manga corta: brazo de t = 0 a t = 0.35). El borde es un corte con un plano perpendicular al hueso:
d = \operatorname{smax}\big(d_{prenda},\ (t - t_{fin})\,L_{hueso}\big), \qquad k = 0.01H
Manga: pertenece al mismo hueso que el brazo, así que no puede quedar como globo suelto. La manga abullonada es una opción con holgura variable, recogida en el puño:
e(t) = e_0 + A\,\sin\!\left(\pi\,\tfrac{t}{t_{fin}}\right), \qquad A \le 0.05H
Camiseta o blusa: bajo recto perpendicular al torso con una ligera onda; si va por dentro de la falda o el pantalón, se corta en la cintura.
8.2 Falda que reacciona a las piernas
La falda se define en coordenadas cilíndricas alrededor del eje de la pelvis (y altura, φ ángulo). Para cada altura y ángulo, su radio es el mayor de tres:
R(y, \varphi) = \max\Big(R_{corte}(y),\ R_{cuerpo}(y, \varphi) + e,\ R_{piernas}(y, \varphi) + e\Big) + F(y, \varphi)
R_corte: la silueta del patrón (recta, evasé a 15°, capa a 30°) desde la cintura hasta el bajo.
R_cuerpo: la cadera y los glúteos.
R_piernas: el punto más alejado de los muslos en esa dirección. Es lo que evita que el muslo atraviese la falda al andar: la falda se abomba en la dirección de la pierna adelantada.
F: pliegues, que aumentan hacia el bajo:
F(y, \varphi) = A_f\,\operatorname{smoothstep}(y_{cintura},\ y_{bajo},\ y)\,\sin(n_f\,\varphi + \phi_0)
con n_f = 8–14 pliegues y A_f = 0.02–0.04H; en falda tableada se usa una onda triangular en lugar del seno.
La falda es una cáscara con grosor 0.01H, cortada arriba en la cintura y abajo en el bajo, así que desde abajo o al saltar se ve su interior (1 tono más oscuro). El bajo se mueve con retraso respecto a la pelvis (muelle de la base matemática, ζ = 0.3), para que la falda se balancee al andar y suba ligeramente al saltar.
8.3 Pantalón
Cada pernera es una capa sobre muslo y pierna, con holgura creciente hacia abajo: en corte recto, el radio en el tobillo iguala al de la rodilla.
Entrepierna: las dos perneras se funden con smin (k = 0.08H) hasta 0.05H por debajo de la entrepierna anatómica. Así desaparecen los dos tubos paralelos.
Cinturón o pretina: anillo a la altura de la cresta ilíaca, 0.06H de alto.
Pliegues de compresión detrás de la rodilla y en la ingle cuando se flexionan: desplazamiento sinusoidal en el lado interior de la articulación.
\delta(s) = A\,\min\!\left(1,\ \tfrac{\theta_{flex}}{90^\circ}\right)\,\sin\!\left(\tfrac{2\pi s}{\lambda}\right), \qquad A = 0.015H,\ \lambda = 0.12H
8.4 Calzado
Capa sobre el pie con holgura 0.02H, más una suela plana de 0.03H (0.06H en tacón, con el talón elevado). La puntera es una caja redondeada que redondea los dedos. El calzado es otro material, con su propia línea de cambio de material en el borde del tobillo.
8.5 Estampados
Rayas, cuadros o lunares se proyectan con la coordenada t del hueso y el ángulo alrededor de él, que están en el G-buffer. Así el estampado sigue la forma y la pose sin deformarse.
9. Sombreado
Los triángulos negros de la falda y el pantalón aparecen porque la sombra se calcula por polígono plano y se cuantiza sin suavizar. Con las normales continuas de la SDF, un umbral suavizado, sombras proyectadas y un tono de sombra de color (no negro), el resultado pasa a ser el sombreado cel típico del anime.
9.1 Iluminación cel
Luz principal fija (arriba, a la izquierda y delante) con iluminación envolvente, que reduce la zona en sombra:
I = \frac{n \cdot \hat l + w}{1 + w}, \qquad w = 0.3, \qquad \hat l = \operatorname{norm}(-0.5,\ 0.8,\ 0.3)
Estilo
 | Tonos
 | Umbrales sobre I
 | VN anime
 | 2 (luz, sombra) + sombra profunda solo en oclusión
 | 0.45
 | VN pintado
 | 3
 | 0.25 y 0.60
 | Pixel art
 | 3
 | 0.30 y 0.65, sin suavizado
 | 9.2 Formas de sombra limpias
Antes de aplicar el umbral, se suaviza I con un desenfoque gaussiano (σ = 0.01H) dentro de cada región de material, sin mezclar entre regiones. Los bordes de sombra quedan como curvas limpias.
Se eliminan las manchas de sombra o de luz con área menor que 0.002H² (apertura morfológica). Así desaparecen los brillos en manchas de la blusa.
La sombra nunca es negra: es el tono k = −1 de la rampa del material. La sombra profunda (k = −2) solo aparece donde hay oclusión ambiental.
9.3 Sombras proyectadas
Se calculan con la propia SDF lanzando un rayo desde el punto hacia la luz (sombra suave de trazado de esferas) y se aplica el mismo umbral:
s = \min_i \left( \frac{\kappa\, d(p + \hat l\, t_i)}{t_i} \right), \qquad \kappa = 8
Sombras que el anime siempre dibuja y que ahora salen solas: el flequillo sobre la frente, la mandíbula sobre el cuello, la manga sobre el brazo, el busto sobre el abdomen y la falda sobre los muslos.
Oclusión ambiental para la sombra profunda (en axilas, entrepierna y entre dedos), con 5 muestras a lo largo de la normal:
AO = 1 - \sum_{i=1}^{5} \frac{1}{2^i}\,\big(i\,\delta - d(p + n\,i\,\delta)\big), \qquad \delta = 0.02H
9.4 Color de sombra por material
Material
 | Desplazamiento del tono en sombra
 | Por qué
 | Piel
 | hacia rojo-rosa (matiz 20–30°), croma +10 %
 | la luz se dispersa bajo la piel; una sombra de piel gris o azul parece enfermiza
 | Pelo
 | hacia frío (regla general de la base matemática)
 | 
 | Ropa
 | hacia frío
 | 
 | Negro o gris oscuro (falda, pantalón)
 | luz con +0.12 de L y matiz azulado; sombra con L mínimo 0.18
 | si no, la sombra y la línea se confunden en un bloque negro
 | 9.5 Brillos
Luz de contorno (opcional en VN): banda fina en el borde del lado contrario a la luz, donde (1 − n·v)^4 > 0.6.
Brillos especulares: solo en pelo (anillo), ojos y materiales brillantes (cuero, metal). Nunca en ropa de algodón ni en piel mate.
10. Poses y animación
Las poses actuales son rectas y simétricas: A-pose como reposo, brazos horizontales al andar y saludo con el brazo vertical. Las poses deben definirse con poses clave con ángulos concretos (no solo con senos) y cumplir cuatro principios: línea de acción, asimetría, anticipación y acción superpuesta.
10.1 Reposo
Articulación
 | Valor
 | Nota
 | Hombros (abducción)
 | 6–8°
 | la A-pose de 20° es solo para construir y validar
 | Hombros (caída)
 | clavícula −3°
 | hombros relajados, no encogidos
 | Codo
 | 10–15°
 | nunca completamente recto
 | Mano
 | pose relajada, palma hacia el muslo
 | sección 6.4
 | Pelvis
 | contrapposto de la base matemática
 | peso en una pierna
 | Caja torácica
 | giro 4° contrario a la pelvis
 | contrarrotación
 | Cabeza
 | ladeo 3°, giro 5° hacia la cámara
 | rompe la simetría
 | Separación de pies
 | 0.30H (M), 0.20H (F)
 | puntas abiertas 7°
 | 10.2 Andar por poses clave
El ciclo de la base matemática se sustituye por cuatro poses clave por paso (la segunda mitad es el espejo), interpoladas con Catmull-Rom. Valores para la pierna izquierda y el brazo derecho adelantados:
Pose
 | Cadera I
 | Rodilla I
 | Tobillo I
 | Cadera D
 | Rodilla D
 | Hombro D
 | Codo D
 | Altura pelvis
 | Contacto
 | +25°
 | 5°
 | −15° (talón)
 | −15°
 | 10°
 | +18°
 | 25°
 | media
 | Bajada
 | +20°
 | 20°
 | 0°
 | −10°
 | 30°
 | +12°
 | 20°
 | mínima (−0.03H)
 | Paso
 | 0°
 | 10°
 | 0°
 | +5°
 | 60°
 | 0°
 | 15°
 | máxima (+0.02H)
 | Subida
 | −10°
 | 5°
 | +20° (despegue)
 | +20°
 | 40°
 | −10°
 | 15°
 | media
 | Los brazos cuelgan del hombro: el hombro nunca supera 25° hacia delante al andar, y el codo se dobla más cuando el brazo va adelantado. Esto elimina los brazos de zombi.
La cabeza se estabiliza: compensa la mitad del giro de los hombros y mantiene la mirada al frente.
El pelo y la falda siguen con retraso (muelles de las secciones 5.6 y 8.2).
10.3 Otras animaciones
Animación
 | Poses clave
 | Valores esenciales
 | Correr
 | contacto, bajada, paso, vuelo
 | tronco inclinado 10–15° hacia delante; rodilla de la pierna que avanza hasta 100°; codos fijos a 80–90°; brazos ±35°; manos en puño suelto
 | Saltar
 | anticipación, impulso, aire, caída, recuperación
 | agacharse: rodillas 60°, cadera 50°, brazos atrás; impulso: todo extendido y brazos arriba; aire: rodillas 40°; caída: absorber con rodillas 50°
 | Saludar
 | preparación, saludo A, saludo B
 | hombro 110° (no 180°); codo 90–110° con antebrazo vertical; palma al frente; muñeca ±20° a 2 Hz; cabeza ladeada 5° hacia el lado del saludo; el otro brazo relajado
 | Atacar
 | anticipación, golpe, continuación, recuperación
 | frames 2-1-2-3; en el golpe el tronco gira 30°, el pie delantero avanza y el brazo se extiende con el codo a 10°; el peso pasa a la pierna delantera
 | Hablar
 | ciclos de visemas
 | cabeza con asentimientos de 2–3° y cejas que suben en las frases acentuadas
 | 10.4 Poses de visual novel por objetivos de IK
Las poses de gesto se definen colocando la mano en un punto del propio cuerpo y resolviendo el brazo con IK (base matemática, sección 10.2). Así funcionan con cualquier proporción.
Pose
 | Objetivo de la muñeca
 | Orientación de la mano
 | Mano en la cadera
 | cresta ilíaca + 0.10H hacia fuera
 | dorso hacia delante, dedos hacia atrás
 | Mano en el pecho
 | esternón, τ 0.30, + 0.10H hacia delante
 | palma contra el pecho
 | Pensativo
 | barbilla − 0.25H en vertical
 | puño suelto bajo la barbilla
 | Brazos cruzados
 | codo contrario + 0.05H
 | manos bajo el brazo opuesto
 | Señalar
 | 1.2 × largo del brazo hacia el objetivo
 | pose "señalar"
 | Tapar la boca (sorpresa)
 | boca + 0.08H hacia delante
 | palma hacia la cara, dedos juntos
 | 10.5 Principios que el validador puede comprobar
Línea de acción: la curva que une cabeza, columna y pierna de apoyo debe tener una sola curvatura (C) o una S suave; una línea recta vertical es una pose rígida (aviso).
Asimetría: ningún par de articulaciones izquierda-derecha con ángulos idénticos en una pose de reposo o de gesto (aviso).
Silueta legible: la pose, pintada como una silueta negra, debe mostrar separación entre brazos y torso en al menos un lado (aviso).
Espaciado: en las transiciones, los frames se agrupan cerca de las poses clave (entrada y salida suaves), salvo en golpes y aterrizajes.
11. Chibi y pixel art
Un chibi no es un adulto encogido: tiene su propia anatomía simplificada. Y el pixel art no es una imagen suave reducida: se renderiza directamente en la rejilla de píxeles, con rasgos de la cara diseñados píxel a píxel.
11.1 Canon chibi (2–2.5 cabezas)
Medida
 | Valor (en H de la cabeza chibi)
 | Nota
 | Cabeza
 | 1.0 (40–50 % de la altura)
 | cráneo más ancho: W = 0.95H
 | Cuello
 | 0.05
 | casi oculto, pero existe
 | Tronco
 | 0.55
 | una sola masa en forma de pera, sin cintura marcada
 | Piernas
 | 0.45–0.60
 | nunca menos de 0.40H: en las capturas desaparecen
 | Hombros / cadera
 | 0.80 / 0.75
 | 
 | Brazos
 | llegan a la entrepierna
 | conos redondeados gruesos, sin codo visible
 | Mano
 | 0.25
 | manopla con pulgar
 | Pie
 | largo 0.35, alto 0.15
 | bola redondeada, siempre visible
 | Ojos
 | 30 % del ancho de cara, centro en v 0.62
 | iris grande, 2 brillos
 | Nariz / boca
 | un punto / línea de 0.15 W
 | 
 | Entre 2.5 y 5 cabezas no se escala el adulto: se interpola entre este canon y el de 5 cabezas con u = (N − 2.5) / 2.5. En chibi, hombre y mujer se distinguen por pelo, pestañas, ropa y una ligera diferencia de cadera; el validador comprueba las señales visibles en lugar de SHR y WHR.
11.2 Render de pixel art
Supermuestreo por mayoría: cada píxel final se evalúa con 4×4 rayos y toma el material más frecuente (no el promedio de color). Evita los bordes difusos de las capturas.
Cuantización: la iluminación se convierte en 3 tonos por material con los umbrales de la sección 9.1. Paleta total típica: 16–24 colores por personaje.
Línea de 1 px desde el G-buffer (sección 3) con contorno selectivo: en el lado iluminado, la línea usa el tono de sombra del material en lugar del tono de línea.
Limpieza: las reglas de rasterizado de la base matemática (huérfanos, esquinas dobles, escalones regulares).
11.3 Cara en pixel art: sellos, no vectores
Por debajo de 16 px de cabeza, los ojos y la boca no se proyectan: se colocan sellos diseñados píxel a píxel, en la posición proyectada de la línea de ojos.
Alto de la cabeza
 | Ojo
 | Boca
 | Variantes por expresión
 | 6–8 px
 | 1×1 o 1×2
 | ninguna o 1 px
 | cerrado (línea), abierto
 | 9–12 px
 | 2×2 o 2×3 con 1 px de brillo
 | 1–2 px
 | neutral, feliz, triste, enfadado, sorprendido
 | 13–16 px
 | 2×3 o 3×4, iris + brillo + párpado
 | 2–3 px
 | todas las de la sección 5.7 de la base matemática
 | Los sellos son datos pequeños (matrices de índices de color) que se guardan en canon. Los diseña una vez cualquiera siguiendo la tabla; no hace falta saber dibujar para 4×4 píxeles.
11.4 Estabilidad entre frames
Se redondea solo la raíz (base matemática, sección 10.6).
Histéresis de cobertura: si un píxel está entre el 40 % y el 60 % de cobertura, conserva el material del frame anterior. Así los bordes no parpadean con movimientos de medio píxel.
Los sellos de la cara se colocan en posiciones enteras relativas a la cabeza, nunca redondeadas por separado.
12. Criterios de aceptación y orden de trabajo
Cada mejora se da por terminada solo si pasa una prueba medible sobre una hoja de prueba fija: los 4 estilos × 2 sexos, en 6 vistas y con los fotogramas clave de reposo, andar, saludar y saltar. Es la misma hoja que las capturas actuales, para poder comparar antes y después.
12.1 Pruebas automáticas
Problema
 | Prueba
 | Aprobado si
 | Costuras de piezas
 | contar píxeles de línea en una franja de 0.1H alrededor de hombro, cadera y cuello, con el brazo sin tapar el torso
 | 0 píxeles
 | Cara como calcomanía
 | inflexiones del perfil de la cabeza a 90°
 | ≥ 5 (sección 4.6)
 | Cuello
 | alto visible entre barbilla y hombros en vista frontal
 | ≥ 0.3H (adulto)
 | Pelo casco
 | distancia media entre la superficie del pelo y el cráneo en la coronilla
 | ≥ τ de la receta; ≥ 5 puntas visibles en el flequillo
 | Manos
 | largo de la mano
 | 0.65–0.80H (adulto)
 | Pies
 | largo del pie y forma en perfil
 | dentro de la tabla de 7.4; alto en el tobillo > 2 × alto en los dedos
 | Falda atravesada
 | píxeles de pierna por delante de la falda en la zona que cubre la falda, en todos los frames de andar y correr
 | 0 píxeles
 | Manchas de sombra
 | regiones de sombra o luz con área < 0.002H²
 | 0 regiones
 | Sombra negra
 | L mínimo en rellenos de sombra
 | ≥ 0.18
 | Pose rígida
 | línea de acción y asimetría (10.5)
 | sin avisos en reposo y gestos
 | Chibi aplastado
 | largo de pierna y pie visible
 | pierna ≥ 0.40H; pie ≥ 4 px en 32 px
 | Pixel art borroso
 | colores distintos en el sprite
 | ≤ 24 y sin píxeles con alfa parcial
 | 12.2 Rendimiento
VN a 1200 × 2000: menos de 200 ms por fotograma en una gráfica integrada (WebGL).
Pixel art de 64 px: menos de 20 ms por fotograma en CPU.
Si no se alcanza, se reduce el número de primitivas activas por píxel con las cajas envolventes de cada hueso antes de bajar la calidad.
12.3 Orden de trabajo
SDF del cuerpo desnudo (secciones 2, 6, 7) con render en CPU a baja resolución y vista del G-buffer (profundidad, normales, materiales) para depurar. Conserva el motor actual como "clásico" para comparar.
Línea (sección 3) y sombreado (sección 9). Aquí desaparecen las costuras y los triángulos negros.
Render WebGL con el mismo código de SDF traducido a GLSL.
Cabeza y cara (sección 4).
Pelo (sección 5).
Ropa (sección 8), empezando por camiseta y pantalón y después la falda.
Poses y animación (sección 10).
Chibi y pixel art (sección 11).
12.4 Cómo pedirlo a Claude Code
Guarda este documento junto a la base matemática en el repositorio y pide un paso cada vez, con sus pruebas. Por ejemplo:
Implementa el paso 1 de docs/correccion-visual.md: la SDF del cuerpo desnudo con las primitivas y uniones suaves de las secciones 2, 6 y 7, usando el esqueleto actual. Añade una vista de depuración del G-buffer. Escribe primero las pruebas de costuras, manos y pies de la tabla 12.1 y no des el paso por terminado hasta que pasen en la hoja de prueba. Mantén el motor actual como "clásico".
Después de cada paso, pídele que genere de nuevo la hoja de prueba y compárala con las capturas anteriores.

[]
