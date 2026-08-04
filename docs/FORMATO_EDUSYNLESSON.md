# Especificación técnica del formato `.edusynlesson.json`

> Documento de ingeniería inversa del formato de **Lección Interactiva** de Edusyn.
> Objetivo: que otra IA pueda **generar lecciones nuevas desde cero** con la estructura exacta,
> sin volver a inspeccionar un JSON.
>
> **Fuentes de verdad en el código** (no inventadas):
> - Exportador/editor: `apps/web/src/components/LessonEditor.tsx`
> - Motor de bloques de contenido: `apps/web/src/components/lesson/blocks.tsx`
> - Motor + calificación de actividades: `apps/web/src/components/lesson/grading.ts`, `InteractiveBlocks.tsx`
> - Modelo de datos: `apps/api/prisma/schema.prisma` (`Lesson`, `LessonSlide`, `LessonProgress`, `LessonVersion`)
> - Arquitectura: `docs/MOTOR_LECCIONES.md`

---

## 1. Estructura general

El archivo exportado es un JSON producido por `handleExport()` (`LessonEditor.tsx`). Es un **sobre (envelope)** con metadatos de exportación y un objeto `lesson` que contiene el snapshot completo que edita el docente.

### 1.1 Objeto raíz (envelope)

```json
{
  "__edusyn": "lesson",
  "version": 1,
  "exportedAt": "2026-07-30T14:00:00.000Z",
  "lesson": { ... }
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `__edusyn` | string | Sí | Discriminador de formato. **Siempre** el literal `"lesson"`. |
| `version` | number | Sí | Versión del **formato de archivo**. Actualmente `1`. |
| `exportedAt` | string ISO-8601 | Sí | Momento de exportación. |
| `lesson` | object | Sí | El snapshot de la lección (ver §1.2). |

> ⚠️ `version: 1` es la versión del **contenedor**, no de la lección. No confundir con `LessonVersion` (historial de autoguardado en BD).

### 1.2 `lesson` (snapshot)

Es exactamente lo que devuelve `buildSnapshot()`:

```json
{
  "title": "…",
  "description": "…",
  "badgeEmoji": "🏆",
  "badgeTitle": "Lección completada",
  "badgeColor": "#8B5CF6",
  "estimatedMinutes": "20",
  "slides": [ /* array ordenado de slides */ ]
}
```

| Campo | Tipo | Obligatorio | Default | Descripción |
|---|---|---|---|---|
| `title` | string | **Sí** | — | Título de la lección. |
| `description` | string | No | `""` | Descripción breve / objetivo. |
| `badgeEmoji` | string (emoji) | No | `"🏆"` | Insignia que se otorga al terminar. |
| `badgeTitle` | string | No | `"Lección completada"` | Nombre de la insignia. |
| `badgeColor` | string (hex) | No | `"#8B5CF6"` | Color de acento de la insignia/celebración. |
| `estimatedMinutes` | string\|number | No | `""` | Minutos estimados. En el snapshot va como **string** (se parsea a `Int` al persistir). |
| `slides` | array | **Sí** | — | Lista ordenada de diapositivas (§2). |

### 1.3 Jerarquía completa

```
{} raíz (.edusynlesson.json)
├── __edusyn = "lesson"
├── version  = 1
├── exportedAt (ISO)
└── lesson
    ├── title / description
    ├── badgeEmoji / badgeTitle / badgeColor
    ├── estimatedMinutes
    └── slides[]
        └── slide
            ├── type            (CONTENT | ACTIVITY | CHECKPOINT | BADGE_REVEAL)
            ├── sortOrder
            ├── title
            ├── (legacy) body / imageUrl / videoUrl / audioUrl / layout
            ├── blocks[]        (solo CONTENT — motor de bloques)
            │   └── { id, type: TEXT|IMAGE|VIDEO|AUDIO|TABLE, html? url? rows? header? }
            ├── activityData    (solo ACTIVITY — actividad embebida; también tts en CONTENT)
            │   └── { questionType, question, options[], correctAnswer, explanation,
            │        points, hint, feedbackCorrect, feedbackIncorrect, imageUrl,
            │        openAnswer?, behavior?, tts? }
            └── badgeEmoji / badgeTitle   (solo BADGE_REVEAL)
```

> **Dualidad de contenido (compat):** una slide `CONTENT` puede describir su contenido de dos maneras:
> 1. **Motor de bloques** (moderno): array `blocks[]`.
> 2. **Legacy**: campos planos `body` (HTML), `imageUrl`, `videoUrl`, `audioUrl`, `layout`.
> El reproductor usa `blocks` si existe; si no, cae al render legacy. Para lecciones **nuevas**, usar `blocks`.

---

## 2. Tipos de diapositivas (`slide.type`)

Enum `LessonSlideType` (schema.prisma). Hay **exactamente 4**:

| Tipo | Finalidad | Cuándo usarlo |
|---|---|---|
| `CONTENT` | Exposición: texto rico + multimedia + tablas. | Explicar, motivar, dar objetivos, mostrar ejemplos. |
| `ACTIVITY` | Actividad interactiva calificable (quiz, sopa, emparejar…). | Comprobar comprensión, practicar. |
| `CHECKPOINT` | Marcador de progreso seguro (punto de retorno). | Separar bloques largos; anclar reanudación. |
| `BADGE_REVEAL` | Cierre: revela la insignia + celebración. | **Siempre la última** slide. |

Campos comunes a toda slide:

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string (cuid) | No en export | Lo asigna el servidor al persistir. En archivos nuevos puede omitirse. |
| `type` | enum | **Sí** | Uno de los 4 anteriores. |
| `sortOrder` | number | **Sí** | Orden 0-based. Debe ser consistente con la posición en el array. |
| `title` | string | No | Título visible de la slide. |

### 2.1 `CONTENT`

- **Obligatorio:** `type`, `sortOrder`.
- **Recomendado (moderno):** `blocks[]` (§3).
- **Opcional legacy:** `body` (HTML), `imageUrl`, `videoUrl`, `audioUrl`, `layout`.
- **Opcional:** `activityData.tts` — activa lectura por voz (TTS). Si se usa, la slide CONTENT lleva `activityData = { tts: { enabled: true, lang: "es-ES" } }` y **nada más**.

### 2.2 `ACTIVITY`

- **Obligatorio:** `type`, `sortOrder`, `activityData` (§4).
- No usa `blocks`.
- El enunciado, opciones, respuesta y retroalimentación viven en `activityData`.

### 2.3 `CHECKPOINT`

- **Obligatorio:** `type`, `sortOrder`.
- Sin contenido propio relevante; sirve como marcador. `title` opcional.

### 2.4 `BADGE_REVEAL`

- **Obligatorio:** `type`, `sortOrder`.
- **Campos propios:** `badgeEmoji`, `badgeTitle` (a nivel de slide). Si se omiten, el player hereda los de `lesson`.

---

## 3. Bloques disponibles (`slide.blocks[]`)

Solo en slides `CONTENT`. Definidos por `BlockType` en `blocks.tsx`. Hay **5 tipos**.
Estructura de un bloque:

```json
{ "id": "b_x7k29a", "type": "TEXT", "html": "<p>…</p>" }
```

| Campo | Aplica a | Tipo | Descripción |
|---|---|---|---|
| `id` | todos | string | ID local, prefijo `b_` + base36 (ver §6). |
| `type` | todos | enum | `TEXT` \| `IMAGE` \| `VIDEO` \| `AUDIO` \| `TABLE`. |
| `html` | TEXT | string | HTML rico (párrafos, negritas, listas…). |
| `url` | IMAGE/VIDEO/AUDIO | string | Key de storage o URL externa. |
| `rows` | TABLE | string[][] | Matriz de celdas (filas × columnas). |
| `header` | TABLE | boolean | Si la primera fila es cabecera. |

### 3.1 `TEXT`
- **Propósito:** texto rico. Es el bloque base.
- **Propiedades:** `html`.
- **Ejemplo:** `{ "id": "b_a1", "type": "TEXT", "html": "<p>El <strong>agua</strong> es…</p>" }`
- **Limitaciones:** contenido HTML (no markdown). Un TEXT vacío no se renderiza.

### 3.2 `IMAGE`
- **Propósito:** imagen ilustrativa.
- **Propiedades:** `url`.
- **Ejemplo:** `{ "id": "b_a2", "type": "IMAGE", "url": "media/ciclo-agua.png" }`
- **Limitaciones:** se muestra con `object-contain` y `max-h-80`. `url` puede ser key de storage (se firma) o URL absoluta.

### 3.3 `VIDEO`
- **Propósito:** video incrustado.
- **Propiedades:** `url`.
- **Especial:** si `url` contiene `youtube`/`youtu.be`, se convierte a `embed` automáticamente. Otras URLs se reproducen como `<video>`.
- **Ejemplo:** `{ "id": "b_a3", "type": "VIDEO", "url": "https://youtu.be/abc123" }`

### 3.4 `AUDIO`
- **Propósito:** clip de audio.
- **Propiedades:** `url`.
- **Ejemplo:** `{ "id": "b_a4", "type": "AUDIO", "url": "media/narracion.mp3" }`

### 3.5 `TABLE`
- **Propósito:** datos tabulares.
- **Propiedades:** `rows` (obligatoria), `header` (opcional, default se crea `true`).
- **Ejemplo:**
```json
{ "id": "b_a5", "type": "TABLE", "header": true,
  "rows": [["Estado", "Ejemplo"], ["Sólido", "Hielo"], ["Líquido", "Agua"]] }
```
- **Limitaciones:** todas las filas deben tener el mismo número de columnas. Con `header: true`, la fila 0 se renderiza como `<th>`.

---

## 4. Actividades soportadas (`activityData`)

Solo en slides `ACTIVITY`. El tipo lo fija `activityData.questionType`. Lista completa (selector del editor, `LessonEditor.tsx` líneas 976-988; calificación en `grading.ts`):

| `questionType` | Nombre | Forma de la respuesta / codificación |
|---|---|---|
| `MULTIPLE_CHOICE` | Opción múltiple | `options[]` = alternativas; `correctAnswer` = texto de la correcta. |
| `TRUE_FALSE` | Verdadero / Falso | `correctAnswer` = `"Verdadero"`/`"Falso"` (o el texto usado). |
| `SHORT_ANSWER` | Respuesta corta | `correctAnswer` = texto exacto. Si `openAnswer: true`, acepta **cualquier** texto no vacío (no penaliza). |
| `FILL_BLANK` | Completar en línea | El hueco va en `question` como `___` (2+ guiones bajos). `correctAnswer` = palabra correcta. |
| `ORDERING` | Ordenar palabras | `options[]` = fragmentos a ordenar; `correctAnswer` = secuencia correcta unida por espacios. |
| `MATCHING` | Emparejar | Cada par en `options[]` como `"izquierda::derecha"`. |
| `FLASHCARDS` | Flashcards | `options[]` con pares `"frente::reverso"`. **No requiere envío** (solo estudio). |
| `LISTENING` | Escuchar y seleccionar | Como MCQ pero el enunciado se **oye** (TTS): `options[]` + `correctAnswer`. |
| `WORDSEARCH` | Sopa de letras | `options[]` = palabras a encontrar. Correcto = todas encontradas. |
| `CROSSWORD` | Crucigrama | `options[]` como pares `"palabra::pista"`. |
| `MEMORY` | Memory (parejas) | `options[]` como pares `"izq::der"`. |
| `LABEL_IMAGE` | Etiquetar sobre imagen | `imageUrl` = fondo; cada punto en `options[]` como `"etiqueta::x::y"` (x,y en %). |
| `PUZZLE` | Rompecabezas | `options[0]` = tamaño de rejilla N (N×N). |

### 4.1 Estructura de `activityData`

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "question": "¿Cuál es el estado del agua a 0 °C o menos?",
  "options": ["Sólido", "Líquido", "Gaseoso", "Plasma"],
  "correctAnswer": "Sólido",
  "explanation": "A 0 °C el agua se congela.",
  "points": 10,
  "hint": "Piensa en el hielo.",
  "feedbackCorrect": "¡Exacto! 🎉",
  "feedbackIncorrect": "Revisa los estados de la materia.",
  "imageUrl": "",
  "openAnswer": false,
  "behavior": { "required": true, "gateOnCorrect": false, "maxAttempts": 3, "xpDecrement": 2, "timerSeconds": 0, "askValeria": false }
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `questionType` | enum | **Sí** | Uno de los 13 de §4. |
| `question` | string | **Sí** | Enunciado. En `FILL_BLANK` incluye el `___`. |
| `options` | string[] | Según tipo | Alternativas/pares/palabras. Al guardar se filtran vacías. |
| `correctAnswer` | string | Según tipo | Respuesta correcta (ver codificación por tipo). |
| `explanation` | string | No | Explicación que se muestra tras responder. |
| `points` | number | No (def 10) | Puntos/XP de la actividad. |
| `hint` | string | No | Pista opcional. |
| `feedbackCorrect` | string | No | Mensaje al acertar. |
| `feedbackIncorrect` | string | No | Mensaje al fallar. |
| `imageUrl` | string | Solo LABEL_IMAGE | Imagen de fondo para etiquetar. |
| `openAnswer` | boolean | No | Solo SHORT_ANSWER abierta (reflexión/opinión). |
| `behavior` | object | No | Reglas de comportamiento (ver §4.2). |
| `tts` | object | No | **Solo en CONTENT**, no en ACTIVITY. `{ enabled, lang }`. |

### 4.2 `behavior` (comportamiento configurable)

| Campo | Tipo | Descripción |
|---|---|---|
| `required` | boolean | La actividad es obligatoria para avanzar. |
| `gateOnCorrect` | boolean | Solo avanza si responde correctamente (gating). |
| `maxAttempts` | number | Intentos máximos. |
| `xpDecrement` | number | XP que se resta por cada intento fallido. |
| `timerSeconds` | number | Tiempo límite (0 = sin límite). |
| `askValeria` | boolean | Habilita ayuda de la IA (Valeria). |

> Al persistir, `behavior` se omite si está vacío (`Object.keys(...).length === 0`).

---

## 5. Flujo pedagógico (arquitectura, no tema)

Secuencia recomendada de `slides`, alineada con cómo el motor otorga XP e insignias:

```
[CONTENT]  Bienvenida / gancho          → contexto y motivación
[CONTENT]  Objetivos / qué aprenderás   → expectativa clara
[CONTENT]  Contenido nuclear 1          → teoría con bloques (texto+imagen+tabla)
[ACTIVITY] Práctica ligera              → comprobación temprana (baja fricción)
[CHECKPOINT] Punto seguro               → ancla de reanudación
[CONTENT]  Contenido nuclear 2          → profundización
[ACTIVITY] Actividad principal          → aplicación (gating opcional)
[CONTENT]  Refuerzo / síntesis          → consolidación
[ACTIVITY] Evaluación final             → medición
[BADGE_REVEAL] Insignia + celebración   → cierre y recompensa
```

**Por qué funciona:**
- **Alterna exposición y acción** (CONTENT ↔ ACTIVITY): evita muros de teoría; el checkpoint temprano da una victoria rápida.
- **CHECKPOINT** permite reanudar sin perder progreso (`LessonProgress.lastCheckpointIndex`), clave en móviles y sesiones cortas.
- **Dificultad creciente**: práctica ligera → aplicación → evaluación.
- **BADGE_REVEAL al final** cierra el lazo motivacional: la insignia se otorga por **demostrar** aprendizaje (completar + acertar), no por avanzar.

---

## 6. Convenciones del archivo

- **IDs de lección/slide:** `cuid` generados por el **servidor** (Prisma `@default(cuid())`). En un archivo nuevo se pueden **omitir**; se asignan al importar/persistir.
- **IDs de bloque:** locales, `` `b_${Math.random().toString(36).slice(2,9)}` `` → p. ej. `b_x7k29a`. Deben ser únicos dentro de la slide.
- **`sortOrder`:** 0-based, coherente con el índice del array. El editor lo re-numera al insertar/mover.
- **Imágenes/media:** el campo `url` (bloques) o `imageUrl`/`videoUrl`/`audioUrl` (legacy) acepta **key de storage** (se resuelve a URL firmada) o **URL externa absoluta**. YouTube en VIDEO se auto-convierte a `embed`.
- **Tablas:** matriz `rows: string[][]` + `header: boolean`. No hay `colspan`/`rowspan`.
- **HTML:** solo en bloques `TEXT` (`html`) y en el legacy `body`. Es HTML producido por `RichTextEditor` (párrafos, negrita, listas). No markdown.
- **Preguntas:** siempre dentro de `activityData`. La codificación varía por `questionType` (pares con `::`, hueco con `___`, hotspots con `etiqueta::x::y`).
- **Retroalimentación:** `feedbackCorrect` / `feedbackIncorrect` (mensajes) + `explanation` (justificación pedagógica). Los tres son opcionales.
- **Calificación:** determinista y pura en `grading.ts` (`gradeAnswer`). Normaliza con `norm()` (trim + minúsculas + colapsa espacios). No hay corrección semántica salvo `openAnswer`.
- **Limpieza al guardar:** `options` se filtra de vacíos; campos opcionales vacíos se convierten a `undefined` (se omiten del JSON persistido).

---

## 7. Campos que la IA debe rellenar

### 7.1 Nunca pueden quedar vacíos
| Campo | Nivel |
|---|---|
| `lesson.title` | lección |
| `slide.type` | cada slide |
| `slide.sortOrder` | cada slide |
| `activityData.questionType` | cada ACTIVITY |
| `activityData.question` | cada ACTIVITY |
| `activityData.correctAnswer` | cada ACTIVITY (salvo `SHORT_ANSWER` con `openAnswer:true`, `FLASHCARDS`) |
| `activityData.options` | ACTIVITY que las requiera (MCQ, MATCHING, ORDERING, WORDSEARCH, CROSSWORD, MEMORY, FLASHCARDS, LABEL_IMAGE, PUZZLE, LISTENING) |
| `block.type` + su contenido (`html`/`url`/`rows`) | cada bloque |

### 7.2 Recomendados (mejoran la experiencia; pueden quedar vacíos)
`lesson.description`, `badgeEmoji`, `badgeTitle`, `badgeColor`, `estimatedMinutes`,
`slide.title`, `activityData.explanation`, `hint`, `feedbackCorrect`, `feedbackIncorrect`, `points`.

### 7.3 Opcionales condicionados
`activityData.imageUrl` (solo LABEL_IMAGE), `activityData.openAnswer` (solo SHORT_ANSWER),
`activityData.behavior` (gating/intentos), `activityData.tts` (solo CONTENT),
`slide.badgeEmoji`/`badgeTitle` (solo BADGE_REVEAL).

---

## 8. Plantilla genérica (molde vacío)

```json
{
  "__edusyn": "lesson",
  "version": 1,
  "exportedAt": "",
  "lesson": {
    "title": "",
    "description": "",
    "badgeEmoji": "🏆",
    "badgeTitle": "",
    "badgeColor": "#8B5CF6",
    "estimatedMinutes": "",
    "slides": [
      {
        "type": "CONTENT",
        "sortOrder": 0,
        "title": "",
        "blocks": [
          { "id": "b_intro01", "type": "TEXT", "html": "" }
        ]
      },
      {
        "type": "CONTENT",
        "sortOrder": 1,
        "title": "",
        "blocks": [
          { "id": "b_body01", "type": "TEXT", "html": "" },
          { "id": "b_img001", "type": "IMAGE", "url": "" },
          { "id": "b_tbl001", "type": "TABLE", "header": true, "rows": [["", ""], ["", ""]] }
        ]
      },
      {
        "type": "ACTIVITY",
        "sortOrder": 2,
        "title": "",
        "activityData": {
          "questionType": "MULTIPLE_CHOICE",
          "question": "",
          "options": ["", "", "", ""],
          "correctAnswer": "",
          "explanation": "",
          "points": 10,
          "hint": "",
          "feedbackCorrect": "",
          "feedbackIncorrect": ""
        }
      },
      {
        "type": "CHECKPOINT",
        "sortOrder": 3,
        "title": ""
      },
      {
        "type": "ACTIVITY",
        "sortOrder": 4,
        "title": "",
        "activityData": {
          "questionType": "MATCHING",
          "question": "",
          "options": ["::", "::"],
          "correctAnswer": "",
          "explanation": "",
          "points": 10
        }
      },
      {
        "type": "BADGE_REVEAL",
        "sortOrder": 5,
        "title": "",
        "badgeEmoji": "🏆",
        "badgeTitle": ""
      }
    ]
  }
}
```

---

## 9. Recomendaciones para generación automática

- **Cantidad de diapositivas:** 6–12 para una lección estándar (≈15–25 min). Menos de 5 se siente pobre; más de 15 cansa.
- **Longitud del contenido por slide CONTENT:** 1–3 bloques `TEXT` cortos (2–4 frases cada uno) + máximo 1 media. Evitar muros de texto.
- **Cantidad de actividades:** 1 actividad por cada 1–2 slides de contenido. Mínimo 2 por lección; ideal 3–5.
- **Equilibrio teoría/práctica:** ≈60 % CONTENT / 40 % ACTIVITY. Nunca 2 ACTIVITY seguidas sin contenido intermedio (salvo repaso final).
- **Imágenes:** al menos 1 imagen en la lección; úsalas para conceptos visuales, no de relleno. Prefiere tablas para comparaciones.
- **Tablas:** ideales para clasificaciones y comparaciones (2–5 columnas). Marca `header: true`.
- **Preguntas:** varía `questionType` (no todo MCQ). Mezcla decisión (MCQ/TF), producción (SHORT_ANSWER/FILL_BLANK) y manipulación (ORDERING/MATCHING/WORDSEARCH). En MCQ usa 3–4 opciones plausibles.
- **`correctAnswer` en MCQ** debe ser **idéntico** (carácter a carácter, salvo caso/espacios que `norm()` tolera) a uno de los `options`.
- **Insignias:** siempre una `BADGE_REVEAL` final con `badgeEmoji` temático y `badgeTitle` motivador.
- **Checkpoints:** 1 checkpoint cada ~4–5 slides en lecciones largas.
- **Retroalimentación:** rellena `explanation` en toda actividad evaluativa; `feedbackCorrect`/`feedbackIncorrect` para reforzar el tono.
- **Comportamiento:** usa `behavior.gateOnCorrect` solo en la evaluación clave; no bloquees toda la lección.

---

## 10. Brief estándar para generar una lección nueva

Parámetros que la IA generadora debería recibir. Marcados con la **cobertura actual del formato**:

| Parámetro | ¿Existe en el JSON? | Dónde/Cómo |
|---|---|---|
| **Título** | Sí | `lesson.title` |
| **Descripción / objetivo** | Sí | `lesson.description` |
| **Duración estimada** | Sí | `lesson.estimatedMinutes` |
| **Nº de diapositivas** | Sí (implícito) | longitud de `slides[]` |
| **Tipo(s) de actividad** | Sí | `activityData.questionType` |
| **Cantidad de preguntas** | Sí (implícito) | nº de slides `ACTIVITY` |
| **Insignia (emoji, nombre, color)** | Sí | `badgeEmoji` / `badgeTitle` / `badgeColor` |
| **Recursos gráficos (imagen/video/audio/tabla)** | Sí | bloques `IMAGE`/`VIDEO`/`AUDIO`/`TABLE` |
| **Proyecto/actividad final** | Parcial | modelable como `ACTIVITY` final; no hay tipo "proyecto" dedicado |
| **Grado** | **No** | ❌ no hay campo. Ver §10.1 |
| **Asignatura** | **No** | ❌ no hay campo (se infiere del `ClassroomActivity` contenedor) |
| **Tema / subtema** | **No** (explícito) | solo se refleja en `title`/`description` |
| **Competencia** | **No** | ❌ |
| **DBA (Derecho Básico de Aprendizaje)** | **No** | ❌ |
| **Evidencia de aprendizaje** | **No** | ❌ |
| **Dificultad** | **No** | ❌ (solo parcial vía `behavior`/`points`) |
| **Estilo visual / colores** | Parcial | solo `badgeColor`; no hay tema global de slide |
| **Narrativa / tono / vocabulario** | **No** | ❌ (se refleja en la redacción, sin campo) |
| **Contexto (regional/cultural)** | **No** | ❌ |
| **Trabajo en casa** | **No** | ❌ |

### 10.1 Datos que el formato NO contiene y cómo incorporarlos

El JSON `.edusynlesson.json` es **pedagógicamente ligero**: no guarda metadatos curriculares (grado, asignatura, competencia, DBA, evidencia, dificultad, tono, contexto, tarea). Esto es porque la lección vive **dentro de un `ClassroomActivity`** que ya aporta grado/asignatura/aula.

**Recomendación para estandarizar** (sin romper compat): añadir un objeto opcional `brief` dentro de `lesson`, ignorado por el player actual pero consumible por la IA y futuras vistas:

```json
"lesson": {
  "title": "…",
  "brief": {
    "grade": "5°",
    "subject": "Ciencias Naturales",
    "topic": "…",
    "subtopic": "…",
    "competency": "…",
    "dba": "…",
    "learningEvidence": "…",
    "difficulty": "media",
    "tone": "cercano y motivador",
    "vocabulary": "nivel primaria",
    "context": "Caribe colombiano",
    "homework": "…",
    "narrative": "…"
  },
  "slides": [ … ]
}
```

> **Importante:** hoy este `brief` **no** lo lee ni escribe el editor (`buildSnapshot`/`applySnapshot` lo ignorarían). Para que fuese oficial habría que: (1) añadirlo al snapshot en `LessonEditor.tsx`, y (2) opcionalmente persistirlo (columna `Lesson.brief Json?`). Mientras tanto, la IA generadora puede **recibir** el brief como entrada y **volcar** sus decisiones en `title`, `description`, redacción de bloques y elección de `questionType`, sin depender de un campo que el sistema aún no persiste.

---

### Resumen para la IA generadora

1. Emitir el **envelope** `{ __edusyn:"lesson", version:1, exportedAt, lesson }`.
2. `lesson` con `title` (obligatorio) + metadatos de insignia.
3. `slides[]` siguiendo el flujo del §5, alternando `CONTENT` y `ACTIVITY`, cerrando con `BADGE_REVEAL`.
4. Contenido en `blocks[]` (TEXT/IMAGE/VIDEO/AUDIO/TABLE), **no** en `body` legacy.
5. Actividades en `activityData` respetando la **codificación por `questionType`** del §4.
6. IDs de bloque locales `b_xxxxx`; omitir IDs de slide/lección.
7. `correctAnswer` debe casar con `options` según las reglas de `grading.ts`.
8. Los metadatos curriculares (grado, DBA, competencia…) **no caben** en el formato actual: pasarlos como `brief` de entrada y reflejarlos en la redacción (§10.1).
