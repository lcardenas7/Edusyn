# Inclusión Educativa (APD): auditoría parcial y flujo de trabajo

Fecha: 2026-09-11. Revisión iniciada en `origin/staging` 8f63c9d9, integrada sobre ee1cbb3a. Correcciones: 9ae32d6b. No declara el módulo cerrado.

## Hallazgos corregidos

- La pantalla consultaba la configuración al entrar, pero el API rechazaba a DOCENTE y PSICOLOGA. Se permite leer únicamente las dos banderas de acceso a esos roles; modificar configuración conserva sus roles administrativos. Desactivar el acceso docente sigue bloqueando las consultas de trabajo.
- La selección de años, grupos, estudiantes y planes dependía de APIs generales con permisos incompatibles con orientación. Tres consultas propias de APD devuelven el contexto mínimo, con institución del actor y validación de grupo, año o período antes de listar estudiantes/planes. No se ampliaron los permisos de las APIs académicas generales.
- Leer un perfil o plan por ID cargaba sus relaciones antes de comprobar su colegio. Ahora una guarda compartida y mínima rechaza con 404 antes de la consulta de detalle. La consulta posterior y las actualizaciones conservan el filtro institucional.
- Crear un plan comprobaba la matrícula después de leerla sin filtro y aceptaba período, aprendizaje o perfil sin validar su institución. Ahora valida matrícula activa, período del mismo año, aprendizaje institucional y perfil del mismo estudiante, activo y con consentimiento. Los cruces se rechazan antes de buscar duplicados o escribir.
- Crear/editar un perfil aceptaba una categoría de otro colegio. Se valida la categoría antes de guardar. Vaciarla sigue permitido.
- Reabrir o cancelar un plan completado conservaba `completedAt` y `completedById`. Se limpian al salir de COMPLETED. Se conserva el vaciado explícito de fecha de seguimiento.

## Inventario antes/después

Antes: 32 rutas, 31 con resolución directa. Después: 35 rutas, 34 con resolución directa. La excepción de `POST ai/valeria` sigue pendiente; no se modificó. Resolver institución en el controlador no demuestra aislamiento del servicio.

| Rutas relativas a `/apd` | Cantidad | Resultado / deuda |
|---|---:|---|
| GET/PUT config | 2 | Lectura por rol comprobada HTTP; escritura denegada a docente/orientación. Auditoría integral de escritura pendiente |
| GET workspace, workspace/students, plans | 3 | Nuevas; filtros institucionales y cruces grupo/año/período comprobados HTTP |
| POST profiles, PUT profiles/:id, GET profiles/:id | 3 | Guardas compartidas, categorías acotadas y pruebas A/B de servicio |
| GET profiles, profiles/by-student/:studentId | 2 | Filtro institucional existente y rechazo de contexto omitido; cobertura integral pendiente |
| POST plans, PUT plans/:id, GET plans/:id | 3 | Guardas compartidas, coherencia de matrícula/período/perfil y pruebas A/B de servicio |
| POST activities, PUT activities/:id, POST progress-logs | 3 | Corregidas: guardas antes de operar, relaciones acotadas, validación de enteros y transacción serializable. 54 pruebas de servicio/auxiliares y 32 HTTP; PostgreSQL sintético pendiente |
| GET/POST categories, PUT categories/:id | 3 | Pendiente de auditoría integral; validación de referencia desde perfiles ya corregida |
| POST participants, DELETE participants/:id, PUT participants/:id/sign | 3 | Pendiente: pertenencia, usuarios vinculados, borrado acotado y reglas de firma |
| POST plan-subjects, DELETE plan-subjects/:id | 2 | Pendiente: materia/docente vinculados y borrado acotado |
| POST documents, DELETE documents/:id | 2 | Pendiente: guardas, borrado y recorrido de adjuntos |
| GET reports/category, progress, grades, at-risk | 4 | Pendiente de revisión A/B de agregaciones y relaciones |
| GET inclusion-index, diagnosis-stats | 2 | Pendiente de revisión A/B y fallos parciales del resumen |
| GET alerts | 1 | Pendiente de auditoría de servicio |
| GET academic-crossover | 1 | Pendiente: validar período antes de las consultas de perfiles |
| POST ai/valeria | 1 | Excepción estructural pendiente de clasificación; sin cambios |

## Evidencia

- `apps/api/src/modules/apd/apd-workspace.http.spec.ts`: 18 pruebas con Nest, estrategia JWT y RolesGuard reales; almacenamiento Prisma simulado con filtros A/B. Incluye docentes y orientación, bandera desactivada, intentos de cambiar configuración y cruces en ambas direcciones.
- `apps/api/src/modules/apd/apd-plans-isolation.spec.ts`: 39 pruebas de servicios. El doble aplica igualdad, claves compuestas y relaciones, y registra cada intento de escritura. Los cruces no escriben ni auditan; lectura cruzada no llega a consultas con relaciones. Incluye perfil de otro estudiante del mismo colegio, período de otro año, consentimiento, duplicados, contexto omitido, reabrir y vaciar campos.
- `apps/web/tests/enrollment-inclusion.smoke.cjs`: recorridos sintéticos de Matrículas e Inclusión, incluidos docente habilitado/deshabilitado, orientación, selección de estudiante, agenda, edición y pantalla móvil. Las peticiones están interceptadas: complementa las pruebas HTTP, no las sustituye.
- Verificación tras integrar staging: 88 suites / 1.440 pruebas API, 22 archivos / 214 pruebas web y recorrido de navegador aprobados. Build Nest y tipos API/web aprobados. Las tres pruebas antiguas de actualización de perfiles se adaptaron a consultas filtradas y rechazo 404; el ciclo de consentimiento sigue cubierto.

## Qué NO cubre

No hay cierre global de APD. Quedan las filas pendientes del inventario y la API compartida `pedagogical-support`, que accede a las mismas tablas. También falta controlar FKs históricas inconsistentes, la compatibilidad académica completa del aprendizaje opcional, carreras de creación de planes y transacciones en las demás mutaciones. Actividades y avances sí agrupan mutación/auditoría/recálculo en una transacción. No se probaron rollback ni concurrencia en PostgreSQL.

`SupportActivity`, `SupportProgressLog`, `SupportPlanParticipant`, `SupportPlanSubject` y `SupportDocument` no tienen columna propia `institutionId`: su aislamiento debe expresarse mediante la relación al plan. No requieren una migración para filtrar esa relación. No se modificaron esquema ni RLS.

La función interna `syncProfileFromDiagnosis` permanece pendiente: la búsqueda de referencias no encontró llamadas, pero su código activa perfiles sin consentimiento y copia detalles del diagnóstico a notas pedagógicas. No se elimina el legado ni se presenta como un flujo público probado.

La restricción docente a sus propias asignaciones y quién puede registrar una firma por otra persona pertenecen al inventario de autorización interna (Bloque 4). Este cambio conserva la política institucional de APD. Tampoco certifica el Layout completo, documentos/firmas, Railway o producción.

## Segunda entrega: actividades y avances

Base: staging ff81a71b. No añade rutas, tablas ni migraciones: APD conserva 35 rutas / 34 resoluciones directas / 1 excepción pendiente.

Antes, crear actividades y avances cargaba el plan sin filtro y después comparaba su colegio. Editar una actividad hacía lo mismo con su relación. Las actualizaciones usaban solo el ID y `ApdProgressService.recalculate` no recibía institución: podía leer actividades/avances y actualizar el porcentaje de un plan ajeno si se invocaba directamente. La auditoría por entidad tampoco exigía institución.

Ahora las tres rutas entran por guardas compartidas y mínimas. Una referencia ajena devuelve 404 antes de abrir transacciones, listar datos o escribir. Las altas conectan al plan con `{ id, institutionId }`; la modificación de actividad filtra por la institución de su plan. El recálculo exige contexto, valida el plan y acota ambas colecciones y la actualización del porcentaje. La consulta de auditoría filtra por institución incluso si dos registros usan el mismo identificador de entidad; omitir contexto se rechaza antes de consultar.

Actividad/avance, auditoría y porcentaje se escriben en una única transacción Prisma serializable. Se revalidan las referencias dentro de ella y un conflicto de serialización devuelve 409 para reintentar, sin reintento automático que pueda duplicar avances. Se rechazan puntajes no enteros fuera de 0–100 e indicadores no enteros fuera de 1–5, incluidos valores ausentes en avances. La fórmula de progreso conserva sus cuatro casos anteriores.

Evidencia añadida:

- `apd-activities.isolation.spec.ts`: 54 pruebas de rechazo A/B, contexto ausente, revalidación dentro de la transacción, filtros secundarios, indicadores, fórmula, auditoría y reversión simulada. Incluye un fallo de la última auditoría después de actualizar el porcentaje.
- `apd-activities.http.spec.ts`: 32 pruebas con Nest, JWT, RolesGuard, ValidationPipe y servicios reales; únicamente Prisma usa datos sintéticos simulados. Las tres rutas se prueban en ambas direcciones con DOCENTE, PSICOLOGA y ADMIN_INSTITUTIONAL, además de accesos válidos, bandera docente desactivada y cuerpo que intenta sustituir la institución.
- `test/fixtures/apd-activities.fixture.ts`: aplica filtros de igualdad y relaciones, valida conexiones al plan, registra el cliente usado en cada operación y restaura filas ante un fallo transaccional. No reproduce el motor SQL, sus locks, middleware global ni RLS.

Las rutas no cubren borrar actividades/avances porque no existen esas operaciones en este controlador. No se añadieron ni modificaron las reglas de cierre de planes o de asignación docente. Adjuntos, participantes, firmas, materias y agregaciones siguen pendientes según la tabla.

Verificación de esta segunda entrega: 90 suites / 1.526 pruebas API, 22 archivos / 214 pruebas web, tipos API/web y build Nest aprobados. Prueba de mutación local: retirar la guarda de creación hizo fallar ambos casos A/B; tras restaurarla pasaron nuevamente las 54 pruebas de servicio. Los archivos temporales de esta comprobación no se publican. No se conectó ninguna base de datos.
