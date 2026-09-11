# Encargo a Claude: aislamiento de learning-route, en paralelo con Plantillas

Fecha: 2026-09-11. Solicitado por el usuario. Estado: instrucciones preparadas; no implica que Claude haya iniciado trabajo.

## Objetivo y reparto

Audita y corrige íntegramente el aislamiento de `apps/api/src/modules/learning-route`, incluyendo `LearningRouteService` y `CompetencyEvidenceService`. Entrega pruebas A/B de servicios y HTTP y un documento de alcance. Astra continúa con `academic/templates`; Inclusión queda pospuesta, con pendientes en REGISTRO_DESPLIEGUES.md. No abras esos frentes.

Lee primero `docs/ENCARGO_BLINDAJE_ASTRA.md`, `docs/REGISTRO_DESPLIEGUES.md`, `docs/ESTADO_BLINDAJE.md` y `docs/AUDITORIA_AISLAMIENTO_RECUPERACIONES.md` desde el staging actualizado. Usa tu propio worktree y rama `codex/blindaje-learning-route-claude`, creada desde `origin/staging`. No uses el checkout ni la rama de Astra. No incluyas cambios ajenos ni archivos temporales.

## Archivos que te corresponden

- `apps/api/src/modules/learning-route/learning-route.controller.ts`
- `apps/api/src/modules/learning-route/learning-route.service.ts`
- `apps/api/src/modules/learning-route/competency-evidence.service.ts`
- Pruebas nuevas `*.spec.ts` dentro de ese directorio y fixtures exclusivos `apps/api/test/fixtures/learning-route*.ts`.
- `docs/AUDITORIA_AISLAMIENTO_LEARNING_ROUTE.md`, nuevo.
- `docs/ENTREGA_CLAUDE_LEARNING_ROUTE.md`, nuevo, con commits y verificación exacta para integrar.

Puedes ajustar `learning-route.module.ts` si es imprescindible. Si una firma cambia, busca sus llamadores; anota los externos con parche mínimo propuesto en tu entrega. No edites archivos compartidos o de otros módulos sin coordinarlo primero. En particular no modifiques `templates*`, Matrículas, APD, Classroom, R1, EduLab, esquema Prisma, migraciones, RLS ni APIs de IA compartidas.

## Trabajo, en este orden

1. Inventaría todas las rutas y sus operaciones Prisma. La base revisada contiene 16 declaraciones; vuelve a contarlas. Clasifica cada ruta como institucional, catálogo global comprobado o deuda pendiente, con evidencia. No supongas que una lectura de competencias o generación sin persistencia necesita tenant; demuestra sus dependencias.
2. En rutas institucionales, resuelve con `await requireInstitutionId(...)` de forma directa e incondicional. Usa el contexto del actor. No aceptes institución ni estudiante arbitrarios del cuerpo. Revisa especialmente `myProgress`: la matrícula del usuario hoy se busca sin filtro institucional y el progreso recibe un routeId ajeno.
3. Guardas compartidas en ambos servicios antes de lecturas secundarias, generación de contenido, escrituras o llamadas externas. Valida la cadena ruta → aula → institución; pasos → ruta; evidencias → estudiante/matrícula y actividad/competencia según las relaciones reales del esquema. Un recurso ajeno responde 404 igual que uno inexistente.
4. Añade contexto obligatorio a las firmas y a cada consulta posterior. Para tablas sin institutionId filtra por su relación institucional. Borrados con `deleteMany` acotado y comprobación de count. No deduzcas el actor del recurso que envía el cliente.
5. Inspecciona cuerpos `any`, actualizaciones masivas y creación desde planes generados. Usa lista explícita de campos editables para impedir reubicar registros o reemplazar FKs/institución. Valida referencias recibidas antes de persistir. Una operación compuesta debe revertirse completa si falla; conserva el comportamiento pedagógico legítimo.
6. Pruebas A/B en ambas direcciones con Prisma que aplique filtros reales, también de relaciones. Comprueba lo que NO ocurrió: sin colecciones sensibles, mutaciones ni llamadas de generación ante un identificador ajeno. Retirar la guarda debe hacer fallar una prueba. Casos legítimos deben seguir funcionando.
7. Añade laboratorio HTTP local con Nest, estrategia JWT y RolesGuard reales, dos colegios sintéticos y los roles que ya admiten las rutas. Simula exclusivamente persistencia y proveedores externos. No uses datos/cuentas reales ni llames proveedores de IA. Incluye lectura, alta, edición, eliminación, pasos, generación desde recurso y progreso según las rutas existentes.
8. Ejecuta tipos API/web, suite API completa, suite web y build Nest. Si aparecen fallos previos, documenta cómo los distinguiste; no debilites las aserciones ni silencies deuda para conseguir verde. No atribuyas a PostgreSQL/RLS lo probado con un doble.

## Contrato estructural y archivos compartidos

Actualización autorizada por Astra el 2026-09-11 tras la consulta de Claude: puedes modificar `apps/api/src/common/security/institution-route-exceptions.json` en un commit final separado, limitado a las entradas de learning-route que hayas auditado. Retira únicamente excepciones obsoletas por resolución directa; reclasifica catálogos globales solo con evidencia. No elimines automáticamente las 16 entradas. No edites `docs/ESTADO_BLINDAJE.md` ni `docs/REGISTRO_DESPLIEGUES.md`: Astra los integra.

En `ENTREGA_CLAUDE_LEARNING_ROUTE.md`, entrega la lista exacta de claves retiradas o reclasificadas, con motivo, y el hash del commit separado. La suite completa, incluido el contrato estructural, debe quedar en verde. No regeneres toda la lista. Indica también la fila propuesta para el estado del módulo y el registro de publicación.

## Decisiones de matrícula y errores autorizadas

Usa la matrícula ACTIVE del estudiante autenticado que corresponda a la institución y, cuando el modelo exponga esas relaciones, al año/grupo del aula de la ruta. No selecciones simplemente por createdAt descendente. Si varias matrículas compatibles identifican al mismo estudiante, usa esa identidad sin mezclar colegios. Una ambigüedad real que siga sin resolverse devuelve 409, documentado y probado; no inventes una prioridad temporal.

Sin matrícula compatible, devuelve 404 igual que ante un recurso ajeno. Sustituir el error genérico actual que termina en 500 es una corrección autorizada: documenta el cambio de comportamiento y añade el caso HTTP. Valida primero la pertenencia de la ruta al contexto del actor para no revelar recursos de otro colegio.

## Entrega e integración

No hagas push directo a `staging` ni a `main` mientras Astra mantiene esta entrega. Deja commits propios acotados y entrega los hashes, rama y ruta del worktree. Si trabajas en otra máquina, puedes publicar tu rama de trabajo para permitir integración, sin abrir ni promover cambios a producción.

Astra revisará el diff, actualizará las excepciones y documentos compartidos, integrará tus commits sobre el staging vigente y repetirá las verificaciones afectadas antes del push. Evita force, reset, amend o reescribir commits publicados. Un avance parcial debe quedar declarado parcial, con las rutas y operaciones restantes enumeradas.

La definición de terminado de este encargo exige inventario antes/después, todos los rechazos cruzados cubiertos, casos legítimos preservados y sección «Qué NO cubre». La autorización por asignación docente dentro del mismo colegio pertenece al Bloque 4: inventaría sus huecos sin inventar una política nueva.
