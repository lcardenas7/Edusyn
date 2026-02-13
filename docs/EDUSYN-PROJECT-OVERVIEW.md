# EDUSYN — Sistema de Gestión Académica Escolar (SGAE)

> **Documento técnico completo del proyecto**
> Última actualización: 11 de febrero de 2026

---

## 1. Visión General

**Edusyn** es un Sistema de Gestión Académica Escolar (SGAE) multi-tenant diseñado para instituciones educativas colombianas. Permite gestionar todo el ciclo académico: matrículas, calificaciones, asistencia, observador del estudiante, comunicaciones, reportes, elecciones escolares, finanzas, horarios y más.

### Características clave
- **Multi-tenant**: Múltiples instituciones en una sola instancia, aisladas por `institutionId`
- **Modular**: Cada institución activa solo los módulos que necesita (17 módulos disponibles)
- **Roles granulares**: SuperAdmin, Admin Institucional, Docente, Estudiante, Acudiente
- **Normativa colombiana**: Escalas de valoración MEN, estructura por grados/áreas/asignaturas, boletines, reportes DANE

---

## 2. Arquitectura

### Stack Tecnológico

| Capa | Tecnología | Hosting |
|------|-----------|---------|
| **Frontend** | React 19 + TypeScript + Vite 7 + TailwindCSS | Netlify (`edusyn.co`) |
| **Backend** | NestJS 11 + TypeScript + Prisma 5 | Railway (`api.edusyn.co`) |
| **Base de datos** | PostgreSQL 15 | Railway (interno) |
| **Almacenamiento** | Cloudflare R2 (S3-compatible) | Cloudflare (`edusyn-files`) |
| **Autenticación** | JWT (access + refresh tokens) | Backend propio |
| **CI/CD** | GitHub Actions | GitHub |

### Diagrama de Arquitectura

```
┌─────────────────┐     HTTPS      ┌─────────────────┐
│   Frontend      │ ──────────────→│   Backend API   │
│   React/Vite    │                │   NestJS        │
│   edusyn.co     │                │   api.edusyn.co │
│   (Netlify)     │                │   (Railway)     │
└─────────────────┘                └────────┬────────┘
                                            │
                              ┌─────────────┼─────────────┐
                              │             │             │
                              ▼             ▼             ▼
                     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
                     │ PostgreSQL   │ │ Cloudflare│ │ GitHub       │
                     │ Railway      │ │ R2        │ │ Actions      │
                     │ (privado)    │ │ (archivos)│ │ (backups)    │
                     └──────────────┘ └──────────┘ └──────────────┘
```

### Monorepo

```
Edusyn/
├── apps/
│   ├── api/                    # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # 110 modelos, 63 enums, 3930 líneas
│   │   │   ├── migrations/     # 52 migraciones
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── modules/        # 24 módulos funcionales
│   │       ├── prisma/         # PrismaService con RLS
│   │       ├── common/         # Interceptors, guards, utils
│   │       └── main.ts
│   └── web/                    # Frontend React
│       └── src/
│           ├── pages/          # 41 páginas principales
│           ├── components/     # Componentes reutilizables
│           ├── contexts/       # AuthContext, etc.
│           ├── hooks/          # Custom hooks
│           └── lib/            # API client, utils
├── .github/
│   └── workflows/
│       └── db-backup.yml       # Backup automático cada 15 días
├── packages/                   # Paquetes compartidos (futuro)
└── package.json                # Monorepo con npm workspaces
```

---

## 3. Base de Datos

### Estadísticas
- **110 modelos** (tablas)
- **63 enums**
- **52 migraciones** aplicadas
- **3,930 líneas** de schema

### Modelos principales por dominio

#### Núcleo Institucional (8 modelos)
| Modelo | Descripción |
|--------|------------|
| `Institution` | Institución educativa (colegio) |
| `InstitutionModule` | Módulos habilitados por institución |
| `InstitutionUser` | Relación usuario-institución |
| `Campus` | Sedes de la institución |
| `Shift` | Jornadas (mañana, tarde, única, nocturna) |
| `Grade` | Grados (preescolar a media) |
| `Group` | Grupos/cursos dentro de un grado |
| `InstitutionRoleCapability` | Capabilities de visualización por rol |

#### Usuarios y Roles (6 modelos)
| Modelo | Descripción |
|--------|------------|
| `User` | Usuario del sistema |
| `Role` | Roles (ADMIN_INSTITUTIONAL, TEACHER, STUDENT, GUARDIAN) |
| `UserRole` | Asignación de roles |
| `Permission` | Permisos granulares |
| `RoleBasePermission` | Permisos base por rol |
| `UserExtraPermission` | Permisos adicionales por usuario |

#### Catálogo Académico (10 modelos)
| Modelo | Descripción |
|--------|------------|
| `Area` | Áreas del conocimiento (Matemáticas, Ciencias, etc.) |
| `Subject` | Asignaturas dentro de áreas |
| `Dimension` | Dimensiones para preescolar |
| `AcademicTemplate` | Plantillas académicas reutilizables |
| `TemplateArea` | Áreas dentro de plantillas |
| `TemplateSubject` | Asignaturas dentro de plantillas |
| `GradeTemplate` | Plantilla aplicada a un grado en un año |
| `GroupSubjectException` | Excepciones de asignaturas por grupo |
| `EvaluationComponent` | Componentes evaluativos (autoevaluación, etc.) |
| `EvaluationPlan` | Plan evaluativo por asignatura |

#### Año Lectivo y Períodos (6 modelos)
| Modelo | Descripción |
|--------|------------|
| `AcademicYear` | Año académico (DRAFT → ACTIVE → CLOSED) |
| `AcademicCalendar` | Calendario tipo A o B |
| `Period` | Períodos académicos |
| `AcademicTerm` | Términos (período o examen semestral) |
| `GradingPeriodConfig` | Configuración de calificación por período |
| `RecoveryPeriodConfig` | Configuración de recuperaciones por período |

#### Estudiantes y Matrículas (10 modelos)
| Modelo | Descripción |
|--------|------------|
| `Student` | Datos del estudiante |
| `StudentDocument` | Documentos del estudiante |
| `Guardian` | Acudientes/padres |
| `StudentGuardian` | Relación estudiante-acudiente |
| `StudentEnrollment` | Matrícula (estudiante en grupo/año) |
| `EnrollmentArea` | Snapshot de áreas por matrícula |
| `EnrollmentSubject` | Snapshot de asignaturas por matrícula |
| `EnrollmentDimension` | Snapshot de dimensiones (preescolar) |
| `EnrollmentEvent` | Auditoría de eventos de matrícula |
| `TeacherAssignment` | Asignación docente-asignatura-grupo |

#### Evaluación y Calificaciones (8 modelos)
| Modelo | Descripción |
|--------|------------|
| `EvaluativeActivity` | Actividades evaluativas (tareas, exámenes) |
| `StudentGrade` | Nota de estudiante en actividad |
| `PartialGrade` | Nota parcial por componente |
| `PeriodFinalGrade` | Nota final de período |
| `FinalComponent` | Componentes finales (pruebas semestrales) |
| `FinalComponentGrade` | Notas de componentes finales |
| `PerformanceScale` | Escala de valoración institucional |
| `AcademicAct` | Actas académicas (correcciones, promociones) |

#### Asistencia (1 modelo)
| Modelo | Descripción |
|--------|------------|
| `AttendanceRecord` | Registro de asistencia por estudiante/asignatura/fecha |

#### Observador del Estudiante (7 modelos)
| Modelo | Descripción |
|--------|------------|
| `StudentObservation` | Observaciones (académicas, convivencia, etc.) |
| `ObserverCommitment` | Compromisos del estudiante |
| `GuardianCitation` | Citaciones a acudientes |
| `ObserverReferral` | Remisiones (psicología, orientación) |
| `ObserverEvidence` | Evidencias adjuntas |
| `PedagogicalMeasure` | Medidas pedagógicas |
| `ActaRecord` | Actas del observador |

#### Logros y Desempeño (8 modelos)
| Modelo | Descripción |
|--------|------------|
| `Achievement` | Logros por asignatura/período |
| `AttitudinalAchievement` | Logros actitudinales |
| `StudentAchievement` | Logros asignados a estudiantes |
| `AchievementBank` | Banco de logros reutilizables |
| `AchievementConfig` | Configuración de logros |
| `SubjectPerformance` | Desempeño por asignatura |
| `PerformanceConfig` | Configuración de desempeño |
| `PerformanceManualEdit` | Ediciones manuales de desempeño |

#### Recuperaciones (3 modelos)
| Modelo | Descripción |
|--------|------------|
| `RecoveryConfig` | Configuración de recuperaciones |
| `PeriodRecovery` | Recuperaciones de período |
| `FinalRecoveryPlan` | Planes de recuperación final |

#### Comunicaciones (5 modelos)
| Modelo | Descripción |
|--------|------------|
| `Message` | Mensajes internos |
| `MessageRecipient` | Destinatarios de mensajes |
| `MessageAttachment` | Adjuntos de mensajes |
| `Announcement` | Anuncios institucionales |
| `GalleryImage` | Galería de imágenes |

#### Elecciones Escolares (5 modelos)
| Modelo | Descripción |
|--------|------------|
| `ElectionProcess` | Proceso electoral |
| `Election` | Elección específica |
| `Candidate` | Candidatos |
| `Vote` | Votos |
| `ElectionResult` | Resultados |

#### Pagos y Finanzas (14 modelos)
| Modelo | Descripción |
|--------|------------|
| `PaymentConcept` | Conceptos de pago |
| `PaymentEvent` | Eventos de pago |
| `StudentPayment` | Pagos de estudiantes |
| `PaymentTransaction` | Transacciones |
| `FinancialThirdParty` | Terceros financieros |
| `FinancialCategory` | Categorías financieras |
| `ChargeConcept` | Conceptos de cobro |
| `FinancialObligation` | Obligaciones financieras |
| `FinancialPayment` | Pagos financieros |
| `FinancialExpense` | Egresos |
| `FinancialInvoice` | Facturas |
| `FinancialInvoiceItem` | Items de factura |
| `FinancialSettings` | Configuración financiera |
| `CashRegisterClose` | Cierre de caja |

#### Horarios (6 modelos)
| Modelo | Descripción |
|--------|------------|
| `TimeBlock` | Bloques de tiempo |
| `Room` | Salones |
| `RoomRestriction` | Restricciones de salones |
| `ScheduleGradeConfig` | Configuración de horario por grado |
| `TeacherAvailability` | Disponibilidad de docentes |
| `ScheduleEntry` | Entradas del horario |

#### Documentos y Gestión (5 modelos)
| Modelo | Descripción |
|--------|------------|
| `InstitutionalDocument` | Documentos institucionales |
| `ManagementLeader` | Líderes de gestión |
| `ManagementTask` | Tareas de gestión |
| `TaskAssignment` | Asignaciones de tareas |
| `InstitutionStorageUsage` | Uso de almacenamiento |

#### Reportes y Configuración (3 modelos)
| Modelo | Descripción |
|--------|------------|
| `ReportCardConfig` | Configuración de boletines |
| `PerformanceLevelComplement` | Complementos de nivel de desempeño |
| `PermissionAuditLog` | Auditoría de permisos |

---

## 4. Módulos del Backend (API)

### 24 módulos NestJS — Estado Funcional

#### ✅ Módulos Funcionales (probados y estables)

| # | Módulo | Descripción | Backend | Frontend | Notas |
|---|--------|------------|---------|----------|-------|
| 1 | `auth` | Autenticación JWT (login, refresh, cambio de contraseña) | ✅ | ✅ | Login por institución (slug), JWT access+refresh |
| 2 | `iam` | Gestión de usuarios, carga masiva Excel, roles | ✅ | ✅ | Carga masiva de estudiantes/docentes funcional |
| 3 | `academic` | Años lectivos, períodos, catálogo, plantillas, asignaciones | ✅ | ✅ | Wizard de año lectivo, catálogo de áreas/asignaturas |
| 4 | `evaluation` | Actividades evaluativas, notas parciales, notas finales | ✅ | ✅ | Cálculo automático de notas por componentes |
| 5 | `attendance` | Control de asistencia diaria por asignatura | ✅ | ✅ | Registro masivo, resúmenes por período |
| 6 | `observer` | Observador del estudiante (observaciones, compromisos, citaciones, remisiones, medidas) | ✅ | ✅ | 7 modelos, flujo completo |
| 7 | `achievements` | Logros, banco de logros, asignación automática por nivel | ✅ | ✅ | Logros cognitivos + actitudinales |
| 8 | `performance` | Desempeño académico y estadísticas por asignatura | ✅ | ✅ | Alertas preventivas incluidas |
| 9 | `recovery` | Recuperaciones de período y planes de recuperación final | ✅ | ✅ | Configuración por período |
| 10 | `communications` | Mensajes internos, anuncios, galería, eventos | ✅ | ✅ | Adjuntos vía R2 |
| 11 | `documents` | Documentos institucionales (PEI, manuales, actas) | ✅ | ✅ | Upload a R2, categorías |
| 12 | `management-tasks` | Tareas de gestión administrativa con evidencias | ✅ | ✅ | Asignaciones, verificación, evidencias en R2 |
| 13 | `elections` | Elecciones escolares (personero, representantes) | ✅ | ✅ | Proceso completo: candidatos → votación → resultados |
| 14 | `permissions` | Sistema de permisos granulares por usuario | ✅ | ✅ | Permisos base + extras, auditoría |
| 15 | `capabilities` | Configuración de capabilities de visualización por rol | ✅ | ✅ | Controla qué ve cada rol |
| 16 | `dashboard` | Dashboard con métricas y estadísticas | ✅ | ✅ | Datos en tiempo real |
| 17 | `storage` | Almacenamiento de archivos (Cloudflare R2) | ✅ | — | Fachada SupabaseStorageService → StorageService (R2) |
| 18 | `superadmin` | Panel SuperAdmin (gestión de instituciones, planes, módulos) | ✅ | ✅ | CRUD de instituciones, activación de módulos |
| 19 | `institution-config` | Configuración institucional (escalas, áreas, estructura) | ✅ | ✅ | JSON configs persistidas |
| 20 | `payments` | Gestión de pagos y eventos financieros (módulo básico) | ✅ | ✅ | Conceptos, eventos, transacciones |

#### ⚠️ Módulos que Requieren Revisión / Verificación

| # | Módulo | Descripción | Backend | Frontend | Estado | Pendiente |
|---|--------|------------|---------|----------|--------|-----------|
| 21 | `finance` | Gestión financiera completa (terceros, categorías, cobros, pagos, egresos, facturas, caja, dashboard, reportes, settings) | ✅ Código existe | ✅ 11 páginas | 🔍 **Requiere revisión** | Verificar flujo completo: terceros → cobros → obligaciones → pagos → egresos → facturas → cierre de caja. Validar que el dashboard financiero muestre datos correctos. Revisar generación de PDF de facturas. |
| 22 | `timetabling` | Horarios escolares (bloques, salones, disponibilidad, generador, entradas) | ✅ Código existe | ✅ 1 página (150K líneas) | 🔍 **Requiere revisión** | Verificar generador automático de horarios. Validar restricciones de salones y disponibilidad docente. Revisar importación/exportación Excel de horarios. Confirmar que no haya conflictos de horario. |
| 23 | `reports` | Boletines, reportes académicos, generación PDF | ✅ Código existe | ✅ 6 sub-páginas | 🔍 **Requiere verificación** | **CRÍTICO**: Verificar que los boletines respeten la configuración del admin institucional (escala de valoración, tipo de cálculo de áreas, ponderaciones, logros, juicios valorativos, configuración de ReportCardConfig). Validar que el PDF generado refleje correctamente la estructura académica configurada por cada institución. |
| 24 | `men-reports` | Reportes para el Ministerio de Educación Nacional | ✅ Código existe | ✅ Incluido en Reports | 🔍 **Requiere verificación** | Validar formatos oficiales del MEN. Verificar datos DANE. |

---

## 5. Frontend (Web)

### 41 páginas principales

| Página | Descripción |
|--------|------------|
| `LandingPage` | Página de inicio pública |
| `Login` | Login general |
| `InstitutionLogin` | Login por institución (slug) |
| `ForceChangePassword` | Cambio obligatorio de contraseña |
| `Dashboard` | Dashboard principal con métricas |
| `SuperAdminDashboard` | Panel de SuperAdmin |
| `AcademicHub` | Hub de gestión académica |
| `AcademicYearWizard` | Wizard de creación de año lectivo |
| `AcademicYearClosure` | Cierre de año lectivo |
| `AcademicCatalog` | Catálogo de áreas y asignaturas |
| `AcademicTemplates` | Plantillas académicas |
| `AcademicLevelsAdmin` | Administración de niveles |
| `AcademicLoad` | Carga académica docente |
| `AreasAdmin` | Administración de áreas |
| `Students` | Gestión de estudiantes |
| `Enrollments` | Matrículas |
| `Teachers` | Gestión de docentes |
| `StaffManagement` | Gestión de personal |
| `Grades` | Calificaciones |
| `PeriodFinalGrades` | Notas finales de período |
| `Attendance` | Asistencia |
| `Observer` | Observador del estudiante |
| `Performances` | Desempeño académico |
| `Achievements` | Logros |
| `Recoveries` | Recuperaciones |
| `Communications` | Mensajes y comunicaciones |
| `ContentManager` | Gestor de contenido (anuncios, galería) |
| `Elections` | Elecciones escolares |
| `ElectionResults` | Resultados de elecciones |
| `VotingPortal` | Portal de votación |
| `ReportsHub` | Hub de reportes |
| `Reports` | Reportes detallados |
| `ReportCards` | Boletines |
| `Statistics` | Estadísticas |
| `Alerts` | Alertas preventivas |
| `InstitutionHub` | Hub institucional |
| `InstitutionalDocuments` | Documentos institucionales |
| `ManagementTasks` | Tareas de gestión |
| `Timetabling` | Horarios |
| `CapabilitiesConfig` | Configuración de capabilities |
| `PermissionsAdmin` | Administración de permisos |

### Tecnologías del Frontend
- **React 19** con TypeScript
- **Vite 7** como bundler
- **TailwindCSS 3** para estilos
- **Lucide React** para iconos
- **React Router DOM 7** para navegación
- **TanStack React Query 5** para estado del servidor
- **Axios** para HTTP
- **jsPDF + jspdf-autotable** para generación de PDFs
- **XLSX** para exportación Excel

---

## 6. Infraestructura y DevOps

### Hosting

| Servicio | Proveedor | URL | Plan |
|----------|----------|-----|------|
| Frontend | Netlify | `edusyn.co` | Free |
| Backend API | Railway | `api.edusyn.co` | Free/Trial |
| Base de datos | Railway (PostgreSQL) | Interno (privado) | Free/Trial |
| Almacenamiento | Cloudflare R2 | Bucket `edusyn-files` | Free (10GB) |
| Repositorio | GitHub | `lcardenas7/Edusyn` | Free |

### Variables de Entorno (Railway → API)

| Variable | Descripción |
|----------|------------|
| `DATABASE_URL` | PostgreSQL (endpoint privado Railway) |
| `JWT_SECRET` | Secret para tokens JWT |
| `JWT_ACCESS_SECRET` | Secret para access tokens |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens |
| `SUPABASE_ANON_KEY` | Key de Supabase (legacy, auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase (legacy) |
| `R2_ACCOUNT_ID` | ID de cuenta Cloudflare |
| `R2_ACCESS_KEY_ID` | Access key para R2 |
| `R2_SECRET_ACCESS_KEY` | Secret key para R2 |
| `R2_BUCKET` | Nombre del bucket (`edusyn-files`) |
| `R2_ENDPOINT` | Endpoint S3 de R2 |
| `NIXPACKS_NODE_VERSION` | Versión de Node (20) |

### Almacenamiento (Cloudflare R2)

**Bucket**: `edusyn-files`

```
edusyn-files/
├── boletines/          # PDFs de boletines
├── documentos/         # Documentos de estudiantes e institucionales
├── evidencias/         # Evidencias académicas
├── reportes/           # Informes PIAR, actas
├── mensajes/           # Adjuntos de comunicaciones
├── galeria/            # Imágenes del dashboard
├── perfiles/           # Fotos de perfil
├── importaciones/      # Archivos de carga masiva
├── exportaciones/      # Archivos exportados
└── backups/
    └── db/             # Backups automáticos de PostgreSQL
```

**Protección**:
- Bucket Lock Rule: `proteccion-archivos-30d` (retención 30 días)
- Multipart Abort Rule: limpia uploads incompletos >7 días

### Arquitectura de Storage

```
Módulos funcionales → SupabaseStorageService (fachada) → StorageService (R2)
                      (misma API pública)                (@aws-sdk/client-s3)
```

El `StorageService` usa `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner` para comunicarse con Cloudflare R2 (S3-compatible). El `SupabaseStorageService` actúa como fachada para que ningún módulo funcional necesite cambiar.

### Backups

| Tipo | Frecuencia | Destino | Retención |
|------|-----------|---------|-----------|
| PostgreSQL (GitHub Action) | Cada 1 y 15 del mes | R2 `backups/db/` | Últimos 30 |
| Archivos (R2) | Bucket Lock Rule | Cloudflare R2 | 30 días mínimo |
| Código | Cada push | GitHub | Ilimitado |

### CI/CD

| Trigger | Acción |
|---------|--------|
| Push a `main` | Railway auto-deploy (API) |
| Push a `main` | Netlify auto-deploy (Web) |
| Cron (1 y 15 del mes) | GitHub Action: pg_dump → R2 |
| Manual | GitHub Action: Run workflow |

---

## 7. Seguridad

### Multi-tenancy (Aislamiento de datos)

- **Row Level Security (RLS)**: 26+ tablas con políticas RLS basadas en `institutionId`
- **TenantContextInterceptor**: Interceptor global que inyecta `institutionId` del JWT en cada query
- **PrismaService**: Proxy que ejecuta queries dentro de transacciones con contexto de tenant
- **institutionId**: Columna presente en todas las tablas que requieren aislamiento

### Autenticación
- JWT con access token + refresh token
- Cambio obligatorio de contraseña en primer login
- Passwords hasheados con bcrypt

### Roles del Sistema
| Rol | Descripción |
|-----|------------|
| `SUPER_ADMIN` | Administrador global del sistema (gestiona instituciones) |
| `ADMIN_INSTITUTIONAL` | Rector/Admin de una institución |
| `TEACHER` | Docente |
| `STUDENT` | Estudiante (acceso limitado) |
| `GUARDIAN` | Acudiente/padre |
| `COORDINATOR` | Coordinador académico |
| `SECRETARY` | Secretaria |

### Permisos Granulares
- Sistema de permisos por módulo/acción
- Permisos base por rol + permisos extra por usuario
- Auditoría de cambios de permisos (`PermissionAuditLog`)

---

## 8. Módulos del Sistema (SystemModule)

Los 17 módulos que una institución puede activar:

| Módulo | Enum | Descripción |
|--------|------|------------|
| Gestión Académica | `ACADEMIC` | Años, períodos, catálogo, plantillas, asignaciones |
| Matrículas | `ENROLLMENTS` | Inscripción, traslados, retiros, promoción |
| Asistencia | `ATTENDANCE` | Control diario por asignatura |
| Evaluación | `EVALUATION` | Actividades, notas, componentes evaluativos |
| Recuperaciones | `RECOVERY` | Recuperaciones de período y finales |
| Reportes | `REPORTS` | Boletines, informes, estadísticas |
| Comunicaciones | `COMMUNICATIONS` | Mensajes, anuncios, galería, eventos |
| Observador | `OBSERVER` | Observaciones, compromisos, citaciones, remisiones |
| Desempeño | `PERFORMANCE` | Métricas de desempeño por asignatura |
| Reportes MEN | `MEN_REPORTS` | Reportes para el Ministerio de Educación |
| Dashboard | `DASHBOARD` | Panel de control con analytics |
| Usuarios | `USERS` | Gestión de usuarios y roles |
| Configuración | `CONFIG` | Configuración institucional |
| Elecciones | `ELECTIONS` | Elecciones escolares (personero, representantes) |
| Pagos | `PAYMENTS` | Gestión de pagos y eventos financieros |
| Finanzas | `FINANCE` | Cobros, pagos, egresos, facturas, caja |
| Horarios | `TIMETABLE` | Generación y gestión de horarios |

---

## 9. Flujos Principales

### Flujo de Año Lectivo
```
DRAFT → ACTIVE → CLOSED
  │        │        │
  │        │        └─ Solo lectura, histórico
  │        └─ Docentes registran notas/asistencia
  └─ Admin configura estructura académica
```

### Flujo de Matrícula
```
Estudiante → Matrícula (NEW/RENEWAL/TRANSFER)
  │
  ├─ ACTIVE → Cursando
  ├─ PROMOTED → Promovido al siguiente grado
  ├─ REPEATED → Repite grado
  ├─ WITHDRAWN → Retirado
  └─ TRANSFERRED → Trasladado
```

### Flujo de Evaluación
```
Docente crea Actividad Evaluativa
  → Estudiantes reciben notas (StudentGrade)
  → Se calculan notas parciales (PartialGrade)
  → Se calculan notas finales de período (PeriodFinalGrade)
  → Si reprueba → Recuperación (PeriodRecovery / FinalRecoveryPlan)
  → Generación de boletín (ReportCard PDF)
```

### Flujo de Observador
```
Docente/Coordinador registra observación
  → Se clasifica (académica, convivencia, disciplinaria, etc.)
  → Puede generar:
     ├─ Compromiso (ObserverCommitment)
     ├─ Citación a acudiente (GuardianCitation)
     ├─ Remisión (ObserverReferral)
     ├─ Medida pedagógica (PedagogicalMeasure)
     └─ Evidencia adjunta (ObserverEvidence → R2)
```

---

## 10. Estado Actual y Pendientes

### ✅ Completado
- [x] 20 módulos backend funcionales y probados
- [x] 41 páginas frontend
- [x] 110 modelos de base de datos
- [x] Multi-tenancy con RLS (26+ tablas)
- [x] Migración de almacenamiento a Cloudflare R2
- [x] Backup automático de DB cada 15 días a R2 (GitHub Action)
- [x] Bucket Lock Rule (protección 30 días)
- [x] Node 20 en producción (Railway)
- [x] Deploy automático (Railway + Netlify)
- [x] JWT auth con access + refresh tokens
- [x] Sistema de permisos granulares con auditoría
- [x] Carga masiva de estudiantes/docentes (Excel)
- [x] Elecciones escolares (flujo completo)
- [x] Observador del estudiante (7 modelos)
- [x] Logros y desempeño académico

### 🔴 Prioridad Inmediata (próxima sesión de trabajo)

#### 1. Revisión del Módulo Financiero (`finance`)
- [ ] Verificar flujo completo: Terceros → Categorías → Conceptos de cobro → Obligaciones → Pagos → Egresos
- [ ] Probar generación de facturas (PDF) y su correcta numeración
- [ ] Validar cierre de caja y reportes financieros
- [ ] Verificar dashboard financiero con datos reales
- [ ] Confirmar que la configuración financiera (`FinancialSettings`) se respeta en todo el flujo
- [ ] Revisar las 11 páginas del frontend financiero (FinanceHub, ThirdParties, Categories, Concepts, Obligations, Payments, Expenses, Invoices, Reports, Settings, Dashboard)

#### 2. Revisión del Módulo de Horarios (`timetabling`)
- [ ] Verificar generador automático de horarios (algoritmo de asignación)
- [ ] Validar restricciones de salones (`RoomRestriction`) y disponibilidad docente (`TeacherAvailability`)
- [ ] Probar importación/exportación Excel de horarios (`timetable-excel.service.ts`)
- [ ] Confirmar detección de conflictos (docente en dos lugares, salón ocupado, etc.)
- [ ] Revisar configuración por grado (`ScheduleGradeConfig`)
- [ ] Validar bloques de tiempo (`TimeBlock`) y modos de horario (`ScheduleMode`)
- [ ] Probar la página de Timetabling (150K+ líneas — verificar que cargue y funcione correctamente)

#### 3. Verificación de Reportes y Boletines (`reports`)
- [ ] **CRÍTICO**: Verificar que los boletines respeten la configuración del admin institucional:
  - [ ] Escala de valoración (`PerformanceScale`) — ¿Se usan los rangos correctos?
  - [ ] Tipo de cálculo de áreas (`AreaCalculationType`: WEIGHTED, AVERAGE, INFORMATIVE, DOMINANT)
  - [ ] Ponderaciones de asignaturas dentro de áreas (`weightPercentage`)
  - [ ] Logros y juicios valorativos (`Achievement`, `AttitudinalAchievement`)
  - [ ] Configuración de boletín (`ReportCardConfig`) — ¿Se aplica el formato institucional?
  - [ ] Complementos de nivel de desempeño (`PerformanceLevelComplement`)
- [ ] Validar que el PDF generado refleje la estructura académica de cada institución
- [ ] Probar con diferentes configuraciones: preescolar (dimensiones), primaria (asignaturas), secundaria (áreas+asignaturas)
- [ ] Verificar reportes de asistencia, evaluación, alertas y administrativos (6 sub-páginas)
- [ ] Validar reportes MEN (formatos oficiales, datos DANE)

### 🟡 Pendientes a Mediano Plazo
- [ ] **Tests automatizados** — Unit tests y e2e tests para módulos críticos
- [ ] **Migración de archivos existentes** — Mover archivos de Supabase Storage a R2
- [ ] **Railway Pro** — Backups automáticos diarios de DB ($20/mes, cuando haya clientes)
- [ ] **Rate limiting** — Protección contra abuso de API (ya tiene `@nestjs/throttler` instalado)
- [ ] **Logs centralizados** — Sistema de logging estructurado

### 🔵 Pendientes a Largo Plazo
- [ ] **Notificaciones push** — Notificaciones en tiempo real (WebSockets o push)
- [ ] **App móvil** — Versión móvil para acudientes/estudiantes
- [ ] **Integración SIMAT** — Conexión directa con el sistema del MEN
- [ ] **Firma digital** — Firma electrónica en boletines y actas
- [ ] **Custom domain R2** — Dominio personalizado para URLs de archivos
- [ ] **Monitoreo** — Alertas de salud del sistema

---

## 11. Costos Mensuales Actuales

| Servicio | Plan | Costo |
|----------|------|-------|
| Railway (API + DB) | Free/Trial | $0 |
| Netlify (Frontend) | Free | $0 |
| Cloudflare R2 | Free (10GB) | $0 |
| GitHub | Free | $0 |
| GitHub Actions | Free (2000 min/mes) | $0 |
| **Total** | | **$0/mes** |

### Costos proyectados con crecimiento

| Escenario | Railway Pro | R2 (>10GB) | Total estimado |
|-----------|------------|------------|----------------|
| 1-5 instituciones | $20/mes | $0 | ~$20/mes |
| 5-20 instituciones | $20/mes | ~$1/mes | ~$21/mes |
| 20-50 instituciones | $20/mes | ~$5/mes | ~$25/mes |

---

## 12. Cómo Restaurar en Caso de Desastre

### Escenario: Se pierde la base de datos
```bash
# 1. Descargar último backup de R2
aws s3 cp s3://edusyn-files/backups/db/edusyn-db-FECHA.sql.gz . \
  --endpoint-url $R2_ENDPOINT

# 2. Descomprimir
gunzip edusyn-db-FECHA.sql.gz

# 3. Restaurar en nueva DB
psql $DATABASE_URL < edusyn-db-FECHA.sql

# 4. Los archivos en R2 siguen intactos
# 5. Redeploy del backend → sistema restaurado
```

### Escenario: Se borra un archivo en R2
- Bucket Lock Rule impide borrado por 30 días
- Si pasaron >30 días, el archivo se pierde (no hay versioning en R2)

### Escenario: Railway muere
- Código en GitHub → redeploy en cualquier proveedor
- DB restaurar desde backup en R2
- Archivos intactos en R2
- Solo cambiar `DATABASE_URL` y redeploy

---

*Documento generado automáticamente. Para actualizaciones, contactar al equipo de desarrollo.*
