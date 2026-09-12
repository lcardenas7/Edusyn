# Encargo para Claude — blindaje integral de Observer

Fecha: 2026-09-12. Responsable de integración: Astra.

## 1. Base y forma de trabajo

1. Ejecuta `git fetch origin staging`.
2. Comprueba que `git merge-base --is-ancestor 70726854 origin/staging` termine con código 0. Ese commit contiene la revisión final de Attendance y es requisito de este encargo.
3. Crea un worktree nuevo desde `origin/staging` y la rama `codex/blindaje-observer-claude`. No reutilices `edusyn-wt-attendance`.
4. No hagas push a `staging` ni edites trabajo de Astra. Entrega una secuencia de commits locales, hashes y ruta del worktree.
5. Antes de modificar, lee `docs/ENCARGO_BLINDAJE_ASTRA.md`, `docs/ESTADO_BLINDAJE.md`, `docs/AUDITORIA_BLOQUE_0_BLINDAJE.md` y este documento.

La medición de partida es exacta: `observer` tiene **28 declaraciones de ruta, 0 resoluciones directas, 28 excepciones `pending-audit` y 0 no institucionales**. El módulo ya contiene un blindaje parcial anterior y pruebas unitarias parciales. No confundas `institutionId` en una consulta, el helper `this.inst(req)` ni un mock que siempre devuelve `null` con una auditoría cerrada.

## 2. Alcance funcional completo

Audita conjuntamente:

- `apps/api/src/modules/observer/observer.controller.ts`
- `apps/api/src/modules/observer/observer.service.ts`
- `apps/api/src/modules/observer/observer-acta-pdf.service.ts`
- DTOs, módulo y pruebas exclusivas de `observer`
- un fixture A/B nuevo y exclusivo bajo `apps/api/test/fixtures/`
- documentación nueva `docs/AUDITORIA_AISLAMIENTO_OBSERVER.md` y `docs/ENTREGA_CLAUDE_OBSERVER.md`
- al final, únicamente las 28 entradas obsoletas de Observer en `institution-route-exceptions.json`, en un commit separado

El flujo incluye observaciones, panel y estadísticas, seguimientos pendientes, consultas por grupo y estudiante, timeline, resumen, datos de comisión, detalle, notificación a acudiente, exportación de actas y seguimientos, actas, compromisos, citaciones, remisiones y medidas pedagógicas.

No modifiques `ESTADO_BLINDAJE.md` ni `REGISTRO_DESPLIEGUES.md`; Astra los integra. No toques Attendance, Cortes preventivos, Matrículas, Inclusión/APD, Learning Route, Classroom, R1, EduLab, Prisma schema, migraciones ni RLS.

## 3. Contrato de aislamiento obligatorio

En las **28 rutas**, llama de forma directa, incondicional y esperada a `requireInstitutionId(this.prisma as any, req)` antes de leer parámetros que conduzcan a datos o de llamar al servicio. `this.inst(req)` no cuenta para el contrato estructural y debe desaparecer de las rutas auditadas. `req.user.institutionId` tampoco es evidencia suficiente y rompe el caso SuperAdmin con destino explícito.

La institución siempre procede del actor. Un usuario normal no puede sustituirla mediante ruta, query o body. Si una operación futura admite destino explícito para SuperAdmin, debe pasar ese valor al resolvedor; no lo inventes en este encargo.

Todo id recibido se valida dentro de la institución antes de leer PII, generar un PDF o escribir. Un recurso inexistente, ajeno o con relaciones institucionales incoherentes responde 404 de forma indistinguible y no produce escrituras, auditoría, PDF ni consultas secundarias sensibles.

Valida todas las ramas reales del esquema, no solo la columna directa:

- matrícula: `institutionId`, año, estudiante y grupo;
- grupo: sede, grado y jornada/sede;
- observación: `institutionId` y matrícula completa;
- acta: `actaRecord → observation → institution/matrícula`;
- compromiso, citación, remisión y medida: su `institutionId`, matrícula y observación opcional/obligatoria;
- cuando el DTO lleva a la vez `observationId` y `studentEnrollmentId`, ambos deben pertenecer al actor **y al mismo estudiante/matrícula**;
- año y grado de dashboard, estadísticas y comisión deben pertenecer al actor, y el grupo solicitado debe ser compatible con ambos;
- identidad, configuración y filas usadas en PDF deben corresponder al mismo `institutionId` resuelto.

Evita guardas seguidas de `update({ where: { id } })` o `delete({ where: { id } })`: existe una carrera. Usa una transacción real y escrituras acotadas (`updateMany`/`deleteMany` con comprobación de `count`), o una clave compuesta institucional si existe. Dentro de `$transaction(async (tx) => ...)`, toda validación, lectura previa, escritura y auditoría de esa unidad debe usar `tx`, nunca `this.prisma`. El doble debe pasar un objeto `tx` distinto para que esta propiedad sea demostrable.

## 4. Identidad del estudiante y autorización fina

Las rutas que admiten `ESTUDIANTE` (`by-student`, `timeline`, `summary`, detalle y compromisos según los decoradores actuales) no pueden devolver el expediente de otro estudiante del mismo colegio. Vincula la matrícula con el usuario de la sesión antes de cualquier lectura. Si existe acceso de acudiente en el código actual, aplica el mismo criterio mediante su relación real; no añadas un rol nuevo.

Conserva los `@Roles` existentes salvo que encuentres una escalada inequívoca. Audita en un Bloque 4 separado, sin declarar resueltos, los permisos internos del mismo colegio: docente autor frente a otros docentes, director de grupo, coordinador, rector, orientación, destinatario de remisión y quién puede cerrar o modificar cada expediente. Si corregir uno es imprescindible para impedir exposición directa de PII, hazlo con prueba y documéntalo como cambio de comportamiento.

## 5. Laboratorio A/B que sí demuestra el rechazo

Crea dos instituciones sintéticas A/B con filas completas y relaciones embebidas. El doble de Prisma debe aplicar de verdad igualdad, `in`, fechas, `AND`/`OR`/`NOT` y filtros relacionales anidados. No uses `mockResolvedValue(null)` como prueba principal: eso pasa aunque se quite la guarda.

Exige pruebas de servicio y HTTP real de Nest (`JwtAuthGuard`, `RolesGuard`, `ValidationPipe`, Supertest; solo Prisma es doble) para las 28 rutas. Para cada cruce relevante prueba A→B y B→A y afirma:

- 404 antes de toda lectura secundaria;
- cero create/update/delete y cero cambios de conteo en A y B;
- cero bytes PDF enviados cuando cualquier id del lote es ajeno;
- el id institucional falsificado se ignora o se rechaza según el DTO, sin tocar al tercero;
- estudiante A no ve a otro estudiante de A ni a B;
- lote mixto propio/ajeno falla completo;
- operación compuesta revierte si falla una escritura intermedia;
- cliente raíz prohibido dentro de la transacción, usando un `tx` distinto;
- relaciones históricas incoherentes (`institutionId` propio con matrícula/observación/grado de B) quedan ocultas.

Incluye casos legítimos con contenido y aritmética comprobables. En exportación valida institución, configuración, alcance del docente, selección conjunta/individual, máximo del DTO y que un lote mixto no filtre silenciosamente al ajeno.

Haz al menos una prueba de mutación: retira una guarda de pertenencia central, demuestra qué pruebas A/B caen, restaura el código y vuelve a verde. No publiques scripts temporales.

## 6. Cierre y entrega

Ejecuta, en este orden:

1. pruebas focales de Observer y contrato estructural;
2. suite API completa;
3. `tsc --noEmit` API;
4. `nest build` API;
5. suite y `tsc` web para descartar regresiones compartidas.

Entrega commits pequeños en este orden: producción, fixture/pruebas, documentación, y **último commit solo con las 28 excepciones retiradas**. En `ENTREGA_CLAUDE_OBSERVER.md` incluye rutas una por una, antes/después, defectos raíz, cambios de comportamiento, Bloque 4, comandos/resultados, prueba de mutación, lista exacta de ficheros y “Qué NO cubre”.

No declares Edusyn blindado. Puedes declarar `observer` cerrado en aplicación solamente si las 28 rutas, los servicios, PDF, identidades de estudiante, relaciones cruzadas, atomicidad y HTTP quedan probados. PostgreSQL/RLS, datos reales, rendimiento y permisos finos inventariados quedan fuera.

