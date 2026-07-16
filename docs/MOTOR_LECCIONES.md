# Motor de Experiencias de Aprendizaje (Lección Interactiva) — arquitectura

Corrige el veredicto de `AUDITORIA_LECCIONES_INTERACTIVAS.md`. Encargo del fundador (arquitecto principal).

## Principio rector (corrección arquitectónica)

**La Lección NO se fusiona con ABP ni se convierte en Ruta.** La Ruta de Aprendizaje YA es
Expedición ABP. Arquitectura por capas:

```
Aula Virtual
  └── Expedición ABP  (Ruta: fases · misiones · competencias · XP · narrativa · IA)
        └── usa →  Lección Interactiva   (recurso pedagógico independiente y reutilizable)
                        └── Bloques (contenido + actividad + comportamiento)
```

La Lección es **un recurso reutilizable** por ABP, Aula tradicional, Inglés, STEM, recuperaciones,
tutorías y módulos futuros. El rediseño es **interno a la Lección**: convertirla en un **motor de
bloques con comportamiento**. NO se toca ABP, Learning Routes, XP, `LearningIdentity`, ni la
arquitectura del Aula. Solo se **reutilizan** sus capacidades cuando un anfitrión lo pide.

## Modelo de datos (aditivo, compatible)

**Bloques dentro de la slide (sin romper lo viejo).** `LessonSlide` se generaliza: la slide pasa a
ser un *contenedor de bloques*.

- `LessonSlide += blocks Json?` — array de bloques tipados: `{ id, type, content, behavior }`.
  - `type`: TEXT · IMAGE · VIDEO · AUDIO · PDF · TABLE · ACTIVITY · SIMULATION · MINIGAME · FORUM ·
    DEBATE · CHALLENGE · REFLECTION · EVALUATION · AI_CONTENT · CHALLENGE_PEER (Arena, futuro).
  - `content`: payload del bloque (texto rico estructurado, no HTML crudo; url de media; activityData…).
  - `behavior` (lógica DESACOPLADA del contenido): `{ required, givesXp, xp, minScore, maxAttempts,
    xpPenaltyPerAttempt, showHint, callValeria, floatingMessage, unlockNext, sound, animation,
    celebration, timerSeconds, allowFileUpload, forumId, reward, badgeId }`.
- **Compat:** las slides viejas (con `body` HTML / `activityData`) se leen igual. El player: si la
  slide tiene `blocks`, los renderiza; si no, cae al render legacy (`body`+media+`activityData`).
  Un adaptador envuelve la slide legacy como un bloque `TEXT`+`ACTIVITY` al abrir en el editor
  nuevo, sin migración destructiva de filas.
- **XP:** el bloque solo DECLARA `givesXp/xp`; quien otorga sigue siendo `grantXp` (idempotente) —
  la Lección no duplica gamificación, la invoca. Igual que hoy.

**Seguridad del editor (Prioridad 1):** nuevo `LessonVersion { lessonId, kind (AUTOSAVE|MANUAL|
PUBLISH), label?, snapshot Json, createdById?, createdAt }`. Sin `institutionId` (consistente con
`Lesson`/`LessonSlide`, que se scopean vía activity→classroom). Autosave con poda (últimos N).

## Reutilización (no duplicar)

| Necesidad del brief | Se reutiliza |
|---|---|
| XP / niveles / insignias | `LearningIdentityService.grantXp` (idempotente) — ya cableado |
| Motores de actividad (quiz, sopa, crucigrama…) | `lesson/InteractiveBlocks` + grading puro |
| Subida multimedia | módulo `storage` + `openStoredFile` (key→URL firmada, fix del aula) |
| Biblioteca | `ClassroomMaterial` (ya es repositorio; exponer como picker) |
| Generación IA por bloque | `ApdAiService` (Valeria) — ya genera slides |
| Pistas / Valeria flotante | `activityData.hint` que Valeria ya produce |
| Foro relacionado | `ForumPost` existente (bloque FORUM lo referencia) |
| Progreso por nodo | `LessonProgress` (extender con estado por bloque) |
| Gating / obligatoriedad | patrón de `phaseCriteriaMet`/misiones ABP (mismo enfoque, NO el mismo módulo) |

## Roadmap (orden de prioridad del fundador)

1. **Seguridad del editor** — autoguardado + borrador + recuperación + versiones + restaurar +
   aviso al salir. `LessonVersion`. *(← esta entrega)*
2. **Editor visual por bloques** (mata el HTML) — @dnd-kit, bloques tipados, Tablas, `blocks Json`.
3. **Reproductor inmersivo** — render de bloques, progreso por bloque, micro-interacciones.
4. **Comportamientos configurables** por bloque (motor de reglas: gating, intentos con XP decreciente…).
5. **Multimedia + gamificación + visual** (biblioteca, temas con contraste automático, celebraciones).
6. **Arquitectura preparada** para Edusyn Arena (bloque CHALLENGE_PEER, solo el contrato, sin implementar),
   simulaciones, foros rediseñados, actividad sin sección obligatoria.

## Restricciones

Sin romper compat · lecciones viejas siguen funcionando · migraciones aditivas e incrementales ·
stack actual (React+TS+Tailwind+Framer Motion) salvo razón técnica sólida (se suma **@dnd-kit**).
