# ═══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA ARQUITECTÓNICA COMPLETA — EDUSYN ERP EDUCATIVO
# Fecha: Marzo 2026
# Auditor: Arquitecto de Software Senior (Análisis automatizado)
# Alcance: Schema Prisma (~4,949 líneas, ~100+ modelos), Backend NestJS (~91 servicios, ~84 controllers)
# ═══════════════════════════════════════════════════════════════════════════════

---

## ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Metodología de Auditoría](#2-metodología-de-auditoría)
3. [Riesgos Críticos (Alto Impacto)](#3-riesgos-críticos-alto-impacto)
4. [Riesgos Medios](#4-riesgos-medios)
5. [Riesgos Leves](#5-riesgos-leves)
6. [Vacíos Estructurales](#6-vacíos-estructurales)
7. [Puntos Que Pueden Romper Otros Módulos](#7-puntos-que-pueden-romper-otros-módulos)
8. [Mapa de Dependencias Inter-Módulo](#8-mapa-de-dependencias-inter-módulo)
9. [Recomendaciones de Blindaje](#9-recomendaciones-de-blindaje)
10. [Nivel General de Madurez Arquitectónica](#10-nivel-general-de-madurez-arquitectónica)
11. [Anexo: Archivos Auditados](#11-anexo-archivos-auditados)

---

## 1. RESUMEN EJECUTIVO

Edusyn es un ERP educativo SaaS multi-tenant construido con NestJS (backend) + React (frontend) + Prisma ORM + PostgreSQL. El sistema sirve a múltiples instituciones educativas colombianas con módulos de gestión académica, financiera, asistencia, evaluación, observador, elecciones, aula virtual, y más.

**El sistema tiene una base arquitectónica sólida** con decisiones de diseño maduras:
- Snapshots inmutables de matrícula (`EnrollmentArea`/`EnrollmentSubject`/`EnrollmentDimension`)
- Motor de reglas puro sin dependencia de BD (`academic-rules.engine.ts`, `promotion.engine.ts`)
- Ciclo de vida de períodos académicos con estados (DRAFT → OPEN → CLOSED → FINALIZED)
- Modularidad clara con 30+ módulos NestJS independientes

**Los riesgos críticos se concentran en dos brechas de multi-tenancy:**
1. `Grade` y `Dimension` son tablas globales sin `institutionId`
2. Roles no vinculados a institución en el JWT (escalación de privilegios cross-tenant)

**Otros hallazgos importantes:**
- N+1 queries en operaciones batch (bulkUpsert, calculateAnnualGrade)
- `onDelete: Cascade` excesivo en relaciones críticas
- Ausencia de audit log centralizado
- Sin rate limiting ni control de sesiones
- `Decimal(3,1)` en notas impide escala 0-100

**Nota global: 6.7 / 10** — Corregir los 5 puntos de Prioridad 1 elevaría a ~8/10.

---

## 2. METODOLOGÍA DE AUDITORÍA

### Archivos analizados:
- **Schema Prisma:** `apps/api/prisma/schema.prisma` — 4,949 líneas completas
- **Capa de seguridad:**
  - `apps/api/src/modules/auth/jwt.strategy.ts` (JWT payload y validación)
  - `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` (Guard de autenticación)
  - `apps/api/src/modules/auth/guards/roles.guard.ts` (Guard de roles)
  - `apps/api/src/modules/capabilities/capabilities.guard.ts` (Guard de capabilities)
  - `apps/api/src/common/utils/institution-resolver.ts` (Resolución de tenant)
  - `apps/api/src/modules/auth/auth.service.ts` (Login, registro, JWT signing)
- **Servicios core:**
  - `apps/api/src/modules/evaluation/student-grades.service.ts` (Cálculo de notas)
  - `apps/api/src/modules/reports/reports.service.ts` (Generación de boletines)
- **Búsqueda transversal:**
  - 85 coincidencias de `institutionId.*req.user` en 17 controllers
  - 94 `@UseGuards` en 84 controllers
  - 836 `findMany|findFirst|findUnique` en 91 servicios
  - 11 `@Param.*institutionId` en 4 controllers
  - 17 `isSuperAdmin` en 7 archivos

### Criterios de evaluación:
- Aislamiento multi-tenant (¿todas las tablas filtran por institutionId?)
- Integridad referencial (¿onDelete apropiado en cada relación?)
- Seguridad de endpoints (¿guards en todos los controllers?)
- Rendimiento de queries (¿N+1? ¿índices apropiados?)
- Flujo académico (¿ciclo de vida protegido? ¿snapshots inmutables?)
- Blindaje estructural (¿qué pasa si se borra X?)
- Trazabilidad (¿auditoría de cambios?)

---

## 3. RIESGOS CRÍTICOS (Alto Impacto)

### 3.1 — `Grade` y `Dimension` NO tienen `institutionId` (Fuga de Tenant)

**Archivo:** `apps/api/prisma/schema.prisma` — líneas 593-613 (Grade) y 798-811 (Dimension)

**Hallazgo:** `Grade` y `Dimension` son las únicas tablas de estructura académica que carecen de `institutionId`. Son tablas **globales compartidas por todos los tenants**.

**Evidencia en el schema:**
```prisma
model Grade {
  id        String     @id @default(cuid())
  stage     GradeStage
  name      String
  order     Int
  // ... NO tiene institutionId
  @@unique([stage, name])  // ← Impide que dos colegios tengan mismo nombre+stage
}

model Dimension {
  id          String  @id @default(cuid())
  name        String
  description String?
  code        String?
  // ... NO tiene institutionId
  @@unique([name])  // ← Impide que dos colegios tengan misma dimensión
}
```

**Impacto:**
- Todos los tenants comparten los mismos grados y dimensiones.
- Un colegio que modifique el grado "Transición" afecta a TODOS los colegios.
- `@@unique([stage, name])` en Grade impide que dos colegios tengan un grado con el mismo nombre y stage.
- Si crece a 500 colegios, esto **rompe** la independencia de cada institución.
- Un query `SELECT * FROM Grade` sin filtro de tenant retorna datos de todos los colegios (son los mismos).

**Grado de criticidad: MÁXIMO**

---

### 3.2 — `Role` es global y no tiene aislamiento por tenant

**Archivo:** `apps/api/prisma/schema.prisma` — líneas 362-369

**Hallazgo:** `Role` con `name @unique` es una tabla global. `UserRole` vincula User → Role sin pasar por institución.

```prisma
model Role {
  id    String     @id @default(cuid())
  name  String     @unique  // ← Global, sin institutionId
  users UserRole[]
}

model UserRole {
  id     String @id @default(cuid())
  userId String
  roleId String
  // ... NO tiene institutionId
}
```

**Impacto:**
- Un usuario con rol `DOCENTE` lo tiene para TODAS las instituciones donde exista su `InstitutionUser`.
- El JWT incluye `roles: roleNames` como array plano de strings, sin distinción por institución.
- Si un usuario es DOCENTE en institución A y COORDINADOR en B, el JWT lleva AMBOS roles.
- El `RolesGuard` no distingue cuál rol aplica a cuál institución.

**Vector de ataque:** Un docente de institución A que también es coordinador en institución B podría acceder a endpoints de coordinador en institución A.

---

### 3.3 — `RolesGuard` no valida `institutionId` del JWT contra el recurso solicitado

**Archivo:** `apps/api/src/modules/auth/guards/roles.guard.ts` — líneas 10-41

```typescript
canActivate(context: ExecutionContext): boolean {
  const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  const request = context.switchToHttp().getRequest();
  const user = request.user as { roles?: string[] | any[] } | undefined;

  let roles: string[] = [];
  if (user?.roles) {
    roles = user.roles.map((r: any) => {
      if (typeof r === 'string') return r;
      if (r?.role?.name) return r.role.name;
      if (r?.name) return r.name;
      return '';
    }).filter(Boolean);
  }

  const hasRole = requiredRoles.some((r) => roles.includes(r));
  // ← Solo verifica presencia del rol, NO verifica institución
  
  if (!hasRole) {
    throw new ForbiddenException(`Acceso denegado...`);
  }
  return true;
}
```

**Impacto:** El guard solo verifica que el array `roles` del usuario contenga alguno de los roles requeridos. **No verifica que esos roles apliquen a la institución del recurso que se está accediendo.** Combinado con el punto 3.2, esto es un vector de escalación real.

**Nota positiva:** El `CapabilitiesGuard` SÍ valida `institutionId`, pero solo se usa en endpoints que requieren capabilities específicas, no en todos.

---

### 3.4 — `StudentGrade.score` limitado a `Decimal(3,1)` — máximo 99.9

**Archivo:** `apps/api/prisma/schema.prisma` — línea 1659

```prisma
model StudentGrade {
  score  Decimal  @db.Decimal(3, 1)  // ← Máximo: 99.9
}
```

**Tablas afectadas con la misma limitación:**
- `StudentGrade.score` — Decimal(3,1)
- `PeriodFinalGrade.grade` — Decimal(3,1)
- `PeriodFinalGrade.recoveryGrade` — Decimal(3,1)
- `PartialGrade.score` — Decimal(3,1)
- `FinalComponentGrade.grade` — Decimal(3,1)
- `PeriodRecovery.previousGrade` / `newGrade` — Decimal(3,1)
- `FinalRecoveryPlan.previousGrade` / `newGrade` — Decimal(3,1)
- `ClassroomActivity.maxScore` — Decimal(3,1)
- `ActivitySubmission.score` — Decimal(3,1)

**Impacto:** Si alguna institución usa escala 0-100 (el diseño del `InstitutionRulesContext` lo permite con `minGrade`/`maxGrade` dinámicos), **las notas de 100.0 no caben** en Decimal(3,1). Se trunca o falla silenciosamente.

**Solución requerida:** Migrar a `Decimal(5,2)` para cubrir 0-100 con 2 decimales, o al menos `Decimal(4,1)`.

---

### 3.5 — `bulkUpsert` en `StudentGradesService` ejecuta N queries seriales (N+1)

**Archivo:** `apps/api/src/modules/evaluation/student-grades.service.ts` — líneas 33-45

```typescript
async bulkUpsert(evaluativeActivityId: string, grades: { ... }[]) {
  const results = await Promise.all(
    grades.map((g) =>
      this.upsert({  // ← Cada upsert hace 1 findUnique + 1 upsert = 2 queries
        studentEnrollmentId: g.studentEnrollmentId,
        evaluativeActivityId,
        score: g.score,
        observations: g.observations,
      }),
    ),
  );
  return results;
}
```

**El método `upsert` interno hace:**
1. `prisma.studentEnrollment.findUnique()` para obtener `institutionId`
2. `prisma.studentGrade.upsert()` para crear/actualizar la nota

**Para un grupo de 40 estudiantes = 80 queries por guardado de notas de una actividad.**

**Impacto:** No escala a 500 colegios con miles de docentes guardando notas simultáneamente. Cada guardado genera una ráfaga de queries que saturan el connection pool de PostgreSQL.

---

### 3.6 — `calculateAnnualGrade` tiene N+1 severo

**Archivo:** `apps/api/src/modules/evaluation/student-grades.service.ts` — líneas 288-361

```typescript
async calculateAnnualGrade(studentEnrollmentId, teacherAssignmentId, academicYearId) {
  // 1 query: obtener períodos
  const terms = await this.prisma.academicTerm.findMany({ where: { academicYearId } });

  // N queries: calcular nota de cada período
  const termSources = await Promise.all(
    terms.map(async (term) => {
      const result = await this.calculateTermGrade(  // ← Cada uno hace 1-3 queries
        studentEnrollmentId, teacherAssignmentId, term.id,
      );
      return { ... };
    }),
  );

  // 1 query: obtener componentes finales
  const finalComponents = await this.prisma.finalComponent.findMany({ ... });

  // M queries: obtener nota de cada componente final
  const componentSources = await Promise.all(
    finalComponents.map(async (fc) => {
      const gradeRecord = await this.prisma.finalComponentGrade.findUnique({ ... });
      return { ... };
    }),
  );
}
```

**Para un boletín anual de 40 estudiantes × 10 asignaturas × 4 períodos:**
- 40 × 10 = 400 llamadas a `calculateAnnualGrade`
- Cada una: 1 + 4×(1-3) + 1 + M = ~18 queries mínimo
- **Total: ~7,200 queries para generar boletines de UN grupo.**

**Nota positiva:** Existe la variante `calculateTermGradeFromPreloaded` que opera en memoria (0 queries). Pero solo se usa en `buildGroupReportCards`, no en todos los flujos.

---

## 4. RIESGOS MEDIOS

### 4.1 — `onDelete: Cascade` en `Institution` propaga borrado masivo

**Hallazgo:** Prácticamente todas las tablas hijas de `Institution` usan `onDelete: Cascade`. Un `DELETE` en Institution elimina:
- Todos los años académicos y períodos
- Todas las matrículas y notas
- Todos los boletines y snapshots
- Toda la asistencia
- Todos los datos financieros
- Todas las aulas virtuales
- Todos los foros y entregas
- Todos los documentos institucionales

**Sin posibilidad de rollback parcial** — es una operación atómica de PostgreSQL.

**Recomendación:** `onDelete: Restrict` en Institution → hijos críticos. Usar soft-delete (`isActive = false`, `deletedAt`) para instituciones.

---

### 4.2 — `InstitutionUser` y `UserRole` usan `onDelete: Cascade` desde `User`

**Hallazgo:** Si se borra un `User`, se eliminan TODOS sus `UserRole` y `InstitutionUser`. Un docente eliminado pierde sus roles y membresías sin auditoría.

**Nota positiva:** `TeacherAssignment.teacherId` usa `onDelete: Restrict` — esto impide borrar un docente que tenga asignaciones activas. Buen blindaje parcial.

---

### 4.3 — JWT sin expiración explícita visible

**Archivo:** `apps/api/src/modules/auth/jwt.strategy.ts`

```typescript
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
});
```

El strategy tiene `ignoreExpiration: false` (correcto), pero no se observa la configuración de `expiresIn` en el `JwtModule.register()`. Si no se configura explícitamente, los tokens JWT podrían tener una vida muy larga o depender de defaults.

**Recomendación:** Verificar que `JwtModule` tenga `signOptions: { expiresIn: '8h' }` o similar. Implementar refresh tokens.

---

### 4.4 — `register` endpoint potencialmente expuesto sin restricción de roles

**Archivo:** `apps/api/src/modules/auth/auth.service.ts` — líneas 16-36

```typescript
async register(dto: RegisterDto) {
  const user = await this.usersService.createUser({
    email: dto.email,
    password: dto.password,
    firstName: dto.firstName,
    lastName: dto.lastName,
    roles: dto.roles,  // ← Acepta roles directamente del DTO
  });
}
```

**Impacto:** Si el endpoint `POST /auth/register` está expuesto públicamente (sin guard), cualquier persona podría registrarse con rol `ADMIN_INSTITUTIONAL`, `RECTOR`, o `SUPERADMIN`.

**Verificar:** Que el controller tenga `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles('SUPERADMIN')` o similar.

---

### 4.5 — `FinancialSettings.electronicProviderKey` almacena API Key en texto plano

**Archivo:** `apps/api/prisma/schema.prisma` — línea 3930

```prisma
model FinancialSettings {
  electronicProviderKey String?   // API Key del proveedor (encriptada) ← DICE "encriptada" pero es String plano
}
```

**Impacto:** Si la base de datos es comprometida (backup filtrado, SQL injection, acceso no autorizado), las API keys de facturación electrónica de TODOS los colegios quedan expuestas.

**Recomendación:** Encriptar con AES-256-GCM a nivel de aplicación, key maestra en variable de entorno.

---

### 4.6 — `ForumPost` y tablas de Aula Virtual sin `institutionId` directo

**Archivo:** `apps/api/prisma/schema.prisma` — líneas 4845-4867

**Tablas afectadas:**
- `ForumPost` — sin institutionId (depende de Classroom → Institution)
- `ClassroomSection` — sin institutionId (depende de Classroom → Institution)
- `ClassroomMaterial` — sin institutionId (depende de Section → Classroom → Institution)
- `ClassroomAnnouncement` — sin institutionId (depende de Classroom → Institution)
- `ActivityQuestion` — sin institutionId (depende de Activity → Classroom → Institution)
- `QuestionAnswer` — sin institutionId (depende de Submission → Activity → Classroom → Institution)
- `LiveSession` — tiene classroomId pero no institutionId directo
- `LiveSessionAnswer` — sin institutionId
- `LiveSessionTeam` — sin institutionId
- `LiveSessionTeamMember` — sin institutionId

**Impacto:** Una query directa a cualquiera de estas tablas sin JOIN a Classroom no filtra por tenant. Si un servicio hace `prisma.forumPost.findMany({ where: { authorId } })`, obtiene posts de TODAS las instituciones donde el autor participa.

---

### 4.7 — `PeriodRecovery.subjectId` usa `onDelete: Cascade`

**Hallazgo:** Si se borra una asignatura del catálogo, se eliminan TODAS las recuperaciones asociadas a esa asignatura sin auditoría ni aviso.

**Contraste:** `PeriodFinalGrade.subjectId` usa `onDelete: Restrict` (correcto — impide borrar asignatura con notas). `PeriodRecovery` debería tener la misma protección.

---

### 4.8 — `StudentPayment` y `PaymentTransaction` (módulo legacy de pagos) sin `institutionId` directo

**Archivo:** `apps/api/prisma/schema.prisma` — líneas 3216-3272

`StudentPayment` depende de `Student` → `Institution` y `PaymentEvent` → `Institution`, pero no tiene `institutionId` propio. `PaymentTransaction` depende de `StudentPayment`. Queries directas no filtran por tenant.

**Nota:** El módulo financiero nuevo (`FinancialObligation`, `FinancialPayment`, etc.) SÍ tiene `institutionId` directo en todas las tablas. Solo el módulo legacy tiene esta brecha.

---

## 5. RIESGOS LEVES

### 5.1 — `Student.documentType` es `String` en vez de enum `DocumentType`

**Archivo:** `apps/api/prisma/schema.prisma` — línea ~1225

El modelo `Student` usa `documentType String` mientras que `User` usa `documentType DocumentType?`. Esto permite valores arbitrarios como "CC", "cc", "cedula", "CEDULA" sin validación.

### 5.2 — `Guardian.documentType` también es `String`

**Archivo:** `apps/api/prisma/schema.prisma` — línea ~1366

Mismo problema que Student. Debería usar el enum `DocumentType` para consistencia.

### 5.3 — `ActaRecord.actaType` es `String` en vez de enum

**Archivo:** `apps/api/prisma/schema.prisma` — línea ~1941

Permite valores arbitrarios para el tipo de acta. Debería ser un enum `ActaType`.

### 5.4 — `ObserverReferral.referredToRole` es `String` libre

**Archivo:** `apps/api/prisma/schema.prisma` — línea ~2016

Podría contener valores inválidos como "coordinadorr" (typo) sin validación.

### 5.5 — `WorkspaceItem.studentId` apunta a `User`, no a `Student`

**Archivo:** `apps/api/prisma/schema.prisma` — líneas 4576, 4590

```prisma
model WorkspaceItem {
  studentId  String?
  student    User?  @relation("WorkspaceItemStudent", fields: [studentId], references: [id])
  // ← Apunta a User, no a Student ni StudentEnrollment
}
```

El workspace vincula items a `User` en vez de a `Student` o `StudentEnrollment`. Esto rompe la consistencia del modelo de datos si el perfil de estudiante cambia (ej: si se elimina el Student pero el User persiste).

### 5.6 — Índices potencialmente redundantes

Tablas como `AttendanceRecord` tienen:
- `@@index([studentEnrollmentId, date])` — índice compuesto
- `@@index([studentEnrollmentId])` — índice simple

El índice compuesto ya cubre consultas por `studentEnrollmentId` solo (PostgreSQL usa el prefijo del índice compuesto). El índice simple es redundante y ocupa espacio.

**Tablas con posible redundancia similar:**
- `StudentGrade`: `@@index([studentEnrollmentId])` + `@@index([studentEnrollmentId, evaluativeActivityId])`
- `ScheduleEntry`: `@@index([groupId])` + `@@unique([groupId, timeBlockId, dayOfWeek])`

### 5.7 — `SupportActivity` y `SupportProgressLog` sin `institutionId`

Dependen de `PedagogicalSupportPlan` → `Institution`. No tienen aislamiento directo. Queries directas no filtran por tenant.

### 5.8 — `WorkspaceColumn` sin `institutionId`

Depende de `WorkspaceBoard` → `Institution`. Query directa sin JOIN no filtra por tenant.

---

## 6. VACÍOS ESTRUCTURALES

### 6.1 — Sin tabla de Audit Log general

**Estado actual de auditoría:**

| Módulo | Tiene auditoría | Modelo |
|--------|----------------|--------|
| Matrículas | ✅ | `EnrollmentEvent` |
| Permisos | ✅ | `PermissionAuditLog` |
| Elecciones | ✅ | `ElectionAuditLog` |
| APD | ✅ | `ApdAuditLog` |
| Boletines | ✅ (parcial) | `TermReopeningRecord` |
| Cambio de notas | ✅ (parcial) | `PerformanceManualEdit` |
| Config institucional | ❌ | — |
| Estructura académica | ❌ | — |
| Notas (CRUD) | ❌ | — |
| Actividades evaluativas | ❌ | — |
| Datos financieros | ❌ (solo voidedAt) | — |
| Login/logout | ❌ | — |
| Intentos fallidos de login | ❌ | — |
| Cambios de contraseña | ❌ | — |
| Cambios de roles | ❌ | — |
| Eliminación de registros | ❌ | — |

**Impacto:** Ante un incidente de seguridad o disputa académica, no hay forma de rastrear quién cambió qué, cuándo, ni qué valor tenía antes.

---

### 6.2 — Sin versionamiento de configuración institucional

Los campos JSON en `Institution` se sobrescriben sin historial:
- `gradingConfig` (configuración de calificación)
- `academicLevelsConfig` (niveles académicos)
- `periodsConfig` (configuración de períodos)

**Impacto:** Si un admin cambia la escala de calificación a mitad de año (de 1-5 a 1-10), no hay forma de saber cuál era la escala anterior ni cuándo cambió.

---

### 6.3 — Sin tabla de `NotificationQueue` o `NotificationLog`

`FinancialSettings` tiene campos como `sendPaymentReminders` y `reminderDaysBefore`, pero no existe infraestructura de notificaciones (push, email, SMS). No hay:
- Cola de notificaciones pendientes
- Log de notificaciones enviadas
- Preferencias de notificación por usuario
- Templates de notificación por institución

---

### 6.4 — Sin `DeletedRecord` o papelera de reciclaje

`Student` tiene soft-delete (`isActive`, `deletedAt`), pero no hay mecanismo general de papelera.

**Modelos sin soft-delete que deberían tenerlo:**
- `Area` — borrar cascadea a Subject → TemplateSubject
- `Subject` — borrar cascadea a TemplateSubject
- `EvaluationComponent` — borrar afecta actividades
- `TeacherAssignment` — borrar cascadea a Classroom completo
- `PaymentEvent` — borrar cascadea a StudentPayment
- `ManagementTask` — borrar cascadea a TaskAssignment

---

### 6.5 — Sin tabla de sesiones activas

No hay control de sesiones concurrentes. Un usuario podría tener N sesiones simultáneas sin límite. No hay forma de:
- Ver sesiones activas
- Cerrar sesiones remotamente
- Limitar sesiones por rol
- Detectar sesiones sospechosas (diferentes IPs simultáneas)

---

### 6.6 — Sin rate limiting visible

No se observa middleware de rate limiting en la aplicación. Endpoints vulnerables:
- `POST /auth/login` — fuerza bruta de contraseñas
- `POST /auth/register` — creación masiva de cuentas
- `POST /*/bulk-*` — operaciones de carga masiva
- `GET /reports/*` — generación de PDFs (CPU intensivo)

---

### 6.7 — Sin validación de contraseña fuerte

**Archivo:** `apps/api/src/modules/auth/auth.service.ts`

El servicio de `changePassword` no valida complejidad de la nueva contraseña (longitud mínima, caracteres especiales, etc.). Solo hashea y guarda.

---

### 6.8 — Sin CORS configuration visible en el análisis

No se encontró middleware CORS explícito en los archivos analizados. Si no está configurado, el API podría aceptar requests de cualquier origen.

---

## 7. PUNTOS QUE PUEDEN ROMPER OTROS MÓDULOS

### 7.1 — Eliminar un `EvaluationComponent` rompe notas

**Cadena de dependencia:**
```
EvaluationComponent
  └── EvaluativeActivity (Restrict) ← Protegido
  └── EvaluationPlanComponentWeight (Restrict) ← Protegido
  └── PartialGrade.componentType (String, sin FK) ← NO PROTEGIDO
```

`PartialGrade.componentType` es un String que referencia `EvaluationComponent.code`, pero NO es una FK. Si se elimina el componente y se crea uno nuevo con código diferente, las notas parciales quedan huérfanas sin match.

---

### 7.2 — Eliminar una `Area` propaga destrucción

**Cadena de cascada:**
```
Area (DELETE)
  └── Subject (Cascade) → se borran TODAS las asignaturas del área
       └── TemplateSubject (Cascade) → se borran configuraciones de plantilla
       └── GroupSubjectException (Cascade) → se borran excepciones
       └── RoomRestriction (Cascade) → se borran restricciones de espacio
  └── TemplateArea (Cascade) → se borran áreas de plantilla
  └── EnrollmentArea.areaId → SetNull (sobrevive pero pierde referencia)
  └── EnrollmentSubject.subjectId → SetNull (sobrevive pero pierde referencia)
```

**Impacto:** Borrar un área del catálogo destruye toda la estructura académica asociada. Los snapshots de matrícula sobreviven pero con `areaId = null`.

---

### 7.3 — Eliminar `TeacherAssignment` destruye Aula Virtual completa

**Cadena de cascada:**
```
TeacherAssignment (DELETE)
  └── Classroom (Cascade)
       └── ClassroomSection (Cascade)
            └── ClassroomMaterial (Cascade)
            └── ClassroomActivity (Cascade)
                 └── ActivityQuestion (Cascade)
                      └── QuestionAnswer (Cascade)
                      └── LiveSessionAnswer (Cascade)
                 └── ActivitySubmission (Cascade)
                      └── QuestionAnswer (Cascade)
                 └── ForumPost (Cascade)
                 └── ActivityAssignment (Cascade)
                 └── LiveSession (Cascade)
                      └── LiveSessionAnswer (Cascade)
                      └── LiveSessionTeam (Cascade)
                           └── LiveSessionTeamMember (Cascade)
       └── ClassroomAnnouncement (Cascade)
       └── ForumPost (Cascade)
       └── LiveSession (Cascade)
```

**Impacto:** Si se termina una asignación docente y alguien borra el `TeacherAssignment`, se pierde TODO el contenido del aula virtual: materiales, actividades, entregas de estudiantes, foros, quizzes, sesiones live. **Pérdida total de contenido pedagógico.**

**Solución:** Cambiar `Classroom → TeacherAssignment` de `Cascade` a `Restrict`.

---

### 7.4 — `AcademicYear` Cascade destruye datos de todo el año

**Cadena de cascada:**
```
AcademicYear (DELETE)
  └── Period (Cascade)
  └── AcademicTerm (Cascade)
       └── TermReportCardSnapshot (Cascade) ← Boletines legales
       └── TermReopeningRecord (Cascade) ← Historial de reaperturas
       └── PeriodFinalGrade (Cascade) ← Notas finales
       └── EvaluativeActivity (Cascade) ← Actividades evaluativas
       └── PreventiveAlert (Cascade) ← Alertas preventivas
  └── TeacherAssignment (Cascade) → Classroom (Cascade) → TODO
  └── StudentEnrollment (Cascade) → Notas, asistencia, snapshots
  └── ScheduleEntry (Cascade) → Horarios
  └── ScheduleGradeConfig (Cascade)
  └── ScheduleGenerationContext (Cascade)
  └── TeacherAvailability (Cascade)
```

**Impacto:** Borrar un año académico es equivalente a borrar TODOS los datos académicos de ese año para toda la institución.

---

### 7.5 — Aula Virtual acoplada fuertemente al Core Académico

**Punto de acoplamiento:** `Classroom.teacherAssignmentId @unique`

Esto significa:
- Un aula virtual solo puede existir si existe la asignación docente
- Si cambia el docente de una asignatura, el aula virtual cambia de "dueño"
- No puede existir un aula virtual independiente de la estructura académica
- El contenido pedagógico está atado al ciclo de vida de la asignación

---

## 8. MAPA DE DEPENDENCIAS INTER-MÓDULO

```
┌─────────────────────────────────────────────────────────────────┐
│                       INSTITUTION (Tenant)                       │
│  Todas las tablas dependen de Institution via institutionId     │
│  EXCEPTO: Grade, Dimension, Role, UserRole, ForumPost,         │
│  ClassroomSection, ClassroomMaterial, ActivityQuestion,         │
│  QuestionAnswer, LiveSession*, WorkspaceColumn                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
   ┌────▼────┐        ┌────▼────┐         ┌─────▼─────┐
   │ ACADEMIC │        │   IAM   │         │  FINANCE  │
   │  CORE   │        │(Users,  │         │(Payments, │
   │         │        │ Roles)  │         │ Invoices) │
   └────┬────┘        └────┬────┘         └───────────┘
        │                  │                    
   ┌────┼──────────────────┤
   │    │                  │
┌──▼──┐ ┌──▼───┐    ┌─────▼──────┐    ┌──────────────┐
│EVAL │ │ENROLL│    │ATTENDANCE  │    │ TEACHER      │
│(Gra-│ │(Matr-│    │(Asistencia)│    │ WORKSPACE    │
│des) │ │ículas│    │            │    │ (Aislado)    │
└──┬──┘ └──┬───┘    └────────────┘    └──────────────┘
   │       │
   ├───────┤
   │       │
┌──▼───────▼──┐    ┌──────────┐    ┌──────────────────┐
│   REPORTS   │    │ RECOVERY │    │ VIRTUAL CLASSROOM │
│  (Boletines)│    │(Recupera-│    │ (Aula Virtual)    │
│             │◄───┤ciones)   │    │ ACOPLADO a        │
└─────────────┘    └──────────┘    │ TeacherAssignment │
                                   └──────────────────┘
   ┌──────────┐    ┌──────────┐    ┌──────────────────┐
   │OBSERVER  │    │ELECTIONS │    │  TIMETABLING     │
   │(Observa- │    │(Gobierno │    │  (Horarios)      │
   │ dor)     │    │ escolar) │    │                  │
   └──────────┘    └──────────┘    └──────────────────┘
   
   ┌──────────┐    ┌──────────┐    ┌──────────────────┐
   │   APD    │    │COMMUNICA-│    │   MANAGEMENT     │
   │(Acompaña-│    │TIONS     │    │   TASKS          │
   │miento)   │    │(Mensajes)│    │   (Tareas)       │
   └──────────┘    └──────────┘    └──────────────────┘
```

### Dependencias críticas:
- **Reports** depende de: Evaluation, Enrollment, Attendance, AcademicYear, InstitutionContext, Storage
- **Evaluation** depende de: Enrollment, AcademicYear, TeacherAssignment
- **Virtual Classroom** depende de: TeacherAssignment (FUERTEMENTE ACOPLADO)
- **Recovery** depende de: Evaluation, PeriodFinalGrade
- **APD** depende de: Enrollment, AcademicTerm, Achievement
- **Timetabling** depende de: TeacherAssignment, Group, Shift, AcademicYear

### Módulos aislados (bajo acoplamiento):
- **Teacher Workspace** — Solo depende de User e Institution
- **Elections** — Módulo autocontenido con su propia auditoría
- **Communications** — Solo depende de User e Institution
- **Documents** — Solo depende de User, Institution, Storage

---

## 9. RECOMENDACIONES DE BLINDAJE

### PRIORIDAD 1 — Urgente (Afectan seguridad o integridad de datos)

| # | Recomendación | Riesgo que mitiga | Esfuerzo estimado |
|---|---------------|-------------------|-------------------|
| 1 | Agregar `institutionId` a `Grade` y `Dimension`. Cambiar `@@unique` a incluir institutionId. Migrar datos existentes. | 3.1 — Fuga de tenant | Alto (migración de datos) |
| 2 | Vincular roles a institución. Crear `InstitutionUserRole` o incluir `institutionId` por rol en JWT. Modificar `RolesGuard`. | 3.2, 3.3 — Escalación de privilegios | Alto (cambio transversal) |
| 3 | Cambiar `Decimal(3,1)` a `Decimal(5,2)` en TODAS las tablas de notas. | 3.4 — Truncamiento de notas | Medio (migración de columnas) |
| 4 | Cambiar `Classroom → TeacherAssignment` de `Cascade` a `Restrict`. | 7.3 — Destrucción de aula virtual | Bajo (1 línea en schema) |
| 5 | Cambiar `Institution → AcademicYear/Campus/Area` de `Cascade` a `Restrict`. | 4.1, 7.4 — Borrado masivo | Bajo (3 líneas en schema) |

### PRIORIDAD 2 — Importante (Mejoran resiliencia y trazabilidad)

| # | Recomendación | Riesgo que mitiga | Esfuerzo estimado |
|---|---------------|-------------------|-------------------|
| 6 | Crear tabla `AuditLog` centralizada con `institutionId, userId, action, entityType, entityId, previousValue, newValue, ipAddress, createdAt`. | 6.1 — Sin auditoría general | Medio |
| 7 | Versionar configuración institucional: crear `InstitutionConfigHistory`. | 6.2 — Pérdida de historial | Medio |
| 8 | Encriptar `FinancialSettings.electronicProviderKey` con AES-256-GCM. | 4.5 — API keys expuestas | Bajo-Medio |
| 9 | Optimizar `bulkUpsert`: reemplazar N upserts con `$transaction` + `$executeRaw` usando `ON CONFLICT`. | 3.5 — 80 queries por guardado | Medio |
| 10 | Agregar `institutionId` a tablas de Aula Virtual (ForumPost, ClassroomSection, ClassroomMaterial, etc.). | 4.6 — Queries sin filtro de tenant | Medio (migración) |
| 11 | Cambiar `PeriodRecovery.subjectId` de `Cascade` a `Restrict`. | 4.7 — Pérdida de recuperaciones | Bajo (1 línea) |

### PRIORIDAD 3 — Mejora (Hardening general)

| # | Recomendación | Riesgo que mitiga | Esfuerzo estimado |
|---|---------------|-------------------|-------------------|
| 12 | Agregar rate limiting (5 intentos/min en login, 100 req/min general). | 6.6 — Fuerza bruta | Bajo (middleware) |
| 13 | Proteger `register` con guard de SuperAdmin o eliminar `roles` del DTO público. | 4.4 — Auto-asignación de roles | Bajo |
| 14 | Estandarizar `Student.documentType` y `Guardian.documentType` a enum `DocumentType`. | 5.1, 5.2 — Inconsistencia | Bajo (migración) |
| 15 | Agregar soft-delete a `Area`, `Subject`, `EvaluationComponent`. | 6.4 — Sin papelera | Medio |
| 16 | Implementar control de sesiones (tabla `ActiveSession`). | 6.5 — Sesiones sin límite | Medio |
| 17 | Validar complejidad de contraseña en `changePassword`. | 6.7 — Contraseñas débiles | Bajo |
| 18 | Verificar configuración CORS explícita. | 6.8 — CORS abierto | Bajo |
| 19 | Eliminar índices redundantes (5.6). | 5.6 — Espacio desperdiciado | Bajo |
| 20 | Cambiar `WorkspaceItem.studentId` para apuntar a `Student` en vez de `User`. | 5.5 — Inconsistencia | Bajo-Medio |

---

## 10. NIVEL GENERAL DE MADUREZ ARQUITECTÓNICA

| Dimensión | Nota (1-10) | Observación |
|-----------|-------------|-------------|
| **Modelo de datos** | **8.0** | Excelente diseño relacional. Snapshots inmutables de matrícula son arquitectura de primer nivel. Enums bien definidos. ~100 modelos coherentes. |
| **Aislamiento multi-tenant** | **5.0** | `institutionId` presente en ~90% de tablas críticas con relaciones RLS explícitas. Pero `Grade`, `Dimension`, `Role` son globales — brecha seria. Aula virtual sin aislamiento directo. |
| **Seguridad** | **5.5** | JWT + Guards + institution-resolver es buen esqueleto. Roles no vinculados a institución = vector de escalación. Sin rate limiting. Sin auditoría de login. Sin control de sesiones. |
| **Integridad referencial** | **7.5** | Uso correcto de `Restrict` en relaciones críticas (TeacherAssignment.teacherId, StudentGrade.evaluativeActivityId). Pero ~60% de relaciones usan `Cascade` donde `Restrict` sería más seguro. |
| **Optimización de queries** | **6.5** | Variantes `Preloaded` demuestran conciencia del N+1. Pero `bulkUpsert`, `calculateAnnualGrade` siguen con N+1. Índices bien colocados en general (algunos redundantes). |
| **Flujo académico** | **8.5** | Ciclo de vida DRAFT→OPEN→CLOSED→FINALIZED con snapshots legales. Reapertura con versionamiento. Motor de reglas puro. Doble fuente (PartialGrade con fallback a StudentGrade). Arquitectura ejemplar. |
| **Modularidad** | **7.5** | 30+ módulos NestJS bien separados. Teacher Workspace correctamente aislado. Aula Virtual fuertemente acoplada a TeacherAssignment. Finance independiente. Engines puros sin dependencia de DB. |
| **Auditoría y trazabilidad** | **5.0** | Excelente en elecciones, permisos, y APD. Inexistente en configuración institucional, cambios de notas, estructura académica. Sin log general. |
| **Escalabilidad** | **6.0** | Escala bien a ~50 colegios. A 500+: Grade/Dimension global colapsa, bulk N+1 genera carga, cálculos en tiempo real necesitan materialización o cache. |
| **Preparación para producción** | **7.0** | Migraciones con baseline limpio, Cloudflare R2, Railway deploy, bcrypt para passwords. Falta rate limiting, encriptación de secrets en DB, control de sesiones, CORS explícito. |

### NOTA GLOBAL: 6.7 / 10

### Interpretación:
- **8-10:** Producción enterprise, listo para auditoría SOC2/ISO27001
- **6-8:** Producción viable con riesgos manejables, necesita hardening
- **4-6:** MVP funcional con brechas críticas
- **< 4:** Requiere rediseño significativo

**Edusyn está en la franja alta de "Producción viable con riesgos manejables".** Las bases son sólidas y las decisiones de diseño son maduras. Los riesgos identificados son corregibles sin rediseño fundamental. Corregir los 5 puntos de Prioridad 1 elevaría la nota a ~8/10 y posicionaría el sistema para escalar con confianza a cientos de instituciones.

---

## 11. ANEXO: ARCHIVOS AUDITADOS

### Schema
- `apps/api/prisma/schema.prisma` — 4,949 líneas (leído completo, líneas 1-4949)

### Seguridad
- `apps/api/src/modules/auth/jwt.strategy.ts` — 32 líneas
- `apps/api/src/modules/auth/guards/jwt-auth.guard.ts` — 6 líneas
- `apps/api/src/modules/auth/guards/roles.guard.ts` — 43 líneas
- `apps/api/src/modules/capabilities/capabilities.guard.ts` — 65 líneas
- `apps/api/src/common/utils/institution-resolver.ts` — 92 líneas
- `apps/api/src/modules/auth/auth.service.ts` — 133 líneas

### Servicios Core
- `apps/api/src/modules/evaluation/student-grades.service.ts` — 487 líneas (completo)
- `apps/api/src/modules/reports/reports.service.ts` — 3,358 líneas (primeras 100 líneas)

### Búsquedas transversales (grep)
- `institutionId.*req.user` → 85 coincidencias en 17 controllers
- `@UseGuards` → 94 coincidencias en 84 controllers
- `findMany|findFirst|findUnique` → 836 coincidencias en 91 servicios
- `@Param.*institutionId` → 11 coincidencias en 4 controllers
- `isSuperAdmin` → 17 coincidencias en 7 archivos

### Estructura de directorios
- `apps/api/src/modules/` — 30+ subdirectorios de módulos
- `apps/api/src/engines/` — Motores de reglas puros
- `apps/api/src/common/` — Utilidades compartidas
- `apps/api/src/prisma/` — Servicio Prisma

---

*Documento generado como parte de auditoría arquitectónica. No se modificó ni generó código durante este análisis.*
