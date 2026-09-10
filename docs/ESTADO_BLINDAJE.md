# Estado del blindaje de aplicación

Fecha: 2026-09-10. Base: origin/staging 996263f806c85490c52000b0c001449dc7f2dd1d.

Bloque 0 publicado con deuda explícita. Bloque 1: Taller auditado en servicios con pruebas A/B, 40 pruebas nuevas, entrega lista para staging. Resto de módulos y bloques 2–4 pendientes. No constituye cierre global del aislamiento.

## Medición reproducible

1110 declaraciones de ruta (incluye SSE y dos rutas de app), 246 con llamada directa, incondicional y esperada a requireInstitutionId, 805 pendientes de calibración y 59 excepciones no institucionales.

Este criterio es deliberadamente más estricto que contar menciones de institución: helpers de controlador, resolveInstitutionId, interceptores y resolución en servicios quedan pendientes de revisión, NO se cuentan como vulnerabilidades confirmadas. Las cifras 731/339 del encargo no son comparables con estas columnas. Se cuentan declaraciones de decorador, no todas las combinaciones de prefijos/versiones HTTP.

La lista exacta, con huella y motivo por ruta, vive en apps/api/src/common/security/institution-route-exceptions.json. La suite institution-route-contract.spec.ts impide rutas nuevas sin resolución, regresiones en las ya reconocidas, cambios en excepciones y excepciones obsoletas. No regenerar la lista para silenciar errores: revisar cada cambio y retirar deuda conforme se audita.

## Los 39 módulos

Una fila por directorio de apps/api/src/modules. academic y evaluation contienen submódulos: su cierre exige auditarlos todos. Cero rutas no significa módulo auditado. La app aporta 2 rutas no institucionales fuera de esta tabla.

| Módulo | Rutas | Resolución directa | Pendiente calibrar | No institucional | Estado de auditoría |
|---|---:|---:|---:|---:|---|
| abp | 66 | 0 | 66 | 0 | Pendiente de auditoría A/B por módulo |
| academic | 159 | 54 | 105 | 0 | Pendiente de auditoría A/B por módulo |
| achievements | 46 | 42 | 4 | 0 | Pendiente de auditoría A/B por módulo |
| apd | 32 | 31 | 1 | 0 | Pendiente de auditoría A/B por módulo |
| attendance | 17 | 0 | 17 | 0 | Pendiente de auditoría A/B por módulo |
| auth | 7 | 0 | 4 | 3 | Pendiente de auditoría A/B por módulo |
| capabilities | 5 | 3 | 2 | 0 | Pendiente de auditoría A/B por módulo |
| classroom | 98 | 0 | 98 | 0 | Pendiente de auditoría A/B por módulo |
| communications | 17 | 7 | 10 | 0 | Pendiente de auditoría A/B por módulo |
| dashboard | 19 | 13 | 6 | 0 | Pendiente de auditoría A/B por módulo |
| documents | 9 | 3 | 6 | 0 | Pendiente de auditoría A/B por módulo |
| edulab-persistence | 0 | 0 | 0 | 0 | Pendiente; frontera EduLab, no modificar |
| edusyn-play | 57 | 0 | 17 | 40 | Parcialmente no aplica; puentes institucionales pendientes |
| elections | 22 | 7 | 15 | 0 | Pendiente de auditoría A/B por módulo |
| evaluation | 66 | 12 | 54 | 0 | Pendiente de auditoría A/B por módulo |
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

Taller: auditoría de sus once rutas y servicio terminada; HTTP pendiente. Siguiente: enrollment, luego templates, learning-route, attendance, preventive-cuts, observer y classroom. Matrículas incluye traslados de notas/asistencia/tutorías en su servicio de 1.321 líneas, además de reportes (415 líneas). El usuario eligió auditoría integral del flujo: se incluyen traslados de notas, asistencia y tutorías antes de marcarlo cerrado. Matrículas en inventario, todavía sin correcciones. Continuar con los demás módulos; no modificar la frontera EduLab sin resolver el conflicto con el alcance de 39 módulos.

Pendiente: filtros reales en servicios, FKs cruzadas, carreras y escrituras; laboratorio HTTP local con instituciones sintéticas y sesiones por rol; autorización por asignación docente y acudientes (docs/PROPUESTA_ROL_ACUDIENTE.md). El Bloque 4 es inventario, no implementación.

## Verificación y entrega

Verificado: 83 suites / 1.232 pruebas API (13 del contrato estructural), 19 archivos / 203 pruebas web, tipos API/web y build Nest correctos. El cliente Prisma se generó exclusivamente dentro del worktree para coincidir con el esquema; no se ejecutaron migraciones ni conexiones a bases. Ningún dato real modificado. Push a staging confirmado: afe9f388. Railway pendiente de verificar; no promovido a producción. Ver docs/AUDITORIA_BLOQUE_0_BLINDAJE.md para límites del contrato.

Checkpoint Taller: 84 suites / 1.272 pruebas API, tipos API y build Nest correctos; 40 pruebas nuevas del módulo. La suite se repitió fuera del sandbox tras un fallo de lectura de una dependencia y pasó completa. Web conserva 203 pruebas y tipos aprobados, sin cambios. Push de Taller pendiente.
