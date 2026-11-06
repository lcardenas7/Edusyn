# Abigail: revalidación del cierre — 6 de noviembre de 2026

Institución sintética IED Señora Abigail, staging. Año 2026 todavía activo.
Este registro distingue observaciones de navegador, código y pruebas aisladas.
No certifica cierre, matrículas del año siguiente ni conciliación completa.

| Pendiente | Evidencia y estado |
|---|---|
| Duplicados tras reemplazo docente | Reproducido en navegador: Cano, 9.º B/P3, tiene dos filas de Matemáticas, ambas original 2.7 y recuperación 3.0. Tabla cuenta cuatro asignaturas. El generador recorre asignaciones históricas y actuales como materias distintas. Corrección preparada: una fila por subjectId, preferencia por asignación vigente, conservando la última histórica si no hay vigente. No modifica snapshots publicados. |
| Completitud de cuatro períodos | Transición A/P1 muestra seis estudiantes sin notas. Esto no acredita por sí solo ausencia de valoraciones cualitativas. Falta conciliar currículo, logros y asistencia de los 24 grupos. |
| Recuperaciones de período | Confirmado en contrato: servidor devuelve byStatus; tarjetas leían nivel raíz y sumaban asignaturas reprobadas a planes pendientes. Corrección preparada y etiquetas de alcance institucional. Resultados y aprobaciones individuales siguen pendientes de conciliación. |
| Recuperación final | El detector de staging promedia filas de notas de períodos por área; no aplica explícitamente pesos ni exige completitud. No equiparar esos candidatos con decisión final. Pendiente flujo visible y conciliado de planes, resultados y aprobación. |
| Promoción | Protecciones preparadas para no convertir AT_RISK en promoción, no cerrar con matrículas activas sin decisión ni con datos incompletos. Asignaciones históricas siguen bloqueando la evaluación anual hasta conciliar sus componentes; el arreglo del boletín no resuelve ese punto. La regla por áreas/asignaturas y asistencia requiere fuente común. |
| Snapshots y documentos | Pendiente comparar antes/después y conservar documentos publicados. Las pruebas del generador y lectura histórica no sustituyen comprobación en navegador. |
| Activación del año | La rama actual de staging ya usa errors al validar activación. El supuesto pendiente isValid de la copia local no corresponde al código actual de staging. No sobrescribir esa corrección. |
| Pantalla de cierre | Reproducido: sin detalle por estudiante y aviso de acción irreversible. Preparada previsualización con motivos y un único recorrido desde el asistente. No es una lista integral de requisitos. |
| Reapertura anual | No implementada en este lote; no confundir reapertura de período con reversión de matrículas/promociones. Requiere control de dependencias del año siguiente y auditoría. |
| Aislamiento | Staging ya tiene controles institucionales de recuperaciones que la copia local antigua no refleja. Se conserva esa base; no se copian controladores antiguos sobre staging. Esto no acredita cobertura de todas las rutas. |

## Preparación y pruebas

- Checkout aislado `codex/abigail-year-closure-20261105`, base `5b1d7ddf` de staging. No se incluyen trabajos CREA ni otros cambios ajenos.
- Dependencias del lockfile instaladas en ese checkout; cliente Prisma generado desde su propio esquema. No se ejecutaron migraciones ni escrituras de datos.
- 95 pruebas focales aprobadas: reemplazo docente, generador de boletines, estadísticas de snapshots, pertenencia histórica, promoción pendiente, completitud, contexto por año y aislamiento.
- TypeScript API y web: `tsc --noEmit` aprobado. Publicación pendiente al redactar esta entrada.

## Condición de cierre

No ejecutar el cierre hasta conciliar las 24 cargas, los cuatro períodos y la asistencia, resolver recuperaciones y decisiones de cada estudiante, contrastar documentos/snapshots y comprobar los bloqueos en staging. Conservar los casos QA de no promoción y recuperación pendiente sin fabricar decisiones para superar el bloqueo.
