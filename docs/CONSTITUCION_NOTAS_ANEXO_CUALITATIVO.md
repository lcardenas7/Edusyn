# ANEXO CUALITATIVO DE LA CONSTITUCIÓN DEL MÓDULO DE NOTAS

> **Extensión de** `CONSTITUCION_MODULO_NOTAS.md` (BLOQUE A · ETAPA 1.5).
> **Propósito:** modelar la **evaluación cualitativa** (preescolar, desempeños descriptivos, logros, competencias) con el mismo rigor que la cuantitativa, y subordinarla a las mismas invariantes.
> **Naturaleza:** dominio/conceptual. No es diseño técnico ni código.
> **Principio rector cualitativo:** *Lo cualitativo no es "una nota sin número": es una valoración de nivel + una narrativa de evidencia. Ambas son hechos académicos con las mismas garantías que una nota.*

---

## 1. CÓMO FUNCIONA HOY EN EDUSYN (anclado en código)

Edusyn tiene **tres estructuras académicas** (`AcademicStructureType`): `DIMENSIONS` (cualitativo puro, preescolar), `SUBJECTS_ONLY` y `AREAS_SUBJECTS` (cuantitativos). El motor de boletín (`report-card.engine.ts → generateQualitativeReport`) ya sabe renderizar el modo cualitativo: **sin nota numérica, sin promedio, sin ranking, sin reprobación**.

Pero por debajo, "lo cualitativo" está **fragmentado en tres mecanismos que se solapan** y no comparten fuente de verdad:

### Mecanismo A — Logros y juicios valorativos (`Achievement*`)
- `AchievementConfig` (logros por período, promocional, actitudinal, juicios valorativos, observaciones), `Achievement`, `StudentAchievement`, `ValueJudgmentTemplate`, `ObservationTemplate`.
- **Es lo que realmente alimenta el boletín cualitativo:** `reports.service` (líneas 2817–2828) llena `qualitativeLevel`/`qualitativeObservation` desde el **logro del estudiante** (`ach?.observation`), no desde una planilla cualitativa dedicada.

### Mecanismo B — Desempeños descriptivos (`SubjectPerformance` + `PerformanceGenerator`)
- El docente escribe una **descripción base por dimensión** COGNITIVO/PROCEDIMENTAL/ACTITUDINAL para todo el curso (`SubjectPerformance`, único por asignación+período+dimensión).
- El sistema genera, **por estudiante**, el texto final = `baseDescription` + `complement` (plantilla por nivel de desempeño), y **determina el nivel a partir de la nota numérica** (`determineLevel` sobre `PerformanceScale`).
- `PerformanceManualEdit` permite **personalizar el texto por estudiante con motivo y auditoría** (excelente patrón: override auditado de texto).
- **⚠ Hallazgo crítico (conecta con Bloque A):** `generateStudentPerformances` (línea 134) lee de **`StudentGrade`** — el modelo legacy casi muerto que la planilla real (`PartialGrade`) **no escribe**. Si el docente usa la planilla moderna, el generador de desempeños ve 0 notas → nivel "BAJO" (score 0) para todos → **narrativa rota**.

### Mecanismo C — Dimensiones de preescolar (`Dimension` / `EnrollmentDimension`)
- `Dimension` (Cognitiva, Comunicativa, Corporal, Socioafectiva, Espiritual…), asignada a plantilla → grado, y **copiada inmutable a la matrícula** (`EnrollmentDimension`, snapshot con `dimensionName`). **Patrón ejemplar:** ya implementa la *configuración temporal* de la Constitución (INV-14) para preescolar.
- **Pero el camino de entrada por estudiante es débil:** no hay una "planilla cualitativa" de primera clase donde el docente asigne, por estudiante y por dimensión, un **nivel** + **observación**. Eso hoy llega indirectamente por logros (Mecanismo A).

### Colisión de terminología (deuda conceptual)
"Dimensión" significa **dos cosas distintas**:
- El **modelo `Dimension`** (dimensiones del desarrollo, preescolar).
- El **enum `PerformanceDimension`** (COGNITIVO/PROCEDIMENTAL/ACTITUDINAL, los "saberes" para el texto de desempeños de cursos cuantitativos).

### Diagnóstico de fondo
| # | Hallazgo | Impacto |
|---|---|---|
| **Q-1** | Los desempeños descriptivos leen `StudentGrade` (legacy), no `PartialGrade` | Narrativa vacía/errónea si se usa la planilla moderna. **Bloqueante, ligado a A-1** |
| **Q-2** | No existe **planilla cualitativa** de primera clase (nivel+observación por estudiante/dimensión) | Preescolar depende de logros para expresar la valoración |
| **Q-3** | Tres mecanismos (logros / desempeños / dimensiones) sin fuente única | Divergencia y confusión (viola P3, INV-10) |
| **Q-4** | En cursos cuantitativos, el "nivel cualitativo" se **deriva del número**; lo cualitativo puro solo existe en `DIMENSIONS` | No hay evaluación **basada en competencias** independiente de la nota |
| **Q-5** | La valoración es una **foto por período**, no una **trayectoria de progreso** de la competencia | No se ve crecimiento del niño en el tiempo |
| **Q-6** | Colisión de terminología "dimensión" | Ambigüedad de dominio |
| **Q-7 (fortalezas)** | `EnrollmentDimension` (snapshot inmutable) y `PerformanceManualEdit` (override auditado) | **Bases correctas** sobre las que construir |

---

## 2. CÓMO LO RESUELVEN OTRAS PLATAFORMAS

| Enfoque / Plataforma | Idea central | Qué aporta a Edusyn |
|---|---|---|
| **Learning Stories** (Nueva Zelanda, Te Whāriki; NAEYC) | Evaluación **narrativa, formativa y basada en fortalezas**: el docente documenta con historias observadas lo que el niño **sí puede hacer**, con evidencia (fotos, anécdotas), y planifica desde ahí. | Modelo ideal para **preescolar**: narrativa + evidencia como ciudadano de primera clase, no como texto suelto. Enfoque de fortalezas, no de déficit. |
| **Standards-Based Grading / Proficiency Scales** (PowerSchool, Infinite Campus) | **Escala de proficiencia** de 3–4 niveles (p. ej. *Beginning / Approaching / Proficient / Advanced*) asociada a **estándares/competencias**, **desacoplada del porcentaje**. Una actividad evalúa un estándar, no "vale X%". | Escala de valoración cualitativa como entidad de primera clase, aplicable **por competencia/indicador**, no solo por asignatura. |
| **IB PYP / MYP** (ManageBac) | Evaluación **por criterios con descriptores** (MYP: niveles 1–8, "limited"→"proficient"); boletines con **rúbricas y descriptores de nivel** explicados a la familia. | Rúbricas con descriptores de nivel; el boletín **explica** qué significa cada nivel. |
| **Montessori / Reggio Emilia** | **Portafolio y observación** continua; el progreso se muestra con evidencia acumulada. | Portafolio de evidencia por estudiante como respaldo de la valoración. |
| **Normativa Colombia — Decreto 2247/1997 (preescolar)** | La evaluación en preescolar es **cualitativa, por dimensiones del desarrollo, formativa y sin reprobación**. Decreto 1290 da autonomía a la institución para su SIEE. | Confirma el diseño de Edusyn (DIMENSIONS auto-promueve) y exige que lo cualitativo sea **legalmente completo**, no un anexo. |

**Síntesis de mejores prácticas a adoptar (conceptualmente, sin copiar):**
1. **Escala de proficiencia como primera clase**: niveles con **descriptores**, desacoplada del número.
2. **Valoración por competencia/indicador**, no solo por asignatura/dimensión gruesa.
3. **Narrativa + evidencia (learning story / portafolio)** de primera clase y **basada en fortalezas**.
4. **Rúbricas con descriptores** que el boletín explica a la familia.
5. **Trayectoria de progreso** de la competencia en el tiempo, no solo la foto del período.
6. **IA asistente** para redactar la narrativa a partir de la evidencia (Edusyn ya tiene orquestador de IA) — borrador que el docente edita, quedando como **override auditado** (patrón `PerformanceManualEdit` ya existente).

---

## 3. PROPUESTA — MODELO CUALITATIVO DENTRO DE LA CONSTITUCIÓN

La evaluación cualitativa se subordina al **modelo de 3 capas** de la Constitución (Evidencia → Derivación → Publicación). No es un sistema aparte: es el **mismo dominio** con evidencia de otro tipo.

### 3.1 La evidencia cualitativa (Capa 1)
Para una coordenada `(matrícula, competencia|dimensión, período)`, la evidencia puede ser:
- **a) Nivel de valoración** asignado desde una **escala de proficiencia** (p. ej. *Superior/Alto/Básico/Bajo* o *Consolidado/En proceso/Inicial*). Atómico, atribuible.
- **b) Narrativa / observación** (learning story), redactable con asistencia de IA y **editable como override auditado** (ya existe el patrón en `PerformanceManualEdit`).
- **c) Logro/indicador** alcanzado (Mecanismo A, unificado).
- **d) Evidencia de portafolio** (artefacto, foto, trabajo) que respalda la valoración.

### 3.2 La derivación cualitativa (Capa 2)
- La **valoración canónica** de una dimensión/competencia por período es **determinista** a partir de su evidencia: el nivel asignado (evidencia directa) o, en cursos cuantitativos, el nivel **derivado del número** vía escala.
- El **texto final** del desempeño = base del curso + complemento por nivel + override por estudiante (patrón actual), pero leyendo la **evidencia unificada**, no `StudentGrade` legacy (resuelve Q-1 al cerrar Bloque A).
- **Una sola valoración canónica** por coordenada, consumida por boletín, informe a la familia y planes de apoyo (INV-10 aplicado a lo cualitativo).

### 3.3 La publicación cualitativa (Capa 3)
- El boletín cualitativo se congela como snapshot con **los descriptores de la escala vigentes** al momento (config temporal, INV-14). Un boletín de transición 2026 se regenera idéntico en 2036 aunque los descriptores cambien.

### 3.4 Escala de valoración cualitativa unificada (concepto central)
Converger los tres mecanismos actuales en **una sola escala de proficiencia de primera clase**, que unifique:
- `PerformanceScale` (rangos numéricos → nivel),
- `qualitativeLevels` del contexto de reglas,
- el enum `PerformanceLevel`,

y que sea usable por: **preescolar** (valoración directa por dimensión), **cualquier curso** que quiera evaluación por competencias (por indicador/logro), y **cursos numéricos** (nivel derivado del número — comportamiento actual conservado).

### 3.5 Planilla cualitativa de primera clase (cierra Q-2)
Una vista donde el docente, **por estudiante**:
- asigna un **nivel** por dimensión/competencia (desde la escala),
- redacta/edita la **narrativa** (borrador IA → override auditado),
- marca **logros/indicadores** alcanzados,
- adjunta **evidencia** de portafolio.

Esto convierte lo cualitativo en un **acto de evaluación explícito**, no en un subproducto de los logros.

### 3.6 Invariantes cualitativas (extienden las de la Constitución)
- **INV-Q1** · "Sin valorar" ≠ "nivel más bajo" (paralelo a "sin nota ≠ cero", INV-3).
- **INV-Q2** · Preescolar (`DIMENSIONS`) **nunca** reprueba ni recupera (ya vigente, INV-19).
- **INV-Q3** · Toda valoración y toda edición de narrativa es **atribuible y auditada** (generaliza `PerformanceManualEdit`).
- **INV-Q4** · Los **descriptores vigentes** se conservan con el boletín publicado (config temporal).
- **INV-Q5** · **Una valoración canónica** por `(estudiante, dimensión|competencia, período)` para todos los consumidores.
- **INV-Q6** · La narrativa por defecto es **basada en fortalezas** (lo que el estudiante alcanzó), no en déficit (principio pedagógico de learning stories y Decreto 2247).

### 3.7 Recuperación y promoción en lo cualitativo
- Preescolar: sin recuperación/reprobación; una dimensión "en proceso" dispara **plan de acompañamiento** (ya existe `SupportStatus`/APD), no una recuperación.
- Cursos por competencias: la "recuperación" es **re-valoración de la competencia** (nueva evidencia que mejora el nivel), coherente con INV-9 (nunca empeora, nunca se pierde).

### 3.8 Rol de la IA (Edusyn ya tiene orquestador)
- Redactar **borradores de learning story/observación** a partir de evidencia real (logros, asistencia, desempeño, observador).
- Sugerir el **nivel** con base en la evidencia, para que el docente **confirme o ajuste** (nunca decide sola).
- Todo lo generado por IA que el docente conserve/edite entra como **evidencia con override auditado** — nunca se presenta como hecho sin autoría.

---

## 4. CÓMO ESTE ANEXO RESUELVE LOS HALLAZGOS

| Hallazgo | Resolución conceptual |
|---|---|
| Q-1 (desempeños leen legacy `StudentGrade`) | La derivación lee la **evidencia unificada** (se materializa al cerrar Bloque A). |
| Q-2 (sin planilla cualitativa) | **Planilla cualitativa de primera clase** (§3.5). |
| Q-3 (tres mecanismos sin fuente única) | **Escala unificada** + valoración canónica única (§3.4, INV-Q5). |
| Q-4 (cualitativo = número disfrazado) | Evaluación **por competencias** independiente del número (§3.1a, §3.4). |
| Q-5 (foto, no trayectoria) | Progreso de la competencia en el tiempo como consulta derivada de la evidencia por período. |
| Q-6 (colisión "dimensión") | Glosario canónico: **Dimensión del desarrollo** (preescolar) vs **Saber/Componente** (COG/PROC/ACT). |
| Q-7 (fortalezas) | Se **conservan y generalizan** `EnrollmentDimension` (config temporal) y `PerformanceManualEdit` (override auditado). |

---

## 5. GLOSARIO CANÓNICO (adición)
- **Dimensión del desarrollo:** área del crecimiento del niño en preescolar (Cognitiva, Comunicativa, Corporal…). Estructura `DIMENSIONS`.
- **Saber / Componente:** COGNITIVO/PROCEDIMENTAL/ACTITUDINAL (los "saberes") usados para desglosar la evaluación de un curso; **no** es una dimensión del desarrollo.
- **Escala de proficiencia (valoración cualitativa):** conjunto ordenado de niveles con **descriptores** (p. ej. *Consolidado/En proceso/Inicial*), desacoplado del porcentaje.
- **Learning story / narrativa de evidencia:** relato observado y basado en fortalezas que documenta y valora el proceso del estudiante.
- **Valoración canónica:** el único nivel oficial por `(estudiante, dimensión|competencia, período)`.

---

## CIERRE DEL ANEXO

Lo cualitativo en Edusyn **no está ausente** — está **fragmentado en tres mecanismos** (logros, desempeños, dimensiones) sin fuente única, y su vía de desempeños descriptivos **depende del modelo legacy `StudentGrade`** que el Bloque A va a resolver. La propuesta lo **unifica bajo el mismo modelo de 3 capas de la Constitución**: escala de proficiencia de primera clase, planilla cualitativa explícita, narrativa basada en fortalezas con IA asistente y override auditado, y valoración canónica única — conservando los dos patrones que ya están bien hechos (`EnrollmentDimension` y `PerformanceManualEdit`).

**Dependencia con el Bloque A:** el hallazgo Q-1 (desempeños leyendo `StudentGrade`) se cierra cuando el Bloque A unifique la fuente de verdad de las notas. Por eso este anexo **no adelanta un bloque nuevo**: define el destino cualitativo para que el diseño de la ETAPA 2 lo contemple desde el inicio y no haya que rehacerlo después.

Sources (investigación de plataformas):
- [Learning Stories — NAEYC](https://www.naeyc.org/resources/pubs/tyc/fall2022/learning-stories)
- [A Different Approach to Evaluation in Early Childhood: Learning Stories (MDPI)](https://www.mdpi.com/2071-1050/14/18/11218)
- [PowerSchool Standards-Based Grading Setup](https://powerschool.misd.net/Files/StandardsSetupPTP.pdf)
- [Infinite Campus — Reports, Grading & Standards](https://content.infinitecampus.com/sis/Latest/documentation/reports-grading-and-standards/)
- [IB PYP Reports — ManageBac](https://help.managebac.com/hc/en-us/articles/360045275472-IB-PYP-Reports-Editing-Report-Card-Templates-Publishing)
- [Competency-Based Grading — Center for Assessment](https://www.nciea.org/blog/what-do-i-need-to-know-about-competency-based-grading/)
