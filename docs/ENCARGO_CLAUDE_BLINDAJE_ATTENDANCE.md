# Encargo a Claude: blindaje integral de Attendance

Fecha: 2026-09-11. Solicitado por el usuario. Ejecutar después de entregar `learning-route`, o en paralelo únicamente con un worktree y una rama independientes.

## Objetivo

Auditar y corregir todo `apps/api/src/modules/attendance`, incluidas asistencia por asignatura, asistencia de tutoría, reportes y auditoría. Debes demostrar rechazo A/B por servicio y HTTP antes de declarar cerrado el módulo. La corrección previa usada por Matrículas cubrió solo `AttendanceService.getStudentSummary` y el traslado de registros durante cambios de grupo; no extiendas esa evidencia al resto.

Lee primero desde `origin/staging` actualizado:

- `docs/ENCARGO_BLINDAJE_ASTRA.md`
- `docs/ESTADO_BLINDAJE.md`
- `docs/AUDITORIA_AISLAMIENTO_RECUPERACIONES.md`
- `docs/AUDITORIA_AISLAMIENTO_MATRICULAS.md`
- `docs/REGISTRO_DESPLIEGUES.md`
- `docs/ENTREGA_CLAUDE_LEARNING_ROUTE.md`, cuando exista, para no repetir decisiones o arrastrar su rama.

## Aislamiento de trabajo

Crea un worktree nuevo desde el `origin/staging` que ya contenga la entrega de `learning-route` integrada por Astra, salvo que Astra te indique explícitamente otra base. Rama sugerida: `codex/blindaje-attendance-claude`.

No reutilices la rama ni el worktree de `learning-route`. No hagas push directo a `staging` o `main`. Entrega commits propios para revisión. Si necesitas compartirlos entre máquinas, publica solo tu rama de trabajo.

## Archivos permitidos

- `apps/api/src/modules/attendance/attendance.controller.ts`
- `apps/api/src/modules/attendance/attendance.service.ts`
- `apps/api/src/modules/attendance/attendance-audit.service.ts`
- `apps/api/src/modules/attendance/tutoring-attendance.controller.ts`
- `apps/api/src/modules/attendance/tutoring-attendance.service.ts`
- DTOs y `attendance.module.ts` solo si son necesarios.
- Pruebas nuevas dentro del módulo y fixtures exclusivos `apps/api/test/fixtures/attendance*.ts`.
- `docs/AUDITORIA_AISLAMIENTO_ATTENDANCE.md`, nuevo.
- `docs/ENTREGA_CLAUDE_ATTENDANCE.md`, nuevo, con hashes, base y verificación exacta.

No modifiques Enrollment, Plantillas, APD, Classroom, Evaluation, Observer, R1, EduLab, el esquema Prisma, migraciones o RLS. Si una firma usada por Matrículas cambia, conserva compatibilidad o documenta un parche externo mínimo para que Astra lo integre.

## Inventario que debes reconciliar

La base revisada tiene 17 declaraciones HTTP:

- `attendance.controller.ts`: 10 rutas.
- `tutoring-attendance.controller.ts`: 7 rutas.

Vuelve a contar. La tabla de estado actual marca 1 resolución directa y 16 pendientes. El resultado final puede diferir, pero cada diferencia exige evidencia. No clasifiques una ruta como segura por mencionar `institutionId`: demuestra de dónde sale y cada operación posterior.

## Defecto inicial ya observado

Úsalo como punto de partida, no como lista exhaustiva:

- `recordBulk` carga `teacherAssignment` por ID sin institución y deduce de esa fila el colegio y año.
- `update` carga el registro y luego actualiza por ID.
- `getByAssignmentAndDate`, `getByStudent` y reportes aceptan IDs sin contexto obligatorio.
- Los reportes por grupo/año consultan matrículas, registros, materias, horarios y asignaciones en varias fases; cada fase necesita alcance propio.
- `TutoringAttendanceService.recordBulk` carga grupo por ID; `getByGroupAndDate`, resúmenes y reportes no reciben siempre institución.
- `assertCanReadGroupReport` comprueba permisos dentro del colegio, pero primero debe existir una frontera institucional indistinguible mediante 404.
- Los modelos de asistencia/tutoría y auditoría pueden requerir filtros por relaciones; confirma el esquema real, no asumas que todos tienen `institutionId`.
- La función de toggle de tutoría cambia configuración institucional: el actor debe fijar la institución y los roles existentes deben mantenerse.

## Método obligatorio

1. En las 17 rutas, usa `await requireInstitutionId(...)` directo e incondicional para todo recurso institucional. El cuerpo/query no decide la institución. Una ruta realmente global o estática necesita justificación concreta.
2. Crea guardas compartidas y mínimas antes de cualquier colección, agregado, auditoría, generación de reporte o escritura: año, período, asignación, matrícula, grupo, estudiante y registro. Un ID ajeno o contexto ausente devuelve 404.
3. Valida toda la cadena relacional. Ejemplos: asignación → grupo/área/materia/año → institución; matrícula → estudiante/grupo/año → institución; grupo → sede/grado → institución. Fechas y filtros no sustituyen esas guardas.
4. Todas las consultas posteriores deben llevar alcance. Si una tabla carece de `institutionId`, filtra mediante la relación institucional. Incluye `count`, `groupBy`, consultas de horarios, reportes detallados y auditoría.
5. Restringe cuerpos sin DTO a campos editables. No permitas mover un registro a otra asignación, matrícula, grupo, año, usuario o colegio mediante propiedades adicionales.
6. Usa borrados acotados con `deleteMany` y comprueba `count` si existe una operación de borrado. No añadas operaciones nuevas solo para cumplir esta regla.
7. Las operaciones compuestas deben ser atómicas: registro masivo, actualización más auditoría y cambios de configuración que escriban más de una fila. Revalida dentro de la transacción para cerrar la carrera entre guarda y escritura. No ocultes fallos de auditoría.
8. Conserva las reglas legítimas de fechas finalizadas, estados de matrícula, estados de asistencia y permisos de reporte. Si una regla funcional parece incorrecta, documéntala antes de cambiarla, salvo que cause una escritura parcial o fuga entre colegios.

## Decisiones de política

- Para un actor con roles institucionales, nunca elijas el colegio desde la asignación, grupo o matrícula enviados por el cliente. La institución viene del JWT/resolvedor.
- Un docente puede conservar los límites existentes sobre sus asignaciones o grupos dirigidos. No amplíes ni inventes permisos internos: enumera cualquier hueco en la sección Bloque 4.
- Un estudiante/acudiente, si alguna ruta los admite, solo puede consultar la identidad vinculada a su sesión y dentro de la institución. No selecciones “la matrícula más reciente” si no coincide con año/grupo del recurso.
- Recurso ajeno, matrícula incompatible o inexistente: 404. Ambigüedad institucional real: 409. Parámetros de fecha inválidos: 400. No dejes errores genéricos que terminen en 500.
- Los reportes con `includeWithdrawn` pueden incluir historia legítima del mismo colegio/año/grupo; nunca filas ajenas.

## Pruebas exigidas

Construye un fixture A/B que evalúe filtros y relaciones de verdad, mute filas y restaure estado al fallar transacciones. Un doble que siempre devuelve el registro no sirve.

Cubre en ambas direcciones, y afirma lo que no ocurrió:

- Registrar asistencia masiva de una asignación ajena.
- Actualizar un registro ajeno.
- Leer por asignación, estudiante o matrícula ajenos.
- Resumen de estudiante, reporte de asignación y reporte por grupo.
- Consolidado, cumplimiento docente y reporte detallado con año/grupo/materia ajenos.
- Estado, registro, lectura, resumen, reporte de grupo, detallado y toggle de tutoría.
- Referencias secundarias mezcladas dentro del mismo colegio y entre colegios.
- Ausencia de contexto, cuerpo con `institutionId` falsificado, fechas inválidas y roles no permitidos.
- Reversión cuando falla una escritura intermedia o la auditoría.
- Casos legítimos y resultados aritméticos de reportes, para no “blindar” rompiendo el proceso.

Añade pruebas HTTP con Nest, JwtStrategy, RolesGuard y ValidationPipe reales, dos colegios sintéticos y todos los roles ya admitidos. Simula únicamente Prisma; no conectes staging/producción. Las 17 rutas deben aparecer en una matriz de cobertura, incluidas ambas direcciones de cruce para operaciones representativas de lectura, escritura, agregado y configuración.

Haz una prueba de mutación local: retira temporalmente una guarda de alto riesgo, confirma que falla un caso A/B y restaura el archivo antes de la suite final. No publiques el script temporal.

## Contrato estructural

Puedes actualizar `apps/api/src/common/security/institution-route-exceptions.json` únicamente en un commit final separado y solo para rutas de Attendance auditadas. Retira excepciones que sean obsoletas por resolución directa. Reclasifica una excepción solo con evidencia de que no consulta ni muta datos institucionales. No regeneres la lista ni cambies huellas de otros módulos.

No edites `docs/ESTADO_BLINDAJE.md` o `docs/REGISTRO_DESPLIEGUES.md`; Astra los integra. En `ENTREGA_CLAUDE_ATTENDANCE.md`, incluye:

- Lista exacta de las 17 rutas y resultado.
- Claves exactas retiradas/reclasificadas del archivo de excepciones.
- Inventario global antes/después.
- Commits en orden y cuál contiene únicamente excepciones.
- Fila propuesta para `ESTADO_BLINDAJE.md` y para la bitácora.
- Conteos de pruebas y comandos ejecutados.
- Sección obligatoria “Qué NO cubre”.

## Verificación y terminado

Ejecuta suite API completa, tipos API/web, suite web, build Nest y contrato estructural. Repite tras integrar el staging vigente si cambió. No debilites pruebas existentes ni amplíes excepciones para conseguir verde.

Attendance solo puede marcarse cerrado en aplicación si las 17 rutas están clasificadas, todas las operaciones institucionales rechazan A/B antes de datos secundarios/escrituras, las relaciones quedan acotadas y el laboratorio HTTP está en verde. PostgreSQL/RLS, despliegue Railway y autorización fina deben declararse aparte. Un avance parcial se entrega como parcial con el inventario restante exacto.
