# Edusyn Crea — Revisión del flujo completo (2026-09-23)

Revisión pedida: que en el celular se sienta una app paso a paso, y revisar equipos, trabajo en
paralelo, generación del prompt, cómo seguir agregando cosas, y cómo retirar apps sin generar
gastos. Lo medido viene de recorrer el taller a 375 px y de leer el código, no de suposiciones.

Leyenda: **[✔]** corregido en esta revisión · **[!]** hueco real, con propuesta · **[i]** dato.

---

## 1. En el celular, paso a paso

Recorrido a 375×812 px (tamaño de un teléfono común).

| Momento | Cómo se vio | Estado |
|---|---|---|
| Documentar | Etapas + pregunta + campos; sin desbordes | **[!] M5** |
| Prompt | Texto completo, botones «Copiar», «Omitir», «Ir al taller»; sin desbordes | OK |
| Código | Pestañas Vista previa / Código, archivos, editor, barra inferior | **[✔] M1, M2, M3** |
| Publicar | QR, enlace, instrucciones Android/iPhone, tablero de uso | **[✔] M4** |
| Docente | Tarjetas de equipo con publicación y uso | **[✔] M6** |

**[✔] M1 · El código obligaba a desplazarse en horizontal.** El editor no ajustaba las líneas
(medido: contenido de 447 px en un área de 349 px). Ahora ajusta línea (`EditorView.lineWrapping`).

**[✔] M2 · Teléfono dentro del teléfono.** En el celular, la vista previa dibujaba un marco de
teléfono dentro de la pantalla del teléfono, encogiendo la app. Ahora, en pantalla angosta la app
ocupa el ancho completo, sin marco ni escala.

**[✔] M3 · La barra inferior comía el editor.** Ocupaba 183 px en tres filas. Los botones
secundarios quedan como íconos y el estado se oculta en pantallas pequeñas: **103 px**, unos 80 px
más de código a la vista.

**[✔] M4 · El panel de publicar se salía de la pantalla.** El enlace largo estiraba la columna
(contenido hasta 459 px en una pantalla de 375). Corregido con `min-w-0` y el enlace a ancho
completo en celular.

**[✔] M6 · Las tarjetas del docente se salían ~28 px.** Mismo origen; corregido.

**[!] M5 · Documentar arranca con media pantalla de índice.** La pregunta real empieza a 418 px
del borde superior: en un teléfono hay que desplazarse antes de escribir nada. Propuesta: en
pantalla angosta, mostrar las etapas como una barra de progreso compacta (1·2·3) y abrir la lista
solo al tocarla.

---

## 2. Equipos

**[i] Cómo funciona hoy.** El docente crea el equipo y elige sus integrantes de la lista del aula
(entre 1 y 8, con rol). Un estudiante no puede entrar solo, y quien no está en un equipo ve
«Pide a tu docente que te agregue». La API verifica que cada integrante esté matriculado en ese
grupo y año.

**[!] E1 · Un equipo no se puede corregir.** No existe forma de renombrarlo, agregar o quitar
integrantes, ni eliminarlo. En un colegio esto pasa siempre: llega un estudiante nuevo, otro se
retira, el docente se equivoca al armar los grupos. Hoy la única salida es crear otro equipo, y el
trabajo queda partido. **Propuesta:** editar nombre e integrantes, y eliminar un equipo vacío (sin
versiones); si tiene versiones, solo archivarlo.

**[!] E2 · Un estudiante puede quedar sin equipo y no se nota.** El panel del docente no muestra
quiénes del aula no están en ningún equipo. **Propuesta:** una línea «N estudiantes sin equipo» con
la lista.

**[!] E3 · Los roles no hacen nada.** Se piden al crear (Investigación, Diseño, Desarrollo,
Pruebas, Coordinación) pero no cambian permisos ni aparecen en el taller. O se usan (por ejemplo,
sugerir qué archivo toca cada quien) o se quitan para no prometer algo que no existe.

---

## 3. Trabajo en paralelo (varios estudiantes a la vez)

**[i] Lo que ya está resuelto.** El plan se guarda por campo: dos compañeros escribiendo en
etapas distintas no se pisan. El código tiene guarda de revisión: si alguien guardó antes, el otro
no sobrescribe en silencio, ve quién guardó y elige «Cargar lo suyo» o «Mantener lo mío».

**[!] P1 · Dos personas en el MISMO archivo chocan todo el tiempo.** El guardado automático
dispara cada ~2 segundos; si dos integrantes editan a la vez, el segundo recibe el aviso de
conflicto una y otra vez. Funciona (nadie pierde trabajo), pero se siente mal. **Propuestas, de
menor a mayor esfuerzo:**
1. **Mostrar quién está en el taller** («Ana está en Diseño») y en qué archivo, para repartirse.
2. **Borrador por archivo** en vez de uno por equipo: dos personas en archivos distintos no se
   cruzan nunca. Es un cambio acotado y resuelve el 90 % de los casos reales.
3. Edición simultánea real (tipo documento compartido): mucho más trabajo; no lo recomiendo aún.

**[!] P2 · No se sabe quién hizo qué.** La versión guarda quién la creó, pero el borrador no deja
rastro de autoría por trozo. Para evaluar aporte individual, hoy el docente depende de la bitácora
y de lo que el equipo cuente.

---

## 4. La petición para la IA (el prompt)

**[i] Cómo se arma.** Se construye solo con lo que el equipo escribió (problema, solución, plan),
más las reglas de plataforma (se publica con QR, funciona sin internet, datos en el teléfono, sin
cuentas ni datos personales) y las de acabado (color de acento, espacios de 8 px, 44 px al tocar,
estado vacío amable, foco visible). Nunca incluye nombres ni datos del colegio. El docente puede
apagar la IA por proyecto.

**[!] IA1 · Traer el código de vuelta es manual y frágil.** El estudiante copia el prompt, la IA
responde tres bloques y él debe pegar cada uno en su pestaña. Si la IA devuelve un solo bloque o
cambia el orden, se confunde. **Propuesta:** un botón «Pegar la respuesta de la IA» que reciba todo
el texto, separe los tres archivos y muestre qué cambia antes de aplicar (ya existe algo parecido
en el módulo de evaluación formativa: leer JSON pegado con tolerancia).

**[!] IA2 · La petición de cambio no incluye el error de la vista previa.** Si la app falla, el
estudiante tiene «Pedir ayuda» por un lado y «Pedir un cambio» por otro. Conviene que la petición
de cambio pueda adjuntar el último error detectado.

---

## 5. Seguir agregando cosas (archivos, imágenes)

**[i] Hoy:** exactamente tres archivos — `index.html`, `styles.css`, `app.js` — de hasta 250 KB
cada uno. No se pueden crear archivos nuevos ni subir imágenes.

**[!] A1 · Techo bajo para proyectos que crecen.** Un juego o una app con varias pantallas quiere
partir el JavaScript en dos o tres archivos. **Propuesta:** permitir hasta ~8 archivos con nombres
libres dentro de una lista blanca de extensiones (`.html`, `.css`, `.js`, `.json`), con un tope
total por equipo (por ejemplo 1 MB). Cambia el validador del servidor, las pestañas del taller y el
servicio que publica; el resto sigue igual.

**[!] A2 · Sin imágenes propias.** Hoy solo se pueden dibujar íconos SVG a mano o incrustar
imágenes en base64 (pesadas y feas de editar). **Propuesta (entrega posterior):** subir imágenes al
almacenamiento que Edusyn ya usa, servidas desde el mismo origen de la app publicada, con límite
de tamaño y solo formatos de imagen.

**[!] A3 · Nada de librerías.** Es deliberado (seguridad y funcionar sin internet) y así debe
seguir, pero conviene decirlo en el taller, no solo en el prompt, para que nadie pierda una hora
intentando usar una.

---

## 6. Costos y cómo retirar apps

**[i] Cuánto cuesta hoy.** La cuenta completa de Railway (API, web, base de datos, vista previa y
los dos servicios de apps) va en **US$ 1,00 gastados este ciclo, con estimado de US$ 4,86 al mes**.
El servicio que sirve las apps cuesta lo mismo con una app publicada que con doscientas: es un
solo proceso pequeño. Lo que crece con el uso son filas en la base de datos (una por dispositivo y
una por dispositivo/día), que son diminutas.

**[!] C1 · No se puede borrar nada.** No existe eliminar proyecto, equipo, versión ni publicación.
Todo se acumula año tras año. **Propuesta:** «Eliminar proyecto» para el docente (borra equipos,
versiones y publicación en cascada, con confirmación escribiendo el nombre) y «Eliminar
publicación» que además borre su uso.

**[!] C2 · Las apps publicadas no vencen solas.** La fecha de vencimiento es opcional y hay que
acordarse de ponerla. **Propuesta:** por defecto, vencer al terminar el año escolar, avisando al
equipo; el docente puede extenderla.

**[!] C3 · El uso se guarda para siempre.** Conviene borrar el detalle por día después de, por
ejemplo, 12 meses, conservando los totales.

**[i] C4 · Palancas de ahorro inmediatas, sin tocar código:**
- Poner un **límite de gasto** en Railway (hoy no hay ninguno: ni blando ni duro).
- Dormir el servicio de apps **de staging** cuando no se esté probando.
- Si algún día sobra, unir `crea-preview` y `crea-apps` en un solo servicio: hacen cosas parecidas.

---

## 7. Qué haría primero

1. **E1 — editar equipos** (renombrar, agregar o quitar integrantes). Es lo que más duele en un
   salón real.
2. **P1.2 — borrador por archivo**, para que trabajar en paralelo deje de dar conflictos.
3. **C1 y C2 — eliminar proyecto/publicación y vencimiento por defecto**, más el límite de gasto en
   Railway.
4. **IA1 — pegar la respuesta de la IA de una sola vez.**
5. **A1 — más archivos** (hasta ~8, con nombres libres).
6. **M5 — índice compacto al documentar en celular.**

Lo de la sección 1 marcado **[✔]** ya está corregido y probado.
