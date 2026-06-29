# Diseño Pedagógico IA — Documento Fundacional de Producto

> CPO + Principal UX + Software Architect.
> Estado: PROPUESTA (sin código). Fuente de verdad del módulo.
> Relacionado: `VISION_PRODUCTO_2030.md`, `MI_ESPACIO_DOCENTE_MASTER.md`, `REDISENO_AULA_VIRTUAL_2026.md`.
> Última actualización: 2026-06-29.

---

## Resumen ejecutivo (la tesis en una frase)

**Edusyn no genera documentos: genera Activos Pedagógicos Vivos (APV)** — objetos estructurados que viven dentro del ecosistema, se descomponen en piezas ejecutables (actividades del aula, quizzes, proyectos, lecciones, preguntas, rúbricas, juegos de Play), recogen evidencia real de uso (notas, asistencia, participación, resultados) y esa evidencia retroalimenta a la IA para proponer la siguiente versión.

El valor **no** está en el texto generado por el LLM (eso es commodity: ChatGPT/Gemini/Claude ya lo hacen). El valor está en **el grafo de relaciones + el ciclo de evidencia dentro del sistema académico**. Eso es lo que ningún LLM externo puede copiar: no tiene el PEI, ni el currículo, ni las notas, ni la ejecución en el aula de esa institución.

> **El moat no es la generación. Es la ejecución y el aprendizaje conectados.**

---

## Nombre del módulo

Provisional: **Diseño Pedagógico IA**. Alternativas propuestas (todas en lenguaje docente):

| Nombre | Lectura | Nota |
|---|---|---|
| **Estudio** (de Valeria) | "Voy a mi Estudio a diseñar la clase" | Corto, memorable, evoca taller creativo. **Recomendado.** |
| **Diseño Pedagógico** | Claro y formal | Seguro, descriptivo, menos diferenciador como marca |
| **Forja** | "Forjar una unidad" | Potente pero quizá demasiado metafórico |
| **Taller de Aprendizaje** | Familiar para el docente | Bueno; puede confundirse con "taller" como tipo de guía |

Recomendación: **"Estudio"** como nombre de marca del módulo, con **Valeria** como la copiloto que trabaja contigo dentro del Estudio. En la navegación puede leerse "Estudio · Diseño Pedagógico" hasta que la marca prenda.

---

## 1. Visión del módulo

El Estudio es el lugar donde un docente **piensa el aprendizaje**, no donde redacta papeles. Es el cerebro pedagógico del Espacio Docente.

- **Para el docente:** un copiloto que convierte una idea ("Pensamiento Computacional, 6°, 2 sesiones") en una experiencia de aprendizaje completa, editable y conectada — en minutos, no horas.
- **Para la institución:** un repositorio vivo de saber pedagógico propio, alineado a su PEI y su currículo, que mejora con cada cohorte.
- **Para Edusyn:** el diferenciador estructural frente a cualquier LMS. Classroom/Moodle/Canvas distribuyen contenido; Edusyn **diseña, ejecuta y aprende** del proceso.

**Reencuadre (feedback CPO, 2026-06-29):** el Estudio no es un módulo, es un **Sistema Operativo Pedagógico**. El Activo Pedagógico Vivo (APV) deja de ser "un documento con bloques" y pasa a ser **un proyecto compuesto de objetos inteligentes** — unidades atómicas (una pregunta detonante, una actividad, una rúbrica) que pueden *re-representarse* como muchas experiencias distintas sin volver a llamar a la IA (ver §22 Learning Composer y §23 Objetos Inteligentes). Cada APV lleva además un **ADN Pedagógico** (§24) que lo hace clasificable, buscable y analizable a escala.

Edusyn NO es un LMS. El Estudio refuerza esa tesis: todo lo que se diseña aquí **alimenta la plataforma académica** (notas, logros, competencias, analítica), no un silo aparte.

---

## 2. Filosofía

1. **La IA propone, el docente decide.** Nada se publica, califica o envía sin acción explícita del docente. La IA nunca toca el core académico por su cuenta.
2. **Activo vivo, no documento muerto.** El PDF es una *exportación*, no el producto. El producto vive en el Workspace, se versiona y se reutiliza.
3. **Diseñar es descomponer.** Cada bloque del activo (una actividad, un quiz, una rúbrica) es una pieza que puede *convertirse* en un objeto real del ecosistema, sin copiar/pegar.
4. **Conocimiento institucional primero, LLM después.** Valeria piensa como un docente *de esa institución*: usa PEI, currículo, recursos y evidencia antes que el conocimiento genérico del modelo.
5. **El plan nunca termina.** Después de usarse, recoge evidencia y propone su propia mejora. Cada versión es mejor porque tiene datos reales, no solo más IA.
6. **Privado por defecto, compartible por decisión.** El activo es del docente; compartir con el área/institución es una acción opt-in.

---

## 3. Flujo completo

```
   IDEA DEL DOCENTE
        │  "Plan sobre Pensamiento Computacional, 6°, 2 sesiones"
        ▼
   VALERIA DISEÑA  ──► usa contexto institucional (PEI, currículo, recursos, evidencia)
        │            produce un Activo Pedagógico estructurado (JSON), no texto plano
        ▼
   EL DOCENTE EDITA ──► bloque por bloque; acepta, reescribe, pide variantes
        │
        ▼
   SE GUARDA (Workspace del curso) ──► estado BORRADOR
        │
        ▼
   SE VERSIONA  ──► v1, v2… cada cambio relevante queda trazado
        │
        ▼
   SE DESCOMPONE  ──► cada bloque se "convierte" en objeto del ecosistema:
        │              actividad de aula · quiz/evaluación · proyecto · lección ·
        │              pregunta al banco · rúbrica · juego de Play · foro
        ▼
   SE EJECUTA EN EL AULA  ──► el docente publica/agenda cuando quiere (no obligatorio)
        │
        ▼
   RECOGE EVIDENCIA  ──► notas, asistencia, participación, resultados de quizzes
        │
        ▼
   VALERIA PROPONE MEJORAS  ──► "la actividad 3 tuvo baja participación; sugiero…"
        │
        ▼
   NUEVA VERSIÓN  ──► el activo aprende. Vuelve al ciclo, mejor que antes.
        │
        ▼
   BIBLIOTECA INSTITUCIONAL  ──► compartir, clonar, adaptar (opt-in)
```

El principio rector del flujo: **un sentido de embudo en la creación (idea → activo) y un sentido de abanico en la ejecución (activo → muchos objetos del ecosistema)**.

---

## 4. Arquitectura conceptual

Tres capas, todas sobre infraestructura existente:

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 · DISEÑO (el Estudio)                                     │
│  Activo Pedagógico Vivo (APV) = objeto estructurado + versiones   │
│  Vive como WorkspaceItem(kind=PEDAGOGICAL_DESIGN) + metadata JSON  │
└───────────────┬───────────────────────────────────────────────────┘
                │  "convertir" (no copiar)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2 · EJECUCIÓN (objetos reales del ecosistema)               │
│  ClassroomActivity · Lesson/LessonSlide · ActivityQuestion ·      │
│  AttitudinalRubric · WorkspaceProject · LiveSession (Play)        │
│  Cada objeto guarda su "origen" (designId, blockId)               │
└───────────────┬───────────────────────────────────────────────────┘
                │  evidencia (notas, asistencia, submissions, participación)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3 · APRENDIZAJE (el ciclo que cierra)                       │
│  Agregación de resultados → señales → Valeria propone v+1         │
│  Reusa analítica académica existente (notas/asistencia/quizzes)   │
└───────────────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────────┐
         │  ORQUESTADOR DE IA (transversal)          │
         │  enruta tarea → modelo según tier + costo │
         │  (ver §21)                                │
         └──────────────────────────────────────────┘
```

**Pieza nueva mínima:** el "APV" como tipo de WorkspaceItem + una tabla de versiones + una tabla de "enlaces de origen" (qué objeto del ecosistema nació de qué bloque). Todo lo demás se reutiliza.

---

## 5. UX

Principios:
- **Lienzo, no formulario.** El docente ve el activo como una secuencia de bloques editables (estilo documento estructurado), no un wizard de 12 pasos.
- **Conversación al margen.** Valeria vive en un panel lateral: "reescribe el cierre más corto", "agrega una actividad sin computador", "hazlo para 7° en vez de 6°". Cada respuesta modifica el bloque, no abre un chat aparte.
- **Acciones por bloque.** Cada bloque tiene un menú "Convertir en →" (actividad, quiz, proyecto, rúbrica, pregunta, lección, juego).
- **Estado siempre visible.** Borrador / En uso / Evaluado / Mejorable, con un sello claro arriba.
- **Cero pérdida.** Autoguardado + versiones. El docente nunca teme "dañar" el plan.
- **Móvil:** lectura y ediciones puntuales en celular; diseño profundo en desktop.

Tono de Valeria: colega docente, no robot. Propone, justifica brevemente, ofrece alternativas, jamás impone.

---

## 6. Wireframes (ASCII)

### 6.1 Inicio del Estudio (dentro de un curso)

```
┌───────────────────────────────────────────────────────────────┐
│  ← Octavo B                                  Estudio · Valeria  │
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│   ¿Qué quieres diseñar hoy?                                     │
│   ┌─────────────────────────────────────────────────────────┐ │
│   │ Plan sobre Pensamiento Computacional, 6°, 2 sesiones…    │ │
│   └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│   Tipo de experiencia:                                          │
│   [Plan de clase] [Secuencia] [Proyecto ABP] [STEAM]            │
│   [Clase invertida] [Reto] [Taller] [Lección] [Unidad] …        │
│                                                  [✨ Diseñar]    │
│                                                                 │
│   ─ Tus diseños recientes ─────────────────────────────────    │
│   📐 Pensamiento Computacional   v3 · En uso   · 6°            │
│   🧪 Laboratorio de Ecosistemas  v1 · Borrador · 7°            │
│   🎯 Reto: Agua y Comunidad      v2 · Evaluado · 8°  ⭐mejorable│
└───────────────────────────────────────────────────────────────┘
```

### 6.2 Lienzo del Activo Pedagógico (vista de diseño)

```
┌──────────────────────────────────────────┬──────────────────────┐
│  📐 Pensamiento Computacional   [v3 ▾]     │   Valeria  ✨         │
│  6° · 2 sesiones · En uso                  │ ┌──────────────────┐ │
│  [Versiones] [Compartir] [PDF] [▶ Ejecutar]│ │ "Hazlo sin PC,   │ │
│                                            │ │  somos zona rural"│ │
│  ▸ Identificación                          │ └──────────────────┘ │
│    Área: Tecnología · Grado 6° · 110 min   │  Valeria:            │
│                                            │  "Reemplacé la act.  │
│  ▸ Competencias / DBA / Estándares  [⚠ rev]│   2 por una          │
│    • Pensamiento algorítmico (texto)       │   'desconectada' con │
│                                            │   tarjetas. ¿La      │
│  ▸ Objetivos · Resultados · Nivel Bloom    │   aplico?"           │
│    Comprender (B2) · Aplicar (B3)          │   [Aplicar] [Ver]    │
│                                            │                      │
│  ▾ Momentos de la clase                    │  Sugerencias:        │
│   ┌────────────────────────────────────┐  │  • Agregar evidencia │
│   │ INICIO (20m) · Exploración          │  │  • Crear rúbrica     │
│   │  Pregunta: ¿cómo le explicarías a   │  │  • Variante 7°       │
│   │  un robot a hacer un sándwich?      │  │                      │
│   │            [Convertir en ▾] [✎] [⟳] │  │                      │
│   ├────────────────────────────────────┤  │                      │
│   │ DESARROLLO (60m) · Estructuración   │  │                      │
│   │  Act 1: Algoritmo del sándwich      │  │                      │
│   │  Act 2: Tarjetas de secuencia       │  │                      │
│   │            [Convertir en ▾] [✎] [⟳] │  │                      │
│   ├────────────────────────────────────┤  │                      │
│   │ CIERRE (30m) · Transferencia        │  │                      │
│   │  Quiz corto + ticket de salida      │  │                      │
│   │            [Convertir en ▾] [✎] [⟳] │  │                      │
│   └────────────────────────────────────┘  │                      │
│                                            │                      │
│  ▸ Evaluación · Rúbrica · Evidencias       │                      │
│  ▸ Ajustes DUA (inclusión)                 │                      │
└──────────────────────────────────────────┴──────────────────────┘
```

### 6.3 Menú "Convertir en →" (el abanico)

```
        [Convertir en ▾]
        ├─ 📋 Actividad del Aula Virtual (TASK)
        ├─ ❓ Quiz / Evaluación        (QUIZ/EXAM)
        ├─ 🎮 Juego de Edusyn Play      (LIVE_QUIZ)
        ├─ 🚀 Proyecto                  (WorkspaceProject)
        ├─ 🎬 Lección interactiva       (Lesson + Slides)
        ├─ 💬 Foro                      (FORUM)
        ├─ 🧩 Agregar preguntas al banco
        └─ 📐 Rúbrica de evaluación
```

### 6.4 Diálogo de ejecución (al "Convertir en actividad")

```
┌───────────────────────────────────────────────┐
│  Enviar "Algoritmo del sándwich" al Aula        │
│                                                 │
│  Aula:   [ Octavo B ▾ ]                         │
│  Ruta:   ( ) Nueva ruta  (•) Unidad 2: Lógica   │
│  Cuándo: (•) Borrador  ( ) Publicar  ( ) Agendar│
│  Califica: [✓] crea evaluación  Máx [5.0]       │
│                                                 │
│  Valeria publica como borrador por defecto.     │
│              [Cancelar]   [Enviar al aula]      │
└───────────────────────────────────────────────┘
```

### 6.5 Cierre del ciclo (sugerencia post-evidencia)

```
┌───────────────────────────────────────────────┐
│ ⭐ Este diseño tiene evidencia nueva            │
│                                                 │
│ • Quiz de cierre: promedio 3.1/5 (18 estud.)    │
│ • Concepto más fallado: "abstracción" (62%)     │
│ • Actividad 2: participación baja (registrada)  │
│                                                 │
│ Valeria propone para la v4:                     │
│  – Reforzar "abstracción" con un ejemplo previo │
│  – Cambiar la act. 2 por trabajo en parejas     │
│                                                 │
│        [Ver propuesta]   [Crear v4]   [Ignorar] │
└───────────────────────────────────────────────┘
```

---

## 7. Componentes (frontend)

Reutiliza el patrón de `WorkspaceV2/` (módulos, secciones, modales).

- `EstudioModule` — entrada del módulo dentro de `SpaceDetail` (registrado en `moduleRegistry`).
- `DesignCanvas` — lienzo de bloques del APV.
- `BlockCard` — bloque editable + menú "Convertir en →".
- `ValeriaPanel` — panel lateral conversacional (reusa el cliente de Valeria).
- `ConvertSheet` — diálogo de conversión a objeto del ecosistema (aula/quiz/proyecto…).
- `VersionTimeline` — historial de versiones + diff legible.
- `EvidencePanel` — muestra señales de uso y dispara propuestas de mejora.
- `ExperienceTypePicker` — selector de tipo (plan, ABP, STEAM…).
- `LibraryBrowser` — biblioteca institucional (compartir/clonar/adaptar).
- Exportación PDF: reusa la infraestructura de reportes.

---

## 8. Modelo de datos conceptual

Aditivo (sin DROP), en línea con la política de migraciones del proyecto.

```
PedagogicalDesign            // el Activo Pedagógico Vivo (cabecera)
  id, teacherId, institutionId
  boardId            -> WorkspaceBoard (curso donde vive; opcional si personal)
  subjectId?, gradeId?, groupId?
  experienceType     // LESSON_PLAN | SEQUENCE | PBL | STEAM | FLIPPED | CHALLENGE |
                     // WORKSHOP | LAB | EVALUATION | INTERACTIVE_LESSON | UNIT
  title, summary
  status             // DRAFT | IN_USE | EVALUATED | IMPROVABLE | ARCHIVED
  currentVersionId   -> PedagogicalDesignVersion
  visibility         // PRIVATE | AREA | INSTITUTION (biblioteca)
  sourceDesignId?    // si fue clonado de otro (linaje)
  aiProviderUsed, aiModelUsed, aiTokens   // trazabilidad de costo
  createdAt, updatedAt

PedagogicalDesignVersion     // cada versión inmutable del contenido
  id, designId
  versionNumber
  content        Json        // el objeto estructurado completo (ver abajo)
  changeNote                 // "v4: reforcé abstracción tras evidencia"
  createdBy      // teacher | valeria
  evidenceSnapshot Json?      // señales que motivaron la versión
  createdAt

PedagogicalBlock (lógico, dentro de content.blocks[])  // no necesariamente tabla
  blockId, kind   // IDENTIFICATION | COMPETENCY | OBJECTIVE | MOMENT | ACTIVITY |
                  // PRODUCT | EVALUATION | RUBRIC | DUA | RESOURCE | EVIDENCE
  data Json
  bloomLevel?, timeMinutes?

PedagogicalLink              // el grafo: bloque -> objeto real del ecosistema
  id, designId, versionId, blockId
  targetType     // CLASSROOM_ACTIVITY | LESSON | QUESTION | RUBRIC | PROJECT |
                 // PLAY_SESSION | FORUM
  targetId       // id del objeto creado
  createdAt
  // permite: trazar evidencia de vuelta y evitar duplicar al re-ejecutar
```

`content` (JSON estructurado que produce la IA), forma conceptual:

```
{
  "identification": { area, subject, grade, sessions, totalMinutes },
  "framework": { competencies[], dba[], standards[] },   // hoy texto; futuro: ids
  "learning": { objectives[], outcomes[], bloomLevels[] },
  "moments": [ { phase:"INICIO", minutes, description, activities[] }, … ],
  "activities": [ { title, description, type, minutes, product } ],
  "evaluation": { type, criteria[], evidences[] },
  "rubric": { criteria:[ { name, levels:[ {label, descriptor, score} ] } ] },
  "dua": { barriers[], adjustments[] },          // se conecta con APD
  "resources": [ { name, url? } ]
}
```

### 8.1 Objetos Inteligentes (`LearningObject`) — el corazón del Composer

La idea de "objetos inteligentes" de la visión exige que los bloques **no** sean solo texto dentro del JSON: deben ser unidades atómicas normalizadas y reutilizables. Una pregunta detonante es un objeto; una actividad es un objeto; una rúbrica es un objeto. El Learning Composer (§22) **cambia su representación** (a quiz, foro, juego, podcast…) sin re-llamar al LLM.

```
LearningObject              // unidad pedagógica atómica y reutilizable
  id, designId, versionId, blockId
  kind            // PROMPT(detonante) | CONTENT | TASK | QUESTION | RUBRIC |
                  // PRODUCT | RESOURCE | EVIDENCE | DISCUSSION
  payload  Json   // representación canónica e independiente del formato
  dna      Json   // ADN heredado/propio (ver §24): bloom, competencia, etc.
  reusable Boolean // puede vivir fuera de este APV (biblioteca de objetos)
  createdAt
```

El `payload` es **canónico** (qué se quiere lograr), no un formato concreto. El Composer aplica "vistas": el mismo `PROMPT` "¿por qué un robot necesita instrucciones?" se proyecta como pregunta oral, encuesta, post de foro, ítem de quiz o pregunta de un juego de Play — todas derivadas, sin costo de IA.

### 8.2 ADN Pedagógico (`dna`)

Metadato estructurado en cada APV y cada `LearningObject`. **Barato de guardar, altísimo retorno**: habilita búsqueda, filtrado y analítica a escala **sin IA**.

```
dna {
  topic[], competencies[], dba[], difficulty,
  bloomLevels[], methodology[]  // ABP | STEAM | FLIPPED | COOP | …
  cognitiveLevel, evaluationType, evidenceType,
  resources[], dominantEmotion,                 // del feedback CPO
  work: { individual?, collaborative? },
  usesAI, usesICT, estimatedMinutes
}
```

> Decisión de arquitecto: el **ADN se implementa desde E1** aunque el Composer y los Agentes lleguen después. Retro-etiquetar miles de diseños luego es carísimo; etiquetar desde el día 1 es gratis y vuelve toda la biblioteca consultable cuando crezca.

> **Nota arquitectónica:** mantener el contenido como JSON versionado (no tablas por bloque) hace barata la versión, la edición y la evolución del esquema. Las *tablas* reales solo aparecen cuando un bloque se "convierte" en objeto ejecutable (vía `PedagogicalLink`).

---

## 9. Integración con Workspace

- El APV vive en el **espacio del curso** (`WorkspaceBoard`) como módulo "Estudio". También en el **espacio personal** (diseños sin curso).
- Aparece en la búsqueda global (`globalSearch`) y en "actividad reciente".
- Reusa el sistema de **archivado/restaurar** ya construido.
- Los **recursos** del activo pueden referenciar la Biblioteca (`WorkspaceResource`) existente.
- Un APV puede generar un **WorkspaceProject** (módulo Proyecto ya existe) cuando el tipo es ABP/Reto.

## 10. Integración con Aula Virtual (Classroom)

- "Convertir en actividad" → `createActivity()` (`classroom.service.ts:477`) en la sección/ruta que el docente elija. `PedagogicalLink` guarda el vínculo.
- Respeta la filosofía del Aula: **no obliga a publicar**. Acciones: Borrador / Publicar / Agendar / Agregar a ruta existente / Nueva ruta.
- Tipos soportados de salida: `TASK`, `QUIZ`, `EXAM`, `FORUM`, `LESSON`, `LIVE_QUIZ`, `HOME_QUIZ`.
- Una **Lección** del activo → `Lesson` + `LessonSlide` (modelos existentes), publicable en Classroom. (Cierra el gap detectado: hoy las Lecciones no usan LLM; aquí nacen con IA.)

## 11. Integración con Evaluaciones

- Un quiz/examen del activo → `ClassroomActivity(QUIZ/EXAM)` con `ActivityQuestion[]` (Valeria ya genera preguntas hoy).
- Al calificarse, las notas fluyen al **core académico** por los caminos existentes (no se inventa nada): la evaluación es una actividad real del aula que ya alimenta notas/logros.
- La **rúbrica** del activo → `AttitudinalRubric`/`AttitudinalCriterion`/`CriterionLevel` (existen) o rúbrica académica vía `rubricId` de la actividad.

## 12. Integración con Banco de Preguntas

- **Estado real:** hoy las preguntas viven por actividad (`ActivityQuestion`, `QuestionContext`); **no hay** un banco transversal todavía.
- **Propuesta:** introducir un banco institucional (`QuestionBankItem`) reutilizable, y que "Agregar al banco" desde un bloque alimente ese banco con tags (tema, grado, competencia, dificultad, nivel Bloom).
- Beneficio compuesto: cada diseño enriquece el banco; el banco mejora los siguientes diseños. Es un activo institucional que crece solo.

## 13. Integración con Edusyn Play

- Un bloque de actividad lúdica/quiz → `LiveSession` (Play) como juego en vivo o reto.
- Valeria puede sugerir "esto funciona mejor como juego de Play" según el momento de la clase (ej. repaso, cierre).
- La participación y resultados de Play vuelven como **evidencia** (capa 3).

## 14. Integración con Competencias

- **Estado real:** competencias/DBA/estándares **no** son entidades de primer nivel hoy (serían texto en el activo).
- **Propuesta de evolución (alineada a VISION_2030 "grafo de competencias"):**
  - Fase temprana: el activo guarda competencias/DBA como texto + tags.
  - Fase media: catálogo institucional de competencias/DBA (entidad) → el activo *enlaza* a ellas.
  - Fase avanzada: cada actividad/evaluación reporta evidencia por competencia → mapa de dominio por estudiante (el grafo). Aquí el Estudio se vuelve el alimentador natural del grafo.

## 15. Integración con Analítica

- Cada `PedagogicalLink` permite atribuir resultados (notas, asistencia, submissions, participación) **de vuelta** al bloque que los originó.
- Métricas del activo: tasa de finalización, promedio del quiz, conceptos más fallados, participación por actividad.
- Métricas institucionales: qué diseños funcionan mejor, qué áreas tienen más actividad, reutilización de la biblioteca.
- Reusa fuentes existentes (notas, asistencia, submissions); no crea un pipeline nuevo de datos.

## 16. Integración con Valeria

- Reusa `ApdAiService.callLlmJson()` y el patrón de `answerTeacherQuestion()`.
- **Nuevos "moldes" (prompts + interfaces TS):** uno por tipo de experiencia (plan, ABP, STEAM, etc.), todos devolviendo el `content` estructurado.
- **Contexto institucional inyectado** (RAG ligero): PEI/currículo (texto institucional), recursos del Workspace, evaluaciones/observaciones previas, evidencia del propio activo. Esto es lo que hace que Valeria "piense como docente de esa institución".
- Valeria opera en dos modos: **generativo** (crear/variar bloques) y **reflexivo** (leer evidencia → proponer v+1).

## 17. Estados del objeto pedagógico

```
DRAFT ───► IN_USE ───► EVALUATED ───► IMPROVABLE ───► (nueva versión) ──┐
  ▲           │            │              │                              │
  └───────────┴────────────┴──────────────┴──────────────────────────────┘
                         ARCHIVED (en cualquier momento, reversible)
```

- **DRAFT:** diseñado, aún no ejecutado.
- **IN_USE:** tiene al menos un `PedagogicalLink` publicado en el aula.
- **EVALUATED:** llegó evidencia (notas/resultados).
- **IMPROVABLE:** la evidencia disparó una propuesta de mejora de Valeria.
- **ARCHIVED:** fuera de circulación, recuperable (reusa archivado de Workspace).

## 18. Sistema de versiones

- Versiones **inmutables** (`PedagogicalDesignVersion`): cada cambio relevante crea una.
- `changeNote` legible + `evidenceSnapshot` (qué datos motivaron la versión).
- `VersionTimeline` con diff por bloque ("v4: reemplazó act. 2; reforzó abstracción").
- Autor de la versión: docente o Valeria (trazabilidad).
- Permite **revertir** y **comparar** sin miedo (consistente con la cultura "cero pérdida" del proyecto).

## 19. Biblioteca institucional

- Visibilidad `PRIVATE → AREA → INSTITUTION`. Compartir es opt-in.
- Acciones: **compartir, clonar, adaptar, versionar.** Clonar guarda linaje (`sourceDesignId`).
- Curaduría: coordinación/rectoría puede destacar diseños modelo alineados al PEI.
- Roadmap lejano: **marketplace docente** (intercambio/reconocimiento entre instituciones) y **repositorio institucional** como activo de la institución.
- Esto crea un **efecto de red**: a más diseños compartidos, más valioso el Estudio — difícil de copiar para un competidor que empieza vacío.

---

## 20. Roadmap por fases

> Todo en `staging` primero; cada fase funcional, responsive y probada. Sin tocar el core académico salvo por los caminos ya existentes (actividades/notas).

| Fase | Nombre | Entrega | Depende de |
|---|---|---|---|
| **E0** | Cimientos | Modelo `PedagogicalDesign` + `…Version` + `…Link` (migración aditiva). Orquestador de IA mínimo (§21). | — |
| **E1** | Diseñar + Editar + Guardar | Lienzo, generación de "Plan de clase" estructurado, edición por bloque, guardado en el curso. | E0 |
| **E2** | Versiones + PDF | Historial de versiones, diff, exportación PDF. | E1 |
| **E3** | Ejecutar (abanico v1) | "Convertir en" Actividad/Quiz del Aula + `PedagogicalLink`. | E1, Classroom |
| **E4** | Más tipos de experiencia | ABP, secuencia, taller, clase invertida, STEAM… (moldes nuevos). | E1 |
| **E5** | Ejecutar (abanico v2) | Lección+Slides, Proyecto, Play, Foro, banco de preguntas. | E3 |
| **E6** | Ciclo de evidencia | Atribución de resultados → propuestas de mejora (estado IMPROVABLE). | E3, Analítica |
| **E7** | Biblioteca institucional | Compartir/clonar/adaptar + curaduría. | E1 |
| **E8** | Competencias + grafo | Catálogo de competencias/DBA → enlace y evidencia por competencia. | core académico |
| **E9** | Premium IA + marketplace | Tiers de IA por institución, marketplace docente. | §21 |

---

## 21. Costo de IA y Orquestador (modelos gratis vs. premium)

### El problema
Generar diseños ricos cuesta tokens. Los modelos gratis (OpenRouter free / Gemini Flash) sirven para validar y para el plan base, pero un activo pedagógico de calidad se beneficia de modelos más fuertes. No todas las instituciones pagarán lo mismo.

### La solución: Orquestador de IA por institución y por tarea
Una capa de enrutamiento sobre el `ApdAiService` actual (que ya soporta multi-proveedor):

```
            ┌──────────────────────────────────────────────┐
   tarea ──►│  ORQUESTADOR                                  │
   (diseñar │  1. Lee el TIER de la institución (free/prem) │
    plan)   │  2. Lee la complejidad de la tarea            │
            │  3. Verifica cuota/presupuesto del mes        │
            │  4. Elige modelo y hace fallback si falla     │
            │  5. Mete el resultado en caché (igual prompt) │
            │  6. Registra tokens/costo (metering)          │
            └──────────────────────────────────────────────┘
                 │free                       │premium
                 ▼                           ▼
   OpenRouter free cascade / Gemini Flash    Gemini Pro / GPT-4-class / Claude
```

### Tiers (por institución)
| Tier | Modelos | Cuota mensual | Caso |
|---|---|---|---|
| **Free** | OpenRouter free + Gemini Flash | N generaciones/mes con caché agresivo | Instituciones en evaluación o plan básico |
| **Premium** | + modelo de pago fuerte (Pro/GPT/Claude) | Cuota amplia, prioridad, menos espera | Instituciones que pagan el servicio premium de IA |
| **(futuro) BYOK** | La institución trae su propia API key | Su propio costo | Instituciones grandes con presupuesto propio |

### Piezas técnicas (aditivas, reutilizan lo existente)
- **Config por institución:** `InstitutionAiPlan { tier, monthlyQuota, modelOverride?, apiKeyRef? }`. Hoy la config es global por env (`APD_AI_PROVIDER/KEY`); se extiende a *por institución*.
- **Metering:** registrar `aiTokens`/`aiModelUsed`/`aiProviderUsed` (ya previsto en `PedagogicalDesign`). Dashboard de consumo para superadmin.
- **Caché:** ya existe `enableCaching`/`cacheTtl` en `ApdAiService`; aprovecharlo para prompts equivalentes (mismo tema/grado/tipo).
- **Degradación elegante:** si premium falla o se agota cuota → cae a free con aviso transparente ("generado con el modelo básico").
- **Selección por complejidad:** un "plan de clase simple" puede ir a free aun en premium; una "unidad completa STEAM" reserva el modelo fuerte. Optimiza costo sin que el docente lo note.

### Modelo de negocio
- La IA premium es **una palanca de upsell** natural del SaaS: el core académico es la base; el Estudio con IA premium es valor adicional medible.
- El metering permite tarifar con datos reales (por institución/mes) y evitar sorpresas de costo.

---

## Por qué esto es difícil de copiar (cierre estratégico)

1. **No vende generación, vende ejecución conectada.** Un LLM externo genera el texto; solo Edusyn lo convierte en actividades reales, las califica, y devuelve evidencia.
2. **El ciclo de evidencia es un foso de datos.** Cada cohorte mejora los diseños con datos que solo Edusyn tiene.
3. **La biblioteca institucional crea efecto de red.** El valor crece con el uso; un competidor nuevo empieza vacío.
4. **Piensa con el contexto institucional.** PEI + currículo + historial = una IA que no es genérica.
5. **Encaja en la tesis de Edusyn:** no es un LMS con IA pegada; es gestión educativa donde el diseño pedagógico **alimenta** notas, logros, competencias y analítica.

> Edusyn no genera documentos. Genera **conocimiento pedagógico vivo conectado con todo el ecosistema** — y aprende.

---

# PARTE II — Ampliación estratégica (feedback CPO, 2026-06-29)

> Esta parte eleva el módulo de "Sistema de diseño con IA" a **Sistema Operativo Pedagógico**. Sigue siendo PROPUESTA; refina la dirección antes de escribir código. Las capacidades más avanzadas se consolidan en la **Visión 2035** (capítulo final).

## 22. Learning Composer (el motor, no la acción)

El "Convertir en →" deja de ser una acción y se vuelve un **motor**. El docente no piensa "convertir"; piensa **"¿cómo quiero usar esto?"**. El Composer toma un `LearningObject` canónico (§8.1) y lo **proyecta** en cualquier formato del ecosistema:

```
        LearningObject (canónico)
                │
   ┌────────────┼───────────────────────────────────────────┐
   ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
 Activ. Juego Foro Quiz Video Lab Lección Reto Taller Podcast Debate
 (Aula) (Play)(Aula)(Eval)(rec) ...   (Lesson)        ...
```

- **Sin re-llamar al LLM** para las transformaciones estructurales (cambia la representación, no el contenido). La IA solo entra si el docente pide *enriquecer* ("hazlo más difícil").
- **Ahorra costo** (clave para §21) y es **instantáneo**.
- UX: el menú por bloque pasa a llamarse **"Usar como…"** en vez de "Convertir en".
- Implicación técnica: exige `LearningObject` con `payload` canónico (por eso §8.1 existe). Este es el cambio de arquitectura más importante que introduce tu feedback.

## 23. Objetos Inteligentes

Cada bloque es un objeto vivo y reutilizable (modelo en §8.1). Consecuencias:
- Un objeto puede vivir **fuera** de su APV original (biblioteca de objetos, no solo de diseños).
- Un mismo objeto puede aparecer en varios diseños (reutilización real, no copia).
- La evidencia se atribuye **al objeto** (esta pregunta detonante funciona; este quiz no), no solo al diseño → base del Sistema Adaptativo (§31).

## 24. ADN Pedagógico

Definido en §8.2. Es la capa que hace al sistema **consultable sin IA**:
> "Muéstrame todas las clases de 6° que usan ABP + pensamiento crítico." → simple consulta sobre `dna`, instantánea, gratis.

Habilita: búsqueda avanzada, analítica institucional, recomendación (§28), curaduría, y reportes de rectoría por metodología/competencia.

## 25. Memoria Pedagógica (del docente)

Valeria aprende el **estilo** de cada docente, no solo el contexto institucional.

```
TeacherPedagogicalMemory
  teacherId
  preferences Json   // "prefiere colaborativo", "evita tareas largas",
                     // "cierra con Kahoot", "usa Canva", tono, duración…
  derivedFrom        // inferido de sus diseños + ediciones (con evidencia)
  editable  true     // el docente ve y corrige su perfil
  updatedAt
```

**Guardrails (no negociables):**
- **Editable y transparente:** el docente ve su perfil y lo corrige o borra.
- **Opt-in y no invasiva:** se puede desactivar.
- **Nunca evaluativa:** la memoria pedagógica **jamás** alimenta evaluación del desempeño docente ni reportes a rectoría. Es asistencia personal, no vigilancia. (Crítico: Edusyn también gestiona lo institucional; la confianza del docente depende de esta separación.)

## 26. Agentes IA (ejecución autónoma)

Valeria deja de solo responder y empieza a **trabajar**.

```
Docente: "Necesito una unidad de 4 semanas sobre Ecosistemas, 7°."
Valeria: "Listo. Mientras sigues, preparo:"
   ⏳ guía docente · guía estudiante · presentación · rúbrica · quiz ·
      actividades Play · actividad de Aula · recursos · banco de preguntas · cronograma
   → (al terminar) "Tu unidad está lista: 10 piezas. Revísalas." 
```

- Es **orquestación de tareas asíncronas**, no un chat. Requiere infra de *jobs* en background + control de costo (se apoya en el Orquestador §21; un agente puede consumir muchos tokens → solo tiers premium o con cuota).
- Sigue el principio: produce **borradores**; el docente revisa y decide qué publicar.
- Capacidad de **Visión 2035** (la más exigente técnica y económicamente).

## 27. Modo Presentación

Antes del PDF está **enseñar desde Edusyn**. El APV se proyecta como presentación navegable (estilo Notion/Gamma/Canva) — el docente da la clase desde la plataforma, sin descargar nada.

- Reusa la estructura de bloques/momentos como "slides".
- Conecta con **Live**: lo que se presenta puede lanzar un quiz en vivo o un juego de Play en el momento.
- El PDF queda como **exportación**, no como el medio principal. Refuerza la tesis "activo vivo, no documento muerto".

## 28. Biblioteca Inteligente (recomienda, no solo comparte)

La biblioteca (§19) se vuelve activa gracias al ADN (§24):
```
Docente crea "Pensamiento Computacional", 6°.
IA (sin generar): "Hay 37 diseños similares en tu institución.
                   ¿Quieres inspirarte en estos 3 mejor evaluados?"
```
- Recomendación por **contexto + currículo + perfil docente** (memoria §25) + **evidencia** (qué diseños dieron mejores resultados).
- Efecto de red: a más diseños, mejores recomendaciones → foso de datos.

## 29. Gamificación del docente (por impacto, no por cantidad)

Gamificar no solo a estudiantes; también a docentes — **premiando aprendizaje, no volumen**.

- **Niveles pedagógicos:** Explorador → Innovador → Arquitecto → Mentor → Maestro → Visionario.
- **Insignias:** diseño reutilizado por colegas, diseño destacado por coordinación, alta participación lograda, mejora basada en evidencia.
- **Métrica rectora = impacto:** no "100 actividades creadas", sino "esta unidad subió 18% la comprensión". Evita el incentivo perverso de producir por producir.
- **Cuidado de diseño:** opt-in y sin rankings públicos punitivos; reconoce, no avergüenza.

## 30. Integración total con Edusyn (no solo Aula Virtual)

El APV se conecta con **todo** el ecosistema. Mapa de integraciones (más allá de §9–§16):

| Sistema | Cómo lo alimenta / consume el APV |
|---|---|
| **Calificaciones** | Quizzes/evaluaciones del APV → notas reales (vía actividades del Aula) |
| **Asistencia** | Evidencia de ejecución por sesión del plan |
| **Competencias** | El APV declara y luego *evidencia* competencias (camino al grafo, §14) |
| **Observador / APD** | Ajustes DUA del APV ↔ planes de apoyo; señales de dificultad → sugerencias |
| **Reportes / Boletines** | Logros y evidencias generadas desde el APV aparecen en salidas oficiales |
| **Edusyn Play** | Objetos → juegos en vivo; participación vuelve como evidencia |
| **Analítica** | Atribución por `PedagogicalLink`/`LearningObject` → qué funciona |
| **Dashboard Rector** | "¿Qué diseños generan mejores resultados?" — inteligencia institucional |

> Para rectoría esto es oro: por primera vez puede ver **qué prácticas pedagógicas producen mejores aprendizajes**, con datos reales, no percepción.

## 31. Sistema Pedagógico Adaptativo (el horizonte)

Cuando hay evidencia de varias cohortes, el sistema deja de ser "IA generativa" y se vuelve **inteligencia institucional**:

```
Valeria: "En las últimas 3 cohortes, esta actividad produjo +18% en
          comprensión de algoritmos. Recomiendo adoptarla como la
          versión institucional de este tema."
```

- Se apoya en el **ciclo de evidencia** (§6 capa 3) + **ADN** + atribución por objeto.
- **No se puede apresurar:** requiere N cohortes de datos reales. Es honestamente una capacidad de mediano-largo plazo.
- Es el destino natural del moat: el producto mejora **solo**, con datos que ningún competidor externo posee.

---

## Mi lectura como arquitecto (qué acepto, qué secuencio, qué cuido)

- **Acepto sin reservas:** Learning Composer + Objetos Inteligentes + ADN. Son el upgrade que convierte el módulo en plataforma. **Cambian el modelo de datos hoy** (por eso ya están en §8) aunque la UI llegue por fases.
- **Alto valor, bajo costo, va primero:** ADN (§24). Se baja desde E1.
- **Requiere infra y control de costo:** Agentes (§26) → jobs asíncronos + Orquestador (§21). Solo premium/cuota.
- **Requiere tiempo/datos, no código:** Sistema Adaptativo (§31). Llega cuando haya cohortes.
- **Requiere guardrails de confianza:** Memoria Pedagógica (§25) **nunca** evaluativa. Innegociable en una plataforma que también gestiona lo institucional.

---

# Visión 2035 — hacia dónde evoluciona el Estudio

> Capítulo final (a petición del CPO). Describe el destino del módulo en la próxima década. Sirve de norte; no todo se construye ya.

Edusyn evoluciona de **gestionar la educación** a **mejorarla con evidencia**. El Estudio es el órgano donde eso ocurre. Las siete capacidades que definen ese futuro:

1. **Learning Composer** — un mismo diseño se transforma en múltiples experiencias de aprendizaje, al instante y sin costo de IA. *(§22)*
2. **ADN Pedagógico** — clasificar, buscar y analizar diseños a gran escala sin IA. *(§24)*
3. **Memoria Pedagógica** — Valeria aprende el estilo de cada docente (editable, transparente, nunca evaluativa). *(§25)*
4. **Agentes IA** — ejecutan flujos completos y producen múltiples recursos de forma autónoma. *(§26)*
5. **Modo Presentación** — el APV se imparte directamente desde Edusyn, sin depender de PDFs. *(§27)*
6. **Sistema Pedagógico Adaptativo** — usa evidencia institucional para proponer mejoras basadas en resultados reales. *(§31)*
7. **Marketplace + Biblioteca Inteligente** — los diseños no solo se comparten: se **recomiendan** según contexto, currículo y perfil docente; y se intercambian entre instituciones. *(§28, §19)*

### Línea de madurez (capacidad → cuándo)

```
2026 ─ Cimientos: APV + ADN + Composer básico + ejecución a Aula (E0–E3)
2027 ─ Composer completo + Modo Presentación + tipos de experiencia (E4–E5)
2028 ─ Ciclo de evidencia + Biblioteca Inteligente + gamificación (E6–E7)
2029 ─ Agentes IA (premium) + competencias como grafo (E8–E9)
2030+─ Sistema Pedagógico Adaptativo institucional (multi-cohorte)
2035 ─ Inteligencia pedagógica institucional: Edusyn propone el mejor
       diseño para cada tema/grado/grupo con base en años de evidencia real.
```

> En 2035, un rector no pregunta "¿qué plan usó el profesor?", sino **"¿qué diseño produce el mejor aprendizaje para este tema en este contexto?"** — y Edusyn lo responde con evidencia. Eso no es un LMS. Es un Sistema Operativo Pedagógico, y es prácticamente imposible de copiar.
