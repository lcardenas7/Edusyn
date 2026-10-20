# Auditoría de Documentos institucionales

Fecha: 2026-10-20. Base local: `origin/staging` en `1e9ef9a9`.
Rama: `codex/blindaje-documentos-20261020`; worktree: `worktrees/blindaje-documentos`.
Estado: **avance local verificado; módulo parcial, sin publicación**.

## Hallazgos y correcciones

1. Creación aceptaba `institutionId` del formulario. Ahora resuelve el contexto del actor antes de subir y usa exclusivamente ese destino.
2. Consulta individual, descarga, edición y eliminación buscaban únicamente por ID. Ahora filtran por ID e institución; un ID ajeno responde 404 antes de firmar enlaces, escribir o borrar objetos.
3. La visibilidad por roles solo se aplicaba al listado. Ahora también se comprueba en consulta y descarga; los documentos inactivos tampoco se entregan por ID. Se conserva la autoridad institucional del Rector. El nombre de rol `SUPERADMIN` no concede el bypass de visibilidad: este exige el claim booleano verificado.
4. SuperAdmin debe indicar una institución existente en la query, validada después de JWT mediante `ValidateTenantContextGuard`. Tener institución en el JWT no sustituye el destino explícito.
5. Alta/baja de registro y contador se ejecutan en una misma transacción Prisma. Si falla el contador, se revierte el registro; el alta compensa el objeto subido, y la baja no elimina el objeto antes del commit.
6. JSON de roles y categoría inválidos responden 400; el interceptor limita archivos a 10 MB. La descarga deja de devolver una URL persistida cuando falla la firma.

Las ocho rutas institucionales tienen resolución directa y el catálogo de categorías es la única excepción estática no institucional. Se retiran cinco excepciones pendientes y se reclasifica el catálogo tras revisar su contenido; no se regeneran excepciones de otros módulos.

## Verificación

`documents.http-isolation.spec.ts`: **42 pruebas aprobadas**, con HTTP, JWT, RolesGuard y guarda de destino reales. Solo Prisma y storage son sintéticos; el fixture aplica filtros y revierte transacciones. Incluye A→B/B→A con la misma identidad en ambos colegios, roles, inactivos, creación con destino forjado, descarga, edición, baja, contexto ausente, SuperAdmin, limpieza/uso institucional y fallos de contador/firma.

La primera ejecución fue bloqueada por el sandbox (`connect EACCES 127.0.0.1`); la repetición autorizada fuera del sandbox aprobó 42/42. No se conectó ninguna base real ni se subieron/borraron objetos reales.

Verificación final tras formato y alineación del cliente: **42/42 HTTP y `tsc --noEmit --incremental false` de API aprobados**. El primer chequeo de tipos encontró un cliente Prisma compartido anterior a los campos de Eventos matemáticos; se generó el cliente 5.22.0 solo en `node_modules` de este worktree, usando su esquema y sin migraciones. No se modificó el cliente del directorio principal. No se ejecutó la suite global completa ni se acredita build/despliegue.

El contrato global conserva **47 incumplimientos previos** en `duel.controller.ts` (11), `question-bank.controller.ts` (8) y `math-events.controller.ts` (28). Documentos no deja incumplimientos propios. No se añaden excepciones para ocultar esos fallos. Ver el corte global en `REVISION_BLINDAJE_20261020.md`.

## Pendientes para cerrar el módulo

- Limpieza de huérfanos: normalizar claves R2 y URLs históricas; proteger frente a altas concurrentes entre el escaneo y el borrado. El filtrado por institución de la ruta sí está probado; el algoritmo de limpieza no se declara cerrado.
- Cuota: reserva y comprobación concurrente de almacenamiento, serialización con la limpieza y consistencia del contador histórico. Un `$transaction` de registro/contador no resuelve por sí solo esos casos.
- Revalidar visibilidad bajo cambios concurrentes de roles/estado; las mutaciones tienen filtro institucional en la propia escritura, pero no se acredita serialización de toda la política de visibilidad.
- Validar que las claves históricas pertenecen al destino del documento, y revisar la superficie genérica de Storage por separado.
- Añadir una auditoría durable de creación, edición y eliminación; esta entrega no añade eventos de auditoría ni migraciones.
- PostgreSQL sintético con transacciones reales, contención y rollback; después storage de prueba y smoke de la interfaz. Las pruebas actuales no certifican RLS, concurrencia real ni comportamiento del proveedor.
- Compatibilidad SuperAdmin: cualquier futuro cliente de esta superficie debe propagar el destino explícito en todas las operaciones; el menú actual es institucional.

No se declara cerrado el blindaje global, ni se modifica Inclusión o la frontera EduLab.
