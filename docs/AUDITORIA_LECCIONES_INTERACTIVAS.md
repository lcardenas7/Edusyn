# Auditoría y rediseño — Módulo de Lecciones Interactivas

Fecha: 2026-07-15 · Alcance: `LessonEditor.tsx`, `LessonPlayer.tsx`, `lesson/InteractiveBlocks.tsx`,
modelos `Lesson/LessonSlide/LessonProgress`, foros (`ForumPost`), y la relación actividad↔sección.
Encargado por el fundador tras usar el sistema varias horas.

Equipo simulado: PM de LMS · UX/UI educativo · Arquitecto React/TS · Gamificación · Diseño instruccional.

---

## TL;DR — el veredicto primero

**No reemplazar desde cero. EVOLUCIONAR la Lección hacia el paradigma que Edusyn YA tiene.**

El hallazgo de fondo: Edusyn ya construyó tres veces la maquinaria que esta auditoría pide —
**Learning Routes** (grafo de competencias + pasos + lección generada por Valeria), **Expedición
ABP** (misiones con gating, validación, intentos, XP) y **gamificación** (`LearningIdentity` con
XP/niveles/insignias). La Lección Interactiva es **el único módulo que se quedó atrás**: sigue
siendo "diapositivas + HTML crudo" y nunca se subió a ese paradigma.

Por eso la respuesta a la pregunta final ("¿mantener, evolucionar o reemplazar por Ruta de
Aprendizaje Interactiva?") es: **evolucionar la diapositiva hacia una Ruta/Misión**, reutilizando
lo ya construido, no reescribir. El concepto de "slide" sobrevive como **la unidad atómica dentro
de un nodo**, no como la estructura de toda la experiencia.

---

## PARTE 1 · Auditoría crítica del sistema actual

**Lo que funciona (y hay que conservar):**
- El **player ya es más rico de lo que se percibe**: `LessonPlayer.tsx` tiene XP con toast de
  nivel (`xpToast`), efectos de sonido (WebAudio), progreso persistido (`LessonProgress`),
  feedback de correcto/incorrecto y explicaciones. La gamificación base EXISTE.
- Los **motores de actividad** (`InteractiveBlocks`: multiple-choice, V/F, fill-blank, ordenar,
  emparejar, sopa, crucigrama, memory, etiquetar-imagen, rompecabezas) son sólidos y con grading
  puro compartido front/back.
- Ya hay **generación por IA** (Valeria arma slides) y ya lo conectamos a las misiones ABP.

**Lo que está roto o es frágil:**
- **Editor pide HTML crudo.** `LessonEditor.tsx:1343` — el cuerpo de la slide es un `<textarea>`
  con placeholder `<p>…</p>`. El docente promedio NO sabe HTML. Es el problema #1.
- **Sin red de seguridad.** Guardado **manual** (`handleSave`, botón "Guardar"); no hay
  autoguardado, ni aviso `beforeunload`, ni versiones. Perder 11 diapositivas es un resultado
  **esperable** del diseño actual, no un bug raro.
- **Estructura lineal.** El modelo es una secuencia plana de `LessonSlide` (sort order). El alumno
  "pasa slides". No hay nodos, ramas, ni obligatoriedad real de estructura.
- **Multimedia solo por URL / subida frágil.** Las imágenes subidas "no se reconocen" — mismo
  patrón que arreglamos en el aula: se guarda la *key* de storage y se intenta abrir cruda (ver
  `AUDITORIA_VISUAL_AULA` §H2/visor). Falta biblioteca multimedia y drag-and-drop.
- **Sin tablas.**
- **Actividad acoplada a sección en la UX** (aunque el DB ya lo permite suelto).

---

## PARTE 2 · Problemas detectados (agrupados)

| Área | Síntoma | Causa raíz |
|------|---------|-----------|
| Editor | Pide HTML | `textarea` de body sin editor visual |
| Editor | Se pierde el contenido | Sin autoguardado/versionado/beforeunload |
| Editor | Imágenes no cargan | Se guarda key de storage, no URL resuelta (bug conocido) |
| Editor | No hay tablas | Feature ausente |
| Pedagogía | Se avanza sin interactuar | Estructura = slides lineales, sin gating |
| Pedagogía | No hay obligatoriedad/ramas | No existe motor de reglas por nodo |
| Pedagogía | Intentos sin matiz | El player puntúa, pero no degrada XP por intento |
| Visual | "Se siente diapositiva" | Problema de ESTRUCTURA y plantillas, no de stack |
| Multimedia | Solo URL | Falta upload directo (imagen/video/audio/PDF) + biblioteca |
| Foros | Básico | Hilos planos, moderación/evaluación pobres |
| Arquitectura | Borrar sección "afecta" actividades | UX obliga sección; el DB ya es `SetNull` |

---

## PARTE 3 · Priorización

**CRÍTICO** (rompe el trabajo del docente o le impide usarlo):
1. **Matar la dependencia de HTML** → editor por bloques WYSIWYG.
2. **Autoguardado + recuperación de borrador** (nadie debe volver a perder 11 slides).
3. **Fix de imágenes/multimedia subida** (resolver key→URL, ya sabemos cómo).

**ALTO** (valor grande, esfuerzo medio):
4. **Organización de Actividades por período/sección** (lo que pediste: períodos horizontales).
5. **Motor de reglas por nodo**: obligatoria/opcional, gating "no avanzas sin acertar", puntaje mínimo.
6. **Intentos con XP decreciente** (100/80/60…) — reusar `grantXp` idempotente.
7. **Tablas** en el editor de bloques.

**MEDIO:**
8. Biblioteca multimedia + drag-and-drop.
9. Temas/fondos prediseñados (el docente no diseña).
10. Mensajes flotantes de Valeria (pistas contextuales).
11. Rediseño de foros (hilos, moderación, evaluación).

**BAJO / visión:**
12. Ramas alternativas, coleccionables, cofres, rachas, mapa de nodos tipo aventura.

---

## PARTE 4 · Nueva arquitectura PEDAGÓGICA recomendada

**La diapositiva evoluciona a NODO dentro de una Ruta.** No es un cambio conceptual nuevo: es
converger la Lección con el modelo de **Learning Route / Misión ABP** que ya existe.

- **Nodo** = una parada con un objetivo (presentar, practicar, evaluar, retar). Contiene 1..n
  **bloques** (los slides de hoy son "nodos de un solo bloque").
- **Motor de reglas por nodo** (reusar el patrón de gating de ABP `phaseCriteriaMet`/misiones):
  - `required` / `optional`
  - `gate`: no avanza hasta acertar / hasta puntaje mínimo / hasta completar reto
  - `branch`: siguiente nodo según el resultado (ramas)
- **Intentos con recompensa decreciente**: 100 → 80 → 60 → 40 XP, config por lección. El XP fluye a
  `LearningIdentity` (ya idempotente por `idempotencyKey`).
- **Progreso real**: `LessonProgress` ya existe; se extiende con estado por nodo (bloqueado/en
  curso/superado) igual que `AbpPhaseState`.

Resultado: el alumno deja de "pasar slides" y empieza a **superar estaciones** con obligatoriedad y
consecuencia — sin inventar un motor nuevo, extendiendo el de ABP.

---

## PARTE 5 · Nueva arquitectura TÉCNICA recomendada

**Editor (matar el HTML):** editor **por bloques tipo Notion** (recomendado sobre Canva/Genially).
- *Por qué bloques y no lienzo libre (Canva/Genially):* el contenido educativo debe ser
  **responsivo, accesible y con contraste automático**; un lienzo de posicionamiento absoluto
  rompe en móvil y en lectores de pantalla. Bloques = estructura + libertad suficiente.
- Bloques: Título, Párrafo, Lista, **Tabla**, Imagen, Video, Audio, PDF, Cita, Separador, y
  **Bloque-Actividad** (cualquiera de los motores ya existentes). Una tabla se puede "convertir en
  actividad" (completar celdas) reusando el grading.
- Stack: **el actual (React+Tailwind+Framer Motion) es suficiente** — el problema NO es el stack,
  es que no hay editor de bloques ni plantillas. Añadir **@dnd-kit** (ya se usa el patrón de
  Reorder) para arrastrar bloques y **una capa de primitivas** (Radix/shadcn opcional para
  menús/popovers accesibles). NO se necesita Bootstrap.
- Persistencia del bloque: `LessonSlide.body` (HTML) → `LessonSlide.blocks Json` (array de bloques
  tipados). Migración: un conversor que envuelve el HTML viejo en un bloque `HTML` legacy para no
  perder nada.

**Red de seguridad (crítico):**
- **Autoguardado** con debounce (2-3s) a un borrador servidor + `beforeunload` guard.
- **Versionado ligero**: `LessonVersion` (snapshot Json + timestamp) al guardar/publicar →
  "restaurar versión". Barato y salva la vida.

**Multimedia:** subida directa reusando `storage` (imagen/video/audio/PDF), **resolviendo la key a
URL firmada** (el mismo `openStoredFile`/visor que arreglamos en el aula) + **biblioteca**
(`ClassroomMaterial` ya es un repositorio; exponerlo como picker en el editor).

**Arquitectura de contenidos (Parte 7):** ver abajo.

---

## PARTE 6 · Nueva experiencia VISUAL recomendada

- **Plantillas/temas prediseñados** (el docente elige, no diseña): STEM, Bilingüe, Lectura,
  Gamificado. Cada tema = tokens (ya tenemos `--skill-accent` por habilidad) + fondo + tipografía.
  **Contraste automático**: derivar color de texto del fondo (no dejarlo al docente).
- **Fondos inteligentes** por tipo de nodo (presentación vs reto vs celebración).
- **Micro-interacciones con mesura**: el player ya tiene sonido + XP toast; sumar partículas SOLO
  en hitos (nodo superado, insignia) con Framer Motion. Regla del DS: *animación solo como
  feedback, nunca decoración*.
- **Valeria flotante**: pistas contextuales dentro del nodo (botón "💡 Pista" que consume el
  `hint` que Valeria ya genera por actividad; y tips proactivos si el alumno falla 2 veces).

---

## PARTE 7 · Arquitectura de CONTENIDOS y ACTIVIDADES

**El requisito del fundador:** las actividades NO deben depender obligatoriamente de una sección.

**Estado real:** en el DB **ya no dependen** — `ClassroomActivity.sectionId` es `nullable` con
`onDelete: SetNull` (comentario en el schema: "Nullable para permitir actividades huérfanas al
borrar sección"). El acoplamiento es **de UX**: el formulario de crear actividad **exige** elegir
sección. Es decir, el 80% del rediseño que pides es quitar esa exigencia + reorganizar la vista.

**Recomendación:**
- **Sección = opcional.** Permitir `sectionId` vacío ("Sin sección"). Ya sembramos la creación
  rápida de sección; ahora además permitir NO elegir.
- **La Lección como contenedor de entidades independientes** (tu visión): una Lección/Unidad
  agrupa **Contenido + Actividades + Recursos + Evaluaciones** relacionados, pero cada uno vive por
  su cuenta. Esto es EXACTAMENTE lo que ya hace la **Learning Route** (pasos que referencian
  `ClassroomActivity`) y la **misión ABP** (actividades enlazadas). → converger, no duplicar.
- **Organización de Actividades por período (lo que pediste):** la jerarquía natural ya es
  **Período → Sección → Actividad** (actividad→sección→`academicTermId`). La vista de Actividades
  se reorganiza así:
  - **Selector horizontal de períodos** arriba (Todos · P1 · P2 · …) como organizador **primario**
    — reemplaza el apilamiento de filtros, no lo suma. Solo aparece si hay períodos en uso.
  - Dentro del período, las actividades **agrupadas por sección** (cabeceras plegables).
  - Los filtros de tipo (Tareas/Quiz/Lecciones) quedan como control **secundario y discreto**, no
    como una segunda fila de chips de colores.
  - Actividades sin sección → grupo "Sin sección" al final (no se pierden).

---

## Roadmap de implementación

**FASE 1 · Impacto rápido (lo que duele hoy):**
- Reorganizar **Actividades por período** (horizontal) + agrupar por sección + filtros de tipo
  discretos. *(Puro frontend, datos ya listos.)*
- **Autoguardado + `beforeunload`** en el editor de lección. *(Barato, corta el sangrado.)*
- **Fix de imágenes** (resolver key→URL, biblioteca básica). *(Ya sabemos cómo.)*
- **Sección opcional** al crear actividad.

**FASE 2 · Mediano plazo:**
- **Editor por bloques** (mata el HTML) con Tabla, y `LessonSlide.blocks` + conversor del HTML viejo.
- **Motor de reglas por nodo** (obligatoria/gate/puntaje mínimo) + **intentos con XP decreciente**,
  reusando el gating de ABP y `grantXp`.
- **Versionado ligero** (`LessonVersion` + restaurar).
- **Temas/plantillas** prediseñados con contraste automático.

**FASE 3 · Visión Edusyn 2030:**
- **Convergencia Lección ↔ Ruta ↔ Misión**: un solo motor de "recorrido con nodos, gating y XP"
  que sirva a las tres. La Lección pasa a ser un tipo de Ruta corta.
- Ramas alternativas, mapa de nodos tipo aventura, coleccionables/cofres/rachas.
- Valeria proactiva (pistas + generación de nodos contextualizada, ya iniciada en ABP).
- Foros rediseñados (hilos, reacciones, moderación, evaluación con rúbrica) superando a
  Classroom/Moodle en integración con la nota.

---

## Veredicto final

**Evolucionar, no reemplazar.** El "modelo de diapositivas" **muere como estructura** pero
**sobrevive como unidad atómica** (un nodo de un bloque). La Lección se convierte en una **Ruta de
Aprendizaje Interactiva** reutilizando el motor de Rutas/Misiones que Edusyn ya tiene — evitando
reescribir la gamificación, el gating y la generación por IA, que ya están construidos y probados.
