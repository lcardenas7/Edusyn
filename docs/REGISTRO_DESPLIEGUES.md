# Registro de despliegues — Edusyn

> **Bitácora append-only de todo lo que se envía a `staging` y `main` (producción).**
> Fuente de verdad compartida entre sesiones y agentes: antes de desplegar, **lee la tabla**;
> después de cada `push`, **añade una fila** (más reciente arriba). Así ninguna sesión tiene
> que reinvestigar qué se subió, cuándo y si llevaba migración.

## Cómo se despliega (mecánica, no repetir por sesión)

- **Railway** (proyecto `believable-forgiveness`, un solo environment con servicios separados):
  - **Producción:** servicios `api` + `Postgres` + web → despliega de la rama **`main`**.
  - **Staging:** `edusyn-api-staging` + `edusyn-staging-db` + `edusyn-web-staging` → despliega de **`staging`**.
- **Las migraciones se aplican solas en el deploy** (`startCommand` = `prisma migrate deploy && node main.js`).
  Deploy SUCCESS = migración aplicada. Si un cambio **no** trae migración, el `migrate deploy` es no-op (sin riesgo de BD).
- **Flujo limpio recomendado** (para no arrastrar WIP ajeno ni commits que no toquen a un entorno):
  1. Aislar el cambio en **un commit** (si el árbol tiene trabajo previo sin confirmar, no mezclarlo).
  2. **Staging:** `git push origin <rama>:staging` (o rebasar el commit sobre `origin/staging` si divergió).
  3. **Producción:** `git fetch origin main`; hacer **cherry-pick** del commit sobre `origin/main`
     (idealmente en un `git worktree` aislado para no tocar el árbol con WIP), typecheck, y `git push origin <rama-temp>:main`.
- **Verificación mínima antes de un push a `main`:** `npx tsc --noEmit` en `apps/api` y `apps/web`.
- ⚠️ Nunca desplegar WIP sin confirmar de otra persona sin avisar. Producción es real y con usuarios.

## Historial (más reciente arriba)

| Fecha | Entorno | Commit | Migración | Cambio |
|-------|---------|--------|-----------|--------|
| 2026-08-29 | `staging` | `8b84d43` | No | Flujo guiado "Crear con IA" (Lección/Quiz/Tarea) en Actividades |
| 2026-08-29 | `main` (prod) | `ed0032b` | No | Importador de preguntas de quiz desde JSON de IA |
| 2026-08-29 | `staging` | `a0131a5` | No | Importador de preguntas de quiz desde JSON de IA |

---

## Notas por despliegue

### 2026-08-29 — Tipos de pregunta nuevos (Numérica, Categorizar) + mejoras Crear con IA
- **Migración:** `20260829120000_quiz_numeric_categorize` — agrega `NUMERIC` y `CATEGORIZE` al enum `QuestionType` (aditivo, `ADD VALUE IF NOT EXISTS`).
- **NUMERIC (Respuesta numérica):** número + tolerancia (`options.tolerance`); se acepta si |respuesta−esperada| ≤ tolerancia. Formulario, alumno (input numérico), calificación, resultados, importador.
- **CATEGORIZE (Categorizar):** clasificar ítems en categorías. Reutiliza la mecánica de MATCHING (options {left:ítems, right:categorías}, correctAnswer {ítem:categoría}); comparte render, shuffle, calificación y resultados. Formulario propio (categorías + ítems con su categoría) e importador.
- **Crear con IA:** (a) selector de tipos de pregunta (checkboxes: el docente marca cuáles usar; el prompt se arma solo con esos); (b) campo de **contexto** libre del docente que se inyecta en el prompt. Ambos prompts (Crear con IA y editor de Quiz) incluyen ejemplos de NUMERIC/CATEGORIZE.
- **Archivos:** `schema.prisma` + migración; `classroom.service.ts` (import + grading); `Classroom.tsx` (form/taking/results/prompt); `CrearConIAModal.tsx`.
- **Verificación:** `tsc` limpio (API+web); smoke-test de grading NUMERIC y import/grading CATEGORIZE. Click-through pendiente en staging.

### 2026-08-29 — Flujo guiado "Crear con IA" (Actividades)
- **Qué:** botón **"Crear con IA"** en la cabecera de Actividades. Modal de 4 pasos:
  elegir tipo (Lección/Quiz/Tarea) → parámetros + prompt copiable generado a medida →
  el docente usa una IA externa → pega/sube el resultado → se crea como **borrador** + resumen.
- **Reutiliza** los motores existentes (no duplica importadores): Quiz → `createActivity`+`importQuestions`;
  Lección → `createActivity`+`lessonApi.create`; Tarea → `createActivity(TASK)` con el texto como enunciado.
- **Archivos:** `apps/web/src/components/classroom/CrearConIAModal.tsx` (nuevo), `apps/web/src/pages/Classroom.tsx` (wiring).
- **Migración:** ninguna. Solo frontend.
- **Verificación:** `tsc` limpio (web); Vite compila y renderiza sin errores; click-through autenticado pendiente de prueba del docente en staging.
- **Solo en staging** hasta validación visual; producción tras confirmar.
- **Follow-up (mismo día):** parser tolerante `lib/extractJson.ts` — el pegado ahora acepta el JSON con cercas ```json```, texto alrededor o comas colgantes (antes fallaba con "no es JSON válido"). Aplicado también al importador del editor de Quiz. Los prompts ahora piden además un archivo .json descargable.
- **Fix vista de resultados (emparejar/completar/ordenar/selección múltiple):** el alumno veía el JSON crudo (`{"Perú":"Lima"}`) como "tu respuesta", y en selección múltiple salía "—". Ahora `fmtStudentAnswer`/`fmtCorrectAnswer` formatean legible (pares con →, listas con comas, orden con →). Era el "error de emparejar" reportado (display, no calificación; la calificación estaba bien). Solo frontend.
- **Fix FILL_BLANK importado:** el alumno ve los huecos partiendo el texto por `___`. `importQuestions` ahora normaliza marcadores (`_____`, `{{}}` → `___`), incrusta la respuesta si falta el marcador, y omite con motivo claro si el nº de huecos ≠ nº de respuestas. Los prompts refuerzan la convención `___`. (Los demás tipos —SHORT_ANSWER, MULTIPLE_SELECT, ORDERING, MATCHING— se auditaron y quedaron consistentes crear→responder→calificar.)

### 2026-08-29 — Importador de preguntas de quiz desde JSON de IA
- **Qué:** botón "Importar IA" en el editor de Quiz/Examen. El docente pide a una IA un JSON "limpio"
  de preguntas, lo pega/sube y se crean en lote. Backend traduce al formato interno de `ActivityQuestion`.
- **Archivos:** `classroom.controller.ts` (endpoint `POST /classrooms/activities/:id/questions/import`),
  `classroom.service.ts` (`importQuestions`), `apps/web/src/lib/api.ts`, `apps/web/src/pages/Classroom.tsx`.
- **Migración:** ninguna (usa la tabla `ActivityQuestion` existente).
- **Soporta:** los 7 tipos (MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, SHORT_ANSWER, FILL_BLANK, ORDERING, MATCHING),
  con normalización tolerante (sinónimos en español, respuesta como texto/letra/índice) y creación atómica.
- **Verificación:** `tsc` limpio en API y web; smoke-test de la normalización; formato idéntico al alta manual (mismo calificador).
- **Pendiente relacionado:** rediseño del flujo guiado "Crear con IA" (Lección/Quiz/Tarea) — ver diagnóstico de UX; unificar importadores.
- **Nota:** en `staging` este commit quedó como `a0131a5`; sobre él se empujó luego trabajo de firma/asistencia.
