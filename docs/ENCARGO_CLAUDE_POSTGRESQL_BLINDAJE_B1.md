# Encargo para Claude — laboratorio PostgreSQL sintético del blindaje, Bloque 1

Fecha: 2026-09-12. Responsable de integración: Astra. Ejecutar **después de entregar Observer y
después de que Astra confirme su integración**.

## 1. Objetivo y significado del resultado

Este encargo cierra la deuda PostgreSQL declarada del flujo integral de Matrículas y produce una
línea base reproducible de RLS para los módulos ya cerrados en aplicación. Debe demostrar con una
base PostgreSQL real y exclusivamente sintética que las operaciones de cambio de grupo/grado son
atómicas, que una carrera no mezcla ni pierde datos y que el contexto de institución aplicado por
la conexión limita las tablas que realmente tienen RLS.

No se busca hacer que el contador RLS quede verde. El resultado puede y probablemente debe mostrar
tablas sin cobertura. La evidencia debe distinguir:

1. aislamiento de aplicación;
2. semántica transaccional real de PostgreSQL;
3. RLS realmente habilitado, forzado y aplicado al rol de aplicación.

No declares `academic`, Edusyn ni el blindaje global cerrados por completar este bloque.

## 2. Base y forma de trabajo

1. Espera la confirmación de Astra de que Observer fue integrado.
2. Ejecuta `git fetch origin staging` y registra `git rev-parse origin/staging`.
3. Crea un worktree nuevo, distinto de Observer, desde esa base, con rama
   `codex/blindaje-postgresql-b1-claude`.
4. Lee completos `docs/ENCARGO_BLINDAJE_ASTRA.md`, `docs/ESTADO_BLINDAJE.md`,
   `docs/AUDITORIA_AISLAMIENTO_MATRICULAS.md`,
   `docs/AUDITORIA_AISLAMIENTO_ATTENDANCE.md` y este documento.
5. No hagas push a `staging`. Entrega commits locales, hashes y ruta del worktree.

`origin/staging` se mueve mientras se trabaja. No apiles este laboratorio sobre la rama de
Observer ni sobre un worktree de otro agente. No uses `reset`, `--force` ni reescribas historial.

## 3. Frontera absoluta de datos

- **Producción es intocable:** no conectar, consultar, probar credenciales ni inspeccionar datos.
- No conectar Railway staging ni ninguna base persistente o compartida.
- La única base permitida es una instancia PostgreSQL local y desechable creada para esta tarea.
- Si Docker/PostgreSQL local no está disponible, detente y entrega el bloqueo técnico. No sustituyas
  el laboratorio por una URL encontrada en `.env`, Railway o el sistema.
- Genera nombres, usuarios y contraseñas exclusivos del laboratorio. No los imprimas ni confirmes.
- Cualquier archivo local con credenciales queda ignorado y se elimina al terminar.
- No uses `prisma migrate reset`, `prisma db push`, seeds generales ni scripts que puedan borrar una
  base. Crea una base vacía nueva y aplica únicamente `prisma migrate deploy`.

Antes de conectar, añade una guarda ejecutable que rechace la URL si el host no es loopback
(`localhost`, `127.0.0.1` o `::1`) o si el nombre de base no contiene un sufijo aleatorio generado
por el laboratorio. Las pruebas deben fallar cerradas si falta la URL específica.

## 4. Alcance de código permitido

Puedes añadir exclusivamente:

- un harness reutilizable bajo `apps/api/test/postgres/`;
- pruebas de integración PostgreSQL para Matrículas;
- SQL de consulta no mutante bajo `apps/api/test/postgres/sql/`, si hace falta;
- documentación `docs/AUDITORIA_POSTGRESQL_BLINDAJE_B1.md` y
  `docs/ENTREGA_CLAUDE_POSTGRESQL_B1.md`;
- scripts npm mínimos para ejecutar el laboratorio de forma explícita.

No cambies servicios, controladores, esquema Prisma, migraciones, políticas RLS, roles existentes,
`institution-route-exceptions.json`, `ESTADO_BLINDAJE.md` ni `REGISTRO_DESPLIEGUES.md`. Si el
laboratorio descubre un defecto de producción, escribe una reproducción roja mínima y entrega el
hallazgo a Astra en un commit separado; no lo ocultes cambiando expectativas ni amplíes el alcance.

No ejecutes los scripts históricos `populate_institution_id.sql`, `enable_rls.sql`,
`enable_rls_new_tables.sql` o `force_rls_all_tables.sql`. El estado válido es el que produce el
historial versionado sobre una base nueva, incluido `20260907010000_rls_consolidation_contract`.

## 5. Preparación reproducible de PostgreSQL

El harness debe poder crear y destruir una instancia o base efímera con un solo comando documentado.
Debe:

1. comprobar el host local y el nombre aleatorio;
2. preparar en una base vacía los roles `edusyn_owner`, `edusyn_migrator` y `edusyn_app` según
   `apps/api/prisma/sql/rls/bootstrap-roles.sql`;
3. aplicar todas las migraciones con la credencial de migrador/owner prevista;
4. generar Prisma para la misma revisión del esquema;
5. ejecutar las pruebas funcionales con el rol de aplicación, no con superusuario, owner ni un rol
   con `BYPASSRLS`;
6. destruir contenedor, volumen y base al finalizar, incluso si una prueba falla.

No dependas de puertos fijos. Evita colisionar con otros agentes y registra versión de PostgreSQL,
hash base, cantidad de migraciones aplicadas y cero migraciones fallidas. La salida y los artefactos
versionados no deben contener cadenas de conexión ni secretos.

## 6. Fixture mínimo A/B real

Crea dos instituciones A y B y solo las relaciones necesarias para ejecutar el flujo real:

- años, períodos, sedes, jornadas, grados y grupos;
- asignaturas/áreas y estructura académica de destino;
- usuario administrativo actor y membresía institucional;
- estudiantes y matrículas de A y B;
- asignaciones docentes requeridas;
- notas parciales, notas de actividad, asistencia por asignatura, asistencia de tutoría y snapshot
  académico suficientes para observar el traslado;
- acta o configuración requerida por la regla real, cuando aplique.

Los IDs deben ser claramente sintéticos y aleatorios. No copies dumps ni valores de bases reales.
Cada fila crítica debe poder atribuirse a A o B y tener conteos/sumas conocidos antes de operar.

## 7. Pruebas obligatorias de Matrículas

Ejecuta servicios reales con Prisma real contra PostgreSQL. No sustituyas Prisma por mocks en estas
pruebas.

### Aislamiento y relaciones

- A no puede leer ni mover la matrícula de B; B no puede leer ni mover la de A.
- IDs secundarios mixtos —grupo, año, período, asignación, acta o plantilla— fallan antes de
  escritura y dejan sin cambios A y B.
- El mismo usuario con membresía en A y B no convierte `userId` en frontera institucional.
- Una fila histórica incoherente propia cuyo grupo/asignación apunta a B queda oculta o rechazada,
  según el contrato actual, sin propagar la inconsistencia.

### Cambio de grupo y grado

- Cambio de grupo dentro del mismo grado mueve solo las filas que el flujo declara: `PartialGrade`,
  `AttendanceRecord` y `TutoringAttendance`; conserva las referencias históricas que el documento
  de Matrículas declara conservar.
- Cambio de grado reconstruye la estructura/snapshot destino sin inventar ni borrar notas
  históricas fuera de su contrato.
- Un destino sin estructura rechaza la operación y conserva íntegramente el snapshot anterior.
- Cupo agotado, año cerrado y acta inválida rechazan sin cambios parciales.
- Verifica conteos y valores en origen y destino, no solo el código HTTP o la promesa resuelta.

### Rollback provocado

Provoca al menos tres fallos reales después de una primera escritura dentro de la transacción:

1. colisión o constraint al mover notas;
2. fallo al mover asistencia o tutoría;
3. fallo al regenerar el snapshot.

Después de cada fallo compara todas las tablas observables con el estado anterior. Matrícula, grupo,
notas, asistencias, tutorías, historial, snapshot y auditoría deben quedar sin cambio parcial.

### Concurrencia real

Abre dos clientes/conexiones independientes y lanza simultáneamente operaciones incompatibles sobre
la misma matrícula. Usa barreras deterministas, locks o una función de prueba; no confíes en
`setTimeout` para crear la carrera. Repite el escenario varias veces. El resultado aceptable es una
operación ganadora y otra rechazada/reintentable, nunca dos estados parciales, doble historial ni
filas repartidas entre dos grupos. Documenta el SQLSTATE/Prisma code real observado.

## 8. Evidencia RLS, sin modificar RLS

Sobre la misma base nueva, ejecuta `npm run check:rls --workspace apps/api` con el rol de aplicación
y captura su código de salida. Además genera una matriz desde catálogos PostgreSQL para **todas** las
tablas con `institutionId`, indicando:

- owner;
- `relrowsecurity`;
- `relforcerowsecurity`;
- política, comando, roles, `USING` y `WITH CHECK`;
- privilegios efectivos de `edusyn_app`;
- FK institucional presente/ausente y validada/no validada.

Después prueba comportamiento como `edusyn_app`, con conexiones separadas y
`set_config('app.current_institution', ..., true)` dentro de transacciones:

- sin contexto no se ven filas tenant de una tabla protegida;
- A ve A y no B; B ve B y no A;
- INSERT/UPDATE que intenta escribir la institución contraria falla;
- el contexto local desaparece al cerrar la transacción y no se filtra al siguiente uso del pool;
- owner, migrador y app no tienen atributos o membresías que anulen la evidencia.

Incluye al menos las tablas alcanzadas por Matrículas y las ya declaradas cerradas en aplicación:
Taller, Learning Route, Preventive Cuts, Attendance, Staff Leave y Teacher Schedule. Si una tabla no
tiene RLS, registra `SIN COBERTURA`; no fabriques una prueba verde ni añadas una política.

## 9. Pruebas contra falsos positivos

La suite debe demostrar que detecta fallos. Como mínimo:

- ejecuta una consulta equivalente sin `institutionId` en una tabla sin RLS y demuestra que la
  evidencia la clasifica como expuesta, sin modificar producción;
- dentro de la base efímera y fuera de migraciones versionadas, desactiva temporalmente una política
  o usa una tabla sintética de control y demuestra que la prueba RLS cae; restaura o destruye la base;
- quita temporalmente una comprobación del harness que compara conteos tras rollback, verifica que
  la mutación deja de detectarse y restaura el código antes de entregar.

No publiques scripts temporales ni cambios del catálogo hechos solo para la mutación.

## 10. Verificación y entrega

Ejecuta:

1. laboratorio PostgreSQL completo desde cero, al menos dos veces;
2. pruebas focales de Matrículas existentes;
3. suite API completa;
4. `tsc --noEmit` y `nest build` en API;
5. suite y `tsc` web, porque Matrículas tiene flujo de cliente ya corregido;
6. comprobación de que no queda contenedor, volumen, base ni fichero de credenciales.

Entrega commits locales en este orden: harness, pruebas Matrículas, consultas/evidencia RLS y
documentación. `ENTREGA_CLAUDE_POSTGRESQL_B1.md` debe incluir comandos reproducibles redactados,
hash base, versión PostgreSQL, migraciones, pruebas y tiempos, tablas exactas, fallos encontrados,
SQLSTATE, mutaciones, ficheros y “Qué NO cubre”. No incluyas secretos ni salida masiva de datos.

Este bloque puede cerrar el pendiente PostgreSQL de Matrículas si todas las pruebas anteriores son
verdes. Solo documenta RLS: no cierra su deuda global ni autoriza políticas nuevas.

