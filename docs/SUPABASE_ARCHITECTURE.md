# Arquitectura de Datos para Supabase - EduSyn

## Principios Base (NO negociables)

1. **La Base de Datos (DB) guarda la verdad académica**
2. **Supabase Storage guarda evidencia documental, no datos vivos**
3. **Los reportes y boletines se generan, no se acumulan**
4. **Nada pesado vive en la DB**
5. **Nada dinámico vive en Storage**
6. **La comunicación usa DB + Storage + servicios externos (email)**

---

## ✅ AUDITORÍA DEL SCHEMA ACTUAL

### 1. Información Institucional - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `Institution` | ✅ OK | Datos institucionales básicos |
| `Campus` | ✅ OK | Sedes |
| `Shift` | ✅ OK | Jornadas |
| `AcademicYear` | ✅ OK | Años lectivos |
| `AcademicCalendar` | ✅ OK | Calendario académico |
| `Period` | ✅ OK | Períodos académicos |
| `AcademicTerm` | ✅ OK | Términos académicos |
| `InstitutionModule` | ✅ OK | Módulos habilitados |

### 2. Usuarios y Roles - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `User` | ✅ OK | Usuarios del sistema |
| `Role` | ✅ OK | Roles |
| `UserRole` | ✅ OK | Asignación de roles |
| `InstitutionUser` | ✅ OK | Usuarios por institución |
| `Permission` | ✅ OK | Catálogo de permisos |
| `RoleBasePermission` | ✅ OK | Permisos base por rol |
| `UserExtraPermission` | ✅ OK | Permisos extra temporales |
| `PermissionAuditLog` | ✅ OK | Auditoría de permisos |

### 3. Estudiantes - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `Student` | ✅ OK | Datos personales |
| `Guardian` | ✅ OK | Acudientes |
| `StudentGuardian` | ✅ OK | Relación estudiante-acudiente |

**⚠️ CAMPO A REVISAR:**
- `Student.photo` - Actualmente es `String?` (URL). ✅ OK si apunta a Storage

### 4. Matrículas - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `StudentEnrollment` | ✅ OK | Matrícula con student_id, año, grupo, jornada, estado |
| `EnrollmentEvent` | ✅ OK | Historial/auditoría de matrículas |

### 5. Académico - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `Grade` | ✅ OK | Grados académicos |
| `Group` | ✅ OK | Grupos/cursos |
| `Area` | ✅ OK | Áreas académicas |
| `Subject` | ✅ OK | Asignaturas |
| `TeacherAssignment` | ✅ OK | Docentes por curso |
| `StudentGrade` | ✅ OK | Notas por actividad |
| `PartialGrade` | ✅ OK | Notas parciales |
| `PeriodFinalGrade` | ✅ OK | Notas finales por período |
| `EvaluativeActivity` | ✅ OK | Actividades evaluativas |
| `EvaluationPlan` | ✅ OK | Planes de evaluación |
| `AttendanceRecord` | ✅ OK | Asistencia |
| `StudentObservation` | ✅ OK | Observador del estudiante |

### 6. Recuperaciones - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `RecoveryConfig` | ✅ OK | Configuración de recuperaciones |
| `PeriodRecovery` | ✅ OK | Recuperaciones por período |
| `FinalRecoveryPlan` | ✅ OK | Planes de apoyo final |
| `AcademicAct` | ⚠️ REVISAR | Campo `documentUrl` debe apuntar a Storage |

### 7. Documentos de Matrícula - ✅ CORRECTO (va en Storage)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `StudentDocument` | ✅ OK | Solo guarda metadatos en DB |
| `StudentDocument.fileUrl` | ✅ OK | URL apunta a Storage |

**Estructura recomendada en Storage:**
```
institucion/{institutionId}/
  anio/{year}/
    estudiantes/{studentId}/
      documentos/
        registro_civil.pdf
        eps.pdf
      informes/
        diagnostico.pdf
      boletin_final.pdf
```

### 8. Comunicaciones - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `Message` | ✅ OK | Solo asunto, contenido texto, estado |
| `MessageRecipient` | ✅ OK | Destinatarios |
| `Announcement` | ⚠️ REVISAR | `imageUrl` debe apuntar a Storage |
| `GalleryImage` | ⚠️ REVISAR | `imageUrl` debe apuntar a Storage |
| `Event` | ✅ OK | Eventos del calendario |

**Nota:** NO se guarda HTML de emails ni adjuntos en DB.

### 9. Elecciones - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `ElectionProcess` | ✅ OK | Proceso electoral |
| `Election` | ✅ OK | Elección específica |
| `Candidate` | ⚠️ REVISAR | `photo` debe apuntar a Storage |
| `Vote` | ✅ OK | Votos (secretos) |
| `ElectionResult` | ✅ OK | Resultados calculados |

### 10. Pagos - ✅ CORRECTO (va en DB)

| Modelo | Estado | Notas |
|--------|--------|-------|
| `PaymentConcept` | ✅ OK | Conceptos de pago |
| `PaymentEvent` | ✅ OK | Eventos de pago |
| `StudentPayment` | ✅ OK | Pagos de estudiantes |
| `PaymentTransaction` | ✅ OK | Transacciones/abonos |

---

## 📁 ESTRUCTURA DE SUPABASE STORAGE

```
edusyn-storage/
├── institutions/
│   └── {institutionId}/
│       ├── logo.png                    # Logo institucional
│       ├── years/
│       │   └── {year}/
│       │       ├── students/
│       │       │   └── {studentId}/
│       │       │       ├── documents/
│       │       │       │   ├── registro_civil.pdf
│       │       │       │   ├── tarjeta_identidad.pdf
│       │       │       │   ├── eps.pdf
│       │       │       │   └── certificado_estudio.pdf
│       │       │       ├── reports/
│       │       │       │   ├── diagnostico.pdf
│       │       │       │   └── piar.pdf
│       │       │       └── boletin_final_{year}.pdf
│       │       └── acts/
│       │           └── acta_{actNumber}.pdf
│       ├── announcements/
│       │   └── {announcementId}.jpg
│       ├── gallery/
│       │   └── {imageId}.jpg
│       └── elections/
│           └── {electionId}/
│               └── candidate_{candidateId}.jpg
```

---

## 🚫 QUÉ NO SE GUARDA NUNCA

| Tipo | Razón |
|------|-------|
| Reportes administrativos | Se generan bajo demanda |
| Listados Excel | Se generan bajo demanda |
| PDFs temporales | Se generan y descargan |
| Correos enviados (HTML) | Solo se guarda metadatos |
| Boletines intermedios | Se generan dinámicamente |

---

## 📊 BOLETINES - MODELO CORRECTO

### En DB se guarda:
- Promedios por período/asignatura (`PeriodFinalGrade`)
- Descriptores de desempeño (`SubjectPerformance`)
- Estado de cierre del período
- Firmas (referencias a usuarios)

### Flujo:
1. Docentes cargan notas → DB
2. Coordinación valida → DB
3. Usuario solicita boletín → Backend genera PDF
4. Se descarga → NO se guarda en Storage

### Excepción - Boletín Final Anual:
- Se genera al cierre del año
- Se guarda en Storage como documento oficial
- Ruta: `institutions/{id}/years/{year}/students/{id}/boletin_final_{year}.pdf`

---

## 🔐 SEGURIDAD

### Base de Datos (RLS):
- RLS por `institutionId` en todas las tablas
- RLS por rol de usuario
- Auditoría en `PermissionAuditLog` y `EnrollmentEvent`

### Storage:
- Buckets privados por institución
- URLs firmadas con expiración
- Acceso controlado por políticas RLS

---

## ✅ CAMPOS QUE APUNTAN A STORAGE (URLs)

| Modelo | Campo | Uso |
|--------|-------|-----|
| `Institution` | `logo` | Logo institucional |
| `Student` | `photo` | Foto del estudiante |
| `StudentDocument` | `fileUrl` | Documentos de matrícula |
| `Announcement` | `imageUrl` | Imagen del anuncio |
| `GalleryImage` | `imageUrl` | Imagen de galería |
| `Candidate` | `photo` | Foto de campaña |
| `AcademicAct` | `documentUrl` | Acta firmada (PDF) |

---

## 🔄 MIGRACIÓN A SUPABASE

### Paso 1: Base de Datos
- Migrar schema Prisma a Supabase PostgreSQL
- Configurar RLS por institución
- Mantener misma estructura

### Paso 2: Storage
- Crear bucket `edusyn-storage`
- Configurar políticas de acceso
- Migrar archivos existentes (si hay)

### Paso 3: Autenticación
- Evaluar migración a Supabase Auth (opcional)
- O mantener JWT propio con Supabase DB

---

## 📝 NOTAS FINALES

1. **El schema actual está bien diseñado** para los principios de Supabase
2. **Los campos de URL** ya están preparados para apuntar a Storage
3. **No hay campos blob/binary** en la DB (correcto)
4. **Los reportes se generan** con pdfkit/exceljs (correcto)
5. **La auditoría está implementada** en EnrollmentEvent y PermissionAuditLog

### Próximos pasos:
1. Crear proyecto en Supabase (Free tier)
2. Migrar DATABASE_URL a Supabase
3. Configurar Storage bucket
4. Implementar políticas RLS
5. Actualizar servicios de upload para usar Supabase Storage
