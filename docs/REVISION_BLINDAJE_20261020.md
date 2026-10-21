# Revisión del blindaje — 2026-10-20

Base examinada: referencia **local** `origin/staging` en `1e9ef9a9`; no se hizo fetch ni se comprobó el servidor remoto. Los despliegues posteriores que constan en la bitácora local no se confunden con esta base. Avance en `codex/blindaje-documentos-20261020`, sin push, despliegue, migración ni datos reales modificados.

## Estado comprobado

`docs/ESTADO_BLINDAJE.md` tenía fecha 2026-09-23 y conservaba una tabla de 1.113 rutas. El grafo disponible data de julio y sirve únicamente de orientación histórica. Los contadores de este corte proceden del AST del código actual mediante `inventory()` y de las excepciones exactas; no son un porcentaje de seguridad ni prueban aislamiento de servicios.

| Clasificación | Base antes de este avance | Con Documentos local |
|---|---:|---:|
| Declaraciones de ruta | 1.199 | 1.199 |
| Resolución directa reconocida | 392 | 397 |
| Excepciones pendientes de revisión | 695 | 689 |
| Excepciones no institucionales | 65 | 66 |
| Sin resolución directa ni excepción | 47 | 47 |

El contrato global de rutas **no pasa**: 19 rutas de Classroom (11 de Duelos y 8 de bancos) y 28 de Eventos matemáticos carecen de clasificación reconocida. Revisar el contexto real de los helpers/servicios antes de corregir o justificar cada caso; no equivalen automáticamente a 47 fugas confirmadas. No se silencia el contrato regenerando sus excepciones.

Classroom ya tiene **135 declaraciones**, con 35 resoluciones directas, 81 excepciones pendientes y 19 rutas fuera del contrato. El cierre auditado B1 sigue limitado a sus 17 rutas originales; ni 17/98 ni 35/135 son un cierre global. Construye aporta 21 rutas (19 directas y dos excepciones no institucionales); Eventos matemáticos aporta 28. Los módulos sin rutas no se consideran auditados por esa razón.

## Avance de esta sesión

Documentos: corregidos creación con institución forjada, accesos por ID sin tenant y omisión de visibilidad por rol. Ocho rutas institucionales con resolución directa y un catálogo estático. **42 pruebas HTTP aprobadas**. Creación/eliminación de registro y contador ahora son transaccionales. Detalle, límites y pendientes en `AUDITORIA_AISLAMIENTO_DOCUMENTOS.md`. El módulo permanece parcial.

## Pendientes y orden propuesto

| Prioridad | Frente | Trabajo pendiente verificable |
|---|---|---|
| 1 | Contrato de rutas | Revisar 47 rutas nuevas, contexto del actor y cadenas banco/aula/evento/participante; pruebas A/B antes de retirarlas de deuda. |
| 1 | Documentos / Storage | Cerrar limpieza concurrente, claves históricas, reserva de cuota y auditoría durable; validar proveedor de prueba. |
| 1 | Observer / IAM | Reconciliar las entregas de ramas aisladas con staging antes de reiniciar trabajo. La base conserva 28 y 37 excepciones pendientes respectivamente; no se presume integración. |
| 2 | Classroom restante | Auditar las 81 excepciones originales y revisar la ampliación posterior; cron, adjuntos y permisos finos no quedan cubiertos por B1. |
| 2 | Matrículas / Taller | PostgreSQL y contención/rollback; dependencias HTTP de notas; cadenas históricas equipo→proyecto→aula y miembros→matrícula, atomicidad general. |
| 2 | Permisos finos | Asignación docente, acceso personal/acudientes y siete permisos de Attendance; resolver institución no sustituye autorización dentro del colegio. |
| 2 | Resto de módulos | Mantener auditoría por módulo: filtros de servicio, FKs cruzadas, escrituras, HTTP A/B y evidencia de atomicidad. |
| Separado | PostgreSQL / RLS | Reconciliar evidencia de laboratorios y ramas RLS; la documentación de aplicación no certifica políticas en bases reales. |
| Pospuesto | Inclusión / EduLab | Mantener Inclusión pospuesta y respetar la frontera EduLab del plan vigente. |

Las entregas existentes de Observer, IAM, Storage, PostgreSQL y RLS requieren comparación de commits y contenido antes de integrarse; un worktree o un documento de entrega no acredita publicación. Los encargos históricos a otros agentes no se reinterpretan como autorización para reiniciarlos o enviarles mensajes.

## Reproducción

Desde `apps/api`, con dependencias disponibles: `node <ruta-a-jest>/bin/jest.js --runInBand src/modules/documents/documents.http-isolation.spec.ts` y la suite `src/common/security/institution-route-contract.spec.ts`. Para medición, importar `inventory` y `violations` de `src/common/security/institution-route-inventory.ts` con ts-node y contrastar `institution-route-exceptions.json`.

Verificación final: 42/42 pruebas HTTP de Documentos y tipos API (`tsc --noEmit --incremental false`) aprobados con cliente Prisma generado exclusivamente en este worktree. La comprobación estática confirma 47 fallos tanto antes como después, ninguno en Documentos. No se ejecutó la suite global completa ni se validó PostgreSQL/RLS.

La bitácora de despliegues no recibe una fila porque no hubo push a staging/main.
