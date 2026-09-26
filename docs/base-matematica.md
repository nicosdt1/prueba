<!-- Texto extraído de Sistema_anatomico_para_sprites_2D.docx (el documento original está en esta misma carpeta). -->

Sistema anatómico para sprites 2D: base matemática
Sep 26, 2026 · @Nicolas
1. Objetivo y arquitectura
El sistema garantiza que cualquier pieza (cabeza, torso, mano, pierna) se coloque en su sitio y sea anatómicamente coherente, porque nadie dibuja libremente: todo se mide contra un esqueleto canónico calculado a partir de parámetros. Las piezas son "ropa" que se ajusta a ese esqueleto, nunca al revés.
El flujo tiene cuatro capas, cada una solo lee de la anterior:
Parámetros del personaje: sexo s, complexión b, estilo (número de cabezas N), altura en píxeles, vista.
Esqueleto canónico: los parámetros producen puntos anatómicos (landmarks) y articulaciones con fórmulas cerradas. Es la única fuente de verdad sobre dónde está cada cosa.
Piezas (assets): cada pieza declara sus anclajes en su propio espacio y se transforma para encajar en las articulaciones.
Rig y animación: se rotan articulaciones (FK/IK); las piezas las siguen automáticamente.
Principios de diseño:
Todo en unidades relativas, nunca en píxeles, hasta el render final.
Hombre y mujer son extremos de un mismo parámetro continuo s ∈ [0,1] (0 = masculino, 1 = femenino). Así una sola tabla de datos genera ambos, y la diferencia es medible.
Esqueleto en 3D, render en 2D: guardar z permite generar vistas frontal, 3/4, perfil y espalda coherentes.
Validación obligatoria: una pieza que no cumpla las proporciones declaradas se rechaza al cargar, así se evita el efecto "dibujo de Paint".
2. Sistema de coordenadas
La unidad de medida es H = altura de la cabeza (de la coronilla a la barbilla). Todas las medidas del cuerpo se expresan como múltiplos de H, como hacen los canones clásicos de dibujo.
Espacio modelo (3D, diestro):
Origen O = (0,0,0) en el suelo, entre los dos pies.
+Y hacia arriba, +X hacia la izquierda del personaje (la derecha del espectador en vista frontal), +Z hacia el espectador.
Altura total T = N · H, donde N es el número de cabezas del estilo.
Espacio de pantalla (píxeles): Y crece hacia abajo. Con un sprite de alto P píxeles:
\text{ppu} = \frac{P - m_t - m_b}{N \cdot H}
x_{px} = c_x + \text{ppu}\cdot x', \qquad y_{px} = (P - m_b) - \text{ppu}\cdot y'
donde ppu son píxeles por unidad, m_t y m_b los márgenes superior e inferior, c_x el centro horizontal del lienzo y (x', y') el punto ya proyectado a 2D (sección 11).
Regla de simetría: cada punto lateral se define una sola vez para el lado izquierdo (L) y el derecho se obtiene espejando: P_R = (−x, y, z). En pixel art, usar anchos de lienzo impares para que exista una columna central exacta.
3. Canon de proporciones y dimorfismo
La altura se reparte en tres tramos fijos: cabeza (H), tronco (barbilla → entrepierna) y pierna (entrepierna → suelo). El estilo solo decide dos números: cuántas cabezas mide el personaje (N) y qué fracción de la altura son piernas (λ). Con eso todos los estilos comparten la misma anatomía interna.
3.1 Estilos
Estilo
N (cabezas)
λ (pierna / altura)
Uso
Realista
7.5
0.50
Retratos, VN realista
Heroico
8.0
0.50
Acción, adultos idealizados
Anime / VN
7.0
0.53
Visual novel estándar
Shojo estilizado
7.5
0.55
Figuras esbeltas
Pixel 64 px
5.0
0.42
Sprites detallados
Pixel 32 px
4.0
0.38
RPG clásico
Pixel 16 px / chibi
2.5
0.28
Sprites mínimos, SD
T = N\,H, \qquad L_{leg} = \lambda T, \qquad L_{torso} = T - H - L_{leg}
Restricción de validez: L_torso ≥ 0.8 H. Si no se cumple, el estilo es imposible y se rechaza.
3.2 Landmarks verticales
Cada landmark tiene una fracción dentro de su tramo: τ en el tronco (0 = barbilla, 1 = entrepierna) y η en la pierna (0 = entrepierna, 1 = suelo). Valores medidos sobre el canon de 8 cabezas.
y_{tronco}(\tau) = T - H - \tau\,L_{torso}, \qquad y_{pierna}(\eta) = (1-\eta)\,L_{leg}
Landmark
Tramo
Hombre
Mujer
Hombros (acromion)
τ
0.11
0.12
Axila
τ
0.27
0.27
Línea del pezón
τ
0.33
0.37
Bajo pecho
τ
0.42
0.45
Cintura (más estrecha)
τ
0.60
0.55
Ombligo
τ
0.67
0.66
Cresta ilíaca
τ
0.72
0.70
Cadera (más ancha)
τ
0.92
0.90
Mitad del muslo
η
0.25
0.25
Rodilla (centro)
η
0.50
0.50
Pantorrilla (más ancha)
η
0.64
0.64
Tobillo
η
0.94
0.95
3.3 Anchos (vista frontal, en H)
Medida
Hombre (s=0)
Mujer (s=1)
Sensibilidad a complexión k
Cuello
0.55
0.42
0.10
Hombros (deltoides a deltoides)
2.10
1.70
0.08
Pecho / axila
1.70
1.45
0.12
Cintura
1.35
1.15
0.30
Cadera
1.50
1.75
0.18
Muslo (arriba, cada uno)
0.80
0.85
0.25
Rodilla
0.50
0.45
0.08
Pantorrilla
0.55
0.50
0.15
Tobillo
0.30
0.25
0.05
Brazo superior
0.45
0.35
0.20
Antebrazo
0.42
0.32
0.15
Muñeca
0.28
0.22
0.05
3.4 Parámetros continuos
s ∈ [0,1]: sexo morfológico (0 hombre, 1 mujer).
b ∈ [−1,1]: complexión (delgado → robusto). Afecta sobre todo a tejidos blandos, poco al hueso.
e ∈ [0.5, 1.5]: exageración del dimorfismo (1 = realista, >1 = estilo anime o cómic).
w_s = w_M + s\,(w_F - w_M), \qquad \bar w = \tfrac{1}{2}(w_M + w_F)
w_{final} = \big(\bar w + e\,(w_s - \bar w)\big)\,(1 + k\,b)
Las fracciones verticales (τ, η) se interpolan igual, pero sin b.
3.5 Cómo se garantiza que se distinga hombre de mujer
Dos índices medibles sobre el esqueleto final, calculados siempre y exigidos por el validador:
SHR = \frac{w_{hombros}}{w_{cadera}}, \qquad WHR = \frac{w_{cintura}}{w_{cadera}}
Índice
Hombre (s=0, e=1)
Mujer (s=1, e=1)
Umbral para clasificarse
SHR
1.40
0.97
Hombre ≥ 1.20 · Mujer ≤ 1.10
WHR
0.90
0.66
Hombre ≥ 0.80 · Mujer ≤ 0.75
Si un personaje marcado como hombre o mujer no cumple los umbrales, el editor avisa. Los valores intermedios de s son válidos (personajes andróginos), pero se etiquetan como tal. En sprites pequeños, donde el cuerpo mide pocos píxeles, la diferencia se apoya además en rasgos de alto contraste: silueta de cadera, pecho, pelo y forma de mandíbula (sección 11).
4. Esqueleto canónico
El esqueleto tiene 6 articulaciones centrales y 24 por lado (15 de ellas son dedos), y cada longitud de hueso se deduce de los landmarks, no se escribe a mano. Así, al cambiar N, λ o s, brazos y piernas siguen cayendo en su sitio (el codo a la altura de la cintura, la muñeca a la de la entrepierna).
4.1 Jerarquía
pelvis (raíz)├─ spine ─ chest ─ neck ─ head ─ head_top│            └─ clavicle_L ─ shoulder_L ─ elbow_L ─ wrist_L ─ hand_L ─ dedos (15)│            └─ clavicle_R ─ … (espejo)├─ hip_L ─ knee_L ─ ankle_L ─ toe_L└─ hip_R ─ … (espejo)
4.2 Posición en reposo (lado izquierdo, y(·) según sección 3.2)
Articulación
x
y
z
pelvis
0
y(τ=0.85)
0
spine
0
y(τ=0.60)
−0.05H
chest
0
y(τ=0.35)
−0.05H
neck
0
y(τ=0.08)
−0.08H
head (pivote, altura del lóbulo)
0
T − 0.85H
−0.05H
head_top
0
T
0
clavicle_L
0.10H
y(τ=0.10)
0
shoulder_L
0.5·w_hombros − 0.5·w_brazo
y(τ_hombros)
0
hip_L
0.25·w_cadera
y(τ=0.93)
0
knee_L
c_k · x_hip
y(η=0.50)
+0.03H
ankle_L
0.95 · x_knee
y(η_tobillo)
0
toe_L
x_ankle
0
+0.75·L_pie
c_k es la convergencia de rodillas (ángulo Q): 0.75 en hombre y 0.60 en mujer. La pelvis femenina más ancha y las rodillas más juntas son una de las señales más legibles del sexo en sprites.
4.3 Longitud de los huesos
L_{brazo} = (\tau_{cintura} - \tau_{hombros})\,L_{torso}, \qquad L_{antebrazo} = (1 - \tau_{cintura})\,L_{torso}
L_{mano} = 0.25\,L_{torso}, \qquad L_{pie} = \kappa\,L_{leg}, \quad \kappa_M = 0.27,\ \kappa_F = 0.25
Los huesos de la pierna son la distancia entre sus articulaciones (|knee − hip|, |ankle − knee|). En el canon de 8 cabezas esto da: brazo 1.47H, antebrazo 1.20H, mano 0.75H y pie 1.08H, que coinciden con las medidas clásicas.
La pose de reposo es una A-pose: brazos abiertos 20° desde la vertical. Así ninguna pieza del brazo se solapa con el torso al crear o validar assets.
4.4 Límites articulares (grados, desde la pose de reposo)
Articulación
Eje
Mínimo
Máximo
Nota
head
inclinar (pitch)
−50
60
+ = mirar abajo
head
girar (yaw)
−70
70
activa la vista 3/4 a partir de ±20°
head
ladear (roll)
−40
40

neck
pitch
−30
40
reparte el 40 % del giro de la cabeza
chest + spine
flexión
−30
45
repartir 50/50 entre ambas
shoulder
abducción
−30
180

shoulder
flexión
−50
180

elbow
flexión
0
145
solo se dobla hacia delante
wrist
flexión
−70
80

hip
flexión
−30
120

hip
abducción
−25
45

knee
flexión
0
140
solo se dobla hacia atrás
ankle
flexión
−20
50

Cualquier rotación se limita con θ = clamp(θ, min, max) antes de calcular posiciones. Esto elimina de raíz codos y rodillas doblados al revés.
5. Cabeza y cara
La cabeza se construye en su propio espacio normalizado y los rasgos se colocan sobre líneas guía fijas, igual que en el método Loomis. Eso hace imposible que un ojo o una boca caigan en un sitio arbitrario.
5.1 Espacio de la cabeza
v ∈ [0,1]: vertical, 0 = coronilla, 1 = barbilla (en unidades de H).
u: horizontal, 0 = eje central, en unidades de H. El ancho del cráneo es W.
W: hombre 0.72H, mujer 0.70H (realista); anime: hombre 0.74H, mujer 0.78H (cara más redonda).
5.2 Líneas guía verticales
Línea
Realista (v)
Anime / VN (v)
Chibi (v)
Nacimiento del pelo
0.20
0.20
0.25
Cejas
0.44
0.47
0.52
Centro de los ojos
0.50
0.56
0.62
Base de la nariz
0.73
0.72
0.76
Boca
0.82
0.81
0.84
Barbilla
1.00
1.00
1.00
Oreja (arriba → abajo)
0.44 → 0.73
0.47 → 0.72
0.52 → 0.76
En el estilo realista la cara se divide en tres tercios iguales: pelo → cejas → base de nariz → barbilla. En anime y chibi los ojos bajan y crecen, y el tercio inferior se comprime.
5.3 Medidas horizontales
Todo se mide en anchos de ojo e_w:
e_w = \alpha\,W, \qquad \alpha_{realista} = 0.20,\ \alpha_{anime} = 0.24,\ \alpha_{chibi} = 0.30
Rasgo
Fórmula
Nota
Separación entre ojos (lagrimales)
1.0 · e_w
regla de los cinco ojos
Centro de cada ojo
u = ± e_w

Alto del ojo
realista 0.40 e_w · anime 0.9 e_w (M) / 1.1 e_w (F)

Ancho de nariz
1.0 e_w (M: 1.05, F: 0.9)
en anime se dibuja solo la sombra de la punta
Ancho de boca
1.6 e_w (M) · 1.4 e_w (F)
comisuras bajo las pupilas en realista
Cuello
ver sección 3.3
centrado en u = 0
5.4 Contorno paramétrico
El contorno frontal es una curva Catmull-Rom centrípeta cerrada (α = 0.5) que pasa por puntos de control. Solo se define el lado izquierdo; el derecho se espeja. Los puntos se interpolan con s como en la sección 3.4.
Punto
Hombre (u/W, v)
Mujer (u/W, v)
Coronilla
(0.00, 0.00)
(0.00, 0.00)
Cráneo superior
(0.40, 0.08)
(0.40, 0.08)
Sien
(0.50, 0.35)
(0.50, 0.35)
Pómulo
(0.49, 0.55)
(0.48, 0.55)
Inicio de mandíbula
(0.47, 0.68)
(0.44, 0.68)
Ángulo mandibular (gonion)
(0.42, 0.84)
(0.36, 0.80)
Lateral del mentón
(0.18, 0.98)
(0.12, 0.96)
Mentón plano
(0.10, 1.00)
— (se omite: barbilla en punta)
Barbilla
(0.00, 1.00)
(0.00, 1.00)
Para el tramo P1 → P2 entre cuatro puntos consecutivos:
t_{i+1} = t_i + \lVert P_{i+1} - P_i \rVert^{\alpha}, \qquad \alpha = 0.5
C(t) = \frac{t_2 - t}{t_2 - t_1} B_1 + \frac{t - t_1}{t_2 - t_1} B_2
con B_1, B_2 las interpolaciones intermedias estándar de Barry-Goldman. La variante centrípeta evita bucles y picos en la mandíbula, que es justo lo que da el aspecto de "dibujo de Paint".
5.5 Diferencias de sexo en la cara
Rasgo
Hombre (s=0)
Mujer (s=1)
Mandíbula
ángulo marcado, gonion ancho
curva suave, gonion estrecho
Mentón
plano y ancho
en punta y estrecho
Arco superciliar
prominente; cejas bajas y rectas, grosor 0.10 e_w
cejas +0.02H más altas, arqueadas, grosor 0.06 e_w
Ojos
factor de tamaño 1.0
factor 1.15; pestañas en el párpado superior
Labios
finos (alto 0.12 e_w)
llenos (alto 0.20 e_w), color diferenciado
Cuello
ancho, nuez visible en v≈ 1.25
fino, sin nuez
Nariz
puente marcado
puente suave, punta pequeña
5.6 Rotación de la cabeza (vistas 3/4 y perfil)
El cráneo se modela como un elipsoide con centro c = (0, 0.5H, 0) en espacio de cabeza y radios:
R_x = \tfrac{W}{2}, \qquad R_y = 0.5H, \qquad R_z = 0.42H
Cada rasgo frontal (u, v) se levanta a 3D sobre la superficie del elipsoide y recibe un relieve d propio (nariz +0.10H, labios +0.03H, ojos −0.02H):
z = R_z\sqrt{1 - \left(\tfrac{u}{R_x}\right)^2 - \left(\tfrac{v - 0.5}{R_y/H}\right)^2} + d
Se gira con giro θ (yaw), inclinación ψ (pitch) y ladeo ρ (roll), y se proyecta en ortográfica (se descarta z):
p' = \mathbf{Rot}_z(\rho)\,\mathbf{Rot}_x(\psi)\,\mathbf{Rot}_y(\theta)\,(p - c) + c
Visibilidad: un rasgo se dibuja si la componente z de su normal rotada es mayor que 0. Si no, queda detrás (por ejemplo, el ojo lejano en perfil).
Escorzo: el ancho de un rasgo se multiplica por n_z (la componente z de la normal), así el ojo lejano en 3/4 se estrecha solo.
Silueta: el contorno de la cabeza no se calcula del elipsoide (quedaría como un huevo), sino que se guardan tres contornos de referencia, frontal (0°), 3/4 (45°) y perfil (90°), y se interpolan punto a punto según |θ|. Los tres deben tener el mismo número de puntos.
Puntos de referencia del perfil (90°) en (z/H, v), con z hacia delante: coronilla (0, 0), frente (0.38, 0.25), arco superciliar (0.42, 0.44), puente de nariz (0.40, 0.50), punta de nariz (0.52, 0.70), base de nariz (0.44, 0.73), labio superior (0.44, 0.79), labio inferior (0.42, 0.84), barbilla (0.38, 0.97), bajo la barbilla (0.25, 1.0), ángulo mandibular (−0.05, 0.84), nuca (−0.40, 0.60) y occipital (−0.45, 0.35). En mujer: nariz −0.03 en z, arco superciliar −0.03 en z, barbilla −0.02.
5.7 Expresiones
Cada expresión es una suma ponderada de desplazamientos de los puntos de control de ojos, cejas y boca (blendshapes 2D):
P = P_0 + \sum_i w_i\,\Delta_i, \qquad w_i \in [0,1]
Canal
Qué mueve
brow_up_L / R
sube la ceja 0.05H
brow_frown
junta y baja el extremo interior de las cejas
brow_sad
sube el extremo interior de las cejas
eye_open_L / R
apertura del párpado (0 = cerrado)
eye_smile
curva el párpado inferior hacia arriba
mouth_open
separa los labios verticalmente
mouth_smile / frown
sube o baja las comisuras
mouth_wide
ensancha la boca
blush
opacidad de la capa de rubor
Expresión
Pesos
Neutral
todo 0, eye_open 1
Feliz
mouth_smile 0.8, eye_smile 0.5, brow_up 0.2
Triste
brow_sad 0.9, mouth_frown 0.5, eye_open 0.7
Enfadado
brow_frown 1.0, mouth_frown 0.4, eye_open 0.8
Sorprendido
brow_up 1.0, eye_open 1.2, mouth_open 0.7
Avergonzado
blush 1.0, eye_open 0.6, mouth_smile 0.2
Parpadeo: eye_open baja de 1 a 0 y vuelve en 120–160 ms, con intervalo aleatorio de 2–6 s. Para lip-sync en visual novels bastan 6 visemas (A, I, U, E, O y cerrado), cada uno definido con los canales de boca.
6. Torso y busto
El torso no se dibuja: su silueta se calcula uniendo los anchos de la sección 3.3 con una curva que nunca se pasa de los valores medidos. El pecho masculino y el femenino son módulos paramétricos que se añaden encima con límites anatómicos.
6.1 Silueta del torso
Se toman los pares (altura, ancho) de cada landmark, del cuello a la entrepierna: cuello, hombros, axila, pecho, cintura, cresta ilíaca, cadera y entrepierna. Se interpolan con Hermite cúbico monótono (Fritsch–Carlson), que no produce bultos ni ondulaciones entre puntos:
m_k = \frac{w_{k+1} - w_k}{y_{k+1} - y_k}, \qquad \text{si } m_{k-1}\,m_k \le 0 \Rightarrow w'_k = 0
\text{si } \left(\tfrac{w'_k}{m_k}\right)^2 + \left(\tfrac{w'_{k+1}}{m_k}\right)^2 > 9 \Rightarrow \text{escalar ambas tangentes por } \tfrac{3}{\sqrt{\cdot}}
El contorno final son los puntos (±w(y)/2, y). La caída de hombros va del cuello al acromion con pendiente de 15° en hombre y 20° en mujer.
Profundidad (para vista de perfil y 3/4):
Nivel
Hombre (H)
Mujer (H)
Pecho (sin busto)
0.95
0.88
Cintura
0.80
0.75
Cadera y glúteos
0.95
1.05
En perfil, el glúteo femenino sobresale más hacia atrás y la curva lumbar es más marcada (lordosis +8°). Es otra señal clara de sexo en vista lateral.
6.2 Pecho masculino
Dos pectorales como cuadriláteros redondeados:
Borde superior: bajo la clavícula, τ = 0.14.
Borde inferior: τ = 0.36, curvado hacia arriba en el extremo lateral 0.08H.
Borde interior: x = ±0.03H (surco del esternón).
Borde exterior: x = ±0.42 · w_pecho, fundido con la axila.
Pezones: (±0.50H, y(τ = 0.33)).
Volumen (sombra inferior) proporcional a (1 + b): con complexión robusta el borde inferior baja hasta 0.04H.
6.3 Busto femenino
Cada pecho es una elipse adherida a la pared torácica con tres parámetros: tamaño c ∈ [0,1], caída g ∈ [0,1] y separación q ∈ [0,1].
r = r_0 + c\,(r_1 - r_0), \qquad r_0 = 0.18H,\ r_1 = 0.38H
x_c = \pm\,(0.16H + 0.75\,r + 0.04H\,q), \qquad y_c = y(\tau_{pezón}) + 0.10\,r - 0.25\,r\,g
\text{semiejes: } a_x = r, \quad a_y = r\,(1 + 0.15\,g), \qquad \text{proyección en perfil: } p_z = 0.65\,r\,(1 - 0.3\,g)
El pezón se coloca en (x_c + 0.10r, y_c + 0.15r(1 − g)) en dirección lateral y hacia arriba, porque en reposo apunta ligeramente hacia fuera.
El surco inferior (pliegue submamario) es el arco inferior de la elipse. Su punto más bajo nunca puede quedar por debajo de y(τ = 0.50).
La silueta frontal es la unión del contorno del torso y las elipses, así que el lateral del pecho puede asomar junto al brazo.
En los estilos anime el límite es c ≤ 0.85; en pixel art de 32 px o menos el busto se reduce a 1–2 píxeles de silueta y una línea de sombra.
Restricciones del validador: el borde superior de la elipse y_c + a_y no puede subir por encima de la axila; el borde exterior x_c + r no puede pasar de 0.5·w_pecho + 0.15H; y la separación interior x_c − r debe ser mayor o igual que 0.02H.
6.4 Animación secundaria
Respiración: escala vertical del pecho s_y = 1 + 0.012·sin(2πt / 4 s) y hombros ±0.01H en sincronía.
Movimiento secundario (pelo, pecho, ropa suelta): muelle amortiguado con respecto a su articulación padre, integrado con Euler semi-implícito.
\ddot{x} = -k\,(x - x_{objetivo}) - c\,\dot{x}, \qquad \zeta = \frac{c}{2\sqrt{k}} \in [0.3,\ 0.6]
6.5 Encuadres de busto para visual novel
Los sprites de VN se recortan del cuerpo completo con encuadres fijos. Así todos los personajes quedan a la misma escala en pantalla.
Encuadre
Borde superior
Borde inferior
Uso
Primer plano
T + 0.10H
y(τ = 0.05)
Retratos en el cuadro de diálogo
Busto
T + 0.15H
y(τ = 0.45)
Sprite de VN estándar
Medio cuerpo
T + 0.15H
y(τ = 1.00)
Poses con gestos de brazos
Cuerpo entero
T + 0.20H
−0.10H
Escenas y menús
Regla de composición: se escala el encuadre para que la línea de los ojos quede al 30–35 % del alto del marco empezando por arriba. El ancho del lienzo es w_hombros + 0.8H, para que los codos en pose de gesto no se corten.
7. Brazos y manos
Brazos y manos se generan a lo largo de sus huesos: la silueta es un perfil de anchos desplazado perpendicularmente al eje, y la mano es un esqueleto propio de 15 articulaciones con proporciones fijas. Así una mano nunca tiene dedos de longitudes arbitrarias.
7.1 Silueta del brazo
Para un hueso de J0 a J1, con dirección d y normal n (perpendicular a d), y t ∈ [0,1] a lo largo del hueso:
C_{\pm}(t) = J_0 + t\,(J_1 - J_0) \pm \tfrac{1}{2}\,w(t)\,\beta_{\pm}(t)\,n
w(t) se interpola con Hermite monótono (sección 6.1) y β es la asimetría entre los dos lados del hueso (músculo delante o detrás).
Segmento
t
Ancho (× base de 3.3)
Asimetría
Brazo: deltoides
0.10
1.15 (M) · 1.05 (F)
lado exterior 1.1
Brazo: bíceps
0.45
1.00
lado delantero 1.1 (M), 1.0 (F)
Codo
1.00
0.85
—
Antebrazo: máximo
0.25
1.00
lado exterior 1.08
Muñeca
1.00
ancho de muñeca
—
Ángulo de carga del codo: con el brazo extendido y la palma al frente, el antebrazo se desvía hacia fuera 10° en hombre y 15° en mujer. Es sutil pero se nota en sprites de cuerpo entero.
7.2 Espacio de la mano
Origen en la muñeca, eje +y hacia la punta de los dedos, unidad L = L_mano (sección 4.3). La palma ocupa el 55 % del largo y el dedo corazón el 45 %.
W_{palma} = \omega\,L, \qquad \omega_M = 0.45,\ \omega_F = 0.40, \qquad W_{muñeca} = 0.85\,W_{palma}
7.3 Nudillos y dedos
Dedo
Nudillo x (× W_palma)
Nudillo y (× L)
Largo (× L) hombre
Largo (× L) mujer
Abanico en reposo
Índice
+0.375
0.54
0.380
0.395
+6°
Corazón
+0.125
0.56
0.430
0.430
0°
Anular
−0.125
0.54
0.400
0.395
−5°
Meñique
−0.375
0.49
0.320
0.320
−12°
Los nudillos forman un arco, no una línea recta; por eso el meñique empieza más abajo. En hombre el anular suele ser más largo que el índice (proporción 2D:4D ≈ 0.95) y en mujer son casi iguales (≈ 1.0).
Falanges (de nudillo a punta): proximal 0.47, media 0.30, distal 0.23 del largo del dedo.
Grosor de dedo: 0.085L en hombre y 0.070L en mujer, que se estrecha hasta el 80 % en la punta. Las uñas ocupan el 55 % de la falange distal.
Pulgar: sale de la base de la palma en (+0.40·W_palma, 0.12L), con tres segmentos (metacarpiano 0.20L, proximal 0.16L, distal 0.13L). En reposo se abre 40° respecto al eje de la mano y está girado 60° sobre sí mismo. Por eso, con la palma de frente, el pulgar se ve de perfil.
7.4 Flexión y poses de mano
Cada dedo tiene un solo parámetro de flexión f ∈ [0,1], que reparte el giro entre sus tres articulaciones con el acoplamiento natural (la última falange sigue a la media):
\theta_{MCP} = 90^\circ f, \qquad \theta_{PIP} = 100^\circ f, \qquad \theta_{DIP} = \tfrac{2}{3}\,\theta_{PIP}
Límites: MCP de −20° a 90°, PIP de 0° a 110°, DIP de 0° a 80°. La posición de cada falange se obtiene encadenando rotaciones (cinemática directa, sección 10).
Una pose de mano es el vector [f_pulgar, f_índice, f_corazón, f_anular, f_meñique, apertura]:
Pose
Vector
Abierta
[0, 0, 0, 0, 0, 1]
Relajada
[0.2, 0.25, 0.30, 0.35, 0.40, 0.3]
Puño
[0.8, 1, 1, 1, 1, 0]
Señalar
[0.7, 0, 1, 1, 1, 0]
Paz / victoria
[0.7, 0, 0, 1, 1, 0.8]
Agarre (sostener objeto)
[0.5, 0.7, 0.7, 0.7, 0.7, 0]
Pulgar arriba
[0, 1, 1, 1, 1, 0]
La relajada muestra la cascada natural: cada dedo se dobla un poco más que el anterior hacia el meñique. Si una mano no la tiene, parece rígida.
Orientación: la mano gira sobre el eje del antebrazo (pronación/supinación, de −90° a +90°). Con ese ángulo se decide si se ve la palma, el dorso o el canto. Se usa la misma prueba de visibilidad por normal de la sección 5.6.
7.5 Nivel de detalle
Alto del sprite
Representación de la mano
≤ 32 px
2–3 px de color de piel, sin dedos
48–64 px
Manopla con pulgar separado; 4 formas precalculadas (abierta, puño, agarre, señalar)
96–128 px
Dedos agrupados de dos en dos
VN o ≥ 256 px
Mano completa con las 15 articulaciones
8. Piernas, pies y equilibrio
Las piernas usan el mismo método que los brazos (perfil de anchos a lo largo del hueso, sección 7.1), pero con asimetrías propias. La clave de su aspecto natural es que los músculos de un lado y otro no están a la misma altura. Además, toda pose de cuerpo entero debe pasar una prueba de equilibrio.
8.1 Perfil del muslo (cadera → rodilla)
t
Lado exterior (× ancho de muslo)
Lado interior
Nota
0.00
1.00
1.00
unión con la pelvis
0.15
M 1.00 · F 1.08
1.00
curva de cadera femenina continua
0.50
0.90
0.92

0.80
0.72
0.80
vasto interno sobre la rodilla
1.00
ancho de rodilla
ancho de rodilla

En hombre, el contorno exterior tiene una pequeña entrada bajo el trocánter (t ≈ 0.05). En mujer la línea cadera → muslo es una sola curva convexa, sin entrada.
8.2 Perfil de la pierna (rodilla → tobillo)
t
Lado exterior
Lado interior
Nota
0.00
ancho de rodilla
ancho de rodilla

0.25
1.00 (× pantorrilla)
0.92
el gemelo externo está más alto
0.35
0.95
1.00
el gemelo interno está más bajo
0.80
0.60
0.60

1.00
ancho de tobillo
ancho de tobillo
maléolo interno 0.03H más alto que el externo
8.3 Pie
Espacio local con origen en el tobillo y +z hacia delante, en unidades de L_pie.
Punto
Posición (z, y) × L_pie
Uso
Talón
(−0.25, −y_tobillo)
pivote al apoyar
Bola del pie (metatarsos)
(+0.55, −y_tobillo)
pivote al despegar
Punta
(+0.75, −y_tobillo)

Arco (punto más alto)
(+0.20, −y_tobillo + 0.10)
solo visible en vista interior
Ancho máximo del pie (en la bola): 0.38·L_pie en hombre y 0.36·L_pie en mujer; el talón mide el 60 % de ese ancho. En vista frontal el pie se ve como un trapecio escorzado de alto 0.25·L_pie. El calzado se modela como un desplazamiento del contorno (grosor de la suela) y eleva todo el esqueleto esa altura.
8.4 Equilibrio y postura
Centro de masas con fracciones de masa corporal por segmento (valores medios de la literatura biomecánica), situando la masa de cada segmento en su punto medio:
Segmento
Masa
Segmento
Masa
Cabeza y cuello
8.0 %
Muslo (cada uno)
10.0 %
Tronco
50.0 %
Pierna (cada una)
4.65 %
Brazo (cada uno)
2.8 %
Pie (cada uno)
1.45 %
Antebrazo (cada uno)
1.6 %
Mano (cada una)
0.6 %
CM = \frac{\sum_i m_i\,c_i}{\sum_i m_i}
Prueba de estabilidad para poses de pie: la proyección de CM sobre el suelo (CM_x, CM_z) debe estar dentro del polígono de apoyo, que es la envolvente convexa de los puntos de talón y punta de los pies en contacto. Si está fuera, la pose se marca como "cayendo". Se permite a propósito en saltos y carreras, nunca en poses de reposo.
Contrapposto (pose de reposo natural con el peso sobre una pierna):
Elegir la pierna de apoyo y mover la pelvis en x hasta que CM_x quede sobre su tobillo.
Inclinar la pelvis 5–8°, bajando la cadera de la pierna libre.
Inclinar los hombros 3–5° en sentido contrario.
Flexionar la rodilla libre 10–15° y resolver su pie con IK (sección 10) para que siga tocando el suelo.
Esta pose se genera sola desde el esqueleto y es la base de casi todos los sprites de visual novel de cuerpo entero.
9. Sistema de piezas y colocación
Una pieza nunca guarda su posición en el personaje: guarda anclajes (puntos con nombre dentro de su propia imagen) y el sistema calcula la transformación que lleva esos anclajes a las articulaciones del esqueleto. Si el ajuste no es bueno, la pieza se rechaza.
9.1 Qué declara cada pieza
Campo
Contenido
Ejemplo
slot
hueco que ocupa
upper_arm_L, hair_front, eyes
bone
hueso al que se une
shoulder_L → elbow_L
views
vistas que cubre
front, 3q, side, back
sex_range
rango de s compatible
[0, 0.4] (pieza masculina)
style
estilos compatibles
anime, pixel32
anchors
puntos en píxeles de la imagen
pivot, tip, width_a, width_b
layers
capas de la imagen
línea, colores planos indexados, sombra
palette_roles
índice → rol de color
1 = piel_luz, 2 = piel_base, 3 = piel_sombra
z_bias
ajuste fino de orden de dibujo
+1 = encima de su slot
Anclajes obligatorios por tipo:
Tipo de pieza
Anclajes
Segmento de miembro
pivot (articulación de origen), tip (articulación final), width_a y width_b (ancho medido en el centro)
Cabeza base
crown, chin, eye_L, eye_R, neck
Rasgos de cara
center (se coloca sobre la línea guía correspondiente de la sección 5.2)
Pelo
crown, hairline, temple_L, temple_R
Torso
neck, shoulder_L, shoulder_R, hip_L, hip_R
Mano
wrist, middle_tip, index_knuckle, pinky_knuckle
Ropa
los mismos anclajes que la pieza de cuerpo que cubre
9.2 Colocación con dos anclajes (miembros)
Con los anclajes de la pieza p0 (pivot) y p1 (tip), y las articulaciones objetivo j0 y j1:
s_{\parallel} = \frac{\lVert j_1 - j_0 \rVert}{\lVert p_1 - p_0 \rVert}, \qquad s_{\perp} = \frac{w_{objetivo}}{\lVert p_{width\_a} - p_{width\_b} \rVert}
\theta_p = \operatorname{atan2}(p_1 - p_0), \qquad \theta_j = \operatorname{atan2}(j_1 - j_0)
M = T(j_0)\;R(\theta_j)\;S(s_{\parallel}, s_{\perp})\;R(-\theta_p)\;T(-p_0)
El estiramiento a lo largo del hueso (s_∥) y a lo ancho (s_⊥) va por separado. Así una misma manga sirve para un brazo musculoso o uno fino. Para que no se deforme, ambos factores se limitan a [0.8, 1.25]; fuera de ese rango hace falta otra variante de la pieza.
9.3 Colocación con tres o más anclajes (cabeza, torso, manos)
Se usa la similitud de mínimos cuadrados (Procrustes 2D). Con n pares (p_i, q_i), centrados restando sus centroides p̄, q̄:
a = \frac{\sum_i (\tilde p_i \cdot \tilde q_i)}{\sum_i \lVert \tilde p_i \rVert^2}, \qquad b = \frac{\sum_i (\tilde p_i \times \tilde q_i)}{\sum_i \lVert \tilde p_i \rVert^2}
s = \sqrt{a^2 + b^2}, \qquad \theta = \operatorname{atan2}(b, a), \qquad t = \bar q - s\,R(\theta)\,\bar p
donde × es el producto cruzado 2D (p_x q_y − p_y q_x).
Control de calidad: el error residual indica si la pieza es anatómicamente compatible:
\varepsilon = \sqrt{\tfrac{1}{n}\sum_i \lVert s\,R(\theta)\,p_i + t - q_i \rVert^2}
ε (en unidades de H)
Resultado
< 0.02
Encaja
0.02 – 0.05
Aviso: se corrige con una deformación suave (9.5)
> 0.05
Rechazada: la pieza no respeta las proporciones
Este es el mecanismo que impide los "dibujos de Paint": una cabeza con los ojos mal separados o una mano con la muñeca en otro sitio no pasa la prueba.
9.4 Lectura automática de anclajes
Para importar piezas de terceros sin marcar anclajes a mano:
Se extrae la máscara (píxeles con alfa > 0).
Se calculan los momentos de imagen: centroide y orientación principal.
pivot y tip son los píxeles de la máscara más extremos a lo largo del eje principal; el ancho se mide perpendicular a ese eje en el centro.
El usuario confirma o corrige con un clic; el resultado se guarda en los metadatos.
\mu_{pq} = \sum_{x,y} (x - \bar x)^p\,(y - \bar y)^q, \qquad \phi = \tfrac{1}{2}\operatorname{atan2}(2\mu_{11},\ \mu_{20} - \mu_{02})
Hojas de sprites con plantilla fija (como las del generador LPC): todas las piezas comparten el mismo cuerpo base y la misma rejilla de frames. Basta con anotar una vez los anclajes de cada frame del cuerpo base, y cualquier pieza de ropa o pelo de esa colección los hereda.
9.5 Uniones sin huecos
Tapas articulares: cada segmento incluye un círculo de radio w/2 en su articulación de origen, dibujado bajo la pieza padre. Así no se abre un hueco al girar el codo o la rodilla.
Piel deformable (VN y alta resolución): la pieza se triangula en una malla y cada vértice sigue a varios huesos a la vez (linear blend skinning):
v' = \sum_i \omega_i\,M_i\,v, \qquad \omega_i = \frac{d_i^{-2}}{\sum_k d_k^{-2}}
con d_i la distancia del vértice al hueso i, considerando solo los huesos a menos de 0.5·w de la articulación. Fuera de esa zona el peso es 1 para su propio hueso.
9.6 Orden de dibujo
Cada slot tiene una profundidad base, y en cada frame se ordena por la z rotada del punto medio del hueso más el z_bias. Esto resuelve de forma automática que en vista 3/4 el brazo lejano quede detrás del torso.
Capa (de atrás a delante, vista frontal)
Pelo trasero · brazo y pierna lejanos · torso · ropa del torso · pierna y brazo cercanos · cuello · cabeza · cara · ojos · cejas · pelo delantero · accesorios
9.7 Color por roles
Las piezas se guardan con colores indexados por rol (piel, pelo, ropa A, ropa B, línea), cada uno con 3–4 tonos. Cambiar el color de pelo es cambiar una paleta, sin retocar píxeles. Las rampas de tonos se generan en la sección 11.
10. Rig y animación
Una pose es solo un vector de ángulos por articulación más la posición de la raíz. Las posiciones se calculan con cinemática directa, los pies y las manos que deben tocar algo se resuelven con cinemática inversa, y todo pasa por los límites de la sección 4.4.
10.1 Cinemática directa (FK)
Cada articulación tiene una transformación local respecto a su padre: desplazamiento en reposo o_j, rotación R_j y escala S_j. La global se obtiene recorriendo la jerarquía desde la raíz:
W_j = W_{padre(j)} \; T(o_j) \; R_j \; S_j, \qquad W_{pelvis} = T(\text{posición raíz})\,R_{pelvis}
Se trabaja en 3D (matrices 4×4 o cuaterniones) y se proyecta al final (sección 11). Para rotaciones de articulación se usa el orden Euler Y→X→Z (giro, flexión, ladeo), que coincide con los ejes de los límites.
10.2 Cinemática inversa de dos huesos (IK)
Para brazo (hombro, codo, muñeca) o pierna (cadera, rodilla, tobillo), con raíz A, objetivo P y longitudes L_1, L_2:
d = \operatorname{clamp}\big(\lVert P - A \rVert,\ |L_1 - L_2| + \epsilon,\ L_1 + L_2 - \epsilon\big)
\alpha = \arccos\frac{L_1^2 + d^2 - L_2^2}{2\,L_1\,d}, \qquad \beta = \arccos\frac{L_1^2 + L_2^2 - d^2}{2\,L_1\,L_2}
\theta_1 = \operatorname{atan2}(P - A) + \sigma\,\alpha, \qquad \theta_2 = \sigma\,(\pi - \beta)
σ = ±1 fija hacia dónde se dobla la articulación: la rodilla hacia delante y el codo hacia atrás. En 3D se añade un vector polo (un punto delante de la rodilla o detrás del codo) que define el plano de flexión. Después se aplican los límites articulares; si el objetivo queda fuera de alcance, el miembro se estira hacia él sin romperse.
10.3 Interpolación entre poses
Los ángulos se interpolan siempre por el camino más corto:
\Delta = \big((b - a + 180^\circ) \bmod 360^\circ\big) - 180^\circ, \qquad \theta(u) = a + \Delta\,e(u)
Modo
Función de easing e(u)
Uso
Escalón
0 hasta u = 1
Pixel art clásico (frames sin intermedios)
Lineal
u
Movimiento mecánico
Suave
3u² − 2u³
Por defecto en VN
Catmull-Rom entre keyframes
spline por 4 poses
Ciclos continuos
Mezcla de poses (por ejemplo, 70 % "andar" + 30 % "cansado"): suma ponderada de los Δ respecto a la pose de reposo, con pesos que suman 1.
10.4 Ciclo de andar procedural
Fase φ = 2π·t / T_c; la pierna derecha y el brazo izquierdo usan φ + π.
Canal
Fórmula (pierna o brazo izquierdo)
Amplitud típica
Cadera (flexión)
A_h · sin φ
A_h = 25°
Rodilla
5° + A_k · max(0, cos φ)^1.5
A_k = 55°, máximo en mitad del balanceo
Tobillo
10° · sin(φ − π/2)

Hombro
−A_a · sin φ
A_a = 18°
Codo
15° + 10° · max(0, −sin φ)

Pelvis (altura)
y₀ + B · cos 2φ
B = 0.03H; más alta al cruzarse las piernas
Pelvis (giro)
6° · sin φ
hombros en contra, 4°
Pelvis (ladeo lateral)
R · sin φ
R = 4° (M), 7° (F)
Diferencias de sexo al andar: en mujer el ladeo de cadera es mayor y los pies caen más cerca de la línea central (paso 0.05H más estrecho); en hombre el balanceo de hombros y brazos es mayor (A_a × 1.2).
Pies sin patinar: durante el apoyo (cos φ < 0, la cadera va hacia atrás para la pierna izquierda) la punta del pie se fija en el suelo y la pierna se resuelve con IK. La velocidad de desplazamiento sale de la zancada, v = 2·L_leg·sin(A_h) / (T_c / 2), así los pies nunca resbalan.
10.5 Frames por animación
Animación
16–32 px
64 px
VN / alta resolución
Reposo (respirar)
2
4
continuo
Andar
4
8
12–24
Correr
4
6–8
12–16
Atacar
3
5
8–12
Duración por frame
150–200 ms
100–120 ms
1/30–1/60 s
10.6 Reglas específicas de pixel art
Rotar píxeles a ángulos arbitrarios los deforma. Tres estrategias, de más a menos fiable:
Variantes pre-rotadas: cada pieza tiene versiones cada 22.5° o 45° y se elige la más cercana al ángulo del hueso. Es la opción recomendada hasta 64 px.
RotSprite: ampliar ×8 con Scale2x aplicado 3 veces, rotar con vecino más cercano y reducir tomando el color más frecuente de cada bloque. Buena calidad sin variantes, pero más costosa.
Rasterizar desde la geometría: dibujar los contornos paramétricos directamente a la resolución final (sección 11.3).
Anti-temblor: se redondea solo la raíz a píxel entero y los hijos se calculan relativos a esa raíz ya redondeada, con round(x) = floor(x + 0.5) en todo el sistema. Así una pieza no "baila" un píxel entre frames sin moverse.
11. Vistas, resolución y color
El mismo esqueleto 3D produce todas las direcciones del sprite con una proyección. Después se decide qué detalles caben en los píxeles disponibles y se sombrea con una luz fija, así todos los personajes quedan con el mismo estilo de iluminación.
11.1 Proyección por vista
Con giro de cámara θ alrededor de Y e inclinación ψ (0 para plataformas y VN, 20–30° para RPG de vista cenital):
x' = x\cos\theta + z\sin\theta, \qquad z_1 = -x\sin\theta + z\cos\theta
y' = y\cos\psi - z_1\sin\psi, \qquad \text{profundidad} = y\sin\psi + z_1\cos\psi
Conjunto
Ángulos θ
Se dibujan
Se espejan
4 direcciones
0°, 90°, 180°, 270°
frente, perfil izquierdo, espalda
perfil derecho
8 direcciones
+ 45°, 135°, 225°, 315°
+ 3/4 frente y 3/4 espalda
los otros dos 3/4
VN
0° o ±20–30°
frente y 3/4
según el lado de la pantalla
Las piezas asimétricas (raya del pelo, arma en una mano, parche) llevan no_mirror y necesitan su propia variante en la vista espejada.
11.2 Nivel de detalle según tamaño
Un rasgo se dibuja solo si su tamaño proyectado es de al menos 1 píxel: tamaño_px = tamaño_H · H · ppu. Si no llega, se sustituye por su versión simplificada.
Alto del sprite
Cabeza
Ojos
Señales de sexo que siguen siendo legibles
16 px
6–7 px
1 px cada uno
pelo (forma y largo), color de ropa, falda o pantalón
32 px
8–10 px
1×2 px
+ ancho de hombros frente a cadera, 1 px de pecho
64 px
13–16 px
2×3 px con brillo
+ cintura, mandíbula, pestañas de 1 px
VN (800–1200 px)
110–170 px
completos
todas las de las secciones 3, 5, 6 y 7
En sprites de 16–32 px los índices SHR y WHR de la sección 3.5 pueden redondearse a lo mismo. Por eso el validador exige al menos dos señales visibles de la tabla anterior en cada personaje pequeño.
11.3 Rasterizado de contornos en pixel art
Cobertura: un píxel se pinta si la geometría cubre al menos el 50 % de su área (sin antialiasing ni suavizado bilineal).
Limpieza: se eliminan los píxeles huérfanos (sin vecinos del mismo color en 4 direcciones) y las esquinas dobles en líneas de 1 px.
Escalones regulares: en diagonales y curvas, las rachas de píxeles deben crecer o decrecer de forma monótona (por ejemplo 3-2-2-1, nunca 3-1-3). Se corrigen moviendo 1 píxel.
Contorno: dilatación de la máscara menos la máscara (1 px). Se colorea con el tono más oscuro de la rampa del relleno vecino (contorno selectivo), no con negro puro.
11.4 Sombreado automático
Cada pieza se aproxima por una primitiva (cilindro para los miembros, elipsoide para cabeza y pecho, caja redondeada para la pelvis), que da su normal en cada píxel. Para un miembro, con u ∈ [−1,1] la posición a lo ancho:
n = u\,\hat n_{\perp} + \sqrt{1 - u^2}\,\hat z, \qquad I = \max(0,\ n \cdot \hat l), \qquad \hat l = \operatorname{norm}(-0.5,\ 0.8,\ 0.3)
El tono se cuantiza a la rampa de la paleta: k = floor(I · niveles). La luz fija arriba a la izquierda y delante mantiene coherente el sombreado de todos los personajes y piezas.
11.5 Rampas de color
Las rampas se generan en el espacio OKLCH, perceptualmente uniforme, a partir de un color base (L, C, h) y un paso k ∈ {−2, −1, 0, +1, +2}:
L_k = L + 0.09\,k, \qquad C_k = C\,(1 - 0.12\,|k|)
h_k = h + \operatorname{sign}(\Delta_k)\,\min\big(|\Delta_k|,\ 8^\circ |k|\big), \qquad \Delta_k = \begin{cases} 70^\circ - h & k > 0 \\ 280^\circ - h & k < 0 \end{cases}
Las luces derivan hacia tonos cálidos (amarillo) y las sombras hacia fríos (azul-violeta), que es la técnica de desplazamiento de matiz del pixel art. Las diferencias Δ se calculan por el camino angular más corto. El contraste mínimo entre tonos vecinos es ΔL ≥ 0.06 para que se distingan en pantallas pequeñas.
12. Formatos de datos y validación
Cuatro archivos JSON describen todo el sistema: el personaje (entrada), el esqueleto (calculado), cada pieza (metadatos) y cada animación. Las tablas de este documento se guardan como un quinto archivo, canon.json, para poder ajustar valores sin tocar el código.
12.1 Personaje
{  "id": "ana",  "style": "anime_vn",  "params": { "s": 1.0, "b": -0.2, "e": 1.1 },  "height_px": 1100,  "bust": { "c": 0.5, "g": 0.2, "q": 0.5 },  "face": { "eye_scale": 1.0, "jaw": 0.0 },  "palette": {    "skin": "oklch(0.82 0.05 55)",    "hair": "oklch(0.35 0.08 30)",    "cloth_a": "oklch(0.55 0.12 250)"  },  "parts": {    "hair_front": "hair_bob_01",    "hair_back": "hair_bob_01_back",    "eyes": "eyes_round_02",    "torso_cloth": "blouse_01",    "legs_cloth": "skirt_pleated_01"  }}
12.2 Esqueleto calculado (salida, no se edita)
{  "unit": "H",  "H": 1.0,  "T": 7.0,  "indices": { "SHR": 0.97, "WHR": 0.66 },  "joints": {    "pelvis":     { "parent": null,        "rest": [0.0, 3.52, 0.0] },    "shoulder_L": { "parent": "clavicle_L", "rest": [0.68, 5.73, 0.0],                    "limits": { "flex": [-50, 180], "abd": [-30, 180] } },    "elbow_L":    { "parent": "shoulder_L", "rest": [0.93, 4.38, 0.0],                    "limits": { "flex": [0, 145] } }  },  "bones": { "upper_arm_L": 1.39, "forearm_L": 1.13, "hand_L": 0.63 }}
Los valores numéricos del ejemplo son ilustrativos; el código los calcula con las fórmulas de las secciones 3 y 4.
12.3 Pieza
{  "id": "sleeve_long_01_upper_L",  "slot": "upper_arm_L",  "bone": ["shoulder_L", "elbow_L"],  "views": ["front", "3q"],  "sex_range": [0.0, 1.0],  "styles": ["anime_vn"],  "image": "sleeve_long_01_upper_L.png",  "anchors": {    "pivot": [24, 8], "tip": [26, 140],    "width_a": [4, 70], "width_b": [46, 70]  },  "palette_roles": { "1": "cloth_a+1", "2": "cloth_a", "3": "cloth_a-1", "4": "outline" },  "z_bias": 1,  "no_mirror": false,  "rotation_variants": null}
12.4 Animación
{  "id": "walk",  "loop": true,  "duration_ms": 960,  "mode": "procedural",  "generator": "walk_cycle",  "params": { "A_h": 25, "A_k": 55, "A_a": 18, "B": 0.03 },  "bake": { "frames": 8, "interp": "step" },  "ik": [    { "chain": ["hip_L", "knee_L", "ankle_L"], "pole": "front", "lock": "stance" }  ]}
Para animaciones hechas a mano, mode: "keyframes" y una lista keys con { "t": ms, "pose": { joint: [yaw, flex, roll] }, "ease": "smooth" }.
12.5 Exportación
Spritesheet: PNG en rejilla (una fila por dirección y una columna por frame) más un JSON compatible con el formato de Aseprite (frames, meta.frameTags), que leen Godot, Unity y Phaser.
Ren'Py: una carpeta por personaje con capas separadas (base, ropa, ojos, boca, cejas, rubor) para usar con layeredimage.
Rig para motores: el JSON del esqueleto y las piezas, para reproducir la animación en tiempo real.
12.6 Lista de validación
El validador se ejecuta al crear un personaje, al cargar una pieza y al exportar. Un error bloquea la operación; un aviso deja continuar.
Comprobación
Condición
Tipo
Estilo posible
L_torso ≥ 0.8H
Error
Simetría
cada punto R es el espejo exacto de su L (tolerancia 1e−6)
Error
Dimorfismo
SHR y WHR dentro de los umbrales de 3.5 para el sexo declarado
Aviso
Señales en sprites pequeños
≥ 2 señales visibles (11.2) si el alto es ≤ 64 px
Aviso
Encaje de pieza
error residual ε < 0.05H (9.3)
Error
Escala de pieza
s_∥ y s_⊥ dentro de [0.8, 1.25]
Error
Busto
límites de 6.3
Error
Límites articulares
todos los ángulos de cada frame dentro de 4.4
Error
Longitud de huesos
constante en todos los frames (tolerancia 0.5 %)
Error
Equilibrio
CM sobre el polígono de apoyo en poses de reposo (8.4)
Aviso
Pies fijos
la punta del pie de apoyo no se mueve más de 1 px entre frames
Aviso
Legibilidad de color
ΔL ≥ 0.06 entre tonos vecinos de cada rampa
Aviso
13. Plan de implementación con Claude Code
La recomendación es construir primero un núcleo matemático puro en TypeScript, sin interfaz ni dibujo, con tests para cada fórmula. La interfaz y el render vienen después y solo consumen ese núcleo. Así cada módulo se puede pedir a Claude Code por separado, citando su sección de este documento.
13.1 Estructura de carpetas
/core  canon.json          tablas de las secciones 3, 5, 7, 8 y 10  math/               vectores, matrices, Catmull-Rom, Hermite monótono, OKLCH  body/               parámetros → landmarks → esqueleto (secciones 3 y 4)  head/               contorno, rasgos, rotación, expresiones (sección 5)  torso/              silueta, pecho, busto, encuadres (sección 6)  limbs/              brazos, manos, piernas, pies (secciones 7 y 8)  parts/              anclajes, colocación, Procrustes, skinning (sección 9)  rig/                FK, IK, límites, interpolación, ciclos (sección 10)  render/             proyección, LOD, rasterizado, sombreado (sección 11)  validate/           todas las comprobaciones de 12.6  export/             spritesheet + JSON, Ren'Py/tests                un archivo de test por módulo/app                  interfaz (editor), al final
13.2 Orden de construcción
math + canon.json: utilidades y tablas. Test: Catmull-Rom pasa exactamente por sus puntos; Hermite monótono no supera nunca los valores de entrada.
body: esqueleto en reposo. Tests: con s = 0 SHR = 1.40 ± 0.01; con s = 1 SHR = 0.97 ± 0.01; codo a la altura de la cintura; simetría exacta.
render mínimo: dibujar el esqueleto como líneas y los landmarks como puntos en un canvas para ver el resultado desde el principio.
head, torso, limbs: siluetas paramétricas en gris. Test visual: ocho personajes (4 estilos × 2 sexos) en una sola imagen de comparación.
rig: FK, IK y límites. Tests: la IK alcanza cualquier objetivo alcanzable con error < 1e−4; la longitud de los huesos no cambia.
walk cycle y poses: tests de pies fijos y de equilibrio.
parts: colocación y lectura de anclajes. Test: una pieza sintética transformada con una similitud conocida se recupera con ε ≈ 0.
render completo: sombreado, rampas, rasterizado pixel art, LOD.
export: spritesheet, JSON tipo Aseprite, Ren'Py.
app: editor con deslizadores de parámetros, selector de piezas y línea de tiempo.
13.3 Cómo pedirlo a Claude Code
Guarda este documento en el repositorio (por ejemplo docs/base-matematica.md) y pide un módulo cada vez, citando su sección y sus tests. Por ejemplo:
Implementa core/body según las secciones 3 y 4 de docs/base-matematica.md. Lee todas las constantes de core/canon.json, sin valores fijos en el código. Escribe primero los tests de 13.2, punto 2, y luego el código hasta que pasen.
13.4 Tecnología
TypeScript en el núcleo: corre igual en el navegador, en Node y dentro de una app de escritorio (Tauri).
Vitest para los tests y fast-check para tests de propiedades (por ejemplo, "para cualquier s, b y e válidos, el esqueleto es simétrico").
Canvas 2D o PixiJS para el render; el núcleo no debe depender de ninguno de los dos.
Todo es de código abierto y gratuito.

