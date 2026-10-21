# Estado del blindaje de aplicación

## Duelos — candidato 2026-10-21

Once rutas de Duelos con resolución institucional directa, guardas de aula/ambos participantes, filtros de preguntas/respuestas/ayudas y revalidación relacional dentro de transacciones. **122 pruebas focales de Duelos** (77 HTTP nuevas y 45 existentes), **238 con bancos**, aprobadas. Tipos API y build se registran al cerrar el lote. Ver `AUDITORIA_AISLAMIENTO_DUELOS_20261021.md`.

Suite general final: **2.738 pruebas aprobadas / una fallida**, 121 suites aprobadas y una fallida. El único fallo es el contrato estructural global por Eventos; no se excluyeron pruebas. Tipos API finales aprobados. Se conserva el fallo visible y no se declara una suite global verde.

Build Nest final aprobado después de reintentar un error de limpieza de `dist` en Windows. No hay migraciones nuevas ni cambios de frontend. Pendiente de publicación/verificación de servicios por acceso Railway; no se afirma despliegue confirmado.

Enviado a `staging` en `e993d50f`; no se hizo push a main. Siguiente frente: 33 rutas de Eventos y posterior verificación/promoción selectiva del blindaje preparado. El trabajo local previo permanece conservado.

Inventario actual del candidato: **1.204 rutas, 416 directas, 689 pendientes, 66 no institucionales y 33 incumplimientos**, todos de Eventos. Las cifras de 405/44 del bloque anterior son históricas. No se añaden excepciones para simular un contrato global aprobado. Permanecen PostgreSQL/RLS, concurrencia real y promoción selectiva a main; este lote no cierra Classroom ni el blindaje global.

Publicación todavía sin acreditar: Railway CLI responde `Unauthorized`; no se pudo verificar el servicio activo. Main remoto avanzó a `49679653` con el fix móvil `649bf7c1`; conservarlo y adaptar el blindaje a esa base antes de una promoción, sin trasladar funciones exclusivas de staging. Los cortes anteriores de servicios activos son evidencia histórica, no una consulta actual.

## Banco de preguntas — candidato 2026-10-21

Siete rutas de producción con resolución institucional directa y guardas HTTP A/B; staging conserva además su ruta de copia ya existente, adaptada y probada sin promoverla a main. Filtros institucionales añadidos a las preguntas anidadas en listado y copia para excluir relaciones incoherentes. Véase `AUDITORIA_AISLAMIENTO_BANCOS_20261021.md`.

Candidato main: 78 suites/1.530 pruebas API, tipos API/web y build Nest aprobados. Staging: 116 pruebas focales aprobadas. El inventario pasa a **1.204 rutas, 405 directas, 689 pendientes, 66 no institucionales y 44 incumplimientos estructurales restantes**, sin excepciones nuevas. Publicación/servicio efectivo se registran después de verificar Railway. Duelos y Eventos continúan como siguiente frente; este lote no cierra Classroom, concurrencia PostgreSQL, RLS ni el blindaje global.

**Publicación pendiente:** enviado a staging `5853229a`, pero Railway rechazó la subida directa con «Deploys have been paused temporarily»; la página oficial confirma builds pausados. API staging sigue sirviendo `a1625ed2` (`bfb9118f` SUCCESS). El candidato de producción `65c1b794` no se envió a main; producción anterior permanece saludable. Retomar despliegue/verificación de staging antes de promover a main. Pendiente de código: 11 rutas de Duelos y 33 de Eventos; no son fugas confirmadas por este conteo.

## Corte de publicación y continuidad — 2026-10-20

Documentos, Staff Leave y Teacher Schedule ya están publicados en producción; Documentos y la sincronización de Eventos también están publicados en staging. Las referencias posteriores a «sin publicar» describen cortes históricos. El detalle verificable está en `RECONCILIACION_PRODUCCION_STAGING_20261020.md` y la bitácora.

Se verificó Node 22 efectivo en staging: API `6af38325` y web `3bf1caa2` SUCCESS; antes, ambos autodeploys de `1be3786d` también finalizaron correctamente. El override API de Railway se alineó con `.nvmrc`. El web usa la instalación inicial de Nixpacks y compila sin una segunda ejecución de `npm ci`.

Dependencias y bancos se promovieron selectivamente a main en `db4b2b07`: API `3cf2cadc` y web `1596d22e` SUCCESS con hash confirmado; API health HTTP 200/ok y aula HTTP 200 con bundle nuevo. Los diez fallos API de bancos quedaron resueltos con el servicio/catálogo existente en staging: 77 suites y 1.453 pruebas API del candidato main aprobadas. El catálogo conserva los 17 bancos previos y añade dos de 8.º. No hay migraciones nuevas en ese lote.

El siguiente frente de código es aislamiento HTTP A/B de Duelos, bancos y Eventos, incluyendo sus permisos por rol/asignación. La clasificación estructural pendiente (52 rutas en el inventario del corte) no equivale a 52 fugas demostradas. Después, promover por módulos el blindaje aún exclusivo de staging, revisando dependencias y las siete migraciones adicionales. Inclusión sigue pospuesta y se conserva la frontera EduLab.

La auditoría de dependencias de ejecución pasa de 36 a 4 paquetes señalados por npm, sin altos ni críticos con `--omit=dev`; quedan dos moderados y dos bajos. La auditoría completa conserva seis altos en herramientas de desarrollo. Sigue pendiente un fallo visual previo de Arena. No se declara cierre global de seguridad, PostgreSQL/RLS ni autorización intrainstitucional.

Sincronización posterior de 2026-10-20: incorporados los cinco commits de Eventos matemáticos procedentes de main y el lote Documentos. El inventario queda en **1.204 rutas, 397 directas, 689 pendientes, 66 no institucionales y 52 incumplimientos previos/importados del contrato**. Ver `RECONCILIACION_PRODUCCION_STAGING_20261020.md`; las cinco rutas adicionales de Eventos no se declaran auditadas por sincronizarlas. Pruebas focales: 171/171; tipos API/web aprobados.

## Corte local 2026-10-20

Revisión actual en `REVISION_BLINDAJE_20261020.md`, base local `origin/staging` `1e9ef9a9`. Avance sin publicar: Documentos pasa de tres a ocho rutas con resolución directa y un catálogo estático; 42 pruebas HTTP aprobadas. Continúa parcial por limpieza, cuota concurrente, auditoría durable y PostgreSQL/storage reales. Ver `AUDITORIA_AISLAMIENTO_DOCUMENTOS.md`.

Inventario recalculado con este avance: **1.199 rutas, 397 directas, 689 excepciones pendientes, 66 no institucionales y 47 sin clasificación**. El contrato global falla por esas 47 rutas previas de Duelos, bancos y Eventos matemáticos. Las cifras y la tabla que siguen son el corte histórico de septiembre y no deben usarse como inventario actual. B1 solo acredita sus 17 rutas originales; Classroom creció a 135 declaraciones. No se acredita cierre global ni publicación de este avance.

## Corte histórico conservado

Fecha de actualización: 2026-09-23. Classroom B1 se integró en staging hasta 17/98 rutas, en `e9d06320`. Las otras 81 rutas siguen pendientes; esto no cierra Classroom ni el blindaje global.

Bloque 0, Taller, Matrículas, la parte declarada de Inclusión, Plantillas, Learning Route, Cortes preventivos y Attendance están publicados. Staff Leave y Teacher Schedule quedaron cerrados en aplicación en un lote anterior. Classroom B1 ya está integrado en staging con pruebas de servicio y HTTP A/B; quedan 81 rutas de Classroom y sus permisos finos. Inclusión permanece pospuesta. Ver `AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md`. No constituye cierre global del aislamiento.

## Medición reproducible (corte anterior al lote B1; recalcular para el total actual)

1113 declaraciones de ruta (incluye SSE y dos rutas de app), 338 con llamada directa, incondicional y esperada a requireInstitutionId, 712 pendientes de calibración y 63 excepciones no institucionales.

Este criterio es deliberadamente más estricto que contar menciones de institución: helpers de controlador, resolveInstitutionId, interceptores y resolución en servicios quedan pendientes de revisión, NO se cuentan como vulnerabilidades confirmadas. Las cifras 731/339 del encargo no son comparables con estas columnas. Se cuentan declaraciones de decorador, no todas las combinaciones de prefijos/versiones HTTP.

La lista exacta, con huella y motivo por ruta, vive en apps/api/src/common/security/institution-route-exceptions.json. La suite institution-route-contract.spec.ts impide rutas nuevas sin resolución, regresiones en las ya reconocidas, cambios en excepciones y excepciones obsoletas. No regenerar la lista para silenciar errores: revisar cada cambio y retirar deuda conforme se audita.

## Los 39 módulos

Una fila por directorio de apps/api/src/modules. academic y evaluation contienen submódulos: su cierre exige auditarlos todos. Cero rutas no significa módulo auditado. La app aporta 2 rutas no institucionales fuera de esta tabla.

| Módulo | Rutas | Resolución directa | Pendiente calibrar | No institucional | Estado de auditoría |
|---|---:|---:|---:|---:|---|
| abp | 66 | 0 | 66 | 0 | Pendiente de auditoría A/B por módulo |
| academic | 159 | 94 | 63 | 2 | Parcial: Matrículas y Plantillas corregidas con pruebas de servicio y HTTP. PostgreSQL sintético y resto de academic pendientes. Ver AUDITORIA_AISLAMIENTO_MATRICULAS.md y AUDITORIA_AISLAMIENTO_PLANTILLAS.md |
| achievements | 46 | 42 | 4 | 0 | Pendiente de auditoría A/B por módulo |
| apd | 35 | 34 | 1 | 0 | Parcial: contexto, perfiles/planes, actividades y avances; 93 pruebas de servicio/auxiliares y 50 HTTP. Participantes, adjuntos, firmas, materias, agregaciones y PostgreSQL pendientes. Ver AUDITORIA_AISLAMIENTO_INCLUSION.md |
| attendance | 17 | 17 | 0 | 0 | Cerrado en aplicación: institución del actor, relaciones completas, transacciones y auditoría con `tx`, 68 pruebas de servicio + 56 HTTP. RLS y siete permisos finos del Bloque 4 pendientes. Ver AUDITORIA_AISLAMIENTO_ATTENDANCE.md |
| auth | 7 | 0 | 4 | 3 | Pendiente de auditoría A/B por módulo |
| capabilities | 5 | 3 | 2 | 0 | Pendiente de auditoría A/B por módulo |
| classroom | 98 | 17 | 81 | 0 | Parcial: B1 17/98 integrado en staging con actor institucional, cadena relacional y pruebas A/B. Quedan 81 rutas; cron, storage, permisos finos y PostgreSQL/RLS no se acreditan por B1. Ver AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md |
| communications | 17 | 7 | 10 | 0 | Pendiente de auditoría A/B por módulo |
| dashboard | 19 | 13 | 6 | 0 | Pendiente de auditoría A/B por módulo |
| documents | 9 | 3 | 6 | 0 | Pendiente de auditoría A/B por módulo |
| edulab-persistence | 0 | 0 | 0 | 0 | Pendiente; frontera EduLab, no modificar |
| edusyn-play | 57 | 0 | 17 | 40 | Parcialmente no aplica; puentes institucionales pendientes |
| elections | 22 | 7 | 15 | 0 | Pendiente de auditoría A/B por módulo |
| evaluation | 66 | 23 | 43 | 0 | Parcial: Cortes preventivos 8/8 cerrado en aplicación y cálculos usados por Matrículas corregidos; resto de evaluation pendiente. Ver AUDITORIA_AISLAMIENTO_PREVENTIVE_CUTS.md |
| finance | 54 | 0 | 54 | 0 | Pendiente de auditoría A/B por módulo |
| gamification | 2 | 0 | 2 | 0 | Pendiente de auditoría A/B por módulo |
| iam | 44 | 7 | 37 | 0 | Pendiente de auditoría A/B por módulo |
| institution-config | 14 | 0 | 14 | 0 | Pendiente de auditoría A/B por módulo |
| institution-context | 0 | 0 | 0 | 0 | Pendiente de auditoría A/B por módulo |
| learning-route | 16 | 14 | 0 | 2 | Cerrado en aplicación: actor institucional en 14 rutas; catálogo CEFR y generación sin persistencia justificadas. Cadena ruta→aula y paso→ruta validada, transacciones reales, 52 pruebas de servicio y 40 HTTP. Bloque 4, PostgreSQL/RLS y cuota IA quedan aparte. Ver AUDITORIA_AISLAMIENTO_LEARNING_ROUTE.md |
| live-session | 27 | 0 | 27 | 0 | Pendiente de auditoría A/B por módulo |
| management-tasks | 19 | 4 | 15 | 0 | Pendiente de auditoría A/B por módulo |
| men-reports | 5 | 0 | 5 | 0 | Pendiente de auditoría A/B por módulo |
| observer | 28 | 0 | 28 | 0 | Pendiente de auditoría A/B por módulo |
| payments | 15 | 3 | 12 | 0 | Pendiente de auditoría A/B por módulo |
| pedagogical-design | 5 | 0 | 5 | 0 | Pendiente de auditoría A/B por módulo |
| pedagogical-support | 6 | 6 | 0 | 0 | Pendiente de auditoría A/B por módulo |
| performance | 14 | 5 | 9 | 0 | Pendiente de auditoría A/B por módulo |
| permissions | 8 | 0 | 8 | 0 | Pendiente de auditoría A/B por módulo |
| recovery | 33 | 33 | 0 | 0 | Auditoría A/B previa documentada; HTTP pendiente |
| reports | 49 | 2 | 47 | 0 | Pendiente de auditoría A/B por módulo |
| staff-leave | 7 | 7 | 0 | 0 | Cerrado en aplicación: solicitudes, PII, alcance personal/administrativo y decisiones atómicas; 31 pruebas de servicio + 49 HTTP. Ver AUDITORIA_AISLAMIENTO_STAFF_LEAVE.md |
| storage | 7 | 0 | 7 | 0 | Pendiente de auditoría A/B por módulo |
| superadmin | 13 | 0 | 0 | 13 | No aplica tenant único; autorización global pendiente |
| taller | 11 | 10 | 0 | 1 | Parcial: 40 pruebas de servicio + 24 HTTP A/B; cadena histórica equipo→proyecto→aula y miembros→matrícula y atomicidad general pendientes. Ver AUDITORIA_AISLAMIENTO_TALLER.md |
| teacher-schedule | 4 | 4 | 0 | 0 | Cerrado en aplicación: agenda por institución + actor, mutaciones atómicas y RolesGuard; 12 pruebas de servicio + 14 HTTP. Ver AUDITORIA_AISLAMIENTO_TEACHER_SCHEDULE.md |
| teacher-workspace | 61 | 0 | 61 | 0 | Pendiente de auditoría A/B por módulo |
| timetabling | 46 | 0 | 46 | 0 | Pendiente de auditoría A/B por módulo |

## Evidencia previa y discrepancias

- Recuperaciones: docs/AUDITORIA_AISLAMIENTO_RECUPERACIONES.md documenta 33 rutas y 30 pruebas A/B de servicios. No se atribuye un cierre HTTP ni por asignación docente.
- El encargo declara 3/39 auditados, pero no identifica inequívocamente las otras dos unidades del inventario. Aprendizajes y Reportes son antecedentes, no justifican marcar completos academic o reports sin reconciliar su alcance.
- Taller sí contiene institutionId, resolveActor y filtros institucionales en esta base. Las 13 operaciones posteriores sin filtro propio se acotaron en esta entrega; 40 pruebas añadidas. La premisa de cero menciones del encargo era incorrecta. Ver AUDITORIA_AISLAMIENTO_TALLER.md.
- docs/security/BITACORA-RLS.md y el handoff RLS citado no existen en esta base. RLS permanece fuera del alcance; no se ha conectado a ninguna base.
- Play no recibe una excepción global: panel personal y autenticación tienen excepciones por ruta; conversiones, sesiones y rutas públicas restantes quedan pendientes de clasificación individual.

## Riesgos y siguiente trabajo

Prioridad indicada por el usuario: posponer Inclusión y seguir el blindaje por riesgo. Learning Route, Plantillas, Cortes preventivos y Attendance ya fueron integrados. Classroom B1 pasó revisión adversarial y se integró en staging; Classroom sigue parcial. Taller ya tiene HTTP A/B, pero conserva cadenas históricas y atomicidad pendientes. Matrículas conserva contención/rollback con PostgreSQL sintético y dependencias HTTP de notas pendientes; Attendance ya cerró su dependencia. No modificar la frontera EduLab.

Pendiente: filtros reales en servicios, FKs cruzadas, carreras y escrituras; laboratorio HTTP local con instituciones sintéticas y sesiones por rol; autorización por asignación docente y acudientes (docs/PROPUESTA_ROL_ACUDIENTE.md). El Bloque 4 es inventario, no implementación.

## Verificación y entrega

Verificado: 83 suites / 1.232 pruebas API (13 del contrato estructural), 19 archivos / 203 pruebas web, tipos API/web y build Nest correctos. El cliente Prisma se generó exclusivamente dentro del worktree para coincidir con el esquema; no se ejecutaron migraciones ni conexiones a bases. Ningún dato real modificado. Push a staging confirmado: afe9f388. Railway pendiente de verificar; no promovido a producción. Ver docs/AUDITORIA_BLOQUE_0_BLINDAJE.md para límites del contrato.

Checkpoint Taller: 84 suites / 1.272 pruebas API, tipos API y build Nest correctos; 40 pruebas nuevas del módulo. La suite se repitió fuera del sandbox tras un fallo de lectura de una dependencia y pasó completa. Web conserva 203 pruebas y tipos aprobados, sin cambios. Push de Taller confirmado: 000d435b.


Checkpoint Matrículas/Inclusión (2026-09-11): 86 suites / 1.383 pruebas API aprobadas; 111 nuevas (63 servicios + 48 HTTP). Tipos API/web aprobados. Navegador local sintético: recorridos de Matrículas, edición de estudiante, agenda y edición de planes, selección de estudiante en perfiles y vista móvil aprobados. Pruebas HTTP no conectan PostgreSQL ni certifican RLS. Ver los dos documentos de esta entrega para alcance y pendientes.

Verificación final de la entrega: build Nest aprobado; web 21 archivos / 208 pruebas, tipos aprobados y smoke de navegador reproducible aprobado. No se verificó Railway ni se promovió a producción.

Checkpoint adicional de Inclusión: 88 suites / 1.440 pruebas API y 22 archivos / 214 pruebas web aprobados después de integrar staging ee1cbb3a. 57 pruebas nuevas de Inclusión (39 de servicio y 18 HTTP). Build Nest y tipos API/web aprobados; navegador sintético de Matrículas e Inclusión aprobado. Los 39 módulos conservan su estado explícito: este checkpoint no cierra APD ni el aislamiento global.

Checkpoint de actividades y avances de Inclusión (base ff81a71b): 90 suites / 1.526 pruebas API y 22 archivos / 214 pruebas web aprobados. 86 pruebas nuevas (54 servicios/auxiliares, 32 HTTP), tipos API/web y build Nest aprobados. Retirar la guarda de creación hace fallar ambos casos A/B; restaurarla devuelve las 54 pruebas de servicio a verde. Inventario sin cambios: 1.113 rutas, 274 directas, 779 pendientes de calibración y 60 excepciones no institucionales. No se ha probado PostgreSQL sintético ni se declara APD cerrado.

Checkpoint Plantillas (base 38614231): 21 rutas institucionales y 1 catálogo estático revisados; 100 pruebas nuevas de servicio y 67 HTTP. Suite API completa: 92 suites / 1.693 pruebas. Web: 22 archivos / 214 pruebas. Tipos API/web y build Nest aprobados. Se retiran 19 excepciones y se reclasifica el catálogo, sin cambiar otras rutas. La prueba de mutación detecta quitar la guarda de año. PostgreSQL sintético y el resto de academic siguen pendientes. Inclusión permanece pospuesta; Claude tiene instrucciones versionadas para learning-route.

Checkpoint Learning Route (eaa57408): 16/16 rutas clasificadas; 14 institucionales y 2 no institucionales justificadas. La revisión de integración corrigió cuatro transacciones que usaban el cliente Prisma exterior, revalidó dentro de `tx`, acotó la escritura idempotente de evidencia y añadió pruebas contra relaciones institucionales inconsistentes y rollback. Focal: 3 suites / 105 pruebas. Suite completa: 94 suites / 1.785 pruebas API; web 22 archivos / 214 pruebas; tipos API/web y build Nest aprobados. PostgreSQL/RLS, cuota IA y autorización dentro del colegio no se declaran cubiertos.

Checkpoint Cortes preventivos (2022be74 + 172cd375): 8/8 rutas resuelven institución del actor; configuración, alertas, grupos, asignaciones, matrículas, períodos y motor de nota a fecha quedan acotados. Ejecución completa atómica. 38 pruebas de servicio y 46 HTTP; mutación de la guarda del período rompe 5 casos y, restaurada, el focal con contrato pasa 97/97. Suite completa: 96 suites / 1.869 pruebas API; tipos API/web y build Nest aprobados; web conserva 22 archivos / 214 pruebas ya verificados en esta sesión. PostgreSQL/RLS, autorización intrainstitucional y semántica histórica de roster/asignaciones quedan aparte.

Checkpoint Attendance (d50bce46…ddb1f058, revisión 70726854): 17/17 rutas directas y 0 excepciones. La revisión corrigió callbacks que ignoraban `tx`, hizo transaccionales la guarda, las escrituras y la auditoría, amplió las cadenas relacionales y corrigió a 400 el contexto institucional ausente. 68 pruebas de servicio + 56 HTTP; mutación central rompe cuatro cruces y el cliente raíz prohibido dentro de la transacción queda probado. Suite completa combinada: 98 suites / 1.993 pruebas API; web 22/214; tipos API/web y build Nest aprobados. Inventario: 1.113 rutas, 331 directas, 719 pendientes y 63 no institucionales. PostgreSQL/RLS y siete permisos finos del Bloque 4 siguen aparte.

Checkpoint Staff Leave + Teacher Schedule (97f85691, a43db832, 4fd6d9c4): 11/11 rutas directas y siete excepciones retiradas. Permisos laborales quedan acotados por institución, actor y membresías; revisión/cancelación son atómicas. Agenda personal queda acotada por institución + identidad y rechaza estudiantes. 106 pruebas nuevas; focal con contrato 119/119. Suite completa: 102 suites / 2.099 pruebas API; tipos y build Nest aprobados. Inventario: 1.113 rutas, 338 directas, 712 pendientes y 63 no institucionales. Classroom sigue 0/98: su partición está medida, no cerrada.

Checkpoint HTTP Taller (2026-09-12): 24 pruebas HTTP nuevas con JWT y guards reales sobre las diez
rutas institucionales A→B/B→A, mismo usuario en ambos colegios y catálogo estático. Focal Taller
2 suites / 64 pruebas; suite API completa 103 suites / 2.123 pruebas; tipos API/web y build Nest
aprobados. No cambia el inventario de rutas. El módulo permanece parcial por las relaciones
históricas equipo/proyecto/aula y miembro/matrícula, atomicidad general y PostgreSQL/RLS.
