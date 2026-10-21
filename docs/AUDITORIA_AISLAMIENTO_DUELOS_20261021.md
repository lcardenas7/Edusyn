# Duelos — aislamiento HTTP y relaciones institucionales

Fecha: 2026-10-21. Base staging `895a08d6`; worktree `blindaje-duelos-http`, rama `codex/blindaje-duelos-http-20261021`. Incluye el candidato de bancos anterior, sin alterar el directorio principal con WIP.

## Alcance

Once rutas de `DuelController`: dashboard, estado, ranking, perfil, habilitación de fuentes, invitación, consulta, aceptación, rechazo, respuesta y ayuda. Todas resuelven `requireInstitutionId` directamente antes de construir el actor. SuperAdmin debe elegir un destino existente y sigue sujeto a matrícula/participación; el rol institucional llamado SUPERADMIN no equivale al claim global.

Main tiene una implementación anterior de Duelos con ocho rutas. No se copia este servicio completo a producción ni se incorporan por accidente las funcionalidades adicionales de staging. La revisión remota encontró además `main` en `49679653` (incluye corrección móvil `649bf7c1`, posterior a `a403b4fe`); se conserva. La promoción futura debe partir del main actualizado, adaptar solamente el blindaje y revisar la sincronización de ese fix de interfaz hacia staging por separado.

## Correcciones

- La bolsa de preguntas filtra la institución de cada pregunta anidada del banco, además de la colección y el grado.
- `duelScope` exige coincidencia institucional de duelo, aula/asignación/año/grupo/campus/grado/área y de ambas matrículas/estudiantes/año/grupo. Se aplica a consulta, dashboard, estado, rankings, perfiles, disponibilidad y revalidaciones transaccionales. No exige que el rival histórico siga activo para poder consultar un resultado.
- Respuestas y ayudas se filtran por institución; la consulta del duelo solo considera las matrículas participantes. Los cálculos de rival dejan de tratar como rival a cualquier otra matrícula presente en una fila incoherente. El contador ligero de turno también filtra la institución de las respuestas.
- Aceptar/rechazar y expirar conservan el ámbito institucional en la escritura; aceptar exige también la matrícula invitada. Habilitar una fuente conserva aula e institución en la condición de actualización.
- Respuesta/ayuda vuelven a consultar las relaciones dentro de su transacción existente; sus conteos y cierre quedan acotados por institución/participantes. Se conserva el nivel Serializable y la traducción existente de colisiones a 409.

Los casos de relaciones incoherentes se construyen exclusivamente con datos sintéticos; no se inspeccionan ni se reparan bases de instituciones reales. No se afirma que estas filas existan en producción.

## Evidencia focal

122 pruebas aprobadas: 45 existentes de servicio y 77 nuevas HTTP. Con las pruebas del lote previo de bancos, el focal combinado queda en **4 suites / 238 pruebas aprobadas**. Se ejecutan estrategia JWT, guards, controlador, servicio y acceso institucional reales; Prisma es un adaptador sintético que evalúa filtros contra filas independientes y puede representar FKs cruzadas.

- Las once rutas: A→B/B→A con el mismo usuario en ambas instituciones, sin lectura secundaria sensible ni escrituras.
- JWT ausente/inválido/vencido, roles no autorizados, estudiante sin matrícula activa, docente no asignado y alumno no participante.
- Relaciones cruzadas de institución, estudiante, aula, año, grupo/campus; aulas personales o inexistentes.
- Pregunta actual sin clave, explicación ni IDs del banco; siguiente ronda válida después de responder, sin exposición de rondas posteriores. Se conserva la devolución de corrección de la pregunta ya contestada.
- Solo el invitado responde invitaciones; replay rechazado. Respuesta y ayuda pertenecen a la matrícula de sesión; body no puede imponer institución, matrícula ni corrección/puntuación.
- Listados y rankings/perfil excluyen duelos incoherentes; respuestas/ayudas ajenas no alteran el rival visible.
- Caso sintético cambia la relación del rival entre guarda exterior y transacción: respuesta rechazada antes de escribir.
- Estado ligero ignora respuestas de otra institución; rechazo válido solo modifica la invitación propia; expiración no muestra preguntas ni admite respuestas nuevas.

La fixture histórica `jugado` añade IDs explícitos de ambos participantes para representar la nueva selección; conserva todas las expectativas previas de victorias, derrotas, aciertos y rachas. Una aserción nueva se corrigió para aceptar que, tras responder la ronda 0, la ronda 1 pasa a ser la actual; se comprueba que la ronda 2 y la clave de la actual sigan ocultas.

Mutaciones verificadas y restauradas con `finally`: quitar el filtro anidado del banco produce dos fallos A/B; reducir la guarda compartida a `institutionId` produce seis fallos (relaciones de participantes, ranking y revalidación dentro de la transacción).

## Inventario y límites

Corte reproducible: **1.204 rutas, 416 directas, 689 excepciones pendientes, 66 no institucionales y 33 incumplimientos estructurales**, todos en `math-events.controller.ts`. No se añade ni se regenera ninguna excepción. La clasificación no acredita por sí sola aislamiento HTTP global ni 33 fugas confirmadas.

No cambia esquema, migraciones, bancos editoriales, reglas de puntos, duración, secuencias ni frontend. No se ejecutan importaciones, partidas o escrituras contra datos reales. Quedan PostgreSQL/RLS, contención/reintentos reales, revocación concurrente de matrículas/asignaciones y prueba de carga de los nuevos filtros. La prueba transaccional sintética no certifica esas propiedades en PostgreSQL.

## Publicación y siguiente paso

Tipos API aprobados; build y suite general en verificación al preparar este documento. La CLI de Railway respondió `Unauthorized. Please login with railway login`; no se pudo confirmar recuperación del incidente ni el servicio activo. No se atribuye a este lote un despliegue exitoso ni se cambia configuración/credenciales para sortearlo.

Resultado de la suite general final, sin excluir pruebas: **121 suites aprobadas / una fallida; 2.738 pruebas aprobadas / una fallida**. El único fallo es `institution-route-contract.spec.ts`, por las 33 rutas de Eventos pendientes ya medidas; reporte local `apps/api/coverage/duel-hardening-api.json`, `success: false`. No se declara la API global verde. El focal combinado de bancos y Duelos sí está verde (238/238), y los tipos API finales aprobaron.

El primer build Nest aprobó. Al repetirlo tras añadir el filtro del contador ligero, Windows falló al desvincular un archivo de `dist` (`UNKNOWN unlink`), antes de compilar; se reintenta sin modificar fuentes ni eliminar directorios manualmente. El resultado terminal se registra al cerrar este corte.

**Resultado terminal del build:** el reintento terminó con código 0; build Nest final aprobado. El fallo anterior de limpieza queda documentado y no se atribuye a un error de compilación. Sin migraciones ni conexión a bases reales.

Seguir con las 33 rutas de Eventos, manteniendo la separación de funciones exclusivas de staging. Antes de producción: verificar bancos/Duelos en staging, adaptar el lote a main actualizado, completar tipos API/web y comprobar Railway. Inclusión permanece pospuesta y se conserva la frontera EduLab. El blindaje global continúa parcial.
