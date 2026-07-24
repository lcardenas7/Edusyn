# Configuración Institucional + SIEE — Verdades del modelo y rediseño (pantallas + cableado)

> Base para el rediseño de la experiencia de configuración. Corrige los supuestos del brief de UX contra el código real, decide **fuente única de verdad** por concepto, y da una solución que arregla **la pantalla y el cableado juntos** — no fachada.
> Fecha: 2026-07-22 · Rama: staging

---

## Regla de oro

Antes de dibujar una sola pantalla nueva: **cada cosa que el rector configura debe tener UNA fuente de verdad, y esa fuente debe ser la que realmente calcula boletines y promoción.** Hoy no se cumple en dos lugares. Se corrige aquí.

---

# Los 3 supuestos del brief — realidad, ¿es problema real?, solución

## Supuesto #1 — "Los grados se derivan automáticamente del nivel educativo"

**Realidad en el código.**
- Los grados viven en la tabla **`Grade`** (institución + `stage` + `number` + `name`). Es la fuente que usan matrícula, promoción y notas.
- Los niveles viven en un JSON **`academicLevelsConfig`**, y cada nivel tiene una lista `grades: string[]` **tecleada a mano**, redundante y casi siempre vacía → "Sin grados asignados".
- Lo que implementamos (commit `c67ca24`) es **auto-derivar solo la VISUALIZACIÓN**: la pantalla lee `Grade` por `stage`. Los grados **se siguen creando a mano**.

**¿Es problema real?** Sí, pero de gravedad **media**: no es un bug de cálculo, es UX confusa + datos frágiles (vimos `Grade.number` en NULL, nombres duplicados, el índice único global obsoleto). La lista `grades[]` del JSON es **deuda** (segunda representación desincronizada).

**Solución adecuada (pantalla + cableado):**
1. **Fuente única = tabla `Grade`.** Se deja de usar `academicLevelsConfig[].grades[]` (se ignora y luego se elimina del payload). El nivel guarda solo su `stage` + atributos de escala.
2. **Plantillas de grados por nivel:** al activar un nivel (p. ej. Primaria) se ofrece "Generar grados estándar" → crea `1°…5°` en la tabla `Grade` con `number` pre-cargado. Esto cumple el deseo de "no volver al sistema manual" **sin** un auto-derive falso, y de paso elimina el problema de `number` NULL.
3. La visualización por `stage` (ya hecha) queda como el camino permanente de lectura.

---

## Supuesto #2 — "Procesos / Componentes / Subcomponentes / Pesos" es una config coherente

**Realidad en el código — hay TRES representaciones del mismo concepto:**

| Representación | Qué es | ¿Calcula la nota? |
|---|---|---|
| **`EvaluationComponent`** (tabla, `@@unique([institutionId, code])`, **jerárquica vía `parentId`**) | La estructura real: procesos = padres, subprocesos = hijos | Indirectamente (es la referencia de `componentType`) |
| **`EvaluationPlanComponentWeight`** (por `teacherAssignment`+período, con `percentage`) | Los **pesos que SÍ promedian el boletín** | **Sí** (lo lee `partial-grades.service`) |
| **`gradingConfig.evaluationProcesses`** (JSON que escribe la pantalla "Procesos y Pesos") | Tercera copia | **No** — el motor la ignora; solo la lee el aula para *mostrar* estructura (`classroom.service.ts:2661`) |

Y `AcademicRulesEngine` (que modela procesos/pesos limpiamente) es **código muerto**.

**¿Es problema real?** Sí, gravedad **alta**. El rector define pesos en la pantalla SIEE que **no son los que calculan la nota** (esos los pone cada plan de evaluación por asignatura, en otro lado). Es un problema de **confianza y de corrección**: lo que se configura no surte efecto.

**Solución adecuada (pantalla + cableado) — apalancar el modelo bueno que YA existe:**
1. **Fuente única de ESTRUCTURA = `EvaluationComponent`.** Ya es jerárquica (`parentId`): procesos = componentes raíz, subprocesos = hijos. La pantalla SIEE lee/escribe **esta tabla**, no el JSON.
2. **Añadir a `EvaluationComponent`:** `weightPercentage Int?` (peso **default institucional**) y `order Int?`. Así el peso vive junto a la definición.
3. **Herencia:** cuando se crea/abre un `EvaluationPlan` de una asignación, **sembrar** sus `EvaluationPlanComponentWeight` desde los defaults institucionales. El docente solo puede desviarse si la institución lo permite (flag `allowTeacherOverrideWeights`).
4. **Resultado:** el peso que el rector pone en SIEE **sí** calcula el boletín (vía el plan sembrado). Se **elimina** `gradingConfig.evaluationProcesses` (redundante) y se apunta el aula a `EvaluationComponent`.

---

## Supuesto #3 (premisa metodológica) — "conservar el backend, rediseñar solo el frontend"

**Realidad.** Para esta zona la premisa está mal: el backend de configuración **es parte del problema** (dos fuentes de verdad duplicadas y desconectadas, motor muerto, config en blobs JSON). Una experiencia guiada y confiable no se puede montar encima de eso.

**¿Es problema real?** Sí — es la conclusión que ata las otras dos.

**Solución.** Hacer las dos capas **juntas**. Cada fix de arriba toca modelo **y** pantalla. El orden es: primero fijar la fuente de verdad (Fases 1–2), luego construir la UX guiada encima (Fase 3).

---

# Fuentes únicas de verdad (decisión)

| Concepto | Fuente ÚNICA | Se elimina / deja de usarse |
|---|---|---|
| Grados | tabla **`Grade`** (por `stage`) | `academicLevelsConfig[].grades[]` |
| Estructura de evaluación (procesos/subprocesos) | **`EvaluationComponent`** (`parentId`) | `gradingConfig.evaluationProcesses` |
| Peso de evaluación | `EvaluationComponent.weightPercentage` (**default**) → `EvaluationPlanComponentWeight` (**efectivo**, heredado) | — |
| Escala de valoración | **`PerformanceScale`** (derivada de la config; ya es el camino de lectura) | — |
| Niveles educativos | `stage` + atributos de escala del nivel | — |
| Períodos y sus pesos | **`AcademicTerm`** (`weightPercentage`) | — |

---

# Mapeo pantallas ↔ modelo (IA corregida)

**Configuración Institucional** (identidad + estructura — *qué es y cómo se organiza*)
- Perfil (nombre, NIT, DANE, ciudad, logo, rector*)
- Sedes (`Campus`) · Jornadas (`Shift`)
- Niveles educativos → **con "Generar grados" (plantillas)**
- Grados (`Grade`) · Grupos (`Group`)
- Usuarios (`InstitutionUser`)

**Configuración SIEE** (evaluación — *cómo se evalúa y se promueve*)
- Escala de valoración (`PerformanceScale`)
- Períodos y pesos (`AcademicTerm`)
- **Componentes de evaluación (procesos/subprocesos + pesos default)** → `EvaluationComponent`
- Reglas de área / promoción · Ventanas de calificación · Recuperaciones · Cierre de año

> *`rector` hoy es texto libre en el perfil Y existe rol/flag `isAdmin` ("admin/rector"). Conviene que el rector sea un **usuario con rol**, referenciado, no un string suelto. (Menor, pero es data-model smell.)

---

# Plan por fases (pantalla + cableado en cada una)

| Fase | Alcance | Riesgo | Valor |
|---|---|---|---|
| **0** | Este documento — verdades del modelo | — | Desbloquea todo |
| **1 · Grados** | Plantillas de grados por nivel; `Grade` como fuente única; dejar de escribir `grades[]` del JSON | Bajo | Quita "Sin grados asignados", fija `number`, cumple "no manual" |
| **2 · Evaluación** | `EvaluationComponent` como fuente SIEE (+`weightPercentage`/`order`); herencia a `EvaluationPlan`; retirar `evaluationProcesses` JSON; apuntar el aula a la tabla | Medio-alto (migración) | El rector configura pesos que **sí** calculan |
| **3 · UX** | Wizard de onboarding + dashboard de completitud + pantallas nuevas sobre el modelo limpio | Medio | La experiencia "clase mundial" que pide el brief, ya sin fachada |

---

# Riesgos y cómo mitigarlos

1. **Migración de datos existentes.** Instituciones con `gradingConfig.evaluationProcesses` ya configurado → migrar a `EvaluationComponent` (script de una vez). Instituciones con `EvaluationPlan` con pesos ya puestos → **respetarlos** (la herencia solo siembra planes nuevos/vacíos, no pisa los existentes).
2. **El aula lee el JSON hoy** (`classroom.service.ts:2661`). Al retirar `evaluationProcesses`, hay que repuntar esa lectura a `EvaluationComponent` en el mismo cambio (si no, la planilla se queda sin estructura).
3. **No romper boletines en curso.** Fase 2 se despliega y valida en staging (con la prueba de cierre) antes de prod.
4. **`AcademicRulesEngine` muerto.** Decidir: resucitarlo como motor único (ata con RE-1 de la auditoría Pase 2) o borrarlo. No dejarlo como tercera fuente latente.

---

# Qué NO cambia (para no sobre-diseñar)
- La tabla `Grade`, `EvaluationComponent`, `EvaluationPlanComponentWeight`, `PerformanceScale`, `AcademicTerm` **ya son buenos modelos**. No se reemplazan — se **conectan** y se les quita la representación duplicada de encima.
- El cálculo de nota (`partial-grades.service`) no cambia su fórmula; solo pasa a recibir pesos que **de verdad** vienen de la config institucional (vía herencia).

---

*Con estas fuentes de verdad acordadas, el rediseño UX del brief (wizard, dashboard, wireframes, nomenclatura) se puede ejecutar bien: las pantallas configuran cosas que sí surten efecto. Siguiente entregable natural: la auditoría UX pura + wireframes del wizard/dashboard, ya sobre este modelo.*
