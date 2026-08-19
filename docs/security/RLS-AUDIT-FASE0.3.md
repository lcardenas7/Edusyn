# RLS AUDIT — FASE 0.3
## Contención y plan de remediación

> **Continuación de** `RLS-AUDIT-FASE0.md`, `RLS-AUDIT-FASE0.1.md` y `RLS-AUDIT-FASE0.2.md`
> (los tres leídos íntegros; **ninguno modificado** — MD5 verificado al inicio y al final).
>
> **Esta fase es PLANIFICACIÓN.** No se rotó ninguna credencial, no se tocó Railway, no se
> modificó código, no se reescribió historial de Git, no se desplegó nada, no se ejecutó
> ninguna escritura en ninguna base de datos. **Ningún secreto se reproduce aquí.**
>
> **Fecha:** 2026-08-18 · **Rama:** `main` · Cambios ajenos en curso **no tocados**.

---

## 1. Resumen ejecutivo

Esta fase convierte los hallazgos de la 0.2 en planes ejecutables y **corrige al alza la
magnitud de una de las brechas**.

**La corrección más importante:** la Fase 0.2 contó **8 escrituras cross-tenant**. Esa cifra
era **incompleta**. El extractor solo detectaba `institutionId` cuando llegaba como
`@Query('institutionId')`, `@Param('institutionId')` o `@Body('institutionId')` — y **no veía
el caso más común: `institutionId` viajando dentro de un DTO** (`@Body() dto: CreateStudentDto`).

Repetido el análisis siguiendo también la herencia de DTOs:

| | Fase 0.2 | **Fase 0.3 (corregido)** |
|---|---|---|
| Handlers que reciben `institutionId` | 139 | 139 |
| Sin validación de tenant | 25 | **37** |
| **De ellos, escrituras** | **8** | **26** |
| Escrituras realmente explotables hoy | — | **20** |

De las 26: **1 es legítima** (`POST auth/login`), **5 son latentes** (piden roles `ADMIN` y
`COORDINATOR`, que **no existen** en el catálogo del sistema) y **20 son explotables hoy** por
usuarios autenticados normales.

El caso más grave no es el ya conocido de `capabilities`, sino **`guardians`**: ese controlador
no tiene **ni un solo `@Roles`**, y `RolesGuard` sin roles requeridos devuelve `true`. Cualquier
usuario autenticado —incluido un **estudiante** o un **acudiente**— puede crear y listar
acudientes, con datos personales, **en cualquier institución**.

Todo lo demás confirma la 0.2: la credencial de producción publicada sigue siendo la viva, los
secretos JWT/R2 son comunes a staging y producción, y ambos entornos escriben en el **mismo
bucket** donde viven los backups.

**Veredicto (§16): NO.** No podemos empezar a diseñar RLS.

---

## 2. Credencial PostgreSQL de producción · FASE 0.3-A

### 2.1 Identificación (sin revelar el valor)

| Campo | Dato |
|---|---|
| Tipo | Contraseña del rol `postgres` |
| Privilegios | `SUPERUSER`, `BYPASSRLS`, owner de las 216 tablas |
| Entorno | **PRODUCCIÓN** |
| Estado | **Válida** (verificado en la Fase 0.2 por comparación de huella, sin autenticarse) |

> Conforme al encargo, **no se ha vuelto a calcular ni a mostrar** el valor ni su huella.

### 2.2 Consumidores — inventario exhaustivo

| Consumidor | Entorno | Archivo / configuración | Función | Acción necesaria |
|---|---|---|---|---|
| Railway · servicio `Postgres` | producción | vars `PGPASSWORD`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `DATABASE_PUBLIC_URL` | **Origen** de la credencial | **Rotar aquí** |
| Railway · servicio `api` | producción | var `DATABASE_URL` (host `postgres.railway.internal`) | Runtime de la API + `prisma migrate deploy` en cada arranque | **Actualizar** |
| GitHub Actions · `db-backup.yml` | producción | secreto `DATABASE_PUBLIC_URL` | `pg_dump` los días 1 y 15 | **Actualizar** |
| `scripts/fix-recovery-grades.ts:17` | producción | **literal en el código, versionado** | Script de corrección de notas (**escribe**) | **Sustituir por `process.env.DATABASE_URL`** |
| `docs/RBAC_OBSERVATION_SPRINT.md:38,149` | producción | **literal en documentación, versionado** | Ejemplos de consultas de monitorización | **Eliminar el secreto** |
| Historial de Git | — | 2 commits (§9) | — | Ver §9 |
| Puestos de desarrollo | — | copias locales, historial de terminal, `$env:` | — | **Verificar y purgar** |
| Esta sesión de auditoría | — | memoria del proceso, ya finalizada | Consultas de solo lectura | Ninguna |
| `apps/api/.env` (local) | local | apunta a `localhost` | Desarrollo | **Ninguna** (correcto y en `.gitignore`) |
| `apps/api/scripts/diagnose-evidence-orphans.ts` | — | comentario con marcador `postgresql://…` | Documentación de uso | Ninguna |

**No hay más consumidores.** Verificado: `new PrismaClient()` no aparece en `apps/api/src/`;
los 54 scripts que lo instancian leen `DATABASE_URL` del entorno, salvo el caso literal citado.

### 2.3 PLAN DE ROTACIÓN — REQUIERE AUTORIZACIÓN

**No ejecutado. Ningún paso se ha iniciado.**

| # | Paso | Detalle | Reversible |
|---|---|---|---|
| 1 | **Ventana de mantenimiento** | Rotar reinicia las conexiones activas: la API fallará hasta el paso 3. Elegir horario de baja actividad escolar | — |
| 2 | **Preparar la nueva credencial** | Generarla en el servicio `Postgres` de Railway. **No** copiarla a ningún fichero | Sí |
| 3 | **Actualizar consumidores** | Orden estricto: (a) var `DATABASE_URL` del servicio `api`; (b) secreto `DATABASE_PUBLIC_URL` de GitHub Actions | Sí |
| 4 | **Verificar conectividad** | (a) arranque de `api` sin errores; (b) `prisma migrate deploy` sin migraciones pendientes; (c) login real; (d) `workflow_dispatch` manual del backup | — |
| 5 | **Revocar la anterior** | Implícito al rotar en el paso 2 | **No** |
| 6 | **Retirar del árbol de trabajo** | `fix-recovery-grades.ts` → `process.env.DATABASE_URL`; eliminar la cadena de `RBAC_OBSERVATION_SPRINT.md` | Sí |
| 7 | **Historial de Git** | Decisión aparte (§9). Tras el paso 5 la credencial del historial queda **inerte** | — |
| 8 | **Verificar que no quedan copias funcionales** | Repetir el barrido de `rlwy.net` sobre el árbol; comprobar que ningún workflow ni script conserva literales | Sí |
| 9 | **Auditar uso** | Revisar en Railway conexiones a la base de producción en busca de orígenes no reconocidos. *Limitación:* sin `log_connections` activo, la evidencia histórica puede no existir | — |

**Punto de no retorno:** el paso 5. Antes de él todo es reversible.

**Riesgo si NO se rota:** cualquiera con acceso al repositorio (o a un fork, o a un clon
antiguo) tiene acceso de **escritura como superusuario** a los datos académicos de 5
instituciones reales, sin pasar por la aplicación. **RLS no protege contra esto**: un
superusuario con `BYPASSRLS` ignora toda política.

---

## 3. Secretos compartidos staging ↔ producción · FASE 0.3-B

### 3.1 Qué consume cada secreto (verificado en el código)

| Secreto | ¿Compartido? | Consumidores reales en el código | Funcionalidad dependiente |
|---|---|---|---|
| `JWT_SECRET` | 🔴 **Sí** | `auth.module.ts:18`, `jwt.strategy.ts:22`, `live-session.controller.ts:32`, `play.controller.ts:29`, `edusyn-play.module.ts:38` | **Toda** la autenticación + auth del SSE por query param |
| `JWT_ACCESS_SECRET` | 🔴 Sí | **ninguno** | ⚠️ **Variable muerta** |
| `JWT_REFRESH_SECRET` | 🔴 Sí | **ninguno** | ⚠️ **Variable muerta** (no hay refresh token implementado) |
| `R2_SECRET_ACCESS_KEY` | 🔴 Sí | `storage.service.ts` | Todo el almacenamiento de ficheros **y los backups** |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 Sí | **ninguno** | ⚠️ **Variable muerta** — `supabase-storage.service.ts` es solo una fachada sobre R2 |
| `SUPABASE_URL` | Sí | **ninguno** | ⚠️ Variable muerta |

**Hallazgo colateral:** **tres de los cinco secretos compartidos no los usa nadie.**
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` están definidos en
Railway pero no se referencian en ninguna parte del código. Eliminarlos es **coste cero y
riesgo cero**, y reduce la superficie de exposición sin ninguna ventana de mantenimiento.

### 3.2 Configuración JWT — datos exactos pedidos

| Aspecto | Valor real |
|---|---|
| **Issuer (`iss`)** | ❌ **No se emite ni se valida** |
| **Audience (`aud`)** | ❌ **No se emite ni se valida** |
| **Algoritmo** | HS256 (por defecto; **no está fijado explícitamente**) |
| **Access token** | Único token. Claims: `sub`, `email`, `roles`, `institutionId`, `isSuperAdmin`, `institutionUserId`, `jti` |
| **Refresh token** | ❌ **No existe** |
| **TTL** | SuperAdmin 2 h · ADMIN_INSTITUTIONAL 4 h · COORDINADOR/RECTOR/DOCENTE 8 h · **ESTUDIANTE/ACUDIENTE 24 h** |
| **Revocación** | ❌ No implementada. `jti` se genera pero **no se comprueba**; el propio código lo documenta como pendiente |
| **Validación extra en `JwtStrategy`** | Ninguna: devuelve los claims tal cual, **sin consultar la base de datos** |

### 3.3 Consecuencia demostrada

**No existe ningún elemento en el token que distinga staging de producción.** Sin `iss`, sin
`aud`, sin comprobación contra la base de datos y con el **mismo `JWT_SECRET`**, un token
emitido por staging es **indistinguible** de uno de producción y será aceptado por la API de
producción durante su TTL (hasta 24 h para un rol de estudiante).

Su utilidad efectiva depende de si los identificadores coinciden entre entornos —lo que ocurriría
si staging se pobló alguna vez desde un volcado de producción—. **No se ha comprobado ni probado.**

> *Potencialmente explotable; pendiente prueba controlada en local/staging con datos ficticios.*

### 3.4 Impacto de rotar cada secreto

| Secreto | Impacto de rotarlo | ¿Invalida sesiones? |
|---|---|---|
| `JWT_SECRET` (prod) | Todos los usuarios deben volver a entrar; los SSE en curso se cortan | **Sí, todas** |
| `JWT_SECRET` (staging) | Solo afecta a staging | Sí (staging) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | **Ninguno** — variables muertas | No |
| `R2_SECRET_ACCESS_KEY` | Debe cambiarse en `api` y en el workflow de backup a la vez | No |
| `SUPABASE_SERVICE_ROLE_KEY` | **Ninguno** — variable muerta | No |

### 3.5 ¿Necesita staging estos accesos?

| Pregunta | Respuesta |
|---|---|
| ¿Staging necesita el **mismo bucket R2**? | **No.** Debe tener su propio bucket o, como mínimo, su propia credencial con alcance restringido |
| ¿Staging necesita `SUPABASE_SERVICE_ROLE_KEY`? | **No.** No lo usa nadie |
| ¿Staging necesita el mismo `JWT_SECRET`? | **No.** Es precisamente lo que rompe la frontera entre entornos |
| ¿Hay otros recursos compartidos? | Sí: `APD_AI_API_KEY` (misma clave de IA en ambos) y el propio proyecto de Railway |

### 3.6 Recomendación

Objetivo: **staging ≠ producción** en todo secreto.

Tres ventanas, de menor a mayor impacto:

1. **Ventana 0 — sin impacto:** eliminar `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` de ambos servicios. Nadie los usa.
2. **Ventana 1 — sin impacto en usuarios:** credencial R2 propia para staging (§4).
3. **Ventana 2 — con impacto:** `JWT_SECRET` distinto en staging. **Cierra todas las sesiones
   de staging**; producción conserva el suyo, así que los usuarios reales no se enteran.
   *Nota:* solo hace falta cambiar el de **staging** para romper la equivalencia. No es
   necesario tocar el de producción salvo que se sospeche compromiso.

**Mejora estructural recomendada aparte:** emitir y validar `iss` y `aud`, y fijar
`algorithms: ['HS256']` en la estrategia. Así, aunque un secreto se compartiera por error, un
token de staging sería rechazado por producción. **No implementado.**

---

## 4. R2 y backups · FASE 0.3-C

### 4.1 Arquitectura verificada (solo configuración; no se accedió a ningún objeto)

| Variable | `api` (producción) | `edusyn-api-staging` |
|---|---|---|
| `R2_BUCKET` | `edusyn-files` | **`edusyn-files`** — el mismo |
| `R2_ENDPOINT` | `9f9e…4a.r2.cloudflarestorage.com` | **el mismo** |
| `R2_ACCOUNT_ID` | `9f9e…4a` | **el mismo** |
| `R2_ACCESS_KEY_ID` | `ae96…59` | **el mismo** |
| `R2_SECRET_ACCESS_KEY` | huella X | **la misma** |

El propio código lo confirma: *«los antiguos "buckets" de Supabase ahora son prefijos de
carpeta dentro del único bucket de R2»* (`supabase-storage.service.ts`). **No hay separación
por entorno: ni bucket distinto, ni prefijo distinto, ni credencial distinta.**

Y el workflow de backup escribe en `s3://edusyn-files/backups/db/` — **el mismo bucket**.

### 4.2 Respuesta a las preguntas

| Pregunta | Respuesta |
|---|---|
| ¿Staging accede al bucket de producción? | **Sí — es el mismo bucket** |
| ¿Staging accede a los **backups** de producción? | **Sí**, con las mismas credenciales |
| ¿Staging accede a objetos de producción? | **Sí** — los ficheros conviven sin separación |
| ¿Staging tiene credenciales de producción? | Las de **R2**: sí, idénticas. Las de **PostgreSQL**: no (correctamente separadas) |
| ¿La clave R2 está limitada a un bucket o prefijo? | **No verificable** sin acceso al panel de Cloudflare. **No se probó** — habría exigido usar la credencial |

> No se descargó, modificó ni borró ningún objeto. La conclusión procede **exclusivamente** de
> comparar configuración.

### 4.3 Cambio necesario

```
ESTADO ACTUAL                          ESTADO OBJETIVO
─────────────                          ───────────────
edusyn-files/                          edusyn-files/            (solo producción)
├── boletines/     ← prod y staging    ├── boletines/
├── mensajes/      ← prod y staging    ├── mensajes/
└── backups/db/    ← alcanzable        └── backups/db/          (token propio, solo escritura)
                     desde staging
                                       edusyn-staging/          (bucket separado)
                                       └── …                    (token propio de staging)
```

Tres cambios, en orden de valor:

1. **Bucket propio para staging** con su **propio token de API**.
2. **Token exclusivo para el backup**, con permiso únicamente sobre `backups/db/` — así ni
   siquiera la API de producción puede borrar sus copias.
3. **Retención con bloqueo de objetos** en `backups/db/`, para que un borrado accidental o
   malicioso no elimine el historial.

**No ejecutado.**

---

## 5. Escrituras cross-tenant · FASE 0.3-D

### 5.1 Corrección del recuento de la Fase 0.2

La Fase 0.2 detectaba `institutionId` solo si llegaba como parámetro con nombre explícito.
**No veía los DTOs.** Repetido el análisis resolviendo también la herencia de clases DTO
(`CreateGuardianWithLinkDto extends CreateGuardianDto`, etc.):

**26 escrituras sin validación de tenant**, no 8. Desglose por explotabilidad real:

| Categoría | Nº | Detalle |
|---|---|---|
| **Legítima** | 1 | `POST auth/login` — pre-autenticación; el servicio valida la pertenencia |
| **Latente (no explotable hoy)** | 5 | `men-reports/*` — exigen roles `ADMIN` y `COORDINATOR`, que **no existen** en `SYSTEM_ROLES` |
| **Explotables hoy** | **20** | Detalle en §5.2 |

> **Sobre las 5 latentes:** `SYSTEM_ROLES` contiene `SUPERADMIN`, `ADMIN_INSTITUTIONAL`,
> `COORDINADOR`, `DOCENTE`, `ESTUDIANTE`, `ACUDIENTE`, `SECRETARIA`, `RECTOR`. Los nombres
> `ADMIN` y `COORDINATOR` no existen, así que `RolesGuard` solo deja pasar al SuperAdmin.
> **Es un error tipográfico que hoy actúa como protección.** Si alguien "corrige" esos nombres
> sin arreglar el tenant, se abren 5 brechas de golpe. **Debe corregirse en el mismo cambio.**

### 5.2 Las 20 escrituras explotables

| # | Endpoint | Origen de `institutionId` | Rol exigido | Escritura / tabla | Clase | Acción |
|---|---|---|---|---|---|---|
| 1 | `POST guardians` | `CreateGuardianDto` | **ninguno** | `guardian.create` — **PII** | 🔴 D | **A** |
| 2 | `POST guardians/with-link` | `CreateGuardianWithLinkDto` | **ninguno** | `guardian.create` + `studentGuardian` | 🔴 D | **A** |
| 3 | `POST students` | `CreateStudentDto` | `StudentsGuard` | `student.create` — **PII de menores** | 🔴 D | **A** |
| 4 | `PUT capabilities/matrix/:institutionId` | param | ADMIN | `institutionRoleCapability.upsert` — **autorización** | 🔴 D | **A** |
| 5 | `POST capabilities/matrix/:institutionId/reset` | param | ADMIN | reset de la matriz | 🔴 D | **A** |
| 6 | `POST academic-years` | `CreateAcademicYearDto` | ADMIN | `academicYear.create` | 🔴 D | **A** |
| 7 | `PUT academic-years/:yearId` | `Partial<CreateAcademicYearDto>` | ADMIN…SECRETARIA | `academicYear.update` | 🔴 D | **A** |
| 8 | `POST campuses` | `CreateCampusDto` | ADMIN | `campus.create` | D | **A** |
| 9 | `POST student-documents` | `CreateDocumentDto` | ADMIN/COORD/SECRE | `studentDocument.create` | D | **A** |
| 10 | `POST achievements/config/:institutionId/templates/defaults` | param | ADMIN/COORD | plantillas de juicios | D | **A** |
| 11 | `POST achievements/config/:institutionId/observation-templates/defaults` | param | ADMIN/COORD | plantillas de observación | D | **A** |
| 12 | `POST institutional-documents` | `@Body('institutionId')` | ADMIN/COORD | `institutionalDocument.create` + R2 | D | **A** |
| 13 | `POST evaluation-components` | `CreateEvaluationComponentDto` | ADMIN/COORD | `evaluationComponent.create` — **afecta a notas** | 🔴 D | **A** |
| 14 | `POST performance-scale/upsert` | `UpsertPerformanceScaleDto` | ADMIN/COORD | `performanceScale` — **escala de calificación** | 🔴 D | **A** |
| 15 | `POST management-tasks/leaders` | `CreateLeaderDto` | ADMIN/COORD/RECTOR | `managementLeader.create` | D | **A** |
| 16 | `POST management-tasks` | `CreateTaskDto` | + DOCENTE | `managementTask.create` | D | **A** |
| 17 | `POST payments/concepts` | `CreatePaymentConceptDto` | ADMIN | `paymentConcept.create` — **finanzas** | 🔴 D | **A** |
| 18 | `PUT payments/events/:id` | `CreatePaymentEventDto` | ADMIN/COORD | `paymentEvent.update` — **finanzas** | 🔴 D | **A** |
| 19 | `POST storage/upload/gallery` | `@Body('institutionId')` | ADMIN/COORD | escritura en R2 bajo otra institución | D | **A** |
| 20 | `POST storage/upload/announcement` | `@Body('institutionId')` | ADMIN/COORD | ídem | D | **A** |

**Clasificación pedida (A–E), caso por caso: las 20 son de clase A** — *deben usar el tenant
del JWT*. Ninguna es legítimamente cross-tenant, ninguna requiere quedar restringida a
SuperAdmin, ninguna necesita rediseño. El SuperAdmin ya está cubierto por el paso 2 de
`resolveInstitutionId()`, que **sí** le permite indicar `institutionId` explícito.

**Excepción a estudiar (clase E):** en 12, 19 y 20 podría eliminarse `institutionId` del
request por completo, ya que solo se usa como prefijo de ruta en R2 y puede derivarse del JWT.

### 5.3 El caso `guardians` merece destacarse

`guardians.controller.ts` tiene `@UseGuards(JwtAuthGuard, RolesGuard)` y **cero `@Roles`** en
todo el fichero. `RolesGuard` devuelve `true` cuando no hay roles requeridos. Por tanto,
**cualquier usuario autenticado** —incluido un `ESTUDIANTE` o un `ACUDIENTE`, cuyos tokens duran
24 h— puede crear y listar acudientes, con nombre, documento y teléfono, **en cualquier
institución**. Es la combinación más accesible de todo el conjunto.

> *Potencialmente explotable; pendiente prueba controlada. No se ha probado contra ningún entorno.*

### 5.4 Advertencia sobre aplicar `resolveInstitutionId()` "en bloque"

El encargo pedía no aplicarlo ciegamente. Dos matices reales:

- **No basta con sustituir la fuente.** En 12 de los 20 casos el `institutionId` viaja dentro de
  un DTO que después se pasa entero al servicio. Hay que **sobrescribir el campo del DTO** con
  el valor resuelto; si solo se resuelve una variable local y el servicio sigue leyendo
  `dto.institutionId`, la corrección es cosmética.
- **`resolveInstitutionId` arrastra dos defectos conocidos** (Fase 0.2 §2.3): el paso 4 usa
  `findFirst` sin `orderBy`, y el paso 1 acepta `isSuperAdmin` si el array `roles` del JWT
  contiene la cadena `'SUPERADMIN'`. Conviene endurecer el helper **antes** de extender su uso
  a 20 endpoints más.

---

## 6. Capabilities · FASE 0.3-E

### 6.1 Respuestas exactas

| Pregunta | Respuesta |
|---|---|
| ¿Quién puede llamarlo hoy? | Cualquier usuario con rol `SUPERADMIN` o `ADMIN_INSTITUTIONAL`, de **cualquier** institución |
| ¿Qué rol tiene? | `@Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')` |
| ¿Qué tenant debería poder modificar? | **Solo el suyo** (SuperAdmin: cualquiera, explícitamente) |
| ¿Hay algún uso legítimamente cross-tenant? | **No**, salvo el SuperAdmin, que `resolveInstitutionId()` ya contempla |
| ¿Cómo se usa `institutionId`? | Del `@Param` va intacto al servicio y de ahí a la clave compuesta del `upsert` |
| ¿Qué ocurre si un admin de A ataca a B? | **La operación tiene éxito.** No hay comparación con el JWT; `TenantGuard` está inerte; `RolesGuard` solo mira *qué rol* tiene, no *sobre qué institución* actúa |

### 6.2 Por qué es el peor de los 20

`InstitutionRoleCapability` no son datos de negocio: es **la tabla que decide qué puede ver y
hacer cada rol**. Escribir en ella es modificar la configuración de autorización de otro colegio
— por ejemplo, habilitar a `ESTUDIANTE` una capacidad reservada a `RECTOR`. Es una **escalada de
privilegios cross-tenant**, no una fuga de datos.

Además es **silenciosa**: no hay auditoría de estos cambios y la matriz se lee después desde
caché.

### 6.3 Corrección mínima propuesta — NO IMPLEMENTADA

Resolver el tenant en los tres endpoints y **descartar el parámetro de la URL** salvo para
SuperAdmin, reutilizando el patrón que ya protege a 102 endpoints:

```ts
// Esquema conceptual. NO aplicado.
@Put('matrix/:institutionId')
@Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
async updateCapabilityMatrix(@Request() req, @Param('institutionId') institutionId, @Body() body) {
  const target = await requireInstitutionId(this.prisma, req, institutionId);
  //  → SuperAdmin: usa el de la URL · Admin: usa SIEMPRE el del JWT
  await this.capabilitiesService.updateCapabilityMatrix(target, body.updates);
}
```

**Superficie:** 3 endpoints de un fichero (`GET`, `PUT`, `POST reset`), sin cambios de esquema
ni de contrato — la URL sigue igual; cambia solo qué valor se honra.

**Verificación posterior exigida:** prueba en local con dos instituciones ficticias
demostrando que un admin de A recibe `403`/actúa sobre A al invocar la ruta de B.
**No se ha probado contra producción ni staging.**

---

## 7. `live-session.cron` · FASE 0.3-F

### 7.1 Comportamiento exacto

| Elemento | Detalle |
|---|---|
| Frecuencia | cada 5 minutos |
| Consulta | `$queryRaw`: `SELECT id FROM "LiveSession" WHERE id = ANY($1) AND status IN ('ACTIVE','WAITING')` |
| Entrada | los `sessionId` de los streams SSE vivos en memoria |
| Significado de "0 filas" hoy | "ninguna de estas sesiones sigue activa en la base de datos" |
| Acción | para cada sesión no devuelta → `cleanupStream(sessionId)` → `subject.complete()` + borrado del `Map` |
| Efecto sobre el usuario | **el stream SSE se cierra**: el alumno deja de recibir preguntas |
| Segunda condición | también limpia si el stream tiene más de 2 h |

### 7.2 Qué pasaría con RLS

El cron corre **fuera de toda petición**: no hay `app.current_institution`. Con RLS activo y
sin contexto, la consulta devolvería **0 filas siempre**. `activeIds` quedaría vacío y **todos**
los streams se considerarían terminados.

**Resultado: cada 5 minutos se cerrarían todas las sesiones en vivo del sistema**, en clase,
sin un solo error en los registros. El cron incluso informaría de su éxito
(`Cleaned N orphaned SSE streams`).

> Este es el ejemplo canónico del patrón peligroso: **"ausencia de filas" interpretada como
> "hecho de negocio confirmado"**. Cuando RLS filtra, esa inferencia se invierte.

### 7.3 Protección de diseño propuesta — NO IMPLEMENTADA

Tres capas, de más a menos importante:

1. **No inferir el fin de una sesión a partir de una ausencia.** Consultar explícitamente el
   estado y actuar solo sobre `status IN ('FINISHED','CANCELLED')`. Si una sesión **no aparece**,
   eso ya no significa "terminada", sino "no visible" → **no tocar**.
2. **Fail-safe explícito ante falta de contexto.** Si el proceso no tiene tenant, debe
   **abortar con un error visible**, nunca continuar. Una guarda del tipo "si esperaba N
   sesiones y la consulta devuelve 0, algo va mal → registrar error y no limpiar".
3. **Contexto de tenant para los procesos de fondo**: iterar por institución, o un rol de
   servicio explícito. Se decidirá en la Fase 4 (diseño de bypass).

**Obligatorio:** este cron entra en la batería de pruebas de RLS (Test 14 de la Fase 0.1), con
un caso específico: *"con RLS activo y sin contexto, el cron NO debe cerrar ningún stream"*.

---

## 8. Railway · FASE 0.3-G

### 8.1 Estado (verificado, sin secretos)

Un único environment, `production`, con seis servicios: `api` + `Postgres` (producción),
`edusyn-api-staging` + `edusyn-staging-db` (staging), y las dos webs.

**Lo que sí está bien:** las bases de datos están separadas y con credenciales distintas —
la API de staging **no** apunta a producción.
**Lo que no:** un solo environment, secretos compartidos y un solo bucket R2.

### 8.2 Comparación de alternativas

| Criterio | **A** · Environments separados | **B** · Mismo environment, aislar servicios | **C** · Proyecto Railway independiente |
|---|---|---|---|
| Seguridad | Alta | Media | **Muy alta** |
| Coste | Igual | Igual | Posible proyecto extra |
| Complejidad | Media (recrear servicios y variables) | **Nula** | Alta |
| Riesgo de despliegue accidental | Bajo — el CLI exige `--environment` | Medio — persiste | **Muy bajo** |
| Secrets | Se separan de forma natural | Hay que separarlos a mano | Separados por construcción |
| Networking | `*.railway.internal` por environment | Compartido hoy | Totalmente aislado |
| Backups | Un workflow por environment | Duplicar el workflow | Bucket propio |
| Dominios | Reasignar el de staging | Sin cambios | Reconfigurar todo |
| CI/CD | Rama → environment, natural | Rama → servicio, actual | Dos pipelines |
| Rollback | Por environment | Por servicio | Independiente |

### 8.3 Recomendación

**B ahora + A antes de la Fase 9.** B es gratis y aplicable hoy: protocolo obligatorio de
`--service` explícito, verificación de `current_database()` y host antes de cada operación, y
separación de los secretos de §3. A es la solución correcta, y debe estar hecha **antes** de
empezar a crear roles y políticas en staging, que es cuando el riesgo de equivocar el destino
se vuelve material.

**C** solo si más adelante se decide aislar también el almacenamiento a nivel de cuenta.

**No se ha modificado Railway.**

---

## 9. Historial de Git · FASE 0.3-H

### 9.1 Alcance (sin reproducir ningún secreto)

| Dato | Valor |
|---|---|
| Commits que **introducen** la credencial | **2** |
| `2e52ceac` | 2026-03-03 · `docs: add RBAC observation sprint checklist…` → `docs/RBAC_OBSERVATION_SPRINT.md` |
| `75f4572c` | 2026-03-14 · `fix: Use PeriodFinalGrade as override…` → `scripts/fix-recovery-grades.ts` |
| Ficheros afectados | 2 |
| Tipo de secreto | contraseña de PostgreSQL de producción (la misma en ambos) |
| ¿Aparece en varios commits? | Sí, en 2 introducciones; los ficheros se tocan en 5 commits en total |
| ¿Nunca se eliminó? | Correcto: **sigue presente en `HEAD`** |
| ¿Otros secretos similares en el historial? | No se detectaron otras cadenas de conexión con credenciales. `apps/api/.env` **nunca** se versionó (`.gitignore` correcto desde el inicio) |

### 9.2 Plan de limpieza — REQUIERE AUTORIZACIÓN EXPLÍCITA

**No ejecutado. No se ha hecho `filter-repo`, ni reescritura, ni `force-push`.**

El orden importa y es contraintuitivo:

1. **Primero rotar** (§2.3). Una vez rotada la contraseña, la del historial queda **inerte**:
   deja de ser un secreto y pasa a ser una cadena histórica sin valor.
2. **Después decidir** si además se limpia el historial. Evaluación:

| Opción | A favor | En contra |
|---|---|---|
| **No limpiar** (recomendada) | Coste cero. Tras la rotación no hay riesgo residual | La cadena permanece visible en el historial |
| **`git filter-repo`** | Elimina el rastro | Reescribe **todos los hashes**; afecta a **30+ ramas** locales y remotas; obliga a que todos re-clonen; rompe referencias en PRs e issues; requiere `force-push` |

**Recomendación: no reescribir el historial.** El beneficio marginal tras la rotación no
justifica el riesgo de reescribir un repositorio con más de treinta ramas activas y trabajo
concurrente en curso. Si por política se exige la limpieza, debe hacerse en una ventana
dedicada, con todas las ramas fusionadas o respaldadas, y **nunca** durante esta auditoría.

---

## 10. Dependencias entre cambios

```
                    ┌──────────────────────────────────────┐
                    │ 1. ROTAR CREDENCIAL DE PRODUCCIÓN    │  ← sin dependencias
                    └──────────────┬───────────────────────┘
                                   │ habilita
                    ┌──────────────▼───────────────────────┐
                    │ 2. Limpiar literales del árbol       │
                    │    (fix-recovery-grades, docs)       │
                    └──────────────┬───────────────────────┘
                                   │ deja inerte
                    ┌──────────────▼───────────────────────┐
                    │ 9. (Opcional) limpieza de historial  │
                    └──────────────────────────────────────┘

┌───────────────────────────┐   ┌──────────────────────────────┐
│ 3. Borrar secretos muertos│   │ 4. JWT_SECRET propio staging │
│    (coste cero)           │   │    (cierra sesiones staging) │
└───────────────────────────┘   └──────────────┬───────────────┘
                                               │ requiere para ser útil
                                ┌──────────────▼───────────────┐
                                │ 5. iss/aud + algoritmo fijado│
                                └──────────────────────────────┘

┌───────────────────────────┐   ┌──────────────────────────────┐
│ 6. Bucket R2 para staging │──▶│ 7. Token de backup restringido│
└───────────────────────────┘   └──────────────────────────────┘
                                               │ prerrequisito de
                                ┌──────────────▼───────────────┐
                                │ 12. Trabajo de RLS en staging│
                                └──────────────────────────────┘

┌────────────────────────────────────────┐
│ 8a. Endurecer resolveInstitutionId()   │  ← PRERREQUISITO
└──────────────┬─────────────────────────┘
               │ antes de
┌──────────────▼─────────────────────────┐
│ 8b. Corregir las 20 escrituras         │
│     + los 5 nombres de rol de men-reports│
└──────────────┬─────────────────────────┘
               │ recomendable antes de
┌──────────────▼─────────────────────────┐
│ 10. Arreglar TenantGuard (orden guards)│
└────────────────────────────────────────┘

┌───────────────────────────┐   ┌──────────────────────────────┐
│ 11. Environment staging   │──▶│ 13. Igualar PG 18.4 → 17.x   │
└───────────────────────────┘   └──────────────────────────────┘
```

**Dependencias no evidentes:**

- **8a antes que 8b.** Extender a 20 endpoints un helper con dos defectos conocidos multiplica
  esos defectos por veinte.
- **Los 5 nombres de rol de `men-reports` van en el mismo cambio que 8b.** Corregirlos por
  separado convertiría 5 endpoints latentes en 5 brechas activas.
- **4 sin 5 es frágil.** Separar `JWT_SECRET` resuelve el problema de hoy; sin `iss`/`aud`,
  cualquier futuro despiste vuelve a abrirlo.
- **13 después de 11.** Cambiar la versión de PostgreSQL de staging implica recrear el servicio;
  hacerlo dos veces (una por la versión, otra por el environment) es trabajo duplicado.

---

## 11. Plan de contención

Orden **justificado por evidencia y dependencias**, no por gravedad nominal.

### P0 — Contención inmediata

| # | Acción | Por qué es P0 | Dependencia |
|---|---|---|---|
| 1 | **Rotar la credencial de PostgreSQL de producción** | Es la única brecha que da acceso **directo de escritura** a datos reales, saltándose toda la aplicación. Ninguna otra medida la mitiga | ninguna |
| 2 | Retirar los literales de `fix-recovery-grades.ts` y `RBAC_OBSERVATION_SPRINT.md` | Evita reintroducir la credencial nueva | tras 1 |
| 3 | **Eliminar los 4 secretos muertos** (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`) | **Coste cero, riesgo cero, impacto cero**: no los usa nadie. Reduce la superficie de inmediato | ninguna |
| 4 | **`JWT_SECRET` propio para staging** | Cierra la frontera de autenticación entre entornos. Solo afecta a sesiones de staging | ninguna |
| 5 | **Credencial R2 propia para staging** | Impide que staging alcance ficheros y **backups** de producción | ninguna |

> **Por qué la rotación va primero y no las escrituras cross-tenant:** las escrituras exigen un
> usuario autenticado con rol; la credencial expuesta no exige nada y otorga superusuario. Es un
> orden de magnitud más grave y su corrección es más rápida.

### P1 — Cierre de brechas de aplicación

| # | Acción | Por qué es P1 | Dependencia |
|---|---|---|---|
| 6 | Endurecer `resolveInstitutionId()` (`orderBy` determinista; no confiar en la cadena `'SUPERADMIN'` del array de roles) | Prerrequisito del 7 | — |
| 7 | Corregir **las 20 escrituras cross-tenant** + los 5 nombres de rol de `men-reports` | Explotables por usuarios autenticados normales | tras 6 |
| 8 | Corregir **`capabilities`** (dentro del 7, pero verificado aparte) | Es escalada de privilegios, no fuga de datos | tras 6 |
| 9 | Añadir `iss`, `aud` y fijar `algorithms: ['HS256']` | Hace estructural la separación entre entornos | tras 4 |
| 10 | Corregir `TenantGuard` (orden de guards) **con test de regresión** | Restaura la defensa genérica. Afecta a 103 controladores → requiere pruebas | tras 7 |
| 11 | Blindar `live-session.cron` contra "0 filas = terminada" | Hoy es latente; con RLS sería destructivo | — |

### P2 — Preparación del terreno para RLS

| # | Acción | Dependencia |
|---|---|---|
| 12 | Environment `staging` separado en Railway | — |
| 13 | Igualar staging a PostgreSQL 17.x | tras 12 |
| 14 | Token de backup restringido a `backups/db/` + retención con bloqueo | tras 5 |
| 15 | Backup propio de la base de staging | tras 12 |
| 16 | Evaluar PITR (`archive_mode`) en producción | — |

**Solo después:** Fase 1 (mapa de tenancy) y Fase 2 (diseño de `current_institution_id()`).

---

## 12. Cambios que REQUIEREN AUTORIZACIÓN

| # | Cambio | Entorno | Irreversible | Impacto en usuarios |
|---|---|---|---|---|
| 1 | Rotar la credencial de PostgreSQL | **producción** | Sí (paso 5) | Caída breve de la API durante la ventana |
| 2 | Actualizar el secreto de GitHub Actions | producción | No | Ninguno |
| 3 | Eliminar los 4 secretos muertos | ambos | No (se pueden volver a poner) | **Ninguno** |
| 4 | `JWT_SECRET` propio para staging | staging | No | Cierra sesiones **de staging** |
| 5 | Credencial y bucket R2 para staging | staging | No | Ninguno en producción |
| 6 | Modificar `resolveInstitutionId()` | código | No | Ninguno si se prueba |
| 7 | Corregir las 20 escrituras + roles de `men-reports` | código | No | Posible ruptura de integraciones que hoy dependan del comportamiento cross-tenant |
| 8 | Corregir `capabilities` | código | No | Ninguno esperado |
| 9 | Cambiar el orden de guards | código | No | **Alto**: afecta a 103 controladores |
| 10 | Crear un environment en Railway | infraestructura | No | Cambio de dominios de staging |
| 11 | Recrear staging en PostgreSQL 17 | staging | **Sí** (dump + restauración) | Staging no disponible durante la operación |
| 12 | Reescribir el historial de Git | repositorio | **Sí** | **Muy alto**: 30+ ramas, todos re-clonan |

## 13. Cambios que pueden hacerse después (sin bloquear RLS)

- Convertir `CreateAcademicYearDto` de `interface` a clase con `class-validator` (hoy el
  `ValidationPipe` no valida ese cuerpo).
- Definir `NODE_ENV=production` en el servicio `api`: hoy **no está definido**, así que
  `main.ts` arranca con el nivel de registro de desarrollo (`log`, `debug`, `verbose`) en
  producción.
- Índices sobre `institutionId` en las 35 tablas que carecen de él y FKs en las 13 que no las
  tienen (mejora el rendimiento **futuro** de RLS, no es prerrequisito).
- Rediseñar el SSE para varias réplicas (los `Subject` viven en memoria del proceso).
- Implementar revocación de tokens por `jti` (hoy se genera y no se comprueba).

---

## 14. Riesgos por entorno

| Acción | Local | Staging | Producción |
|---|---|---|---|
| Rotar credencial PostgreSQL | ninguno | ninguno | 🟠 caída breve; mitigable con ventana y verificación |
| Eliminar secretos muertos | ninguno | ninguno | 🟢 ninguno (sin consumidores) |
| `JWT_SECRET` propio en staging | ninguno | 🟠 cierra sesiones de staging | 🟢 ninguno |
| Bucket R2 para staging | ninguno | 🟠 ficheros previos quedan en el bucket antiguo | 🟢 ninguno |
| Corregir las 20 escrituras | 🟢 | 🟢 verificable | 🟠 podría romper flujos que hoy dependan del comportamiento actual |
| Corregir `capabilities` | 🟢 | 🟢 | 🟢 bajo |
| Cambiar el orden de guards | 🟢 | 🟠 requiere regresión completa | 🔴 alto sin pruebas |
| Blindar `live-session.cron` | 🟢 | 🟢 | 🟢 bajo |
| Environment de Railway | — | 🟠 cambio de dominios | 🟢 si se mueve solo staging |
| PostgreSQL 17 en staging | — | 🔴 recreación completa del servicio | 🟢 |
| Reescribir historial de Git | 🔴 todos re-clonan | — | — |

---

## 15. Criterios para considerar el incidente contenido

El incidente **no** estará contenido hasta que se cumplan **todos** estos puntos verificables:

- [ ] **C1** · La credencial de PostgreSQL de producción ha sido rotada, y la anterior ya no
      autentica (comprobado por el equipo, no por esta auditoría).
- [ ] **C2** · Ningún fichero del árbol de trabajo contiene una cadena de conexión con
      credenciales — barrido de `rlwy.net` limpio.
- [ ] **C3** · `JWT_SECRET` es **distinto** en staging y en producción.
- [ ] **C4** · Los 4 secretos muertos han sido eliminados de ambos servicios.
- [ ] **C5** · Staging usa una credencial R2 propia y **no** puede escribir en
      `edusyn-files/backups/db/`.
- [ ] **C6** · Las 20 escrituras cross-tenant resuelven el tenant desde el JWT, con pruebas
      automatizadas (A no puede escribir en B) en local **y** en staging.
- [ ] **C7** · Los 5 endpoints de `men-reports` tienen nombres de rol válidos **y** tenant
      resuelto (no uno sin lo otro).
- [ ] **C8** · `capabilities` verificado explícitamente: un admin de A no altera la matriz de B.
- [ ] **C9** · `live-session.cron` no cierra ningún stream cuando la consulta devuelve 0 filas.
- [ ] **C10** · Existe una prueba de regresión que falla si `TenantGuard` vuelve a quedar inerte.

**Criterios adicionales antes de tocar staging con RLS** (no son de contención, sino de
habilitación): environment separado, staging en PostgreSQL 17.x y backup propio de staging.

---

## 16. ¿Estamos listos para diseñar RLS?

# NO.

Mientras cualquiera de las brechas **P0** siga abierta, no.

Las razones, ordenadas por peso:

1. **La credencial de producción sigue publicada y viva.** Otorga `SUPERUSER` con `BYPASSRLS`.
   Diseñar políticas contra un atacante que entra como superusuario es diseñar una cerradura
   para una puerta que ya está abierta de par en par.
2. **Los secretos JWT siguen siendo comunes a staging y producción.** RLS parte de que el
   `institutionId` del token es cierto. Si un token de staging vale en producción, esa premisa
   —el cimiento entero del modelo— no se sostiene.
3. **Hay 20 escrituras cross-tenant explotables**, no 8 como creíamos. Son el fallo **primario**;
   RLS es la defensa en profundidad. Poner la segunda barrera antes que la primera invierte el
   orden correcto y da una falsa sensación de avance.
4. **La red de seguridad no está aislada.** Staging comparte bucket y credencial con los backups
   de producción, no hay PITR, y staging —donde vamos a experimentar— no tiene copia propia.
5. **Staging no es un ensayo válido:** PostgreSQL 18.4 frente a 17.10 y el mismo environment de
   Railway que producción.

**Lo que sí está listo y no bloquea:** el análisis del SSE (RLS no exige transacciones largas),
el mapa de tenancy de las 216 tablas, el diagnóstico del `TenantGuard` y el modelo de SuperAdmin
(8 de sus 12 operaciones no necesitan bypass).

**Próximo paso recomendado:** autorizar los cinco puntos **P0** de §11 —empezando por el 3, que
no tiene impacto alguno, y por el 1, que es el único con ventana de mantenimiento—. Una vez
verificados los criterios C1 a C5, volvemos a P1 y, con las brechas cerradas, entramos por fin
en la **Fase 1: mapa definitivo de tenancy**.

---

## 17. Qué NO se hizo en esta fase

No se rotó ninguna credencial, no se ejecutó `ALTER ROLE` ni `ALTER USER`, no se modificó
ninguna variable de Railway, no se crearon environments ni servicios, no se tocó ningún objeto
de R2 (ni lectura de contenido, ni descarga, ni borrado), no se reescribió el historial de Git,
no se hizo ningún `push`, no se modificó código de la aplicación, no se creó ninguna política,
función, rol o migración, no se desplegó nada y no se editó ningún documento anterior
—MD5 de las fases 0, 0.1 y 0.2 verificados sin cambios—.

No se intentó autenticarse con ninguna credencial expuesta ni se probó ninguna de las
vulnerabilidades identificadas contra ningún entorno. Todas las consultas a base de datos de
esta fase se limitaron a la base **local**, en modo `default_transaction_read_only`.

Los cambios ajenos en curso no fueron tocados. **Único archivo creado: este documento.**
