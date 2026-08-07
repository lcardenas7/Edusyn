# Evaluación de Preescolar Configurable por Institución

> **Estado:** propuesta de diseño (spec) — pendiente de aprobación antes de tocar esquema.
> **Alcance:** módulo de calificaciones + logros + boletín para grados con estructura `DIMENSIONS` (Preescolar: prejardín, jardín, transición).
> **Regla innegociable:** no se hardcodea un modelo pedagógico. Cada institución arma el suyo desde configuración (AR3). Edusyn trae un **default MEN-alineado** y lo deja ajustar.

---

## 1. Por qué (encuadre normativo)

El **Decreto 1411 de 2022** reorganizó la educación inicial en Colombia y redefinió el sentido de preescolar. Consecuencias para evaluación en transición/jardín:

- Evaluación **integral y cualitativa**, centrada en el **desarrollo del niño**, no en aprobar contenidos.
- **Observación permanente** como estrategia principal (registros anecdóticos, portafolios, evidencias, diario de campo).
- Se valora el avance en las **dimensiones del desarrollo** y en las **actividades rectoras** (juego, arte, literatura, exploración del medio).
- **No se compara** a los niños entre sí, sino a cada uno con su propio proceso.
- **Prácticamente no se reprueba**: el fin es el desarrollo integral y el paso a primero.
- Muchas instituciones oficiales **ya eliminaron la nota numérica** (1.0–5.0) en jardín y transición, con escalas como *En proceso / Logrado / Requiere acompañamiento* o *Avance inicial / significativo / esperado*.

**Punto clave de producto:** cada SIEE adapta esto distinto. Algunas piden **un boletín particular**. El sistema debe **absorber esa diversidad** sin obligar a un único formato.

---

## 2. Principio rector: configurabilidad, no imposición

Edusyn no decide *cómo* evalúa un preescolar; **ensambla** el modelo de cada institución a partir de piezas configurables, con un default alineado al MEN listo para usar.

```
Modelo de evaluación de preescolar (por institución)
 = Escala cualitativa            (configurable — YA EXISTE en SIEE)
 + Eje de valoración             (dimensiones | asignaturas | conjunto propio)
 + Actividades rectoras          (lente transversal — opcional)
 + Modo de descriptor            (libre | descriptor por nivel por indicador)
 + Observaciones / evidencias    (on/off + plantillas)
 + Plantilla de boletín narrativo (configurable por institución)
 + Regla de promoción            (sin reprobación — YA EXISTE vía DIMENSIONS)
```

Todo esto vive **por institución**. Dos colegios sobre el mismo Edusyn ven planillas y boletines distintos sin tocar código.

---

## 3. Qué YA existe (sustrato a reusar, no reinventar)

| Pieza | Dónde | Estado |
|---|---|---|
| Estructura `DIMENSIONS` que activa modo cualitativo | `Grade.academicStructure` + `AcademicStructure.ts` | ✅ (recién corregido: preescolar nace en DIMENSIONS) |
| Escala cualitativa configurable por nivel (L/EP/I, colores, `isApproved`) | `academicLevelsConfig` (JSON en Institution) | ✅ |
| Panel cualitativo con los 3 cuadritos + observación | `QualitativeGradesPanel.tsx` | ✅ |
| Indicadores/logros por asignatura+período | `Achievement` / `StudentAchievement` | ✅ |
| Banco de logros con `performanceLevel` + scope (asignatura/área/grado) | `AchievementBank` | ✅ (infra lista, subusada) |
| Config de logros (por período, juicios, observaciones, formato boletín) | `AchievementConfig` + `ValueJudgmentTemplate` + `ObservationTemplate` | ✅ |
| Config del boletín (header, colores, qué mostrar, firmas) | `ReportCardConfig` | ✅ |
| Boletín cualitativo (modo QUALITATIVE) | `report-card.engine.ts` `getReportCardMode` | ✅ (base) |
| Catálogo de dimensiones estándar del desarrollo | `standardDimensions` en `AcademicStructure.ts` | ✅ (catálogo, sin uso en UI) |
| Sin promoción/reprobación en DIMENSIONS | motores de promoción/recuperación | ✅ |

**Conclusión:** el 70% del cableado existe. Faltan tres cosas: (a) hacer las **dimensiones** de primera clase, (b) el **descriptor por nivel por indicador**, (c) **evidencias** + **boletín narrativo configurable**.

---

## 4. Las piezas configurables (detalle)

### 4.1 Escala cualitativa — YA configurable
Cada institución define en el SIEE su escala (código, nombre, color, si "aprueba"). Ejemplos que ya soporta el modelo:
- `L / EP / I` (Logrado / En Proceso / Iniciando)
- `En proceso / Logrado / Requiere acompañamiento`
- `Avance inicial / significativo / esperado`

Sin cambios de esquema. Solo hay que asegurar que la planilla lea SIEMPRE de aquí (ya lo hace vía `resolvedLevel.qualitativeLevels`).

### 4.2 Eje de valoración — **configurable (nuevo)**
La pregunta "¿evaluamos por dimensiones o por asignaturas?" la responde la institución:

- **`DIMENSIONS_STANDARD`** — las 6–7 dimensiones del desarrollo (Cognitiva, Comunicativa, Corporal, Socioafectiva, Estética, Ética, Espiritual). Default MEN.
- **`DIMENSIONS_CUSTOM`** — el colegio define su propio conjunto.
- **`SUBJECTS`** — algunos colegios privados siguen evaluando por "asignaturas" de preescolar (Inglés Inicial, Pre-matemáticas…). Es el comportamiento actual.

Implementación: las "dimensiones" se materializan como los `Subject` del grado preescolar (reusa todo el andamiaje de indicadores por subject). Se agrega una marca de origen (`isDimension` / catálogo) para poder sembrarlas y mostrarlas como dimensiones en la UI.

### 4.3 Actividades rectoras — **lente transversal (nuevo, opcional)**
Juego, arte, literatura, exploración del medio. No son un eje de nota; son una **clasificación** del indicador/experiencia. Se modela como un `tag`/enum opcional en el indicador (`Achievement.rectorActivity`) para poder reportar "avances por actividad rectora" si la institución lo activa.

### 4.4 Modo de descriptor — **configurable (nuevo)**
Cómo se produce el texto que va al boletín cuando el docente elige el nivel:

- **`FREE`** (actual) — el docente escribe una observación libre; el nivel solo etiqueta.
- **`DESCRIPTOR_PER_LEVEL`** (lo que pediste) — cada indicador guarda **hasta 3 descriptores, uno por escala**. Al elegir el cuadrito, el descriptor correspondiente autocompleta el boletín. El docente los redacta **una vez** por indicador (en "Logros/indicadores").

Este es el corazón de tu propuesta. Se implementa con una tabla de descriptores por indicador y nivel (ver §5).

### 4.5 Observaciones y evidencias
- **Observaciones**: ya existe `useObservations` + `ObservationTemplate`. Se reusa.
- **Evidencias (nuevo)**: fotos, trabajos, registros anecdóticos asociados a la valoración del estudiante en el período. Nueva entidad `StudentEvidence` (opcional por institución).

### 4.6 Boletín narrativo configurable
`ReportCardConfig` ya controla el boletín. Se agrega, para modo QUALITATIVE:
- selección de **plantilla narrativa** (por dimensión, por actividad rectora, o párrafo consolidado);
- inclusión opcional de **evidencias**;
- textos introductorios/legales del preescolar por institución.

Instituciones con "boletín particular" eligen su plantilla; el default es un boletín narrativo MEN-alineado.

### 4.7 Promoción — sin cambios
El motor ya trata DIMENSIONS como "sin reprobación". Solo se documenta.

---

## 5. Modelo de datos (reuso + adiciones)

**Se reusa tal cual:** `Grade.academicStructure=DIMENSIONS`, `academicLevelsConfig`, `Achievement`, `StudentAchievement`, `AchievementBank`, `AchievementConfig`, `ReportCardConfig`.

**Adiciones propuestas (migración):**

1. **Config de preescolar por institución** — extender `AchievementConfig` (o nueva `PreschoolEvaluationConfig` 1–1 con Institution):
   - `evaluationAxis: DIMENSIONS_STANDARD | DIMENSIONS_CUSTOM | SUBJECTS` (default `DIMENSIONS_STANDARD`)
   - `descriptorMode: FREE | DESCRIPTOR_PER_LEVEL` (default `FREE`)
   - `useRectorActivities: Boolean`
   - `useEvidences: Boolean`
   - `narrativeTemplate: BY_DIMENSION | BY_RECTOR_ACTIVITY | CONSOLIDATED`

2. **Descriptor por nivel por indicador** — nueva tabla:
   ```
   AchievementLevelDescriptor
     id, achievementId (FK), qualitativeLevelCode (ej "L"/"EP"/"I"), text
     @@unique([achievementId, qualitativeLevelCode])
   ```
   Solo se usa si `descriptorMode = DESCRIPTOR_PER_LEVEL`.

3. **Actividad rectora en el indicador** — campo opcional:
   `Achievement.rectorActivity: JUEGO | ARTE | LITERATURA | EXPLORACION | null`

4. **Evidencias** — nueva tabla (opcional):
   ```
   StudentEvidence
     id, institutionId, studentEnrollmentId, academicTermId,
     achievementId?, type (PHOTO|WORK|ANECDOTAL), url?, note?, createdBy, createdAt
   ```

5. **Marca de dimensión en Subject** — para sembrar/mostrar dimensiones:
   `Subject.dimensionCode: String?` (o tabla catálogo `Dimension` si se prefiere normalizar).

> Todas las adiciones son **aditivas y opcionales**: con `descriptorMode=FREE` y flags en `false`, el comportamiento actual queda intacto (compatibilidad hacia atrás).

---

## 6. Superficie de configuración (lo que ve el admin en el SIEE)

En **Configuración SIEE → Preescolar**:
1. Escala cualitativa (ya existe).
2. Eje de valoración: Dimensiones estándar / propias / Asignaturas.
3. Si dimensiones propias: editor de dimensiones.
4. Modo de descriptor: libre / descriptor por nivel.
5. Actividades rectoras: on/off.
6. Evidencias: on/off.
7. Plantilla de boletín narrativo.

Con un botón **"Aplicar modelo MEN (Decreto 1411)"** que precarga: dimensiones estándar + escala *En proceso/Logrado/Requiere acompañamiento* + descriptor por nivel + actividades rectoras + boletín narrativo por dimensión.

---

## 7. Cambios de UI

- **Planilla (`QualitativeGradesPanel`)**:
  - Selector de **dimensión** (cuando el eje son dimensiones) en lugar de tratar la asignatura como dimensión.
  - Si `DESCRIPTOR_PER_LEVEL`: al elegir el cuadrito se muestra/autollena el descriptor de ese nivel (con posibilidad de ajustar la observación).
  - Adjuntar evidencia por estudiante (si está activo).
- **Logros/indicadores**: al crear un indicador, si el modo es `DESCRIPTOR_PER_LEVEL`, aparecen 3 campos (uno por nivel) para redactar el descriptor; integración con `AchievementBank` para reutilizar.
- **Boletín**: render narrativo por dimensión/actividad rectora + evidencias, según `ReportCardConfig`.

---

## 8. Multi-institución: el mismo motor, tres colegios distintos

| | Colegio oficial A (MEN puro) | Colegio privado B (bilingüe) | Colegio C (mixto) |
|---|---|---|---|
| Escala | En proceso / Logrado / Requiere acompañamiento | L / EP / I | Avance inicial/significativo/esperado |
| Eje | Dimensiones estándar | Asignaturas (Inglés Inicial…) | Dimensiones propias |
| Descriptor | Por nivel | Libre | Por nivel |
| Act. rectoras | Sí | No | Sí |
| Evidencias | Sí | No | Sí |
| Boletín | Narrativo por dimensión | Por asignatura | Narrativo consolidado |

Los tres se sirven **sin cambiar código**, solo configuración. Ese es el criterio de éxito del diseño.

---

## 9. Plan por fases (incremental, compatible hacia atrás)

- **Fase 0 — Config base**: `PreschoolEvaluationConfig` + defaults + botón "Aplicar modelo MEN". Sin cambio de comportamiento si queda en default.
- **Fase 1 — Descriptor por nivel**: tabla `AchievementLevelDescriptor` + UI en Logros + autollenado en planilla + boletín. (Lo que pediste primero.)
- **Fase 2 — Dimensiones de primera clase**: eje configurable + siembra de dimensiones estándar + selector en planilla.
- **Fase 3 — Actividades rectoras**: tag en indicador + reporte por actividad rectora.
- **Fase 4 — Evidencias + boletín narrativo**: `StudentEvidence` + plantillas de boletín.

Cada fase es desplegable y reversible por sí sola.

---

## 10. Decisiones abiertas (para ti)

1. **Dimensiones como `Subject` marcado vs entidad `Dimension` nueva.** Reusar Subject es más rápido y aprovecha todo el andamiaje; una entidad propia es más limpia conceptualmente. (Recomiendo reusar Subject en Fase 1–2 y evaluar normalizar después.)
2. **`PreschoolEvaluationConfig` nueva vs extender `AchievementConfig`.** (Recomiendo tabla nueva para no sobrecargar la existente.)
3. **Orden de fases.** ¿Arrancamos por Fase 1 (descriptor por nivel, tu pedido original) o por Fase 0+2 (dimensiones) para que el modelo MEN quede completo de una?
4. **Evidencias con almacenamiento de archivos.** ¿Ya hay bucket/CDN para imágenes en Edusyn, o las evidencias arrancan solo como nota/URL externa?
