# Rediseño del Aula Virtual y la IA de Edusyn — Documento de Producto 2026

> Autor: Product Design + PM + Arquitectura de Experiencia Educativa.
> Alcance: módulo Aula Virtual (Classroom), IA unificada (Classroom ↔ EdusynPlay), Lecciones Interactivas y Simulacros ICFES.
> Base: análisis del **código real** del repositorio (no de capturas — no estaban disponibles en esta sesión, así que el diagnóstico se ancló en el esquema y los servicios reales, que es más confiable).
> Regla operativa: **staging primero, producción después, sin perder datos**. Todo lo aquí propuesto es aditivo sobre el esquema actual.

---

## 0. TL;DR para fundadores

1. **El problema de "falta de orden" NO es de datos: es de presentación.** El modelo `ClassroomActivity` ya tiene `openDate`, `dueDate`, `publishedAt`, `maxAttempts`, `syncToGradebook`, y `SubmissionStatus` ya distingue `DRAFT/SUBMITTED/GRADED/RETURNED/LATE/AUTO_GRADED`. Tienes los estados que pides en el punto 2 del brief **ya almacenados**; simplemente no los estás mostrando como jerarquía. Esto convierte la mitad del rediseño en *quick wins* de frontend.

2. **La IA de Classroom "se siente peor" porque, en Lecciones, literalmente no usa el LLM.** EdusynPlay llama a `apdAi.generateQuizQuestions()` (LLM real, prompt cuidado, chunking, dedup, validación). Classroom, en `lesson.service.ts:462 generateLessonStructure()`, es un **generador de plantillas local** que parte el texto en párrafos e inserta preguntas placeholder literales (`"¿Qué aprendiste sobre ${topic}?"`, opciones `['Opción A','Opción B',...]`). El propio comentario dice *"This is a template generator… The actual AI generation happens via Valeria API"* — pero ese cableado al LLM no existe en lecciones. No es un problema de prompt: es un problema de **arquitectura/cableado**.

3. **La solución de IA no es "mejorar el prompt" sino extraer un cerebro pedagógico compartido** (`PedagogicalBrain`) que ambos módulos consuman, con la misma personalidad (Valeria), rúbricas, Bloom, competencias y contexto. Hoy ese cerebro ya vive a medias en `ApdAiService`; falta que Classroom lo use de verdad.

---

## 1. Diagnóstico de los problemas actuales

### 1.1 Aula Virtual (lista de actividades)

| Síntoma reportado | Causa raíz (en código) | Severidad |
|---|---|---|
| "Todas las tarjetas se sienten iguales" | El render de `ActivitiesTab` pinta cada actividad con el mismo peso visual; no mapea `type`/estado/urgencia a jerarquía visual | Alta |
| "No hay sensación de organización" | Orden cronológico/alfabético plano. Existe `ClassroomSection` (unidades) en el esquema, pero la lista no agrupa por sección ni por tiempo | Alta |
| "Filtros solo por tipo" (Todas/Tareas/Quiz/En línea) | Filtros atados a `ClassroomActivityType`, no al **estado del trabajo** (pendiente/vencida/calificada) que es lo que el usuario realmente busca | Alta |
| "El estudiante no entiende su progreso" | La vista de estudiante reutiliza casi la misma UI del docente (`STUDENT_TABS` vs `TEACHER_TABS`), pero no hay una vista "¿qué hago hoy?" | Alta |
| "Solo se ve la fecha límite" | `openDate`, `publishedAt`, tiempo restante y fechas de entrega/calificación existen o son derivables, pero no se muestran | Media |

**Conclusión:** la información existe; falta una **capa de semántica visual** (estado, urgencia, jerarquía) y una **organización por contenedores** (unidad/semana/tiempo).

### 1.2 IA (Classroom vs EdusynPlay) — diagnóstico técnico

```
EdusynPlay:
  PlayQuizEditor → play.controller.ts:97 aiGenerateQuestions
    → play.service.ts:256 apdAi.generateQuizQuestions()
      → LLM real (OpenRouter/Gemini), systemInstruction pedagógico,
        chunking de 10, dedup por texto, validación de esquema, explicación por pregunta.
  RESULTADO: preguntas específicas y verificables. ✅

Classroom (Lecciones):
  classroom.controller.ts:996 → lesson.service.ts:462 generateLessonStructure()
    → SIN LLM. Split de párrafos + plantilla fija + placeholders "Opción A/B/C/D".
  RESULTADO: contenido genérico. ❌  (no es culpa del modelo: nunca llega al modelo)
```

Detalles del buen prompt que **ya tienes** y deberías reutilizar (`apd-ai.service.ts:1540`):
- Persona experta en evaluación tipo Kahoot/Quizizz.
- JSON-only, sin markdown.
- Prohíbe contenido genérico, exige distractores plausibles del mismo dominio.
- Rota la posición de la respuesta correcta.
- Recibe `gradeName` y `subjectName` como contexto.

Lo que le falta a ese prompt (oportunidad transversal): **taxonomía de Bloom explícita, competencias/estándares (DBA, Saber), nivel de dificultad parametrizado y rúbrica**. Hoy no se inyectan.

### 1.3 Lecciones Interactivas

El modelo de datos ya es sólido para gamificar: `Lesson`, `LessonSlide` (tipos `CONTENT/ACTIVITY/CHECKPOINT/BADGE_REVEAL`), `LessonProgress`. El problema es doble: (a) la generación es de plantilla (ver 1.2), y (b) la experiencia de consumo no se siente "viva" (sin feedback inmediato adaptativo, sin rutas, sin recompensas progresivas reales).

### 1.4 Simulacros ICFES

Existe el tipo `ICFES_SIMULATOR` y una propuesta previa rica (`docs/PROPUESTA_AULA_VIRTUAL.md` §4.6). Falta llevar a producto: cronómetro real con persistencia, navegación por bloques con marcado, analítica por competencia/componente, predicción de puntaje y bucle "genera nuevo simulacro según tus errores".

---

## 2. Oportunidades priorizadas por impacto

| # | Oportunidad | Impacto | Esfuerzo | Por qué |
|---|---|---|---|---|
| O1 | **Sistema de estado visual en 5 s** (chips + color + jerarquía) | 🟥 Muy alto | 🟢 Bajo | Los datos ya existen; es render |
| O2 | **Cablear Lecciones a la IA real** (matar `generateLessonStructure` placeholder) | 🟥 Muy alto | 🟡 Medio | Arregla la queja #1 de IA con poco código |
| O3 | **Vista Estudiante "Hoy"** (qué hacer, pendiente, entregado, calificado) | 🟥 Muy alto | 🟡 Medio | Cambia la percepción de toda la plataforma |
| O4 | **Filtros por estado de trabajo** (pendientes/vencidas/sin entregar/calificadas) | 🟧 Alto | 🟢 Bajo | Reemplaza filtros poco útiles |
| O5 | **Dashboard Docente** (por calificar, sin entregas, vence hoy, borradores) | 🟧 Alto | 🟡 Medio | Productividad docente real |
| O6 | **Organización por Unidad → Semana** (usar `ClassroomSection`) | 🟧 Alto | 🟡 Medio | Da "sensación de orden" estructural |
| O7 | **`PedagogicalBrain` unificado** (Bloom, competencias, rúbricas, memoria) | 🟧 Alto | 🟠 Alto | Hace que ambas IA parezcan una sola |
| O8 | **ICFES como producto de preparación** (analítica + predicción + bucle IA) | 🟨 Medio-alto | 🔴 Alto | Diferenciador de mercado LATAM |
| O9 | **Lecciones gamificadas 2026** (rutas, XP, feedback adaptativo) | 🟨 Medio-alto | 🔴 Alto | Retención del estudiante |

Orden recomendado de ejecución: **O1 → O4 → O2 → O3 → O5 → O6 → O7 → O9 → O8.**

---

## 3. Rediseño del Aula Virtual

### 3.1 Principio rector: "Contenedor + Estado + Urgencia"

Tres capas de organización, no una lista plana:

1. **Contenedor** (estructura estable): Unidad → (opcional) Semana/Tema. Usa `ClassroomSection`.
2. **Estado** (semántica del trabajo): el ciclo de vida de la actividad y de la entrega.
3. **Urgencia** (tiempo): cuánto falta o cuánto se pasó.

La jerarquía visual se calcula combinando las tres, no por etiquetas sueltas.

### 3.2 Sistema de estado visual (el "5-segundos")

Estado derivado por una función pura en frontend (sin migración), a partir de campos existentes:

```
function deriveStatus(activity, submission, now):
  // Disponibilidad
  if activity.openDate && now < openDate      → 🔒 NO_DISPONIBLE
  if activity.publishedAt within 48h          → 📌 NUEVA
  // Para el estudiante (según submission)
  if submission.status == GRADED              → 📝 CALIFICADA
  if submission.status == RETURNED            → 🔄 DEVUELTA (corregir)
  if submission.status in [SUBMITTED,AUTO]    → ✔ ENTREGADA
  if dueDate && now > dueDate && !submission  → ❌ VENCIDA
  if dueDate && (dueDate - now) < 48h         → ⚠ POR VENCER
  else                                        → ⏳ PENDIENTE
  // Para el docente (estado de publicación + carga)
  if !activity.publishedAt                    → ✍ BORRADOR
  if submissionsToGrade > 0                   → 🟠 POR CALIFICAR (n)
```

Tokens visuales (paleta semántica, no decorativa):

| Estado | Color | Chip | Peso visual |
|---|---|---|---|
| ❌ Vencida / sin entregar | Rojo | borde izq. grueso | Máximo (sube al tope) |
| ⚠ Por vencer (<48h) | Ámbar | badge pulsante | Alto |
| 📌 Nueva (<48h publicada) | Azul | "Nuevo" | Alto |
| ⏳ Pendiente | Slate | contador "faltan Xd" | Medio |
| 🔄 Devuelta | Morado | "Corregir" | Alto |
| ✔ Entregada | Verde claro | check | Bajo (colapsa) |
| 📝 Calificada | Verde + nota | "8.5/10" | Bajo (colapsa) |
| 🔒 No disponible | Gris | candado + fecha | Mínimo (atenuada) |

**Regla de jerarquía:** lo accionable sube y crece; lo terminado baja y se atenúa. El estudiante ve primero lo que debe hacer, no lo que ya hizo.

### 3.3 Filtros que sí importan (reemplazo)

Sustituir `Todas / Tareas / Quiz / En línea` por **dos ejes**:

- **Estado** (chips de una fila, multi-selección): `Pendientes` · `Por vencer` · `Vencidas` · `Sin entregar` · `Devueltas` · `Calificadas`.
- **Tiempo** (segmented): `Esta semana` · `Este mes` · `Todo`.
- Tipo se conserva como filtro **secundario** plegable (no es lo primario que busca el usuario).

Vistas guardadas por defecto: estudiante abre en `Pendientes + Esta semana`; docente abre en `Por calificar + Vence hoy`.

### 3.4 Wireframe — Aula, vista actividades (docente)

```
┌───────────────────────────────────────────────────────────────────┐
│  8°B · Matemáticas                         [+ Nueva actividad ▾]    │
│  ┌─ Resumen rápido ────────────────────────────────────────────┐   │
│  │  🟠 Por calificar: 23   ⚠ Vence hoy: 2   ✍ Borradores: 4    │   │
│  │  📉 Sin ninguna entrega: 1   📊 Promedio entregas: 78%       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Estado: [Por calificar•] [Vencidas] [Borradores]   Tiempo:[Sem▾]  │
├───────────────────────────────────────────────────────────────────┤
│  ▼ UNIDAD 2 · Ecuaciones                          (4 actividades)  │
│  ┃🟠 Quiz: Ecuaciones lineales        📝 28/30 entregas · 28 x cal│
│  ┃   Publicada hace 3d · vence mañana 23:59                        │
│  ┃────────────────────────────────────────────────────────────────│
│  ┃✍ Tarea: Problemas de aplicación    BORRADOR · sin publicar      │
│  ┃                                                                  │
│  ░  ✔ Taller: Despeje (calificado)    30/30 · prom 7.9   [colapsada]│
│  ▼ UNIDAD 1 · Números reales                      (colapsada ▸)     │
└───────────────────────────────────────────────────────────────────┘
```

### 3.5 Wireframe — Aula, vista actividades (estudiante)

```
┌───────────────────────────────────────────────────────────────────┐
│  Matemáticas · Prof. Cárdenas                                       │
│  Estado: [Pendientes•] [Por vencer] [Devueltas] [Calificadas]      │
├───────────────────────────────────────────────────────────────────┤
│  ❗ HOY                                                              │
│  ┃⚠ Quiz: Ecuaciones lineales   Vence hoy 23:59 · 20 min · 1 intento│
│  ┃   [ Empezar ahora → ]                                            │
│  ┃🔄 Tarea: Ensayo (devuelta)    "Revisa la tesis" · reenviar       │
│  ── Esta semana ──────────────────────────────────────────────────│
│  ┃⏳ Taller despeje              Faltan 3 días · 0/10 hecho         │
│  ── Ya entregado ─────────────────────────────────────────────────│
│  ░ ✔ Foro presentación   Entregado lun · esperando nota            │
│  ░ 📝 Diagnóstico         8.5/10 · "Buen dominio" [ver feedback]    │
└───────────────────────────────────────────────────────────────────┘
```

### 3.6 Línea de tiempo de cada actividad

En el detalle, una mini-timeline horizontal (no solo "fecha límite"):

```
  Publicada ──● ─── Disponible ──● ─────── Entregaste ──● ── Calificada ──●
   12 jun        15 jun 8:00       17 jun 21:40           19 jun  (8.5)
                                   [ Faltan 2d para el cierre ]
```

Campos: `publishedAt`, `openDate`, `submittedAt` (de `ActivitySubmission`), `gradedAt`, `dueDate`. Todos existentes o triviales de añadir.

---

## 4. Experiencia del Docente

### 4.1 Widgets de "centro de control" (cabecera del aula y del módulo)

Reutiliza el patrón ya validado en Workspace V2 ("Centro del día"). Widgets accionables, cada uno es un filtro al hacer clic:

- **Por calificar (n)** → abre lista filtrada a entregas `SUBMITTED` sin nota.
- **Vence hoy (n)** → actividades con `dueDate` = hoy.
- **Sin ninguna entrega (n)** → actividades publicadas con 0 `submissions` (señal de problema: no llegó, está mal comunicada, o muy difícil).
- **Borradores (n)** → `publishedAt == null`.
- **Participación** → % de estudiantes que entregaron, con heatmap por estudiante.
- **Termómetro de dificultad** (IA): actividades con promedio < 60% o tasa de no-entrega alta → "esta actividad puede estar mal calibrada".

### 4.2 Cola de calificación (productividad real)

Un modo "calificar todo" tipo bandeja: una entrega a la vez, atajos de teclado, rúbrica al lado, sugerencia de retroalimentación por IA (editable, nunca automática en notas críticas — coherente con la regla ya presente en `apd-ai.service.ts:427`).

---

## 5. Experiencia del Estudiante (vista especializada)

No es la UI del docente recortada. Es una vista construida alrededor de **cuatro preguntas**:

1. **¿Qué hago hoy?** → bloque "Hoy" con lo accionable urgente (cross-aula).
2. **¿Qué tengo pendiente?** → agrupado por urgencia, no por materia.
3. **¿Qué ya entregué?** → colapsado, tranquilizador ("vas al día").
4. **¿Qué me calificaron / me devolvieron?** → con feedback visible y acción de corregir.

### 5.1 Wireframe — Inicio del estudiante (cross-aula)

```
┌───────────────────────────────────────────────────────────────────┐
│  Hola, Sara 👋        Tu semana:  ▓▓▓▓▓░░░  5 de 8 al día           │
│  ┌── HOY (2) ───────────────────────────────────────────────────┐ │
│  │ ⚠ Quiz Matemáticas · vence 23:59 · 20min      [ Empezar ]     │ │
│  │ 🔄 Ensayo Lengua devuelto · corregir hoy       [ Ver nota ]   │ │
│  ├── PRÓXIMO (3) ───────────────────────────────────────────────┤ │
│  │ ⏳ Taller Física · faltan 2d                                   │ │
│  │ ⏳ Lectura Sociales · faltan 4d                                │ │
│  ├── RECIÉN CALIFICADO (2) ─────────────────────────────────────┤ │
│  │ 📝 Biología 9.0  ·  📝 Inglés 8.0 (con comentario)            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  🏆 Racha de entregas a tiempo: 6   ·   Logros: 12                  │
└───────────────────────────────────────────────────────────────────┘
```

Justificación (carga cognitiva): el estudiante adolescente no planifica bien; reducir su decisión a "esto, ahora" baja la ansiedad y sube la tasa de entrega. La racha y el progreso semanal usan motivación intrínseca (progreso visible) sin convertir todo en puntos.

---

## 6. IA Unificada — `PedagogicalBrain`

### 6.1 El problema, en una frase

Hoy hay **un buen motor** (`ApdAiService`) que EdusynPlay usa bien y Classroom casi no usa. No hay que crear otra IA: hay que **promover el motor a un servicio pedagógico compartido y enchufarlo en todos los generadores.**

### 6.2 Arquitectura propuesta

```
                    ┌──────────────────────────────────────┐
                    │        PedagogicalBrain (core)        │
                    │  (evoluciona desde ApdAiService)      │
                    │                                       │
   Personalidad ───▶│  • Persona "Valeria" (system base)    │
   Criterios     ──▶│  • Rúbricas + escalas de evaluación   │
   Bloom/Comp.   ──▶│  • Taxonomía de Bloom + competencias  │
   Dificultad    ──▶│  • Parámetro de dificultad (1–5)      │
   Contexto      ──▶│  • Memoria de contexto (grado/área/   │
                    │    DBA/historial del estudiante)      │
                    │  • Esquemas JSON + validación + dedup  │
                    └───────────────┬──────────────────────┘
            ┌───────────────┬───────┴────────┬─────────────────┐
            ▼               ▼                ▼                 ▼
   generateQuiz()   generateLesson()   generateSimulacro()  askValeria()
   (Play+Class)     (Classroom)        (ICFES)              (asistente)
```

### 6.3 Contrato compartido (`PedagogicalContext`)

Un único objeto de contexto que **todos** los generadores reciben, para que "parezcan una sola IA":

```ts
interface PedagogicalContext {
  gradeName: string;          // "8°"
  subjectName: string;        // "Matemáticas"
  area?: string;              // "Pensamiento numérico"
  standards?: string[];       // DBA / estándares MEN / Saber
  competencies?: string[];    // competencias objetivo
  bloomLevel?: 'recordar'|'comprender'|'aplicar'|'analizar'|'evaluar'|'crear';
  difficulty?: 1|2|3|4|5;
  language: string;           // 'español'
  studentMemory?: {           // para adaptatividad/ICFES
    weakCompetencies: string[];
    recentErrors: string[];
  };
  rubric?: RubricRef;
}
```

### 6.4 Personalidad unificada (Valeria)

Extraer el `systemInstruction` base de Valeria (hoy disperso en `apd-ai.service.ts:413,442`) a una constante `VALERIA_PERSONA` y **prefijarla en todos los generadores** (quiz, lección, simulacro). Así el tono, los criterios pedagógicos y las restricciones (no inventar datos, no tocar notas críticas) son idénticos en ambos módulos.

### 6.5 Mejoras al prompt de generación (transversales)

Sobre el prompt actual de `generateQuizQuestionsChunk` (que ya es bueno), añadir al `systemInstruction`:
- Nivel de Bloom objetivo y verbo asociado.
- Competencia/estándar (DBA/Saber) a evaluar.
- Dificultad 1–5 con descriptor ("3 = aplicación en contexto nuevo").
- Para ICFES: estructura de pregunta Saber (contexto + enunciado + 4 opciones, una mejor justificada).

### 6.6 Acción mínima que cierra la brecha (O2)

Reemplazar el cuerpo de `lesson.service.ts:generateLessonStructure` por una llamada a `PedagogicalBrain.generateLesson(context)` que produzca slides reales (CONTENT con explicación pedagógica, ACTIVITY con preguntas Bloom-calibradas, CHECKPOINT con feedback). Mantener la plantilla actual **solo** como fallback si el LLM está deshabilitado (`isEnabled() === false`), con un aviso visible "modo sin IA".

---

## 7. Rediseño de Lecciones Interactivas (sensación 2026)

Modelo objetivo: **bloques cortos + interacción cada 2–3 pantallas + feedback inmediato + progreso visible** (Brilliant/Khan/Nearpod), con identidad Edusyn.

### 7.1 Tipos de slide ampliados (aditivo a `LessonSlide`)

A los actuales `CONTENT/ACTIVITY/CHECKPOINT/BADGE_REVEAL` añadir como subtipos/`activityData`:
- **Pregunta incrustada** con corrección inmediata + explicación (ya generable por el Brain).
- **Video interactivo** (pausa con pregunta en timestamp).
- **Simulación/manipulable** (slider de parámetros, gráfica viva) — empezar con 2–3 plantillas por área.
- **"Valeria explica"**: el estudiante puede pedir otra explicación / un ejemplo / una pista sin salir de la lección (askValeria con el contexto de la slide).
- **Rama adaptativa**: si falla el checkpoint → slide de refuerzo; si acierta → salta.

### 7.2 Gamificación con propósito (no puntos por puntos)

- **XP por dominio**, no por clics: se gana al superar checkpoints, no al avanzar.
- **Rutas de aprendizaje**: secuencia de lecciones con prerrequisitos (mapa tipo Duolingo por unidad).
- **Insignias** ligadas a competencias reales (reusar modelo `Achievement` ya existente).
- **Racha** y **progreso por bloques** (barra de unidad).
- **Maestría**: una competencia se marca "dominada" tras N aciertos en contextos distintos.

### 7.3 Wireframe — Lección en curso (estudiante)

```
┌───────────────────────────────────────────────────────────────────┐
│  Unidad 2 · Ecuaciones        Bloque 3/7  ▓▓▓░░░░   🔥6   ⭐120     │
├───────────────────────────────────────────────────────────────────┤
│   Una ecuación lineal tiene la forma  ax + b = 0 ...               │
│                                                                     │
│   ❓ Si 2x + 4 = 0, ¿cuánto vale x?                                 │
│      ( ) x = 2     (•) x = -2     ( ) x = 4     ( ) x = -4          │
│                                                                     │
│   ✅ ¡Correcto!  +10 XP   ·   "Despejaste bien: x = -b/a"           │
│                                  [ 💬 Pídele otra explicación a Valeria ]│
│                                                   [ Continuar → ]   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 8. Rediseño de Simulacros ICFES (producto de preparación)

Objetivo: pasar de "examen con preguntas" a **sistema de preparación con diagnóstico, predicción y mejora cíclica**.

### 8.1 Durante el simulacro

```
┌───────────────────────────────────────────────────────────────────┐
│  Saber 11 · Simulacro #3            ⏱ 01:42:18   [ ⏸ ] [ Entregar ] │
│  Bloque: Matemáticas (12/25)                                        │
│  ▣▣▣▣▣▣▣▣▣▣▣◻◻◻◻◻◻◻◻◻◻◻◻◻◻   ⚑ marcadas: 3                          │
├───────────────────────────────────────────────────────────────────┤
│  12. (Contexto Saber...) ...enunciado...                           │
│      ( ) A   ( ) B   ( ) C   ( ) D                                 │
│      [ ⚑ Marcar para revisar ]      [ Anterior ]  [ Siguiente → ]  │
└───────────────────────────────────────────────────────────────────┘
```

Requisitos técnicos: cronómetro **persistido en backend** (resiste recarga/desconexión), navegación por bloques, marcar/"responder después", auto-guardado por pregunta.

### 8.2 Después del simulacro (lo más valioso)

- **Puntaje global estimado ICFES** (modelo de conversión por área, calibrable).
- **Por competencia y por componente**: % de acierto, tiempo medio, comparado con simulacros previos (tendencia).
- **Fortalezas / debilidades** auto-detectadas.
- **Plan de mejora automático** (IA): "Tus errores se concentran en *pensamiento aleatorio*. Te asigné 1 lección + 1 mini-quiz".
- **Generación del siguiente simulacro según errores**: el Brain crea un simulacro nuevo sobrerrepresentando las competencias débiles (`studentMemory.weakCompetencies`).

### 8.3 Wireframe — Reporte post-simulacro

```
┌───────────────────────────────────────────────────────────────────┐
│  Resultado · Simulacro #3                Puntaje estimado: 312 ▲+24 │
│  ┌── Por área ────────────────────────────────────────────────┐    │
│  │ Matemáticas      ▓▓▓▓▓▓▓░░░ 71%   ▲                          │    │
│  │ Lectura crítica  ▓▓▓▓▓░░░░░ 54%   ▼  ← foco                  │    │
│  │ Sociales         ▓▓▓▓▓▓░░░░ 63%   =                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│  Debilidad principal: inferencia textual (Lectura)                  │
│  🤖 Plan: 2 lecciones + 1 simulacro corto enfocado  [ Empezar ]    │
└───────────────────────────────────────────────────────────────────┘
```

---

## 9. Nuevas métricas e indicadores

**Docente (por aula):** % participación, n° por calificar, actividades sin entregas, tiempo medio a calificar, "termómetro de dificultad" (actividades mal calibradas), competencias menos dominadas del grupo.

**Estudiante:** % de la semana al día, racha de entregas a tiempo, competencias dominadas/en progreso, predicción ICFES y tendencia.

**Producto (interno):** % de actividades creadas con IA, tasa de aceptación de drafts IA (señal de calidad real del Brain), uso de "Valeria explica" en lecciones, lecciones completadas vs iniciadas.

---

## 10. Roadmap de implementación

### Quick Wins (1–2 semanas) — solo frontend + un cableado
- **O1** Estado visual en 5 s: función `deriveStatus`, chips, jerarquía, colapso de lo terminado. (Sin migración.)
- **O4** Filtros por estado + tiempo; vistas por defecto distintas para docente/estudiante.
- **O5 (parcial)** Cabecera de resumen del aula (por calificar / vence hoy / borradores / sin entregas).
- Mini-timeline en el detalle de actividad.
- **Anti-regresión:** todo deriva de campos existentes; cero cambio de datos → seguro para staging→prod.

### Mediano plazo (1–3 meses)
- **O2** `PedagogicalBrain` v1: extraer `VALERIA_PERSONA`, contrato `PedagogicalContext`, y **cablear Lecciones a IA real** (matar placeholder, dejar fallback).
- **O3** Vista Estudiante "Hoy" cross-aula.
- **O6** Organización por Unidad→Semana usando `ClassroomSection` (UI de agrupar/colapsar).
- **O5 (full)** Cola de calificación + sugerencia de feedback IA.
- Prompt enriquecido con Bloom + competencias + dificultad (transversal).

### Largo plazo (6–12 meses)
- **O9** Lecciones 2026: video interactivo, simulaciones, ramas adaptativas, rutas y maestría.
- **O8** ICFES como producto: cronómetro persistido, analítica por competencia/componente, predicción de puntaje, plan de mejora y generación cíclica de simulacros.
- **Memoria del estudiante** alimentando adaptatividad en lecciones y ICFES.
- Panel de calidad de IA (tasa de aceptación de drafts) para mejora continua del Brain.

---

## 11. Justificación (UX · pedagogía · carga cognitiva · productividad · motivación)

- **UX / carga cognitiva:** una lista plana obliga a leer todo para decidir; "Contenedor + Estado + Urgencia" externaliza la decisión en color y posición (preattentive processing). El usuario entiende en <5 s porque no *lee*, *escanea*.
- **Pedagogía:** Bloom + competencias en el Brain garantizan que las preguntas evalúen niveles cognitivos variados y estándares reales (Saber/DBA), no solo memoria. El feedback inmediato en lecciones es el principio de mayor efecto en aprendizaje (retrieval practice + corrección inmediata).
- **Productividad docente:** los widgets convierten "buscar qué falta" en "un clic". La cola de calificación y el feedback sugerido reducen el costo marginal de calificar, que es el cuello de botella real.
- **Motivación del estudiante:** la vista "Hoy" reduce ansiedad (decisión única), y la gamificación atada a dominio (no a clics) sostiene motivación intrínseca sin inflar métricas vacías.
- **Identidad Edusyn:** Valeria como hilo conductor (misma voz en Classroom, Play, lecciones y ICFES) es lo que hace que se sienta "una sola IA". No copiamos a Duolingo/Linear: tomamos su *gramática de interacción* y la vestimos con la voz pedagógica de Edusyn.

---

## 12. Riesgos y notas de migración (staging → prod)
- Quick wins (§10) son **render puro**: sin riesgo de datos.
- `PedagogicalBrain` debe degradar con gracia si `APD_AI_API_KEY` falta (fallback de plantilla con aviso) — el patrón ya existe en `ApdAiService.isEnabled()`.
- Campos nuevos eventuales (`submittedAt`, `gradedAt` si no existieran en `ActivitySubmission`) → migración aditiva, nullable, con backfill desde `updatedAt`.
- Validar primero en staging con el `docs/PLAN_PRUEBAS.md`; promover a `main`→prod con backup previo (mismo protocolo de Workspace V2 en `docs/ESTADO.md`).
```
```

> Próximo paso sugerido: empezar por los **Quick Wins (O1+O4)** en `apps/web/src/pages/Classroom.tsx` (componente `ActivitiesTab`) — alto impacto percibido, cero migración.

---
---

# PARTE II — Language Learning Engine (LLE)
### Una capacidad de idiomas integrada al Aula Virtual, activable por institución (premium / bilingüe)

> Estado: documento fundacional. El resto de la visión de producto (VISION_PRODUCTO_2030) queda **en espera**; el foco operativo es esta capacidad sobre el Aula Virtual.
> Mecanismo de activación: el LLE es un **entitlement premium por institución**, gobernado por el **Orquestador de IA ya existente** (`apd-ai.service.ts`, multi-key free/premium; §21 de `DISENO_PEDAGOGICO_IA.md`). Las instituciones bilingües o que paguen lo activan; las demás no lo ven. Cero impacto para quien no lo usa.
> Tesis: **no construimos un módulo de inglés. Extendemos las actividades del Aula Virtual con cuatro componentes de evidencia lingüística (Reading/Listening/Speaking/Writing) que alimentan calificaciones, competencias y analítica como cualquier otra evidencia.**

---

## II.0. Crítica de la propuesta (sin complacencia)

Antes de elevarla a documento fundacional, hay que romperla. La propuesta es fuerte en filosofía y peligrosamente liviana en los tres puntos que deciden si vive o muere.

### II.0.1 El error de subestimar la evaluación de pronunciación (riesgo #1, make-or-break)
La propuesta acierta en *"no asumir que un LLM evalúa pronunciación"*. Pero no reconoce que la alternativa es **el subsistema más caro, más difícil y más riesgoso de todo el LLE**:
- El ASR de consumo (Whisper, Google STT) está entrenado con **hablantes nativos adultos**. Con niños colombianos aprendiendo inglés (L2, acento marcado, voz infantil) **degrada fuertemente** → puntajes injustos → la confianza del docente y del colegio colapsa en la primera semana. Un solo puntaje injusto a un niño destruye la credibilidad del producto.
- *Forced alignment* + *Goodness of Pronunciation (GOP)* a nivel fonema es un problema de ML especializado, no un "feature".
- **Consecuencia:** si esto se construye mal o se promete antes de tiempo, el LLE nace muerto.
- **Decisión que la propuesta no toma — build vs buy:** NO construir motor de voz propio con el equipo actual. Usar un **proveedor turnkey de Pronunciation Assessment** (Azure Pronunciation Assessment, Speechace, ELSA API) detrás de una **interfaz `SpeechAssessmentProvider`** intercambiable. El moat NO es el motor de voz (cualquiera llama a Azure); el moat es la evidencia integrada (§II.10). Construir Kaldi/MFA propio es quemar 18 meses en lo que NO te diferencia.

### II.0.2 "Confianza" no es medible desde el audio (riesgo pedagógico/ético)
La lista de evidencia de Speaking incluye *"confianza"*. **Eso es ingenuo y peligroso.** No existe señal acústica fiable de "confianza"; lo que se mide son *proxies* (tasa de muletillas, pausas, reinicios). Etiquetar eso como "confianza" **castiga injustamente a estudiantes tímidos, tartamudos o neurodivergentes**. Reformular: la evidencia es *fluidez, pausas, muletillas, tiempo hablado* — descriptores observables, nunca juicios sobre la persona. (Coherente con la "Carta de Límites de Valeria" del Anexo A.)

### II.0.3 El sesgo de acento es una bomba ética y, a la vez, tu mayor diferenciador
Casi todas las plataformas (Duolingo, ELSA) puntúan contra un ideal **nativo (General American)**. Puntuar a un niño colombiano contra ese ideal es injusto y pedagógicamente erróneo: el objetivo del MCER/CEFR es **inteligibilidad y comunicación, no sonar gringo**.
- **Riesgo:** reproducir sesgo lingüístico colonial dentro de un producto educativo colombiano.
- **Oportunidad (la conviertes en moat):** Edusyn puntúa por **inteligibilidad**, no por *native-likeness*, con **acento objetivo configurable** por institución. Esto es éticamente correcto *y* casi nadie lo hace. Es un diferenciador real, no cosmético.

### II.0.4 CEFR no es un test; es un marco. Auto-asignar nivel es psicométricamente frágil
Mapear el desempeño de *una* actividad → un nivel A1/B2 es estadísticamente inválido. El nivel CEFR debe ser **derivado, validado por el docente y acumulado** sobre muchas evidencias a lo largo del tiempo, nunca un veredicto de una tarea. El átomo correcto no es "el nivel": son los **can-do statements** del CEFR ("puedo describir mi familia con frases simples"). Esos *can-do* son competencias → se enchufan directo al **grafo de competencias**. Este es el ajuste conceptual más importante de todo el documento (§II.9).

### II.0.5 El fraude en 2026 es asistido por IA, y un par de medidas se contradicen con "sin biometría"
- El estudiante puede pedirle a una IA el ensayo, o generar el texto y leerlo con TTS en Speaking. Las contramedidas propuestas (oral espontáneo, imagen al momento, tiempo limitado, detección de lectura) son razonables.
- **Pero "consistencia de voz" entre sesiones ES una huella de voz (voiceprint) → es biometría.** Contradice el principio "sin biometría obligatoria". Hay que resolverlo: usar consistencia de voz solo como **señal blanda de revisión para el docente** (no como bloqueo ni identidad), opt-in, y nunca como prueba determinante. "Detección de lectura" (leído vs espontáneo) es además un modelo de ML no trivial: tratarlo como señal probabilística, no como acusación.

### II.0.6 El costo real no es el LLM: es el segundo de audio evaluado
La propuesta optimiza el costo del LLM (correcto para Reading/Writing) pero **el driver de costo del LLE es el Speaking** (ASR + pronunciation API por enunciado). Reading y Listening pueden vivir casi gratis; Speaking cuesta dinero por cada grabación. Esto obliga a un **modelo de precio por habilidad** (§II.13): Speaking es el tier caro.

### II.0.7 Alcance: esto es un producto de varios años, no un sprint
Cuatro habilidades × (flujo manual + flujo IA) × motor de voz × RPG gamificado × extensibilidad a otras materias = **enorme**. La ambición de extender la gamificación a Matemáticas/Programación/Ciencias es correcta como *arquitectura* pero **no se construye ahora**: solo se deja la puerta abierta. Sin una fase brutal (§II.16), el LLE se traga al equipo.

### II.0.8 Lo que la propuesta acierta y hay que proteger
- *"Todo genera evidencia reutilizable, no archivos"* — **este es el moat entero.** Es lo que ninguna app de idiomas (Duolingo/ELSA) tiene, porque no son el sistema de registro del colegio.
- *Doble flujo (manual / IA), IA propone y el docente decide* — correcto y coherente con todo el ecosistema.
- *Componentes combinables dentro de la actividad* — correcto: encajan en el `LearningObject` (Activo Pedagógico Vivo), no en objetos nuevos.
- *Gamificación como identidad de aprendizaje transversal* — idea brillante; pertenece como capa genérica (§II.11).

**Veredicto de la crítica:** la propuesta tiene potencial real de ser **uno de los principales diferenciadores estratégicos de Edusyn para instituciones bilingües** — pero solo si (1) se compra el motor de voz en vez de construirlo, (2) se puntúa por inteligibilidad y no por acento nativo, (3) CEFR se trata como evidencia acumulada de can-do's, y (4) se faseа sin piedad. Con esos cuatro cambios, pasa de "buena idea" a "difícil de copiar en 10 años".

---

## II.1. Visión

> **El Aula Virtual de Edusyn aprende a escuchar, leer, hablar y escribir contigo — y cada palabra del estudiante se convierte en evidencia que vive en su boletín, sus competencias y su historia de aprendizaje.**

El LLE no es una app de idiomas pegada al LMS. Es la prueba de que la filosofía de Edusyn —*todo genera evidencia, nada es un módulo aislado*— se sostiene incluso en el dominio más difícil de evaluar: la lengua hablada. Si el habla de un niño puede volverse evidencia académica reutilizable dentro del Aula Virtual, cualquier cosa puede.

---

## II.2. Principios (no negociables)

1. **Todo ocurre dentro de la actividad del Aula Virtual.** No hay laboratorio, no hay app aparte, no hay "ir a otro lado". El Speaking se graba donde se entrega la tarea.
2. **El docente puede construir todo a mano, siempre.** La IA es opcional. Un colegio sin presupuesto de IA usa el LLE completo en modo manual.
3. **La IA propone borradores y explica; nunca decide.** Ni el texto, ni la nota, ni el nivel CEFR. El docente valida.
4. **Todo produce evidencia reutilizable, no archivos.** Un audio no es un .mp3: es transcripción + métricas + can-do's demostrados, consumibles por calificaciones, competencias y analítica.
5. **Se puntúa la inteligibilidad, no el acento nativo.** Acento objetivo configurable. Ética antes que imitación.
6. **Ninguna métrica juzga a la persona.** Se miden conductas observables (fluidez, pausas), nunca rasgos ("confianza", "timidez").
7. **CEFR es evidencia acumulada, no un veredicto de una tarea.** El nivel se deriva de can-do's a lo largo del tiempo y lo confirma el docente.
8. **Degradación elegante.** Sin IA premium: Reading/Listening/Writing funcionan; Speaking cae a "grabar + rúbrica manual del docente". Nunca se rompe; se reduce.
9. **Activable y aislable por institución.** Entitlement premium vía el orquestador existente. Quien no paga, no lo ve; quien no lo usa, no lo paga.

---

## II.3. Arquitectura conceptual

```
                    ┌──────────────────────────────────────────┐
                    │   ACTIVIDAD DEL AULA VIRTUAL (existente)  │
                    │   ClassroomActivity + LearningObject      │
                    └───────────────────┬──────────────────────┘
                         contiene 1..n COMPONENTES de idioma
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
    READING        LISTENING       SPEAKING        WRITING
   (texto+Qs)    (audio+Qs)      (grabación)     (texto libre)
        │              │              │              │
        └──────────────┴──────┬───────┴──────────────┘
                              ▼
              ┌───────────────────────────────────┐
              │      MOTOR DE EVIDENCIA (LLE)      │
              │  normaliza cada componente a:      │
              │  • métricas observables            │
              │  • can-do's CEFR demostrados       │
              │  • nivel sugerido (no final)       │
              └───────────────┬───────────────────┘
        ┌──────────┬──────────┼──────────┬──────────────┐
        ▼          ▼          ▼          ▼              ▼
  CALIFICA-   COMPETEN-   ANALÍTICA   WORKSPACE     GAMIFICA-
   CIONES      CIAS                   (Biblioteca)   CIÓN (id.)
        ▲          ▲          ▲          ▲              ▲
        └──── proveedores intercambiables detrás de interfaces ────┘
   SpeechAssessmentProvider · TTSProvider · LLMProvider(orquestador)
```

**Claves arquitectónicas:**
- Los componentes **no son tablas nuevas de "inglés"**: son tipos de bloque dentro del `LearningObject` (Activo Pedagógico Vivo) y producen `ActivitySubmission` enriquecidas con un payload de evidencia lingüística.
- Tres **proveedores detrás de interfaces** para no acoplarse a un vendor: voz (Azure/Speechace), TTS (para generar Listening), y LLM (el orquestador free/premium ya existente).
- El **Motor de Evidencia** es el corazón: traduce señales crudas (audio, texto) a moneda académica (can-do's + métricas), que es lo único que el resto del ecosistema consume.

---

## II.4. Los cuatro componentes (qué evidencia produce cada uno)

| Componente | Insumo del docente (manual) | Ayuda opcional de Valeria | Evidencia que genera | Costo IA |
|---|---|---|---|---|
| **Reading** | Escribe/pega texto, sube PDF | Genera texto + vocabulario + preguntas + objetivos, adaptado por nivel | Comprensión, vocabulario, can-do's de lectura | Bajo (LLM, cacheable) |
| **Listening** | Sube/graba audio | Genera guion y lo sintetiza (TTS): narración, diálogo, entrevista, podcast, anuncio — con velocidad/acento/nivel | Comprensión auditiva, can-do's de escucha | Medio (TTS, **cacheable y reutilizable**) |
| **Speaking** | Define la consigna ("Describe your family") + rúbrica | Sugiere consignas y rúbricas | Transcripción, pronunciación (inteligibilidad), fluidez, pausas, vocabulario, gramática, tiempo hablado, can-do's orales | **Alto (ASR+pron. por enunciado)** |
| **Writing** | Define la consigna | Sugiere mejoras *ancladas a rúbrica* (no "suena más nativo") | Coherencia, gramática, léxico, can-do's escritos | Bajo-medio (LLM) |

> Regla de oro del feedback de Writing/Speaking: la IA corrige **contra la rúbrica y el nivel objetivo**, no contra un ideal nativo. No homogeneizar; no borrar la voz del estudiante.

---

## II.5. Arquitectura de evaluación de Speaking (el subsistema crítico)

Responsabilidades **separadas**, nunca mezcladas (esto la propuesta lo pide y es correcto):

```
 audio del estudiante
        │
        ▼
 [1] SPEECH RECOGNITION (ASR)  → transcripción
        │
        ▼
 [2] FORCED ALIGNMENT          → alinea fonemas con la transcripción
        │
        ▼
 [3] PRONUNCIATION ASSESSMENT  → GOP por fonema/palabra → score de INTELIGIBILIDAD
        │                         (acento objetivo configurable)
        ▼
 [4] FLUENCY/PROSODY           → ritmo, pausas, muletillas, tiempo hablado
        │
        ▼
 [5] LLM (orquestador)         → SOLO EXPLICA en lenguaje pedagógico
        │                         "tu /θ/ en 'think' suena como /t/; practica…"
        ▼
 EVIDENCIA + sugerencia de nota  →  el DOCENTE revisa y decide
```

- Pasos [1]–[4] = proveedor turnkey (Azure Pronunciation Assessment cubre 1–4 en una sola llamada). [5] = el LLM solo traduce números a consejo humano. **El LLM nunca puntúa pronunciación.**
- **Degradación:** sin proveedor de voz → Speaking sigue existiendo como "graba + el docente califica con rúbrica". La evidencia entonces es la rúbrica docente, no las métricas automáticas. El componente nunca desaparece.

---

## II.6. Experiencia del estudiante

```
┌───────────────────────────────────────────────────────────────┐
│  Tarea: "My Family"  ·  English · Mrs. López        ⏱ 15 min   │
│  ── Speaking ─────────────────────────────────────────────────│
│   🎙  "Describe your family in 60 seconds."                    │
│        [ ● Hablar ]     (no sales del aula)                    │
│        ─ grabando ──────────────────────  0:42                 │
│        [ Escuchar ]  [ Reintentar (1/2) ]  [ Enviar → ]        │
│  ── después de enviar ───────────────────────────────────────│
│   ✔ Recibido. Valeria está analizando tu audio…               │
│   📊 Tu evidencia (borrador, tu profe confirma la nota):       │
│      Inteligibilidad ▓▓▓▓▓▓▓░ 78%  · Fluidez ▓▓▓▓▓░ buena      │
│      🗣 "Excelente uso de 'older/younger'. Tu /θ/ en           │
│          'brother' suena como /d/ — practica con esta pista."  │
│      🎯 Can-do alcanzado: "Puedo describir a mi familia"       │
└───────────────────────────────────────────────────────────────┘
```

El estudiante nunca recibe solo una nota: recibe **una dirección** (qué practicar) y **un logro** (qué can-do desbloqueó). La evidencia es async (segundos): se diseña para la espera, no se finge instantaneidad.

---

## II.7. Experiencia del docente

- **Construcción:** abre una actividad, añade los componentes que quiera (solo Listening; o Speaking+Writing; o los cuatro). Modo manual completo o con borradores de Valeria.
- **Calificación:** una bandeja por habilidad. Para Speaking, ve transcripción + métricas + audio + sugerencia de nota; **ajusta y confirma** (la nota es suya). Atajos de teclado, rúbrica al lado.
- **Confianza:** cada métrica automática es etiquetada "borrador IA"; el docente la valida. La IA explica *por qué* sugiere lo que sugiere (explicable, como en todo el ecosistema).
- **Sin sorpresas de costo:** el colegio premium tiene cuota; el docente ve cuánto Speaking automático le queda en el periodo (gobernado por el orquestador).

---

## II.8. Integración con el Aula Virtual y con el Estudio (Diseño Pedagógico IA)

- **Aula Virtual:** los componentes son bloques de la actividad existente; la entrega es una `ActivitySubmission` con payload lingüístico. Cero módulo nuevo en el menú.
- **Estudio / Activo Pedagógico Vivo:** Valeria puede generar un `LearningObject` que **ya nace con** componentes Reading/Listening/Speaking/Writing dentro — no son objetos separados, son parte del mismo activo. "Convertir en actividad" arrastra los componentes y su rúbrica. El LLE hereda el ADN pedagógico (nivel, objetivos, competencias) del activo.

---

## II.9. Integración con Competencias (el ajuste conceptual clave)

El átomo de competencia lingüística es el **can-do statement del CEFR**, no el nivel:

```
  can-do: "Puedo describir mi familia con frases simples"   (A2 · Speaking)
        ▲ demostrado por
   evidencias: Speaking #3 (78%), Speaking #7 (85%)
        ▼ acumula
  → progreso en la competencia "Interacción oral A2"
        ▼ muchas competencias A2 dominadas + validación docente
  → NIVEL CEFR A2 sugerido al docente (nunca auto-otorgado)
```

Esto conecta el LLE directo al **grafo de competencias** de la visión: las cuatro habilidades progresan como sub-competencias independientes, y el nivel CEFR es una **lectura derivada y validada**, no un puntaje de examen. Psicométricamente honesto y filosóficamente coherente.

---

## II.10. Integración con Analítica, Workspace y Edusyn Play

- **Analítica:** el grupo se ve por habilidad y por can-do ("12/30 aún no demuestran A2 listening"). Valeria proactiva (Anexo A, presupuesto de atención): "tu 8°B viene débil en Speaking spontaneous, ¿preparo 3 actividades?".
- **Workspace / Biblioteca Institucional:** cada audio de Listening generado y cada texto de Reading se guardan como **activo reutilizable institucional** (se generan una vez, se reusan muchas — clave de costo, §II.13).
- **Edusyn Play:** vocabulario y listening pueden convertirse en quizzes Play; el speaking en vivo es una fase 3 (cara, opcional).

---

## II.11. Gamificación como **Identidad de Aprendizaje** (transversal, no solo inglés)

La gamificación NO se construye para inglés: se construye como una **capa genérica de identidad** que el inglés *estrena*.

```
  CEFR real (lo ve el docente)     Capa RPG (lo vive el estudiante)
  A1 ─────────────────────────────  Recruit → Explorer
  A2 ─────────────────────────────  Traveler → Communicator
  B1 ─────────────────────────────  Storyteller → Negotiator
  B2 ─────────────────────────────  Ambassador → Scholar
  C1/C2 ──────────────────────────  Master → Legend

  XP · misiones · boss battles · árboles de habilidad
  progreso INDEPENDIENTE por Speaking/Listening/Reading/Writing
  cosméticos · insignias · coleccionables · temporadas
```

**Reglas (para que no se corrompa ni infantilice):**
- **Progresión privada por defecto.** Nada de rankings públicos que humillen al que avanza lento (equidad). El estudiante compite contra sí mismo; comparar es opt-in.
- **XP por dominio, no por clics** (coherente con §11 del rediseño): se gana al demostrar can-do's, no al entregar.
- **Estética profesional, no Duolingo infantil.** Debe servir desde primaria hasta 11°.
- **Arquitectura agnóstica de materia:** el sistema de XP/identidad/árboles vive en una capa propia (`LearningIdentity`) para que mañana Matemáticas, Programación o Ciencias se enchufen — **pero esas materias NO se construyen ahora**, solo no se precluyen.

> Diferenciador profundo: el estudiante construye **una sola identidad de aprendizaje en Edusyn** que trasciende el inglés. Eso es retención e identidad, no una racha de Duolingo.

---

## II.12. Anti-fraude (elevar el costo de hacer trampa, sin biometría obligatoria)

Capas combinables, todas **señales de revisión para el docente**, ninguna acusación automática:
- Oral espontáneo (consigna revelada al momento), tiempo limitado, imagen/prompt generado en el instante.
- Comparación audio↔texto (¿el hablado coincide con un texto pegado?), detección probabilística de *lectura* vs habla espontánea.
- Historial de fluidez del estudiante (un salto sospechoso → revisar, no sancionar).
- **Consistencia de voz: opt-in, señal blanda, nunca identidad ni bloqueo** (resolución de la tensión con "sin biometría": es ayuda al docente, no un voiceprint obligatorio).
- Principio: **subir el costo del fraude, no perseguir al estudiante.** Falsos positivos sobre menores son inaceptables.

---

## II.13. Costo, orquestación y modelo de negocio

- **Reuso > generación:** un audio de Listening o un texto de Reading se generan **una vez** y se guardan en la Biblioteca Institucional → costo amortizado a casi cero con el uso.
- **Caché y degradación:** Reading/Writing/Listening usan el tier free del orquestador; **Speaking es el único tier caro** (ASR+pron. por enunciado) y se gobierna por cuota.
- **Precio por habilidad:** el entitlement bilingüe puede vender Reading/Listening/Writing en un tier base y **Speaking automático como add-on premium** (porque es el que cuesta dinero real por uso). Quien no paga Speaking automático, lo usa en modo manual (grabar + rúbrica docente).
- **Activación por institución:** vía el orquestador existente (multi-key, cuota, medición y caché ya implementados). Sin trabajo nuevo de infraestructura para "activar solo a quien paga".

---

## II.14. Diferenciadores frente a la competencia

| Plataforma | Qué hace | Qué NO puede hacer (tu ventaja) |
|---|---|---|
| **Duolingo / ELSA** | Práctica de consumo, gamificada, pronunciación | No son el sistema de registro del colegio: **su evidencia no llega al boletín, ni al docente, ni a la competencia institucional**. App aislada. |
| **Moodle** | LMS abierto, plugins | Sin evaluación de habla nativa-integrada, UX pobre, sin evidencia lingüística reutilizable |
| **Google Classroom** | Distribución de tareas | No evalúa habilidades de idioma; no tiene competencias ni CEFR |
| **Canvas** | LMS institucional serio | Genérico, gringo, sin motor de idioma ni CEFR localizado; caro |
| **Pearson/plataformas de idiomas** | Contenido CEFR, exámenes | Cerradas, contenido fijo, **el docente no construye ni la evidencia se integra al SIS del colegio** |

**La frase que resume el moat:** *Duolingo te enseña inglés; Edusyn convierte cada palabra que dice el estudiante en evidencia que vive en su boletín, su competencia y su historia académica — dentro del aula, no en otra app.* Eso solo lo puede hacer quien ya es el sistema de registro del colegio. Edusyn lo es; las apps de idiomas no.

---

## II.15. Análisis del moat (¿difícil de copiar en 10 años?)

- **Lo que NO es moat:** el motor de voz (lo compras; tu competidor también puede). El LLM (commodity). La gamificación (copiable).
- **Lo que SÍ es moat y hay que profundizar:**
  1. **Evidencia lingüística integrada al sistema de registro** (boletín + competencias + analítica). Una app de idiomas no puede copiar esto sin volverse el SIS del colegio — años de trabajo aburrido y de relaciones institucionales.
  2. **Dato longitudinal de habla por estudiante** (su trayectoria de inteligibilidad año a año). Solo lo tiene quien acompaña al estudiante varios años. Compone con el tiempo.
  3. **Banco institucional de activos de idioma** construido por los docentes (textos, audios, rúbricas, consignas) — crece con el uso y es propiedad del colegio.
  4. **Scoring por inteligibilidad con acento configurable + can-do's localizados** al currículo bilingüe colombiano — éticamente correcto y casi nadie lo hace.
- **Para hacerlo extremadamente difícil de copiar (cambios recomendados):**
  - **Portafolio de evidencia que viaja con el estudiante** entre años y grados (lock-in longitudinal).
  - **Calibración de can-do's propia y curada** (un activo de datos propietario, como el grafo canónico de la visión).
  - **La capa `LearningIdentity` transversal**: cuando la identidad de aprendizaje del estudiante abarca inglés + (mañana) matemáticas + ciencias, salirse de Edusyn cuesta *toda su identidad académica*, no solo un curso.

---

## II.16. Roadmap — qué construir primero, qué dejar para después

### Fase 0 · Fundación sin voz (4–6 semanas) — valida la tesis barato
- Componentes **Reading, Listening, Writing** dentro de la actividad (los tres baratos).
- Listening con **TTS + caché en Biblioteca**. Writing con feedback LLM anclado a rúbrica.
- Evidencia → calificaciones + can-do's (sin pronunciación todavía).
- *Por qué primero:* prueba "todo genera evidencia" sin tocar el subsistema caro/riesgoso. Si esto no enamora a un colegio bilingüe, no construyas el motor de voz.

### Fase 1 · Speaking con proveedor turnkey (6–10 semanas) — el corazón
- Integrar `SpeechAssessmentProvider` (Azure/Speechace) detrás de interfaz.
- Scoring por **inteligibilidad**, acento configurable, métricas observables (sin "confianza").
- LLM solo explica. Docente valida. Degradación a rúbrica manual.
- Entitlement premium + cuota vía orquestador.

### Fase 2 · Identidad y gamificación (8–12 semanas)
- Capa `LearningIdentity` genérica (XP, árboles por habilidad, temporadas), estética profesional, progreso privado.
- CEFR↔RPG mapping; can-do's como competencias.

### Fase 3 · Profundidad y moat (continuo)
- Portafolio longitudinal, anti-fraude avanzado, Speaking en vivo (Play), analítica predictiva por habilidad.

### En espera explícita (NO construir ahora)
- Extender la gamificación a otras materias (solo dejar la arquitectura lista).
- Motor de voz propio (seguir comprando hasta que la escala lo justifique).

---

## II.17. Visión 2035

Para 2035, un estudiante de un colegio bilingüe Edusyn habrá construido, desde primaria, un **portafolio vivo de su lengua**: miles de enunciados convertidos en evidencia, una trayectoria de inteligibilidad que su profesor de 11° puede ver desde 3°, una identidad de aprendizaje que abarca el inglés y más allá. El colegio no "usa una app de idiomas": **el idioma es una capacidad nativa de su Aula Virtual**, gobernada por sus docentes, alineada a su PEI bilingüe, y tan integrada a la vida académica que pensar en evaluarlo "por fuera" resultaría absurdo. Esa naturalidad — que el habla del niño sea, sin fricción, evidencia académica — es lo que ninguna plataforma de consumo podrá replicar, porque requiere ser, antes que nada, el sistema de la institución.

---

## II.18. Veredicto estratégico

**¿Tiene potencial de ser uno de los principales diferenciadores de Edusyn para instituciones bilingües? Sí — alto.** Es uno de los pocos lugares donde la filosofía "todo genera evidencia" produce algo que las apps de idiomas (el competidor natural en bilingüismo) *estructuralmente no pueden copiar*, porque no son el sistema de registro del colegio.

**Los cuatro cambios que lo vuelven difícil de copiar en 10 años:**
1. **Comprar el motor de voz, no construirlo** — y poner el esfuerzo en la evidencia integrada (donde está el moat).
2. **Puntuar inteligibilidad, no acento nativo** — ético y diferenciador.
3. **CEFR como can-do's acumulados** enchufados al grafo de competencias — honesto e integrado.
4. **Capa `LearningIdentity` transversal + portafolio longitudinal** — el lock-in que crece con los años y que un entrante no puede fabricar.

> Cierre: el LLE no le enseña inglés a Edusyn. Le enseña a Edusyn que cualquier capacidad humana —hablar, escribir, razonar— puede volverse evidencia viva dentro del aula. El inglés es solo la primera lengua que el Aula Virtual aprende a escuchar.
