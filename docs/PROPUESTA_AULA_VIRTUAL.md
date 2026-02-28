# Propuesta: Módulo de Aula Virtual — Edusyn

> **Fecha:** 28 de febrero de 2026  
> **Autor:** Equipo de desarrollo Edusyn  
> **Estado:** Propuesta para revisión

---

## 1. Visión General

Un **aula virtual liviana** (no un LMS completo) donde el docente crea "clases" asociadas a sus asignaturas y los estudiantes acceden a contenido, tareas, quizzes, foros y más. Las notas generadas en el aula virtual se sincronizan automáticamente con la **planilla de notas (PartialGrade)**, eliminando duplicados y trabajo manual.

### Lo que NO es:
- No es Moodle, Canvas ni Google Classroom
- No maneja videoconferencias en tiempo real
- No duplica funcionalidades de "Mi Espacio" (que es privado del docente)

### Lo que SÍ es:
- Un espacio **docente → estudiante** para publicar contenido y actividades
- Un canal de comunicación asíncrona por asignatura
- Un motor de evaluación (quizzes, tareas) con **sincronización automática a la planilla**

---

## 2. Modelo de Datos (Schema)

### 2.1 `Classroom` — El aula virtual por asignatura

Cada aula se asocia a un `TeacherAssignment` (docente + grupo + asignatura + año).

```prisma
model Classroom {
  id                  String   @id @default(cuid())
  institutionId       String
  teacherAssignmentId String   @unique  // 1 aula por asignación
  title               String            // ej: "Matemáticas - 5°A"
  description         String?  @db.Text
  coverImage          String?           // URL de imagen de portada
  color               String?           // Color del aula (#hex)
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  institution       Institution      @relation(fields: [institutionId], references: [id])
  teacherAssignment TeacherAssignment @relation(fields: [teacherAssignmentId], references: [id], onDelete: Cascade)
  sections          ClassroomSection[]
  announcements     ClassroomAnnouncement[]

  @@index([institutionId])
  @@index([teacherAssignmentId])
}
```

**¿Por qué `teacherAssignmentId` único?**
- Garantiza 1 aula por docente-grupo-asignatura
- Hereda automáticamente: `groupId`, `subjectId`, `academicYearId`, `teacherId`
- Los estudiantes se derivan de `StudentEnrollment` del grupo → **no hay que matricular manualmente**

### 2.2 `ClassroomSection` — Secciones de contenido (unidades/semanas)

```prisma
model ClassroomSection {
  id          String   @id @default(cuid())
  classroomId String
  title       String            // "Semana 1", "Unidad: Fracciones"
  description String?  @db.Text
  sortOrder   Int      @default(0)
  isVisible   Boolean  @default(true)  // Docente puede ocultar secciones
  createdAt   DateTime @default(now())

  classroom   Classroom          @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  materials   ClassroomMaterial[]
  activities  ClassroomActivity[]

  @@index([classroomId])
}
```

### 2.3 `ClassroomMaterial` — Recursos/contenido publicado

```prisma
enum MaterialType {
  DOCUMENT      // PDF, Word, etc. (Cloudflare R2)
  VIDEO_YOUTUBE // Enlace de YouTube embebido
  VIDEO_UPLOAD  // Video subido a R2
  LINK          // Enlace externo
  TEXT          // Texto enriquecido inline
  IMAGE         // Imagen
}

model ClassroomMaterial {
  id        String       @id @default(cuid())
  sectionId String
  type      MaterialType
  title     String
  content   String?      @db.Text   // URL, texto HTML, embed code
  fileUrl   String?                 // Para archivos subidos
  sortOrder Int          @default(0)
  isVisible Boolean      @default(true)
  createdAt DateTime     @default(now())

  section   ClassroomSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)

  @@index([sectionId])
}
```

### 2.3.1 Gestión de Recursos del Docente (Detalle)

El modelo `ClassroomMaterial` es el sistema de **recursos y guías** del docente. Cada sección puede contener múltiples materiales de distintos tipos:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `DOCUMENT` | PDF, Word, Excel, PPT subidos a R2 | Guía de ejercicios, talleres, rúbricas |
| `VIDEO_YOUTUBE` | Video de YouTube embebido (sin salir del aula) | Clase grabada, tutorial |
| `VIDEO_UPLOAD` | Video subido directamente a R2 | Explicación del docente |
| `LINK` | Enlace externo | Simuladores web, artículos |
| `TEXT` | Texto enriquecido inline (HTML) | Instrucciones, resúmenes, notas de clase |
| `IMAGE` | Imagen (diagrama, infografía, foto) | Mapas conceptuales, fotos de tablero |

**UI del docente para agregar recursos:**
```
┌─────────────────────────────────────────────────────┐
│ 📂 Semana 3: Fracciones                   [Editar]  │
│                                                      │
│  📄 Guía de ejercicios.pdf          [⬇ Descargar]  │
│  🎬 Video: Fracciones equivalentes  [▶ Ver]         │
│  🔗 Simulador interactivo           [↗ Abrir]       │
│  📝 Notas de clase                   [👁 Ver]        │
│  🖼 Mapa conceptual                  [👁 Ver]        │
│                                                      │
│  [+ Agregar recurso]                                 │
└─────────────────────────────────────────────────────┘
```

**Flujo de subida:** Botón "Agregar recurso" → Modal con selector de tipo → según tipo:
- **Documento/Video/Imagen:** Drag-and-drop o selector de archivo → sube a R2
- **YouTube:** Pegar URL → auto-extrae embed
- **Link:** Pegar URL + título
- **Texto:** Editor inline

**Vista del estudiante:** Ve los materiales con botones de descarga/ver. No puede editar ni eliminar. Los materiales ocultos (`isVisible: false`) no aparecen para el estudiante.

---

### 2.4 `ClassroomActivity` — Tareas, quizzes, foros, juegos, simulacros

```prisma
enum ActivityType {
  TASK             // Tarea: estudiante sube archivo o escribe respuesta
  QUIZ             // Quiz: preguntas con respuesta automática
  FORUM            // Foro: discusión abierta
  GAME             // Actividad tipo juego (quiz gamificado)
  EXAM             // Examen virtual (quiz con tiempo límite, aleatorio)
  ICFES_SIMULATOR  // Simulacro ICFES Saber 11 con análisis detallado
}

model ClassroomActivity {
  id          String       @id @default(cuid())
  sectionId   String
  classroomId String       // Denormalizado para queries rápidas
  type        ActivityType
  title       String
  description String?      @db.Text  // Instrucciones
  
  // Configuración
  maxScore    Decimal?     @db.Decimal(3,1)  // Nota máxima (ej: 5.0)
  dueDate     DateTime?    // Fecha límite (opcional)
  openDate    DateTime?    // Fecha de apertura (opcional)
  timeLimitMinutes Int?    // Solo para QUIZ/EXAM/GAME
  allowLateSubmit  Boolean @default(false)
  maxAttempts      Int     @default(1)  // Quiz: intentos permitidos
  shuffleQuestions Boolean @default(false)  // Quiz/Exam: aleatorizar
  showResults      Boolean @default(true)   // Mostrar resultados al estudiante
  
  // ═══ INTEGRACIÓN CON PLANILLA ═══
  syncToGradebook    Boolean  @default(false) // ¿Sincronizar nota a planilla?
  gradebookComponent String?  // componentType en planilla (ej: "COGNITIVO")
  gradebookIndex     Int?     // activityIndex en planilla
  
  isVisible   Boolean  @default(true)
  isPublished Boolean  @default(false)  // Draft vs publicado
  sortOrder   Int      @default(0)
  metadata    Json?    // Config extra por tipo
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  section     ClassroomSection     @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  classroom   Classroom            @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  questions   ActivityQuestion[]
  submissions ActivitySubmission[]
  forumPosts  ForumPost[]

  @@index([classroomId])
  @@index([sectionId])
  @@index([dueDate])
}
```

### 2.5 `ActivityQuestion` — Preguntas para Quiz/Exam/Game

```prisma
enum QuestionType {
  MULTIPLE_CHOICE   // Opción múltiple (una correcta)
  MULTIPLE_SELECT   // Selección múltiple (varias correctas)
  TRUE_FALSE        // Verdadero/Falso
  SHORT_ANSWER      // Respuesta corta (texto)
  FILL_BLANK        // Completar espacios
  ORDERING          // Ordenar elementos
  MATCHING          // Emparejar columnas
}

model ActivityQuestion {
  id          String       @id @default(cuid())
  activityId  String
  type        QuestionType
  text        String       @db.Text   // Pregunta
  imageUrl    String?                 // Imagen opcional
  options     Json?        // [{ id, text, isCorrect, explanation? }] para múltiple opción
  correctAnswer String?    @db.Text   // Para short_answer, fill_blank
  points      Decimal      @db.Decimal(3,1) @default(1.0)
  explanation String?      @db.Text   // Explicación general post-respuesta
  wrongExplanations Json?  // { "optionId": "Por qué esta NO es correcta..." }
  subjectArea String?      // Para ICFES: LECTURA_CRITICA, MATEMATICAS, etc.
  competency  String?      // Para ICFES: competencia evaluada
  sortOrder   Int          @default(0)

  activity    ClassroomActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  answers     QuestionAnswer[]

  @@index([activityId])
}
```

### 2.6 `ActivitySubmission` — Entregas de estudiantes

```prisma
enum SubmissionStatus {
  DRAFT       // Borrador (no enviado)
  SUBMITTED   // Enviado, pendiente de calificar
  GRADED      // Calificado por docente
  RETURNED    // Devuelto para corrección
  LATE        // Enviado después de fecha límite
  AUTO_GRADED // Calificado automáticamente (quiz)
}

model ActivitySubmission {
  id            String           @id @default(cuid())
  activityId    String
  studentEnrollmentId String
  attemptNumber Int              @default(1)
  status        SubmissionStatus @default(DRAFT)
  
  // Para TASK
  content       String?          @db.Text   // Respuesta escrita
  fileUrl       String?                     // Archivo subido
  
  // Calificación
  score         Decimal?         @db.Decimal(3,1)
  feedback      String?          @db.Text   // Retroalimentación del docente
  gradedAt      DateTime?
  gradedById    String?
  
  // Para QUIZ/EXAM → respuestas individuales en QuestionAnswer
  startedAt     DateTime?
  submittedAt   DateTime?
  timeSpentSeconds Int?
  
  // Sincronización con planilla
  syncedToGradebook Boolean @default(false)
  partialGradeId    String? // Referencia al PartialGrade creado
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  activity          ClassroomActivity  @relation(fields: [activityId], references: [id], onDelete: Cascade)
  studentEnrollment StudentEnrollment  @relation(fields: [studentEnrollmentId], references: [id], onDelete: Cascade)
  gradedBy          User?              @relation("GradedSubmissions", fields: [gradedById], references: [id])
  answers           QuestionAnswer[]

  @@unique([activityId, studentEnrollmentId, attemptNumber])
  @@index([activityId])
  @@index([studentEnrollmentId])
}
```

### 2.7 `QuestionAnswer` — Respuestas individuales a preguntas

```prisma
model QuestionAnswer {
  id           String   @id @default(cuid())
  submissionId String
  questionId   String
  answer       String?  @db.Text  // Respuesta del estudiante
  selectedOptions Json? // IDs seleccionados para múltiple opción
  isCorrect    Boolean?
  pointsEarned Decimal? @db.Decimal(3,1)
  
  submission   ActivitySubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  question     ActivityQuestion   @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([submissionId, questionId])
  @@index([submissionId])
}
```

### 2.8 `ForumPost` — Posts de foro

```prisma
model ForumPost {
  id         String   @id @default(cuid())
  activityId String
  authorId   String
  parentId   String?          // Respuesta a otro post
  content    String   @db.Text
  isAnonymous Boolean @default(false)
  isPinned   Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  activity   ClassroomActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  author     User              @relation("ForumAuthor", fields: [authorId], references: [id])
  parent     ForumPost?        @relation("ForumReplies", fields: [parentId], references: [id])
  replies    ForumPost[]       @relation("ForumReplies")

  @@index([activityId])
  @@index([authorId])
}
```

### 2.9 `ClassroomAnnouncement` — Anuncios del aula

```prisma
model ClassroomAnnouncement {
  id          String   @id @default(cuid())
  classroomId String
  authorId    String
  title       String
  content     String   @db.Text
  isPinned    Boolean  @default(false)
  createdAt   DateTime @default(now())

  classroom   Classroom @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  author      User      @relation("AnnouncementAuthor", fields: [authorId], references: [id])

  @@index([classroomId])
}
```

---

## 3. Integración con la Planilla de Notas (PUNTO CRÍTICO)

### 3.1 El Problema

La planilla usa `PartialGrade` con composite key:
```
studentEnrollmentId + teacherAssignmentId + academicTermId + componentType + activityIndex
```

Si el docente tiene actividades manuales con `activityIndex` 1, 2, 3... y un quiz del aula virtual intenta usar el mismo índice → **conflicto y duplicado**.

### 3.2 La Solución: "Slots Reservados"

Cuando el docente activa `syncToGradebook` en una actividad del aula virtual:

1. **El docente elige:**
   - `gradebookComponent` → Qué componente evaluativo (ej: COGNITIVO, PROCEDIMENTAL)
   - `gradebookIndex` → Qué columna de la planilla (ej: actividad 3)

2. **El sistema:**
   - Al calificar (manual o auto), crea/actualiza el `PartialGrade` correspondiente
   - Usa el `activityName` del aula virtual como nombre en la planilla
   - El `recomputePeriodFinalGrade()` existente recalcula automáticamente la nota final
   - La planilla muestra la nota normalmente (el docente puede verla y editarla)

3. **Campo `partialGradeId`** en `ActivitySubmission`:
   - Referencia al `PartialGrade` creado
   - Si el docente edita la nota en la planilla, NO se revierte (la planilla es la fuente de verdad final)
   - Si el docente recalifica en el aula virtual, se actualiza el PartialGrade

### 3.3 Flujo de Sincronización

```
[Estudiante hace quiz] 
    → auto-grade → score = 4.2
    → actividad tiene syncToGradebook = true
    → gradebookComponent = "COGNITIVO", gradebookIndex = 3
    → llama partialGradesService.upsert({
        studentEnrollmentId,
        teacherAssignmentId: classroom.teacherAssignmentId,
        academicTermId: período activo,
        componentType: "COGNITIVO",
        activityIndex: 3,
        activityName: "Quiz: Fracciones",
        activityType: "Quiz Virtual",
        score: 4.2
      })
    → recomputePeriodFinalGrade() → actualiza PeriodFinalGrade
    → La nota aparece en la planilla del docente automáticamente ✓
```

### 3.4 Reglas de No-Duplicación

| Escenario | Comportamiento |
|-----------|---------------|
| Docente ya tiene actividad manual en el slot | Se avisa y no se permite asignar ese slot |
| Docente califica en planilla y en aula virtual | La última escritura gana (upsert) |
| Docente elimina actividad del aula virtual | Opción: mantener o eliminar la nota de la planilla |
| Período finalizado (FINALIZED) | No se pueden sincronizar notas (guardTermNotFinalized) |
| Estudiante hace múltiples intentos | Solo el mejor intento (o el último, configurable) se sincroniza |

### 3.5 UI del Docente para Mapeo

En el formulario de creación de actividad, cuando activa "Sincronizar con planilla":

```
┌─────────────────────────────────────────────┐
│ ☑ Sincronizar nota con planilla             │
│                                              │
│ Componente:  [▾ COGNITIVO        ]          │
│ Columna:     [▾ Actividad 3 (vacía) ]       │
│                                              │
│ ⓘ La nota del estudiante aparecerá          │
│   automáticamente en la columna elegida.     │
│   Nota máxima: 5.0                           │
└─────────────────────────────────────────────┘
```

El selector de columna muestra:
- Columnas existentes con su nombre y si están **ocupadas** o **vacías**
- El docente puede crear una nueva actividad en la planilla desde aquí

---

## 4. Funcionalidades por Tipo de Actividad

### 4.1 TASK (Tarea)
- Docente publica instrucciones + archivos adjuntos
- Estudiante escribe respuesta y/o sube archivos
- Docente califica manualmente con nota + retroalimentación
- Opción de devolver para corrección

### 4.2 QUIZ (Quiz)
- Docente crea preguntas (opción múltiple, V/F, completar, emparejar, ordenar)
- Calificación automática
- Configuración: intentos, tiempo límite, aleatorizar, mostrar respuestas
- Estadísticas: % acierto por pregunta, distribución de notas

### 4.3 GAME (Actividad Tipo Juego)
- Mismo motor de preguntas del quiz pero con:
  - Interfaz gamificada (una pregunta a la vez, barra de progreso)
  - Temporizador visual por pregunta
  - Puntuación con streak bonus (racha de aciertos)
  - Animaciones de feedback (✓ correcto, ✗ incorrecto)
  - Tabla de posiciones del grupo (leaderboard)

### 4.4 EXAM (Examen Virtual)
- Quiz endurecido:
  - Tiempo límite obligatorio
  - Preguntas aleatorias (del banco)
  - 1 intento (configurable)
  - Sin mostrar respuestas correctas hasta cierre
  - Registro de tiempo por pregunta

### 4.5 FORUM (Foro)
- Discusión por hilos (post + respuestas)
- Docente puede fijar posts
- No genera nota automática (el docente puede calificar participación manualmente)

### 4.6 ICFES_SIMULATOR (Simulacro Saber 11) ⭐

**Objetivo:** Herramienta de preparación para las pruebas Saber 11 del ICFES. Ideal para grado 11° pero utilizable en cualquier grado como práctica. El diferenciador clave es el **análisis post-simulacro** detallado.

#### Áreas evaluadas (Saber 11)
| Área | Código | Preguntas típicas |
|------|--------|-------------------|
| Lectura Crítica | `LECTURA_CRITICA` | 41 |
| Matemáticas | `MATEMATICAS` | 35 |
| Ciencias Naturales | `CIENCIAS_NATURALES` | 29 |
| Sociales y Ciudadanas | `SOCIALES_CIUDADANAS` | 25 |
| Inglés | `INGLES` | 30 |

#### Configuración del simulacro
El docente puede:
- Crear un simulacro **completo** (todas las áreas) o **por área** (solo una)
- Importar preguntas desde un banco o crearlas manualmente
- Definir tiempo límite global o por área
- Definir número de preguntas por área (puede ser menor al oficial para práctica)
- Cada pregunta tiene:
  - Texto de la pregunta (puede incluir imagen/pasaje de lectura)
  - 4 opciones (A, B, C, D) — estándar ICFES
  - Respuesta correcta
  - **Explicación de la correcta** (¿Por qué es la respuesta?)
  - **Explicación de cada incorrecta** (¿Por qué esta NO es?)
  - Área (`subjectArea`) y competencia (`competency`)

#### Experiencia del Estudiante — Durante el Simulacro

```
┌──────────────────────────────────────────────────────────────┐
│ 📝 Simulacro ICFES - Lectura Crítica                        │
│ Pregunta 12 de 41          ⏱ 01:23:45 restantes             │
│ ─────────────────────────────────────────────────────────    │
│                                                              │
│ Lee el siguiente fragmento y responde:                       │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐     │
│ │ "En el contexto de la globalización, las economías   │     │
│ │  emergentes han experimentado transformaciones..."    │     │
│ └──────────────────────────────────────────────────────┘     │
│                                                              │
│ Según el texto, el autor sugiere que:                        │
│                                                              │
│  ○ A) Las economías emergentes no se han beneficiado...      │
│  ● B) La globalización ha generado tanto oportunidades...    │
│  ○ C) Los países desarrollados son los únicos que...         │
│  ○ D) El comercio internacional ha disminuido...             │
│                                                              │
│ [← Anterior]    12/41    [Siguiente →]    [Finalizar ⚠]     │
│                                                              │
│ Navegador: ① ② ③ ④ ⑤ ⑥ ⑦ ⑧ ⑨ ⑩ ⑪ ⑫ ... ㊶              │
│ (azul=respondida, gris=sin responder, amarillo=marcada)      │
└──────────────────────────────────────────────────────────────┘
```

**Características durante el examen:**
- Navegación libre entre preguntas (como el ICFES real)
- Marcar preguntas para revisión posterior
- Indicador visual del progreso (respondidas/pendientes/marcadas)
- Temporizador global visible
- No mostrar respuestas correctas durante el examen

#### Experiencia del Estudiante — Reporte Post-Simulacro ⭐

Al finalizar, el estudiante ve un **análisis completo**:

```
┌──────────────────────────────────────────────────────────────┐
│ 📊 RESULTADOS DEL SIMULACRO                                 │
│ Simulacro ICFES Saber 11 — 15 de marzo 2026                │
│                                                              │
│ ┌────────────────────────────────────────────────────┐       │
│ │  PUNTAJE GLOBAL: 287 / 500                         │       │
│ │  ████████████████░░░░░░░░  57%                     │       │
│ └────────────────────────────────────────────────────┘       │
│                                                              │
│ Resultados por Área:                                         │
│ ┌─────────────────────┬────────┬───────┬─────────┐          │
│ │ Área                │ Bien   │ Mal   │ Puntaje │          │
│ ├─────────────────────┼────────┼───────┼─────────┤          │
│ │ Lectura Crítica     │ 28/41  │ 13    │ 68%  ▲  │          │
│ │ Matemáticas         │ 18/35  │ 17    │ 51%  ▶  │          │
│ │ Ciencias Naturales  │ 15/29  │ 14    │ 52%  ▶  │          │
│ │ Sociales y Ciudad.  │ 19/25  │  6    │ 76%  ▲  │          │
│ │ Inglés              │ 12/30  │ 18    │ 40%  ▼  │          │
│ └─────────────────────┴────────┴───────┴─────────┘          │
│                                                              │
│ ▲ Fortaleza  ▶ Promedio  ▼ Necesita refuerzo                │
│                                                              │
│ [📋 Ver análisis detallado por pregunta]                     │
│ [📈 Comparar con el grupo]                                   │
│ [💾 Descargar reporte PDF]                                   │
└──────────────────────────────────────────────────────────────┘
```

#### Análisis Pregunta por Pregunta (lo más valioso)

```
┌──────────────────────────────────────────────────────────────┐
│ Pregunta 7 — Lectura Crítica                    ✅ Correcta  │
│ ─────────────────────────────────────────────────────────    │
│ "Según el texto, ¿cuál es la tesis principal del autor?"     │
│                                                              │
│  ○ A) ...                                                    │
│  ● B) La globalización ha... ← Tu respuesta ✓               │
│  ○ C) ...                                                    │
│  ○ D) ...                                                    │
│                                                              │
│ ✅ ¡Correcto! La opción B refleja fielmente la posición      │
│ del autor expresada en el segundo párrafo.                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Pregunta 12 — Matemáticas                       ❌ Incorrecta│
│ Competencia: Razonamiento cuantitativo                       │
│ ─────────────────────────────────────────────────────────    │
│ "Si f(x) = 2x² + 3x - 5, ¿cuál es f(-2)?"                 │
│                                                              │
│  ○ A) -3         ← Tu respuesta ✗                           │
│  ○ B) 1                                                      │
│  ● C) -3         ← Respuesta correcta ✓                     │
│  ○ D) 7                                                      │
│                                                              │
│ ❌ Tu respuesta (A): No es correcta porque al sustituir      │
│ x=-2 en el primer término obtienes 2(4)=8, no 2(-4)=-8.    │
│ Recuerda que (-2)² = 4, no -4.                              │
│                                                              │
│ ✅ Respuesta correcta (C): f(-2) = 2(-2)² + 3(-2) - 5      │
│ = 2(4) + (-6) - 5 = 8 - 6 - 5 = -3                        │
│                                                              │
│ 💡 Competencia: Razonamiento cuantitativo                    │
│ 📚 Tema: Evaluación de funciones polinómicas                 │
└──────────────────────────────────────────────────────────────┘
```

#### Vista del Docente — Dashboard del Simulacro

```
┌──────────────────────────────────────────────────────────────┐
│ 📊 Estadísticas del Simulacro — 11°A                         │
│                                                              │
│ Completaron: 32/35 estudiantes                               │
│ Promedio global: 287/500                                     │
│ Mejor puntaje: 412/500 (María López)                         │
│ Menor puntaje: 187/500 (Juan Pérez)                          │
│                                                              │
│ Pregunta más difícil: P.23 Matemáticas (solo 12% acertaron)  │
│ Pregunta más fácil: P.5 Lectura Crítica (95% acertaron)      │
│                                                              │
│ Distribución de puntajes:                                    │
│ 100-200: ██░░░░░░░░ 3 est.                                  │
│ 200-300: ████████░░ 12 est.                                  │
│ 300-400: ██████████ 15 est.                                  │
│ 400-500: ████░░░░░░ 2 est.                                   │
│                                                              │
│ [📥 Exportar resultados]  [📊 Ver por área]  [🔍 Por alumno] │
└──────────────────────────────────────────────────────────────┘
```

#### Datos adicionales del modelo para ICFES

En `ClassroomActivity.metadata` (Json) para tipo `ICFES_SIMULATOR`:
```json
{
  "icfesConfig": {
    "isFullSimulator": true,
    "areas": ["LECTURA_CRITICA", "MATEMATICAS", "CIENCIAS_NATURALES", "SOCIALES_CIUDADANAS", "INGLES"],
    "questionsPerArea": { "LECTURA_CRITICA": 41, "MATEMATICAS": 35, "CIENCIAS_NATURALES": 29, "SOCIALES_CIUDADANAS": 25, "INGLES": 30 },
    "totalTimeMinutes": 270,
    "showAreaResults": true,
    "showQuestionAnalysis": true,
    "showGroupComparison": true,
    "maxPossibleScore": 500
  }
}
```

En `ActivityQuestion.options` para ICFES:
```json
[
  { "id": "A", "text": "Las economías emergentes no...", "isCorrect": false, "explanation": "Esta opción es incorrecta porque el autor menciona explícitamente en el párrafo 3 que..." },
  { "id": "B", "text": "La globalización ha generado...", "isCorrect": true, "explanation": "Correcta. El autor presenta una visión equilibrada en los párrafos 2 y 4..." },
  { "id": "C", "text": "Los países desarrollados...", "isCorrect": false, "explanation": "El texto no limita los beneficios a un solo grupo de países..." },
  { "id": "D", "text": "El comercio internacional...", "isCorrect": false, "explanation": "Contrario a lo que afirma esta opción, el autor indica un aumento en..." }
]
```

---

## 5. Vistas del Frontend

### 5.1 Vista del Docente

**Ruta:** `/classroom` (lista de aulas) + `/classroom/:id` (aula individual)

#### Lista de Aulas
- Cards con: nombre, grupo, asignatura, color, # estudiantes, # actividades pendientes
- Botón "Crear Aula" (auto-genera desde TeacherAssignment)

#### Interior del Aula (tabs):
1. **Inicio** — Anuncios fijados + actividad reciente
2. **Contenido** — Secciones con materiales (drag-and-drop para reordenar)
3. **Actividades** — Lista de tareas, quizzes, foros, juegos, exámenes
4. **Calificaciones** — Tabla con estudiantes × actividades, estado de entrega, notas
5. **Estudiantes** — Lista de estudiantes del grupo (heredada de enrollments)

### 5.2 Vista del Estudiante

**Ruta:** `/my-classes` (lista de clases) + `/my-classes/:id` (clase individual)

#### Lista de Clases
- Cards con: nombre asignatura, docente, grupo, color
- Badge de pendientes (tareas sin entregar, quizzes por hacer)

#### Interior de la Clase:
1. **Inicio** — Anuncios + próximas entregas (timeline)
2. **Contenido** — Solo secciones visibles, materiales descargables, videos embebidos
3. **Actividades** — Mis actividades con estado (Pendiente/Entregado/Calificado)
4. **Mis Notas** — Resumen de notas por actividad

---

## 6. Endpoints del API

### Classrooms
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/classrooms` | Listar mis aulas (docente) o mis clases (estudiante) |
| POST | `/classrooms` | Crear aula desde TeacherAssignment |
| GET | `/classrooms/:id` | Detalle del aula con secciones |
| PUT | `/classrooms/:id` | Actualizar aula |
| DELETE | `/classrooms/:id` | Archivar aula |

### Secciones & Materiales
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/classrooms/:id/sections` | Crear sección |
| PUT | `/classroom-sections/:id` | Actualizar sección |
| DELETE | `/classroom-sections/:id` | Eliminar sección |
| POST | `/classroom-sections/:id/materials` | Agregar material |
| PUT | `/classroom-materials/:id` | Actualizar material |
| DELETE | `/classroom-materials/:id` | Eliminar material |

### Actividades
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/classrooms/:id/activities` | Crear actividad |
| GET | `/classroom-activities/:id` | Detalle de actividad |
| PUT | `/classroom-activities/:id` | Actualizar actividad |
| POST | `/classroom-activities/:id/publish` | Publicar actividad |
| GET | `/classroom-activities/:id/submissions` | Ver entregas (docente) |
| GET | `/classroom-activities/:id/stats` | Estadísticas del quiz |

### Preguntas (Quiz/Exam/Game)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/classroom-activities/:id/questions` | Agregar pregunta |
| PUT | `/activity-questions/:id` | Editar pregunta |
| DELETE | `/activity-questions/:id` | Eliminar pregunta |
| POST | `/classroom-activities/:id/questions/bulk` | Importar preguntas masivas |

### Entregas (Estudiante)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/classroom-activities/:id/submit` | Enviar tarea/iniciar quiz |
| PUT | `/activity-submissions/:id` | Actualizar borrador |
| POST | `/activity-submissions/:id/finish` | Finalizar quiz/examen |
| POST | `/activity-submissions/:id/grade` | Calificar entrega (docente) |
| POST | `/activity-submissions/:id/return` | Devolver para corrección |

### Foros
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/classroom-activities/:id/forum` | Crear post |
| POST | `/forum-posts/:id/reply` | Responder a un post |
| PUT | `/forum-posts/:id` | Editar post |
| DELETE | `/forum-posts/:id` | Eliminar post |

### Anuncios
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/classrooms/:id/announcements` | Crear anuncio |
| PUT | `/classroom-announcements/:id` | Editar anuncio |
| DELETE | `/classroom-announcements/:id` | Eliminar anuncio |

### Integración Planilla
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/classrooms/:id/gradebook-slots` | Slots disponibles en planilla |
| POST | `/classroom-activities/:id/sync-grades` | Forzar sincronización |

---

## 7. Navegación y Roles

### Sidebar
```
Docente:
  📚 Aula Virtual → /classroom

Estudiante:
  📚 Mis Clases → /my-classes

Acudiente:
  📚 Clases (hijo) → /my-classes (vista lectura)
```

### Permisos por Rol
| Acción | Docente | Estudiante | Acudiente |
|--------|---------|-----------|-----------|
| Crear/editar aula | ✅ | ❌ | ❌ |
| Publicar contenido | ✅ | ❌ | ❌ |
| Crear actividades | ✅ | ❌ | ❌ |
| Ver contenido | ✅ | ✅ | ✅ (lectura) |
| Realizar actividades | ❌ | ✅ | ❌ |
| Calificar | ✅ | ❌ | ❌ |
| Ver notas | ✅ (todos) | ✅ (propias) | ✅ (hijo) |
| Foro: publicar | ✅ | ✅ | ❌ |

---

## 8. Fases de Implementación

### Fase 1 — Fundación (Backend + Frontend básico)
- Schema completo + `prisma db push`
- CRUD de Classroom, Section, Material, Announcement
- Subida de archivos a R2 (documentos, guías, imágenes)
- Embed de videos YouTube
- Vista docente: lista de aulas, crear aula, gestión de secciones y recursos
- Vista estudiante: lista de clases, ver contenido, descargar materiales
- **Estimado: ~3 sesiones**

### Fase 2 — Tareas
- CRUD de actividades tipo TASK
- Flujo de entrega: crear → enviar → calificar → devolver → re-enviar
- Subida de archivos del estudiante (respuestas)
- Sincronización con planilla (PartialGrade) — mapeo de slots
- **Estimado: ~2 sesiones**

### Fase 3 — Quiz + Examen
- Motor de preguntas (7 tipos: opción múltiple, V/F, completar, etc.)
- Calificación automática
- Temporizador, intentos múltiples, aleatorización
- Estadísticas de resultados (% acierto por pregunta, distribución)
- Sincronización automática con planilla
- **Estimado: ~3 sesiones**

### Fase 4 — Simulacro ICFES Saber 11 ⭐
- Configuración por áreas (5 áreas Saber 11)
- Interfaz tipo examen real (navegador de preguntas, marcar para revisión)
- Temporizador global
- Reporte post-simulacro: puntaje global, por área, fortalezas/debilidades
- Análisis pregunta por pregunta (✅ por qué es correcta, ❌ por qué no lo es)
- Dashboard del docente: estadísticas del grupo, distribución, preguntas difíciles
- Comparativa estudiante vs grupo
- **Estimado: ~2 sesiones** (reutiliza el motor de quiz de Fase 3)

### Fase 5 — Game Mode
- Interfaz gamificada sobre el motor de quiz
- Una pregunta a la vez, animaciones, streak bonus
- Leaderboard del grupo
- **Estimado: ~1 sesión**

### Fase 6 — Foros
- CRUD de posts con hilos anidados
- Respuestas, post fijado por docente
- **Estimado: ~1 sesión**

### Fase 7 — Pulido
- Vista acudiente (lectura)
- Notificaciones (nueva tarea, calificación disponible)
- Dashboard del estudiante (próximas entregas, notas recientes)
- Integración con CalendarView de "Mi Espacio"
- **Estimado: ~2 sesiones**

---

## 9. Riesgos y Mitigación

| Riesgo | Mitigación |
|--------|-----------|
| Conflicto de activityIndex en planilla | UI muestra slots ocupados vs vacíos; validación en backend |
| Período FINALIZED bloquea sync | Se respeta `guardTermNotFinalized()` existente |
| Docente edita nota en planilla después de sync | La planilla es fuente de verdad final; no se revierte |
| Estudiante pierde conexión durante quiz | Se guarda progreso (`startedAt`, respuestas parciales) |
| Carga de archivos pesados | Límite de tamaño (10MB); usa R2 existente |
| Muchos quizzes simultáneos | Las consultas son por estudiante; no hay cuellos de botella |

---

## 10. Dependencias Técnicas

- **Storage:** Cloudflare R2 (ya configurado) para archivos de materiales y entregas
- **YouTube:** Embed iframe con `youtube-nocookie.com` (no requiere API key)
- **Schema:** Solo adiciones (nuevos modelos). Cero impacto en modelos existentes
- **PartialGrade:** Se reutiliza el servicio existente, sin modificar su lógica

---

## 11. Preguntas para el Cliente

1. **¿El acudiente debe ver las clases de su hijo?** (propuesto: sí, en modo lectura)
2. **¿Límite de tamaño de archivos?** (propuesto: 10MB por archivo)
3. **¿Quizzes con banco de preguntas compartido entre docentes?** (propuesto: no en fase inicial, cada docente crea sus propias preguntas)
4. **¿El simulacro ICFES debe estar disponible para todos los grados o solo 10° y 11°?** (propuesto: disponible para todos como "práctica tipo ICFES", pero con etiqueta especial para 11°)
5. **¿Se necesita exportar el reporte del simulacro ICFES a PDF?** (propuesto: sí, en Fase 4)
6. **¿Comenzamos por la Fase 1 o quieres ajustar el alcance?**

---

### Resumen de estimaciones

| Fase | Funcionalidad | Sesiones |
|------|---------------|----------|
| 1 | Fundación: aulas, secciones, recursos, materiales | ~3 |
| 2 | Tareas + sincronización planilla | ~2 |
| 3 | Quiz + Examen + auto-grade | ~3 |
| 4 | Simulacro ICFES Saber 11 | ~2 |
| 5 | Game Mode gamificado | ~1 |
| 6 | Foros | ~1 |
| 7 | Pulido: notificaciones, acudiente, calendar | ~2 |
| **Total** | | **~14 sesiones** |

---

*Esperando tu aprobación para comenzar la implementación.*
