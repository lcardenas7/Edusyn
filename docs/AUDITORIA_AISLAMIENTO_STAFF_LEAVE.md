# Auditoría de aislamiento — Staff Leave

Fecha: 2026-09-12. Alcance: 7/7 rutas de `staff-leave`. Estado: cerrado en aplicación.

## Defecto y corrección

Detalle, revisión y cancelación recibían un id y consultaban `findUnique({ id })`; revisión y
cancelación escribían después con `update({ id })`. Un id de otra institución permitía leer datos
laborales, aprobar/rechazar una solicitud ajena o confirmar su existencia. Un usuario normal podía
leer además la solicitud de un colega del mismo colegio.

Las siete rutas resuelven ahora la institución directamente desde el actor. Listados, detalle y
estadísticas filtran por institución y por pertenencia institucional de solicitante/revisor. El
detalle personal exige también `requesterId`; una solicitud ajena o de un colega responde 404 sin
PII. Revisión y cancelación ejecutan guarda y `updateMany` acotado dentro del mismo `tx`, verifican
`count` y detectan carreras. El revisor debe ser miembro activo o SuperAdmin.

Se corrigió también el flujo: tipos, estados, motivo y fechas inválidas devuelven 400; la fecha
final no puede preceder a la inicial; los filtros desde/hasta funcionan por separado, en vez de
ignorarse silenciosamente cuando falta un extremo.

## Evidencia

- 31 pruebas de servicio y 49 HTTP: **80/80**.
- Fixture A/B con relaciones reales, filtros `OR`, `institutionUsers.some`, rangos y un objeto
  transaccional distinto.
- Cruces A→B/B→A en las siete rutas, tenant falsificado, roles, PII ausente, cero escrituras,
  compañero del mismo colegio, carreras y rollback.
- Mutación de la cláusula institucional central: 2 casos de servicio quedan rojos; restaurada,
  31/31 pasa.
- Contrato conjunto con Teacher Schedule: 119/119.

## Cambios de comportamiento

- Solicitud de otro empleado del mismo colegio: detalle 200 → 404 para roles personales; los roles
  administrativos conservan el alcance institucional.
- Cancelar una solicitud ajena: 403 → 404 para no confirmar existencia.
- Fechas/tipos/estados inválidos: error de Prisma/resultado vacío → 400.
- Carreras de revisión/cancelación ya no pueden responder éxito sin modificar exactamente una fila.

## No cubre

PostgreSQL/RLS, datos históricos, archivos reales del soporte, rendimiento ni despliegue a
producción. La política laboral que decide quién aprueba una ausencia conserva los `@Roles`
existentes; no se añadieron flujos de reemplazo docente ni notificaciones.

