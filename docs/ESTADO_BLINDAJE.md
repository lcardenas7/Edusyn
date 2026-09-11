# Estado del blindaje de aplicación

Fecha: 2026-09-11. Base de esta entrega: origin/staging ee1cbb3a; correcciones de Inclusión en 9ae32d6b.

Bloque 0 y Taller publicados. Matrículas: flujo integral corregido, 63 pruebas de servicios y 48 HTTP; cierre operativo parcial (PostgreSQL sintético pendiente). Inclusión: mejoras de uso y acceso por rol; 39 pruebas de perfiles/planes y 18 HTTP del contexto de trabajo. Auditoría del resto del módulo pendiente. No constituye cierre global del aislamiento.

## Medición reproducible

1113 declaraciones de ruta (incluye SSE y dos rutas de app), 274 con llamada directa, incondicional y esperada a requireInstitutionId, 779 pendientes de calibración y 60 excepciones no institucionales.

Este criterio es deliberadamente más estricto que contar menciones de institución: helpers de controlador, resolveInstitutionId, interceptores y resolución en servicios quedan pendientes de revisión, NO se cuentan como vulnerabilidades confirmadas. Las cifras 731/339 del encargo no son comparables con estas columnas. Se cuentan declaraciones de decorador, no todas las combinaciones de prefijos/versiones HTTP.

La lista exacta, con huella y motivo por ruta, vive en apps/api/src/common/security/institution-route-exceptions.json. La suite institution-route-contract.spec.ts impide rutas nuevas sin resolución, regresiones en las ya reconocidas, cambios en excepciones y excepciones obsoletas. No regenerar la lista para silenciar errores: revisar cada cambio y retirar deuda conforme se audita.

## Los 39 módulos

Una fila por directorio de apps/api/src/modules. academic y evaluation contienen submódulos: su cierre exige auditarlos todos. Cero rutas no significa módulo auditado. La app aporta 2 rutas no institucionales fuera de esta tabla.

| Módulo | Rutas | Resolución directa | Pendiente calibrar | No institucional | Estado de auditoría |
|---|---:|---:|---:|---:|---|
| abp | 66 | 0 | 66 | 0 | Pendiente de auditoría A/B por módulo |
| academic | 159 | 75 | 83 | 1 | Parcial: Matrículas integral + dependencias; PostgreSQL sintético y resto de academic pendientes. Ver AUDITORIA_AISLAMIENTO_MATRICULAS.md |
| achievements | 46 | 42 | 4 | 0 | Pendiente de auditoría A/B por módulo |
| apd | 35 | 34 | 1 | 0 | Parcial: contexto de trabajo con 18 pruebas HTTP y perfiles/planes con 39 de servicio. Resto pendiente. Ver AUDITORIA_AISLAMIENTO_INCLUSION.md |
| attendance | 17 | 1 | 16 | 0 | Parcial: resumen usado por Matrículas corregido; resto de rutas y HTTP del resumen pendientes |
| auth | 7 | 0 | 4 | 3 | Pendiente de auditoría A/B por módulo |
| capabilities | 5 | 3 | 2 | 0 | Pendiente de auditoría A/B por módulo |
| classroom | 98 | 0 | 98 | 0 | Pendiente de auditoría A/B por módulo |
| communications | 17 | 7 | 10 | 0 | Pendiente de auditoría A/B por módulo |
| dashboard | 19 | 13 | 6 | 0 | Pendiente de auditoría A/B por módulo |
| documents | 9 | 3 | 6 | 0 | Pendiente de auditoría A/B por módulo |
| edulab-persistence | 0 | 0 | 0 | 0 | Pendiente; frontera EduLab, no modificar |
| edusyn-play | 57 | 0 | 17 | 40 | Parcialmente no aplica; puentes institucionales pendientes |
| elections | 22 | 7 | 15 | 0 | Pendiente de auditoría A/B por módulo |
| evaluation | 66 | 15 | 51 | 0 | Parcial: cálculos usados por Matrículas corregidos; demás operaciones y HTTP de cálculos pendientes |
| finance | 54 | 0 | 54 | 0 | Pendiente de auditoría A/B por módulo |
| gamification | 2 | 0 | 2 | 0 | Pendiente de auditoría A/B por módulo |
| iam | 44 | 7 | 37 | 0 | Pendiente de auditoría A/B por módulo |
| institution-config | 14 | 0 | 14 | 0 | Pendiente de auditoría A/B por módulo |
| institution-context | 0 | 0 | 0 | 0 | Pendiente de auditoría A/B por módulo |
| learning-route | 16 | 0 | 16 | 0 | Pendiente de auditoría A/B por módulo |
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
| staff-leave | 7 | 4 | 3 | 0 | Pendiente de auditoría A/B por módulo |
| storage | 7 | 0 | 7 | 0 | Pendiente de auditoría A/B por módulo |
| superadmin | 13 | 0 | 0 | 13 | No aplica tenant único; autorización global pendiente |
| taller | 11 | 10 | 0 | 1 | Servicios auditados, 40 pruebas; HTTP pendiente. Ver AUDITORIA_AISLAMIENTO_TALLER.md |
| teacher-schedule | 4 | 0 | 4 | 0 | Pendiente de auditoría A/B por módulo |
| teacher-workspace | 61 | 0 | 61 | 0 | Pendiente de auditoría A/B por módulo |
| timetabling | 46 | 0 | 46 | 0 | Pendiente de auditoría A/B por módulo |

## Evidencia previa y discrepancias

- Recuperaciones: docs/AUDITORIA_AISLAMIENTO_RECUPERACIONES.md documenta 33 rutas y 30 pruebas A/B de servicios. No se atribuye un cierre HTTP ni por asignación docente.
- El encargo declara 3/39 auditados, pero no identifica inequívocamente las otras dos unidades del inventario. Aprendizajes y Reportes son antecedentes, no justifican marcar completos academic o reports sin reconciliar su alcance.
- Taller sí contiene institutionId, resolveActor y filtros institucionales en esta base. Las 13 operaciones posteriores sin filtro propio se acotaron en esta entrega; 40 pruebas añadidas. La premisa de cero menciones del encargo era incorrecta. Ver AUDITORIA_AISLAMIENTO_TALLER.md.
- docs/security/BITACORA-RLS.md y el handoff RLS citado no existen en esta base. RLS permanece fuera del alcance; no se ha conectado a ninguna base.
- Play no recibe una excepción global: panel personal y autenticación tienen excepciones por ruta; conversiones, sesiones y rutas públicas restantes quedan pendientes de clasificación individual.

## Riesgos y siguiente trabajo

Taller: once rutas y servicio revisados, HTTP pendiente. Matrículas: correcciones integrales y laboratorio HTTP con JWT real y Prisma simulado. Faltan contención/rollback con PostgreSQL sintético y las dependencias HTTP de plantillas, notas y asistencia. Inclusión: recorridos mejorados y comprobados con un colegio ficticio; servicio APD y planes pedagógicos aún sin auditoría integral A/B. Continuar con estos puntos y luego templates, learning-route, attendance, preventive-cuts, observer y classroom. No modificar la frontera EduLab.

Pendiente: filtros reales en servicios, FKs cruzadas, carreras y escrituras; laboratorio HTTP local con instituciones sintéticas y sesiones por rol; autorización por asignación docente y acudientes (docs/PROPUESTA_ROL_ACUDIENTE.md). El Bloque 4 es inventario, no implementación.

## Verificación y entrega

Verificado: 83 suites / 1.232 pruebas API (13 del contrato estructural), 19 archivos / 203 pruebas web, tipos API/web y build Nest correctos. El cliente Prisma se generó exclusivamente dentro del worktree para coincidir con el esquema; no se ejecutaron migraciones ni conexiones a bases. Ningún dato real modificado. Push a staging confirmado: afe9f388. Railway pendiente de verificar; no promovido a producción. Ver docs/AUDITORIA_BLOQUE_0_BLINDAJE.md para límites del contrato.

Checkpoint Taller: 84 suites / 1.272 pruebas API, tipos API y build Nest correctos; 40 pruebas nuevas del módulo. La suite se repitió fuera del sandbox tras un fallo de lectura de una dependencia y pasó completa. Web conserva 203 pruebas y tipos aprobados, sin cambios. Push de Taller confirmado: 000d435b.


Checkpoint Matrículas/Inclusión (2026-09-11): 86 suites / 1.383 pruebas API aprobadas; 111 nuevas (63 servicios + 48 HTTP). Tipos API/web aprobados. Navegador local sintético: recorridos de Matrículas, edición de estudiante, agenda y edición de planes, selección de estudiante en perfiles y vista móvil aprobados. Pruebas HTTP no conectan PostgreSQL ni certifican RLS. Ver los dos documentos de esta entrega para alcance y pendientes.

Verificación final de la entrega: build Nest aprobado; web 21 archivos / 208 pruebas, tipos aprobados y smoke de navegador reproducible aprobado. No se verificó Railway ni se promovió a producción.

Checkpoint adicional de Inclusión: 88 suites / 1.440 pruebas API y 22 archivos / 214 pruebas web aprobados después de integrar staging ee1cbb3a. 57 pruebas nuevas de Inclusión (39 de servicio y 18 HTTP). Build Nest y tipos API/web aprobados; navegador sintético de Matrículas e Inclusión aprobado. Los 39 módulos conservan su estado explícito: este checkpoint no cierra APD ni el aislamiento global.
