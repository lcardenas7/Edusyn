# Plantillas académicas: aislamiento de aplicación

Fecha: 2026-09-11. Base: staging 95b2e3e5; continuidad y encargo paralelo a Claude publicados en edf5feb7. Alcance: `academic/templates`, no todo el módulo `academic`.

## Hallazgos y correcciones

Antes, 20 de las 22 declaraciones no resolvían directamente la institución del actor. Una es el catálogo estático `enums`; las otras 19 requerían corrección. Crear una plantilla o ejecutar el asistente confiaba en el `institutionId` del cuerpo. Las rutas por ID permitían consultar, modificar, desasignar o eliminar configuraciones de otro colegio. La sincronización deducía la institución del grado enviado por el cliente.

Ahora las 21 rutas institucionales resuelven el contexto con `requireInstitutionId`. Los cuerpos no pueden sustituir la institución del actor ni los IDs de plantilla, área o grupo de la ruta. El catálogo estático conserva autenticación/roles y una excepción documentada; no accede a Prisma.

El servicio exige contexto y usa guardas compartidas para plantilla, área de plantilla, asignatura de plantilla, año, grado, grupo, área y materia. Las referencias ajenas se rechazan con 404 antes de colecciones, conteos o escrituras. Cada consulta posterior incorpora su ámbito con `AND: scopeWhere(...)`; las relaciones sin columna institucional se filtran a través de plantilla, grado, grupo o área. Las inclusiones de colecciones también se acotan. Todos los borrados usan `deleteMany` acotado y comprueban `count`.

Se validan referencias secundarias antes de persistir: año del colegio, plantilla del año asignado, área del colegio, materia de esa área, grupo y año de las excepciones. El asistente comprueba todas las referencias recibidas antes de abrir su transacción. La sincronización filtra las asignaciones por institución y por sus relaciones institucionales y rechaza una plantilla asignada a otro año.

Las actualizaciones aceptaban objetos sin DTO de clase y pasaban `data` completo a Prisma. Se restringen a campos editables para impedir cambiar IDs, institución, año o relaciones mediante propiedades adicionales. La modificación de plantillas predeterminadas ahora se limita al año académico correspondiente; antes podía desmarcar las de otros años del mismo colegio.

Crear/actualizar predeterminadas, cambiar materias dominantes, eliminar plantillas y sincronizar se ejecutan en transacciones serializables. El asistente mantiene su transacción conjunta y usa aislamiento serializable. Las pruebas comprueban reversión simulada al fallar una escritura posterior. Esto no certifica el comportamiento concurrente de PostgreSQL.

## Inventario de rutas

Todas bajo `/academic-templates`. Antes: 22 declaraciones, 2 resoluciones directas y 20 excepciones pendientes. Después: 21 resoluciones directas y 1 catálogo no institucional. No hay rutas nuevas.

| Operación | Rutas | Evidencia |
|---|---:|---|
| POST raíz, GET raíz, GET/PUT/DELETE :id | 5 | Actor, año, plantilla, campos editables y borrado acotado; A/B y HTTP |
| POST :templateId/areas, PUT/DELETE areas/:templateAreaId | 3 | Plantilla/área institucionales, cuerpo no sustituye el ID de ruta; A/B y HTTP |
| POST areas/:templateAreaId/subjects, PUT/DELETE subjects/:templateSubjectId | 3 | Materia del área, guardas previas, dominantes y conteos acotados; A/B y HTTP |
| POST/DELETE grades/:gradeId/assign, GET grades/:gradeId | 3 | Grado, año, plantilla y coherencia anual; A/B y HTTP |
| POST grades/:gradeId/sync-from-assignments | 1 | Actor obligatorio, consultas institucionales y reversión simulada; A/B y HTTP |
| POST quick-setup | 1 | Grado/año y todas las referencias del cuerpo; A/B y HTTP |
| POST/GET groups/:groupId/exceptions, DELETE groups/:groupId/exceptions/:subjectId | 3 | Grupo, año, materia y mutaciones acotadas; A/B y HTTP |
| GET grades | 1 | Año validado antes de grados y conteos; A/B y HTTP |
| GET groups/:groupId/effective-structure | 1 | Guardas de grupo/año antes del detalle y herencia acotada; A/B y HTTP |
| GET enums | 1 | Catálogo estático; prueba HTTP confirma cero consultas |

## Pruebas y contrato estructural

- `templates.isolation.spec.ts`: 100 pruebas nuevas de servicio. Las 21 operaciones institucionales rechazan cruces A→B y B→A antes de colecciones, conteos, transacciones y escrituras; omitir institución tampoco consulta almacenamiento. Incluye casos legítimos, referencias secundarias ajenas, cuerpos manipulados, datos hijos inconsistentes y reversión simulada.
- `templates.http-isolation.spec.ts`: 67 pruebas nuevas con Nest, JwtStrategy, RolesGuard, ValidationPipe y servicio reales. Rechazo cruzado de las 21 operaciones en ambas direcciones; lectura docente válida, escritura docente denegada y cuerpo que intenta reemplazar institución o ID de ruta.
- `templates.service.spec.ts`: mantiene sus 4 casos del asistente (preescolar, áreas requeridas, creación conjunta y reutilización de materias), usando ahora el fixture relacional.
- `test/fixtures/templates.fixture.ts`: aplica igualdad, AND/OR, relaciones y proyecciones de Prisma; registra consultas/mutaciones y restaura filas al fallar una transacción. No es PostgreSQL ni reproduce cascadas, locks o RLS.

Se retiran 19 excepciones estructurales y se reclasifica únicamente `getEnums`. Inventario global: 1.113 declaraciones, 293 directas, 759 pendientes de calibración y 61 no institucionales. No se regeneraron ni silenciaron excepciones de otros controladores.

Verificación: 92 suites / 1.693 pruebas API y 22 archivos / 214 pruebas web aprobados; tipos API/web y build Nest aprobados. El fixture de Matrículas se amplió para evaluar AND, conservando todas sus aserciones y sus 63 pruebas. La prueba de mutación local confirmó que retirar la guarda de año permite crear referencias cruzadas y hace fallar ambos casos A/B; el archivo se restauró antes de repetir la suite completa.

## Qué NO cubre

- PostgreSQL sintético: concurrencia, colisiones, cascadas y rollback del motor siguen pendientes. También queda probar el cambio concurrente de referencias entre guardas y altas que no tienen transacción propia; no se declara cierre operativo total.
- Autorización por asignación docente dentro del colegio. Se conservan los roles existentes; ese eje pertenece al Bloque 4.
- Otras rutas de `academic`, incluso las que escriben las mismas tablas. El único ajuste externo es pasar `params.institutionId` desde `TeacherAssignmentsService` al nuevo argumento obligatorio de sincronización; no audita ese servicio ni su controlador.
- `overrides` JSON se conserva como configuración opaca, sin definir una nueva interpretación de sus claves. No se rediseña la herencia ni las reglas pedagógicas.
- Datos históricos inconsistentes fuera de las relaciones filtradas, migraciones, RLS, producción o comprobación de Railway. No se consultó ninguna base real.

Inclusión se mantiene pospuesta por instrucción del usuario. Claude tiene un encargo independiente para `learning-route` en `ENCARGO_CLAUDE_BLINDAJE_LEARNING_ROUTE.md`; su ejecución no está confirmada por esta entrega.
