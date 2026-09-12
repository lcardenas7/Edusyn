# Auditoría de aislamiento — Teacher Schedule

Fecha: 2026-09-12. Alcance: 4/4 rutas de agenda personal. Estado: cerrado en aplicación.

## Defecto y corrección

El controlador resolvía el contexto mediante un helper que no reconocía el contrato. Las
actualizaciones y borrados comprobaban propietario, pero mutaban después por id desnudo y fuera de
transacción. Un mismo usuario puede pertenecer a dos instituciones, por lo que `teacherId` no es
una frontera suficiente.

Cada ruta llama directamente a `requireInstitutionId` y el servicio recibe institución + identidad
del actor. Lectura/creación fijan ambos campos; actualización y borrado validan y mutan con
`{ id, institutionId, teacherId }` dentro del mismo `tx`. El borrado comprueba `count`. La edición
reconstruye el intervalo completo para impedir que cambiar una sola hora deje inicio >= fin.

Se añadió `RolesGuard`: estudiantes y otros roles sin alcance docente ya no pueden crear agendas.
Docente, coordinador, rector, administrador institucional y SuperAdmin mantienen acceso a su propia
agenda.

## Evidencia

- 12 pruebas de servicio y 14 HTTP: **26/26**.
- Fixture A/B con el mismo `teacherId` miembro de ambos colegios y otro docente dentro de cada uno.
- Cruces A→B/B→A, colega del mismo colegio, tenant/teacher falsificados, JWT, 401/403 y cliente `tx`
  distinto.
- Mutación retirando `institutionId` de la guarda: 8 casos rojos; restaurada, 26/26 pasa.
- Contrato conjunto con Staff Leave: 119/119.

## No cubre

Esta agenda manual no certifica `ScheduleEntry`, disponibilidad institucional ni generación de
horarios. PostgreSQL/RLS, colisiones entre bloques, datos reales, rendimiento y producción quedan
fuera.

