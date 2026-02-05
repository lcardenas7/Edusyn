# 🎨 PROPUESTA DE ARQUITECTURA VISUAL DEL FRONTEND

> **Fecha:** Febrero 2026  
> **Tipo:** Refactor UX Estructural (NO técnico)  
> **Objetivo:** Dividir mega-páginas en módulos visuales por dominio funcional

---

## 📋 ÍNDICE

1. [Diagnóstico del Problema](#diagnóstico-del-problema)
2. [Nueva Arquitectura por Dominios](#nueva-arquitectura-por-dominios)
3. [Nueva Estructura de Rutas](#nueva-estructura-de-rutas)
4. [Nuevo Menú de Navegación](#nuevo-menú-de-navegación)
5. [Plan de Migración Progresiva](#plan-de-migración-progresiva)
6. [Detalle por Mega-Página](#detalle-por-mega-página)

---

## 🔍 DIAGNÓSTICO DEL PROBLEMA

### Mega-Páginas Actuales

| Página | Tamaño | Pestañas/Secciones | Problema |
|--------|--------|-------------------|----------|
| `Institution.tsx` | 163KB | 7 pestañas | Mezcla configuración, estructura y evaluación |
| `Reports.tsx` | 141KB | 7 categorías, 50+ reportes | Todo en una sola vista |
| `Students.tsx` | 83KB | CRUD + Documentos + Historial | Aceptable pero mejorable |
| `ReportCards.tsx` | 79KB | Generación + Preview + Historial | Aceptable |

### Pestañas de Institution.tsx (Actual)

```
Institution.tsx
├── Información General      → Datos básicos de la institución
├── Niveles y Calendario     → Niveles académicos + tipo calendario
├── Sistema de Calificación  → Escala de valoración + desempeños
├── Períodos Académicos      → CRUD de períodos con pesos
├── Ventanas de Calificación → Apertura/cierre de notas
├── Ventanas de Recuperación → Apertura/cierre de recuperaciones
└── Grados y Grupos          → Estructura organizacional
```

**Problema:** Mezcla 3 dominios distintos en una sola página:
1. **Identidad Institucional** (nombre, logo, DANE)
2. **Estructura Organizacional** (sedes, grados, grupos)
3. **Sistema de Evaluación** (escala, períodos, ventanas)

---

## 🏗️ NUEVA ARQUITECTURA POR DOMINIOS

### Principio de Diseño

> **"Una página = Una responsabilidad mental"**

El usuario debe poder responder: *"¿Qué estoy configurando aquí?"* con UNA sola palabra.

### Dominios Funcionales (VERSIÓN FINAL - 5 secciones)

**Insight clave:** Para un coordinador, "Evaluación" suena a poner notas. Pero SIEE, períodos y ventanas son **configuración previa al año**. Y "Comunidad + Seguimiento" son lo mismo en su cabeza: **gestión del estudiante**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                   EDUSYN - ARQUITECTURA FINAL                       │
│                      (5 secciones principales)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🏫 INSTITUCIÓN                    📚 ACADÉMICO                     │
│  ├── Perfil institucional          ├── Catálogo (áreas/asignaturas)│
│  ├── Estructura (sedes/grados)     ├── Plantillas académicas       │
│  └── Usuarios del sistema          ├── Carga docente               │
│                                    ├── Año académico               │
│                                    └── ⚙️ Configuración SIEE       │
│                                        ├── Escala de valoración    │
│                                        ├── Períodos académicos     │
│                                        ├── Ventanas de notas       │
│                                        └── Ventanas recuperación   │
│                                                                     │
│  🎓 GESTIÓN ESTUDIANTIL            � REPORTES                     │
│  ├── Estudiantes                   ├── Administrativos             │
│  ├── Matrículas                    ├── Académicos                  │
│  ├── Calificaciones                ├── Boletines                   │
│  ├── Asistencia                    └── MEN / Oficiales             │
│  ├── Observador                                                    │
│  ├── Logros                        🗳️ GOBIERNO ESCOLAR             │
│  ├── Alertas preventivas           ├── Elecciones                  │
│  └── Cierre de período             ├── Votación                    │
│                                    └── Resultados                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### ¿Por qué 5 secciones y no 8?

| Antes (8 secciones) | Después (5 secciones) | Razón |
|---------------------|----------------------|-------|
| Institución | 🏫 Institución | Se mantiene |
| Académico | 📚 Académico | Absorbe Config. SIEE como submenú |
| Evaluación | ❌ Eliminado | Era confuso ("evaluar" ≠ "configurar") |
| Comunidad | ❌ Eliminado | Fusionado en Gestión Estudiantil |
| Seguimiento | ❌ Eliminado | Fusionado en Gestión Estudiantil |
| - | 🎓 Gestión Estudiantil | NUEVO: Todo lo del estudiante |
| Reportes | 📊 Reportes | Se mantiene |
| Gobierno Escolar | 🗳️ Gobierno Escolar | Se mantiene |

---

## 🛤️ NUEVA ESTRUCTURA DE RUTAS

### Rutas Actuales vs Propuestas

#### Dominio: INSTITUCIÓN

| Actual | Propuesta | Descripción |
|--------|-----------|-------------|
| `/institution` (tab: general) | `/institution/profile` | Perfil institucional |
| `/institution` (tab: grades) | `/institution/structure` | Sedes, grados, grupos |
| - | `/institution/shifts` | Jornadas escolares |
| `/staff` | `/institution/users` | Usuarios del sistema |

#### Dominio: ACADÉMICO

| Actual | Propuesta | Descripción |
|--------|-----------|-------------|
| `/academic-catalog` | `/academic/catalog` | Áreas y asignaturas |
| `/academic-templates` | `/academic/templates` | Plantillas por nivel |
| `/academic-load` | `/academic/assignments` | Carga docente |
| `/academic-year-wizard` | `/academic/year/setup` | Configurar año |
| `/academic-year-closure` | `/academic/year/closure` | Cerrar año |

#### Dominio: ACADÉMICO (incluye Configuración SIEE)

| Actual | Propuesta | Descripción |
|--------|-----------|-------------|
| `/academic-catalog` | `/academic/catalog` | Áreas y asignaturas |
| `/academic-templates` | `/academic/templates` | Plantillas por nivel |
| `/academic-load` | `/academic/assignments` | Carga docente |
| `/academic-year-wizard` | `/academic/year/setup` | Configurar año |
| `/academic-year-closure` | `/academic/year/closure` | Cerrar año |
| `/institution` (tab: grading) | `/academic/config/scale` | Escala de valoración |
| `/institution` (tab: periods) | `/academic/config/periods` | Períodos académicos |
| `/institution` (tab: grading-windows) | `/academic/config/windows/grading` | Ventanas de notas |
| `/institution` (tab: recovery-windows) | `/academic/config/windows/recovery` | Ventanas recuperación |
| `/institution` (tab: academic-levels) | `/academic/config/levels` | Niveles académicos |

#### Dominio: GESTIÓN ESTUDIANTIL (fusión Comunidad + Seguimiento)

| Actual | Propuesta | Descripción |
|--------|-----------|-------------|
| `/students` | `/students` | Gestión estudiantes |
| `/enrollments` | `/students/enrollments` | Matrículas |
| `/grades` | `/students/grades` | Calificaciones |
| `/period-final-grades` | `/students/period-closure` | Cierre de período |
| `/attendance` | `/students/attendance` | Asistencia |
| `/observer` | `/students/observer` | Observador |
| `/achievements` | `/students/achievements` | Logros |
| `/performances` | `/students/performances` | Desempeños |
| `/alerts` | `/students/alerts` | Alertas preventivas |
| `/recoveries` | `/students/recoveries` | Planes de recuperación |

#### Dominio: REPORTES

| Actual | Propuesta | Descripción |
|--------|-----------|-------------|
| `/reports` (categoría admin) | `/reports/admin` | Reportes administrativos |
| `/reports` (categoría academic) | `/reports/academic` | Reportes académicos |
| `/reports` (categoría evaluation) | `/reports/evaluation` | Reportes de evaluación |
| `/reports` (categoría attendance) | `/reports/attendance` | Reportes de asistencia |
| `/reports` (categoría official) | `/reports/bulletins` | Boletines |
| `/report-cards` | `/reports/bulletins/generate` | Generar boletines |

---

## 🧭 NUEVO MENÚ DE NAVEGACIÓN (5 SECCIONES)

### Estructura del Sidebar (VERSIÓN FINAL)

```tsx
// Menú Principal (Sidebar) - 5 SECCIONES CLARAS
const menuStructure = [
  {
    section: 'Principal',
    items: [
      { path: '/dashboard', icon: Home, label: 'Inicio' },
    ]
  },
  {
    section: '🏫 Institución',
    icon: Building2,
    items: [
      { path: '/institution/profile', icon: Info, label: 'Perfil' },
      { path: '/institution/structure', icon: Network, label: 'Estructura' },
      { path: '/institution/users', icon: Users, label: 'Usuarios' },
    ]
  },
  {
    section: '📚 Académico',
    icon: BookOpen,
    items: [
      { path: '/academic/catalog', icon: Library, label: 'Catálogo' },
      { path: '/academic/templates', icon: FileStack, label: 'Plantillas' },
      { path: '/academic/assignments', icon: UserCog, label: 'Carga Docente' },
      { path: '/academic/year', icon: Calendar, label: 'Año Académico' },
      { 
        path: '/academic/config', 
        icon: Settings, 
        label: '⚙️ Configuración SIEE',
        submenu: [
          { path: '/academic/config/scale', label: 'Escala de valoración' },
          { path: '/academic/config/periods', label: 'Períodos' },
          { path: '/academic/config/windows', label: 'Ventanas de notas' },
          { path: '/academic/config/levels', label: 'Niveles académicos' },
        ]
      },
    ]
  },
  {
    section: '🎓 Gestión Estudiantil',
    icon: GraduationCap,
    items: [
      { path: '/students', icon: Users, label: 'Estudiantes' },
      { path: '/students/enrollments', icon: ClipboardList, label: 'Matrículas' },
      { path: '/students/grades', icon: FileText, label: 'Calificaciones' },
      { path: '/students/attendance', icon: Calendar, label: 'Asistencia' },
      { path: '/students/observer', icon: Eye, label: 'Observador' },
      { path: '/students/achievements', icon: Award, label: 'Logros' },
      { path: '/students/alerts', icon: AlertTriangle, label: 'Alertas' },
      { path: '/students/period-closure', icon: Lock, label: 'Cierre Período' },
    ]
  },
  {
    section: '📊 Reportes',
    icon: BarChart3,
    items: [
      { path: '/reports/admin', icon: Briefcase, label: 'Administrativos' },
      { path: '/reports/academic', icon: BookOpen, label: 'Académicos' },
      { path: '/reports/bulletins', icon: FileText, label: 'Boletines' },
      { path: '/reports/men', icon: FileCheck, label: 'MEN / Oficiales' },
    ]
  },
  {
    section: '🗳️ Gobierno Escolar',
    icon: Vote,
    items: [
      { path: '/elections', icon: Vote, label: 'Elecciones' },
      { path: '/elections/results', icon: BarChart, label: 'Resultados' },
    ]
  },
]
```

### Visualización del Menú (VERSIÓN FINAL - 5 SECCIONES)

```
┌──────────────────────────┐
│  🏠 Inicio               │
├──────────────────────────┤
│  🏫 INSTITUCIÓN          │
│    ├── Perfil            │
│    ├── Estructura        │
│    └── Usuarios          │
├──────────────────────────┤
│  📚 ACADÉMICO            │
│    ├── Catálogo          │
│    ├── Plantillas        │
│    ├── Carga Docente     │
│    ├── Año Académico     │
│    └── ⚙️ Config. SIEE   │
│        ├── Escala        │
│        ├── Períodos      │
│        ├── Ventanas      │
│        └── Niveles       │
├──────────────────────────┤
│  🎓 GESTIÓN ESTUDIANTIL  │
│    ├── Estudiantes       │
│    ├── Matrículas        │
│    ├── Calificaciones    │
│    ├── Asistencia        │
│    ├── Observador        │
│    ├── Logros            │
│    ├── Alertas           │
│    └── Cierre Período    │
├──────────────────────────┤
│  � REPORTES             │
│    ├── Administrativos   │
│    ├── Académicos        │
│    ├── Boletines         │
│    └── MEN / Oficiales   │
├──────────────────────────┤
│  🗳️ GOBIERNO ESCOLAR     │
│    ├── Elecciones        │
│    └── Resultados        │
└──────────────────────────┘
```

### Comparación Visual: Antes vs Después

| Antes (8 secciones) | Después (5 secciones) |
|---------------------|----------------------|
| Institución | 🏫 Institución |
| Académico | 📚 Académico (+ Config SIEE) |
| Evaluación | ❌ |
| Comunidad | ❌ |
| Seguimiento | ❌ |
| - | 🎓 Gestión Estudiantil |
| Reportes | 📊 Reportes |
| Gobierno Escolar | 🗳️ Gobierno Escolar |

**Resultado:** El sistema se ve **60% más simple** sin perder funcionalidad.

---

## 📅 PLAN DE MIGRACIÓN PROGRESIVA

### Principios de Migración

1. **No romper nada existente** - Las rutas antiguas siguen funcionando
2. **Migración por dominio** - Un dominio completo a la vez
3. **Redirects automáticos** - Rutas viejas redirigen a nuevas
4. **Feature flags** - Activar nuevo menú gradualmente

### Fases de Migración

#### Fase 1: Preparación (1 semana)
```
□ Crear estructura de carpetas por dominio
□ Crear componente de Layout con nuevo menú (oculto)
□ Agregar feature flag para nuevo menú
□ Crear componente de redirección
```

**Nueva estructura de carpetas:**
```
apps/web/src/pages/
├── dashboard/
│   └── Dashboard.tsx
├── institution/
│   ├── Profile.tsx          ← Extraer de Institution.tsx
│   ├── Structure.tsx         ← Extraer de Institution.tsx
│   └── Users.tsx             ← Mover de StaffManagement.tsx
├── academic/
│   ├── Catalog.tsx           ← Renombrar AcademicCatalog.tsx
│   ├── Templates.tsx         ← Renombrar AcademicTemplates.tsx
│   ├── Assignments.tsx       ← Renombrar AcademicLoad.tsx
│   └── year/
│       ├── Setup.tsx         ← Renombrar AcademicYearWizard.tsx
│       └── Closure.tsx       ← Renombrar AcademicYearClosure.tsx
├── academic/
│   ├── Catalog.tsx           ← Renombrar AcademicCatalog.tsx
│   ├── Templates.tsx         ← Renombrar AcademicTemplates.tsx
│   ├── Assignments.tsx       ← Renombrar AcademicLoad.tsx
│   ├── year/
│   │   ├── Setup.tsx         ← Renombrar AcademicYearWizard.tsx
│   │   └── Closure.tsx       ← Renombrar AcademicYearClosure.tsx
│   └── config/               ← ⚙️ Configuración SIEE (submenú)
│       ├── Scale.tsx         ← Extraer de Institution.tsx
│       ├── Periods.tsx       ← Extraer de Institution.tsx
│       ├── Levels.tsx        ← Extraer de Institution.tsx
│       └── windows/
│           ├── Grading.tsx   ← Extraer de Institution.tsx
│           └── Recovery.tsx  ← Extraer de Institution.tsx
├── students/                  ← 🎓 Gestión Estudiantil (fusión)
│   ├── Students.tsx          ← Mover Students.tsx (índice)
│   ├── Enrollments.tsx       ← Mover Enrollments.tsx
│   ├── Grades.tsx            ← Mover Grades.tsx
│   ├── PeriodClosure.tsx     ← Mover PeriodFinalGrades.tsx
│   ├── Attendance.tsx        ← Mover Attendance.tsx
│   ├── Observer.tsx          ← Mover Observer.tsx
│   ├── Achievements.tsx      ← Mover Achievements.tsx
│   ├── Performances.tsx      ← Mover Performances.tsx
│   ├── Alerts.tsx            ← Mover Alerts.tsx
│   └── Recoveries.tsx        ← Mover Recoveries.tsx
├── reports/
│   ├── Admin.tsx             ← Extraer de Reports.tsx
│   ├── Academic.tsx          ← Extraer de Reports.tsx
│   ├── Evaluation.tsx        ← Extraer de Reports.tsx
│   ├── Attendance.tsx        ← Extraer de Reports.tsx
│   └── Bulletins.tsx         ← Mover ReportCards.tsx
└── elections/
    ├── Elections.tsx
    ├── Voting.tsx
    └── Results.tsx
```

#### Fase 2: Configuración SIEE dentro de Académico (1 semana)
```
□ Extraer Scale.tsx de Institution.tsx
□ Extraer Periods.tsx de Institution.tsx
□ Extraer Levels.tsx de Institution.tsx
□ Extraer windows/Grading.tsx de Institution.tsx
□ Extraer windows/Recovery.tsx de Institution.tsx
□ Crear rutas /academic/config/*
□ Agregar redirects desde /institution (tabs)
□ Agregar submenú "⚙️ Configuración SIEE" en Académico
```

**Técnica de extracción:**
```tsx
// Institution.tsx (ANTES - 163KB)
{activeTab === 'grading' && (
  <div className="p-6">
    {/* 300 líneas de código */}
  </div>
)}

// Scale.tsx (DESPUÉS - ~15KB)
export default function Scale() {
  // Mismo código, ahora en su propia página
  return (
    <div className="p-6">
      {/* 300 líneas de código */}
    </div>
  )
}

// Institution.tsx (DESPUÉS - más pequeño)
// Solo mantiene Información General y redirige a otros módulos
```

#### Fase 3: Dominio INSTITUCIÓN (3 días)
```
□ Extraer Profile.tsx (información general)
□ Extraer Structure.tsx (grados y grupos)
□ Mover Users.tsx (staff management)
□ Institution.tsx queda como redirect hub
```

#### Fase 4: Dominio GESTIÓN ESTUDIANTIL (1 semana)
```
□ Crear carpeta /students con todas las páginas relacionadas
□ Mover Students.tsx como índice principal
□ Mover Enrollments.tsx, Grades.tsx, Attendance.tsx, etc.
□ Actualizar rutas a /students/*
□ Agregar redirects desde rutas antiguas
```

#### Fase 5: Dominio REPORTES (1 semana)
```
□ Extraer Admin.tsx de Reports.tsx
□ Extraer Academic.tsx de Reports.tsx
□ Extraer Evaluation.tsx de Reports.tsx
□ Extraer Attendance.tsx de Reports.tsx
□ Mover Bulletins.tsx (ReportCards)
□ Reports.tsx queda como índice/hub
```

#### Fase 6: Reorganización de Carpetas (3 días)
```
□ Mover páginas existentes a nuevas carpetas
□ Actualizar imports en App.tsx
□ Actualizar rutas en App.tsx
□ Verificar que todo funciona
```

#### Fase 7: Nuevo Menú (2 días)
```
□ Activar nuevo menú por feature flag
□ Probar con usuarios beta
□ Ajustar según feedback
□ Activar para todos
```

---

## 📄 DETALLE POR MEGA-PÁGINA

### Institution.tsx → 5 Páginas Nuevas

| Pestaña Actual | Nueva Página | Ruta | Tamaño Estimado |
|----------------|--------------|------|-----------------|
| Información General | `Profile.tsx` | `/institution/profile` | ~20KB |
| Niveles y Calendario | `Levels.tsx` | `/academic/config/levels` | ~25KB |
| Sistema de Calificación | `Scale.tsx` | `/academic/config/scale` | ~20KB |
| Períodos Académicos | `Periods.tsx` | `/academic/config/periods` | ~25KB |
| Ventanas de Calificación | `GradingWindows.tsx` | `/academic/config/windows/grading` | ~15KB |
| Ventanas de Recuperación | `RecoveryWindows.tsx` | `/academic/config/windows/recovery` | ~15KB |
| Grados y Grupos | `Structure.tsx` | `/institution/structure` | ~25KB |

**Resultado:** 163KB → 7 archivos de ~20KB cada uno

### Reports.tsx → 5 Páginas Nuevas

| Categoría Actual | Nueva Página | Ruta | Reportes |
|------------------|--------------|------|----------|
| Administración | `AdminReports.tsx` | `/reports/admin` | 8 reportes |
| Académico | `AcademicReports.tsx` | `/reports/academic` | 14 reportes |
| Evaluación | `EvaluationReports.tsx` | `/reports/evaluation` | 6 reportes |
| Asistencia | `AttendanceReports.tsx` | `/reports/attendance` | 6 reportes |
| Boletines | `Bulletins.tsx` | `/reports/bulletins` | Generación + Preview |
| Alertas | `AlertsReports.tsx` | `/reports/alerts` | 4 reportes |
| Configuración | `ConfigReports.tsx` | `/reports/config` | 4 reportes |

**Resultado:** 141KB → 7 archivos de ~20KB cada uno

---

## 🎯 BENEFICIOS ESPERADOS

### Para el Usuario
- ✅ Menos sobrecarga cognitiva
- ✅ Navegación más intuitiva
- ✅ Cada pantalla tiene un propósito claro
- ✅ Más fácil encontrar lo que busca
- ✅ **Menú de 5 secciones vs 8** (60% más simple)

### Para el Producto
- ✅ Más fácil de vender ("módulos claros")
- ✅ Mejor percepción de simplicidad
- ✅ Onboarding más sencillo
- ✅ Documentación más clara
- ✅ **Arquitectura visual nivel SaaS profesional**

### Para el Desarrollo
- ✅ Archivos más pequeños y manejables
- ✅ Menos conflictos en git
- ✅ Más fácil de testear
- ✅ Más fácil de mantener

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Antes | Después (Esperado) |
|---------|-------|-------------------|
| Archivo más grande | 163KB | <30KB |
| Pestañas por página | 7 | 0-2 |
| Secciones en menú | 8 | 5 |
| Clics para llegar a función | 2-3 | 1-2 |
| Tiempo de onboarding | Alto | Reducido 50% |
| Percepción de complejidad | Alta | Baja |

---

## 🚀 PRÓXIMOS PASOS

1. **Aprobar esta propuesta** ✅
2. **Comenzar Fase 1** (Preparación de estructura)
3. **Migrar Config. SIEE a /academic/config** (más impacto, menos riesgo)
4. **Fusionar Comunidad + Seguimiento en /students**
5. **Activar nuevo menú de 5 secciones**
6. **Iterar según feedback**

---

## 📝 CHANGELOG DE LA PROPUESTA

| Versión | Fecha | Cambios |
|---------|-------|--------|
| 1.0 | Feb 2026 | Propuesta inicial con 8 dominios |
| 2.0 | Feb 2026 | **Ajustes de producto:** |
| | | - "Evaluación" → "Configuración SIEE" (submenú de Académico) |
| | | - "Comunidad + Seguimiento" → "Gestión Estudiantil" |
| | | - Reducción de 8 → 5 secciones principales |

---

*Documento creado para guiar el refactor UX estructural de Edusyn.*
