# Banco de preguntas — aislamiento HTTP y relaciones

Fecha: 2026-10-21. Base producción `a403b4fe`; integración prevista sobre staging `a1625ed2`. Worktree aislado `blindaje-bancos-http`; no se incorpora el trabajo no confirmado del directorio principal.

## Alcance y hallazgo

Se revisan las siete rutas de `QuestionBankController`: listado, catálogo oficial, importación, creación/edición de colecciones y creación/edición de preguntas. No se acreditan por este lote las rutas de Duelos, Arena o Eventos matemáticos.

El servicio ya validaba aula, asignación docente, institución, grado y autoría. El listado de colecciones y el método interno `copyToActivity`, sin ruta HTTP directa en esta base, filtraban las preguntas anidadas solo por estado activo. Una pregunta con `institutionId` distinto al de su colección podía incluirse si existiera esa relación incoherente. Se añade el filtro institucional en ambas lecturas. Se demuestra con fixtures sintéticos; no se inspeccionaron bases reales ni se afirma que contengan esas relaciones.

Cada ruta resuelve ahora directamente `requireInstitutionId` antes de construir el actor. Se conserva el normalizador privado de roles, pero no una resolución oculta en promesas. Así el contrato estructural puede comprobar las siete rutas sin nuevas excepciones. Para usuarios normales manda la sesión y se ignora el destino enviado por cliente. Un SuperAdmin real debe indicar una institución existente en query mediante `ValidateTenantContextGuard`, y sigue sujeto a la asignación docente. Un rol institucional llamado SUPERADMIN no otorga ese privilegio.

## Evidencia focal

104 pruebas aprobadas: 27 existentes de servicio y 77 nuevas de integración (76 HTTP y una del método interno de copia). Se ejecutan JWT, estrategia, guards, controlador, servicio y acceso relacional reales; únicamente Prisma/persistencia son sintéticos.

- A→B y B→A usando el mismo usuario docente en ambos colegios; las siete rutas rechazan un aula ajena antes de leer bancos o escribir.
- Colecciones ajenas, grado incorrecto, inactivas, preguntas de otra colección/institución, autor diferente y docente sin asignación.
- Aula personal, inexistente y cadenas incoherentes de asignación, año, campus, grado o área.
- Listado limitado a publicados o del autor; preguntas activas de la institución; catálogo oficial sin contenido de preguntas.
- Formularios y query no pueden cambiar institución, autor, grado ni colección; creación, edición e importación válidas preservan el destino de sesión.
- JWT ausente, inválido o vencido; roles no docentes; fallback institucional determinista; destino explícito de SuperAdmin.
- Importación idempotente y rollback sintético ante fallo de persistencia. No acredita rollback de PostgreSQL real.

Prueba de mutación: retirar ambos filtros anidados produce exactamente tres fallos (listado A, listado B y copia). El código se restaura con `finally` antes de ejecutar la suite completa. No se modifican ni se eliminan pruebas anteriores.

## Límites y continuidad

No hay migración, cambio de esquema, frontend ni datos institucionales. Los 19 bancos editoriales y sus 2.850 preguntas no se modifican. No se cambian la política global de roles ni JwtStrategy.

Este lote no acredita RLS, contención/concurrencia con PostgreSQL, revocación de asignaciones concurrente, cuotas, auditoría durable ni atomicidad general de todas las escrituras. Las actualizaciones conservan la guarda previa y su escritura existente; la revisión transaccional queda explícita. El método interno de copia conserva sus demás límites previos y no se publica como endpoint nuevo.

Siguiente lote: Duelos/Arena y después Eventos matemáticos, con HTTP entre instituciones y permisos por participante/organizador. Inclusión sigue pospuesta y la frontera EduLab se conserva. El inventario estructural global de staging conserva deuda; reconocer siete rutas no demuestra cierre global.

## Publicación

Pendiente de completar suite general, build y verificación en staging antes de promover a producción. Registrar hashes y servicios efectivos en `REGISTRO_DESPLIEGUES.md`; el push no acredita por sí solo un despliegue.

Checkpoint posterior: suite API completa de producción **78 suites / 1.530 pruebas aprobadas, cero fallos**, reporte `apps/api/coverage/question-bank-hardening.json`. Tipos API/web y build Nest aprobados. Se completaron las dependencias de prueba de staging desde su propio lockfile; no se usa el cliente Prisma de main contra su esquema distinto.

La integración de staging conserva una octava ruta preexistente: `POST classrooms/:classroomId/collections/:collectionId/copy-to/:activityId`. Se adapta su actor/resolución directa y se añaden casos HTTP propios de staging. Esa ruta y la funcionalidad de copia desde interfaz no se promueven a producción en este lote. El servicio de copia existente en main sí recibe el filtro de preguntas y su caso de regresión.

Staging: **116 pruebas focales aprobadas** (27 de servicio y 89 de integración, incluidas 88 HTTP). Las doce adicionales cubren copia válida A/B, destino ajeno, aula/colección privadas o ajenas, asignación, cadena institucional, publicación/tipo de actividad y autenticación/roles. Cliente Prisma generado localmente desde su esquema tras `npm ci --ignore-scripts`; no se ejecutó migración local.

Inventario de staging recalculado: **1.204 rutas; 405 directas; 689 excepciones pendientes; 66 no institucionales; 44 incumplimientos estructurales**. Las ocho rutas del banco están resueltas; no se cambia `institution-route-exceptions.json`. Los incumplimientos restantes corresponden a los controladores de Duelos y Eventos. Se conserva el fallo global visible; no se presenta este conteo como una auditoría HTTP completa ni como 44 fugas confirmadas.

## Corte final de esta entrega: publicación pendiente por Railway

Staging recibió `a892a65c` (equivalente del commit main candidato `65c1b794`) y `5853229a` (adaptación exclusiva de copia y evidencia). Ambos están enviados a la rama remota `staging`. Tipos API de staging y sus 116 pruebas focales aprobados.

El push no produjo un nuevo despliegue visible. Se verificó que la fuente del servicio sigue apuntando a `staging` y no espera check suites. Se intentó subir directamente el worktree de `5853229a`, con `git diff HEAD -- apps package-lock.json .nvmrc` vacío; Railway respondió **«Deploys have been paused temporarily»** y no devolvió un deployment nuevo. No se considera una compilación fallida ni publicación exitosa.

La [página oficial de Railway](https://status.railway.com/) confirma un incidente general, «Dashboard and API unavailable, builds paused»; su actualización de 2026-10-21 13:40 UTC indica que continúan pausados los builds. No se atribuye una fecha estimada de recuperación. Es una limitación de la plataforma, no una denegación de aprobación local.

El servicio staging sigue en `a1625ed2`, API `bfb9118f` SUCCESS. Producción mantiene el código publicado `db4b2b07` (rama main en su documentación `a403b4fe`); health público HTTP 200/ok. **Este nuevo blindaje de bancos todavía no está sirviendo a usuarios y no se ha enviado a main**. Se publica el candidato en su rama aislada para revisión, conservando producción y las migraciones exclusivas de staging.

Para retomar: comprobar recuperación de Railway, desplegar/verificar API de staging desde el HEAD limpio de `codex/sincronizar-staging-20261020`, comprobar health y rechazo 401 sin JWT; solo después promover la rama `codex/blindaje-bancos-http-20261021` a main con los tipos API/web ya verificados (repetir si cambia código/base), comprobar el commit efectivo y actualizar bitácora. No copiar la octava ruta de staging ni sus otras migraciones.

El trabajo de código puede continuar mientras tanto con **11 rutas de `duel.controller.ts` y 33 de `math-events.controller.ts`**, los 44 incumplimientos restantes medidos. No se regeneró ninguna lista de excepciones para ocultarlos. Se mantienen aparte los pendientes de atomicidad/PostgreSQL/RLS del banco y el blindaje global.
