# Diseño — Convivencia configurable: Precargada (como Propósitos) **o** Docente (libre)

**Origen:** Las profes de transición del **Colegio Esperanza del Sur** reclamaron que "colocar las notas de convivencia no es igual a las demás". La fricción inmediata (dos clics: abrir desplegable "Valorar" → seleccionar; y agregar fila antes) **ya se corrigió** en `ConvivenciaPanel.tsx` (valoración de un clic, fila lista de una vez). Este documento planifica el paso siguiente que pidieron: **poder elegir** cómo se capturan los desempeños de convivencia.

**Estado:** propuesta / pendiente de aprobar orden de fases. **Regla:** aditivo y reversible; el default = comportamiento actual (no rompe a ninguna institución).

Relacionado: [[boletin-transicion]], [[evaluacion-preescolar-configurable]], [[aprendizajes-evidencias-modulo]], `docs/DISENO_BOLETIN_TRANSICION.md`.

---

## 1. Objetivo

La convivencia debe soportar **dos modos**, elegibles por la institución:

| Modo | Quién define el desempeño | Qué hace el docente | Análogo actual |
|------|---------------------------|---------------------|----------------|
| **PRECARGADA** (`ADMIN_FIXED`) | Admin/coordinación precarga los desempeños por grado (fijos, compartidos) | **Solo marca el nivel** (L/EP/I), un clic | = Propósitos/Dimensiones |
| **DOCENTE** (`TEACHER_MANAGED`, actual) | El docente los escribe libremente | Redacta el desempeño **y** marca nivel | = Convivencia hoy |

Default = **DOCENTE** (lo que ya funciona). Ninguna institución cambia hasta que un admin lo active.

---

## 2. Tesis de diseño: convivencia precargada = una "dimensión" más

En modo **PRECARGADA**, la convivencia se comporta **exactamente igual que una dimensión** y **reusa todo el pipeline existente**, sin módulo paralelo:

- **Catálogo:** `Achievement` grade-scoped (`gradeId` + `subjectId`=subject CONVIVENCIA + `academicYearId`), creado por el admin vía el flujo de catálogo ya existente (`POST /achievements/catalog`, UI `PreschoolCatalog`).
- **Valoración del docente:** `StudentAchievement.performanceLevel` (una valoración por desempeño/período), igual que los propósitos.
- **Captura:** `QualitativeGradesPanel` con `catalogLocked=true` (idéntico a las dimensiones: el docente solo marca nivel).
- **Boletín:** se renderiza como dimensión (rama `learningBlocks`), conservando **I.H. = 0** (`Subject.displayHours=0`, ya soportado).

El modo **DOCENTE** sigue usando `ConvivenciaEntry` + `ConvivenciaPanel` (sin cambios, ya mejorado).

**Por qué esta tesis:** cero duplicación. Todo el trabajo ya hecho para propósitos (precarga admin, panel de un clic, escala dinámica L/EP/I, boletín) se aprovecha tal cual. El único código nuevo es **el interruptor de modo** y el **ruteo** al panel/render correcto.

---

## 3. Modelo de datos (aditivo)

Un solo campo nuevo:

```prisma
model AchievementConfig {
  // ...
  // Modo de captura de Convivencia (simétrico con learningCatalogMode):
  //   TEACHER_MANAGED → el docente escribe los desempeños (ConvivenciaEntry) — actual/default.
  //   ADMIN_FIXED     → el admin precarga los desempeños (Achievement grade-scoped);
  //                     el docente solo valora (StudentAchievement).
  convivenciaCatalogMode LearningCatalogMode @default(TEACHER_MANAGED)
}
```

- Reusa el enum `LearningCatalogMode` existente. Migración = una columna con default → **cero backfill, cero riesgo**.
- **Granularidad:** por institución (basta para transición, donde todos los grados comparten criterio). Si en el futuro se necesita por grado, se resuelve con el mismo patrón grade-scoped del catálogo, sin tocar este flag.
- **No** se toca `ConvivenciaEntry` ni `Achievement`: ya soportan ambos caminos.

---

## 4. Comportamiento por capa (ruteo según el modo)

Todo depende de `config.convivenciaCatalogMode`:

| Capa | `TEACHER_MANAGED` (default) | `ADMIN_FIXED` (precargada) |
|------|------------------------------|-----------------------------|
| **Admin** | Nada que precargar | Pestaña "Convivencia" en `PreschoolCatalog`: precarga desempeños grade-scoped (reusa `createCatalog`) |
| **Docente** (`Grades.tsx`, rama `isConvivencia`) | `ConvivenciaPanel` (actual) | `QualitativeGradesPanel` con `catalogLocked` sobre los `Achievement` de la asignatura CONVIVENCIA |
| **Guardado** | `PUT /achievements/convivencia` (`ConvivenciaEntry`) | `StudentAchievement` (ya existe el flujo de valoración) |
| **Boletín** (`reportCardTemplates.ts`) | Rama actual `subjectType===CONVIVENCIA` (lee `convivenciaItems`) | Rama de dimensión (`learningBlocks`), conservando I.H. = 0 |

El backend de reportes (`reports.service.ts`) **ya** construye `learningBlocks` para toda asignatura con `Achievement`, así que el modo precargado no necesita nuevas consultas: solo cambiar qué rama toma la plantilla.

---

## 5. Plan por fases (incremental, cada una desplegable y reversible)

- **F0 — Config + migración.** Añadir `convivenciaCatalogMode` (migración aditiva) y exponerlo en `GET/PUT achievements/config`. Sin cambio visible. *(Riesgo nulo.)*
- **F1 — Selector de modo (admin).** En `PreschoolCatalog` (o config de institución): "Convivencia: la escriben los docentes / catálogo fijo (solo valoran)". Default = docentes.
- **F2 — Precarga de convivencia (admin).** Pestaña/sección para crear los desempeños de convivencia como catálogo grade-scoped de la asignatura CONVIVENCIA (reusa `createCatalog` / `getCatalog`). Solo visible/relevante si el modo es `ADMIN_FIXED`.
- **F3 — Captura del docente ramificada.** En `Grades.tsx`, cuando `isConvivencia`: si `ADMIN_FIXED` → `QualitativeGradesPanel` (catalogLocked) sobre los Achievement de convivencia; si no → `ConvivenciaPanel` (actual). Cargar `Achievement`+`StudentAchievement` de la asignatura CONVIVENCIA en el modo fijo.
- **F4 — Boletín ramificado.** En la plantilla de transición: si convivencia está en `ADMIN_FIXED`, renderizar como dimensión (learningBlocks) con I.H. 0; si no, la rama actual.
- **F5 — Pruebas + staging.** Ambos modos end-to-end; verificar boletín en los dos; probar con una profe de Esperanza del Sur.

**Compatibilidad:** F0–F1 no cambian nada hasta que un admin active el modo. Las instituciones existentes (incl. las que ya usan convivencia libre) siguen igual.

---

## 6. Decisiones abiertas (para confirmar)

1. **Granularidad del modo:** por **institución** (recomendado, simple) vs. por **grado** (permite mezclar). Recomendación: institución ahora; grado como extensión futura sin re-migrar.
2. **¿Coexistencia de modos por período?** No recomendado: el modo es una política, no un dato de período. Cambiarlo a mitad de año conservaría lo ya capturado en cada modelo (`ConvivenciaEntry` / `StudentAchievement`) pero el boletín tomaría el modo vigente. Lo dejaría **fijo por año**.
3. **Migrar datos al cambiar de modo:** NO auto-migrar entre `ConvivenciaEntry` ↔ `StudentAchievement`. Si un admin cambia el modo, lo capturado en el modo anterior queda como histórico; se recaptura en el nuevo. (Igual criterio que [[movimiento-estudiante-notas]].)

---

## 7. Alcance de código (resumen)

| Archivo | Cambio |
|---------|--------|
| `apps/api/prisma/schema.prisma` + migración | `AchievementConfig.convivenciaCatalogMode` |
| `achievement-config` (service/controller) | Exponer el flag en get/update |
| `apps/web/.../PreschoolCatalog.tsx` | Selector de modo + sección de precarga de convivencia |
| `apps/web/src/pages/Grades.tsx` | Ruteo del panel (rama `isConvivencia`) + carga de Achievement/StudentAchievement de convivencia en modo fijo |
| `apps/web/src/pages/reportCardTemplates.ts` | Rama de boletín según modo |

Sin nuevas tablas. Sin backfill. Reuso de: catálogo grade-scoped, `QualitativeGradesPanel`, valoración `StudentAchievement`, pipeline de boletín.
