# Estado del blindaje de aplicación

Fecha: 2026-09-12. Attendance integrado sobre origin/staging 009fb852 y revisado en 70726854 + ddb1f058; este estado forma parte del lote de publicación a staging.

Bloque 0, Taller, Matrículas, la parte declarada de Inclusión, Plantillas, Learning Route, Cortes preventivos y Attendance están publicados. Staff Leave y Teacher Schedule quedan cerrados en aplicación en el siguiente lote: 11 rutas y 106 pruebas nuevas. Observer es el siguiente frente delegado y Classroom tiene un plan medido, todavía 0/98. Inclusión permanece pospuesta por el usuario y Matrículas conserva el pendiente de PostgreSQL sintético. No constituye cierre global del aislamiento.

## Medición reproducible

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
| classroom | 98 | 0 | 98 | 0 | Pendiente: inventario técnico y partición 17→36→52→87→93→98 definidos; ninguna ruta acreditada todavía. Ver PLAN_BLINDAJE_CLASSROOM.md |
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
| taller | 11 | 10 | 0 | 1 | Servicios auditados, 40 pruebas; HTTP pendiente. Ver AUDITORIA_AISLAMIENTO_TALLER.md |
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

Prioridad indicada por el usuario: posponer Inclusión y seguir el blindaje por riesgo. Learning Route, Plantillas, Cortes preventivos y Attendance ya fueron integrados; Observer continúa por encargo paralelo y Classroom queda después. Taller conserva HTTP pendiente. Matrículas conserva contención/rollback con PostgreSQL sintético y dependencias HTTP de notas pendientes; Attendance ya cerró su dependencia. No modificar la frontera EduLab.

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
