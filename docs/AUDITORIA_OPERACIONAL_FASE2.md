# FASE 2 — AUDITORÍA OPERACIONAL Y CERTIFICACIÓN PARA PRODUCCIÓN DE EDUSYN

> **Tipo:** Certificación operacional / ¿Puede un colegio real operar en Edusyn varios años sin inconsistencias, pérdida de información ni procesos imposibles?
> **Complementa:** `docs/AUDITORIA_NUCLEO_ACADEMICO.md` (Fase 1, técnico-funcional). No repite sus hallazgos; los referencia como `[C-x]`.
> **Método:** anclado en código real — `schema.prisma`, `academic-year-lifecycle.service.ts`, `permissions.service.ts`, `superadmin.service.ts`, `partial-grades`, `attendance`, infra (`@nestjs/schedule`, sin Redis/colas), `package.json`.
> **Roles:** CPO SIS/LMS · Director Académico · Software Architect · QA Lead · UX Lead · Especialista en procesos escolares · Consultor de transformación digital.
> **Fecha:** 2026-06-30 · **Rama:** `staging`

---

## VEREDICTO DE CERTIFICACIÓN

🟡 **CERTIFICACIÓN CONDICIONADA — "OPERABLE CON VIGILANCIA, NO CERTIFICABLE PARA MULTI-AÑO A ESCALA".**

> Un colegio **pequeño (≤300 estudiantes)** con un administrador experto y disciplina de respaldos **puede** operar hoy un año académico completo.
> Un colegio **mediano/grande (1.000–5.000)** que pretenda operar **varios años** **NO** está cubierto: los riesgos se concentran en **procesamiento síncrono sin colas** (continuidad y rendimiento), **ausencia de control de concurrencia** y **ausencia de auditoría/restauración granular** ([C-4], [C-5] de Fase 1).

**Nivel de madurez operacional global: 2.5 / 5** (ver §0).

---

## 0. NIVEL DE MADUREZ OPERACIONAL (escala 1–5)

| Dimensión | Nivel | Justificación |
|---|---|---|
| Funcionalidad del ciclo de vida | 4 | El ciclo está casi completo: crear año → activar → cerrar → promover → año+1 existe y valida |
| Integridad de datos | 2 | Modelo de notas dual, "0=borrar", cascadas, sin papelera (Fase 1) |
| Trazabilidad / auditoría | 2 | Hay `EnrollmentEvent`, `PermissionAuditLog`, snapshots de boletín; **falta** auditoría de notas y asistencia |
| Concurrencia | 1 | **Sin optimistic locking** (no hay campo `version`); último escritor gana |
| Continuidad del negocio | 2 | Backups a nivel BD (Railway); **sin** jobs reanudables ni restauración granular |
| Escalabilidad | 2 | **Todo síncrono, sin colas** (`@nestjs/schedule` ≠ cola de trabajos); bucles secuenciales |
| Onboarding / migración | 2 | Creación de institución y import de Excel propio; **sin** wizard ni motor de migración |
| Permisos / seguridad | 4 | RBAC granular con permisos extra temporales y auditoría de permisos |
| Experiencia operacional (admin) | 2.5 | Potente pero asume experto; muchos procesos manuales y repetitivos |

---

# 1. CICLO DE VIDA COMPLETO DEL COLEGIO

Por cada paso: **depende de · qué puede salir mal · qué debe bloquearse · automatizable · valida sistema · valida admin**. Estado: ✅ existe / 🟡 parcial / ❌ falta.

| Paso | Estado | Depende de | Qué puede salir mal | Debe bloquearse | Automatizable | Valida sistema | Valida admin |
|---|---|---|---|---|---|---|---|
| **Primer contacto** | ❌ (fuera de plataforma) | — | Lead sin seguimiento | — | CRM | — | Comercial |
| **Creación institución** | ✅ `superadmin.service` | SuperAdmin | Datos mínimos, admin sin credenciales | Crear sin admin | Plantilla por tipo de colegio | Unicidad NIT/slug ⚠ | Datos legales |
| **Configuración inicial** | 🟡 manual | Institución | Orden incorrecto, escala mal puesta | Activar año sin escala/estructura | **Wizard (§2)** | Completitud ⚠ falta | Revisión final |
| **Migración de info** | ❌ solo Excel propio | Config base | Escalas/períodos mal mapeados | Importar a año activo sin preview | **Motor de migración (§3)** | Integridad referencial parcial | Conciliación |
| **Config académica** (grados, grupos, áreas, asignaturas, plantillas) | ✅ | Institución | Áreas sin asignatura, % ≠ 100 | Suma de pesos ≠ 100 ⚠ verificar | Plantillas académicas | ⚠ parcial | Estructura |
| **Asignación docentes** | ✅ `teacher-assignments` | Grupos+asignaturas | Materia sin docente, doble asignación | — | Sugerencia por carga | Conflictos de horario (timetabling) | Cobertura |
| **Matrículas** | ✅ + bulk upload | Grupos | Duplicados por documento, cupo | Cupo lleno | Import con preview | ⚠ duplicados | Documentos |
| **Inicio de clases** | ✅ (activar año) | Año ACTIVE | Activar con config incompleta | ⚠ no valida completitud | — | Estado de año | — |
| **Asistencia** | 🟡 | Asignación + horario | Editar período cerrado, sin justificación-entidad | Edición tras cierre ❌ | Alertas preventivas (existe) | — | — |
| **Evaluaciones** | ✅ | Plan de evaluación | Plan sin componentes | Guardar sin plan ⚠ | — | guard FINALIZED ✅ | — |
| **Notas** | 🟡 | Evaluaciones | Modelo dual, 0=borrar [C-1][C-2] | Período FINALIZED ✅ | Recompute final ✅ | Rango de escala ⚠ | Planillas |
| **Recuperaciones** | ✅ | Notas + config | Recuperación tras boletín | — | Detección de elegibles | Snapshot post-rec ✅ | Decisión |
| **Boletines** | ✅ | Notas + asistencia | Generación masiva síncrona (timeout) | — | **Cola (§7)** | Snapshot+versión ✅ | Revisión |
| **Comisiones de evaluación** | 🟡 `academic-acts` | Notas+promoción | Acta sin firma | Cierre sin actas ⚠ | Pre-cálculo AT_RISK | — | Acta |
| **Promoción** | ✅ `academic-year-lifecycle` | Cierre | Bucle secuencial, sin transacción | NOT_PROMOTED con recuperación pendiente ✅ | Motor ✅ | Recuperaciones pendientes ✅ | Revisión |
| **Graduación** | ⚠ verificar | Promoción 11° | Sin flujo de egreso/certificado | — | Certificados | — | — |
| **Archivo histórico** | 🟡 | Cierre | Datos vivos vs. congelados | — | Snapshots ✅ | — | — |
| **Nuevo año** | ✅ `createYear` (DRAFT) | — | Config no se hereda | — | **Clonar estructura del año anterior** ⚠ | Unicidad año ✅ | — |
| **Migración automática año+1** | ✅ `promoteStudents` | Año cerrado | Sin asignación de grupo automática, secuencial | Promover a año cerrado ✅ | Asignación de grupo destino | Idempotencia ✅ | Listas |

**Hallazgos del ciclo:**
- **G-1** Activar un año **no valida** que la configuración académica esté completa (escala, estructura, grupos, asignaciones). Riesgo de operar con base incompleta.
- **G-2** El cierre de año y la promoción **no son transaccionales** ni reanudables: si fallan a mitad (timeout a 3.000+), unos estudiantes quedan `PROMOTED` y otros no, con el año sin cerrar → estado inconsistente que requiere reparación manual.
- **G-3** Crear el año siguiente **no clona** la estructura (grados/grupos/áreas/asignaturas/escala) del año anterior — el admin la rehace. Las mejores plataformas ofrecen "duplicar año".
- **G-4** No hay flujo explícito de **graduación/egreso** (certificado de bachiller, paz y salvo, retiro de cupo) ⚠ verificar.

---

# 2. ONBOARDING — WIZARD DE CONFIGURACIÓN INICIAL (propuesta)

**Estado actual:** `superadmin.service.createInstitution` crea institución + módulos + usuario admin. **No existe** asistente guiado; el admin configura módulo por módulo sin validación de orden ni de completitud (G-1).

**Wizard propuesto (orden por dependencias, con bloqueo de avance):**

```
PASO 0  Identidad institucional   [OBLIGATORIO] NIT, nombre, tipo, sedes, jornadas, logo
   ↓                              Plantilla por tipo: Preescolar / Primaria / Bachillerato / Media técnica
PASO 1  Calendario y año          [OBLIGATORIO] año, fechas, tipo calendario (A/B), períodos + pesos (=100%)
   ↓
PASO 2  Modelo de evaluación      [OBLIGATORIO] escala (0-5/0-10/0-100), nota mínima, niveles desempeño,
   ↓                              estructura (DIMENSIONS/SUBJECTS_ONLY/AREAS_SUBJECTS), redondeo
PASO 3  Reglas de promoción       [OBLIGATORIO] máx. materias perdidas, % asistencia mínima, recuperación
   ↓
PASO 4  Estructura académica      [OBLIGATORIO] grados → grupos; áreas → asignaturas → intensidad horaria
   ↓                              (precargable desde plantilla)
PASO 5  Docentes                  [IMPORTABLE]  bulk upload + credenciales
   ↓
PASO 6  Asignaciones              [OBLIGATORIO] docente ↔ grupo ↔ asignatura (validar cobertura 100%)
   ↓
PASO 7  Estudiantes y acudientes  [IMPORTABLE]  bulk upload con preview + conciliación por documento
   ↓
PASO 8  Migración (si aplica)     [OPCIONAL]    notas/asistencia/observador previos (§3)
   ↓
PASO 9  Verificación final        [GATE]        panel de salud: 0 errores → habilitar ACTIVAR AÑO
```

**Reglas del wizard:**
- Cada paso valida sus dependencias antes de permitir avanzar.
- **El año no se puede ACTIVAR** hasta que el Paso 9 esté en verde (cierra G-1).
- Distinguir **obligatorio vs. opcional** explícitamente; lo importable marcado como tal.
- Guardado parcial y reanudable (el onboarding puede tomar días).

---

# 3. MIGRACIÓN DESDE OTRAS PLATAFORMAS — MOTOR DE MIGRACIÓN INTELIGENTE (propuesta)

**Estado actual:** ❌ **No existe motor de migración.** Solo `grades-bulk-import` (formato Excel propio con preview) e `iam/bulk-upload` (usuarios). No hay mapeo de escalas, ni conversión de períodos, ni importadores de asistencia/observador/logros (Casos 7, 8 de Fase 1).

**Plataformas objetivo (Colombia/LATAM):** Q10, Phidias, Master2000, Sysacad, Pegasus, Compucol, Excel, BD propias.

**Arquitectura propuesta (ETL con conciliación):**

```
1. EXTRACCIÓN   Conectores por plataforma (export Excel/CSV; API donde exista, p.ej. Q10/Phidias)
2. MAPEO        Asistente de columnas: columna origen → campo Edusyn (memorizable por plantilla)
3. CONVERSIÓN   • Escala: 0-100 → 0-5 (regla configurable), letras → numérico
                • Períodos: 4 bimestres → 3 trimestres (matriz de equivalencia)
                • Notas, asistencia, observador, logros, docentes, estudiantes, acudientes
4. VALIDACIÓN   Integridad referencial (estudiante existe, materia existe, escala válida),
                duplicados por documento, notas fuera de rango
5. PREVISUALIZACIÓN  Dry-run: qué se creará/actualizará/omitirá, por entidad (ya existe el patrón)
6. CONCILIACIÓN Resolución de conflictos: ¿crear, actualizar, omitir? por fila
7. EJECUCIÓN    Transaccional por lote + en cola (no bloquear request)
8. ROLLBACK     Etiqueta de lote de migración → revertir lote completo
9. REPORTE      Resumen: creados/actualizados/omitidos/errores + log descargable
```

**Conversiones que el motor debe resolver (matrices configurables):**

| Dimensión | Reto típico | Estrategia |
|---|---|---|
| Escala | Origen 0–100, destino 0–5 | Fórmula lineal configurable + redondeo institucional |
| Niveles | "Superior/Alto/Básico/Bajo" ↔ rangos numéricos | Tabla de equivalencia |
| Períodos | 4 bimestres → 3 trimestres | Matriz origen→destino con pesos |
| Asistencia | Estados distintos (F/A/T/E) | Mapeo de enum `AttendanceStatus` |
| Observador | Texto libre histórico | Importar como entradas con fecha original |
| Documentos | TI/CC/RC variados | Normalización de `documentType` |

---

# 4. MATRIZ DE PERMISOS

**Estado actual del modelo (sólido):** `permissions.service.userCan(userId, code)` resuelve por precedencia **SUPERADMIN → ROLE → EXTRA → DENIED**, con permisos extra de **vigencia temporal** (`validFrom/validTo`) y **auditoría de permisos** (`PermissionAuditLog`). Roles almacenados como **string** ("ADMIN_INSTITUTIONAL", "RECTOR", "COORDINADOR", "DOCENTE"...), no enum estricto. Docs previos: `RBAC_MULTITENANT_DESIGN.md`, `RBAC_VALIDATION_AUDIT.md`.

**Matriz objetivo** (✅ permitido · ⛔ prohibido · 🔐 requiere autorización · 📝 requiere auditoría · ⚠️ doble confirmación):

| Acción | SuperAdmin | Admin Inst. | Rector | Coordinador | Secretaría | Docente | Dir. grupo | Psicoorient. | Acudiente | Estudiante |
|---|---|---|---|---|---|---|---|---|---|---|
| Crear/editar institución | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Config. académica (escala, estructura) | ✅ | ✅📝 | 🔐📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| **Cambiar escala con notas existentes** | ✅⚠️ | 🔐⚠️📝 | 🔐⚠️📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Crear grados/grupos/áreas | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Asignar docentes | ✅ | ✅ | ✅ | ✅📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Matricular / mover estudiante | ✅ | ✅ | ✅ | ✅📝 | ✅📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Registrar notas (sus materias) | ✅ | ✅ | ✅ | ✅ | ⛔ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| **Editar nota de otro docente** | ✅📝 | 🔐📝 | 🔐📝 | 🔐📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Cambiar % / pesos | ✅ | ✅📝 | ✅📝 | 🔐📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Registrar asistencia | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Editar asistencia cerrada | ✅⚠️📝 | 🔐⚠️📝 | 🔐⚠️📝 | 🔐📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Cerrar/reabrir período | ✅⚠️ | ✅⚠️📝 | ✅⚠️📝 | 🔐📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Cerrar año / promover | ✅⚠️ | 🔐⚠️📝 | ✅⚠️📝 | 🔐📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Generar boletines | ✅ | ✅ | ✅ | ✅ | ✅ | ⛔ | ✅ | ⛔ | 👁 propios | 👁 propios |
| Observador (anotaciones) | ✅ | ✅ | ✅ | ✅ | 👁 | ✅ | ✅ | ✅ | 👁 propios | 👁 propios |
| **Borrar entidad académica** | ✅⚠️📝 | 🔐⚠️📝 | 🔐⚠️📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Ejecutar migración | ✅⚠️📝 | 🔐⚠️📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Restaurar desde papelera | ✅📝 | ✅📝 | 🔐📝 | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |

**Riesgos de seguridad:**
- **P-1** Roles como **string libre** → riesgo de typo/rol fantasma sin permisos o con permisos inesperados. Recomendado: catálogo de roles validado.
- **P-2** Las acciones marcadas 📝 (editar nota ajena, editar asistencia cerrada, borrar) **hoy no se auditan** ([C-4] Fase 1) — el modelo de permisos es bueno pero el **rastro del acto** falta.
- **P-3** ⚠️ doble confirmación / 🔐 autorización para acciones irreversibles **no está implementado** como flujo (cambiar escala, borrar, reabrir).
- **P-4** Acudiente/estudiante deben ver **solo lo propio**: verificar aislamiento por matrícula en cada endpoint de lectura ⚠.

---

# 5. CONCURRENCIA

**Estado actual:** ❌ **No hay control de concurrencia.** No existe campo `version` para optimistic locking (los 122 hits son `updatedAt`, informativo, no usado como guard). Patrón general = **upsert "último escritor gana"**. Asistencia usa `$transaction` (atómica por lote) pero las notas no ([C-6] Fase 1).

| Escenario | Riesgo | Qué debe pasar | Estrategia recomendada |
|---|---|---|---|
| Dos docentes / docente+coordinador en la **misma planilla** | Sobrescritura silenciosa de notas | Detectar edición concurrente y avisar | **Optimistic locking** (version por planilla); rechazar guardado obsoleto con merge UI |
| Coordinador cambia **% mientras** docente guarda notas | Final calculada con peso a medio cambiar | Bloquear cambio de % si hay digitación activa | **Pessimistic lock** corto sobre el plan de evaluación durante el cambio + recálculo en cola |
| Admin **mueve estudiante** mientras otro registra asistencia | Asistencia queda en grupo viejo | Mover en transacción + reasociar | Transacción + lock de la matrícula |
| Docente cambia notas **mientras se generan boletines** | Boletín con datos a medias | Snapshot consistente | Generar boletín desde **snapshot** (ya hay) y/o lectura transaccional |
| Admin **cierra período** mientras otro registra | Datos entran tras el corte | El cierre debe ser barrera atómica | Transacción de cierre + `guard FINALIZED` (existe para notas; **falta para asistencia**, M-3) |

**Recomendación global de concurrencia:**
1. Añadir `version Int` a entidades de alta contención (planilla de notas = `PeriodFinalGrade`/`PartialGrade` por asignación, `EvaluationPlan`, `StudentEnrollment`) y validar en cada update (optimistic locking).
2. Operaciones compuestas (bulk de notas, cierre, promoción) **siempre** en `$transaction`.
3. Cambios estructurales (% , escala, mover estudiante) con **lock corto** y recálculo diferido a cola.

---

# 6. CONTINUIDAD DEL NEGOCIO

**Estado actual:** Despliegue en **Railway** (PostgreSQL gestionado). Backups de BD existen operativamente (`ESTADO.md`: "backup 81MB"). **Sin Redis, sin cola de trabajos, sin jobs reanudables.** Las operaciones largas corren **dentro del request HTTP**.

| Escenario | Qué ocurre hoy | Datos en riesgo | Cómo recuperarse | RTO/RPO esperado | Recomendación |
|---|---|---|---|---|---|
| Falla del servidor (API) | Request en curso muere | El de esa transacción | Reintentar | Minutos | Stateless ✅; mover trabajo largo a cola |
| Falla de PostgreSQL | App caída | Desde último backup | Restaurar backup | RPO = intervalo de backup ⚠ | **PITR / réplica + backups frecuentes** |
| Falla de Redis | **N/A — no se usa** | — | — | — | Al introducir colas, Redis pasa a crítico |
| Corte eléctrico (cliente) | Solo afecta acceso local | Ninguno (cloud) | Reconectar | Inmediato | OK (es cloud) |
| **Fallo durante importación** | Import a medias, **sin rollback** (salvo preview) | Filas parciales | Limpieza manual | Alto | **Lote transaccional + rollback (§3)** |
| **Fallo durante promoción** | Unos PROMOTED, otros no, año sin cerrar | Estado inconsistente (G-2) | Reparación manual | Alto | **Transacción + job reanudable + idempotencia** |
| **Fallo durante cierre** | Período/año a medio cerrar | Inconsistente | Manual | Alto | Cierre atómico |
| **Boletines masivos** | Request largo → timeout, sin reanudar | Ninguno (idempotente) pero proceso falla | Reintentar todo | Alto a escala | **Cola con progreso y reanudación** |
| Fallo durante recuperación | Snapshot a medias | Bajo (hay snapshot) | Reintentar | Medio | Transacción |

**Hallazgos de continuidad:**
- **CN-1** No existe **estrategia documentada de backups/restore** (frecuencia, retención, PITR, prueba de restauración). Crítico para "operar varios años".
- **CN-2** **Ninguna operación larga es reanudable** → a escala, un fallo obliga a reejecutar todo (y sin transacción, deja estado sucio).
- **CN-3** **Sin restauración granular** ([C-5] Fase 1): "restaurar el estado de la semana pasada" (Historia 8) hoy solo es posible restaurando **toda** la BD a un backup, perdiendo lo posterior.

---

# 7. RENDIMIENTO POR ESCALA

**Arquitectura actual:** procesamiento **síncrono** + **bucles secuenciales con consultas anidadas** (confirmado en `partial-grades.bulkUpsert`, `calculateAndApplyPromotions`, `promoteStudents`, `recordBulk`). **Sin cola, sin paginación de jobs, sin caché de contexto por request.**

Estimación de comportamiento (proporción de operaciones, no benchmark real — ⚠ medir en staging):

| Operación | 300 | 1.000 | 3.000 | 5.000 | 10.000 |
|---|---|---|---|---|---|
| Registro masivo de notas (1 planilla) | 🟢 | 🟢 | 🟡 | 🟠 | 🔴 |
| Generación de boletines (todo el colegio) | 🟢 | 🟡 | 🟠 timeout probable | 🔴 | 🔴 |
| Importación masiva | 🟢 | 🟡 | 🟠 | 🔴 | 🔴 |
| **Cierre + promoción de año** | 🟢 | 🟡 | 🟠 timeout | 🔴 | 🔴 |
| Consultas / reportes | 🟢 | 🟢 | 🟡 | 🟡 | 🟠 |
| Asistencia diaria (por grupo) | 🟢 | 🟢 | 🟢 | 🟢 | 🟡 |
| Carga concurrente (digitación fin de período) | 🟡 | 🟠 | 🔴 sin locking | 🔴 | 🔴 |

**Cuellos de botella identificados:**
- **R-1** Generación de boletines y cierre/promoción corren **en el request** → timeout del proxy (Railway suele cortar ~30–60s) a partir de ~3.000.
- **R-2** N+1: `findUnique(institutionId)` por cada upsert; contexto de reglas recalculado por iteración.
- **R-3** Promoción/cierre = `findMany(todas las matrículas)` + update por fila, sin `updateMany` ni lotes.
- **R-4** Pico de concurrencia en cierre de período (todos los docentes digitando) sin locking → corrupción + contención de conexiones.

**Mejoras arquitectónicas (prioridad):**
1. **Cola de trabajos** (BullMQ + Redis o `pg-boss` sobre Postgres si se evita Redis) para boletines, importación, cierre y promoción, con **progreso, reintento y reanudación**.
2. **Procesamiento por lotes** (`createMany`/`updateMany`, chunking de 200–500) en vez de bucles fila a fila.
3. **Resolver contexto una vez** por job (no por fila); caché de `InstitutionRulesContext`.
4. **Índices** revisados para consultas por `institutionId + academicYearId + groupId + academicTermId` (⚠ verificar en schema).
5. **Paginación obligatoria** en endpoints de listados a escala.

---

# 8. EXPERIENCIA OPERACIONAL (productividad del administrador)

| Pregunta | Hallazgo |
|---|---|
| ¿Cuántos clics por proceso? | Onboarding sin wizard → decenas de pantallas en orden no guiado. Recuperar de error = exploración manual. |
| ¿Tareas repetitivas? | Recrear estructura cada año (G-3); registrar nota por nota; reasignar docentes; rehacer config. |
| ¿Procesos que generan abandono? | Configuración inicial (orden no obvio), importación sin guía, "no encuentro por qué no deja cerrar el año". |
| ¿Qué automatizar? | Clonado de año, recálculo masivo, detección de elegibles a recuperación, conciliación de duplicados, validación de completitud. |
| ¿Qué asistentes deberían existir? | Wizard de onboarding (§2), asistente de migración (§3), "simulador de cierre", panel de salud de datos. |
| ¿Qué con IA? (ya hay orquestador) | Redacción de observador, planes de mejoramiento, mapeo de columnas en migración, detección de patrones de riesgo, explicación de "por qué un estudiante no promueve". |

**Principios UX operacional recomendados:** un solo "Centro de operaciones" con estado del año, alertas y acciones masivas; **previsualización antes de toda acción irreversible**; **deshacer** universal; lenguaje de errores accionable ("faltan 3 planillas en 8°B" con enlace).

---

# 9. MATRIZ DE DEPENDENCIAS FUNCIONALES (impacto del cambio)

`✅ recalcula hoy · 🟡 al regenerar/al vuelo · ❌ NO propaga (riesgo)`

| Cambio | Notas | Boletines | Promoción | Recuperac. | Reportes/MEN | IA | Indicadores | Alertas |
|---|---|---|---|---|---|---|---|---|
| **Escala** | ❌ finales almacenadas | 🟡 | 🟡 al vuelo | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| **Calendario** | — | 🟡 | — | — | 🟡 | — | 🟡 asistencia esperada ⚠ | 🟡 |
| **Períodos** (pesos) | — | ✅ | 🟡 | — | 🟡 | — | 🟡 | — |
| **Asignaturas** | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | — |
| **Áreas** | ✅ jerárquico | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| **Grupos** | 🟡 reasociar ⚠ | 🟡 | 🟡 | 🟡 | 🟡 | — | 🟡 | — |
| **Docentes** | 🟠 migra+borra [C-3] | 🟡 | — | — | 🟡 | — | — | — |
| **Estudiantes** (mover/retirar) | 🟡 ⚠ | 🟡 | 🟡 | 🟡 | 🟡 | — | 🟡 | 🟡 |
| **Jornadas** | — | — | — | — | 🟡 | — | 🟡 | — |
| **Evaluaciones** | ✅ recompute | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| **Porcentajes/pesos** | ❌ finales viejas [M-2] | 🟡 | 🟡 | — | 🟡 | — | 🟡 | — |
| **Logros** | — | ✅ | — | — | ✅ | 🟡 | — | — |
| **Recuperaciones** | ✅ + snapshot | ✅ snapshot post-rec | ✅ | ✅ | ✅ | — | ✅ | — |
| **Matrículas** | ✅ EnrollmentEvent | 🟡 | ✅ | 🟡 | ✅ | — | 🟡 | 🟡 |
| **Asistencia** | — | ✅ | ✅ (% promoción) | — | ✅ | 🟡 | ✅ | ✅ |

**Lectura crítica:** las dos filas en rojo — **Escala** y **Porcentajes** — son las de mayor impacto y **menor propagación automática**. Cambiarlas a mitad de año hoy produce inconsistencias silenciosas (Historias 4 y de Fase 1, Caso 9). Es la primera deuda a saldar tras la integridad de notas.

---

# 10. HISTORIAS REALES DE OPERACIÓN

**H1 · Colegio llega a mitad de año.** Flujo: onboarding → migrar notas/asistencia/observador del período cursado → activar. *Riesgos:* solo hay import de notas (no asistencia/observador). *Falta:* §3. *Mejora:* motor de migración + wizard.

**H2 · Estudiante cambia de grupo.** Flujo: `grade-change` (SAME_GRADE inmediato). *Riesgos:* notas atadas a `TeacherAssignment` del grupo viejo → posible orfandad ⚠. *Validación:* reasociar en transacción. *Falta:* verificación de reasociación de notas/asistencia/observador.

**H3 · Docente entra en licencia.** Flujo: `staff-leave` + reasignar grupo a suplente. *Riesgos:* la migración de notas al nuevo `TeacherAssignment` **borra conflictos** [C-3]. *Mejora:* conciliar con respaldo, nunca borrar.

**H4 · Rector cambia la escala institucional.** Flujo: editar config. *Riesgos:* notas/reprobación/promoción almacenadas **no se reconvierten** (matriz §9 fila roja). *Falta:* recálculo masivo en cola + advertencia ⚠️ + auditoría. *Mejora crítica.*

**H5 · Error en notas de hace tres meses.** Flujo: reabrir período (`TermReopeningRecord`) → corregir → regenerar boletín (nueva versión ✅). *Riesgos:* **sin auditoría** de la corrección [C-4]; si el período está cerrado la asistencia sí se puede tocar sin rastro (M-3). *Mejora:* auditoría de notas + motivo obligatorio.

**H6 · Cambio de calendario académico.** Flujo: editar calendario/períodos. *Riesgos:* asistencia esperada ya calculada queda desfasada ⚠. *Falta:* recálculo de clases esperadas. *Validación:* impedir cambios que invaliden registros existentes sin recálculo.

**H7 · Estudiante se retira y vuelve.** Flujo: `WITHDRAWN` → reingreso (`EnrollmentEvent`). *Riesgos:* continuidad del histórico entre matrículas ⚠. *Mejora:* vista unificada de trayectoria del estudiante.

**H8 · Restaurar el estado exacto de la semana pasada.** *Estado:* ❌ **imposible de forma granular.** Solo restaurando toda la BD a un backup (perdiendo lo posterior). *Falta:* auditoría con reversión + papelera + PITR. *Mejora crítica [CN-3].*

**H9 · Migrar colegio de 4.000 estudiantes.** *Estado:* 🔴 sin motor de migración (§3) y, aunque existiera, el import síncrono haría timeout (R-1). *Falta:* motor de migración **en cola** + lotes + rollback.

**H10 · Nuevo año manteniendo histórico.** Flujo: `createYear` (DRAFT) → `promoteStudents` (idempotente ✅, conserva años anteriores). *Riesgos:* no clona estructura (G-3); promoción secuencial (R-3); no asigna grupo destino automáticamente. *Mejora:* "duplicar año" + asignación de grupo + ejecución en cola.

---

# 11. ENTREGABLE — CERTIFICACIÓN

## 11.1 Riesgos operacionales
- Operaciones largas síncronas sin cola (R-1, CN-2) · cierre/promoción no transaccionales (G-2) · activar año sin validar completitud (G-1).

## 11.2 Riesgos administrativos
- Sin wizard de onboarding · sin clonado de año (G-3) · sin motor de migración · procesos manuales repetitivos · errores difíciles de diagnosticar.

## 11.3 Riesgos de experiencia de usuario
- Curva alta para no expertos · sin "deshacer" universal · sin panel de salud · mensajes de error poco accionables.

## 11.4 Riesgos de escalabilidad
- Bucles secuenciales + N+1 (R-2, R-3) · sin paginación de jobs · contención en picos de digitación (R-4).

## 11.5 Riesgos de continuidad
- Sin estrategia documentada de backup/restore/PITR (CN-1) · sin jobs reanudables (CN-2) · sin restauración granular (CN-3).

## 11.6 Funcionalidades imprescindibles antes de producción (multi-año, escala)
1. **Cola de trabajos** para boletines, importación, cierre y promoción (con progreso/reintento/reanudación).
2. **Transaccionalidad + reanudación** en cierre y promoción de año.
3. **Optimistic locking** en planillas de notas y entidades de alta contención.
4. **Auditoría de notas y asistencia** (antes/después/autor/fecha/motivo) — [C-4].
5. **Papelera + restauración granular** y revisión de cascadas — [C-5].
6. **Recálculo masivo** al cambiar escala/porcentajes (en cola) — H4, §9.
7. **Validación de completitud** antes de activar año (G-1) y **gate** en el wizard.
8. **Estrategia de backups/PITR documentada y probada** (CN-1).
9. (Pre-requisito) Cerrar el **Bloque 0** de Fase 1: modelo dual de notas, "0=borrar", borrado en cambio de docente.

## 11.7 Automatizaciones recomendadas
Clonado de año · detección de elegibles a recuperación · conciliación de duplicados · simulador de cierre · panel de salud de datos · validación nightly de inconsistencias · asistentes IA (observador, planes de mejoramiento, mapeo de migración, explicación de promoción).

## 11.8 Procesos que deben rediseñarse
- **Cierre y promoción de año** → transaccional + en cola + por lotes.
- **Digitación de notas** → modelo único + locking + estado de planilla (borrador/entregada).
- **Cambio de escala/porcentajes** → con recálculo y auditoría.
- **Onboarding y migración** → wizard + motor ETL.
- **Borrado** → soft-delete + papelera universal.

## 11.9 Plan de fortalecimiento del núcleo operacional (fases)
- **Fase A — Integridad** (pre-requisito): Bloque 0 + Bloque 1 de Fase 1 (notas, auditoría, papelera).
- **Fase B — Robustez operacional**: transaccionalidad de cierre/promoción, optimistic locking, validación de completitud.
- **Fase C — Escala**: cola de trabajos + procesamiento por lotes + índices + paginación.
- **Fase D — Onboarding/Migración**: wizard + motor de migración con rollback.
- **Fase E — Continuidad**: estrategia de backup/PITR, restauración granular, runbooks de incidentes.
- **Fase F — Productividad/IA**: clonado de año, panel de salud, simulador de cierre, asistentes IA.

## 11.10 Procesos de clase mundial que Edusyn aún no contempla
- **"Duplicar año académico"** (rollover de estructura) — estándar en PowerSchool/Q10; elimina la recreación anual (G-3).
- **Snapshot/PITR granular por institución** con restauración selectiva — confianza para operar años (H8).
- **Estado de planilla y flujo de entrega/aprobación** (docente entrega → coordinador aprueba) — control de calidad de notas.
- **Cola de trabajos con tablero de progreso** visible al admin — operaciones masivas sin "pantalla congelada".
- **Centro de migración con plantillas memorizables** por plataforma de origen.
- **Doble confirmación y autorización por flujo** para acciones irreversibles (no solo permiso, sino aprobación).
- **Data quality dashboard** permanente (no solo en onboarding).
- **Bitácora de auditoría consultable y reversible** por el administrador.

## 11.11 CHECKLIST DEFINITIVO PARA LIBERAR A PRODUCCIÓN

> Edusyn se libera para un colegio real **multi-año a escala** cuando TODO está en verde. (Para piloto ≤300 con admin experto y respaldos disciplinados, basta el bloque ⭐.)

**⭐ Mínimos de integridad (también para piloto):**
- [ ] Bloque 0 de Fase 1 cerrado (modelo de notas único, cero registrable, sin borrado silencioso, bulk transaccional).
- [ ] Auditoría de notas y asistencia operativa.
- [ ] Papelera con restauración + cascadas revisadas.
- [ ] Backups automáticos verificados con **prueba de restauración** documentada.

**Robustez operacional:**
- [ ] Cierre de año y promoción transaccionales y reanudables.
- [ ] Optimistic locking en planillas y entidades de alta contención.
- [ ] Activar año bloqueado hasta validación de completitud (gate del wizard).
- [ ] Cambio de escala/porcentajes con recálculo masivo + advertencia + auditoría.

**Escala:**
- [ ] Boletines, importación, cierre y promoción ejecutándose en **cola** sin timeout a 5.000.
- [ ] Procesamiento por lotes (sin bucles fila a fila) y contexto resuelto una vez.
- [ ] Prueba de carga concurrente (digitación simultánea fin de período) sin pérdida.

**Onboarding y continuidad:**
- [ ] Wizard de configuración inicial funcional con gate de completitud.
- [ ] Motor de migración con preview + conciliación + rollback + reporte (al menos Excel + 1 plataforma).
- [ ] Estrategia de backup/PITR y runbook de incidentes (servidor, BD, fallo en cierre/promoción).
- [ ] Restauración granular o PITR por institución validada (Historia 8).

**Seguridad/permisos:**
- [ ] Catálogo de roles validado (no string libre) — P-1.
- [ ] Acciones irreversibles con doble confirmación/autorización — P-3.
- [ ] Aislamiento verificado: acudiente/estudiante ven solo lo propio — P-4.

---

## RESUMEN EJECUTIVO (FASE 2)

El **ciclo de vida institucional está casi completo a nivel de funciones** (crear → activar → operar → recuperar → cerrar → promover → año siguiente, con validaciones reales y snapshots de boletín). La debilidad de Edusyn **no es de funciones, sino de robustez operacional para multi-año y escala**: todo lo pesado corre **síncrono y sin colas**, **no hay control de concurrencia**, el **cierre/promoción no son transaccionales**, y faltan **auditoría granular, restauración puntual, wizard de onboarding y motor de migración**.

**Certificación:** ✅ apto para **piloto controlado (≤300, admin experto, respaldos disciplinados)** una vez cerrado el bloque ⭐. ❌ **no certificable** para operación **multi-año de colegios medianos/grandes** hasta completar las Fases A–E del plan §11.9. La recomendación de Fase 1 se mantiene y se refuerza: **congelar módulos nuevos y fortalecer el núcleo operacional primero.**
