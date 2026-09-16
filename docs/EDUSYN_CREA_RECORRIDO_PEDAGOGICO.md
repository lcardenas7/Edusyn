# Edusyn Crea — Recorrido pedagógico (diseño e implementación)

> Estado: implementado y verificado en la rama aislada `deploy/crea-staging` (commit local).
> Sin push ni despliegue hasta autorización explícita. Fecha: 2026-09-16.
> Detalle de la verificación y pendientes: `docs/REGISTRO_DESPLIEGUES.md`.

## 1. Diagnóstico del flujo actual (revisado sobre el código, no sobre documentos)

| Pieza | Qué hace hoy | Problema pedagógico |
|---|---|---|
| `BriefBuilder` | Un formulario de 6 campos (problema, para quién, asignatura, grado, funciones, estilo) y, **al lado y desde el primer segundo**, el prompt listo para copiar. | El prompt es el centro visual. Un equipo puede copiarlo con el formulario vacío (sale `[explicar el problema]`). No distingue problema / solución / alcance; "funciones" invita a una lista de deseos, no a una primera versión pequeña. No hay preguntas orientadoras ni ejemplos. |
| `TeamWorkspace` | Encabezado con "1. Imaginen · 2. Construyan · 3. Dejen evidencia" (decorativo), luego BriefBuilder y CodeWorkspace apilados. | Las etapas no tienen estado: no se ve el progreso ni qué falta. |
| `CodeWorkspace` | Editor + preview + Explorar + guardar versión con una frase. | Para pedir un cambio a la IA no hay ayuda: el equipo vuelve a pedir "hazme…" sin decir qué conservar ni cómo comprobarlo. La evidencia es una sola frase. |
| Backend `construye` | Brief JSONB con esquema cerrado (6 campos); versiones inmutables numeradas; bitácora con enum de tipos; el docente puede leer el detalle de un equipo y comentar. | No existe ninguna condición antes de la primera versión. La evidencia de versión no tiene estructura. |
| Docente (`ConstruyeTab`) | Tarjeta por equipo: integrantes, primer campo del problema, última versión, 3 hitos, comentario. | Ve la entrega, no el razonamiento: no ve solución, alcance, cómo pensaban comprobarla ni qué aprendieron en cada versión. |

Datos existentes que hay que respetar: equipos con `brief` de 6 campos, equipos con versiones y sin brief, equipos sin nada.

## 2. Experiencia propuesta

Un recorrido de **4 fases** visible arriba del taller, con estado (pendiente · en curso · lista). Una fase abierta a la vez, 2–3 preguntas por fase, un ejemplo desplegable que **no es de su proyecto** (para inspirar, no para copiar), y "Guardar y seguir". Siempre se puede volver a una fase y mejorarla.

**Fase 1 — El problema** · "¿Qué está pasando?"
- *¿Qué ocurre?* — "Cuéntenlo como se lo contarían a un compañero nuevo."
- *¿A quién afecta?* — "Piensen en personas concretas: ¿quiénes lo viven?"
- *¿Por qué vale la pena resolverlo?* — "¿Qué mejoraría si deja de pasar?"
- Ejemplo (tienda escolar): "En el descanso la fila de la tienda es tan larga que muchos se quedan sin comprar…"

**Fase 2 — La solución que imaginamos** · "¿Qué vamos a crear?"
- *¿Qué hará su página o app y cómo ayuda?*
- *¿Quién la usará?*
- *¿Cómo se vería?* — "Describan pantallas y acciones con sus palabras: 'una pantalla con la lista de…', 'un botón para…'."
- (Asignatura, grado y estilo quedan como datos secundarios.)

**Fase 3 — Plan de la versión 1** · "Empecemos pequeño"
- *¿Qué tendrá la versión 1?* — "Lo mínimo para que alguien la use hoy."
- *¿Qué dejamos para después?*
- *¿Cómo sabremos que funciona?* — "Una prueba concreta: 'si escribo una tarea y pulso Agregar, aparece en la lista'."
- Al completarla aparece **"Nuestra petición para la IA"**: el prompt armado con sus decisiones, **editable**, con el recordatorio "La IA propone; ustedes deciden" y "No incluyan nombres ni datos personales". Antes de eso se muestra "La petición aparece cuando tengan su plan".

**Fase 4 — Construir, comprender y mejorar** · el taller actual, más:
- **"Pedir un cambio a la IA"**: *¿Qué quieren cambiar o agregar? · ¿Por qué? · ¿Qué debe seguir igual? · ¿Cómo sabrán que salió bien?* → petición concreta con su código actual (opcional).
- **Guardar versión = evidencia**: *Qué intentamos* (obligatorio) · *Qué probamos y qué pasó* (obligatorio) · *Qué aprendimos o mejoraríamos* (opcional). Lo que cambió se calcula solo (archivos).

**Condición mínima antes de la primera versión**: haber escrito *qué ocurre* (fase 1), *qué tendrá la v1* y *cómo sabremos que funciona* (fase 3). Mensaje: "Para guardar la primera versión, cuéntennos el problema, qué tendrá la versión 1 y cómo sabrán que funciona." El editor y el preview **no se bloquean** nunca.
- Equipos que ya tienen versiones: sin condición.
- Excepción docente: "Permitir guardar sin completar el plan" (queda registrada en la bitácora).

**Docente**: en cada tarjeta, avance de las 4 fases y **"Ver razonamiento"**: problema, solución, plan de la v1, peticiones de cambio y evidencias de cada versión, en orden. Botón de excepción si el equipo aún no puede guardar su primera versión.

## 3. Cambios estrictamente necesarios

**Datos (sin migración).**
- `ConstruyeTeam.brief` (JSONB) amplía su esquema cerrado con campos opcionales: `affected`, `whyItMatters`, `solution`, `screens`, `later`, `successCheck`. Los 6 existentes se conservan con el mismo nombre (`problem` = qué ocurre, `features` = qué tendrá la v1).
- Evidencia de versión: en `detail.evidence` de la entrada `VERSION_CREATED` que ya se crea en la misma transacción; `ConstruyeVersion.label` = "qué intentamos".
- Excepción docente: entrada `TEACHER_COMMENT` con `detail.kind = 'BUILD_UNLOCKED'`, creada solo por un endpoint de docente (los estudiantes no pueden crear `TEACHER_COMMENT`).
- No se agregan valores al enum de la bitácora (evita `ALTER TYPE`).

**API.**
- `validateTeamBrief`: nuevos campos opcionales con límites.
- `buildGate(brief, versionCount, unlocked)` (función pura) → `{ canSaveFirstVersion, missing[] }`; `createVersion` la aplica solo si no hay versiones.
- `createVersion` acepta `evidence: { attempted, tested, learned? }` (obligatorio `attempted` y `tested` desde el cliente nuevo; si falta, se acepta con `label` para no romper clientes viejos).
- `POST /construye/teams/:teamId/build-unlock` (DOCENTE/COORDINADOR, dueño del aula).
- `teamDetail` y `dashboard` devuelven `buildGate`.

**Interfaz.**
- `BriefBuilder` → recorrido de 3 fases con prompt al final (misma exportación; la maqueta local sigue funcionando).
- `TeamWorkspace` → barra de progreso de 4 fases real.
- `CodeWorkspace` → "Pedir un cambio a la IA", evidencia estructurada, aviso de condición; botón "Ver en grande" junto a Computador/Celular.
- `ConstruyeTab` → avance por fases, "Ver razonamiento", excepción docente.

**Privacidad.** El prompt solo contiene lo que el equipo escribió en el recorrido (y, en peticiones de cambio, su código si lo eligen). Nunca nombres de integrantes, institución, notas ni identificadores. El código sigue ejecutándose solo en el preview aislado.

## 4. Criterios de aceptación

1. Un equipo nuevo ve primero "El problema"; el prompt no aparece hasta completar el plan de la v1.
2. Cada fase tiene como máximo 3 preguntas, un ejemplo desplegable y un botón para guardar; se puede volver a cualquier fase.
3. El prompt es editable antes de copiarlo y no contiene datos personales ni institucionales.
4. Sin condición cumplida y sin excepción, la API rechaza la primera versión con un mensaje claro; la interfaz lo explica antes de intentar.
5. Equipos con versiones previas guardan sin condición; briefs antiguos cargan sin errores.
6. El docente ve avance por fases, razonamiento y evidencias; puede habilitar la excepción y queda en la bitácora.
7. Guardar versión registra qué intentaron, qué probaron y (opcional) qué aprendieron; el docente lo ve.
8. Todo con permisos existentes (miembro del equipo / dueño del aula) e `institutionId`.
9. `tsc` limpio en api y web; pruebas nuevas en api y web; recorrido visual con datos de prueba locales.

## 5. Plan por pasos

1. API: esquema del brief, `buildGate`, evidencia, endpoint de excepción, `buildGate` en respuestas + pruebas.
2. Web: `journey.ts` (estado de fases, armado de prompts) + pruebas.
3. Web: recorrido en `BriefBuilder` y progreso en `TeamWorkspace`.
4. Web: evidencia estructurada, "Pedir un cambio a la IA" y botón "Ver en grande" en `CodeWorkspace`.
5. Web: docente (fases, razonamiento, excepción).
6. Verificación: pruebas, typecheck y recorrido visual con datos de prueba (harness local, sin tocar bases compartidas).
7. Bitácora: registrar lo hecho y lo pendiente. **Sin push** hasta autorización.
