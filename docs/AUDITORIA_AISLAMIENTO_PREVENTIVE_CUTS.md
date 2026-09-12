# Auditoría de aislamiento — Cortes preventivos

Fecha: 2026-09-11. Base: `origin/staging` `587cfc0b`.

## Resultado

Las ocho rutas de `PreventiveCutsController` aceptaban identificadores sin contexto del actor. Un
usuario del colegio A podía leer o sobrescribir la configuración del período B, listar globalmente
alertas con estudiantes y planes de recuperación, modificar una alerta B, ejecutar el corte sobre
la asignación B y descargar vistas o PDF nominales con notas de B.

Las ocho rutas resuelven ahora la institución mediante `requireInstitutionId`. Los servicios
validan antes de leer colecciones, calcular notas, resolver logos o escribir:

- período → año → institución;
- grupo → sede y grado → institución;
- asignación → institución, año, grupo y asignatura/área;
- matrícula → institución, estudiante, año y grupo;
- alerta → institución, asignación, matrícula y período.

Las coordenadas además deben coincidir: período, asignación y matrícula comparten año, y
asignación/matrícula comparten grupo. Un recurso ajeno o una mezcla inválida responde 404 antes de
calcular o persistir. Las fechas y umbrales inválidos responden 400.

## Correcciones de integridad

`execute` ya no confirma una alerta por estudiante de forma independiente. Primero calcula el
lote, luego revalida todas las coordenadas dentro de una única transacción y confirma el conjunto
completo; un fallo intermedio revierte todo. Las actualizaciones usan `updateMany` con
`institutionId`, y la creación no deriva la institución desde la asignación enviada por el cliente.
`IN_RECOVERY` conserva la regla existente.

El motor compartido `calculateTermGradeAtDate` recibe la institución y acota el plan, parciales,
notas legadas, actividades, componentes, matrícula, asignación y período. Su llamador en Reportes
también pasa el contexto institucional. Los DTO de ejecución y configuración aceptan IDs de texto
no vacíos porque el esquema genera CUID; exigir UUID rechazaba identificadores legítimos.

## Inventario HTTP

| Ruta | Operación | Resultado |
|---|---|---|
| `POST config` | Crear/actualizar configuración | Institucional, período validado |
| `GET config` | Leer configuración | Institucional, período validado |
| `POST execute` | Calcular y persistir alertas | Institucional y atómico |
| `GET alerts` | Listar alertas | Institucional aun sin filtros; referencias opcionales validadas |
| `PATCH alerts/:id` | Actualizar seguimiento | Institucional y transaccional |
| `GET group-view` | Consolidado del grupo | Institucional; período/grupo y consultas secundarias acotados |
| `GET pdf/group` | PDF del grupo | Hereda el consolidado acotado antes de resolver logo |
| `GET pdf/student` | PDF individual | Matrícula, grupo y período acotados |

## Qué no cubre

- Autorización dentro del colegio: se conservan los roles existentes. En particular, un docente
  sigue pudiendo operar sobre otros grupos del mismo colegio; se registra para el Bloque 4.
- La política histórica del roster: hoy se usan matrículas `ACTIVE` al ejecutar, no las vigentes en
  la fecha de corte. Traslados y retiros pueden cambiar retrospectivamente un informe histórico.
- Asignaciones terminadas no se excluyen de la vista consolidada; puede haber materias duplicadas.
- `execute` trata una nota sin datos como alerta abierta, mientras la vista consolidada la presenta
  como “sin datos” y no como riesgo. Se conserva el comportamiento existente hasta fijar política.
- Una alerta `IN_RECOVERY` no se cierra automáticamente al subir la nota. También se conserva.
- Límites finos de tamaño/tiempo al descargar el logo institucional, PostgreSQL/RLS y concurrencia
  entre dos ejecuciones simultáneas pertenecen a trabajos separados.

No se modificaron esquema, migraciones ni RLS, y las pruebas usan dos instituciones sintéticas.
