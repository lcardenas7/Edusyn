# 📚 GUÍA DEL SISTEMA EDUSYN

> **Última actualización:** 5 Febrero 2026  
> **Versión:** 2.0

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Módulos del Sistema](#módulos-del-sistema)
4. [Estado de Desarrollo](#estado-de-desarrollo)
5. [Flujo del Año Académico](#flujo-del-año-académico)
6. [Guía por Módulo](#guía-por-módulo)
7. [Pendientes y Roadmap](#pendientes-y-roadmap)

---

## 🎯 RESUMEN EJECUTIVO

**Edusyn** es un Sistema de Información para la Gestión Académica Institucional diseñado para instituciones educativas colombianas. Cumple con la normativa del Ministerio de Educación Nacional (MEN) y el Sistema Institucional de Evaluación de Estudiantes (SIEE).

### Características principales:
- **Multi-tenant**: Múltiples instituciones en una sola instancia
- **Roles y permisos**: SuperAdmin, Admin Institucional, Coordinador, Docente, Estudiante, Acudiente
- **Año académico configurable**: Calendario A/B, períodos personalizables
- **Evaluación flexible**: Soporta estructuras DIMENSIONS (preescolar), SUBJECTS_ONLY, AREAS_SUBJECTS

---

## 🏗️ ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│                    apps/web/src/pages/*.tsx                     │
├─────────────────────────────────────────────────────────────────┤
│                         API (NestJS)                            │
│                  apps/api/src/modules/*                         │
├─────────────────────────────────────────────────────────────────┤
│                      BASE DE DATOS                              │
│                PostgreSQL + Prisma ORM                          │
│                  apps/api/prisma/schema.prisma                  │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico:
- **Frontend:** React 18 + TypeScript + TailwindCSS + Lucide Icons
- **Backend:** NestJS + TypeScript + Prisma ORM
- **Base de datos:** PostgreSQL
- **Autenticación:** JWT + bcrypt
- **Almacenamiento:** Supabase Storage (archivos)

---

## 📦 MÓDULOS DEL SISTEMA

### 🟢 MÓDULOS COMPLETOS (Funcionales)

| Módulo | Página | Descripción |
|--------|--------|-------------|
| **Dashboard** | `Dashboard.tsx` | Panel principal con métricas y accesos rápidos |
| **Institución** | `InstitutionHub.tsx` | Hub de configuración institucional (perfil, estructura, usuarios) |
| **Académico** | `AcademicHub.tsx` | Hub de gestión académica (catálogo, plantillas, SIEE) |
| **Estudiantes** | `Students.tsx` | CRUD de estudiantes, importación Excel, documentos |
| **Docentes** | `Teachers.tsx` | Gestión de docentes, asignación de roles |
| **Matrículas** | `Enrollments.tsx` | Proceso de matrícula, estados, historial |
| **Catálogo Académico** | `AcademicCatalog.tsx` | Áreas y asignaturas institucionales |
| **Plantillas Académicas** | `AcademicTemplates.tsx` | Configuración de estructura por nivel/grado |
| **Carga Académica** | `AcademicLoad.tsx` | Asignación docente-asignatura-grupo |
| **Calificaciones** | `Grades.tsx` | Registro de notas por actividad evaluativa |
| **Notas Finales de Período** | `PeriodFinalGrades.tsx` | Cierre de período, cálculo automático |
| **Desempeños** | `Performances.tsx` | Niveles de desempeño (Superior, Alto, Básico, Bajo) |
| **Logros** | `Achievements.tsx` | Logros académicos y actitudinales por período |
| **Asistencia** | `Attendance.tsx` | Registro diario de asistencia |
| **Observador** | `Observer.tsx` | Observaciones de comportamiento |
| **Recuperaciones** | `Recoveries.tsx` | Planes de recuperación por período y final |
| **Boletines** | `ReportCards.tsx` | Generación de boletines PDF |
| **Reportes** | `ReportsHub.tsx` | Hub de reportes modulares (6 categorías) |
| **Comunicaciones** | `Communications.tsx` | Mensajes y anuncios institucionales |
| **Elecciones** | `Elections.tsx` | Gobierno escolar, votación electrónica |
| **Documentos Institucionales** | `InstitutionalDocuments.tsx` | Gestión documental |

### 🟡 MÓDULOS PARCIALES (En desarrollo)

| Módulo | Página | Estado | Pendiente |
|--------|--------|--------|-----------|
| **Alertas Preventivas** | `Alerts.tsx` | 70% | Integrar con cortes preventivos |
| **Estadísticas** | `Statistics.tsx` | 60% | Más gráficos y exportación |
| **Gestor de Contenido** | `ContentManager.tsx` | 80% | Galería de imágenes |
| **Tareas de Gestión** | `ManagementTasks.tsx` | 75% | Flujos de aprobación |
| **Cierre de Año** | `AcademicYearClosure.tsx` | 50% | Promoción automática |

### 🔴 MÓDULOS PENDIENTES

| Módulo | Descripción | Prioridad |
|--------|-------------|-----------|
| **Pagos** | Gestión de pagos y cartera | Media |
| **Reportes MEN** | Generación de reportes oficiales | Alta |
| **App Móvil Acudientes** | Consulta de notas y comunicados | Baja |
| **Evaluación Cualitativa** | Preescolar con dimensiones | Alta |

---

## 📊 ESTADO DE DESARROLLO

### Backend (API)

```
apps/api/src/modules/
├── academic/          ✅ Completo (53 archivos)
├── achievements/      ✅ Completo
├── attendance/        ✅ Completo
├── auth/              ✅ Completo
├── communications/    ✅ Completo
├── dashboard/         ✅ Completo
├── documents/         ✅ Completo
├── elections/         ✅ Completo
├── evaluation/        ✅ Completo (28 archivos)
├── iam/               ✅ Completo
├── institution-config/✅ Completo
├── management-tasks/  ✅ Completo
├── men-reports/       🟡 Parcial
├── observer/          ✅ Completo
├── payments/          🔴 Pendiente
├── performance/       ✅ Completo
├── permissions/       ✅ Completo
├── recovery/          ✅ Completo
├── reports/           ✅ Completo
├── storage/           ✅ Completo
└── superadmin/        ✅ Completo
```

### Frontend (Web) - Arquitectura Modular v2.0

```
apps/web/src/pages/
├── Dashboard.tsx              ✅ Completo
│
├── 🏫 INSTITUCIÓN (identidad y estructura)
├── InstitutionHub.tsx         ✅ Hub principal
├── institution/
│   ├── Profile.tsx            ✅ Información general
│   └── Structure.tsx          ✅ Grados y grupos
│
├── 📚 ACADÉMICO (configuración pedagógica)
├── AcademicHub.tsx            ✅ Hub principal
├── academic/config/
│   ├── Scale.tsx              ✅ Sistema de calificación (SIEE)
│   ├── Periods.tsx            ✅ Períodos académicos
│   ├── Levels.tsx             ✅ Niveles académicos
│   └── windows/
│       ├── GradingWindows.tsx ✅ Ventanas de calificación
│       └── RecoveryWindows.tsx✅ Ventanas de recuperación
│
├── 📊 REPORTES (consultas e informes)
├── ReportsHub.tsx             ✅ Hub principal
├── reports/
│   ├── AdminReports.tsx       ✅ Carga docente
│   ├── AcademicReports.tsx    ✅ Notas y promedios
│   ├── AttendanceReports.tsx  ✅ Asistencia
│   ├── AlertsReports.tsx      ✅ Bajo rendimiento
│   ├── BulletinsReports.tsx   ✅ Boletines
│   └── EvaluationReports.tsx  ✅ SIEE
│
├── ⚙️ ADMINISTRACIÓN
├── admin/
│   └── SystemConfig.tsx       ✅ Auditoría, usuarios, permisos
│
├── 🎓 GESTIÓN ESTUDIANTIL
├── Students.tsx               ✅ Completo
├── Enrollments.tsx            ✅ Completo
├── Grades.tsx                 ✅ Completo
├── PeriodFinalGrades.tsx      ✅ Completo
├── Attendance.tsx             ✅ Completo
├── Observer.tsx               ✅ Completo
├── Recoveries.tsx             ✅ Completo
├── Performances.tsx           ✅ Completo
├── Achievements.tsx           ✅ Completo
├── ReportCards.tsx            ✅ Completo
│
├── 👥 PERSONAL
├── Teachers.tsx               ✅ Completo
├── StaffManagement.tsx        ✅ Completo
│
├── 📖 CATÁLOGO
├── AcademicCatalog.tsx        ✅ Completo
├── AcademicTemplates.tsx      ✅ Completo
├── AcademicLoad.tsx           ✅ Completo
│
├── 🗳️ GOBIERNO ESCOLAR
├── Elections.tsx              ✅ Completo
├── VotingPortal.tsx           ✅ Completo
├── ElectionResults.tsx        ✅ Completo
│
├── 📄 OTROS
├── Communications.tsx         ✅ Completo
├── InstitutionalDocuments.tsx ✅ Completo
├── ManagementTasks.tsx        🟡 Parcial
├── Alerts.tsx                 🟡 Parcial
├── Statistics.tsx             🟡 Parcial
├── AcademicYearClosure.tsx    🟡 Parcial
└── SuperAdminDashboard.tsx    ✅ Completo
│
├── ⚠️ DEPRECADOS (mantener solo para compatibilidad)
├── Institution.tsx            ⚠️ Usar InstitutionHub
└── Reports.tsx                ⚠️ Usar ReportsHub
```

---

## 🔄 FLUJO DEL AÑO ACADÉMICO

### Fase 1: CONFIGURACIÓN INICIAL (Antes del año)

```
1. SuperAdmin crea la Institución
   └── /superadmin → Crear institución con DANE, NIT, nombre

2. Admin Institucional configura el SIEE
   └── /institution → Pestaña "Configuración SIEE"
   ├── Escala de valoración (1-5, niveles de desempeño)
   ├── Componentes evaluativos (Cognitivo, Procedimental, Actitudinal)
   └── Reglas de aprobación y recuperación

3. Crear Año Académico
   └── /academic-year-wizard
   ├── Definir año (ej: 2026)
   ├── Tipo de calendario (A o B)
   ├── Períodos académicos con fechas y pesos
   └── Activar año

4. Configurar Catálogo Académico
   └── /academic-catalog
   ├── Crear Áreas (Matemáticas, Lenguaje, Ciencias...)
   └── Crear Asignaturas dentro de cada área

5. Crear Plantillas Académicas
   └── /academic-templates
   ├── Plantilla por nivel (Primaria, Secundaria, Media)
   ├── Asignar áreas con porcentajes
   ├── Asignar asignaturas con horas y pesos
   └── Asignar plantilla a grados

6. Crear Estructura Organizacional
   └── /institution → Pestaña "Sedes y Grupos"
   ├── Sedes (Campus)
   ├── Jornadas (Mañana, Tarde)
   ├── Grados (Transición a 11°)
   └── Grupos (6°A, 6°B, etc.)
```

### Fase 2: MATRÍCULA (Inicio del año)

```
7. Registrar Estudiantes
   └── /students
   ├── Crear manualmente o importar Excel
   ├── Datos personales, documentos, acudientes
   └── Estado: Registrado (sin matrícula)

8. Matricular Estudiantes
   └── /enrollments
   ├── Seleccionar estudiante
   ├── Asignar grupo (automáticamente hereda plantilla)
   ├── Tipo: Nueva, Renovación, Traslado
   └── Estado: ACTIVE

9. Registrar Docentes
   └── /teachers
   ├── Crear usuarios con rol DOCENTE
   └── Asignar a institución

10. Asignar Carga Académica
    └── /academic-load
    ├── Docente → Asignatura → Grupo(s)
    └── Esto habilita al docente para calificar
```

### Fase 3: DESARROLLO DEL AÑO (Durante el año)

```
11. Registro de Asistencia (Diario)
    └── /attendance
    ├── Docente selecciona grupo y fecha
    └── Marca: Presente, Ausente, Tardanza, Excusa

12. Registro de Calificaciones (Continuo)
    └── /grades
    ├── Docente crea actividades evaluativas
    ├── Asigna notas por estudiante
    └── Sistema calcula promedios automáticamente

13. Registro de Logros (Por período)
    └── /achievements
    ├── Logros académicos por asignatura
    └── Logro actitudinal (opcional)

14. Observador del Estudiante
    └── /observer
    ├── Anotaciones positivas/negativas
    ├── Compromisos y seguimiento
    └── Citaciones a acudientes

15. Alertas Preventivas (Cortes)
    └── /alerts
    ├── Sistema detecta estudiantes en riesgo
    └── Notifica a coordinación
```

### Fase 4: CIERRE DE PERÍODO

```
16. Cerrar Período
    └── /period-final-grades
    ├── Verificar que todos los docentes hayan calificado
    ├── Calcular notas finales de período
    └── Bloquear edición del período

17. Generar Boletines
    └── /report-cards
    ├── Seleccionar período y grupo
    ├── Generar PDF individual o masivo
    └── Descargar o enviar por correo

18. Planes de Recuperación (si aplica)
    └── /recoveries
    ├── Identificar estudiantes que perdieron
    ├── Crear plan de recuperación
    └── Registrar nota de recuperación
```

### Fase 5: CIERRE DE AÑO

```
19. Cierre del Año Académico
    └── /academic-year-closure
    ├── Verificar todos los períodos cerrados
    ├── Calcular nota definitiva anual
    ├── Determinar promoción/reprobación
    └── Generar actas de promoción

20. Promoción de Estudiantes
    └── Automático o manual
    ├── Promovidos → Siguiente grado
    ├── Reprobados → Mismo grado
    └── Crear matrículas para nuevo año

21. Reportes MEN
    └── /reports → Reportes oficiales
    ├── SIMAT
    ├── Estadísticas de promoción
    └── Indicadores de calidad
```

---

## 📖 GUÍA POR MÓDULO

### 1. Dashboard (`/dashboard`)
**Propósito:** Vista general del estado académico.

**Funcionalidades:**
- Métricas de estudiantes matriculados
- Alertas pendientes
- Accesos rápidos a módulos frecuentes
- Calendario de eventos

---

### 2. Institución (`/institution`)
**Propósito:** Identidad y estructura organizacional.

**Secciones:**
- **Información General** (`/institution/profile`): Nombre, DANE, NIT, logo, rector
- **Estructura** (`/institution/structure`): Sedes, jornadas, grados, grupos
- **Usuarios** (`/staff`): Gestión de usuarios y roles
- **Administración del Sistema** (`/admin/system`): Auditoría, permisos, configuración avanzada

---

### 2.1 Académico (`/academic`)
**Propósito:** Configuración pedagógica del colegio.

**Secciones principales:**
- **Catálogo Académico** (`/academic/catalog`): Áreas y asignaturas
- **Plantillas Académicas** (`/academic/templates`): Estructura por nivel/grado
- **Carga Docente** (`/academic/assignments`): Asignación docente-grupo-materia
- **Año Académico** (`/academic/year/setup`): Configuración del año escolar

**Configuración SIEE:**
- **Niveles Académicos** (`/academic/config/levels`): Calendario y escalas por nivel
- **Sistema de Calificación** (`/academic/config/scale`): Procesos evaluativos y pesos
- **Períodos Académicos** (`/academic/config/periods`): Configuración de períodos
- **Ventanas de Calificación** (`/academic/config/windows/grading`): Fechas para notas
- **Ventanas de Recuperación** (`/academic/config/windows/recovery`): Fechas para recuperaciones

---

### 3. Estudiantes (`/students`)
**Propósito:** Gestión del registro estudiantil.

**Funcionalidades:**
- CRUD de estudiantes
- Importación masiva desde Excel
- Gestión de documentos (TI, RC, certificados)
- Vinculación de acudientes
- Historial académico

---

### 4. Matrículas (`/enrollments`)
**Propósito:** Proceso formal de matrícula.

**Estados:**
- `ACTIVE` - Matriculado actualmente
- `PROMOTED` - Promovido al siguiente grado
- `REPEATED` - Repite el mismo grado
- `WITHDRAWN` - Retirado
- `TRANSFERRED` - Trasladado

---

### 5. Calificaciones (`/grades`)
**Propósito:** Registro de notas por actividad.

**Flujo:**
1. Docente selecciona asignatura y grupo
2. Crea actividad evaluativa (Quiz, Taller, Examen)
3. Asigna componente (Cognitivo 40%, Procedimental 30%, Actitudinal 30%)
4. Registra notas por estudiante
5. Sistema calcula promedio automáticamente

---

### 6. Boletines (`/report-cards`)
**Propósito:** Generación de informes académicos.

**Contenido del boletín:**
- Datos del estudiante
- Notas por asignatura y período
- Nivel de desempeño
- Logros académicos
- Observaciones
- Asistencia
- Puesto en el grupo

---

### 7. Reportes (`/reports`)
**Propósito:** Análisis y estadísticas académicas.

**Categorías de reportes (arquitectura modular):**

| Categoría | Ruta | Descripción |
|-----------|------|-------------|
| **Administración** | `/reports/admin` | Carga docente, distribución de grupos |
| **Académico** | `/reports/academic` | Consolidado de notas, promedios, rankings |
| **Asistencia** | `/reports/attendance` | Asistencia por grupo, estudiante, período |
| **Alertas** | `/reports/alerts` | Bajo rendimiento, riesgo de reprobación |
| **Boletines** | `/reports/bulletins` | Boletines parciales, finales, certificados |
| **Evaluación** | `/reports/evaluation` | Cumplimiento SIEE, criterios, escalas |

---

## 🚀 PENDIENTES Y ROADMAP

### Prioridad Alta
1. **Evaluación Cualitativa (Preescolar)**
   - Implementar estructura `DIMENSIONS`
   - Adaptar plantillas para dimensiones
   - Boletín cualitativo

2. **Cierre de Año Automático**
   - Cálculo de promoción según SIEE
   - Generación de actas
   - Promoción masiva

3. **Reportes MEN**
   - Formato SIMAT
   - Indicadores de calidad

### Prioridad Media
4. **Módulo de Pagos**
   - Conceptos de pago
   - Registro de pagos
   - Cartera y morosos

5. **Mejoras UX**
   - Distribución automática de pesos ✅
   - Preview de impacto real ✅
   - Validaciones en tiempo real
   - **Arquitectura modular frontend** ✅ (Feb 2026)
     - Separación Institución vs Académico
     - Reportes modulares por categoría
     - Hubs de navegación por dominio

### Prioridad Baja
6. **App Móvil**
   - Consulta de notas para acudientes
   - Notificaciones push

7. **Integraciones**
   - API pública
   - Webhooks

---

## 📁 ESTRUCTURA DE ARCHIVOS CLAVE

```
Edusyn/
├── apps/
│   ├── api/                          # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Modelo de datos
│   │   │   ├── seed.ts               # Datos iniciales
│   │   │   └── migrations/           # Migraciones BD
│   │   └── src/
│   │       ├── engines/              # Lógica de negocio
│   │       │   ├── AcademicRulesEngine.ts
│   │       │   └── AcademicStructure.ts
│   │       └── modules/              # Módulos API
│   │
│   └── web/                          # Frontend React
│       └── src/
│           ├── pages/                # Páginas principales
│           ├── components/           # Componentes reutilizables
│           ├── contexts/             # Estado global
│           └── lib/
│               └── api.ts            # Cliente API
│
└── docs/                             # Documentación
    ├── SYSTEM_GUIDE.md               # Este archivo
    ├── GRADE_CHANGE_RULES.md         # Reglas de cambio de notas
    └── SUPABASE_ARCHITECTURE.md      # Arquitectura de storage
```

---

## 🔐 ROLES Y PERMISOS

| Rol | Acceso |
|-----|--------|
| **SUPERADMIN** | Todo el sistema, gestión de instituciones |
| **ADMIN_INSTITUTIONAL** | Configuración institucional, usuarios, reportes |
| **COORDINADOR** | Gestión académica, matrículas, reportes |
| **DOCENTE** | Calificaciones, asistencia, logros de sus grupos |
| **ESTUDIANTE** | Consulta de notas, portal de votación |
| **ACUDIENTE** | Consulta de notas del estudiante vinculado |

---

## 📞 SOPORTE

Para dudas técnicas o funcionales, revisar:
1. Este documento
2. Código fuente comentado
3. Logs del sistema (`console.log` en desarrollo)

---

*Documento generado automáticamente por el equipo de desarrollo de Edusyn.*
