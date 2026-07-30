# Auditoría técnica — Creación y configuración de una institución (Edusyn)

> Auditoría **de solo lectura**. No se modificó código ni se propusieron refactors en el cuerpo principal. Cada afirmación referencia el archivo/línea donde se verificó. Donde algo no pudo verificarse, se dice explícitamente.
> Fecha: 2026-07-22 · Rama: `staging`
> **Estado del árbol de trabajo al auditar:** hay cambios de "Fase 2 del cableado" (herencia de pesos de evaluación) **sin commitear**. Esta auditoría describe el estado **commiteado**; donde la Fase 2 en curso cambia algo, se marca como *(en curso, sin commitear)*.

---

## Resumen ejecutivo

- La creación de una institución la hace **solo el SuperAdmin** (`superadmin.service.ts:102`), en una transacción que crea: institución (en estado `TRIAL`, 30 días), módulos, escala de desempeño por defecto, usuario administrador, usuario rector y sus roles. **No crea** sedes, jornadas, año lectivo, grados, grupos, áreas ni asignaturas: la institución nace casi vacía y todo lo demás es manual posterior.
- **Hay tres rutas distintas que crean `Institution`** (`superadmin.service.ts:152`, `academic/institutions.service.ts:11`, `edusyn-play/.../play-workspace.service.ts:30`) → duplicación de lógica de creación.
- **Aislamiento multi-tenant PARCIAL (riesgo alto):** existe Row-Level Security real (interceptor `tenant-context.interceptor.ts` + función `current_institution_id()`), pero las políticas RLS **solo cubren tablas nuevas** (ABP, gamificación, auditoría). Las tablas **académicas núcleo** (Institution, Grade, Group, Student, StudentEnrollment, TeacherAssignment, PartialGrade, PeriodFinalGrade, EvaluationComponent, etc.) **no tienen RLS**: su aislamiento depende solo del `TenantGuard`, que es incompleto (ver Seguridad C-1).
- La configuración académica vive en **blobs JSON** (`gradingConfig`, `academicLevelsConfig`, `periodsConfig`) en la tabla `Institution` — sin esquema fuerte, con duplicidad frente a tablas relacionales que sí calculan.
- Los procesos de importación existen pero son frágiles y **no cubren el onboarding a mitad de año** (no hay forma de cargar el histórico de años/períodos anteriores como notas finales).

**Veredicto:** el núcleo de datos es correcto y utilizable, pero la *puesta en marcha* es manual, dispersa y con dos riesgos serios para producción: aislamiento multi-tenant incompleto en tablas núcleo, y triple implementación del cálculo de notas.

---

## Arquitectura encontrada

- **Backend:** NestJS + Prisma (PostgreSQL). Módulos en `apps/api/src/modules/*` (más de 40 módulos). Esquema único en `apps/api/prisma/schema.prisma` (~7.200 líneas).
- **Multi-tenant:** patrón "transaction-scoped RLS context" — cada request autenticado corre dentro de una transacción con `SET LOCAL app.current_institution` (`common/interceptors/tenant-context.interceptor.ts`). Guards globales `JwtAuthGuard`, `RolesGuard`, `TenantGuard` (`app.module.ts:102-107`).
- **Frontend:** `apps/web` (React + Vite + Tailwind).
- **Config académica:** híbrida — parte en columnas JSON de `Institution`, parte en tablas relacionales (`PerformanceScale`, `EvaluationComponent`, `AcademicTerm`, `Grade`).

---

## 1. Flujo actual — creación de institución

**Ruta:** `POST /superadmin/institutions` → `superadmin.controller.ts:83` → `superadmin.service.createInstitution()` (`superadmin.service.ts:102`).

Pasos (todo en una `$transaction`, `superadmin.service.ts:150-300`):
1. `verifySuperAdmin()` (solo SuperAdmin).
2. Valida unicidad de `slug` (`:106`) y de `adminEmail` (`:115`); valida datos de rector si es persona distinta (`:123-136`).
3. Hashea contraseña admin (bcrypt) y del rector (`:138-147`).
4. Crea `Institution` con `status='TRIAL'`, `trialEndsAt = now + 30 días`, `createdById` (`:152`).
5. Crea `InstitutionModule[]` según `dto.modules` (`:167`).
6. **Siembra `PerformanceScale` por defecto (0–5, Decreto 1290)** (`:179`) — para que ninguna institución nazca sin escala.
7. Obtiene/crea `Role ADMIN_INSTITUTIONAL` (`:192`).
8. Crea `User` admin con `mustChangePassword=true` (`:203`).
9. `UserRole` (global) + `InstitutionUser` (`isAdmin=true`) + `InstitutionUserRole` (dual-write por tenant) (`:217-239`).
10. Rol `RECTOR` y usuario rector: misma persona que el admin, o persona distinta con/sin login propio (`:241-287`).

**Lo que NO hace la creación:** no crea `Campus`, `Shift`, `AcademicYear`, `AcademicTerm`, `Grade`, `Group`, `Area`, `Subject`; deja `gradingConfig`, `academicLevelsConfig`, `periodsConfig` en `null`. → **La institución queda inoperable hasta configurar todo eso a mano** (verificable porque `validateYearForActivation` exige términos, escala y grupos antes de activar un año — `academic-year-lifecycle.service.ts:279-322`).

**Tablas que intervienen en la creación:** `Institution`, `InstitutionModule`, `PerformanceScale`, `Role`, `User`, `UserRole`, `InstitutionUser`, `InstitutionUserRole`.

**Duplicación:** hay **3 rutas** que hacen `institution.create`:
- `superadmin.service.ts:152` (oficial, completa).
- `academic/institutions.service.ts:11` (no verificado su propósito completo; parece ruta alterna).
- `edusyn-play/services/play-workspace.service.ts:30` (workspace personal de Edusyn Play).

---

## 2. Modelos (schema.prisma) y relaciones

| Modelo | Línea | Notas |
|---|---|---|
| `Institution` | 416 | Config en JSON (`gradingConfig`, `academicLevelsConfig`, `periodsConfig`) + columnas de reglas de área. `status`, `type`, `trialEndsAt`, `slug @unique`, `daneCode @unique` |
| `InstitutionModule` | 604 | Módulos habilitados por institución |
| `InstitutionUser` | 619 | Vínculo usuario↔institución (`isAdmin`, permisos delegados como `canManageStudents`) |
| `User` / `Role` / `UserRole` | 241 / 395 / 405 | Roles globales |
| `InstitutionUserRole` | (dual-write) | Roles por tenant |
| `Campus` | 660 | Sede (pertenece a institución) |
| `Shift` | 676 | Jornada (pertenece a campus) |
| `Grade` | 692 | Grado (institución + `stage` + `number` + `name`). Único correcto `@@unique([institutionId, stage, name])` |
| `Group` | 717 | Grupo (grade + campus + shift) |
| `Area` / `Subject` | 755 / 779 | Área → asignaturas |
| `AcademicTemplate` / `GradeTemplate` | 814 / 939 | Plantillas de plan de estudios por grado |
| `AcademicYear` | 993 | Año lectivo (`DRAFT/ACTIVE/CLOSED`) |
| `AcademicTerm` | 1093 | Período (`weightPercentage`, `status OPEN/CLOSED/FINALIZED`) |
| `TeacherAssignment` | 1224 | **Carga académica**: año+grupo+asignatura+docente (+`weeklyHours`, `endDate`) |
| `PerformanceScale` | ~1620 | Escala de desempeño (derivada de la config) |
| `EvaluationComponent` | 1321 | Estructura de evaluación jerárquica (`parentId`). *(en curso: +`weightPercentage`,`order`)* |
| `EvaluationPlan` / `EvaluationPlanComponentWeight` | 1305 / 1340 | Pesos por asignación (lo que calcula el boletín) |
| `Student` | 1362 | Estudiante (institución). Soft-delete: `isActive`, `deletedAt`, `deletedReason` |
| `Guardian` / `StudentGuardian` | 1507 / 1542 | Acudientes y su relación N:M con estudiantes |
| `StudentEnrollment` | 1580 | Matrícula (student+year+group, `status`, `enrollmentType`, `promotedFromId` 1:1) |
| `EnrollmentEvent` | (cerca 1650+) | Auditoría de matrícula (creación, promoción, retiro) |

**Cadena de relaciones núcleo:**
`Institution → Campus → Shift`; `Institution → Grade → Group (needs Campus+Shift)`; `Institution → Area → Subject`; `AcademicYear → AcademicTerm`; `TeacherAssignment = AcademicYear + Group + Subject + Teacher(User)`; `StudentEnrollment = Student + AcademicYear + Group`.

**No se encontró** un modelo `Tenant` explícito: el tenant **es** `Institution` (columna `institutionId` en las tablas hijas).

---

## 3. APIs (endpoints por controlador)

Conteo verificado (grep de decoradores HTTP). El detalle exacto de params/body/permiso por endpoint requiere abrir cada controlador — se listan los archivos para verificación:

| Controlador | # endpoints | Archivo |
|---|---|---|
| Institución (crear/editar/config global) | 11 | `superadmin/superadmin.controller.ts` |
| Institución (académico) | 3 | `academic/institutions.controller.ts` |
| Configuración (escala/períodos/niveles/procesos) | 12 | `institution-config/institution-config.controller.ts` |
| Grados | 8 | `academic/grades.controller.ts` *(incluye `/generate`, `/backfill-numbers` de Fase 1)* |
| Grupos | 4 | `academic/groups.controller.ts` |
| Asignaturas | 2 | `academic/subjects.controller.ts` |
| Áreas | 12 | `academic/areas.controller.ts` |
| Estudiantes | 19 | `academic/students.controller.ts` |
| Import de notas (Excel) | 7 | `iam/grades-bulk-import.controller.ts` |
| Carga masiva | 6 | `iam/bulk-upload.controller.ts` |

Ejemplo verificado (creación de institución):
- `POST /superadmin/institutions` · body `CreateInstitutionDto` (name, slug, daneCode, nit, modules[], adminEmail, adminPassword?, rector*) · respuesta `{ institution, admin:{tempPassword}, rector }` · permiso **SuperAdmin** (`superadmin.controller.ts:83`).

**No verificado exhaustivamente:** params/body/respuesta de los ~84 endpoints listados; se indica el archivo para auditarlos uno a uno si se requiere ese nivel de detalle.

---

## 4. Árbol de dependencias (orden obligado de configuración)

```
Institución (SuperAdmin)
 ├─ Usuario admin + rector           (se crean con la institución)
 ├─ Escala de desempeño              (se siembra por defecto)
 ├─ Sede (Campus)                    ← manual, requerido para grupos
 │    └─ Jornada (Shift)             ← requerida para grupos
 ├─ Área → Asignatura                ← manual
 ├─ Grado (Grade)                    ← manual (Fase 1 permite generar por nivel)
 │    └─ Grupo (Group)               ← requiere Grado + Campus + Jornada
 ├─ Config SIEE (escala/períodos/    ← JSON; períodos crean AcademicTerm
 │   procesos)
 ├─ Año lectivo (AcademicYear DRAFT) ← requiere períodos+escala+grupos para ACTIVAR
 │    └─ (activar) valida: ≥1 término, escala, ≥1 grupo
 ├─ Carga académica (TeacherAssignment) ← requiere Año+Grupo+Asignatura+Docente
 ├─ Estudiante (Student)             ← manual o import
 │    └─ Matrícula (StudentEnrollment) ← requiere Estudiante+Año+Grupo
 └─ Notas / asistencia               ← requieren TeacherAssignment + Matrícula
```
Verificación de dependencias duras: `groups.service` (grupo requiere grade/campus/shift), `academic-year-lifecycle.service.ts:279-322` (activación), `TeacherAssignment @@unique` (schema:1258), `StudentEnrollment` FKs (schema:1607+).

---

## 5. Validaciones

**Verificadas:**
- Unicidad: `slug`, `daneCode` (schema:419-421); `adminEmail`/`rectorEmail` (`superadmin.service.ts:115,132`); `Grade @@unique([institutionId, stage, name])` (schema); `StudentEnrollment (studentId, academicYearId)` (unique — verificar en schema); `TeacherAssignment @@unique([...])` (schema:1258).
- **Escala de desempeño bloqueante** ante solapes/huecos (`institution-config.service.ts` — `validateScaleRanges` + `assertDerivedScaleValid`) *(commit reciente)*.
- **Pesos de períodos y de componentes deben sumar 100%** (`institution-config.service.ts` `updatePeriods`/`updateGradingConfig`) *(commit reciente)*; en planes de evaluación (`evaluation-plans.service.ts:34`).
- Activación de año: períodos, escala, grupos (`academic-year-lifecycle.service.ts:279-322`).
- Cierre de año: recuperaciones finales pendientes bloquean (`:411-457`).
- Período `FINALIZED` bloquea edición de notas (`partial-grades.service.ts:16-27`).

**Ausentes/débiles (verificado):**
- Los DTOs usan `class-validator` de forma desigual; los blobs JSON de config **no se validan contra esquema** (`updateGradingConfig` escribe JSON crudo vía `$executeRaw`).
- `parseGrade` del import **no valida rango** de nota (`grades-bulk-import.service.ts:676`).

---

## 6. Configuración inicial mínima

Para que una institución **opere** (poder activar un año y calificar):

**Automático (al crear):** institución, admin, rector, roles, módulos, escala de desempeño por defecto.

**Obligatorio (manual, hoy):** ≥1 Sede, ≥1 Jornada, ≥1 Grado, ≥1 Grupo, escala/períodos SIEE (los períodos crean `AcademicTerm`), 1 Año lectivo activado, y para calificar: carga académica (`TeacherAssignment`) + matrículas. Fuente: `validateYearForActivation` (bloqueantes) + `TeacherAssignment` como advertencia (`:314-319`).

**Opcional:** logo, `primaryColor`, `nit`, `daneCode`, sitio web, teléfono, áreas/asignaturas si aún no se califica, APD, plantillas académicas.

---

## 7. Importaciones

**Import de notas por Excel** — `iam/grades-bulk-import.service.ts` (analizado a fondo en `AUDITORIA_ADVERSARIAL_PASE1B.md`):
- Detecta columnas por heurística (COG/PROC/ACT/DEF) con nombres de asignatura hardcodeados (`:530`). Genera plantilla oficial (`generateImportTemplate`, `:1370`).
- **Limitaciones:** solo escribe en el **año ACTIVO** (no hay carga de años anteriores); **ignora la columna DEFINITIVA** y recalcula la final como promedio simple; `parseGrade` no valida rango; emparejamiento difuso (Levenshtein) de estudiantes; acoplaba **borrado destructivo** de estudiantes al import *(mitigado a soft-delete en commit reciente)*.

**Carga masiva** — `iam/bulk-upload.controller.ts` (6 endpoints) + `bulk-upload.service.ts` + `bulk-upload-template.helper.ts`: no auditado en detalle en esta pasada (se referencia el archivo).

**Seeders:** `scripts/seed/` está **vacío** (solo `.gitkeep`); existen `scripts/seed-demo-grades.ts` y `scripts/seed-finance-demo.ts` (demo). **No existe** CSV genérico ni importador de estudiantes independiente del Excel de notas (no verificado lo contrario).

**Migraciones:** Prisma (`prisma/migrations/`), ~70 migraciones.

---

## 8. Carga académica

- Entidad central: **`TeacherAssignment`** (`schema:1224`) = `institutionId + academicYearId + groupId + subjectId + teacherId (+ weeklyHours, startDate, endDate, endReason)`.
- Relaciona: docente (User), grupo, asignatura, año. De ella cuelgan planes de evaluación, actividades, notas parciales, asistencia, horario (`scheduleEntries`), aula virtual (`classroom`).
- **Falta:** no hay validación de choques de horario aquí (vive en `timetabling`, no verificado su acople); no hay tope de horas por docente verificado.
- **Sobra/gotcha:** el cálculo de notas trata "asignaciones históricas" (mismo grupo+materia+año) migrando notas entre ellas — analizado como riesgo C-3 en `AUDITORIA_ADVERSARIAL_PASE1.md`.

---

## 9. Estudiantes

- **Creación:** `academic/students.service.ts` (19 endpoints en su controlador) y también dentro del import (`grades-bulk-import.service.ts:803` crea `Student` + `StudentEnrollment`).
- **Matrícula:** `StudentEnrollment` (student+year+group, `enrollmentType`, `status`, `shift`, `modality`, `promotedFromId` para trazar promoción). Auditoría vía `EnrollmentEvent`.
- **Usuarios de estudiante:** `Student.userId` opcional (`schema:1357`) → el estudiante puede tener o no login.
- **Acudientes:** `Guardian` + `StudentGuardian` (N:M) — un acudiente puede tener varios estudiantes y viceversa.
- **Soft-delete:** `Student.isActive/deletedAt/deletedReason`.
- **Relaciones académicas** cuelgan de la matrícula, no del estudiante (notas, asistencia, observador, recuperaciones) — correcto para historial por año.

---

## 10. Riesgos

**Altos:**
- **Triple implementación del cálculo de nota final** (`student-grades.service`, `partial-grades.service`, `grades-bulk-import.service`), divergentes; `AcademicRulesEngine` (motor "oficial") es **código muerto**. Ref: `AUDITORIA_ADVERSARIAL_PASE2.md` (RE-1).
- **Config en blobs JSON** sin esquema (`gradingConfig`, `academicLevelsConfig`, `periodsConfig`) → duplicidad y desincronización con tablas relacionales.
- **Duplicación de creación de institución** (3 rutas).
- **RLS parcial** (ver Multiinstitución).

**Medios:**
- Import frágil (heurística de columnas, sin validación de rango, DEFINITIVA ignorada).
- `scripts/seed/` vacío → onboarding real sin datos semilla reproducibles.
- Campos/relaciones potencialmente sin uso: no se hizo barrido exhaustivo de "campos sin uso" (no verificado); marcado como pendiente.

**Rendimiento:** el boletín por grupo resuelve nota canónica por período×estudiante (posible N+1, `resolveCanonicalPeriodGrade`) — señalado en Pase 1. No se hizo profiling real (requiere entorno con datos).

---

## 11. Multiinstitución (aislamiento por tenant)

**Mecanismo:** `tenant-context.interceptor.ts` abre una transacción por request y hace `SET LOCAL app.current_institution`; función SQL `current_institution_id()`; políticas `CREATE POLICY "tenant_isolation" ... USING ("institutionId" = current_institution_id())`.

**Cobertura verificada (RLS real, `ENABLE + FORCE ROW LEVEL SECURITY`):** solo tablas **nuevas** —
`Abp*` (12 tablas), `GradeAuditEvent`, `AttendanceAuditEvent`, `LearningIdentity`, `LearningRoute`, `LearningRouteStep`, `LearningBadgeAward`, `CompetencyEvidence`, `XpEvent`.

**⚠ SIN RLS (verificado por ausencia en las migraciones):** las tablas **académicas núcleo** — `Institution`, `Campus`, `Shift`, `Grade`, `Group`, `Area`, `Subject`, `AcademicYear`, `AcademicTerm`, `TeacherAssignment`, `Student`, `StudentEnrollment`, `Guardian`, `PartialGrade`, `PeriodFinalGrade`, `StudentGrade`, `EvaluationComponent`, `EvaluationPlan`, `PerformanceScale`, `InstitutionUser`.

**Implicación:** para el núcleo académico el aislamiento depende **exclusivamente** del `TenantGuard` de aplicación, que solo bloquea cuando el request trae `institutionId` explícito; si el recurso se identifica por otro id (`studentEnrollmentId`, `teacherAssignmentId`, `id`), **no valida** → fuga cross-tenant posible (C-1, `AUDITORIA_ADVERSARIAL_PASE1.md`). Es decir: **el diseño RLS es correcto, pero está aplicado a las tablas menos críticas y falta en las más críticas.**

---

## 12. Seguridad

- **Autenticación:** JWT (`auth/jwt.strategy.ts`, `jwt-auth.guard.ts`), bcrypt, `mustChangePassword` en primer login.
- **Autorización:** `RolesGuard` + `@Roles(...)`; roles globales (`Role`/`UserRole`) y por tenant (`InstitutionUserRole`); permisos delegados en `InstitutionUser` (`canManageStudents`, marcado como temporal en `students.guard.ts`).
- **Tenant:** `TenantGuard` global (incompleto, C-1).
- **Auditoría:** `GradeAuditEvent` (forense de notas, con RLS), `AttendanceAuditEvent`, `EnrollmentEvent`, `PermissionAuditLog`. **Gap:** los cambios de recuperación y de **reglas de configuración** (mínimo aprobatorio, pesos, escala) **no se auditan** (Pase 1 A-4, Pase 2 RE-7).
- **Soft-delete:** presente en `Student`; no verificado como transversal a todas las entidades.
- **Logs:** `Logger` de Nest en varios servicios; `console.warn/error` en algunos (p. ej. sync de escala).

---

## 13. Deuda técnica (priorizada)

**Graves:**
1. RLS ausente en tablas académicas núcleo + `TenantGuard` incompleto (C-1) → fuga/escritura cross-tenant.
2. Triple cálculo de nota + motor oficial muerto (RE-1).
3. Config académica en JSON sin esquema ni auditoría (RE-2/RE-7).

**Medios:**
4. Duplicación de creación de institución (3 rutas).
5. Import de Excel frágil y limitado (sin histórico multi-año, DEFINITIVA ignorada, sin validación de rango).
6. Puesta en marcha 100% manual (no hay wizard ni datos semilla).

**Menores:**
7. `console.*` en vez de `Logger` en algunos paths; DTOs con validación desigual; `scripts/seed/` vacío.
8. Barrido de "campos/modelos sin uso" pendiente (no verificado en esta pasada).

---

# Adicionales solicitados

## A. Onboarding a mitad de año (institución contratada tras el período 1 o 2)

**Estado actual (verificado):** **no está resuelto.**
- El import de notas solo escribe en el **año ACTIVO** (`grades-bulk-import.service.ts:203`), no en años cerrados anteriores → **no hay ruta para cargar el histórico multi-año**.
- Para períodos previos **del año activo** sí se puede importar término por término, pero: se **ignora la DEFINITIVA** y la final se recalcula como promedio simple (no coincide con la del colegio anterior), y no se valida rango.
- La promoción/cierre asume datos completos: un estudiante sin notas cargadas se marcaba `REPEATED` en silencio *(mitigado en Fase 1 YC-4: ahora queda en revisión)*.

**Cómo debería manejarse (indicaciones, no implementación):**
1. **Ruta de importación histórica** explícita, parametrizada por `año + período`, que acepte la **nota DEFINITIVA por asignatura** y la escriba como `PeriodFinalGrade` (marcada `isManualOverride`/origen "carga histórica"), sin depender de asignaciones docentes vivas ni recalcular.
2. **Modo "arranque en período N":** al crear/activar el año, indicar en qué período entra la institución; los períodos anteriores se cargan como definitivas y se bloquean para edición.
3. **Validación de escala** en la carga (rechazar notas fuera de rango) y **reporte de cuadre** (qué estudiantes/asignaturas quedaron sin nota).
4. **No** reutilizar el import de planilla (COG/PROC/ACT) para esto — ese es para el período en curso; el histórico es "definitiva por materia".

## B. Instrucciones para Kimi K3 — frontend adaptable a móvil + wireframes (creación de institución)

> Base de diseño ya existente: `docs/REDISENO_EXPERIENCIA_RECTOR.md` (experiencia) y prototipo de alta fidelidad publicado. Kimi debe **partir de ahí**, no inventar otra IA.

**Principios obligatorios (mobile-first):**
1. **Mobile-first real:** diseñar primero a 360–390 px de ancho y escalar hacia PC; no "desktop encogido".
2. **Una pantalla, una pregunta** (ver principios del doc de experiencia). En móvil, cada paso del asistente ocupa toda la pantalla.
3. **Objetivos táctiles ≥ 44×44 px**, tipografía base ≥ 16 px (evita zoom en iOS), inputs con `type`/`inputmode` correctos (numérico para NIT/DANE).
4. **Sin menú lateral durante el asistente** (foco); en PC puede haber un riel de pasos, en móvil solo la barra de progreso superior.
5. **Barra de progreso persistente** ("Paso 3 de 6 · 60%") fija arriba.
6. **Layout fluido:** grid/flex con `gap`, contenedores `max-width` en PC, tablas con scroll horizontal propio (nunca desbordar el body).
7. **Estados y errores humanos** (vacíos con acción, bloqueos con motivo, autoguardado).
8. **Accesibilidad:** foco visible, `prefers-reduced-motion`, contraste AA, labels reales.

**Wireframes que Kimi debe entregar, en DOS anchos (móvil ~375px y PC ~1280px):**
1. Bienvenida + "¿Cómo quieres comenzar?" (crear/copiar/plantilla MEN/importar).
2. Paso "Información del colegio" (form con validación de NIT/DANE).
3. Paso "Sedes y jornadas".
4. Paso "Organización académica" (niveles → **generar grados** → grupos).
5. Paso "Cómo se evalúa" (escala, composición de nota con pesos que suman 100%, períodos).
6. Paso "Año académico" (crear + activar, con checklist de requisitos).
7. Paso "Docentes" (invitar/asignar carga).
8. Centro de puesta en marcha (checklist con % y estados) y su transición al Centro de Control.
Cada wireframe debe mostrar: layout móvil, layout PC, estados (vacío/cargando/error/completo) y dónde aparece Valeria.

## C. Mejoras al proceso de Excel (indicaciones)

1. **Plantilla con estructura fija y verificable** (marcadores/IDs de columna ocultos) — dejar de adivinar columnas por heurística y nombres hardcodeados; **rechazar** el archivo si no calza en vez de importar mal.
2. **Validar cada nota contra la escala** de la institución (rango min–max); reportar filas inválidas, no importarlas en silencio.
3. **Desacoplar por completo** el borrado de estudiantes del import de notas *(ya mitigado a soft-delete)*.
4. **Soportar importar la DEFINITIVA** como nota final (para históricos), además de COG/PROC/ACT para el período en curso.
5. **Previsualización con cuadre**: cuántos estudiantes/asignaturas casan, cuáles no, qué se creará/actualizará/omitirá, antes de aplicar.
6. **Idempotencia y transacción**: el lote como todo-o-nada; reejecutar no duplica.
7. **Plantilla de estudiantes/matrícula** separada de la de notas (hoy van mezcladas).

---

## Conclusiones

1. El **modelo de datos núcleo es sólido y reutilizable**; el problema no es el esquema sino la **dispersión de la puesta en marcha** y dos riesgos serios: **RLS parcial en tablas núcleo** y **triple cálculo de notas**.
2. La creación de institución es funcional pero **deja la institución casi vacía**; falta un flujo guiado (ya diseñado en `REDISENO_EXPERIENCIA_RECTOR.md`, pendiente de implementar).
3. **Antes de producción con una institución real**, priorizar: cerrar el aislamiento multi-tenant del núcleo (RLS o enforcement en capa de datos), unificar el motor de notas, y construir la ruta de **onboarding histórico** (arranque a mitad de año).
4. Referencias cruzadas: `AUDITORIA_ADVERSARIAL_PASE1.md`, `PASE1B`, `PASE2`, `CONFIG_MODELO_Y_REDISENO.md`, `REDISENO_EXPERIENCIA_RECTOR.md`.

*Nada en este informe proviene de una simulación fabricada; cada afirmación referencia archivo/línea o se marca explícitamente como no verificada.*
