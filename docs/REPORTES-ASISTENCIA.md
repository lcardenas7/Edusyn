# Reportes de Asistencia — Edusyn

## Resumen General

El módulo de **Reportes de Asistencia** contiene **6 sub-reportes** que consultan la tabla `AttendanceRecord` y tablas relacionadas. Todos comparten la misma página frontend (`AttendanceReports.tsx`) y el mismo servicio backend (`attendance.service.ts`).

---

## Tabla Principal: `AttendanceRecord`

```prisma
model AttendanceRecord {
  id                  String           @id @default(cuid())
  institutionId       String
  teacherAssignmentId String
  studentEnrollmentId String
  date                DateTime         @db.Date
  status              AttendanceStatus // PRESENT | ABSENT | LATE | EXCUSED
  observations        String?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  institution       Institution       @relation(fields: [institutionId], references: [id])
  teacherAssignment TeacherAssignment @relation(fields: [teacherAssignmentId], references: [id])
  studentEnrollment StudentEnrollment @relation(fields: [studentEnrollmentId], references: [id])

  @@unique([teacherAssignmentId, studentEnrollmentId, date])
}

enum AttendanceStatus {
  PRESENT   // Presente
  ABSENT    // Ausente
  LATE      // Tarde
  EXCUSED   // Excusa justificada
}
```

### Tablas Relacionadas

| Tabla | Relación | Campos relevantes |
|-------|----------|-------------------|
| `StudentEnrollment` | `studentEnrollmentId` → enrolla un estudiante en un grupo y año | `id`, `studentId`, `groupId`, `academicYearId`, `status` |
| `Student` | vía `StudentEnrollment.student` | `id`, `firstName`, `lastName`, `documentNumber` |
| `Group` | vía `StudentEnrollment.group` | `id`, `name`, `gradeId` |
| `Grade` | vía `Group.grade` | `id`, `name` (ej: "Sexto", "Séptimo") |
| `TeacherAssignment` | `teacherAssignmentId` → asigna un docente a una asignatura en un grupo | `id`, `teacherId`, `subjectId`, `groupId`, `academicYearId` |
| `Teacher` (User) | vía `TeacherAssignment.teacher` | `id`, `firstName`, `lastName` |
| `Subject` | vía `TeacherAssignment.subject` | `id`, `name` |
| `AcademicYear` | vía `StudentEnrollment.academicYearId` | `id`, `year`, `status` |

---

## Reporte 1: Asistencia por Grupo (`att-group`)

### Propósito
Estado general de asistencia de todos los estudiantes de un grupo o curso.

### Feature Flag
`RPT_ATT_GROUP`

### Backend
- **Método**: `AttendanceService.getReportByGroup(groupId, academicYearId, params?)`
- **Endpoint**: `GET /attendance/report/group/:groupId/:academicYearId`

### Lógica del Backend
1. Busca todos los `StudentEnrollment` activos del grupo y año
2. Para cada estudiante, consulta todos sus `AttendanceRecord`
3. Cuenta: PRESENT, ABSENT, LATE, EXCUSED
4. Calcula `attendanceRate = ((present + late + excused) / total) * 100`
5. Asigna estado: `Normal` (≥85%), `Alerta` (70-84%), `Riesgo` (<70%)

### Filtros del Frontend
| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Año | select | Año académico (obligatorio) |
| Grupo | select | Grupo específico o "Todos los grupos" |
| Asignatura | select | Filtrar por asignatura específica |
| Estado | select | Normal / Alerta / Riesgo / Todos |
| Fecha Desde | date | Rango de fechas (opcional) |
| Fecha Hasta | date | Rango de fechas (opcional) |
| Buscar estudiante | text | Filtro por nombre en frontend |

### Columnas de la Tabla

| # | Columna | Campo | Formato | Color |
|---|---------|-------|---------|-------|
| 1 | **Nro** | índice | número | — |
| 2 | **Estudiante** | `studentName` | `NOMBRE APELLIDO` | font-medium |
| 3 | **Grupo** | `groupName` | `Sexto 6A` | — |
| 4 | **Total** | `totalClasses` | número | — |
| 5 | **Asist.** | `present` (attended) | número | verde (`text-green-600`) |
| 6 | **Fallas** | `absent` | número | rojo (`text-red-600`) |
| 7 | **Tardanzas** | `late` | número | ámbar (`text-amber-600`) |
| 8 | **Excusas** | `excused` | número | azul (`text-blue-600`) |
| 9 | **%** | `attendanceRate` (pct) | `XX%` | font-medium |
| 10 | **Estado** | `status` | badge | Normal=verde, Alerta=ámbar, Riesgo=rojo |

### Exportación CSV
```
Nro,Estudiante,Grupo,Total Clases,Asistencias,Fallas,Tardanzas,Excusas,% Asist.,Estado
1,"HEILYN ALVAREZ","Sexto 6A",0,0,0,0,0,100%,Normal
```

---

## Reporte 2: Asistencia por Estudiante (`att-student`)

### Propósito
Seguimiento individual detallado de asistencia — registro por registro (fecha, asignatura, estado).

### Feature Flag
`RPT_ATT_STUDENT`

### Backend
- **Método**: `AttendanceService.getDetailedReport(params)`
- **Endpoint**: `GET /attendance/report/detailed`

### Lógica del Backend
1. Consulta `AttendanceRecord` con filtros (grupo, estudiante, fechas, asignatura, estado)
2. Incluye relaciones: `studentEnrollment.student`, `studentEnrollment.group.grade`, `teacherAssignment.subject`, `teacherAssignment.teacher`
3. Ordena por fecha DESC, apellido ASC
4. Límite: 1000 registros

### Filtros del Frontend
| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Año | select | Año académico (obligatorio) |
| Grupo | select | Grupo específico o todos |
| Estudiante | select | Estudiante específico o todos |
| Estado | select | PRESENT / ABSENT / LATE / EXCUSED / Todos |
| Fecha Desde | date | Rango de fechas |
| Fecha Hasta | date | Rango de fechas |
| Asignatura | select | Filtrar por asignatura |

### Columnas de la Tabla

| # | Columna | Campo | Formato | Color |
|---|---------|-------|---------|-------|
| 1 | **Nro** | índice | número | — |
| 2 | **Fecha** | `date` | `dd/mm/aaaa` (es-CO) | — |
| 3 | **Estudiante** | `studentName` | texto | font-medium |
| 4 | **Grupo** | `groupName` | texto | — |
| 5 | **Asignatura** | `subjectName` | texto | — |
| 6 | **Docente** | `teacherName` | texto | — |
| 7 | **Estado** | `status` | badge | PRESENT=verde, ABSENT=rojo, LATE=ámbar, EXCUSED=azul |
| 8 | **Observación** | `observations` | texto | gris (`text-slate-500`) |

### Exportación CSV
```
Nro,Fecha,Estudiante,Grupo,Asignatura,Docente,Estado,Observación
1,"12/02/2026","HEILYN ALVAREZ","Sexto 6A","Matemáticas","JUAN PEREZ",Presente,""
```

---

## Reporte 3: Asistencia por Asignatura (`att-subject`)

### Propósito
Analizar el comportamiento de asistencia filtrado por materia específica.

### Feature Flag
`RPT_ATT_SUBJECT`

### Backend
- **Método**: Reutiliza `AttendanceService.getReportByGroup()` con filtro `subjectId`
- **Endpoint**: `GET /attendance/report/group/:groupId/:academicYearId?subjectId=xxx`

### Lógica del Backend
Misma lógica que Reporte 1, pero filtrando por `teacherAssignment.subjectId`.

### Filtros del Frontend
Mismos que Reporte 1 (Año, Grupo, Asignatura, Estado, Fechas, Buscar estudiante).

### Columnas de la Tabla

| # | Columna | Campo | Formato | Color |
|---|---------|-------|---------|-------|
| 1 | **Nro** | índice | número | — |
| 2 | **Estudiante** | `name` | texto | font-medium |
| 3 | **Grupo** | `group` | texto | — |
| 4 | **Total Clases** | `totalClasses` | número | — |
| 5 | **Asistencias** | `attended` | número | — |
| 6 | **Fallas** | `absent` | número | — |
| 7 | **% Asist.** | `pct` | `XX%` | — |
| 8 | **Estado** | `status` | badge | Normal=verde, Alerta=ámbar, Riesgo=rojo |

### Exportación CSV
```
Nro,Estudiante,Grupo,Total Clases,Asistencias,Fallas,% Asist.,Estado
```

---

## Reporte 4: Asistencia por Docente (`att-teacher`)

### Propósito
Control institucional del registro de clases por parte de los docentes (cumplimiento).

### Feature Flag
`RPT_ATT_TEACHER`

### Backend
- **Método**: `AttendanceService.getTeacherComplianceReport(params)`
- **Endpoint**: `GET /attendance/report/teacher-compliance`

### Lógica del Backend
1. Obtiene todas las `TeacherAssignment` del año (filtradas por docente/grupo/asignatura si aplica)
2. Para cada asignación, cuenta días únicos con registros de asistencia (`distinct: ['date']`)
3. Estima clases programadas: `semanas_en_rango` (default: 20 si no hay rango de fechas)
4. Calcula `complianceRate = (classesRegistered / classesScheduled) * 100`
5. Agrupa resultados por docente (suma todas sus asignaciones)

### Filtros del Frontend
| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Año | select | Año académico (obligatorio) |
| Docente | select | Docente específico o todos |
| Fecha Desde | date | Rango de fechas |
| Fecha Hasta | date | Rango de fechas |

### Columnas de la Tabla

| # | Columna | Campo | Formato | Color |
|---|---------|-------|---------|-------|
| 1 | **Nro** | índice | número | — |
| 2 | **Docente** | `teacherName` | texto | font-medium |
| 3 | **Clases Programadas** | `classesScheduled` | número | — |
| 4 | **Clases Registradas** | `classesRegistered` | número | verde (`text-green-600`) |
| 5 | **Sin Registrar** | `classesNotRegistered` | número | rojo (`text-red-600`) |
| 6 | **% Cumplimiento** | `complianceRate` | `XX%` | font-medium |

### Exportación CSV
```
Nro,Docente,Clases Programadas,Clases Registradas,Clases NO Registradas,% Cumplimiento
```

---

## Reporte 5: Inasistencias Críticas (`att-critical`)

### Propósito
Detectar estudiantes en riesgo por alta inasistencia (por debajo de un umbral configurable).

### Feature Flag
`RPT_ATT_CRITICAL`

### Backend
- **Método**: Reutiliza `AttendanceService.getReportByGroup()` — el filtrado por umbral se hace en el frontend
- **Endpoint**: `GET /attendance/report/group/:groupId/:academicYearId`

### Lógica del Frontend
1. Obtiene datos de `getReportByGroup` (igual que Reporte 1)
2. Filtra: solo estudiantes con `pct < filterMinPercent` (default: 80%)
3. Ordena por porcentaje ascendente (peores primero)

### Filtros del Frontend
| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Año | select | Año académico (obligatorio) |
| Grupo | select | Grupo específico o todos |
| % Mínimo | number | Umbral de asistencia (default: 80) |
| Estado | select | Alerta / Riesgo / Todos |

### Columnas de la Tabla

| # | Columna | Campo | Formato | Color |
|---|---------|-------|---------|-------|
| 1 | **Nro** | índice | número | — |
| 2 | **Estudiante** | `name` | texto | font-medium |
| 3 | **Grupo** | `group` | texto | — |
| 4 | **Total Clases** | `totalClasses` | número | — |
| 5 | **Fallas** | `absent` | número | rojo (`text-red-600`) |
| 6 | **% Asist.** | `pct` | `XX%` | font-medium |
| 7 | **Estado** | `status` | badge | Alerta=ámbar, Riesgo=rojo |

### Exportación CSV
```
Nro,Estudiante,Grupo,Total Clases,Fallas,% Asist.,Estado
```

---

## Reporte 6: Consolidado Institucional (`att-consolidated`)

### Propósito
Datos macro para informes oficiales — asistencia agrupada por grado y por asignatura.

### Feature Flag
`RPT_ATT_CONSOLIDATED`

### Backend
- **Método**: `AttendanceService.getConsolidatedReport(params)`
- **Endpoint**: `GET /attendance/report/consolidated`

### Lógica del Backend
1. Obtiene todos los grupos del año académico (vía `StudentEnrollment.distinct groupId`)
2. **Por Grado**: Para cada grupo, consulta todos los `AttendanceRecord`, agrupa por `grade.name`, suma totales
3. **Por Asignatura**: Para cada `Subject`, consulta `AttendanceRecord` donde `teacherAssignment.subjectId = subject.id`
4. Calcula `attendanceRate` para cada agrupación

### Filtros del Frontend
| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Año | select | Año académico (obligatorio) |
| Fecha Desde | date | Rango de fechas |
| Fecha Hasta | date | Rango de fechas |

### Sub-tabla A: Asistencia por Grado

| # | Columna | Campo | Formato |
|---|---------|-------|---------|
| 1 | **Nro** | índice | número |
| 2 | **Grado** | `grade` (name) | texto |
| 3 | **Estudiantes** | `totalStudents` | número |
| 4 | **Total Registros** | `totalClasses` (total) | número |
| 5 | **Presentes** | `totalAttended` (present) | número |
| 6 | **Ausentes** | `totalAbsent` (absent) | número |
| 7 | **% Asist.** | `pct` (attendanceRate) | `XX%` |

### Sub-tabla B: Asistencia por Asignatura

| # | Columna | Campo | Formato |
|---|---------|-------|---------|
| 1 | **Nro** | índice | número |
| 2 | **Asignatura** | `subject` (name) | texto |
| 3 | **Total Registros** | `totalClasses` (total) | número |
| 4 | **Presentes** | `totalAttended` (present) | número |
| 5 | **Ausentes** | `totalAbsent` (absent) | número |
| 6 | **% Asist.** | `pct` (attendanceRate) | `XX%` |

### Exportación CSV
```
ASISTENCIA POR GRADO
Nro,Grado,Estudiantes,Total Registros,Presentes,Ausentes,% Asistencia

ASISTENCIA POR ASIGNATURA
Nro,Asignatura,Total Registros,Presentes,Ausentes,% Asistencia
```

---

## Archivos del Código Fuente

### Backend
| Archivo | Descripción |
|---------|-------------|
| `apps/api/src/modules/attendance/attendance.service.ts` | Lógica de negocio: `getReportByGroup`, `getDetailedReport`, `getTeacherComplianceReport`, `getConsolidatedReport` |
| `apps/api/src/modules/attendance/attendance.controller.ts` | Endpoints REST |
| `apps/api/prisma/schema.prisma` | Modelo `AttendanceRecord` (línea ~1676) |

### Frontend
| Archivo | Descripción |
|---------|-------------|
| `apps/web/src/pages/reports/AttendanceReports.tsx` | Página principal con los 6 sub-reportes, filtros, tablas y exportación CSV |
| `apps/web/src/pages/reports/ReportsHub.tsx` | Hub central de reportes (categoría "Asistencia" con 6 reportes) |
| `apps/web/src/hooks/useReportsData.ts` | Hook compartido para cargar años, períodos, grupos, asignaturas, docentes, estudiantes |
| `apps/web/src/lib/api.ts` | Funciones API: `attendanceApi.getReportByGroup()`, `.getDetailedReport()`, `.getTeacherComplianceReport()`, `.getConsolidatedReport()` |

---

## Nota sobre Rendimiento

Los reportes pueden ser lentos porque:
1. **Reporte por grupo** hace N+1 queries: 1 para obtener enrollments + 1 query por cada estudiante
2. **Consolidado** itera por cada grupo y cada asignatura haciendo queries individuales
3. **"Todos los grupos"** en el frontend hace un loop llamando al API por cada grupo secuencialmente

### Posibles optimizaciones:
- Usar `groupBy` de Prisma en vez de N+1 queries
- Agregar un endpoint que devuelva datos de todos los grupos en una sola llamada
- Cachear resultados de reportes que no cambian frecuentemente
