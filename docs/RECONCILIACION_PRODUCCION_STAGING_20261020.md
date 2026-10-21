# Reconciliación de producción, staging y blindaje

## Estado posterior verificado — 2026-10-20

Producción ya publica `db4b2b07`: API `3cf2cadc` y web `1596d22e` SUCCESS, con hash confirmado por Railway. Node 22.14.0 en ambos builds; API health HTTP 200/ok y aula HTTP 200 con el bundle nuevo. Dependencias de ejecución pasan de 36 a 4 paquetes señalados, sin altos/críticos con `--omit=dev`; los avisos residuales y de desarrollo siguen abiertos. Véase `BLINDAJE_DEPENDENCIAS_20261020.md`.

Bancos ya reconciliados: se conservan los 17 previos, se añaden dos de 8.º y se corrige el reconocimiento de grados y reutilización hasta dos grados inferiores. API completa: 77 suites/1.453 pruebas aprobadas, cero fallos; tipos API/web y builds aprobados. Los diez fallos de bancos descritos más abajo son históricos y quedaron resueltos en `8c887ff2`. Véase `RECONCILIACION_BANCOS_20261020.md`. Sin migraciones nuevas.

Staging mantiene las correcciones de Eventos y Documentos, las dependencias parcheadas y la configuración de Node/build alineada. API `6af38325` y web `3bf1caa2` SUCCESS; antes también terminaron correctamente los autodeploys de `1be3786d`. No se igualaron las ramas completas ni sus bases; el trabajo local previo sigue conservado.

Prioridad siguiente: pruebas y correcciones de aislamiento HTTP A/B y permisos de Duelos, bancos y Eventos. Después, promoción por módulos del blindaje restante de staging, revisando sus dependencias y migraciones de notas/reportes. Siguen los límites de PostgreSQL/RLS, cuota/almacenamiento de Documentos, avisos npm y un fallo visual previo de Arena. Inclusión permanece pospuesta y la frontera EduLab se conserva. El inventario de 1.204 rutas es el corte de staging documentado abajo, no una nueva auditoría global de producción.

## Registro histórico de esta reconciliación

Fecha: 2026-10-20. Comparación después de `git fetch origin main staging --prune`.
Puntas de partida: `main` `010aa043`, `staging` `1e9ef9a9`.

## Hallazgo principal

Las ramas están divergentes por promociones selectivas y cherry-picks. La ausencia de un hash no demuestra ausencia de su corrección. Se contrastaron historial, patch equivalence, diffs finales y bitácora; no se fusiona staging completo ni se iguala el directorio principal con un reset.

Railway, consultado antes de publicar este lote: API `39f829f6-8a2d-44da-80cf-875a189cde21` y web `466d3183-cd08-4e5a-b8f4-4ca65e36a03c` en SUCCESS, ambos con `c3ff9b13`. El commit `010aa043` está en main, pero aún no estaba desplegado. Por tanto, «en main» y «sirviendo en producción» son estados distintos. La bitácora previa atribuye la espera a la pausa de builds de Railway; el listado confirma el commit activo, no que el incidente siga abierto.

## Producción → staging

| Commit original | Corrección | Resultado en candidato de staging |
|---|---|---|
| `5f25bfd8` | Catálogo de 996 preguntas, grado e importación idempotente | `df7f037c`; incluye migración aditiva `20261020130000_math_event_question_grade` ya existente en main |
| `f9e809ad` | Descomprimir gzip correctamente para que arranque la API | `62456823` |
| `76b55abe` | Descubrimiento de eventos y diagnóstico de acceso | `34ec4b10` |
| `c3ff9b13` | Matrícula vigente, jugador libre, reloj y cierre sin carreras | `76928329` |
| `010aa043` | Panel docente, permisos de organizador y filtrado del informe | `95896761` |

Los cinco se integraron sin conflictos. Tras integrarlos, `apps/api/src/modules/math-events` y `apps/web/src/pages/math-events` son idénticos por contenido a main. `MathEvents.tsx` conserva únicamente la importación de API propia de staging (`lib/api/client` frente a `lib/api`).

`fd462293` contiene adaptación de navegación/imports de main: staging ya tiene la ruta y el acceso al banco de preguntas. `5b90c174` elimina archivos editoriales en la preparación de producción; no es una corrección que deba borrar el trabajo de staging. Las equivalencias del Aula/CREA y B1 de septiembre ya se documentaron en `ENTREGA_AULA_CREA_PRODUCCION_CANDIDATA_20260923.md`; B1 no se vuelve a promocionar.

## Blindaje → producción

Lote selectivo preparado sobre main en `codex/blindaje-produccion-20261020`:

- **Staff Leave:** siete rutas; ámbito institucional/personal, relaciones de solicitante y revisor, PII acotada y decisiones atómicas. Ya estaba en staging.
- **Teacher Schedule:** cuatro rutas; institución e identidad del docente en lectura y escritura, RolesGuard y mutaciones transaccionales. Ya estaba en staging.
- **Documentos:** ocho rutas institucionales y catálogo estático; contexto del actor, visibilidad, IDs ajenos, destino explícito de SuperAdmin y registro/contador transaccionales. Se incorpora a ambos candidatos.

Incluye la guarda de destino de staging y el helper de jerarquía usado por Documentos. Para compatibilidad con main, el controlador de Documentos declara `RECTOR` explícitamente; **no cambia** RolesGuard, JwtStrategy ni la política global de roles de producción. Ese mismo controlador se usa en staging.

El lote de producción no cambia `schema.prisma`, migraciones, configuración de Railway ni notas. Preserva las correcciones existentes de Eventos matemáticos. El candidato de staging añade únicamente la migración de grado indicada arriba y el avance de Documentos.

## Validación y límites

Ambos candidatos: tipos API y web aprobados; ocho suites y **171 pruebas aprobadas** (148 de los tres módulos de blindaje y 23 de Eventos matemáticos). Prisma generado exclusivamente en cada worktree; dependencias locales alineadas con las de sus ramas sin modificar manifiestos/locks.

Se ejecutó además toda la suite API de producción: 73 suites pasaron y cuatro fallaron. Tres fallaban porque faltaba `web-push` en la instalación local; completadas las dependencias, sus 23 pruebas pasan. La otra suite conserva **diez fallos previos** de `question-bank.service.spec.ts`: espera bancos de 7.º/8.º y reutilización de grados inferiores, mientras la implementación de main solo resuelve 6.º en esas operaciones. Servicio, catálogo y tests son idénticos a la base main en este lote (`git diff HEAD --` vacío en esos archivos). No se oculta ese resultado ni se declara la suite global verde.

No se modificaron datos de instituciones reales para validar. HTTP usa JWT/guards reales y persistencia/objetos sintéticos; no certifica RLS ni contención real de PostgreSQL.

## Lo que sigue pendiente

1. **Bancos de preguntas de producción:** reconciliar catálogo, resolución de grados y pruebas; decidir/promover el lote editorial verificado desde staging. Los diez fallos no se resuelven suprimiendo tests.
2. **Blindaje restante de staging:** Recuperaciones, Matrículas, Plantillas, Learning Route, Cortes preventivos, Attendance y Reportes requieren promoción selectiva con sus dependencias. Notas/reportes incluyen cambios de esquema y de auditoría; no se trasladan a main junto a este lote sin su revisión.
3. **Migraciones:** staging tiene siete adicionales: tipos NUMERIC/CATEGORIZE, campos genéricos de auditoría de notas, permiso de sobreescritura final docente, eventos de generación de boletín, snapshot preliminar, contrato de consolidación RLS y persistencia EduLab. No se promueven automáticamente ni se declara compatibilidad de bases sin revisarlas.
4. **Migración histórica CREA:** `20260923010000_edusyn_crea_permiso_ia` tiene el mismo SQL y difiere solo en una línea en blanco final. No se reescribe en ninguna rama; no se inspeccionaron checksums de bases reales.
5. **Contrato global:** tras sincronizar Eventos, staging tiene 1.204 rutas: 397 directas, 689 excepciones pendientes, 66 no institucionales y **52 incumplimientos** (19 de Duelos/bancos y 33 de Eventos). Antes de sincronizar eran 47: las cinco rutas adicionales provienen de los commits de producción. Documentos no deja incumplimientos propios. No se añaden excepciones para simular cierre.
6. **Observer/IAM/Storage/RLS:** reconciliar entregas aisladas, evidencia e integración. Inclusión continúa pospuesta y la frontera EduLab se conserva.
7. **Local:** el directorio principal está en `feat/aula-rediseno`, con trabajo no confirmado de otros frentes. Se conserva íntegro; los dos worktrees son las bases limpias de continuación. Igualar ramas desplegables no exige sobrescribir ese trabajo.

## Criterio de publicación

Publicar staging con la sincronización y Documentos; publicar main únicamente con el lote selectivo de blindaje una vez completados los builds. Añadir cada push a la bitácora, comprobar el commit efectivo de Railway y distinguir envío de despliegue confirmado. Un build pendiente o pausado no permite afirmar que los usuarios ya reciben la corrección.

También se reconciliaron las filas históricas de la bitácora: parte del historial reciente solo existía en el directorio compartido local. Se añadieron 71 filas ausentes al candidato de main y 36 al de staging, conservando todas las filas/secciones previas. Esas filas mantienen su evidencia original; esta sesión no revalida retrospectivamente cada despliegue. Cada nuevo push recibe su fila propia después del envío.

## Resultado de publicación

- `staging`: enviado `5656642e`. Railway API `1073f8ef` y web `c05f172e` **SUCCESS**; la migración aditiva queda aplicada según el contrato de arranque. Incluye las cinco correcciones de main y Documentos.
- `main`: enviado `d666f231`. Railway API `b4800c8c` **SUCCESS**. `/api/health` público respondió HTTP 200 y `status: ok`; `/aula` respondió HTTP 200. No se hicieron escrituras ni se simularon entregas/partidas con datos reales.
- Web producción: el autodeploy `fec41b2e` quedó **SKIPPED** por no cambiar rutas web en el lote de blindaje; eso dejaba sin servir el frontend del anterior `010aa043`. Se inició una subida CLI del mismo código verificado de `d666f231` en `e3710cd9`; las fuentes API/web del worktree coinciden con su commit. La subida CLI no aporta `meta.commitHash`; su procedencia se documenta aquí, sin atribuirle un hash que Railway no devuelve. Ver bitácora para la verificación terminal.
- Antes de los envíos: tipos API/web y 171 pruebas por candidato aprobados, build Nest de producción y builds Vite de ambos candidatos aprobados. El build Vite de producción conserva un bundle principal de unos 6 MB sin gzip: la optimización de carga de staging no se ha promocionado en este lote.
- El build remoto web advierte Node 18.20.5 frente al requisito de Vite 20.19+/22.12+ y reporta 35 hallazgos npm agregados (incluye desarrollo/workspaces). Queda revisar runtime/build y auditar dependencias por alcance; ese resumen no certifica 35 vulnerabilidades explotables en producción. El parche de dependencias `68fca171` de staging aún requiere promoción/revisión separada. No se ejecutó `npm audit fix --force`.

Los tres módulos promovidos y sus helpers son idénticos por contenido en main y staging. Eso no equivale a igualar toda la plataforma ni sus bases. La rama principal local con WIP permanece conservada.

**Verificación final del web de producción:** `e3710cd9-1566-42c3-82c9-fbed69691c1e` terminó en **SUCCESS**. `/aula` respondió HTTP 200 y su bundle público contiene «Respuestas en curso», texto del panel docente incorporado en `010aa043`. Esto confirma entrega del frontend pendiente; no sustituye un recorrido autenticado ni afirma que el panel sea visible para un rol no autorizado. Producción API/web y staging API/web quedan con despliegues SUCCESS en este corte.
