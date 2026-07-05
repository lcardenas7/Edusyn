# AUDITORÍA DEL MÓDULO DE REPORTES

> **Motivo:** algunos reportes están bien, pero otros no generan la información correcta, no calculan lo que deben, o "no hacen mucho". Caso testigo del fundador: el **informe parcial** debería listar las asignaturas reprobadas por estudiante *antes* de cerrar el primer período (un "corte") y no lo hace. Además: faltan filtros (área/asignatura), el cálculo de "reprobado" varía entre instituciones, y los Excel son crudos.
> **Método:** anclado en código real — backend `reports.controller.ts`, `reports.service.ts` (~4k líneas), `academic-data-source.service.ts`, `reports-export.service.ts`, `preventive-cuts.service.ts`, `academic-year-lifecycle.getPassingGrade`; frontend `ReportsHub.tsx`, `reports/*.tsx`.
> **Fecha:** 2026-07-04.
> **Veredicto:** 🟠 **La arquitectura de datos es correcta (un único `AcademicDataSourceService` que resuelve snapshot vs. live). `PeriodFinalGrade` NO es un dato de cierre: es un valor DERIVADO que se auto-recalcula desde los parciales en cada guardado de planilla, así que la nota del período está VIVA durante el período. Lo único que realmente exige el período FINALIZED es el BOLETÍN oficial (el snapshot inmutable). Por tanto los reportes analíticos pueden y deberían funcionar a mitad de período. Los defectos reales son de SEMÁNTICA y presentación: "reprobado" calculado por asignatura ignorando la regla institucional (área vs. asignatura), umbral de aprobación único para toda la institución, falta de filtros y de un modo "corte" explícito, solapamiento conceptual entre 3 reportes de "riesgo", conteos ficticios en el hub, y Excel sin formato.**

> **⚠️ Corrección (2026-07-04, tras revisión del fundador):** una primera versión de este documento afirmó que los reportes salían vacíos *porque `PeriodFinalGrade` solo existía al cerrar el período*. **Es incorrecto.** `PeriodFinalGrade` se recomputa en vivo (`partial-grades.service.ts:318 → recomputePeriodFinalGrade`). La sección A.1 y el hallazgo R-1 quedan reescritos abajo con la causa real.

---

# PARTE A — AUDITORÍA (qué está mal)

## A.0 Lo que está BIEN (para no romperlo)
- **`AcademicDataSourceService`** centraliza la fuente: `FINALIZED` → snapshot congelado; `OPEN/CLOSED` → live (`PeriodFinalGrade`). Regla de oro clara y bien documentada. **Conservar.**
- **`PreventiveCutsService`** (Corte Preventivo) **sí** calcula la nota parcial a una fecha de corte con `calculateTermGradeAtDate`, distingue "sin datos" de "en riesgo" (evita falsas alarmas al inicio), y entrega PDF por grupo y por estudiante. **Es el único reporte verdaderamente "parcial" y está bien hecho.**

## A.1 El pipeline real de la nota (y qué necesita el cierre)

```
PartialGrade            →   PeriodFinalGrade              →   TermReportCardSnapshot
(actividades del        (nota del período, DERIVADA:       (congelado, inmutable;
 docente en planilla)    ponderada por el plan y            SOLO existe al FINALIZED)
                         renormalizada a lo que hay;        = el BOLETÍN oficial
                         se RECOMPUTA en cada guardado
                         de planilla → está VIVA)
```

- `PeriodFinalGrade` es **dato derivado**, no de cierre: `partial-grades.service.ts:318` llama a `recomputePeriodFinalGrade` en cada `bulkUpsert` de la planilla. Pondera por el plan de evaluación y **renormaliza a los componentes que ya tienen nota** → a mitad de período ya refleja "cómo va" el estudiante.
- `AcademicDataSourceService` sirve `PeriodFinalGrade` **en vivo** para períodos `OPEN`/`CLOSED`, y solo usa el snapshot congelado cuando está `FINALIZED`.
- **Consecuencia:** `getFailedSubjects` **no tiene ningún candado de "período cerrado"** — funciona a mitad de período con las notas que haya. Lo único que **realmente** necesita el período FINALIZED es el **boletín oficial** (el snapshot inmutable, para que el documento legal no cambie luego). *(La hipótesis del fundador — "creo que solo el boletín" — es correcta.)*

## A.1b Entonces, ¿por qué el fundador ve que "no lo hace"?
No es por el cierre. Las causas reales:
1. **Solo cuenta lo que ya tiene nota.** `PeriodFinalGrade` existe para `(estudiante, materia)` únicamente donde el docente **ya cargó**. A inicio del primer período, con pocas notas cargadas, el reporte sale casi vacío — correcto, pero **falta un "modo corte"** que enmarque el resultado como parcial ("con corte al …") en vez de parecer un reporte final incompleto.
2. **Semántica de "reprobado"** por asignatura vs. área y umbral por nivel (R-2/R-3).
3. **Sin filtros** por área/asignatura (R-4).
4. **Gap:** `POST /partial-grades` (upsert individual) **no** recomputa `PeriodFinalGrade` (solo lo hace `/bulk`). Si algún flujo usa el individual, la nota del período queda desactualizada respecto de los parciales.

| # | Hallazgo | Evidencia |
|---|---|---|
| **R-1** 🟠 | **Falta un "modo corte" explícito**, no un problema de cierre. El reporte funciona a mitad de período pero (a) no se presenta como parcial y (b) usa la nota ponderada del plan; para un "corte" limpio conviene reutilizar la semántica de `calculateTermGradeAtDate` (Corte Preventivo). El dato NO está bloqueado por el cierre. | `reports.service.ts:1399` (sin gate), `partial-grades.service.ts:318` (recompute vivo), `preventive-cuts.ts:153` |
| **R-2** 🔴 | **"Reprobado" hardcodeado por ASIGNATURA.** `getFailedSubjects` filtra `finalScore < passingGrade` por materia; **ignora `areaApprovalRule`** (`AREA_AVERAGE` vs `INDIVIDUAL_SUBJECT`). Instituciones que reprueban por **área** ven datos incorrectos. El fundador lo intuyó: "no funciona igual para todas las instituciones". | `reports.service.ts:1401`; `TemplateArea.approvalRule`, config institucional `areaApprovalRule` |
| **R-3** 🟠 | **Umbral de aprobación único para toda la institución.** `getPassingGrade` devuelve `min()` de los mínimos aprobatorios de **todos** los niveles → usa el umbral más bajo para todos. Colegios con escala distinta por nivel (preescolar/primaria/bachillerato) clasifican mal los reprobados de niveles con umbral más alto. | `academic-year-lifecycle.ts:946` |
| **R-4** 🟠 | **Faltan filtros.** `failed-subjects`, `recovery-list`, etc. solo filtran por grupo+período. No hay filtro por **área** ni por **asignatura**, ni salida "por área" vs "por asignatura". El fundador lo pide explícitamente. | `reports.controller.ts:246-257` |
| **R-5** 🟠 | **Solapamiento conceptual (3 reportes de "riesgo", 3 fuentes).** *Corte Preventivo* (parcial, actividades live), *Alertas → Riesgo reprobación* (`/reports/alerts`), y *Académico → Asignaturas reprobadas* (canónico). Ninguno es "la verdad" ni el nombre aclara la diferencia → el usuario no sabe cuál usar. | `ReportsHub.tsx` categorías `alerts`, `preventive`, `academic` |
| **R-6** 🟡 | **Hub con conteos ficticios.** `reportCount` hardcodeado no cuadra con los reportes listados: Administración dice **8** y lista **4**; Evaluación **6**/**3**; Convivencia **6**/**5**; Boletines **5**/**3**. El "+N más" apunta a reportes que quizá no existen. Todas las sub-tarjetas de una categoría van al **mismo** href con `?report=id` — hay que verificar que cada uno realmente funcione. | `ReportsHub.tsx:45-132` |
| **R-7** 🟡 | **Excel crudos.** `reports-export.service` solo estiliza la fila de encabezado (relleno azul). Sin bordes, sin bloque de título (institución/período/fecha), sin panel congelado, sin autofiltro, sin formato numérico, sin resaltado de reprobados; filas de "resumen" sueltas al final. Hay **7+ generadores Excel dispersos** sin estilo común (reports, MEN, matrícula, plantillas de carga, timetable) + 2 en frontend con SheetJS (Grades, Students) aún más crudos. | `reports-export.service.ts:371-392` + generadores en `iam/`, `men-reports/`, `enrollment-reports`, `web/Grades.tsx`, `web/Students.tsx` |

## A.2 Riesgos
- **Operación:** coordinación pide el "corte de reprobados" a mitad de período y recibe un Excel vacío → cree que el sistema no sirve (caso real del fundador).
- **Corrección legal/académica:** clasificar reprobados por asignatura donde la norma institucional es por área (o con umbral equivocado por nivel) produce actas/boletines inconsistentes con el SIEE.
- **Adopción:** conteos ficticios y reportes solapados minan la confianza en el módulo entero.

---

# PARTE B — GUÍA (qué usar HOY)

- **¿"Cómo van reprobando" antes de cerrar el período?** → **Corte Preventivo** (`/reports/preventive-cut`): enmarcado como corte parcial a una fecha, con PDF. "Académico → Asignaturas reprobadas" **también** trae datos a mitad de período (la nota del período está viva), pero solo cuenta materias que ya tienen nota cargada y no se presenta como "corte".
- **¿Reprobados oficiales del período?** → "Asignaturas reprobadas" tras cerrar el período; será idéntico al parcial una vez todos los docentes cargaron.
- **Lo único que exige el cierre:** el **boletín oficial** (se congela al finalizar). Los demás reportes son analíticos y viven de la nota derivada.
- **Ojo con la regla:** hoy "reprobado" se calcula por asignatura con un único umbral institucional. Si tu colegio reprueba por área o tiene umbral por nivel, el número puede no coincidir con tu SIEE (ver R-2/R-3).

---

# PARTE C — PROPUESTA

**Principio:** un solo concepto de "reprobación/riesgo" con **modo** (parcial vs. final) y **regla** (área vs. asignatura) explícitos, filtros reales, y un formateador Excel compartido.

### C-1 · Modo del reporte: parcial (corte) vs. final  *(resuelve R-1)*
El dato ya está vivo; lo que falta es **enmarcarlo y unificar la semántica**. Agregar a `getFailedSubjects` (y afines) un `scope: 'partial' | 'final'`:
- `partial` → usa la semántica del Corte Preventivo (`calculateTermGradeAtDate` a una fecha de corte) y **etiqueta el reporte como parcial** ("con corte al …"). Distingue "sin datos" de "en riesgo".
- `final` → comportamiento actual (nota derivada/canónica), pensado para después del cierre.
Así el "informe parcial de reprobadas del primer período" queda claro y consistente con el Corte Preventivo. **Nota:** esto NO es desbloquear el cierre (nunca estuvo bloqueado); es dar modo y encuadre. Corregir de paso el gap del upsert individual (que `POST /partial-grades` también recompute, o enrutar todo por `/bulk`).

### C-2 · Respetar la regla institucional + salida por área y por asignatura  *(R-2, R-4)*
- Leer `areaApprovalRule` / config institucional y calcular reprobación **por asignatura o por área** según corresponda.
- Exponer el reporte en dos vistas: **por asignatura** y **por área** (agregando el promedio de área).
- Mostrar en la UI **con qué regla** se calculó ("Este colegio reprueba por área"), dejando explícito que otras instituciones calculan distinto.

### C-3 · Umbral de aprobación por nivel  *(R-3)* — ✅ HECHO (Opción A)
`getPassingGrade` acepta ahora `{ stage, gradeName }` y devuelve el `minPassingGrade` de **ese** nivel desde `academicLevelsConfig` (mismo mapeo que `classroom.resolveScale`), con fallback al umbral global. `getFailedSubjects` resuelve el nivel del grupo y lo pasa. Opción B (segmentar `PerformanceScale` por nivel + consolidar) queda para la "Config Consolidation".

### C-4 · Filtros  *(R-4)*
Añadir `areaId` y `subjectId` (y opcional `stage`) a los endpoints de reprobados/recuperación + selectores en la UI.

### C-5 · Unificar y limpiar el hub  *(R-5, R-6)* — ✅ HECHO
- `reportCount` **eliminado**: el badge se deriva de `reports.length` y se quitó el "+N más" fantasma.
- **Ids corregidos** para que coincidan con las páginas destino (Alertas usaba `alert-low`→`alert-low-performance`; Boletines `certificate`→`report-certificate`) y **listas completadas** con los reportes reales (Admin 8, Evaluación 6, Asistencia 7, Boletines 5, Académico +failed-subjects/recovery/promotion).
- **Deep-link funcional**: `AcademicReports` ahora consume `?report=<id>` (useSearchParams) y preselecciona el reporte. Las demás páginas aún abren la categoría (pendiente menor, mismo patrón).
- Nombres más claros (Corte Preventivo = a una fecha; Alertas = seguimiento continuo; "Asignaturas reprobadas (parcial o final)").

### C-6 · Formateador Excel compartido  *(R-7 — segunda fase: "formatos")*
Un helper único (`applyReportStyle`) con: bloque de título (institución, reporte, período, fecha de generación), encabezado con relleno + bordes, **panel congelado** en la fila de datos, **autofiltro**, ancho auto, formato numérico (1 decimal), **zebra**, y **resaltado** de notas reprobadas en rojo. Aplicarlo a las exportaciones de notas (sábana), docentes, ranking, reprobados, recuperación y a las plantillas/listados de docentes y estudiantes. *No* reescribir la lógica de datos — solo el formato.

### Orden sugerido
1. **C-1 + C-2 + C-4** (el bug del informe parcial + regla institucional + filtros) — es lo que el fundador señaló.
2. **C-3** (umbral por nivel).
3. **C-5** (limpieza del hub).
4. **C-6** (formatos Excel) — la segunda tarea explícita.

---

## RESUMEN
El módulo **no está mal arquitecturado** (la resolución snapshot/live es sólida y el Corte Preventivo está bien). **`PeriodFinalGrade` es una nota derivada VIVA** (se recomputa en cada guardado de planilla), así que los reportes analíticos **no dependen del cierre**: funcionan a mitad de período. **Lo único que exige el período cerrado es el boletín oficial** (el snapshot inmutable) — la intuición del fundador era correcta. Los defectos reales son de **semántica y presentación**: "reprobado" hardcodeado por asignatura con un umbral único (ignora regla por área y umbral por nivel), falta de un **modo "corte"** explícito, falta de **filtros** por área/asignatura, tres reportes de "riesgo" solapados, conteos ficticios en el hub, y Excel crudos. La solución es dar **modo (parcial/final)** y **regla (área/asignatura)** explícitos + filtros, unificar el concepto, y un **formateador Excel compartido** — sin tocar la arquitectura de datos.
