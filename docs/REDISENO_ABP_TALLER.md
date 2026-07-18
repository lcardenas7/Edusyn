# Rediseño de producto — Expedición ABP · "El Taller" (experiencia del estudiante)

> Dossier de diseño de producto para rediseñar por completo la experiencia del
> **estudiante** en el módulo **Expedición ABP** de Edusyn. Conserva 1:1 la lógica
> académica actual (6 fases, máquina de estados, misiones, validación,
> coevaluación) y reutiliza los motores existentes; cambia el **lenguaje, la forma
> y la sensación**. Documento de Product Designer — sin código todavía.
>
> Contexto técnico de apoyo: ver [CONTEXTO_ABP_ESTUDIANTE.md](CONTEXTO_ABP_ESTUDIANTE.md).

**Tesis de diseño:** los estudiantes no vienen a *consumir contenido*; vienen a
*fabricar un artefacto en equipo*. Toda la interfaz —lienzo, presencia,
herramientas, celebración— existe para sostener esa sensación de **construcción
compartida** de principio a fin. Debe sentirse como Miro/FigJam/Notion/Linear,
**no** como un curso, una lección de diapositivas, una Ruta de aprendizaje ni un
formulario.

---

## 1. Filosofía del módulo

**Principio rector:** *"Acompañamos procesos, no tareas."* El Taller no reparte
actividades: le da al equipo un lugar y unas herramientas para pensar juntos hasta
producir algo del mundo real.

**Metáfora — Expedición → Taller:** la Expedición es el viaje (progreso, cima,
insignias); el Taller es el **lugar físico** donde se trabaja (mesas, instrumentos,
muros de post-its, el equipo alrededor). Se conserva la épica, se gana la
tactilidad.

Tres verdades que gobiernan cada decisión:
1. **El artefacto es el héroe.** Lo que el equipo fabrica está siempre en el
   centro; la interfaz es el banco de trabajo, nunca el protagonista.
2. **Nunca se trabaja solo.** La presencia del equipo es una capa permanente, no
   una pestaña. Ves quién está, quién escribe, qué propuso cada quien.
3. **Divergir es jugar; converger es decidir.** Cada estación tiene un momento de
   abrir (lluvia, exploración) y otro de cerrar (priorizar, acordar, validar). La
   UI cambia de tono entre ambos.

**Anti-patrón (lo que El Taller NUNCA es):** no es lección de diapositivas, ni Ruta
de aprendizaje, ni feed de actividades, ni formulario largo. Si aparece un scroll
infinito de cajas de texto, hemos fallado.

---

## 2. Principios de diseño (7 reglas operativas)

1. **Lienzo, no lista.** El estado por defecto de una estación es un espacio 2D con
   objetos manipulables, no una columna de secciones.
2. **Herramientas, no campos.** Cada acción es un *instrumento* con su forma de
   pensar (un árbol, una matriz, un muro). Abrirlo debe dar ganas, como abrir una app.
3. **Presencia siempre visible.** Avatares, cursores, "escribiendo…", "Juan añadió
   una evidencia". La colaboración se muestra, no se supone.
4. **Progreso como mapa, no barra.** El avance es un territorio que se ilumina, no
   un porcentaje frío.
5. **Una decisión por momento.** Se resalta la siguiente acción obvia; el resto se
   repliega en cajones y overlays (baja carga cognitiva).
6. **Reutilizar motores, reencuadrar experiencia.** Drag&drop, editor de bloques,
   subida a storage, XP ya existen: se reorganizan, no se reinventan.
7. **Celebrar el proceso, no solo el final.** Cada micro-logro tiene un latido de
   recompensa; la validación de fase es un ritual, no un botón gris.

---

## 3. Arquitectura de navegación

Tres niveles espaciales + dos capas persistentes:

| Nivel | Nombre | Qué es | Metáfora |
|---|---|---|---|
| 0 | **Base de Operaciones** | Home del equipo: mapa de la expedición, misión actual, pulso del equipo | La entrada del taller |
| 1 | **Estación** (Fase) | El lienzo de trabajo de una fase; contiene sus instrumentos y el artefacto | Una sala/mesa del taller |
| 2 | **Instrumento** | Una herramienta abierta en foco (árbol, muro, matriz, kanban…) | Sacar una herramienta del banco |

**Capas persistentes (siempre presentes):**
- **Capa A — Barra de Equipo (CrewBar):** franja superior fija con avatares en vivo,
  quién escribe, actividad reciente y el latido de la fase.
- **Capa B — Command Bar (⌘K):** saltar a cualquier estación/instrumento, invocar a
  Valeria, pedir validación (tipo Linear/Raycast). En móvil es un botón flotante "+".

**Regla de oro:** nunca más de **2 clics** entre "entro al módulo" y "estoy
escribiendo con mi equipo". La Base propone directamente dónde seguir.

---

## 4. Arquitectura de información

La nueva jerarquía conserva íntegra la lógica académica; solo cambia el lenguaje y
la forma.

| Concepto nuevo | Reemplaza a | Motor existente |
|---|---|---|
| **Expedición** | Proyecto ABP | `AbpProject` |
| **Estación** | Fase (1–6) | `AbpPhaseState` |
| **Instrumento** | Herramienta/misión de fase | `AbpMission.tool` |
| **Artefacto** | Contenido de la fase | `phase.data` (JSON) |
| **Sellos & Chispas** | Insignias & XP | badges · XP |
| **Bitácora & Descubrimientos** | Log / discoveries | `AbpLogEntry` · `AbpDiscovery` |
| **Ritual de Validación** | request/resolve validation | `AbpValidationRequest` |

**Las 6 estaciones (nombre nuevo → fase real):**

| Código | Estación | Propósito | Fase real |
|---|---|---|---|
| EST-01 | **El Terreno** | Comprender el reto | Fase 1 · Canvas del Problema |
| EST-02 | **La Chispa** | Generar y elegir ideas | Fase 2 · Tormenta + votación |
| EST-03 | **La Brújula** | Fijar el objetivo | Fase 3 · Objetivo SMART |
| EST-04 | **La Ruta** | Planear el trabajo | Fase 4 · Plan / Kanban |
| EST-05 | **La Fragua** | Construir y evidenciar | Fase 5 · Prototipo |
| EST-06 | **El Ágora** | Presentar y coevaluar | Fase 6 · Socialización |

Cada estación hereda su estado real: 🔒 Bloqueada · ● En curso · ◔ En validación ·
✓ Validada.

---

## 5. Flujo completo del estudiante

1. **Llegada → Base de Operaciones.** Ve el mapa de su expedición con su equipo y
   una frase grande: "Están en El Terreno. Faltan 2 instrumentos." *Siente: "ya sé
   dónde estamos parados".*
2. **Orientación en 3 segundos.** Botón enorme "Entrar al Taller →" + pulso: qué
   hizo el equipo desde su última visita. *Siente: pertenencia, impulso.*
3. **Descubrir herramientas.** Los instrumentos están como fichas sobre la mesa; los
   obligatorios brillan, los opcionales esperan; hover = preview. *Siente: curiosidad.*
4. **Construir en compañía.** Trabaja dentro del instrumento con presencia en vivo
   (cursores/aportes, avatar de autor por objeto); autosave silencioso; nada se
   pierde (escritura atómica ya resuelta). *Siente: "lo hacemos juntos".*
5. **Converger y acordar.** Al final de la estación aparece el momento de
   votar/priorizar/acordar; quedan registrados los acuerdos. *Siente: decisión
   colectiva, cierre.*
6. **Pedir validación (ritual).** Con los obligatorios completos, la compuerta se
   ilumina; presentar es un gesto ceremonial con resumen del artefacto. *Siente:
   orgullo.*
7. **Espera activa & feedback.** En "en revisión" pueden pulir; si vuelve, el
   feedback llega como tarjeta del docente anclada al punto exacto. *Siente:
   acompañamiento, no castigo.*
8. **Celebración & avance.** Validada: sello + chispas con confeti sobrio, la
   siguiente estación se desbloquea, titular compartido: "¡El Terreno conquistado!
   🧭". *Siente: recompensa, ganas de seguir.*

---

## 6. Flujo completo del docente

El docente no "califica formularios": **cura la expedición** y valida hitos. Su
vista es un panel de control (densidad de información), no un lienzo.

1. **Montar la expedición.** Crea el reto, arma equipos (roster que excluye a
   asignados, edición de miembros), define la portada; puede pedir instrumentos a
   Valeria.
2. **Sala de Control.** Todos los equipos como tarjetas vivas (estación actual, %
   de instrumentos, último latido) + cola de validaciones por antigüedad.
3. **Observar sin interrumpir.** Entra a la estación de un equipo en modo
   espectador; ve el artefacto y quién aportó qué; detecta al que no participa.
4. **Validar con rúbrica.** Ritual de Validación: revisa, puntúa rúbrica (1–4) y
   aprueba (→ sello + siguiente estación) o devuelve con feedback anclado.
5. **Cierre & coevaluación.** En El Ágora orquesta la muestra; cada equipo presenta
   y coevalúa (1–4); ve el consolidado y cierra la expedición.

---

## 7. Propuesta de nuevas pantallas (8 superficies)

- **P1 · Base de Operaciones** (estudiante): mapa + misión actual + pulso + acceso
  1-clic al Taller.
- **P2 · Estación (Lienzo)** (estudiante): mesa de trabajo con instrumentos como
  fichas + artefacto central + CrewBar + dock de validación.
- **P3 · Instrumento en foco** (estudiante): overlay casi a pantalla completa con la
  herramienta específica y presencia en vivo.
- **P4 · Ritual de Validación** (estudiante): resumen ceremonial + gesto "Presentar
  al docente" + estado de espera.
- **P5 · Bitácora del Equipo** (estudiante): línea de tiempo del proyecto (acuerdos,
  descubrimientos, feedback, hitos). La memoria compartida.
- **P6 · El Ágora / Showcase** (compartida): vitrina de proyectos + coevaluación.
- **P7 · Sala de Control** (docente): todos los equipos + cola de validaciones +
  alertas (equipos atascados/sin actividad).
- **P8 · Command Bar (⌘K)** (sistema): navegación/acciones universales.

---

## 8. Wireframes conceptuales (descripción)

- **WF-1 · Base de Operaciones:** topbar con migas + avatares en vivo + ⌘K.
  Izquierda: "Están en **El Terreno**", subtítulo "Faltan 2 instrumentos", un mapa
  de estaciones (✓ — ◉ actual — 🔒 — 🔒) y botón primario "Entrar al Taller →".
  Derecha: tarjeta punteada "Pulso del equipo" con eventos recientes.
- **WF-2 · Estación (lienzo):** topbar con código de estación (color propio) + pill
  de estado + "Lucía escribiendo…". Cuerpo: grid de InstrumentCards (obligatorios
  resaltados, uno con outline = en foco, otro "Opcional"), acciones "+ Añadir
  instrumento" y "✦ Pedir a Valeria". Dock flotante inferior "1 de 2 obligatorios ·
  Presentar 🔒" y minimapa en la esquina.
- **WF-3 · Instrumento (Brainstorm):** muro de post-its con color, autor y votos; la
  más votada marcada ⭐; ficha "+ nueva idea"; pie con avatares "2 compañeros aquí
  ahora · las ideas más votadas suben solas".
- **WF-4 · Ritual de Validación:** modal centrado, icono de estación, "¿Presentar El
  Terreno al docente?", resumen del artefacto (instrumentos completados),
  botones "Todavía no" / "Presentar al docente ✦".

**Trazabilidad:** cada objeto (post-it, causa, evidencia) guarda autoría y voto
(datos que ya existen en `AbpContribution`), así la colaboración es real, no
cosmética.

---

## 9. Componentes reutilizables

- **CrewBar** — presencia en vivo (avatares, "escribiendo…", actividad, latido).
- **InstrumentCard** — ficha de herramienta (icono, nombre, para-qué, estado, autores).
- **Canvas/Board** — superficie 2D con objetos arrastrables, minimapa y zoom.
- **StickyNote** — objeto atómico con color, autor, votos, edición atómica.
- **AuthorChip** — avatar + nombre anclado a cualquier aporte.
- **ValidationDock** — barra flotante de progreso obligatorio + compuerta "Presentar".
- **ExpeditionMap** — mapa de estaciones con estado.
- **FeedbackCard** — tarjeta del docente anclada al punto a mejorar.
- **CommandBar (⌘K)** — navegación/acciones universales (Radix + Floating UI).
- **RewardBurst** — sello + chispas + confeti sobrio.
- **PresenceCursor** — cursor con nombre para co-presencia (fase 2).
- **ConvergePanel** — momento de votar/priorizar/acordar al cerrar la estación.

---

## 10. Instrumentos de trabajo (catálogo)

Cada instrumento es **una forma de pensar**, no un campo. Se reparten por estación;
el docente/Valeria eligen cuáles activar.

- **EST-01 El Terreno:** Árbol de Problemas · Mapa de Actores · Canvas del Reto · Entrevistas.
- **EST-02 La Chispa:** Brainstorm (muro) · Mapa Mental · Votación · Clasificación.
- **EST-03 La Brújula:** SMART · Priorización (matriz impacto/esfuerzo) · Matrices.
- **EST-04 La Ruta:** Kanban · Cronograma · Timeline · Checklist.
- **EST-05 La Fragua:** Evidencias · Notas · Diagramas.
- **EST-06 El Ágora:** Vitrina (presentar) · Coevaluación.

**Reutilización:** los ya construidos (Canvas, Brainstorm+Votación, SMART, Kanban,
Evidencias, Coevaluación) se re-enmarcan como instrumentos sin tocar su lógica. Los
nuevos (Árbol, Mapa de Actores, Priorización, Timeline…) se apoyan en el mismo motor
de lienzo + bloques. Un instrumento = plantilla de objetos sobre el board.

---

## 11. Estados de cada pantalla

| Pantalla | Vacío | Cargando | Activo | Bloqueado/Error | Éxito |
|---|---|---|---|---|---|
| **Base** | "Aún no tienes equipo" | Mapa en shimmer | Misión + pulso vivos | Sin conexión → "reintentando" | Expedición completa → cima 🏔️ |
| **Estación** | "Aún sin instrumentos" | Fichas placeholder | Instrumentos + presencia | Fase bloqueada 🔒 | Todos ✓ → compuerta encendida |
| **Instrumento** | Lienzo con hint fantasma | Objetos fade-in | Co-edición en vivo | Solo lectura | Objetivo cumplido → check verde |
| **Validación** | — | Enviando… | Resumen + gesto | Faltan obligatorios 🔒 | En revisión ◔ / Validada ✓ + sello |
| **Sala Control** | "Sin equipos aún" | Tarjetas skeleton | Grid vivo + cola | Equipo atascado ⚠️ | Todos validados → expedición cerrada |

---

## 12. UX — Desktop

El lienzo es el hábitat natural del Taller.
- **Lienzo espacial real:** pan (espacio+arrastre), zoom, minimapa; objetos
  colocados libremente. Aquí compite con Miro/FigJam.
- **CrewBar fija** + Command Bar (⌘K) + atajos (nueva nota `N`, votar `V`, validar `⌘↵`).
- **Instrumento en overlay** centrado (no navegación de página): entrar/salir
  instantáneo, mantiene el contexto del lienzo detrás.
- **Doble panel opcional:** artefacto + Bitácora lado a lado.
- **Densidad calibrada:** aire generoso; el vacío es intencional.

---

## 13. UX — Tablet

El dispositivo del aula. Optimizado para dedo y para pasar el equipo alrededor de
una mesa.
- **Táctil primero:** objetos ≥44px, arrastre con inercia, pinch-to-zoom.
- **Instrumento a pantalla completa** (no overlay flotante).
- **Modo mesa:** la tablet se pasa entre integrantes; la CrewBar muestra "tú eres…"
  y el aporte se firma con el avatar activo.
- **CommandBar como FAB** ("✦") con acciones frecuentes.

---

## 14. UX — Móvil

El móvil no intenta ser un lienzo: se convierte en un **cajón de instrumentos
vertical** + presencia.
- **Estación = lista de instrumentos apilados** (no board libre); tocar abre a
  pantalla completa.
- **Aportes rápidos:** post-it, votar, subir foto/evidencia desde la cámara en 2
  toques.
- **Presencia condensada:** barra fina con avatares + "Lucía escribiendo…".
- **Compuerta de validación** como barra inferior fija (sticky).
- **Lienzos complejos** (árbol, diagramas) → modo lectura + edición guiada por
  pasos; el board libre queda para tablet/desktop.

---

## 15. Sistema de colaboración

El corazón del módulo, implementado por niveles.

| Señal | Qué comunica | Nivel |
|---|---|---|
| Avatares en línea | Quién está en la estación ahora | N1 · polling (iniciado) |
| "Escribiendo…" | Quién trabaja en qué instrumento | N1 · polling |
| AuthorChip por objeto | Quién propuso cada idea/causa/evidencia | N0 · ya existe (`AbpContribution`) |
| Feed de pulso | "Josué completó el Mapa" · "Ana votó" | N1 · derivado del log |
| Acuerdos del equipo | Lo que decidieron juntos | N1 · Bitácora |
| Cursores con nombre | Co-edición en vivo estilo Figma | N2 · WebSocket/CRDT (futuro) |
| Reacciones efímeras | 👏🔥 sobre el aporte de un compañero | N2 · realtime |

**Estrategia honesta:** la sensación "nunca estoy solo" se logra en **N1 con
polling** (ya en marcha) + escritura atómica que evita conflictos. La co-edición
viva (N2, WebSockets) es un salto posterior: se diseña la UI para soportarlo, pero
no se bloquea el lanzamiento por él.

---

## 16. Gamificación

Recompensa el **proceso y el equipo**, no solo el resultado individual. Sobria, no
infantil.
- **Chispas (XP de equipo):** por aportar (primera idea, completar instrumento,
  subir evidencia). Motor XP existente.
- **Sellos de estación:** insignia al validar cada fase (🧭⚡🎯🛠️🚀🏆).
- **Cima de la expedición:** al validar las 6, pantalla de cumbre + artefacto final.
- **Roles vivos (opcional):** Facilitador/Investigador/Constructor, ganados por
  comportamiento.
- **Racha del equipo:** días consecutivos con actividad de ≥2 integrantes.
- **Reconocimiento entre pares:** kudos ligeros por un aporte.

**Antídoto contra lo tóxico:** nada de rankings individuales que enfrenten; la
métrica visible es del equipo. Lo individual solo alimenta la trazabilidad del docente.

---

## 17. Microinteracciones (respetan `prefers-reduced-motion`)

- **Post-it que "cae":** al crear una idea, aterriza con leve rebote y micro-rotación.
- **Voto con pulso:** el contador late y la nota más votada flota hacia arriba
  (reordenamiento animado).
- **Presencia que respira:** el avatar de quien escribe tiene un anillo pulsante.
- **Compuerta que se enciende:** al completar el último obligatorio, el dock pasa de
  gris a marigold con un destello.
- **Sello estampado:** la insignia "se estampa" con scale-bounce + chispas al validar.
- **Desbloqueo de estación:** el candado se abre y el siguiente nodo del mapa se
  ilumina con trazo animado.
- **Autosave silencioso:** micro-texto "Guardado ✓" que aparece y se desvanece.
- **Skeleton con carácter:** placeholders con el color de la estación, no gris genérico.

---

## 18. Sistema visual

Deliberadamente distinto del **violeta-sobre-blanco** del LMS. El Taller vive en un
ambiente de **estudio al atardecer**: cálido, táctil, con acentos de oficio.

**Paleta:**
- Marigold (craft/energía) — acento primario.
- Teal (colaboración/presencia) — acento secundario.
- Un color de wayfinding por estación (Terreno terracota, Chispa marigold, Brújula
  teal, Ruta azul, Fragua magenta, Ágora violeta).
- Semánticos separados del acento: válido (verde), aviso (ámbar), crítico (rojo).
- Fondo "lienzo" (papel de taller en claro, estudio nocturno en oscuro).

**Tipografía (3 roles):**
- **Display:** sans del sistema, peso 800, tracking negativo — titulares con carácter.
- **Body:** humanista del sistema, 16–17px, medida ~65ch — legible y cálida.
- **Utility (mono):** monoespaciada para códigos de estación (EST-01), metadatos y
  presencia — el sello "de laboratorio".

**Textura & forma:**
- Fondo de lienzo punteado (grid de puntos) = "espacio de trabajo", no documento.
- Superficies táctiles: sombras suaves multicapa, radios generosos (14–20px),
  post-its con rotación leve.
- Glassmorphism solo en capas flotantes (CrewBar, Command Bar, docks).
- Color de estación como wayfinding (tiñe lienzo, chips y skeletons).
- Dos temas cuidados (claro "papel de taller", oscuro "estudio nocturno").

---

## 19. Sistema de validación

La máquina de estados real, convertida en un **ritual de paso** (se conserva 1:1).

| Estado (real) | En El Taller | Qué puede hacer el equipo |
|---|---|---|
| **LOCKED** | Estación con candado en el mapa | Ver, no editar. "Validen la anterior para abrirla." |
| **IN_PROGRESS** | Taller abierto, instrumentos editables | Construir; converger; al completar obligatorios la compuerta se enciende. |
| **AWAITING** | "En revisión" (no bloqueo muerto) | Seguir puliendo en solo-lectura suave; ven que el docente mira. |
| **VALIDATED** | Sello estampado + siguiente estación abierta | Celebración + avanzar; insignia y chispas otorgadas. |
| **Devuelta (return)** | FeedbackCard del docente anclada | Corregir justo lo señalado y volver a presentar. Tono de mejora. |

- **Compuerta inteligente:** "Presentar" solo se enciende con los obligatorios
  completos (criterio ya calculado en backend); antes muestra exactamente qué falta.
- **Feedback anclado:** la retroalimentación se ancla al artefacto/instrumento
  concreto, no es texto suelto.

---

## 20. Roadmap de implementación priorizado

Ambicioso pero entregable por capas; cada fase deja algo usable. Reutiliza motores;
no reescribe la ingeniería.

**Fase 0 · Cimientos invisibles (sem. 1–2)**
- Escritura atómica anti-conflictos (hecho) + sincronización en vivo por polling (en curso).
- Editar equipos / roster sin duplicados (hecho).
- Tokens del nuevo sistema visual (paleta estudio, mono utility, temas claro/oscuro).

**Fase 1 · MVP — La Base y la primera Estación reencuadradas (sem. 3–6)**
- Base de Operaciones (mapa + misión + pulso) reemplaza la home actual.
- Estación como lienzo con InstrumentCards + CrewBar (avatares, "escribiendo…").
- Re-enmarcar los 6 instrumentos existentes sin tocar su lógica.
- Ritual de Validación + FeedbackCard anclada. AuthorChip en cada aporte.

**Fase 2 · Nuevos instrumentos + gamificación (sem. 7–11)**
- Instrumentos nuevos sobre el motor de lienzo: Árbol de Problemas, Mapa de Actores,
  Priorización, Timeline/Cronograma, Mapa Mental.
- Sellos, Chispas de equipo, Cima de expedición, RewardBurst, microinteracciones.
- Command Bar (⌘K) + atajos. Bitácora del equipo.
- UX táctil pulida para tablet y cajón vertical en móvil.

**Fase 3 · Cumbre — Co-presencia en vivo (sem. 12+)**
- WebSockets/CRDT: cursores con nombre, co-edición simultánea real, reacciones efímeras.
- El Ágora como showcase inmersivo + coevaluación enriquecida.
- Valeria proactiva: sugiere el siguiente instrumento y detecta equipos atascados.

**Cómo medir el éxito:** no "tareas entregadas", sino % de integrantes que aportan
por fase, tiempo hasta el primer aporte, estaciones validadas sin devolución, y una
encuesta de una pregunta: *"¿sentiste que construiste algo con tu equipo?"*
