# Auditoría Adversarial — Pase 2 (vertical): Motor Académico + Cambio de Configuración a mitad de año

> Continuación de `PASE1` y `PASE1B`. Método: auditoría de código real con evidencia `archivo:línea`.
> **Fecha:** 2026-07-21 · **Rama:** `staging`
> **Alcance:** el corazón del producto — el/los motor(es) de cálculo académico y qué pasa cuando una institución **cambia la configuración cuando ya lleva 1-2 períodos** ("pendiente número uno" del rector).

---

## Resumen ejecutivo

Dos hallazgos estructurales dominan este pase:

1. **El "motor de reglas único" es código muerto.** `AcademicRulesEngine` se documenta como *"la FUENTE DE VERDAD para todos los cálculos académicos"* (`AcademicRulesEngine.ts:5`), pero **nadie lo instancia**: solo se re-exporta. Los cálculos reales viven dispersos en **tres** servicios con lógica divergente. La promoción "buena" (por áreas, conforme a Decreto 1290) también está en ese motor muerto (`determinePromotion`) y **no se usa** — la promoción real usa `promotion.engine.ts` (por promedio + nº de asignaturas).

2. **Cambiar la configuración a mitad de año reescribe el pasado.** Escala, ponderaciones de período y número de períodos se guardan como JSON y se **re-proyectan en caliente** sobre las tablas que leen boletines/promoción (`PerformanceScale`, `AcademicTerm`), **sin snapshot por período, sin validación bloqueante, sin auditoría y sin bloquear años cerrados**. Un cambio de escala o de peso en el período 3 **reclasifica y recalcula retroactivamente** las notas de los períodos 1 y 2.

Además, este pase **corrige al alza un hallazgo del Pase 1** (M-3): la validación de rangos de escala **no bloquea** — es solo `console.warn`.

**Conteo:** 2 críticos · 5 altos · 3 medios · 1 corrección de severidad.

---

# 🔴 Errores críticos

### RE-1 · El "motor de reglas único" (`AcademicRulesEngine`) es código muerto; el cálculo real está triplicado y divergente

**Descripción.** `AcademicRulesEngine.ts` se presenta como la fuente de verdad, pero:

```
grep AcademicRulesEngine|createAcademicEngine → solo aparece en engines/index.ts (re-export)
grep determinePromotion → solo su propia definición
```

Nadie lo construye ni lo llama. Mientras tanto, la nota final ponderada está implementada **tres veces**, con diferencias:

| Implementación real | Fórmula | Redondeo | Renormaliza si falta componente |
|---|---|---|---|
| `student-grades.service.calculateTermGrade` (`:136-218`) | ponderada por componente | por componente + final | sí |
| `partial-grades.service.recomputePeriodFinalGrade` (`:333-483`) | ponderada por componentType | final | sí |
| `grades-bulk-import.service.recomputePeriodFinalGrade` (`:1076-1115`) | **promedio simple (ignora pesos)** | final | n/a |
| `AcademicRulesEngine.calculatePeriodGrade` (`:282-288`) | ponderada por proceso | final | **no** (DEAD) |

Y la **promoción** tiene dos motores con reglas distintas:
- **Vivo:** `promotion.engine.ts` → bloquea por `finalAverage < minPassingGrade` y por `failedSubjectsCount` (**asignaturas**).
- **Muerto:** `AcademicRulesEngine.determinePromotion` (`:637-678`) → decide por **áreas reprobadas** (≤2 → PENDING, >2 → NOT_PROMOTED), que es el criterio típico del Decreto 1290 que el rector espera.

**Impacto.** No hay una sola verdad: dos rutas de cálculo pueden dar notas finales distintas para los mismos datos (ya documentado en BI-2), y la promoción usa el criterio *menos* alineado con la norma colombiana mientras el criterio correcto duerme como código muerto. Mantenibilidad y confianza en riesgo: cualquier corrección hay que hacerla en 3 sitios.

**Riesgo.** Prob. alta (ya diverge hoy) · Impacto crítico (integridad de notas y promoción). **Prioridad P0/P1** (es la refactorización #1 recomendada en Pase 1).

**Solución.** Elegir UNA implementación como fuente de verdad (idealmente resucitar y completar `AcademicRulesEngine`, o consolidar en un servicio puro nuevo) y hacer que `student-grades`, `partial-grades`, `grades-bulk-import` y la promoción la consuman. Borrar las demás. Cubrir con tests de tabla (fronteras, componentes faltantes, áreas vs asignaturas).

---

### RE-2 · Cambiar la escala/ponderaciones a mitad de año reescribe retroactivamente notas ya calculadas (sin snapshot, sin bloqueo)

**Descripción.** Las tablas que leen boletines y promoción se **re-proyectan en caliente** al guardar config, sin versionar por período ni proteger datos existentes:

- **Escala:** `updateGradingConfig`/`updateAcademicLevels` llaman `syncScaleFromConfig` (`:265,298,308-354`), que hace `upsert` sobre `PerformanceScale`. Como `getPerformanceLevel` y los boletines clasifican **en tiempo de lectura** contra esa tabla, cambiar la escala en el período 3 **cambia el nivel de desempeño y el aprobado/reprobado** de las notas de los períodos 1 y 2. Un 3.0 "BÁSICO/aprobado" pasa a "BAJO/reprobado" si el admin sube el mínimo — retroactivamente.
- **Ponderaciones de período:** `updatePeriods` → `syncPeriodsToAcademicTerms` (`:372-387,390+`) escribe `AcademicTerm.weightPercentage` **in place**. `calculateAnnualGrade` lee ese peso vivo → cambiar pesos en el período 3 recalcula el anual de todo el año.
- **Sin guarda:** los `update*` solo verifican que la institución existe. **No bloquean** si ya hay notas, si el año está `ACTIVE` o incluso `CLOSED`, ni si ya se emitieron boletines.

**Cómo reproducirlo.** Institución con 2 períodos ya calificados. Rectoría cambia el mínimo aprobatorio de 3.0 a 3.5 (o los pesos 40/30/30 → 25/25/25/25). Sin tocar una sola nota, los boletines y la promoción de los períodos previos cambian de resultado.

**Impacto.** Estudiantes que estaban aprobados aparecen reprobados (y viceversa) por un cambio de configuración, no de desempeño. En un año cerrado, altera el histórico. Es la respuesta directa al "pendiente número uno": **el sistema no aísla la configuración vigente al momento de calificar**.

**Riesgo.** Prob. media-alta (los colegios ajustan reglas a mitad de año) · Impacto crítico. **Prioridad P1.**

**Solución.** Versionar la configuración académica **por año/período** (snapshot inmutable al iniciar cada período) y calcular cada período con la config vigente en su momento. Bloquear (o exigir confirmación fuerte + recálculo explícito auditado) los cambios de escala/pesos cuando ya existan notas o el año esté cerrado.

---

# 🟠 Riesgos altos

### RE-3 · Reducir el número de períodos deja `AcademicTerm` huérfanos que siguen pesando en el anual

**Descripción.** `syncPeriodsToAcademicTerms` (`:390+`) crea/actualiza un `AcademicTerm` por cada período del nuevo config (match por `order` o `name`), pero **nunca elimina** los términos que ya no existen. Pasar de 4 a 3 períodos deja el 4º término vivo, con sus notas y su `weightPercentage`, y `calculateAnnualGrade` lo sigue sumando. El match por `order === order || name === name` (`:418`) además puede **emparejar mal** si cambian los nombres.
**Impacto.** Anual calculado sobre un período fantasma; pesos que ya no suman lo esperado; datos zombis.
**Riesgo.** Prob. media · Impacto alto. **Prioridad P1.**
**Solución.** Reconciliar términos: desactivar/eliminar (con guarda si tienen notas) los que ya no están en el config, y emparejar por un id estable, no por nombre/orden.

### RE-4 · [CORRECCIÓN Pase 1 · sube severidad] La validación de rangos de escala NO bloquea — es solo `console.warn`

**Descripción.** En el Pase 1 (M-3) dije que `validateScaleRanges` se aplicaba en el write path. **Corrección:** se llama, pero **no bloquea** — solo registra un aviso en consola:

```ts
// institution-config.service.ts:319-322
const issues = validateScaleRanges(rows)
if (issues.length > 0) console.warn('[syncScaleFromConfig] escala con avisos...', issues)
// ...continúa haciendo upsert igual
```

Por lo tanto una escala con **solapes o huecos** SÍ puede guardarse y quedar viva. Eso reactiva la no-determinación de `getPerformanceLevel` (`student-grades.service.ts:470`, `findFirst` sin `orderBy`): con rangos solapados, el nivel de desempeño devuelto es arbitrario.
**Impacto.** Nivel de desempeño (y aprobado/reprobado) inconsistente en boletines cuando la escala está mal formada; la barrera que creí existía no existe.
**Riesgo.** Prob. media · Impacto alto. **Prioridad P1.** (Sube desde el M-3/P2 del Pase 1.)
**Solución.** Hacer `validateScaleRanges` **bloqueante** en `updateGradingConfig`/`updateAcademicLevels` (rechazar el guardado con 400 si hay issues) y añadir `orderBy` determinista en `getPerformanceLevel`.

### RE-5 · `syncScaleFromConfig` no es atómico y **traga** los errores → escala a medias en producción

**Descripción.** El upsert se hace fila por fila en un bucle sin transacción, y todo el método está envuelto en `try/catch` que solo hace `console.error` y devuelve `{ synced: 0 }` (`:308-354`). Si falla tras actualizar 2 de 4 niveles, la escala queda **mezclada** (2 niveles nuevos + 2 viejos → solapes/huecos garantizados) y el guardado de config **reporta éxito** igual.
**Impacto.** Escala corrupta silenciosa tras un fallo parcial; el admin cree que guardó bien.
**Riesgo.** Prob. baja-media · Impacto alto. **Prioridad P2.**
**Solución.** Envolver la re-proyección en `$transaction` (todo-o-nada) y propagar el error al guardado de config (no tragarlo).

### RE-6 · No hay validación de que los pesos sumen 100% (ni de períodos ni de componentes)

**Descripción.** Ni `updatePeriods` ni `updateGradingConfig` validan que `weightPercentage` sume 100. Como todos los motores **renormalizan** por el peso presente (A-1 del Pase 1), un config 40/40/40 (=120%) o 30/30/30 (=90%) **no da error**: se "arregla" solo dividiendo por el total. El admin nunca se entera de que su ponderación está mal.
**Impacto.** Ponderaciones inválidas aceptadas en silencio; el resultado no es el que el reglamento define.
**Riesgo.** Prob. media · Impacto alto. **Prioridad P1.**
**Solución.** Validar suma = 100 (± tolerancia) al guardar períodos y componentes; rechazar o advertir explícitamente.

### RE-7 · Los cambios de reglas académicas no se auditan (a diferencia de las notas)

**Descripción.** `updateAreaConfig/GradingConfig/AcademicLevels/Periods` escriben JSON crudo vía `$executeRaw` (`:224-231,259-261,293-295,379-381`) sin registrar **quién** cambió **qué regla** y **cuándo**. El sistema tiene auditoría forense de *notas* (`GradeAuditService`), pero las **reglas que deciden quién aprueba** (mínimo aprobatorio, pesos, escala) cambian sin rastro.
**Impacto.** Imposible reconstruir por qué un estudiante pasó/reprobó si alguien tocó la escala o los pesos; hueco de trazabilidad justo en la palanca más sensible.
**Riesgo.** Prob. media · Impacto alto. **Prioridad P1.**
**Solución.** Auditar todo cambio de configuración académica (evento con actor, valor anterior→nuevo, timestamp), igual que las notas.

---

# 🟡 Riesgos medios

### RE-8 · `AcademicRulesEngine.getPerformanceLevel` cae al nivel más bajo ante nota fuera de rango
Si ninguna franja matchea, devuelve `sortedLevels[last]` (el más bajo, `:420`). Una nota fuera de escala (p. ej. 6.0 en 1–5) se clasificaría como el nivel inferior en vez de marcar error. **Código muerto hoy** (RE-1), pero si se resucita el motor, arréglese: retornar null/alerta, no el nivel más bajo. **Prioridad P3.**

### RE-9 · `determinePromotion` tiene "máximo 2 áreas" hardcodeado con `TODO: Hacer configurable`
`AcademicRulesEngine.ts:663-665`. Si se adopta este motor, ese umbral debe venir de la config institucional (`maxFailedSubjectsForPromotion`/equivalente por áreas), no ser una constante. **Prioridad P2** (al resucitar el motor).

### RE-10 · La config vive en columnas JSON de `Institution` sin esquema fuerte
Todos los `update*` serializan DTOs a `jsonb` sin validar estructura contra un esquema en BD. Un cliente que mande un JSON con forma inesperada puede dejar la config en un estado que los motores interpretan a medias (p. ej. `performanceLevels` sin `minScore`, que `mapConfigLevels` descarta en silencio → cae a la escala por defecto 0–5). **Prioridad P2.** Solución: validar con class-validator/DTO estricto y rechazar formas inválidas.

---

# ✅ Lo que está bien

- La **existencia** de `AcademicRulesEngine` como diseño (área/aprobación/recuperación/promoción por áreas) es correcta y más completa que lo que está vivo — el problema es que no se usa.
- `syncScaleFromConfig` **no pisa** un descriptor pedagógico ya configurado con null (`:334`) — cuidado correcto.
- `syncPeriodsToAcademicTerms` **no crea** el año automáticamente (evita años fantasma) y prefiere ACTIVE→DRAFT (`:390-407`).

---

# 🧭 Observación de arquitectura: de "estados" a "eventos académicos" (recogiendo el feedback del rector)

El rector propuso pensar en **eventos académicos**, no solo estados. Coincido, y hay un dato importante: **la base ya existe parcialmente** — el sistema usa `EnrollmentEvent` (creación, promoción, repitencia) en el cierre de año (`academic-year-lifecycle.service.ts:376-384,765-774`). Es un log de eventos, pero **estrecho** (solo matrícula) y **no cubre** notas-canónicas, recuperaciones, cambios de config, graduación, homologación, nivelación.

**Recomendación concreta:** generalizar a un `StudentAcademicEvent` (o un `AcademicEventLog` transversal) append-only que capture: matrícula, cambio de grupo/jornada/sede, retiro, reingreso, recuperación, promoción, **graduación** (ligado a YC-2), homologación, nivelación, **y cambios de regla que afectan al estudiante**. Beneficios: (1) responde "¿qué pasó con Juan hace dos años?" reconstruyendo su historia; (2) unifica las tres auditorías dispersas (notas / matrícula / — reglas: hoy inexistente) en un solo eje; (3) hace el histórico inmune a que alguien cambie la config hoy (RE-2), porque el evento guarda el resultado en su momento.

Esto no es un hallazgo de bug; es la dirección que hace innecesarios varios parches puntuales.

---

# 📋 Roadmap de auditorías verticales (adoptando la propuesta del rector)

| Pase | Foco | Estado |
|------|------|--------|
| 1 | Núcleo notas + seguridad multi-tenant | ✅ hecho |
| 1B | Cambio de año + carga masiva / inicio en período ≠ 1 | ✅ hecho |
| **2** | **Motor académico + cambio de config a mitad de año** | ✅ **este documento** |
| 3 | Cambio de año completo *en entorno vivo* (2 instituciones, cadena histórica nota→boletín→PDF→histórico) | ⏳ requiere staging |
| 4 | Matrículas (traslados, reingresos, duplicados, huérfanos) | ⏳ |
| 5 | ABP (cronograma, equipos, misiones, duplicación de expediciones, cambios de docente/estudiante) | ⏳ |
| 6 | Seguridad SaaS (barrido automatizado IDOR de los 76 endpoints) | ⏳ |
| 7 | Concurrencia a escala (k6/artillery) | ⏳ |
| 8 | UX (recorrido docente/coordinador/estudiante/rector) | ⏳ |

---

*Fin del Pase 2. La corrección de RE-4 muestra el valor del cross-check: un hallazgo del Pase 1 se subió de severidad al leer el write path real. Prioridad de arranque para este pase: RE-1 (unificar el motor) y RE-2 (aislar la config vigente por período).*
