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

> **Módulo de inglés (Language Learning Engine):** la propuesta de una capacidad de idiomas integrada al
> Aula Virtual se movió a su propio documento — **`MODULO_INGLES_LLE.md`** — para trabajarla en una sesión
> dedicada sin mezclarla con este rediseño (ya implementado). Ese documento incluye un briefing de contexto
> para retomarla sin perder lo ya discutido.

