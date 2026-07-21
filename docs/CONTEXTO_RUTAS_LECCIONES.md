# Contexto: Rutas de Aprendizaje + Lección Interactiva — Edusyn

> Documento de contexto para trabajar con un asistente externo (ChatGPT) sobre dos
> módulos del Aula Virtual que están conectados: **Rutas de Aprendizaje**
> (secuencias de pasos hacia una competencia) y la **Lección Interactiva**
> (el reproductor de lecciones por diapositivas con actividades). Cubre modelo de
> datos, experiencia (docente y estudiante) y mapa de código.
>
> Stack: **Backend** NestJS + Prisma + PostgreSQL (`apps/api`). **Frontend** React +
> Vite + Tailwind (`apps/web`). Multi-tenant por `institutionId`.

---

## 0. Cómo se conectan (visión de conjunto)

```
LearningRoute (ruta)
  └─ LearningRouteStep (paso)  ──►  ClassroomActivity  ──► (si es tipo LESSON) ──►  Lesson
                                                                                      └─ LessonSlide[] (diapositivas)
                                                                                            └─ blocks / activityData (bloques + preguntas interactivas)
```

- Una **Ruta** es una secuencia ordenada de **pasos**; **cada paso ES una
  actividad** (`ClassroomActivity`).
- Si esa actividad es de tipo **LESSON**, al abrir el paso se lanza el
  **`LessonPlayer`** (la lección interactiva).
- La misma **Lección** puede existir suelta como actividad del aula o dentro de
  una misión ABP (el `LessonPlayer` se reutiliza en varios lugares, incl.
  `AbpTab.tsx`).
- **Valeria** (IA) puede **armar la ruta** y **generar la lección de cada paso**,
  reutilizando las instrucciones y el material base de la ruta para dar coherencia.

---

# PARTE A — RUTAS DE APRENDIZAJE

## A.1 Qué son
Secuencias de **pasos que convergen en una competencia** (pensado para el enfoque
bilingüe/CEFR: niveles A1–B2 y habilidades READING/LISTENING/SPEAKING/WRITING).
El docente las crea manualmente o con **"Armar con Valeria"**; el estudiante ve
solo las **publicadas** y las recorre paso a paso.

## A.2 Modelo de datos (`apps/api/prisma/schema.prisma`)
- **`LearningRoute`** — la ruta. Campos: `classroomId`, `title`, `description`,
  `targetCompetencyId` + `targetLevel` (competencia CEFR objetivo),
  `isPublished`, `sortOrder`, y dos campos que alimentan a la IA:
  - `instructions` — el "cómo" quiere el docente que se genere.
  - `sourceMaterial` — documento/guía base pegada por el docente.
  Valeria **reusa ambos** al generar la lección de cada paso (coherencia).
- **`LearningRouteStep`** — un paso. Campos: `routeId`, `activityId` (**el paso ES
  una `ClassroomActivity`**), `competencyId` (competencia a la que aporta),
  `title`, `sortOrder`.

## A.3 Experiencia
**Docente** (`LearningRoutesTab.tsx`, `isTeacher`):
- Botones **"Crear ruta"** (manual) y **"Armar con Valeria"** (IA).
- Ve todas sus rutas (publicadas o no); publica cuando están listas.
- Cada habilidad tiene icono/etiqueta (Lectura/Escucha/Habla/Escritura) y un
  **formato sugerido** por Valeria (`SUGGESTED_FORMAT`): READING/LISTENING →
  Lección, WRITING → Tarea, SPEAKING → Grabación (editable).

**Estudiante:**
- Solo ve rutas **publicadas** (`routes.filter(r => r.isPublished)`).
- Abre una ruta → `RouteDetail` muestra los pasos en orden; al abrir un paso de
  tipo lección se lanza el **`LessonPlayer`**.

## A.4 Mapa de código (Rutas)
- **Frontend:** `apps/web/src/components/LearningRoutesTab.tsx` (lista + detalle +
  creación + panel Valeria). Usa `LessonPlayer` y `LessonEditor`.
- **API front:** `learningRouteApi` en `apps/web/src/lib/api.ts` (~2610):
  `listByClassroom`, `get`, `progress`, y las de generación con IA
  (plan/crear-desde-plan).
- **Backend:** `apps/api/src/modules/learning-route/` → `learning-route.controller.ts`
  + `learning-route.service.ts`. Prefijo de rutas `/learning-routes`.

---

# PARTE B — LECCIÓN INTERACTIVA

## B.1 Qué es
Una lección **por diapositivas** con contenido rico y **actividades interactivas**.
Dos modos de reproducción (`LessonPlayMode`):
- **SCORM** — auto-avance, **cada estudiante a su ritmo** (el modo normal en el aula).
- **LIVE** — presentación **sincronizada** estilo Nearpod (Edusyn Play).

## B.2 Modelo de datos
- **`Lesson`** — 1:1 con una `ClassroomActivity` de tipo LESSON (`activityId @unique`).
  Metadatos: `title`, `description`, `coverImage`, insignia (`badgeEmoji/Title/Color`),
  `estimatedMinutes`, `playMode`.
- **`LessonSlide`** — una diapositiva. `type` (`LessonSlideType`) + `sortOrder`.
  Tipos de slide:
  - **CONTENT** — texto rico + multimedia.
  - **ACTIVITY** — mini-quiz embebido (una pregunta interactiva).
  - **CHECKPOINT** — marcador de progreso seguro (punto de reanudación).
  - **BADGE_REVEAL** — última slide: insignia + celebración.
  Campos de contenido: `title`, `body` (HTML), `imageUrl`, `videoUrl`, `audioUrl`,
  `layout` (legacy), y el **motor de bloques** `blocks` (JSON: array ordenado de
  bloques tipados). Para ACTIVITY: `activityData` (JSON con la pregunta).
  ⚠️ **Compat:** si `blocks` está vacío se usa el render legacy (`body/imageUrl/…`).
- **`LessonProgress`** — progreso **por estudiante**: `status`
  (NOT_STARTED/IN_PROGRESS/COMPLETED), `currentSlideIndex`, `completedSlides`,
  `answers` (`{ slideId: { answer, isCorrect, points } }`), `score`/`maxScore`,
  `badgeEarned`, `lastCheckpointIndex`, tiempos.
- **`LessonVersion`** — snapshots para autoguardado/recuperación/historial
  (`kind`: AUTOSAVE / MANUAL / PUBLISH).

## B.3 El motor de bloques (contenido)
`apps/web/src/components/lesson/blocks.tsx` define los **bloques de CONTENIDO**:
```ts
type BlockType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TABLE'
```
El docente los apila; `BlockStackView` los renderiza. TEXT usa editor rico;
IMAGE/VIDEO/AUDIO usan `SmartMedia`; TABLE tiene su editor/visor.

## B.4 Las actividades interactivas (el corazón)
`apps/web/src/components/lesson/InteractiveBlocks.tsx` implementa **13 tipos de
pregunta**, cada uno con su componente de juego:

| questionType | Componente | Qué hace |
|---|---|---|
| `MULTIPLE_CHOICE` | ChoiceBlock | opción múltiple |
| `TRUE_FALSE` | ChoiceBlock | verdadero/falso |
| `FILL_BLANK` | InlineBlankBlock | rellenar el hueco |
| `SHORT_ANSWER` | ShortAnswerBlock | respuesta corta (puede ser abierta) |
| `ORDERING` | OrderWordsBlock | ordenar palabras/ítems |
| `MATCHING` | MatchPairsBlock | emparejar |
| `FLASHCARDS` | FlashcardsBlock | tarjetas (sin corrección) |
| `LISTENING` | ListeningBlock | escuchar y responder |
| `WORDSEARCH` | WordSearchBlock | sopa de letras |
| `CROSSWORD` | CrosswordBlock | crucigrama |
| `MEMORY` | MemoryBlock | memoria (parejas) |
| `LABEL_IMAGE` | LabelImageBlock | etiquetar una imagen |
| `PUZZLE` | PuzzleBlock | rompecabezas |

**Forma de los datos** (`ActivityData` en `lesson/grading.ts`):
```ts
{ questionType, question, options?[], correctAnswer?, explanation?, points?, hint?,
  imageUrl? /*LABEL_IMAGE*/, openAnswer? /*SHORT_ANSWER abierta*/ }
```
**Trucos de codificación (Camino A, sin cambiar el schema):**
- **MATCHING**: los pares viven en `options` como `"izquierda::derecha"`.
- **LABEL_IMAGE**: los puntos (hotspots) viven en `options` como `"etiqueta::x::y"`
  (x,y en %).
- **ORDERING**/**MATCHING** se codifican sobre los campos existentes
  `options`/`correctAnswer`.

**Corrección (`lesson/grading.ts`, lógica pura, testeable, sin UI):**
- `gradeAnswer(act, value)` → `boolean` (único juez de si es correcta).
- `isAnswerComplete(act, value)` → gobierna el botón "Comprobar".
- `norm(s)` → trim + minúsculas + colapsa espacios (clave para ORDERING).
- Generadores auxiliares: `crossword.ts`, `wordsearch.ts`.

## B.5 El reproductor (`LessonPlayer.tsx`)
Fases (`Phase`): `loading → intro → playing → completed`.
- **Carga:** `lessonApi.getByActivity(activityId)` + `getMyProgress`. Si dejó la
  lección a medias, **reanuda desde el último checkpoint**.
- **Jugar:** por cada slide de ACTIVITY se usan `BlockRenderer` (pinta el bloque),
  `isAnswerComplete`/`requiresSubmission` (habilita "Comprobar"), `gradeAnswer`
  (corrige). Sonidos por evento (`correct/wrong/advance/checkpoint/complete`).
- **Avance y guardado:** `lessonApi.advance(lessonId, { slideIndex, slideId,
  answer?, attempt?, timeSpentDelta? })` persiste respuesta y progreso.
- **Pistas:** `lessonApi.activityHint(lessonId, slideId)`.
- **Cierre:** en la BADGE_REVEAL se otorga la insignia + confeti.
- Avisa antes de salir ("tu progreso se guardará en el último checkpoint").

## B.6 Mapa de código (Lección)
- **Reproductor:** `apps/web/src/components/LessonPlayer.tsx`.
- **Bloques interactivos + render:** `apps/web/src/components/lesson/InteractiveBlocks.tsx`.
- **Bloques de contenido:** `apps/web/src/components/lesson/blocks.tsx`.
- **Corrección pura:** `apps/web/src/components/lesson/grading.ts`
  (+ `crossword.ts`, `wordsearch.ts`).
- **Escenario/animación:** `apps/web/src/components/lesson/Stage.tsx`.
  **Multimedia:** `apps/web/src/components/media/SmartMedia.tsx`.
- **Editor del docente:** `apps/web/src/components/LessonEditor.tsx`.
- **API front:** `lessonApi` en `apps/web/src/lib/api.ts` (~2403):
  `getByActivity`, `getMyProgress`, `start`, `advance`, `activityHint`,
  `generateAI({ topic, content, gradeName?, subjectName? })`.
- **Backend:** `apps/api/src/modules/classroom/lesson.service.ts` (progreso,
  advance, hints, generación con IA) + `classroom.controller.ts`.

## B.7 Notas útiles para ajustes
- La **generación con IA** (Valeria) crea la lección desde `topic`/`content`; en
  rutas, reutiliza `instructions` + `sourceMaterial` de la `LearningRoute`.
- El **motor de bloques** convive con el **render legacy**: al tocar el editor,
  respetar que `blocks` vacío → se usan `body/imageUrl/videoUrl`.
- La corrección es **cliente-side pura** (`grading.ts`); el backend guarda la
  respuesta y el `isCorrect`/`points` que llegan en `advance`.
- Hay documentación relacionada: `docs/AUDITORIA_LECCIONES_INTERACTIVAS.md`.
