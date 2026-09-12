# Auditoría de aislamiento — Taller

Fecha: 2026-09-10. Base del análisis funcional: `996263f8` de origin/staging; contrato estructural ya publicado en `afe9f388`.

## Calibración y hallazgos

El dato del encargo «cero menciones de institutionId en el servicio» no se reproduce. El controlador tenía un helper `ctx` con `resolveInstitutionId`, y el servicio ya filtraba los recursos iniciales y validaba al actor frente al equipo. Las diez rutas de datos tenían contexto indirecto; el catálogo restante es una constante. No son once accesos cruzados demostrados.

Sí había **13 operaciones posteriores sin filtro propio de institución**. Dependían de la guarda inicial y de que la coherencia y pertenencia de los datos no cambiaran. Se corrigen sin afirmar que todas fueran explotables directamente en el estado inicial:

| Operación previa | Riesgo concreto | Corrección |
|---|---|---|
| Releer equipo al crear instrumento | Obtener metadatos sin volver a acotar el colegio | Lectura institucional y 404 si desaparece |
| Eliminar instrumento duplicado | Borrado físico sin filtro propio tras resolver la carrera | deleteMany por id e institución |
| Listar objetos de instrumento | Una fila de otro colegio que referenciara ese instrumento aparecía en la respuesta | institutionId también en la lista; caso sintético probado |
| Actualizar objeto, releerlo y borrarlo suavemente | Las tres operaciones solo usaban id después de la guarda | updateMany y lectura acotados, conservando versión y borrado suave |
| Actualizar etiqueta, releer y borrar relación | Dependían de la validación previa de extremos/equipo | Filtro institucional en las tres operaciones; deleteMany con comprobación de count |
| Consultar motor al votar | Elegir reglas desde un instrumento sin filtro propio | Guarda de instrumento institucional |
| Buscar arista de voto, ocultar voto y eliminar arista | Operaciones posteriores sin institución propia | Filtros en las tres operaciones y comprobación de count antes del evento |

El padre ajeno o inexistente al crear un objeto ahora responde 404. El contexto ausente se rechaza antes de Prisma. Se preservan los permisos existentes de miembros y docentes y los errores por conflicto de versión; si el recurso deja de existir dentro del alcance al actualizar, se devuelve 404.

## Inventario de las once rutas

Todas tienen prefijo `/taller`. Antes: diez resolvían contexto indirectamente mediante `ctx`; catálogo sin necesidad de contexto. Después: diez llamadas directas y esperadas a requireInstitutionId; catálogo con excepción exacta justificada. **Cero rutas de Taller pendientes de resolución estructural.**

| Método y ruta | Resolución después | Guarda de entrada del servicio |
|---|---|---|
| GET catalog | No aplica, constante estática | No usa Prisma |
| POST instruments/resolve | Actor | resolveActor del equipo |
| GET instruments/:id | Actor | loadInstrumentInScope |
| POST instruments/:id/objects | Actor | loadInstrumentInScope + padre institucional si se proporciona |
| PATCH objects/:id | Actor | loadObjectInScope |
| DELETE objects/:id | Actor | loadObjectInScope |
| POST objects/:id/vote | Actor | loadObjectInScope |
| POST objects/:id/comments | Actor | loadObjectInScope |
| POST relations | Actor | loadObjectInScope para cada extremo |
| DELETE relations/:id | Actor | loadRelationInScope |
| GET teams/:teamId/timeline | Actor | resolveActor del equipo |

## Pruebas

`taller.isolation.spec.ts`: **40 pruebas**. Veinte rechazos A→B y B→A, uno por cada operación de datos y dirección. Comprueban 404, ausencia de cualquier escritura y ausencia de lecturas posteriores a la guarda. El doble de Prisma filtra de verdad: omitir institución devuelve el recurso extranjero y provoca fallos; las mutaciones respetan el filtro y cambian la memoria sintética.

También cubre padre extranjero, segundo extremo extranjero, equivalencia ajeno/inexistente, contaminación sintética de una lista, todos los filtros posteriores a guardas (incluidas dos ramas de versión y retirar voto), institución falsificada en el cuerpo, diez entradas sin contexto, tres pérdidas del recurso durante la escritura y limpieza acotada del instrumento duplicado.

No existen acciones de aprobar, rechazar, calificar o descargar archivos en este controlador: no aplica fabricar pruebas de rutas inexistentes. GET de instrumento/timeline cubre lecturas, no una descarga documental.

## Qué NO cubre

- El laboratorio HTTP local añadido el 2026-09-12 usa JWT, `JwtAuthGuard` y `RolesGuard` reales y
  cubre las 10 rutas institucionales en ambas direcciones A→B/B→A, más catálogo, ausencia de JWT,
  rol de voto y el mismo usuario en A/B. La persistencia sigue siendo un doble que filtra `where`:
  **no** acredita el interceptor global, PostgreSQL ni RLS.
- Autorización exhaustiva por asignación docente, acudientes y roles: pendiente del inventario del Bloque 4. Se conserva el control de miembros/autor/docente existente; 403 dentro del mismo colegio no se convierte artificialmente en fallo de aislamiento.
- Integridad general de datos históricos: `resolveActor` carga equipo, proyecto y miembros, pero no
  comprueba toda la cadena equipo→proyecto→aula y miembro→matrícula→estudiante/año/grupo en sus
  relaciones incluidas. `TallerInstrument` y `TallerObject` guardan varias referencias lógicas sin
  FK institucional compuesta. Las pruebas HTTP nuevas demuestran el rechazo en la guarda directa,
  no certifican esas incoherencias; Taller sigue **parcial** hasta auditarlas y probarlas.
- `stationId` es una referencia lógica de fase (por ejemplo `phase:1`), no una FK a otro colegio. No se introduce una consulta inventada ni migración para ella.
- Atomicidad global de varias escrituras, serialización de votos, huérfanos y conflictos concurrentes fuera de los casos descritos. La prueba de carrera simula el resultado, no usa transacciones PostgreSQL reales.
- Lecturas de tablas Taller desde otros módulos, por ejemplo ABP, pertenecen a su auditoría. Este resultado solo cubre TallerController/TallerService.
- RLS, esquema, R1, Aula Clásica y EduLab permanecen fuera de los cambios. Producción no se consultó ni modificó.

## Verificación y entrega

84 suites / 1.272 pruebas API, contrato estructural, tipos API y build Nest aprobados; ver ESTADO_BLINDAJE.md para el checkpoint de entrega actualizado. La verificación web del Bloque 0 sigue vigente: ningún archivo web cambia en Taller.

Checkpoint HTTP 2026-09-12: `taller.http-isolation.spec.ts` y
`apps/api/test/fixtures/taller-http.fixture.ts` agregan 24 pruebas HTTP. Focal Taller:
2 suites / 64 pruebas verdes; suite API completa 103 suites / 2.123 pruebas verdes;
TypeScript API/web y build Nest limpios. No se tocaron producción, bases compartidas,
migraciones ni políticas RLS.
