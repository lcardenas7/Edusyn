# AUDITORÍA DE LA CONFIGURACIÓN INSTITUCIONAL (SIEE)

> **Motivo:** el flujo de configuración institucional no se entiende (lo notó el usuario). Auditoría contundente + guía para el admin.
> **Método:** anclado en código real (backend `institution-config.service.ts`, tabla `PerformanceScale`; frontend `AcademicHub.tsx`, `config/Levels.tsx`, `config/Scale.tsx`, `AcademicLevelsAdmin.tsx`, `lib/api.ts`).
> **Fecha:** 2026-07-02.
> **Veredicto:** 🔴 **La configuración está fragmentada en varios almacenes que no se sincronizan. Hay un almacén clave (`PerformanceScale`) que el runtime LEE pero que ninguna pantalla del admin ESCRIBE.** Esto explica la confusión y afecta a Q-1.

---

# PARTE A — AUDITORÍA (qué está mal)

## A.1 Dónde vive HOY la configuración (mapa real)

La config institucional está repartida en **4 almacenes distintos**:

| Almacén | Tipo | Qué guarda | Quién lo ESCRIBE (admin) | Quién lo LEE (runtime) |
|---|---|---|---|---|
| `Institution.academicLevelsConfig` | **JSON** en la fila | Niveles educativos; por nivel: escala numérica (min/max), `minPassingGrade`, **`performanceLevels[]`** y **`qualitativeLevels[]`** | Pantalla **"Niveles Académicos"** (`config/Levels.tsx`, `AcademicLevelsAdmin.tsx`) | `institution-context.service` → `rulesCtx.performanceLevels`/`qualitativeLevels` |
| `Institution.gradingConfig` | **JSON** en la fila | Procesos evaluativos (COG/PROC/ACT), pesos, subprocesos, `useFinalComponents`, `minPassingGrade`, **`performanceLevels[]`** | Pantalla **"Sistema de Calificación"** (`config/Scale.tsx`) | Plantillas de evaluación / pesos |
| `Institution.periodsConfig` | **JSON** en la fila | Períodos + pesos + fechas | Pantalla **"Períodos"** (`config/Periods.tsx`) | Se sincroniza a `AcademicTerm` |
| **`PerformanceScale`** | **TABLA** | Nivel (SUPERIOR/ALTO/BASICO/BAJO) → rango `minScore`/`maxScore` (+ Q-1: label/descriptor/order/isApproved) | **⚠️ NINGUNA pantalla actual** | **Boletines** (`buildGroupReportCards`), **desempeños** (`performance-generator`), **promoción** (`getPassingGrade`), **dashboard** |

Además, columnas sueltas en `Institution` para **áreas** (`areaCalculationType`, `areaApprovalRule`, `areaRecoveryRule`, `areaFailIfAnyFails`) y otra tabla `RecoveryConfig` con su propio `minPassingScore`.

## A.2 Hallazgo crítico — la tabla que el runtime lee pero el admin no escribe

**`PerformanceScale` (la tabla) es la fuente que usan los boletines, los desempeños y la promoción para clasificar una nota en un nivel** (`reports.service:2450`, `performance-generator:43`, `academic-year-lifecycle.getPassingGrade:945`).

Pero:
- **Ninguna pantalla del admin la escribe** — `performanceScaleApi` existe en `lib/api.ts` pero **no lo llama ningún componente**.
- **Ningún seed la puebla** al crear la institución.
- Solo se puede escribir por `POST /performance-scale`, endpoint que el frontend no usa.

**Consecuencia:** el admin configura los niveles/escala en **"Niveles Académicos"** (JSON `academicLevelsConfig`), pero eso **no sincroniza** con la tabla `PerformanceScale` que realmente consumen los boletines. Son **dos sistemas paralelos y desconectados**. Según cómo esté poblada (o vacía) la tabla, los boletines pueden:
- clasificar con una escala **distinta** a la que el admin ve, o
- fallar ("Performance scale not configured") / no mostrar nivel de desempeño.

## A.3 Fragmentación de "los niveles de desempeño" (3 lugares)
El mismo concepto vive en:
1. `academicLevelsConfig[].performanceLevels` (JSON, admin lo edita).
2. `gradingConfig.performanceLevels` (JSON, otra pantalla).
3. `PerformanceScale` (tabla, la que leen los boletines).

Y `minPassingGrade` (nota mínima aprobatoria) vive en **3 sitios**: `gradingConfig.minPassingGrade`, `academicLevelsConfig[].minPassingGrade`, y `RecoveryConfig.minPassingScore`. **No hay una única verdad.**

## A.4 Problemas de nombres / UX que confunden al admin
- La pantalla **"Sistema de Calificación"** (ruta `/config/scale`, archivo `Scale.tsx`) **no configura la escala de niveles** — configura **procesos y pesos** (COG/PROC/ACT). El nombre del archivo (`Scale`) contradice lo que hace.
- La escala de niveles (SUPERIOR/ALTO/BASICO/BAJO con rangos) se edita dentro de **"Niveles Académicos"**, no en "Sistema de Calificación". Nada en la UI deja claro **cuál pantalla afecta al boletín**.
- Hay dos pantallas que editan lo mismo (`Levels.tsx` y `AcademicLevelsAdmin.tsx` — ambas escriben `academicLevels`).

## A.5 Impacto sobre Q-1 (honestidad)
El Q-1 que implementé añadió `descriptor` (y label/order/isApproved) a **la tabla `PerformanceScale`**. Como ninguna pantalla del admin escribe esa tabla, **el descriptor de Q-1 hoy no es alcanzable desde la UI del admin**. Q-1 no está "mal" (la tabla ES la que leen los boletines), pero **queda incompleto sin resolver primero esta desconexión**: o se sincroniza `academicLevelsConfig` → `PerformanceScale`, o se le da al admin una pantalla que escriba la tabla. Por eso mi indicación anterior ("guarda un descriptor en la escala") no tenía un lugar claro donde hacerse. **Tenías razón en no entenderlo.**

## A.6 Riesgos
| Riesgo | Severidad |
|---|---|
| El admin cambia niveles y **no se refleja en boletines** (desconexión JSON ↔ tabla) | 🔴 Alto |
| `PerformanceScale` vacía → boletines sin nivel / desempeños en error | 🔴 Alto |
| `minPassingGrade` en 3 sitios → aprobado/reprobado inconsistente según el módulo | 🟠 Medio |
| Nombres engañosos → el admin edita donde no es | 🟠 Medio (adopción) |
| Q-1 (descriptor) inalcanzable desde la UI | 🟠 Medio |

---

# PARTE B — GUÍA PARA EL ADMIN (cómo configurar HOY, con la realidad actual)

> Entrada: **Gestión Académica** (`/academic`) → bloque **"Configuración Académica (SIEE)"**.

## Orden correcto y qué hace cada pantalla

**1. Niveles Académicos** (`Niveles Académicos`) — *aquí va la escala de valoración*
- Define los **niveles educativos** (Preescolar, Primaria, Bachillerato…).
- Por cada nivel eliges el **tipo de escala**: numérica (`min`–`max`, ej. 1.0–5.0) o cualitativa (preescolar).
- Aquí defines los **niveles de desempeño** (Superior/Alto/Básico/Bajo) con sus **rangos** y la **nota mínima aprobatoria**.
- ⚠️ **Hoy esto guarda un JSON que NO alimenta directamente el boletín** (ver A.2). Es la parte a arreglar.

**2. Sistema de Calificación** (mal llamado "escala") — *procesos y pesos, NO la escala de niveles*
- Define los **procesos evaluativos**: Cognitivo, Procedimental, Actitudinal (los "saberes"), con sus **pesos %** y subprocesos.
- Aquí decides cuánto pesa cada saber en la nota del período (ej. Cog 40% / Proc 40% / Act 20%).
- La suma de pesos debe dar **100%**.

**3. Períodos Académicos**
- Define cuántos **períodos** hay (ej. 4), su **peso** y sus **fechas**. Se sincroniza con el año lectivo.

**4. Ventanas de Calificación / Recuperación**
- Fechas en las que docentes pueden **digitar notas** y hacer **recuperaciones**.

## Regla mental para el admin
> **"Niveles Académicos" = la escala (qué nota es Superior/Alto/Básico/Bajo y qué aprueba).**
> **"Sistema de Calificación" = los pesos (cuánto vale cada saber).**
> **"Períodos" = cuántos cortes y cuándo.**

## Caveat honesto (mientras no se arregle A.2)
Si tras configurar los niveles el **boletín no muestra el nivel de desempeño** o lo muestra con rangos distintos, es por la desconexión `academicLevelsConfig` ↔ `PerformanceScale`. La solución no es del admin: es la **consolidación** que se propone abajo.

---

# PARTE C — RECOMENDACIÓN (mejora)

**Objetivo:** una sola verdad para la escala/niveles, alcanzable por el admin y consumida por todos.

**Propuesta "Config Consolidation" (sub-bloque, antes de seguir con Q-2):**
1. **Fuente única de niveles:** que `PerformanceScale` (tabla) sea la verdad, y que **"Niveles Académicos" escriba en ella** (sincronizar `academicLevelsConfig.performanceLevels` → `PerformanceScale`, o migrar la edición a la tabla). Así Q-1 (descriptor) queda alcanzable.
2. **Sincronización garantizada:** al guardar niveles, poblar/actualizar `PerformanceScale` en la misma operación (transaccional). Backfill para las 5 instituciones actuales.
3. **`minPassingGrade` único:** derivarlo de `PerformanceScale.isApproved` (Q-1 ya lo soporta) y deprecar las copias en `gradingConfig`/`RecoveryConfig` (leer de una sola).
4. **Nombres claros en UI:** renombrar "Sistema de Calificación" → "Procesos y Pesos"; dejar explícito en "Niveles Académicos" que ahí se define la escala del boletín. Unificar `Levels.tsx` y `AcademicLevelsAdmin.tsx` (hoy duplican).
5. **Seed al crear institución:** sembrar una `PerformanceScale` por defecto (0–5 colombiano) para que ninguna institución nazca sin escala.
6. **Panel de verificación:** en la config, un indicador "✅ escala configurada y conectada al boletín" (parte del panel de salud de la Fase 2).

**Riesgo:** medio (toca datos de las 5 instituciones). Requiere backfill cuidadoso + verificación previa, como se hizo con los bloques anteriores.

---

## RESUMEN
La configuración institucional **funciona por pantallas pero no como sistema**: cuatro almacenes, tres representaciones de "niveles", tres de "nota mínima", y una tabla (`PerformanceScale`) que el runtime lee pero **ningún admin escribe**. El admin no puede predecir qué pantalla afecta al boletín. **La prioridad no es Q-2 sino consolidar la configuración de escala/niveles en una sola verdad conectada al boletín** — y eso además completa Q-1. La Parte B da la guía para operar mientras tanto.
