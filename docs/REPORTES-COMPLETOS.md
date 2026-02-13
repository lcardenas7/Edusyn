# Centro de Reportes — Edusyn (Documentación Completa)

## Índice

1. [Arquitectura General](#arquitectura-general)
2. [Categoría 1: Administración / Rectoría (8 reportes)](#categoría-1-administración--rectoría)
3. [Categoría 2: Académico - Coordinación (14 reportes)](#categoría-2-académico---coordinación)
4. [Categoría 3: Evaluación SIEE (6 reportes)](#categoría-3-evaluación-siee)
5. [Categoría 4: Asistencia (6 reportes)](#categoría-4-asistencia)
6. [Categoría 5: Boletines (5 reportes)](#categoría-5-boletines)
7. [Categoría 6: Alertas y Estadísticas (3 reportes)](#categoría-6-alertas-y-estadísticas)
8. [Página Especial: Boletines (ReportCards.tsx)](#página-especial-boletines)
9. [Tablas de Base de Datos](#tablas-de-base-de-datos)
10. [Problemas de Rendimiento Detectados](#problemas-de-rendimiento-detectados)

---

## Arquitectura General

### Frontend
```
ReportsHub.tsx (Hub central → 6 categorías)
├── AdminReports.tsx        → 8 sub-reportes
├── AcademicReports.tsx     → 14 sub-reportes (2 funcionales, 12 placeholder)
├── EvaluationReports.tsx   → 6 sub-reportes (todos placeholder)
├── AttendanceReports.tsx   → 6 sub-reportes (todos funcionales)
├── BulletinsReports.tsx    → 5 sub-reportes (todos placeholder)
└── AlertsReports.tsx       → 3 sub-reportes (2 funcionales, 1 placeholder)

ReportCards.tsx (Página independiente → Boletines con preview y PDF)
```

### Backend
```
reports.service.ts          → Boletines, nota mínima, config, lista de grupo
attendance.service.ts       → 4 métodos de reportes de asistencia
evaluation/                 → student-grades.service.ts (cálculo de notas)
academic/                   → students.service.ts, academic-year-lifecycle.service.ts
```

### Hook compartido
```
useReportsData.ts → Carga: academicYears, terms, groups, subjects, teachers, students
                  → Provee filtros compartidos a todas las páginas de reportes
```

### APIs del frontend usadas
```
attendanceApi.getReportByGroup(groupId, yearId, params)
attendanceApi.getDetailedReport(params)
attendanceApi.getTeacherComplianceReport(params)
attendanceApi.getConsolidatedReport(params)
teacherAssignmentsApi.getAll({ academicYearId })
periodFinalGradesApi.getByGroup(groupId, termId)
reportsApi.getReportCard(enrollmentId, termId)
reportsApi.getReportCardConfig()
reportsApi.updateReportCardConfig(config)
reportsApi.getGroupReportCardList(groupId, termId, yearId)
reportsApi.getMinimumGrade(enrollmentId, yearId)
reportsApi.getMinimumGradeForGroup(groupId, yearId)
```

---

## Categoría 1: Administración / Rectoría

**Archivo frontend**: `AdminReports.tsx`
**Feature flag padre**: `RPT_ADMIN`
**Color**: Azul
**Total**: 8 sub-reportes (4 funcionales, 4 placeholder)

### Reporte 1.1: Carga Docente (`load-teacher`) ✅ FUNCIONAL

**Feature**: `RPT_LOAD_TEACHER`
**Descripción**: Horas, materias y grupos asignados por docente.

**Fuente de datos**: `teacherAssignmentsApi.getAll({ academicYearId })`
**Lógica frontend**: Agrupa `TeacherAssignment[]` por `teacherId`, acumula subjects, groups, weeklyHours.

| # | Columna | Campo | Formato |
|---|---------|-------|---------|
| 1 | Nro | índice | número |
| 2 | Docente | `teacher.firstName + lastName` | MAYÚSCULAS |
| 3 | Asignaturas | Set de `subject.name` | texto separado por comas |
| 4 | Grupos | Set de `grade.name + group.name` | texto separado por comas |
| 5 | Horas | suma de `weeklyHours` (default 2) | número |
| 6 | Estado | `hours >= 10 ? 'Completo' : 'Parcial'` | badge verde/ámbar |

**Filtros**: Año escolar, Sede (no funcional), Jornada (no funcional)

**CSV**: `Nro,Docente,Asignaturas,Grupos,Horas,Estado`

---

### Reporte 1.2: Carga por Grupo (`load-group`) ✅ FUNCIONAL

**Feature**: `RPT_LOAD_GROUP`
**Descripción**: Materias y docentes asignados por grupo.

**Fuente de datos**: `teacherAssignmentsApi.getAll({ academicYearId })`
**Lógica frontend**: Agrupa `TeacherAssignment[]` por `groupId`, cuenta subjects y teachers únicos.

| # | Columna | Campo | Formato |
|---|---------|-------|---------|
| 1 | Nro | índice | número |
| 2 | Grupo | `grade.name + group.name` | texto |
| 3 | Director | (no implementado) | "Sin asignar" |
| 4 | Estudiantes | (no implementado) | 0 |
| 5 | Asignaturas | `subjects.size` | número |
| 6 | Docentes | `teachers.size` | número |
| 7 | Estado | `subjects.size >= 8 ? 'Completo' : 'Incompleto'` | badge |

**⚠️ Problemas**: Director de grupo y conteo de estudiantes no están implementados.

**CSV**: `Nro,Grupo,Director,Estudiantes,Asignaturas,Docentes,Completo`

---

### Reporte 1.3: Docentes Activos (`teachers-active`) ✅ FUNCIONAL

**Feature**: `RPT_TEACHERS_ACTIVE`
**Descripción**: Listado de docentes con asignación.

**Lógica**: Misma que Carga Docente pero filtra `hours > 0`.
**Tabla**: Misma que Carga Docente.

---

### Reporte 1.4: Docentes sin Carga (`teachers-no-load`) ✅ FUNCIONAL

**Feature**: `RPT_TEACHERS_NOLOAD`
**Descripción**: Docentes sin asignación académica.

**Lógica**: Misma que Carga Docente pero filtra `hours === 0`.
**⚠️ Problema**: Solo detecta docentes que TIENEN asignaciones con 0 horas. No detecta docentes que NO tienen ninguna asignación.

---

### Reportes 1.5-1.8: PLACEHOLDER (sin implementar)

| ID | Nombre | Feature | Estado |
|----|--------|---------|--------|
| `coverage` | Cobertura académica | `RPT_COVERAGE` | ❌ Solo muestra "Seleccione filtros..." |
| `hours-summary` | Resumen de horas | `RPT_HOURS` | ❌ Solo muestra "Seleccione filtros..." |
| `staff-list` | Listado de personal | `RPT_STAFF` | ❌ Solo muestra "Seleccione filtros..." |
| `enrollment-summary` | Resumen de matrícula | `RPT_ENROLLMENT` | ❌ Solo muestra "Seleccione filtros..." |

---

## Categoría 2: Académico - Coordinación

**Archivo frontend**: `AcademicReports.tsx`
**Feature flag padre**: `RPT_ACAD`
**Color**: Verde
**Total**: 14 sub-reportes (3 funcionales, 11 placeholder)

### Reporte 2.1: Consolidado por Asignaturas (`cons-subjects`) ✅ FUNCIONAL

**Feature**: `RPT_CONS_SUBJECTS`
**Descripción**: Notas de todas las materias por estudiante en un período.

**Fuente de datos**:
1. `teacherAssignmentsApi.getAll({ academicYearId })` → obtiene lista de grupos
2. `periodFinalGradesApi.getByGroup(groupId, termId)` → para cada grupo, obtiene notas

**Lógica frontend**:
1. Itera por cada grupo (o uno solo si se filtra)
2. Para cada grupo, llama `periodFinalGradesApi.getByGroup`
3. Agrupa notas por `studentEnrollmentId`
4. Calcula promedio, materias reprobadas (<3.0), nivel de desempeño

| # | Columna | Campo | Formato | Color |
|---|---------|-------|---------|-------|
| 1 | Nro | índice | número | — |
| 2 | Estudiante | `student.lastName + firstName` | MAYÚSCULAS, sticky | font-medium |
| 3 | Grupo | `group.name` | texto | — |
| 4-N | (Asignaturas dinámicas) | `subject.name` → `finalScore` | decimal configurable | rojo si <3.0 |
| N+1 | Promedio | calculado | decimal configurable | font-medium |
| N+2 | Reprobadas | `failedCount` | número | rojo si >0, verde si 0 |
| N+3 | Desempeño | calculado | badge | Superior=verde, Alto=azul, Básico=ámbar, Bajo=rojo |

**Filtros**: Año, Período (obligatorio), Grupo, Solo reprobados (checkbox), Mostrar notas, Mostrar desempeño, Decimales, Mostrar recuperación

**Opciones de visualización**: `showGrades`, `showPerformance`, `showOnlyFailed`, `decimalPlaces`

**CSV**: `Nro,Estudiante,Grupo,[Asignaturas...],Promedio,Reprobadas,Desempeño`

**⚠️ Rendimiento**: Loop secuencial por cada grupo llamando al API → N+1 requests.

---

### Reporte 2.2: Promedio por Grupo (`avg-group`) ✅ FUNCIONAL

**Feature**: `RPT_AVG_GROUP`
**Descripción**: Rendimiento general del grupo.

**Lógica**: Misma que Consolidado por Asignaturas (comparten código).
**Tabla**: Misma que Consolidado por Asignaturas.

---

### Reporte 2.3: Nota Mínima Requerida (`min-grade`) ✅ FUNCIONAL

**Feature**: `RPT_MIN_GRADE`
**Descripción**: Cálculo de nota necesaria para aprobar cada asignatura.

**Fuente de datos backend**: `ReportsService.calculateMinimumGradeRequired(enrollmentId, yearId)`

**Lógica backend** (compleja):
1. Obtiene matrícula, nota aprobatoria, períodos con pesos, componentes finales
2. Para cada asignatura: calcula notas obtenidas vs pendientes
3. Fórmula: `notaRequerida = (notaAprobatoria × 100 - Σ(notaObtenida × peso)) / Σ(pesoPendiente)`
4. Clasifica: `approved` (ya asegurado), `at_risk` (posible), `impossible` (>5.0), `pending` (sin notas)

**Vista individual** (un estudiante):

| # | Columna | Campo | Formato |
|---|---------|-------|---------|
| 1 | Asignatura | `subjectName` | texto |
| 2 | Nota Actual | `currentGrade` | decimal |
| 3 | Nota Mínima Requerida | `minimumRequired` | decimal, font-medium |
| 4 | Estado | `status` | badge: Aprobado=verde, Posible=ámbar, Imposible=rojo |

**Vista grupal** (todo el grupo):

| # | Columna | Campo | Formato |
|---|---------|-------|---------|
| 1 | Nro | índice | número |
| 2 | Estudiante | `studentName` | texto |
| 3 | Asignatura | `subjectName` | texto |
| 4 | Nota Actual | `currentGrade` | decimal |
| 5 | Nota Mínima | `minimumRequired` | decimal |
| 6 | Estado | `status` | badge |

**⚠️ Rendimiento**: Para vista grupal, llama `calculateMinimumGradeRequired` por cada estudiante secuencialmente. Cada llamada hace N queries por asignatura × M períodos.

---

### Reportes 2.4-2.14: PLACEHOLDER (sin implementar)

| ID | Nombre | Feature |
|----|--------|---------|
| `avg-subject` | Promedio por asignatura | `RPT_AVG_SUBJECT` |
| `ranking-students` | Ranking de estudiantes | `RPT_RANKING` |
| `failed-subjects` | Asignaturas reprobadas | `RPT_FAILED` |
| `recovery-list` | Listado de recuperación | `RPT_RECOVERY` |
| `performance-level` | Desempeño por nivel | `RPT_PERFORMANCE` |
| `comparative` | Comparativo de períodos | `RPT_COMPARATIVE` |
| `subject-analysis` | Análisis por asignatura | `RPT_SUBJECT_ANALYSIS` |
| `student-history` | Historial académico | `RPT_STUDENT_HISTORY` |
| `promotion-projection` | Proyección de promoción | `RPT_PROMOTION` |
| `grade-distribution` | Distribución de notas | `RPT_DISTRIBUTION` |
| `teacher-performance` | Rendimiento por docente | `RPT_TEACHER_PERF` |

Todos muestran "Seleccione los filtros y haga clic en Buscar para generar el reporte" sin funcionalidad.

---

## Categoría 3: Evaluación SIEE

**Archivo frontend**: `EvaluationReports.tsx`
**Feature flag padre**: `RPT_EVAL`
**Color**: Púrpura
**Total**: 6 sub-reportes (**TODOS PLACEHOLDER**)

| ID | Nombre | Feature | Descripción |
|----|--------|---------|-------------|
| `eval-compliance` | Cumplimiento SIEE | `RPT_EVAL_COMPLIANCE` | Verificación del sistema de evaluación |
| `eval-criteria` | Criterios de evaluación | `RPT_EVAL_CRITERIA` | Configuración de criterios por asignatura |
| `eval-weights` | Pesos de períodos | `RPT_EVAL_WEIGHTS` | Distribución de porcentajes |
| `eval-recovery` | Políticas de recuperación | `RPT_EVAL_RECOVERY` | Configuración de recuperación |
| `eval-promotion` | Criterios de promoción | `RPT_EVAL_PROMOTION` | Reglas de promoción |
| `eval-scale` | Escala de valoración | `RPT_EVAL_SCALE` | Niveles de desempeño |

**Estado**: Solo muestran una lista informativa de lo que "incluiría" el reporte. No hay lógica de carga de datos ni tablas. El botón "Generar Reporte" no hace nada funcional.

**Filtros**: Solo Año escolar.

---

## Categoría 4: Asistencia

**Archivo frontend**: `AttendanceReports.tsx`
**Feature flag padre**: `RPT_ATT`
**Color**: Ámbar
**Total**: 6 sub-reportes (**TODOS FUNCIONALES**)

> Documentación detallada en `docs/REPORTES-ASISTENCIA.md`

| ID | Nombre | Feature | Backend Method |
|----|--------|---------|----------------|
| `att-group` | Asistencia por grupo | `RPT_ATT_GROUP` | `getReportByGroup()` |
| `att-student` | Asistencia por estudiante | `RPT_ATT_STUDENT` | `getDetailedReport()` |
| `att-subject` | Asistencia por asignatura | `RPT_ATT_SUBJECT` | `getReportByGroup()` + filtro |
| `att-teacher` | Asistencia por docente | `RPT_ATT_TEACHER` | `getTeacherComplianceReport()` |
| `att-critical` | Inasistencias críticas | `RPT_ATT_CRITICAL` | `getReportByGroup()` + filtro frontend |
| `att-consolidated` | Consolidado institucional | `RPT_ATT_CONSOLIDATED` | `getConsolidatedReport()` |

---

## Categoría 5: Boletines

**Archivo frontend**: `BulletinsReports.tsx`
**Feature flag padre**: `RPT_BULLETIN`
**Color**: Índigo
**Total**: 5 sub-reportes (**TODOS PLACEHOLDER**)

| ID | Nombre | Feature | Estado |
|----|--------|---------|--------|
| `report-partial` | Boletín parcial | `RPT_BULLETIN_PARTIAL` | ❌ Muestra `alert('en desarrollo')` |
| `report-final` | Boletín final | `RPT_BULLETIN_FINAL` | ❌ Placeholder |
| `report-certificate` | Certificado de notas | `RPT_CERTIFICATE` | ❌ Placeholder |
| `report-constancy` | Constancia de estudio | `RPT_CONSTANCY` | ❌ Placeholder |
| `report-promotion` | Acta de promoción | `RPT_PROMOTION_ACT` | ❌ Placeholder |

**Filtros**: Año, Período (solo para parcial), Grupo, Estudiante.
**Botón "Generar"**: Solo muestra `alert('La generación de boletines está en desarrollo')`.

**⚠️ NOTA**: La funcionalidad REAL de boletines está en `ReportCards.tsx` (página independiente), NO aquí.

---

## Categoría 6: Alertas y Estadísticas

**Archivo frontend**: `AlertsReports.tsx`
**Feature flag padre**: `RPT_STAT`
**Color**: Rojo
**Total**: 3 sub-reportes (2 funcionales, 1 placeholder)

### Reporte 6.1: Bajo Rendimiento (`alert-low-performance`) ✅ FUNCIONAL

**Feature**: `RPT_ALERT_LOW`
**Descripción**: Estudiantes con promedio inferior a 3.5 o materias perdidas.

**Fuente de datos**:
1. `teacherAssignmentsApi.getAll({ academicYearId })` → obtiene grupos
2. `periodFinalGradesApi.getByGroup(groupId, termId)` → para cada grupo

**Lógica frontend**:
1. Itera por cada grupo, obtiene notas
2. Agrupa por estudiante, calcula promedio y materias perdidas
3. Filtra: `avg < 3.5 || failedCount > 0`
4. Clasifica riesgo: `avg < 3.0 || failedCount >= 2 → 'Alto'`, sino `'Medio'`

| # | Columna | Campo | Formato | Color |
|---|---------|-------|---------|-------|
| 1 | Nro | índice | número | — |
| 2 | Estudiante | `name` | MAYÚSCULAS | font-medium |
| 3 | Grupo | `group` | texto | — |
| 4 | Promedio | `avg` | decimal 1 | rojo si <3.0 |
| 5 | Materias Perdidas | `failed` | número | rojo si >0, verde si 0 |
| 6 | Nivel de Riesgo | `risk` | badge | Alto=rojo, Medio=ámbar |

**Resumen al final**: Total estudiantes, Riesgo alto, Riesgo medio.

**Filtros**: Año (obligatorio), Período (obligatorio), Grupo.

**CSV**: `Nro,Estudiante,Grupo,Promedio,Materias Perdidas,Nivel de Riesgo`

---

### Reporte 6.2: Riesgo de Reprobación (`alert-fail-risk`) ✅ FUNCIONAL

**Feature**: `RPT_ALERT_FAIL`
**Descripción**: Estudiantes con 2+ materias perdidas.

**Lógica**: Misma que Bajo Rendimiento pero filtra `failedCount >= 2`.
**Tabla**: Misma que Bajo Rendimiento.

---

### Reporte 6.3: Alertas de Asistencia (`alert-attendance`) ❌ PLACEHOLDER

**Feature**: `RPT_ALERT_ATT`
**Estado**: No tiene lógica de carga. Muestra "Seleccione filtros...".

---

## Página Especial: Boletines (`ReportCards.tsx`)

**Ruta**: `/report-cards`
**Esta es la página FUNCIONAL de boletines** (no confundir con `BulletinsReports.tsx` que es placeholder).

### Funcionalidades

1. **Lista de estudiantes** con resumen de notas
2. **Preview de boletín** individual
3. **Configuración de boletín** (modal de config)
4. **Descarga masiva** de PDFs

### Flujo

```
1. Seleccionar Año → Período → Grupo
2. Se carga lista de estudiantes con: promedio, aprobadas, reprobadas, puesto
3. Click en "Ver" → Preview del boletín con datos completos
4. Click en "Descargar" → PDF generado por backend
```

### Backend: `ReportsService.getGroupReportCardList()`

**Lógica** (PESADA):
1. Obtiene todas las matrículas del grupo
2. **Para CADA estudiante** llama `getReportCardData()` que:
   - Obtiene estructura de asignaturas (snapshot o calculada)
   - Para CADA asignatura: calcula nota del período (`calculateTermGrade`)
   - Para CADA nota: obtiene nivel de desempeño (`getPerformanceLevel`)
   - Obtiene resumen de asistencia
   - Obtiene observaciones
   - Obtiene logros
3. Calcula ranking

**⚠️ RENDIMIENTO CRÍTICO**: Para un grupo de 30 estudiantes con 10 asignaturas = ~300+ queries a la DB.

### Backend: `ReportsService.getReportCardData()`

**Datos que retorna**:
```typescript
{
  institution: { id, name, nit }
  academicYear: { id, year, name }
  term: { id, name, type }
  student: { id, firstName, lastName, documentType, documentNumber }
  group: { id, name, gradeLevel }
  areaGrades: [{
    area, areaCode, weightPercentage, calculationType,
    areaAverage, areaPerformanceLevel,
    subjects: [{
      subject, subjectCode, teacher, grade,
      weightPercentage, performanceLevel, components,
      achievement, achievementObservation, judgment
    }]
  }]
  subjectGrades: [{ subject, grade, performanceLevel, teacher, achievement, judgment }]
  structureSource: 'snapshot' | 'calculated'
  attendance: { total, present, absent, late, excused, attendanceRate }
  achievements: [{ subject, orderNumber, description, performanceLevel, observation, judgment }]
  observations: [{ date, type, category, description, author }]
  generatedAt: Date
}
```

### Configuración de Boletín (`ReportCardConfig`)

```prisma
model ReportCardConfig {
  institutionId       String   @unique
  showLogo            Boolean  @default(true)
  showShield          Boolean  @default(false)
  headerResolution    String?
  headerMunicipality  String?
  headerDepartment    String?
  evaluationType      String   @default("NUMERIC")    // NUMERIC, QUALITATIVE, MIXED
  showNumericGrade    Boolean  @default(true)
  showPerformanceLevel Boolean @default(true)
  showAchievements    Boolean  @default(true)
  showRecommendations Boolean  @default(true)
  showMotivationalMsg Boolean  @default(true)
  motivationalMsgType String   @default("AUTO")       // AUTO, CUSTOM, NONE
  customMotivationalTpl String?
  showAttendance      Boolean  @default(true)
  showRanking         Boolean  @default(true)
  showObservations    Boolean  @default(true)
  showAreaAverages    Boolean  @default(true)
  showGeneralAverage  Boolean  @default(true)
  showScale           Boolean  @default(true)
  showRecoveryGrades  Boolean  @default(true)
  showComponents      Boolean  @default(false)
  signatureConfig     Json     @default("[]")
}
```

### Generación de PDF (`generateReportCardPdf`)

- Usa `pdfkit` (librería Node.js)
- Genera PDF tamaño LETTER con márgenes de 50
- Contenido: Header institucional → Info estudiante → Tabla de notas → Asistencia → Logros → Observaciones
- **Limitación**: PDF básico sin diseño elaborado, sin logo, sin colores

---

## Tablas de Base de Datos

### Tablas principales usadas por reportes

| Tabla | Campos clave | Usada por |
|-------|-------------|-----------|
| `AttendanceRecord` | `studentEnrollmentId`, `teacherAssignmentId`, `date`, `status` (PRESENT/ABSENT/LATE/EXCUSED) | Asistencia (6 reportes) |
| `TeacherAssignment` | `teacherId`, `subjectId`, `groupId`, `academicYearId`, `weeklyHours` | Admin (4), Académico (3), Alertas (2) |
| `PeriodFinalGrade` | `studentEnrollmentId`, `academicTermId`, `subjectId`, `finalScore` | Académico (2), Alertas (2) |
| `StudentEnrollment` | `studentId`, `groupId`, `academicYearId`, `status` | Todos los reportes |
| `Student` | `firstName`, `lastName`, `documentNumber` | Todos los reportes |
| `Group` | `name`, `gradeId` | Todos los reportes |
| `Grade` | `name` | Todos los reportes |
| `Subject` | `name` | Asistencia, Académico |
| `User` (Teacher) | `firstName`, `lastName` | Asistencia, Admin |
| `AcademicYear` | `year`, `status`, `institutionId` | Todos los reportes |
| `AcademicTerm` | `name`, `type`, `weightPercentage`, `startDate`, `endDate` | Académico, Boletines |
| `PartialGrade` | `studentEnrollmentId`, `teacherAssignmentId`, `academicTermId`, `componentType`, `score` | Boletines (cálculo de notas) |
| `EvaluativeActivity` | `teacherAssignmentId`, `academicTermId`, `componentType`, `weight` | Boletines (cálculo de notas) |
| `PerformanceScale` | `institutionId`, `level`, `minScore`, `maxScore` | Boletines, Académico |
| `FinalComponent` | `academicYearId`, `name`, `weightPercentage` | Nota mínima |
| `FinalComponentGrade` | `studentEnrollmentId`, `teacherAssignmentId`, `finalComponentId`, `grade` | Nota mínima |
| `ReportCardConfig` | `institutionId`, 20+ campos de configuración | Boletines |
| `StudentAchievement` | `studentEnrollmentId`, `achievement.academicTermId` | Boletines |
| `EnrollmentSubject` | `enrollmentId`, `subjectId`, `subjectName` (snapshot) | Boletines |

### Relaciones clave

```
Student ──1:N──> StudentEnrollment ──N:1──> Group ──N:1──> Grade
                       │
                       ├──1:N──> AttendanceRecord ──N:1──> TeacherAssignment
                       ├──1:N──> PeriodFinalGrade
                       ├──1:N──> PartialGrade
                       ├──1:N──> StudentAchievement
                       └──1:N──> EnrollmentSubject (snapshot)

TeacherAssignment ──N:1──> User (teacher)
                  ──N:1──> Subject
                  ──N:1──> Group
                  ──N:1──> AcademicYear

AcademicYear ──1:N──> AcademicTerm
             ──1:N──> FinalComponent
```

---

## Problemas de Rendimiento Detectados

### 🔴 Crítico: N+1 Queries en Asistencia por Grupo

**Archivo**: `attendance.service.ts` → `getReportByGroup()`
**Problema**: Para cada estudiante del grupo, hace una query individual a `AttendanceRecord`.
```
1 query: obtener enrollments del grupo
N queries: 1 por cada estudiante para obtener sus registros
Total: N+1 queries (30 estudiantes = 31 queries)
```
**Solución**: Usar una sola query con `groupBy` o cargar todos los registros del grupo de una vez.

### 🔴 Crítico: N+1 Queries en Consolidado Institucional

**Archivo**: `attendance.service.ts` → `getConsolidatedReport()`
**Problema**: Itera por cada grupo Y por cada asignatura haciendo queries individuales.
```
G queries: 1 por cada grupo
S queries: 1 por cada asignatura
Total: G + S queries
```
**Solución**: Usar `groupBy` de Prisma para agregar en una sola query.

### 🔴 Crítico: Loop Secuencial en Frontend (Todos los Grupos)

**Archivo**: `AttendanceReports.tsx`, `AcademicReports.tsx`, `AlertsReports.tsx`
**Problema**: Cuando se selecciona "Todos los grupos", el frontend hace un `for` loop llamando al API por cada grupo secuencialmente.
```javascript
for (const group of allGroups) {
  const response = await attendanceApi.getReportByGroup(group.id, ...)
  // Espera a que termine antes de llamar al siguiente
}
```
**Solución**: Crear endpoint backend que devuelva datos de todos los grupos en una sola llamada, o al menos usar `Promise.all` para paralelizar.

### 🔴 Crítico: Boletines — Cascada de Queries

**Archivo**: `reports.service.ts` → `getGroupReportCardList()`
**Problema**: Para cada estudiante llama `getReportCardData()` que internamente hace:
- 1 query por matrícula
- 1 query por estructura de asignaturas
- N queries por `calculateTermGrade` (1 por asignatura)
- N queries por `getPerformanceLevel` (1 por asignatura)
- 1 query por asistencia
- 1 query por observaciones
- 1 query por logros

Para 30 estudiantes × 10 asignaturas = **~300-400 queries**.

**Solución**: Batch queries — cargar todas las notas del grupo de una vez, todos los logros de una vez, etc.

### 🟡 Medio: Cumplimiento Docente — Estimación Imprecisa

**Archivo**: `attendance.service.ts` → `getTeacherComplianceReport()`
**Problema**: Las "clases programadas" se estiman como `semanas_en_rango` (1 clase por semana). No usa datos reales del horario.
**Solución**: Integrar con módulo de Timetabling para obtener clases realmente programadas.

### 🟡 Medio: Alertas — Loop por Grupo

**Archivo**: `AlertsReports.tsx`
**Problema**: Para bajo rendimiento, itera por cada grupo obteniendo notas secuencialmente.
**Solución**: Endpoint backend que devuelva alertas pre-calculadas.

---

## Resumen de Estado por Categoría

| Categoría | Total | Funcionales | Placeholder | % Completado |
|-----------|-------|-------------|-------------|-------------|
| Administración | 8 | 4 | 4 | 50% |
| Académico | 14 | 3 | 11 | 21% |
| Evaluación SIEE | 6 | 0 | 6 | 0% |
| Asistencia | 6 | 6 | 0 | 100% |
| Boletines (BulletinsReports) | 5 | 0 | 5 | 0% |
| Alertas | 3 | 2 | 1 | 67% |
| **Boletines (ReportCards.tsx)** | **1** | **1** | **0** | **100%** |
| **TOTAL** | **43** | **16** | **27** | **37%** |

### Reportes funcionales (16):
1. ✅ Carga docente
2. ✅ Carga por grupo
3. ✅ Docentes activos
4. ✅ Docentes sin carga
5. ✅ Consolidado por asignaturas
6. ✅ Promedio por grupo
7. ✅ Nota mínima requerida
8. ✅ Asistencia por grupo
9. ✅ Asistencia por estudiante
10. ✅ Asistencia por asignatura
11. ✅ Asistencia por docente
12. ✅ Inasistencias críticas
13. ✅ Consolidado institucional
14. ✅ Bajo rendimiento
15. ✅ Riesgo de reprobación
16. ✅ Boletines (ReportCards.tsx con preview + PDF)
