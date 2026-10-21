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
