# Contexto: Expedición ABP (Aprendizaje Basado en Proyectos) — Edusyn

> Documento de contexto para trabajar con un asistente externo (ChatGPT) sobre el
> módulo **Expedición ABP** del Aula Virtual, con foco en **la experiencia del
> estudiante** y **el trabajo en equipo**. Cubre tanto la parte visual (qué ve y
> qué hace el estudiante) como el mapa de código (dónde tocar).
>
> Stack: **Backend** NestJS + Prisma + PostgreSQL. **Frontend** React + Vite +
> TailwindCSS. Monorepo (`apps/api`, `apps/web`). Multi-tenant por `institutionId`.

---

## 1. Qué es la Expedición ABP

Es un módulo de **trabajo por proyectos en equipos** dentro de un aula. La metáfora
es una **expedición de montaña**: cada equipo recorre un **sendero de 6 fases**
(hitos) hasta "llegar a la cima". El docente crea el proyecto y arma los equipos;
los estudiantes trabajan **colaborativamente** dentro de su equipo, fase por fase,
y **piden validación al docente** para avanzar a la siguiente.

**Las 6 fases** (constantes en `abp.constants.ts` → `ABP_PHASES`):

| # | Nombre | Icono | Herramienta (tool) | Qué produce el equipo |
|---|--------|-------|--------------------|------------------------|
| 1 | El Reto | 🧭 | `CANVAS` | Canvas del Problema: 4 tarjetas colaborativas |
| 2 | Tormenta de Ideas | ⚡ | `IDEAS` | Muro de ideas + votación |
| 3 | Objetivos | 🎯 | `SMART` | Un objetivo SMART (texto + checklist de 5) |
| 4 | Plan de Acción | 🛠️ | `KANBAN` | Tablero de tareas con responsables |
| 5 | Prototipo | 🚀 | `EVIDENCE` | Evidencias (enlaces/archivos) del prototipo |
| 6 | Socialización | 🏆 | `COEVAL` | Coevaluación entre equipos (escala 1–4) |

---

## 2. Modelo de datos (Prisma — `apps/api/prisma/schema.prisma`)

- **`AbpProject`** — el proyecto/expedición que crea el docente en un aula.
  Guarda `phaseConfig` (JSON) con overrides de criterios y rúbricas, y la
  portada (`presentation`, `challenge`).
- **`AbpTeam`** — un equipo. Campos clave: `name`, `emoji`, `color`, `problem`,
  `currentPhase` (1–6), `xp`, `badges` (string[]).
- **`AbpTeamMember`** — pertenencia estudiante↔equipo. `@@unique([teamId, studentEnrollmentId])`.
  Un alumno **no puede estar en dos equipos del mismo proyecto** (invariante).
- **`AbpPhaseState`** — estado de **cada una de las 6 fases** de un equipo.
  `@@unique([teamId, phase])`. Campos: `status`, `data` (JSON con TODO el
  contenido de la fase), `feedback`, `startedAt`, `submittedAt`, `validatedAt`.
  **⚠️ Todo el trabajo colaborativo de una fase vive en el campo `data` (JSON).**
- **`AbpMission`** — misiones dentro de una fase (el "trabajo real"). La 1ª misión
  de cada fase es la **misión-herramienta** (contiene el tool: CANVAS, IDEAS…).
- **`AbpMissionActivity`** — actividades dentro de una misión (lectura, video,
  quiz, evidencia, o la actividad-herramienta con `content.tool`).
- **`AbpValidationRequest`** — solicitud de validación de una fase (PENDING →
  APPROVED/RETURNED).
- **`AbpContribution`** — registro de aporte individual (para XP y trazabilidad):
  tarjeta de canvas, idea, voto, etc. Tiene `@@unique` para idempotencia.
- **`AbpComment`, `AbpDiscovery`, `AbpLogEntry`** — comentarios, "descubrimientos"
  y bitácora del equipo.

---

## 3. Máquina de estados de una fase (`AbpPhaseState.status`)

```
LOCKED  ──(la fase anterior se valida)──►  IN_PROGRESS
IN_PROGRESS ──(equipo pulsa "Solicitar validación")──► AWAITING
AWAITING ──(docente aprueba)──► VALIDATED   (+ insignia + XP; la siguiente fase pasa a IN_PROGRESS)
AWAITING ──(docente devuelve con feedback)──► IN_PROGRESS  (con `feedback` visible)
```

- Al **crear el equipo**: fase 1 = `IN_PROGRESS`, fases 2–6 = `LOCKED`
  (`createTeam` en `abp.service.ts`).
- **Solicitar validación** solo se habilita si `readyForValidation` (todas las
  misiones obligatorias completas / criterios de la fase cumplidos).
- **Aprobar** (`resolveValidation`, action `approve`): fase → `VALIDATED`, otorga
  insignia (`ABP_BADGE_ON_PHASE`) y XP, y pone la **siguiente** fase en `IN_PROGRESS`.
- **Devolver** (action `return`): fase vuelve a `IN_PROGRESS` con `feedback`.

**Criterios automáticos por fase** (`phaseCriteriaMet` en `abp.constants.ts`),
con umbrales por defecto en `DEFAULT_PHASE_CONFIG`:
- Fase 1: ≥ `minCanvasCards` (4) tarjetas llenas.
- Fase 2: ≥ `minIdeasPerMember`×nº miembros ideas, y ≥ nº miembros votos totales.
- Fase 3: los 5 criterios SMART marcados + objetivo de ≥ `minObjectiveLength` (20) chars.
- Fase 4: todas las tareas en "Hecho" **y** cada miembro con al menos una tarea.
- Fase 5: ≥ `minEvidences` (3) evidencias.
- Fase 6: permisivo (coevaluación, sin criterio automático estricto).

---

## 4. La experiencia del ESTUDIANTE (visual + qué debe hacer)

**Punto de entrada de código:** `StudentExpedition` en
`apps/web/src/components/AbpTab.tsx` (aprox. línea 1081).

### 4.1 Si aún no tiene equipo
Ve un aviso ámbar: *"Aún no estás en un equipo de este proyecto. Tu docente te
asignará a uno para empezar tu expedición."* + la portada del proyecto (Manual).

### 4.2 Si ya tiene equipo — pantalla principal
De arriba a abajo:
1. **Header**: selector de proyecto (si hay varios) + botón *"📖 Ver Manual de
   Expedición"* (abre un panel lateral con la portada del proyecto).
2. **Cabecera del equipo**: emoji + nombre, el reto, insignias ganadas y el
   contador de **⭐ XP de expedición**.
3. **Sendero (`Trail`)**: los 6 nodos de fase (hecho ✓ / actual ⏳ / bloqueado 🔒).
4. **Sub-nav**: `🚀 Fases` · `📔 Bitácora` · `💡 Descubrimientos`.
5. **Panel de la fase actual** (pestaña Fases): título de la fase, retro del
   docente si la devolvió, y **las misiones** de la fase (`MissionsPanel`).
6. Al fondo: **Anuncios** y **Recursos** del proyecto.

### 4.3 Qué hace el estudiante dentro de una fase
El panel muestra **misiones** (`MissionCard`). La misión-herramienta renderiza el
**tool** de la fase (`PhaseTool` → uno de los componentes de fase):

- **Fase 1 · `CanvasPhase`**: 4 tarjetas (`CANVAS_CARDS`): *¿Qué está pasando?*,
  *¿A quiénes afecta?*, *¿Por qué es importante?*, *¿Qué pasa si nadie lo
  resuelve?*. Cada integrante escribe en un `textarea`; **al salir del campo
  (onBlur)** se guarda (`abpApi.saveCanvas(teamId, i, valor)`). Debajo aparece
  quién aportó la tarjeta. **⚠️ Aquí está el foco actual de trabajo en equipo:
  la edición concurrente (ver §6).**
- **Fase 2 · `IdeasPhase`**: publican ideas al muro y **votan** (votos limitados
  por estudiante, `votesPerStudent`).
- **Fase 3 · `SmartPhase`**: redactan un objetivo y marcan un checklist de 5
  criterios SMART.
- **Fase 4 · `KanbanPhase`**: tablero de tareas (Por hacer / En curso / Hecho),
  cada tarea con un **responsable** (miembro del equipo).
- **Fase 5 · `EvidencePhase`**: suben evidencias (enlace o archivo).
- **Fase 6 · `CoevalPhase`**: cada equipo evalúa a los **otros** equipos (rúbrica 1–4).

Además de la herramienta, una misión puede tener **actividades** (lecturas,
videos, quizzes que se juegan con `LessonPlayer`, evidencias, tareas manuales
con checkbox). El estudiante también puede **añadir misiones/actividades propias**.

### 4.4 Cerrar una fase
Cuando se cumplen las misiones obligatorias, se habilita el botón **"Solicitar
validación"** (`abpApi.requestValidation`). La fase pasa a `AWAITING` ("Esperando
validación del docente…"). El docente aprueba (avanza a la siguiente fase, con
insignia + XP) o la devuelve con retroalimentación.

---

## 5. Mapa de código (dónde tocar)

**Frontend** (todo el módulo vive en un solo archivo):
- `apps/web/src/components/AbpTab.tsx` (~2000 líneas)
  - Estudiante: `StudentExpedition` (1081), `MissionsPanel` (481), `MissionCard`
    (402), `PhaseTool` (367).
  - Componentes de fase: `CanvasPhase` (29), `IdeasPhase` (103), `SmartPhase`
    (167), `KanbanPhase` (205), `EvidencePhase` (259), `CoevalPhase` (345).
  - Progreso: `Trail` (65). Bitácora/Descubrimientos: `LogbookView`,
    `DiscoveriesView`.
  - Docente: `TeacherProjectDetail` (1591), `CreateTeam` (1843),
    `EditTeamMembers` (1897), `TeamPreview` (1473).
- `apps/web/src/lib/api.ts` → objeto **`abpApi`** (aprox. línea 2550): todas las
  llamadas (`myTeam`, `saveCanvas`, `addIdea`, `voteIdea`, `saveSmart`, `addTask`,
  `addEvidence`, `requestValidation`, `roster`, `createTeam`, `addTeamMember`…).

**Backend** (`apps/api/src/modules/abp/`):
- `abp.controller.ts` — rutas HTTP (prefijo `/abp`). Ej.:
  `POST /abp/teams/:teamId/canvas`, `POST /abp/teams/:teamId/ideas`,
  `POST /abp/teams/:teamId/request-validation`, `GET /abp/projects/:id/my-team`.
- `abp.service.ts` — lógica. Métodos clave del estudiante: `getMyTeam`,
  `saveCanvasCard` (458), `addIdea` (493), `voteIdea`, `saveSmart`, `addTask`,
  `addEvidence`, `requestValidation` (1032), `resolveValidation` (1085).
- `abp.constants.ts` — fases, `DEFAULT_PHASE_CONFIG`, `phaseCriteriaMet`,
  `CANVAS_CARDS`, rúbricas, `MISSION_TEMPLATES`, `ABP_BADGE_ON_PHASE`, XP.

**Patrón de guardado de contenido de fase (importante):** casi todos los métodos
del servicio hacen **leer-modificar-reescribir** el JSON `AbpPhaseState.data`:
```ts
const ps = await prisma.abpPhaseState.findUnique({ where: { teamId_phase } });
const data = { ...(ps.data as any) };      // lee TODO el blob
data.canvas[i] = { value, ... };           // modifica una parte
await prisma.abpPhaseState.update({ where: { teamId_phase }, data: { data } }); // reescribe TODO
```

---

## 6. Estado actual del TRABAJO EN EQUIPO (lo que quieres ajustar)

**Ya implementado:**
- Armar equipos excluyendo alumnos ya asignados (roster marca `assignedTeamName`).
- Editar integrantes de equipos ya creados (añadir/sacar).

**Limitación conocida y EN CURSO de arreglo — concurrencia en las fases:**
Como cada fase guarda todo su contenido en un único JSON (`AbpPhaseState.data`)
con el patrón leer-modificar-reescribir, **dos integrantes editando a la vez la
misma fase pueden pisarse** (lost update): p. ej. en el Canvas, si Ana y Luis
guardan tarjetas distintas casi al tiempo, el segundo guardado (basado en una
lectura vieja) puede **borrar** el aporte del primero, dejando una casilla vacía
que **impide solicitar validación**. Afecta a Fase 1 sobre todo, pero el patrón
existe en las fases 2–5.

**Plan de arreglo (por capas):**
- **Capa 1 (backend, ✅ HECHA):** helper `withPhaseDataLock` en `abp.service.ts`
  que envuelve el leer-modificar-escribir en una transacción con bloqueo de fila
  (`SELECT … FOR UPDATE` sobre `AbpPhaseState`) → serializa escrituras
  concurrentes, sin pérdida de datos. Aplicado a las 10 escrituras de las fases
  1–6 (canvas, ideas, votos, smart, kanban, evidencias, coeval). Sin migración.
  Las contribuciones/XP idempotentes quedan FUERA del lock.
- **Capa 2 (frontend):** re-sincronizar el texto desde el servidor cuando la
  casilla no está enfocada + refresco periódico (~4–5s) → los integrantes ven el
  trabajo de los demás casi en vivo (hoy `CanvasPhase` carga el texto una sola
  vez y no refresca).
- **Capa 3:** "dueño de tarjeta" — al enfocar una tarjeta se reclama; los demás la
  ven de solo lectura ("✍️ Ana está completando…"), con caducidad por inactividad.

**Cosas útiles para proponer ajustes de trabajo en equipo:**
- No hay websockets: la sincronización es por **polling/refetch** (no tiempo real
  tipo Google Docs).
- El contenido colaborativo es un **JSON por fase**, no filas normalizadas.
- La autoría por tarjeta/idea se guarda dentro del JSON (`by`, `byName`).
- La visibilidad del progreso individual está en `AbpContribution` (para XP).
