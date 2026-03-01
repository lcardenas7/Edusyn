# DOCUMENTO TÉCNICO DE AUDITORÍA ESTRUCTURAL — EDUSYN
## Sistema de Gestión Académica en Producción

**Fecha:** 2026-02-28
**Stack:** NestJS (API) + React/Vite (Web) + PostgreSQL (Railway) + Cloudflare R2
**Estado:** Producción activa con usuarios reales
**Propósito:** Auditoría estructural profunda para identificar riesgos de pérdida de datos y errores críticos

---

# 1. ARQUITECTURA GENERAL

## 1.1 Tipo de Arquitectura

**Monolito modular** organizado en un monorepo con dos aplicaciones principales:

```
Edusyn/
├── apps/
│   ├── api/          ← Backend NestJS (monolito modular)
│   └── web/          ← Frontend React + Vite (SPA)
├── packages/         ← (vacío — sin paquetes compartidos)
├── scripts/          ← Scripts de utilidad
├── docs/             ← Documentación
└── infra/            ← Infraestructura
```

## 1.2 Organización Backend (`apps/api/src/`)

```
src/
├── app.module.ts          ← Módulo raíz (registra 27 módulos)
├── main.ts                ← Bootstrap NestJS
├── common/                ← Interceptores (TenantContextInterceptor)
├── engines/               ← Motores de cálculo (10 archivos)
├── prisma/                ← PrismaService (singleton)
└── modules/               ← 29 módulos de dominio (263 archivos)
    ├── academic/          ← Gestión académica (55 archivos) ★ CORE
    ├── achievements/      ← Logros y juicios valorativos
    ├── apd/               ← Acompañamiento pedagógico diferencial
    ├── attendance/        ← Asistencia (regular + tutoría)
    ├── auth/              ← Autenticación JWT
    ├── capabilities/      ← Capabilities por rol
    ├── classroom/         ← Aula virtual (quiz/exam/forum)
    ├── communications/    ← Mensajería
    ├── dashboard/         ← Dashboard y analytics
    ├── documents/         ← Documentos institucionales
    ├── elections/         ← Elecciones escolares
    ├── evaluation/        ← Evaluación (notas parciales/finales) ★ CORE
    ├── finance/           ← Módulo financiero completo
    ├── iam/               ← Gestión de usuarios/roles
    ├── institution-config/← Configuración institucional
    ├── institution-context/← Contexto multi-tenant
    ├── management-tasks/  ← Tareas de gestión docente
    ├── men-reports/       ← Reportes MEN Colombia
    ├── observer/          ← Observador del estudiante
    ├── payments/          ← Pagos simples (eventos)
    ├── pedagogical-support/← Acompañamiento pedagógico
    ├── performance/       ← Desempeños
    ├── permissions/       ← Permisos granulares
    ├── recovery/          ← Recuperaciones académicas
    ├── reports/           ← Boletines y reportes
    ├── storage/           ← Cloudflare R2
    ├── superadmin/        ← Administración del sistema
    ├── teacher-workspace/ ← Espacio privado del docente
    └── timetabling/       ← Horarios escolares
```

## 1.3 Organización Frontend (`apps/web/src/`)

```
src/
├── App.tsx              ← Router principal
├── main.tsx             ← Entry point
├── index.css            ← Tailwind + variables CSS
├── components/          ← Componentes reutilizables (30 items)
│   ├── Layout.tsx       ← Layout global (sidebar, header)
│   └── workspace/       ← Componentes del Teacher Workspace
├── contexts/            ← React Contexts (Auth, etc.)
├── engines/             ← Motores de cálculo frontend
├── hooks/               ← Custom hooks
├── lib/                 ← Utilidades (API client)
├── pages/               ← Páginas (78 items) — archivos grandes monolíticos
└── utils/               ← Utilidades generales
```

## 1.4 Separación por Dominios

| Dominio | Backend Module | Frontend Page | Acoplamiento |
|---------|---------------|---------------|-------------|
| Académico core | `academic/` (55 files) | Múltiples páginas | Alto — módulo más grande |
| Evaluación | `evaluation/` (32 files) | Integrado en páginas académicas | Alto con `academic/` |
| Aula Virtual | `classroom/` (3 files) | `Classroom.tsx` (2787 líneas) | Autónomo |
| Observador | `observer/` (4 files) | Página dedicada | Bajo |
| Finanzas | `finance/` (33 files) | Múltiples páginas | Autónomo |
| Horarios | `timetabling/` (21 files) | Página dedicada | Medio |
| Teacher Workspace | `teacher-workspace/` (4 files) | `TeacherWorkspace.tsx` + componentes | Autónomo |

## 1.5 Dependencias Cruzadas entre Módulos

```
academic/ ←→ evaluation/    : Comparten TeacherAssignment, StudentEnrollment, AcademicTerm
academic/ ←→ attendance/    : Comparten TeacherAssignment, StudentEnrollment
academic/ ←→ recovery/      : Comparten StudentEnrollment, Subject, AcademicTerm
academic/ ←→ performance/   : Comparten TeacherAssignment, AcademicTerm
academic/ ←→ achievements/  : Comparten TeacherAssignment, AcademicTerm
evaluation/ → recovery/     : PeriodFinalGrade genera PeriodRecovery
classroom/ → academic/      : Classroom → TeacherAssignment (1:1)
reports/ → evaluation/ + academic/ + attendance/ : Lee datos de múltiples dominios
```

**⚠️ Riesgo:** El módulo `academic/` (55 archivos) es el hub central. Cualquier cambio estructural en `TeacherAssignment`, `StudentEnrollment`, o `AcademicTerm` impacta **todos** los módulos dependientes.

## 1.6 Servicios Compartidos

- **PrismaService** — Singleton global, inyectado en todos los módulos
- **StorageService** — Servicio de Cloudflare R2 (subida, descarga, eliminación)
- **TenantContextInterceptor** — Interceptor global que resuelve `institutionId` del JWT
- **ThrottlerGuard** — Rate limiting global (100 req/60s)

---

# 2. MODELO COMPLETO DE BASE DE DATOS (PostgreSQL)

## 2.1 Resumen de Tablas

El schema Prisma define **~95 modelos** y **~50 enums**. A continuación el catálogo completo:

### 2.1.1 CORE — Identidad y Multi-Tenancy

| Modelo | Propósito | PK | Soft Delete | ON DELETE CASCADE desde |
|--------|-----------|------|-------------|------------------------|
| `User` | Usuario del sistema | `id` (cuid) | `isActive` (campo) | — |
| `Role` | Roles del sistema | `id` (cuid) | No | — |
| `UserRole` | Relación M:N User↔Role | `[userId, roleId]` | No | User, Role |
| `Institution` | Institución educativa | `id` (cuid) | `status` (campo) | — |
| `InstitutionModule` | Módulos habilitados por institución | `id` (cuid) | No | Institution |
| `InstitutionUser` | Relación User↔Institution | `id` (cuid) | No | User, Institution |

### 2.1.2 ESTRUCTURA ACADÉMICA

| Modelo | Propósito | PK | ON DELETE | Cascades FROM |
|--------|-----------|------|-----------|---------------|
| `Campus` | Sede | `id` (cuid) | CASCADE | Institution |
| `Shift` | Jornada | `id` (cuid) | CASCADE | Campus |
| `Grade` | Grado (11°, 10°, etc.) | `id` (cuid) | — | Unique [stage, name] |
| `Group` | Grupo/Curso (11A, 10B) | `id` (cuid) | **Restrict** from Campus/Shift/Grade | Director/Companion: **SetNull** |
| `Area` | Área académica (catálogo) | `id` (cuid) | CASCADE | Institution |
| `Subject` | Asignatura (catálogo) | `id` (cuid) | CASCADE | Area |

### 2.1.3 PLANTILLAS ACADÉMICAS (Historial por Año)

| Modelo | Propósito | ON DELETE CASCADE desde |
|--------|-----------|------------------------|
| `AcademicTemplate` | Plantilla académica por año | Institution, AcademicYear |
| `TemplateArea` | Área dentro de plantilla | AcademicTemplate, Area |
| `TemplateSubject` | Asignatura dentro de plantilla | TemplateArea, Subject |
| `GradeTemplate` | Asignación plantilla→grado por año | Grade, AcademicTemplate, AcademicYear |
| `GroupSubjectException` | Excepción de asignatura por grupo | Group, Subject, AcademicYear |
| `Dimension` | Dimensiones preescolar (global) | — |
| `TemplateDimension` | Dimensión en plantilla | AcademicTemplate, Dimension |

### 2.1.4 AÑO LECTIVO Y PERÍODOS

| Modelo | Propósito | ON DELETE CASCADE desde |
|--------|-----------|------------------------|
| `AcademicYear` | Año lectivo | Institution |
| `AcademicCalendar` | Calendario académico | AcademicYear |
| `Period` | Período de fechas | AcademicYear |
| `AcademicTerm` | Período evaluativo (con ponderación) | AcademicYear |
| `GradingPeriodConfig` | Ventana de calificaciones | AcademicTerm |
| `RecoveryPeriodConfig` | Ventana de recuperaciones | AcademicTerm |

### 2.1.5 CARGA ACADÉMICA (TeacherAssignment) ★ CRÍTICO

| Modelo | Propósito | PK | FK | ON DELETE |
|--------|-----------|----|----|-----------|
| `TeacherAssignment` | Asignación docente↔grupo↔asignatura↔año | `id` (cuid) | `institutionId`, `academicYearId`, `groupId`, `subjectId`, `teacherId` | **CASCADE** desde AcademicYear, Group, Subject, Teacher(User) |

**⚠️ RIESGO CRÍTICO:** `TeacherAssignment` tiene `onDelete: Cascade` desde **4 entidades padre**. Si se elimina un AcademicYear, Group, Subject o User(teacher), se eliminan TODAS las asignaciones en cascada. Y desde TeacherAssignment en cascada se eliminan:

```
TeacherAssignment (CASCADE) →
  ├── EvaluativeActivity (CASCADE) → StudentGrade (CASCADE)
  ├── EvaluationPlan (CASCADE) → EvaluationPlanComponentWeight (CASCADE)
  ├── PreventiveAlert (CASCADE)
  ├── AttendanceRecord (CASCADE)
  ├── SubjectPerformance (CASCADE)
  ├── PartialGrade (CASCADE)
  ├── Achievement (CASCADE) → StudentAchievement (CASCADE), AttitudinalAchievement (CASCADE)
  ├── FinalComponentGrade (CASCADE)
  └── Classroom (1:1 relation)
```

**Esto significa: eliminar una Subject del catálogo puede borrar NOTAS de estudiantes.**

### 2.1.6 MATRÍCULAS Y ESTUDIANTES

| Modelo | Propósito | ON DELETE | Soft Delete |
|--------|-----------|-----------|-------------|
| `Student` | Estudiante | CASCADE desde Institution | ✅ `isActive`, `deletedAt`, `deletedReason` |
| `StudentEnrollment` | Matrícula (por año) | CASCADE desde Student, AcademicYear. **Restrict** desde Group | No |
| `EnrollmentArea` | Snapshot área en matrícula | CASCADE desde Enrollment. **SetNull** desde Area | No |
| `EnrollmentSubject` | Snapshot asignatura en matrícula | CASCADE desde Enrollment. **SetNull** desde Subject, Teacher | No |
| `EnrollmentDimension` | Snapshot dimensión (preescolar) | CASCADE desde Enrollment. **SetNull** desde Dimension | No |
| `EnrollmentEvent` | Historial/auditoría de matrícula | CASCADE desde Enrollment | No |

### 2.1.7 NOTAS Y CALIFICACIONES ★ CRÍTICO

| Modelo | Propósito | ON DELETE CASCADE desde |
|--------|-----------|------------------------|
| `EvaluativeActivity` | Actividad evaluativa | TeacherAssignment, AcademicTerm, EvaluationPlan |
| `StudentGrade` | Nota por actividad evaluativa | StudentEnrollment, EvaluativeActivity |
| `PartialGrade` | Nota parcial (por componente) | StudentEnrollment, TeacherAssignment, AcademicTerm |
| `PeriodFinalGrade` | Nota final de período | StudentEnrollment, AcademicTerm, **Subject(CASCADE)** |
| `FinalComponent` | Componente final (prueba semestral) | Institution, AcademicYear |
| `FinalComponentGrade` | Nota de componente final | StudentEnrollment, TeacherAssignment, FinalComponent |

### 2.1.8 ASISTENCIA

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `AttendanceRecord` | TeacherAssignment, StudentEnrollment |
| `TutoringAttendance` | Group, User(teacher), StudentEnrollment |

### 2.1.9 OBSERVADOR DEL ESTUDIANTE

| Modelo | ON DELETE CASCADE desde | ON DELETE SetNull/Restrict |
|--------|------------------------|---------------------------|
| `StudentObservation` | StudentEnrollment | Author: **Restrict** |
| `ActaRecord` | StudentObservation | — |
| `ObserverCommitment` | StudentEnrollment | Observation: **SetNull** |
| `GuardianCitation` | StudentEnrollment | Observation: **SetNull** |
| `ObserverReferral` | StudentEnrollment | Observation: **SetNull** |
| `ObserverEvidence` | StudentObservation, ActaRecord, Citation | — |
| `PedagogicalMeasure` | StudentObservation, StudentEnrollment | — |

### 2.1.10 RECUPERACIONES

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `RecoveryConfig` | Institution, AcademicYear |
| `PeriodRecovery` | StudentEnrollment, AcademicTerm, **Subject(CASCADE)** |
| `FinalRecoveryPlan` | StudentEnrollment, AcademicYear, **Area(CASCADE)** |

### 2.1.11 DESEMPEÑOS Y LOGROS

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `SubjectPerformance` | TeacherAssignment, AcademicTerm |
| `Achievement` | TeacherAssignment, AcademicTerm |
| `AttitudinalAchievement` | TeacherAssignment, AcademicTerm, Achievement |
| `StudentAchievement` | StudentEnrollment, Achievement |
| `AchievementBank` | Institution. Subject/Area/Grade: **SetNull** |

### 2.1.12 COMUNICACIONES

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `Message` | Institution. Parent: **SetNull** |
| `MessageRecipient` | Message |
| `MessageAttachment` | Message |
| `Announcement` | Institution |
| `GalleryImage` | Institution |
| `Event` | Institution |

### 2.1.13 AULA VIRTUAL

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `Classroom` | TeacherAssignment (1:1), Institution |
| `ClassroomSection` | Classroom |
| `ClassroomMaterial` | ClassroomSection |
| `ClassroomActivity` | ClassroomSection, Classroom |
| `ActivityQuestion` | ClassroomActivity |
| `ActivitySubmission` | ClassroomActivity, StudentEnrollment |
| `QuestionAnswer` | ActivitySubmission, ActivityQuestion |
| `ForumPost` | Classroom, ClassroomActivity |

### 2.1.14 ELECCIONES

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `ElectionProcess` | Institution |
| `Election` | ElectionProcess |
| `Candidate` | Election |
| `Vote` | Election |
| `ElectionResult` | Election |
| `ElectionAuditLog` | ElectionProcess |

### 2.1.15 PAGOS Y FINANZAS

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `PaymentConcept` | Institution |
| `PaymentEvent` | Institution |
| `StudentPayment` | Student, PaymentEvent |
| `PaymentTransaction` | StudentPayment |
| `FinancialThirdParty` | Institution |
| `FinancialCategory` | Institution |
| `ChargeConcept` | Institution |
| `FinancialObligation` | Institution |
| `FinancialPayment` | Institution |
| `FinancialExpense` | Institution |
| `FinancialInvoice` | Institution |
| `FinancialInvoiceItem` | FinancialInvoice |
| `FinancialSettings` | Institution |
| `CashRegisterClose` | Institution |

### 2.1.16 HORARIOS

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `TimeBlock` | Institution, Shift |
| `Room` | Institution. Campus: **SetNull** |
| `RoomRestriction` | Room, Subject |
| `ScheduleGradeConfig` | Institution, AcademicYear, Grade |
| `TeacherAvailability` | Institution, AcademicYear, User(teacher) |
| `ScheduleEntry` | Institution, AcademicYear, Group, TimeBlock. TeacherAssignment: **SetNull**, Room: **SetNull** |
| `ScheduleGenerationContext` | Institution, AcademicYear, Shift |

### 2.1.17 TEACHER WORKSPACE

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `WorkspaceBoard` | User(teacher), Institution |
| `WorkspaceColumn` | WorkspaceBoard |
| `WorkspaceItem` | WorkspaceBoard. Column: **SetNull** |

### 2.1.18 APD Y SOPORTE PEDAGÓGICO

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `EducationalSupportProfile` | — (no cascade) |
| `PedagogicalSupportPlan` | — (no cascade) |
| `SupportActivity` | PedagogicalSupportPlan |
| `SupportProgressLog` | PedagogicalSupportPlan |
| `ApdAuditLog` | — (no cascade) |

### 2.1.19 PERMISOS Y AUDITORÍA

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `Permission` | — |
| `RoleBasePermission` | Permission |
| `UserExtraPermission` | User, Permission |
| `PermissionAuditLog` | Institution |
| `TermReportCardSnapshot` | AcademicTerm, StudentEnrollment |
| `TermReopeningRecord` | AcademicTerm |

### 2.1.20 OTROS

| Modelo | ON DELETE CASCADE desde |
|--------|------------------------|
| `InstitutionStorageUsage` | Institution |
| `ReportCardConfig` | Institution |
| `InstitutionRoleCapability` | Institution |
| `PreventiveCutConfig` | AcademicTerm |
| `PreventiveAlert` | TeacherAssignment, StudentEnrollment, AcademicTerm |
| `AcademicAct` | Institution, AcademicYear |
| `ManagementLeader` | Institution |
| `ManagementTask` | Institution |
| `TaskAssignment` | ManagementTask |
| `InstitutionalDocument` | Institution |
| `StudentDocument` | Student |

## 2.2 Diagrama Textual de Relaciones Críticas

```
Institution ──┬── Campus ── Shift ── Group ──┐
              │                               │
              ├── AcademicYear ───────────────┤
              │       │                       │
              │       ├── AcademicTerm        │
              │       │       │               │
              │       │       ├── EvaluativeActivity ── StudentGrade
              │       │       ├── PartialGrade
              │       │       ├── PeriodFinalGrade
              │       │       └── Achievement ── StudentAchievement
              │       │                       │
              │       └── StudentEnrollment ──┤
              │               │               │
              │               ├── Grades      │
              │               ├── Attendance  │
              │               ├── Observations│
              │               └── Snapshots   │
              │                               │
              ├── Area ── Subject ─────────────┤
              │                               │
              └── TeacherAssignment ──────────┘
                     (group + subject + teacher + year)
                          │
                          ├── EvaluativeActivity → StudentGrade
                          ├── PartialGrade
                          ├── AttendanceRecord
                          ├── Achievement
                          ├── SubjectPerformance
                          └── Classroom (Aula Virtual)
```

## 2.3 Triggers

**No se usan triggers de PostgreSQL.** Toda la lógica de negocio se maneja en la capa de aplicación (NestJS services). No hay stored procedures ni funciones de base de datos.

## 2.4 Soft Delete

| Entidad | Mecanismo | Campos |
|---------|-----------|--------|
| `Student` | ✅ Soft delete | `isActive`, `deletedAt`, `deletedReason` |
| `Institution` | Parcial | `status: INACTIVE/SUSPENDED` |
| `User` | Parcial | `isActive` flag |
| `WorkspaceBoard` | Parcial | `isArchived` flag |
| `WorkspaceItem` | Parcial | `isArchived` flag |
| **Todas las demás** | ❌ **Hard delete** | Sin soft delete |

**⚠️ RIESGO ALTO:** Las tablas de notas (`StudentGrade`, `PartialGrade`, `PeriodFinalGrade`), asistencia (`AttendanceRecord`), y observaciones (`StudentObservation`) **NO tienen soft delete**. Una eliminación es permanente e irrecuperable.

---

# 3. RELACIONES CRÍTICAS ACADÉMICAS

## 3.1 Mapeo de Relaciones (Terminología Prisma → Conceptual)

| Concepto del usuario | Modelo Prisma | Relación |
|---------------------|---------------|----------|
| Carga académica | `TeacherAssignment` | teacher + group + subject + academicYear |
| Curso | `Group` | campus + shift + grade + name |
| Evaluación | `EvaluativeActivity` | teacherAssignment + academicTerm + evaluationPlan + component |
| Nota | `StudentGrade` / `PartialGrade` / `PeriodFinalGrade` | studentEnrollment + evaluativeActivity/teacherAssignment/subject |
| Matrícula | `StudentEnrollment` | student + academicYear + group |
| Horario | `ScheduleEntry` | group + timeBlock + dayOfWeek + teacherAssignment |

## 3.2 Análisis de Impacto por Eliminación

### 3.2.1 Se elimina una Carga Académica (TeacherAssignment)

**Mecanismo:** No hay endpoint explícito de DELETE en el backend. Si se elimina programáticamente:

```
TeacherAssignment DELETE → CASCADE →
  ├── EvaluativeActivity DELETE → CASCADE → StudentGrade DELETE ★ NOTAS PERDIDAS
  ├── EvaluationPlan DELETE → CASCADE → EvaluationPlanComponentWeight DELETE
  ├── PartialGrade DELETE ★ NOTAS PARCIALES PERDIDAS
  ├── AttendanceRecord DELETE ★ ASISTENCIA PERDIDA
  ├── Achievement DELETE → CASCADE → StudentAchievement DELETE ★ LOGROS PERDIDOS
  ├── AttitudinalAchievement DELETE
  ├── SubjectPerformance DELETE ★ DESEMPEÑOS PERDIDOS
  ├── PreventiveAlert DELETE
  ├── FinalComponentGrade DELETE ★ NOTAS FINALES PERDIDAS
  └── Classroom (1:1) → Section → Material, Activity → Question, Submission, Answer
```

**Riesgo: 🔴 CRÍTICO** — Se pierde TODO el historial académico de esa asignatura para ese grupo.

**Sin embargo:** El backend NO expone un endpoint para eliminar TeacherAssignment. La eliminación solo ocurriría si se elimina un AcademicYear, Group, Subject, o User(teacher) — todos con `onDelete: Cascade`.

### 3.2.2 Se reasigna un docente

**Mecanismo actual:** No existe reasignación. Se cierra la asignación actual (`endDate`, `endReason`) y se crea una nueva.

```typescript
// teacher-assignments.service.ts
// No hay delete, solo close + create new
```

**Riesgo: 🟢 BAJO** — Los datos históricos permanecen en la asignación cerrada.

### 3.2.3 Se modifica un Curso (Group)

**`Group` usa `onDelete: Restrict`** desde Campus, Shift y Grade. Esto significa que **no se puede eliminar un Group si tiene dependencias**. Correcto.

**Sin embargo**, si se elimina el Group forzosamente:
```
Group DELETE → CASCADE →
  ├── TeacherAssignment DELETE → (toda la cadena de §3.2.1)
  ├── StudentEnrollment (Restrict) → BLOQUEADO ✓
  ├── ScheduleEntry DELETE
  └── WorkspaceBoard (no cascade, solo FK)
```

**Riesgo: 🟡 MEDIO** — Group tiene Restrict desde Enrollment, lo cual protege parcialmente. Pero TeacherAssignment tiene CASCADE directo desde Group.

### 3.2.4 Se elimina un Estudiante

**Mecanismo actual (código real):**

```typescript
// students.service.ts lines 234-259
if (hasAcademicHistory) {
  // Soft delete: marcar como inactivo
  return this.prisma.student.update({
    data: { isActive: false, deletedAt: new Date(), deletedReason: reason }
  });
} else {
  // Borrado físico: eliminar relaciones manualmente
  await this.prisma.studentGuardian.deleteMany({ where: { studentId: id } });
  await this.prisma.studentDocument.deleteMany({ where: { studentId: id } });
  await this.prisma.studentEnrollment.deleteMany({ where: { studentId: id } });
  return this.prisma.student.delete({ where: { id } });
}
```

**¡PERO!** `studentEnrollment.deleteMany` **no verifica los grades/attendance/observations individualmente por enrollment**. Solo verifica a nivel estudiante. Si un estudiante tiene 2 enrollments (2 años) y una tiene notas pero la otra no, el check `hasAcademicHistory` puede ser false si las notas están en un enrollment diferente al verificado.

**Riesgo: 🟡 MEDIO** — La verificación usa `take: 1` en los includes, lo cual es correcto para detectar si hay algún registro, pero la eliminación elimina TODOS los enrollments.

### 3.2.5 Se elimina un Estudiante masivamente (bulkDeleteWithoutRecords)

```typescript
// students.service.ts lines 752-809
// Elimina TODOS los estudiantes sin registros académicos
// ⚠️ NO usa transacción - las operaciones son secuenciales sin $transaction
await this.prisma.studentEnrollment.deleteMany({ where: { studentId: { in: studentsToDelete } } });
await this.prisma.studentGuardian.deleteMany({ where: { studentId: { in: studentsToDelete } } });
await this.prisma.studentDocument.deleteMany({ where: { studentId: { in: studentsToDelete } } });
const result = await this.prisma.student.deleteMany({ where: { id: { in: studentsToDelete } } });
```

**Riesgo: 🔴 CRÍTICO** — Sin transacción. Si falla a mitad de camino, quedan enrollments eliminados pero estudiantes no.

### 3.2.6 Se vuelve a importar carga académica

**No existe endpoint de "reimportación" de carga académica.** Las asignaciones se crean una a una. No hay operación de "delete all + reinsert".

**Riesgo: 🟢 BAJO** — No hay patrón destructivo.

### 3.2.7 Se actualiza matrícula masivamente

**No existe endpoint de actualización masiva de matrículas.** Matrículas se crean individualmente con `createAcademicSnapshot`. La regeneración de snapshot (`regenerateAcademicSnapshot`) sí elimina y recrea:

```typescript
// enrollment.service.ts lines 1131-1155
async regenerateAcademicSnapshot(enrollmentId: string) {
  // Eliminar snapshot existente
  const deleted = await this.prisma.enrollmentArea.deleteMany({ where: { enrollmentId } });
  // Crear nuevo snapshot
  await this.createAcademicSnapshot(enrollmentId, ...);
}
```

**Riesgo: 🟡 MEDIO** — EnrollmentArea cascade deletes EnrollmentSubject. Si falla la creación después del delete, queda matrícula sin snapshot.

### 3.2.8 ¿Puede afectar notas históricas?

**SÍ, en estos escenarios:**

1. **Eliminar Subject del catálogo** → CASCADE → TeacherAssignment → CASCADE → PartialGrade + StudentGrade + PeriodFinalGrade → **NOTAS ELIMINADAS**
2. **Eliminar Area del catálogo** → CASCADE → Subject → (cadena anterior)
3. **Eliminar AcademicYear** → CASCADE → TeacherAssignment + StudentEnrollment → **TODO eliminado**
4. **PeriodFinalGrade tiene `onDelete: Cascade` desde Subject** — Eliminar asignatura = eliminar notas finales

---

# 4. FLUJO DE DATOS ACADÉMICO

## 4.1 Paso a Paso

```
1. CREAR ESTRUCTURA
   Admin crea: Institution → Campus → Shift → Grade → Group
   Admin crea: Area → Subject (catálogo institucional)

2. CONFIGURAR AÑO LECTIVO
   Admin crea: AcademicYear (status: DRAFT)
   Admin crea: AcademicTemplate → TemplateArea → TemplateSubject
   Admin asigna: GradeTemplate (plantilla → grado por año)
   Admin activa: AcademicYear (status: ACTIVE)

3. ASIGNAR CARGA ACADÉMICA
   Admin crea: TeacherAssignment (teacher + group + subject + year)
   ★ Este es el pivote central de todo el flujo

4. MATRICULAR ESTUDIANTES
   Admin crea: StudentEnrollment (student + group + year)
   Sistema crea: EnrollmentArea + EnrollmentSubject (SNAPSHOT inmutable)
   Sistema registra: EnrollmentEvent (auditoría)

5. CONFIGURAR EVALUACIÓN
   Docente crea: EvaluationPlan + EvaluationPlanComponentWeight
   Docente crea: EvaluativeActivity (por componente, por período)

6. REGISTRAR NOTAS
   Docente registra: PartialGrade (notas parciales por componente)
   ← O →
   Docente registra: StudentGrade (nota por actividad evaluativa)
   Sistema calcula: PeriodFinalGrade (nota final de período)

7. CONSOLIDAR CALIFICACIONES
   Sistema usa: engines/ (motores de cálculo)
   Para generar: Promedios por área, promedios generales
   Con: FinalComponent grades (pruebas semestrales)
   Y: Recovery grades (recuperaciones)
   
8. GENERAR BOLETINES
   Sistema consolida: Todo lo anterior + Attendance + Achievements + Observations
   Sistema genera: TermReportCardSnapshot (snapshot legal inmutable)
```

## 4.2 Puntos Vulnerables

| Punto | Riesgo | Descripción |
|-------|--------|-------------|
| **TeacherAssignment como pivote** | 🔴 CRÍTICO | Si se elimina, se pierde toda la cadena |
| **Subject CASCADE** | 🔴 CRÍTICO | Eliminar asignatura del catálogo borra notas |
| **Snapshot regeneration** | 🟡 MEDIO | Delete + Insert sin transacción |
| **PeriodFinalGrade auto-delete** | 🟡 MEDIO | Se elimina automáticamente cuando score = 0 o no quedan parciales |
| **No hay versionado de notas** | 🔴 CRÍTICO | No existe historial de cambios en notas |

---

# 5. ANÁLISIS DE TRANSACCIONES

## 5.1 Transacciones Explícitas Encontradas

Se encontraron **24 usos** de `$transaction` en 14 archivos:

| Servicio | Operación | Usa Transacción |
|----------|-----------|----------------|
| `elections.service.ts` | Conteo de votos, cierre electoral | ✅ (4 usos) |
| `superadmin.service.ts` | Creación de institución, roles | ✅ (3 usos) |
| `tenant-context.interceptor.ts` | Resolución de contexto | ✅ (2 usos) |
| `enrollment.service.ts` | Promoción masiva | ✅ (2 usos) |
| `classroom.service.ts` | Submit quiz (auto-grade + update) | ✅ (2 usos) |
| `finance/payments.service.ts` | Registro de pagos | ✅ (2 usos) |
| `teacher-assignments.service.ts` | Cierre + creación | ✅ (1 uso) |
| `attendance.service.ts` | Registro masivo asistencia | ✅ (1 uso) |
| `tutoring-attendance.service.ts` | Registro masivo tutoría | ✅ (1 uso) |
| `payments.service.ts` | Pagos simples | ✅ (1 uso) |
| `schedule-entries.service.ts` | Generación de horario | ✅ (1 uso) |
| `teacher-availability.service.ts` | Guardar disponibilidad | ✅ (1 uso) |
| `time-blocks.service.ts` | Guardar bloques | ✅ (1 uso) |

## 5.2 Operaciones Masivas SIN Transacción ⚠️

| Operación | Archivo | Riesgo |
|-----------|---------|--------|
| **bulkDeleteWithoutRecords** | `students.service.ts:752-809` | 🔴 CRÍTICO — 4 deleteMany secuenciales sin $transaction |
| **deleteStudent (físico)** | `students.service.ts:250-258` | 🟡 MEDIO — 3 deleteMany + 1 delete sin $transaction |
| **regenerateAcademicSnapshot** | `enrollment.service.ts:1131-1155` | 🟡 MEDIO — deleteMany + create sin $transaction |
| **savePartialGrades (bulk)** | `partial-grades.service.ts:~100-165` | 🟡 MEDIO — deleteMany conflictos + upserts en loop |
| **deletePartialGrade** | `partial-grades.service.ts:~220-340` | 🟡 MEDIO — Puede eliminar PeriodFinalGrade automáticamente |

## 5.3 ¿Puede quedar la BD en estado inconsistente?

**SÍ**, en los siguientes escenarios:

1. **Eliminación masiva de estudiantes** — Si falla después de eliminar enrollments pero antes de eliminar students, quedan students sin enrollments pero con guardians y documents.

2. **Regeneración de snapshot** — Si falla después de deleteMany(enrollmentArea) pero antes de createAcademicSnapshot, la matrícula queda sin estructura académica.

3. **Notas parciales** — Si savePartialGrades falla a mitad del loop de upserts, algunos estudiantes tendrán notas nuevas y otros no. La PeriodFinalGrade calculada estará incorrecta.

---

# 6. RIESGOS DE PÉRDIDA DE DATOS

## 6.1 Cascade Deletes Peligrosos

| Acción | Cadena de CASCADE | Riesgo | Nivel |
|--------|-------------------|--------|-------|
| DELETE Subject | → TeacherAssignment → StudentGrade, PartialGrade, PeriodFinalGrade, AttendanceRecord, Achievement, etc. | Pérdida total de historial académico de esa asignatura | 🔴 **CRÍTICO** |
| DELETE Area | → Subject → (todo lo anterior) | Pérdida de múltiples asignaturas | 🔴 **CRÍTICO** |
| DELETE AcademicYear | → TeacherAssignment + StudentEnrollment → TODO | Pérdida de año completo | 🔴 **CRÍTICO** |
| DELETE User (docente) | → TeacherAssignment → (toda la cadena) | Pérdida de datos del docente | 🔴 **CRÍTICO** |
| DELETE Student | → StudentEnrollment → StudentGrade, PartialGrade, Attendance, Observations | Código protege con soft delete SI tiene historial | 🟡 MEDIO |
| DELETE AcademicTerm | → EvaluativeActivity, PartialGrade, PeriodFinalGrade, Achievement, etc. | Pérdida de período completo | 🔴 **CRÍTICO** |
| DELETE Institution | → ABSOLUTAMENTE TODO (campus, teachers, students, grades) | Total | 🔴 **CRÍTICO** |

## 6.2 Operaciones DELETE Masivas

| Operación | Ubicación | Protección | Riesgo |
|-----------|-----------|------------|--------|
| `bulkDeleteWithoutRecords` | `students.service.ts` | Verifica que no tengan grades/attendance/observations | 🟡 MEDIO — sin transacción |
| `deleteMany(enrollmentArea)` | `enrollment.service.ts` | Ninguna — elimina snapshots | 🟡 MEDIO |
| `deleteMany(partialGrade)` | `partial-grades.service.ts` | Verifica que AcademicTerm no esté FINALIZED | 🟢 BAJO |
| `deleteMany(periodFinalGrade)` | `partial-grades.service.ts` | Automático cuando score = 0 | 🟡 MEDIO |

## 6.3 Reemplazos Destructivos (delete + reinsert)

| Operación | Ubicación | Patrón | Riesgo |
|-----------|-----------|--------|--------|
| `regenerateAcademicSnapshot` | `enrollment.service.ts` | deleteMany(areas) → create snapshot | 🟡 MEDIO |
| `savePartialGrades` (conflictos) | `partial-grades.service.ts` | deleteMany(conflictos) → upsert nuevos | 🟡 MEDIO |

## 6.4 Falta de Versionado

| Entidad | ¿Tiene historial de cambios? | Riesgo |
|---------|------------------------------|--------|
| `StudentGrade` | ❌ Solo `updatedAt` | 🔴 CRÍTICO — Si se modifica una nota, se pierde la anterior |
| `PartialGrade` | ❌ Solo `updatedAt` | 🔴 CRÍTICO |
| `PeriodFinalGrade` | ❌ Solo `updatedAt` | 🔴 CRÍTICO |
| `AttendanceRecord` | ❌ Solo `updatedAt` | 🟡 MEDIO |
| `StudentObservation` | ❌ Solo `updatedAt` | 🟡 MEDIO |
| `TermReportCardSnapshot` | ✅ Campo `version` + historial | 🟢 BAJO — Boletines sí tienen versionado |
| `EnrollmentEvent` | ✅ Log de auditoría | 🟢 BAJO — Matrículas sí tienen auditoría |
| `PerformanceManualEdit` | ✅ Guarda original + editado | 🟢 BAJO — Desempeños sí tienen auditoría |

## 6.5 Falta de Historial Académico

**Las notas NO tienen historial de cambios.** Si un docente modifica una nota (StudentGrade, PartialGrade, PeriodFinalGrade), el valor anterior se pierde para siempre. Solo queda `updatedAt` como evidencia de que fue modificada.

**Esto es especialmente grave porque:**
- En Colombia, las notas son documentos legales (Decreto 1290)
- Una corrección de nota debería generar un acta (AcademicAct)
- El schema tiene `AcademicAct` con tipo `GRADE_CORRECTION`, pero **no hay integración automática** entre la edición de notas y la creación de actas

---

# 7. CONCURRENCIA

## 7.1 ¿Qué pasa si dos docentes editan notas simultáneamente?

**No hay control de concurrencia.** El esquema de notas usa:
```prisma
@@unique([studentEnrollmentId, evaluativeActivityId])  // StudentGrade
@@unique([studentEnrollmentId, teacherAssignmentId, academicTermId, componentType, activityIndex])  // PartialGrade
```

Prisma usa **last-write-wins** por defecto. Si dos docentes editan la misma nota:
- Docente A lee nota = 3.5
- Docente B lee nota = 3.5
- Docente A guarda nota = 4.0
- Docente B guarda nota = 3.0
- **Resultado: 3.0 (Docente B gana)**

No hay `version` field, no hay optimistic locking, no hay `@updatedAt` check.

## 7.2 ¿Se puede sobreescribir información?

**SÍ.** En todos los updates de notas:
```typescript
// No hay check de versión
await this.prisma.partialGrade.update({
  where: { id },
  data: { score: newScore }  // Sobreescribe sin verificar
});
```

## 7.3 Control Optimista

**No existe.** No se usa `@updatedAt` como version field en ningún update.

## 7.4 Locking

**No existe.** No hay `SELECT FOR UPDATE`, no hay advisory locks, no hay row-level locking explícito.

**Riesgo: 🟡 MEDIO** — Con pocos usuarios concurrentes el riesgo es bajo. Con 100+ docentes editando simultáneamente, las colisiones serán frecuentes.

---

# 8. ESCALABILIDAD PostgreSQL

## 8.1 Tablas con Crecimiento Exponencial

| Tabla | Crecimiento por estudiante/año | Proyección 1000 estudiantes/5 años |
|-------|-------------------------------|-------------------------------------|
| `StudentGrade` | ~40 actividades × 4 períodos = 160 | **800,000 registros** |
| `PartialGrade` | ~3 componentes × 5 actividades × 4 períodos = 60 | **300,000 registros** |
| `AttendanceRecord` | ~200 días × 8 asignaturas = 1,600 | **8,000,000 registros** ⚠️ |
| `PeriodFinalGrade` | ~8 asignaturas × 4 períodos = 32 | **160,000 registros** |
| `QuestionAnswer` | Variable (quizzes) | Impredecible |
| `EnrollmentEvent` | ~5-10 eventos por matrícula | **50,000 registros** |
| `StudentObservation` | ~2-5 por estudiante/año | **25,000 registros** |

**⚠️ AttendanceRecord es la tabla de mayor crecimiento** con ~8M registros potenciales en 5 años.

## 8.2 Análisis de Índices

### Índices Presentes ✅
La mayoría de FKs tienen índices explícitos. Particularmente buenos:
- `AttendanceRecord`: 4 índices incluyendo compound `[studentEnrollmentId, date]`
- `PartialGrade`: 2 compound indexes
- `StudentGrade`: unique constraint cubre la búsqueda principal
- `ScheduleEntry`: 7 índices

### Índices Faltantes ⚠️

| Tabla | Campo sin índice | Impacto |
|-------|-----------------|---------|
| `StudentGrade` | `institutionId` (solo) | Queries de admin por institución sin join |
| `PeriodFinalGrade` | `subjectId` (solo) | Consultas de rendimiento por asignatura |
| `PartialGrade` | `componentType` | Filtros por componente (COGNITIVO, etc.) |
| `StudentObservation` | `institutionId` (solo) | Queries de admin |
| `User` | No tiene `institutionId` | Join obligatorio a InstitutionUser |

## 8.3 Consultas Costosas Potenciales

1. **Boletines** — Requiere join de 6+ tablas (enrollments + grades + attendance + achievements + observations + areas)
2. **Dashboard de rendimiento** — Agrega notas de todos los estudiantes por asignatura
3. **Alertas preventivas** — Calcula promedios en tiempo real
4. **Reportes MEN** — Queries masivas de toda la institución

## 8.4 N+1 Queries

Prisma mitiga N+1 con `include:`, pero hay patrones sospechosos:

```typescript
// students.service.ts - bulkDeleteWithoutRecords
// Carga TODOS los estudiantes con 3 includes anidados
const students = await this.prisma.student.findMany({
  where: { institutionId },
  include: {
    enrollments: {
      include: {
        grades: { take: 1 },
        attendanceRecords: { take: 1 },
        studentObservations: { take: 1 },
      },
    },
  },
});
// Luego itera en JS ← potencial OOM con muchos estudiantes
```

## 8.5 Riesgo de Degradación con 1000+ Estudiantes

| Operación | Riesgo | Razón |
|-----------|--------|-------|
| Generar boletines de un grupo | 🟡 MEDIO | Muchos joins, pero limitado a ~40 estudiantes |
| Generar boletines de toda la institución | 🔴 ALTO | 1000 estudiantes × 6+ joins |
| Cálculo de alertas preventivas | 🟡 MEDIO | Agrega notas parciales |
| Listado de asistencia anual | 🔴 ALTO | 8M registros sin paginación |
| bulkDeleteWithoutRecords | 🔴 ALTO | Carga TODOS los estudiantes en memoria |

---

# 9. INTEGRACIÓN CON CLOUDFLARE R2

## 9.1 Cómo se Almacenan Archivos

```typescript
// storage.service.ts
// Cliente S3-compatible apuntando a Cloudflare R2
// Bucket: process.env.R2_BUCKET || 'edusyn-files'
// Endpoint: https://{accountId}.r2.cloudflarestorage.com
```

**Organización de keys:**
- `observador/{institutionId}/{year}/{month}/evidence.pdf` — Evidencias del observador
- `documents/{institutionId}/...` — Documentos institucionales
- `gallery/{institutionId}/...` — Galería
- `tasks/{institutionId}/...` — Evidencias de tareas

## 9.2 Referencia en Base de Datos

Los archivos se referencian por URL en campos `String?`:
- `StudentDocument.fileUrl`
- `ObserverEvidence.fileUrl`
- `InstitutionalDocument.fileUrl`
- `TaskAssignment.evidenceUrl`
- `GalleryImage.imageUrl`
- `Announcement.imageUrl`
- `Student.photo`
- `User.signatureImageUrl`
- `Candidate.photo`
- `FinancialPayment.pdfUrl`
- `FinancialExpense.attachmentUrl`
- `ClassroomMaterial.fileUrl`
- `ActivitySubmission.fileUrl`

## 9.3 ¿Qué pasa si se elimina una entidad que tiene archivos?

**Los archivos quedan huérfanos en R2.** El único servicio que tiene limpieza parcial es `institutional-documents.service.ts`:

```typescript
// institutional-documents.service.ts
// Tiene lógica de "orphan cleanup" para documentos institucionales
```

**Para TODAS las demás entidades:** cuando se elimina un `StudentDocument`, `ObserverEvidence`, `GalleryImage`, etc., el registro en BD se elimina pero **el archivo en R2 permanece indefinidamente**.

## 9.4 Limpieza Automática

**NO EXISTE limpieza automática de archivos huérfanos** (excepto parcialmente en documentos institucionales). No hay:
- Cron job de limpieza
- Lifecycle rules en R2
- Garbage collection de archivos

**Riesgo: 🟡 MEDIO** — Los archivos huérfanos consumen espacio en R2 (facturado) pero no causan errores funcionales. Con el tiempo, el storage puede crecer significativamente sin datos útiles.

## 9.5 Control de Almacenamiento

Existe `InstitutionStorageUsage` que trackea uso por categoría (documentos, evidencias, galería) con límites configurables. Sin embargo, este tracking depende de que los módulos actualicen el conteo al subir/eliminar archivos.

---

# 10. EVALUACIÓN GENERAL DEL SISTEMA

## 10.1 Lo que Está BIEN Diseñado ✅

### Arquitectura y Organización
- **Multi-tenancy sólido** — `institutionId` como RLS en todas las tablas críticas
- **Separación por dominios** — 29 módulos backend bien organizados
- **Enums exhaustivos** — Modelado de dominio colombiano (Decreto 1290, SIEE, MEN)

### Protección de Datos Históricos
- **Enrollment Snapshots** — `EnrollmentArea`, `EnrollmentSubject`, `EnrollmentDimension` con campos desnormalizados (`areaName`, `subjectName`, `teacherName`). Si se elimina el catálogo, los nombres históricos sobreviven.
- **SetNull en snapshots** — `EnrollmentArea.areaId onDelete: SetNull`, no CASCADE. Los snapshots son autosuficientes.
- **Term Report Card Snapshots** — Boletines legales congelados con versionado.
- **Enrollment Events** — Auditoría completa de cambios de matrícula.

### Soft Delete donde más importa
- **Student** tiene soft delete con `deletedAt` + `deletedReason`
- **La lógica de deleteStudent** verifica historial académico antes de decidir soft/hard delete

### Evaluación Robusta
- **EvaluationPlan + Components** — Sistema flexible de ponderación
- **PartialGrade** — Notas parciales por componente (COGNITIVO, PROCEDIMENTAL, ACTITUDINAL)
- **PeriodFinalGrade** — Calculada automáticamente desde parciales
- **FinalComponent** — Pruebas semestrales con ponderación independiente

### Seguridad
- **Rate limiting** — ThrottlerGuard (100 req/60s)
- **JWT Authentication**
- **Permission system** — RoleBasePermission + UserExtraPermission con auditoría
- **Election integrity** — SHA-256 checksums, audit log chain

## 10.2 Lo que Necesita REFACTOR URGENTE 🔴

### 1. CASCADE en Subject y Area (PRIORIDAD MÁXIMA)

```prisma
// ACTUAL - PELIGROSO:
model TeacherAssignment {
  subject Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
}
model PeriodFinalGrade {
  subject Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
}
model PeriodRecovery {
  subject Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
}

// DEBERÍA SER:
// onDelete: Restrict (impedir eliminar si hay dependencias)
// O onDelete: SetNull (preservar el registro sin referencia)
```

**Impacto:** Eliminar una asignatura del catálogo borra TODAS las notas, asistencias, logros de TODOS los estudiantes de TODOS los años para esa asignatura.

**Recomendación:** Cambiar a `onDelete: Restrict` en TeacherAssignment→Subject, PeriodFinalGrade→Subject, PeriodRecovery→Subject, FinalRecoveryPlan→Area.

### 2. CASCADE en User(teacher) → TeacherAssignment

```prisma
// ACTUAL - PELIGROSO:
teacher User @relation(fields: [teacherId], references: [id], onDelete: Cascade)
```

**Recomendación:** Cambiar a `onDelete: Restrict` o `SetNull`. Un docente eliminado no debería borrar toda la carga académica.

### 3. Transacciones faltantes en operaciones críticas

Las siguientes operaciones DEBEN usar `$transaction`:
- `bulkDeleteWithoutRecords` (students.service.ts)
- `deleteStudent` hard delete path (students.service.ts)
- `regenerateAcademicSnapshot` (enrollment.service.ts)
- Cualquier operación que haga delete + insert secuencial

### 4. Historial de cambios de notas

**Crear tabla `GradeChangeLog`:**
```prisma
model GradeChangeLog {
  id              String   @id @default(cuid())
  institutionId   String
  gradeType       String   // PARTIAL, PERIOD_FINAL, STUDENT_GRADE
  gradeId         String
  previousScore   Decimal
  newScore        Decimal
  changedById     String
  reason          String?
  createdAt       DateTime @default(now())
}
```

## 10.3 Lo que Puede ROMPER Producción 🟠

### 1. Eliminación accidental de Subject/Area/AcademicYear
Un admin que elimine una asignatura del catálogo borrará todas las notas históricas. **No hay confirmación extra ni protección en cascada.**

### 2. bulkDeleteWithoutRecords sin transacción
Si falla a mitad de camino en producción, la BD queda inconsistente. Y la verificación de "sin registros" es correcta pero la ejecución no es atómica.

### 3. Concurrencia en edición de notas
Con múltiples docentes editando notas simultáneamente, se pueden sobreescribir valores sin aviso.

### 4. Crecimiento de AttendanceRecord
Sin paginación obligatoria, queries de asistencia anual pueden timeout con 1000+ estudiantes.

## 10.4 Lo que Debe Blindarse Antes de Escalar 🛡️

| Prioridad | Acción | Esfuerzo |
|-----------|--------|----------|
| **P0** | Cambiar `onDelete: Cascade` a `Restrict` en Subject→TA, Subject→PFG, Area→Subject dependientes de notas, User(teacher)→TA | 1 migración |
| **P0** | Agregar `$transaction` a operaciones masivas de eliminación | 2-3 horas |
| **P1** | Crear `GradeChangeLog` para auditoría de notas | 1 día |
| **P1** | Agregar optimistic locking en updates de notas (version field) | 1 día |
| **P2** | Implementar paginación obligatoria en queries de asistencia y grades | 2-3 días |
| **P2** | Implementar cron job de limpieza de archivos huérfanos en R2 | 1 día |
| **P3** | Agregar índices faltantes (institutionId solo, subjectId solo) | 1 migración |

## 10.5 Nivel de Madurez Estructural

| Aspecto | Nivel | Nota |
|---------|-------|------|
| **Modelado de dominio** | ⭐⭐⭐⭐⭐ | Excelente. Schema exhaustivo, bien documentado, fiel al dominio colombiano |
| **Multi-tenancy** | ⭐⭐⭐⭐ | Sólido con institutionId RLS, pero sin row-level security de PostgreSQL |
| **Protección de históricos** | ⭐⭐⭐⭐ | Enrollment snapshots son excelentes. Pero notas sin versionado |
| **Integridad referencial** | ⭐⭐⭐ | Bien en general, pero CASCADE peligrosos en Subject/Area/User |
| **Transaccionalidad** | ⭐⭐ | Presente en algunos lugares, ausente en operaciones críticas |
| **Concurrencia** | ⭐ | Sin control alguno |
| **Auditoría de datos** | ⭐⭐⭐ | Buena en matrículas y permisos, nula en notas |
| **Escalabilidad** | ⭐⭐⭐ | Buenos índices, pero queries sin paginación |
| **Storage/R2** | ⭐⭐ | Funcional pero sin limpieza de huérfanos |

### Veredicto General

**El sistema tiene una base arquitectónica sólida** con un modelado de dominio excepcional para el contexto educativo colombiano. Los enrollment snapshots son una decisión de diseño inteligente que protege datos históricos.

**Sin embargo, hay 3 bombas de tiempo:**
1. **CASCADE deletes en Subject/Area** → pueden borrar notas irrecuperablemente
2. **Sin transacciones en operaciones masivas** → BD inconsistente ante fallos
3. **Sin historial de cambios en notas** → imposible auditar modificaciones

Estas deben resolverse **ANTES** de escalar o agregar nuevos módulos (Kahoot, etc.).

---

# APÉNDICE A: Mapa Completo de ON DELETE Behavior

```
onDelete: Cascade (PELIGROSO si tiene datos hijos críticos)
═══════════════════════════════════════════════════════
Institution → [Campus, Area, AcademicYear, InstitutionModule, InstitutionUser, 
               RecoveryConfig, AcademicAct, PaymentConcept, PaymentEvent, 
               FinancialThirdParty, FinancialCategory, ChargeConcept, 
               FinancialObligation, FinancialPayment, FinancialExpense, 
               FinancialInvoice, FinancialSettings, CashRegisterClose,
               TimeBlock, Room, ScheduleGradeConfig, TeacherAvailability,
               ScheduleEntry, ScheduleGenerationContext, ReportCardConfig,
               InstitutionRoleCapability, ElectionProcess, InstitutionalDocument,
               ManagementLeader, ManagementTask, InstitutionStorageUsage,
               PermissionAuditLog, WorkspaceBoard]

Campus → [Shift]
Shift → [TimeBlock, ScheduleGenerationContext]
Area → [Subject] ★ PELIGROSO
Subject → [TemplateSubject, TeacherAssignment, PeriodFinalGrade, PeriodRecovery,
           PerformanceManualEdit, GroupSubjectException, RoomRestriction] ★ PELIGROSO

AcademicYear → [AcademicCalendar, Period, AcademicTerm, TeacherAssignment, 
                StudentEnrollment, RecoveryConfig, FinalRecoveryPlan, AcademicAct,
                AcademicTemplate, GradeTemplate, GroupSubjectException,
                ScheduleGradeConfig, TeacherAvailability, ScheduleEntry,
                ScheduleGenerationContext, FinalComponent]

AcademicTerm → [EvaluationPlan, EvaluativeActivity, PreventiveCutConfig,
                PreventiveAlert, PeriodFinalGrade, PartialGrade, PeriodRecovery,
                SubjectPerformance, PerformanceManualEdit, GradingPeriodConfig,
                RecoveryPeriodConfig, Achievement, AttitudinalAchievement,
                TermReportCardSnapshot, TermReopeningRecord]

TeacherAssignment → [EvaluativeActivity, EvaluationPlan, PreventiveAlert,
                     AttendanceRecord, SubjectPerformance, PartialGrade,
                     Achievement, AttitudinalAchievement, FinalComponentGrade]

Student → [StudentEnrollment, StudentGuardian, StudentDocument, StudentPayment]
StudentEnrollment → [StudentGrade, PeriodFinalGrade, PartialGrade, PreventiveAlert,
                     AttendanceRecord, StudentObservation, PeriodRecovery,
                     FinalRecoveryPlan, PerformanceManualEdit, StudentAchievement,
                     ObserverCommitment, GuardianCitation, ObserverReferral,
                     PedagogicalMeasure, EnrollmentArea, EnrollmentSubject,
                     EnrollmentDimension, FinalComponentGrade,
                     TermReportCardSnapshot, TutoringAttendance,
                     ActivitySubmission, EnrollmentEvent]

User → [UserRole, InstitutionUser, TeacherAssignment, WorkspaceBoard,
        TeacherAvailability, TutoringAttendance, AchievementBank]

onDelete: Restrict (CORRECTO - impide eliminación)
═══════════════════════════════════════════════════════
Group ← [Campus, Shift, Grade] via Restrict
StudentEnrollment ← Group via Restrict  
EvaluationComponent ← parent via Restrict
StudentObservation ← author(User) via Restrict

onDelete: SetNull (CORRECTO - preserva registro)
═══════════════════════════════════════════════════════
Group.directorId → User: SetNull
Group.companionId → User: SetNull
EnrollmentArea.areaId → Area: SetNull
EnrollmentSubject.subjectId → Subject: SetNull
EnrollmentSubject.teacherId → User: SetNull
EnrollmentDimension.dimensionId → Dimension: SetNull
WorkspaceItem.columnId → WorkspaceColumn: SetNull
ScheduleEntry.teacherAssignmentId → TeacherAssignment: SetNull
ScheduleEntry.roomId → Room: SetNull
Room.campusId → Campus: SetNull
ObserverCommitment.observationId → StudentObservation: SetNull
GuardianCitation.observationId → StudentObservation: SetNull
ObserverReferral.observationId → StudentObservation: SetNull
```

---

*Fin del Documento Técnico de Auditoría — Edusyn v2026.02*
