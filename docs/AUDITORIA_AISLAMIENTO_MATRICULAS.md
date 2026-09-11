# Matrículas: aislamiento y revisión integral del movimiento

Fecha: 2026-09-11. Base: `origin/staging` en `000d435b`. Trabajo en worktree aislado. El usuario eligió revisar integralmente notas, asistencia y tutorías y autorizó corregir también problemas de proceso.

## Alcance y resultado

Se revisaron las 17 rutas de EnrollmentController, las 3 de EnrollmentReportsController y las 2 operaciones de GradeChangeController. Su ruta restante es un catálogo estático: excepción individual, no permiso global. Los tres servicios reciben la institución del actor como argumento obligatorio.

También se corrigieron dependencias concretas del movimiento: estructura efectiva de plantillas, promedio por componente, nota de período, nota anual y resumen de asistencia. Sus controladores resuelven el actor; los consumidores de cierre anual y reportes pasan ese mismo contexto. Esto **no cierra los módulos academic, evaluation, attendance ni reports completos**.

## Hallazgos y correcciones

| Hallazgo | Resultado de esta entrega |
|---|---|
| Rutas recibían IDs de matrícula, estudiante, año o grupo sin contexto obligatorio | Resolución directa del actor y guardas compartidas; recursos ajenos o ausentes producen 404 |
| Reportes cargaban año y matrículas por ID sin colegio | Año, filtros y colección institucionales antes de producir PDF o Excel |
| Varias operaciones deducían el colegio desde el recurso | Creaciones y eventos reciben la institución autenticada; el body no decide el colegio |
| Traslado de notas, asistencia y tutorías dependía de la guarda inicial | Cada lectura y actualización se acota por institución; los IDs de grupo/año se comprueban antes de operar |
| Plantillas y cálculo de promoción podían recorrer recursos ajenos | Guardas iniciales de matrícula, año, período, asignación y componente; filtros propios de las lecturas posteriores |
| Grupo, notas, estructura e historial se guardaban por separado | Una transacción serializable reúne las escrituras del movimiento; un fallo revierte todo |
| Fallos al crear el snapshot se ocultaban | Se propagan y revierten la operación; regenerar no elimina un snapshot existente si el destino carece de plantilla |
| El endpoint simple permitía cambiar de grado eludiendo la validación académica | Solo admite cambios de grupo dentro del mismo grado; cambio de grado pasa por GradeChangeService |
| La exigencia de acta dependía del tipo de cambio declarado por el cliente | Se usa el tipo calculado por el servidor; acta aprobada del año correspondiente y de esa matrícula si tiene destinatario individual |
| Cambios sobre año cerrado y reactivación sin cupo | Rechazo explícito; una corrección administrativa no calcula innecesariamente la promoción |

El cambio de curso conserva la lógica previa: mueve PartialGrade y AttendanceRecord a la asignación destino por asignatura y TutoringAttendance al nuevo grupo. PeriodFinalGrade conserva su vínculo por asignatura. StudentGrade permanece ligado a su actividad original; su contador histórico `studentGradesMigrated` cuenta notas conservadas, no escrituras de traslado. En cambio de grado se conserva la historia anterior y se actualiza la estructura. No se recalculan ni inventan notas.

## Evidencia reproducible

- `enrollment.isolation.spec.ts`: **63 pruebas** de servicios. Rechazos A→B/B→A, filtros institucionales, recursos secundarios cruzados, cálculos compartidos y preservación de B durante un traslado de A. Incluye fallos de historial y snapshot con reversión, plantilla destino ausente, reactivación sin cupo y actas de otro año/estudiante.
- `enrollment.http-isolation.spec.ts`: **48 pruebas HTTP**. JWT firmados con secreto aleatorio en memoria, estrategia JWT y RolesGuard reales, controladores y servicios reales. Incluye todas las entradas de estos tres controladores que operan datos, búsqueda por documento sin revelar B, ausencia de sesión y docente sin permiso de escritura.
- `test/fixtures/enrollment.fixture.ts`: Prisma simulado que filtra las condiciones, muta filas y restaura su estado si falla una transacción. Las pruebas cruzadas exigen ausencia de transacción, colecciones y escrituras posteriores. No es un mock que siempre encuentre cualquier ID.
- Se conservan los resultados aritméticos de las pruebas existentes de nota anual y componentes finales.
- Suite API completa: **86 suites / 1.383 pruebas**, tipos API y web aprobados. Build Nest aprobado; web 21 archivos / 208 pruebas y smoke local de navegador aprobados.

El laboratorio HTTP no conecta una base: prueba la capa de aplicación, no la ejecución transaccional de PostgreSQL, RLS, el middleware global de producción ni una sesión de Railway. Las pruebas de reversión simulan la semántica de rollback; la elección de una transacción Prisma es el mecanismo de producción, pendiente de prueba con una base sintética aislada.

## Contrato estructural

Se retiran 25 excepciones pendientes de las rutas que ahora resuelven directamente. `GradeChangeController.getGradeChangeRules` se clasifica como catálogo estático, sin certificar el contenido de sus reglas. Nueve rutas hermanas de Attendance conservan su deuda: únicamente cambió la huella por el import compartido. No se rebaselinaron otros controladores.

Inventario después: **1.110 declaraciones; 271 directas, 779 pendientes de calibración y 60 no institucionales**. Son categorías estructurales, no un porcentaje de vulnerabilidades.

## Qué NO cubre

- Otros servicios de academic y operaciones de evaluation/attendance/reports fuera de las dependencias indicadas. Templates completo sigue pendiente.
- Autorización por estudiante propio, asignación docente o acudiente dentro del mismo colegio; corresponde al inventario separado del encargo.
- Prueba PostgreSQL real de contención, colisiones de registros destino y serialización. Una colisión revierte la transacción; no se fusionan automáticamente notas históricas.
- Auditoría legal de las reglas del catálogo estático; no se modificaron normas académicas ni RLS.
- Railway, producción, migraciones, R1, EduLab y Aula Clásica.

La auditoría integral de código del flujo de Matrículas tiene esta evidencia. El cierre operativo queda **parcial** hasta probar PostgreSQL sintético y las dependencias HTTP compartidas restantes. No se declara el módulo academic blindado.
