# Encargo a Astra — cerrar el blindaje de seguridad de Edusyn

Fecha: 2026-09-10 · Autor: Claude · Destinatario: **Astra**

> **Objetivo:** dejar el aislamiento multiinstitución de Edusyn **verificablemente cerrado**, para
> poder pasar a construir funcionalidad nueva sin arrastrar esta deuda.
>
> **No es un encargo de «revisar seguridad».** Es un encargo de auditar 36 módulos con un método
> concreto, corregir lo que aparezca, probarlo con dos instituciones, y dejarlo documentado de
> forma que el siguiente que llegue no tenga que repetir el trabajo.

---

# PARTE I · Contexto de Edusyn

## 1. Qué es y dónde está

Edusyn es una plataforma de gestión académica **multiinstitucional** para colegios colombianos.
**Está en producción, con colegios reales usándola.** No es un proyecto de laboratorio: lo que se
rompa, se rompe para un docente que está calificando.

| | |
|---|---|
| Monorepo | `apps/api` (NestJS 11 + Prisma) · `apps/web` (React 19 + Vite) · `packages/types` · `packages/ui` |
| Base de datos | PostgreSQL. **221 modelos**, de los cuales **126 llevan `institutionId`** |
| Despliegue | Railway. Rama **`staging`** → entorno de staging · rama **`main`** → **producción** |
| Migraciones | Se aplican solas en el arranque (`prisma migrate deploy`). Deploy SUCCESS = migración aplicada |

**Hoy `staging` va ~135 commits por delante de `main`.** Eso importa: lo que arregles en staging
no protege a nadie hasta que se promueva.

## 2. Quiénes trabajamos aquí

Tres agentes, en paralelo, sobre el mismo repositorio:

- **Astra** (tú) — has hecho la consolidación académica, el Observador, las actas, la identidad
  institucional.
- **Claude** — el rediseño del Aula Virtual, R1 (división de código), la consolidación de boletines,
  Valeria sin IA, y el blindaje del módulo de Recuperaciones que sirve de patrón para este encargo.
- **Kimi** — el programa de RLS multi-tenant a nivel de base de datos.

**Consecuencia práctica, y es importante:** `origin/staging` **se mueve mientras trabajas**. En una
sola sesión avanzó cuatro veces. Rebasa antes de subir, verifica otra vez, y **nunca fuerces**.

## 3. Las bitácoras — leer ANTES de tocar

Esto no es burocracia: es lo que evita reinvestigar lo mismo cada sesión.

| Documento | Para qué |
|---|---|
| `docs/REGISTRO_DESPLIEGUES.md` | **Append-only.** Qué se subió, cuándo, si llevaba migración. **Léelo antes de desplegar y añade fila después de cada push** |
| `docs/security/BITACORA-RLS.md` | El programa multi-tenant de base de datos. Línea de Kimi |
| `docs/AUDITORIA_AISLAMIENTO_RECUPERACIONES.md` | **El patrón a seguir.** Léelo entero antes de empezar |
| `docs/ESTADO_AULA_VIRTUAL.md` | Estado del Aula |
| `docs/PROPUESTA_ROL_ACUDIENTE.md` | Un hueco de permisos sin resolver, relacionado con esto |

---

# PARTE II · El estado real del blindaje, medido

No son estimaciones. Son cuentas hechas sobre el código de `origin/staging` el 2026-09-10.

## Capa 1 · Aislamiento en la aplicación

| | |
|---|---|
| Rutas del API | **1 108** |
| Resuelven la institución explícitamente | 731 |
| Solo con interceptor de clase | 38 |
| **Sin referencia visible** | **339 (30 %)** |
| Módulos auditados a fondo con pruebas A/B | **3 de 39** |

> **El 30 % es un techo, no un dato firme.** Calibrado con tres sondeos, el resultado fue dispar:
> `observer` marca 21 rutas «sin contexto» pero su servicio menciona `institutionId` 101 veces
> (falso positivo); `taller` marca 11 y su servicio lo menciona **cero** veces (hueco real);
> `edusyn-play` marca 36 pero es deliberadamente no dependiente de institución (no aplica).
>
> **Saber el número exacto exige auditar módulo por módulo. Ése es el encargo.**

## Capa 2 · RLS (base de datos) — **NO ES TUYA**

126 modelos con `institutionId`, 23 declaraciones `ENABLE ROW LEVEL SECURITY` en migraciones,
**5 verificadas realmente activas**. Deuda global `PARTIAL`. Paso 3 sin autorizar.

**Es la línea de Kimi. No la toques.** Ver Parte V.

## Capa 3 · Autorización dentro de la institución

Prácticamente sin cubrir. Que un docente solo pueda calificar **sus** grupos es una pregunta
distinta de que no vea otro colegio, y ninguna auditoría hecha la responde.

## Capa 4 · Verificación real

**Ninguna auditoría tiene reproducción HTTP cruzada.** Las 30 pruebas de Recuperaciones son
unitarias sobre los servicios: prueban la guarda, no la ruta completa con sesión, `RolesGuard` e
interceptor de tenant.

---

# PARTE III · El defecto que buscas

Antes del método, entiende **qué** buscas, porque no se ve en los datos.

```ts
// El patrón defectuoso, encontrado en los cuatro servicios de Recuperaciones:
const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId } })
// …
institutionId: enr.institutionId,   // ← la del ESTUDIANTE, no la del ACTOR
```

**La institución se deduce del recurso que nombró el cliente, no de quien hace la petición.** La
fila creada queda **coherente** —lleva la institución correcta del estudiante—, así que:

> **Ninguna auditoría de datos lo detecta. Hay que leer el código.**

### Las tres variantes que verás

1. **Sin nada.** `findMany({ where: { academicTermId } })` — sin institución en ninguna parte.
2. **Deducida del recurso.** El caso de arriba. El más peligroso, porque parece correcto.
3. **La peor: la que *parece* protegida.** `registerResult` y `reviewResult` **recibían**
   `institutionId`… y solo lo usaban para elegir las *reglas*; la recuperación se cargaba por id,
   sin acotar. **Recibir el parámetro no es usarlo.**

---

# PARTE IV · El método, módulo por módulo

Para **cada** módulo. Sin saltarte pasos, y en este orden.

## Paso 1 · Inventario

Lista cada ruta del controlador y marca si el *handler* resuelve la institución del actor. Después
**calibra**: si marca «sin contexto», mira si el servicio la resuelve. Distingue tres resultados:

- **hueco real** — ni el controlador ni el servicio;
- **falso positivo** — el servicio sí la resuelve;
- **no aplica** — el recurso no es de institución (Play, SuperAdmin).

## Paso 2 · Corregir, con estas seis reglas

1. **La institución la pone el actor.** El controlador la resuelve con `requireInstitutionId`. Si el
   cuerpo trae `institutionId`, se **ignora** y se escribe la del actor.
2. **Toda consulta la lleva en el `where`**, no solo la guarda previa. Una guarda que pasa y luego
   consulta sin filtro deja la puerta abierta desde otra ruta.
3. **`NotFoundException`, nunca `ForbiddenException`.** Un 403 confirma que el recurso existe. Un
   recurso ajeno debe ser **indistinguible de uno inexistente**.
4. **Borrado acotado:** `deleteMany({ where: { id, institutionId } })` en vez de
   `delete({ where: { id } })`. Si es ajeno no borra nada, y respondes como si no existiera.
5. **Ningún parámetro de institución opcional.** Una guarda que se puede omitir acaba omitiéndose.
6. **Una guarda por servicio, no una comprobación suelta por método.** `assertTermScope`,
   `assertEnrollmentScope`, `loadXInScope`. Todos los métodos entran por ahí.

## Paso 3 · Pruebas A/B — **escritas al revés de lo habitual**

Esto es lo que separa una auditoría de un maquillaje.

> **No pruebes que el caso legítimo funciona. Prueba que el cruzado se rechaza ANTES de leer o
> escribir nada.**

```ts
it('findByTerm: el período de B no existe para un actor de A', async () => {
  const { svc, prisma } = servicio(B)
  await expect(svc.findByTerm('term-1', undefined, A)).rejects.toBeInstanceOf(NotFoundException)
  expect(prisma.periodRecovery.findMany).not.toHaveBeenCalled()   // ← lo que NO ocurrió
})
```

Dos exigencias:

- **El doble de Prisma debe filtrar de verdad** por institución. Si devuelve siempre la fila, la
  prueba pasa aunque quites la guarda — y entonces no prueba nada.
- **Afirma sobre lo que no se llamó.** Devolver error no basta: hay que demostrar que no se
  consultó ni se escribió.

Cubre, por cada módulo: leer, crear, modificar, aprobar/rechazar, calificar, descargar y borrar.

## Paso 4 · Verificar

`npx tsc --noEmit` en `apps/api` y `apps/web` · suite completa · `nest build` · y **re-auditoría**:
volver a pasar el inventario del paso 1 y que dé **cero**.

## Paso 5 · Documentar

Un documento por módulo con: inventario antes/después, qué permitía cada hueco **en lenguaje
concreto** («permitía regenerar los boletines de otro colegio», no «faltaba validación»), qué se
hizo, y **qué NO cubre la auditoría**. Esa última sección es obligatoria.

## Paso 6 · Desplegar y registrar

Rebasa sobre `origin/staging`, vuelve a verificar, push, y **añade fila a
`docs/REGISTRO_DESPLIEGUES.md`**.

---

# PARTE V · Trabajo concreto, en orden

## Bloque 0 — La prueba estructural · **HAZLO PRIMERO**

Es lo más barato y lo que cambia la pendiente. Una prueba que recorra **todos** los controladores
del API y falle si aparece una ruta sin resolución de institución, con una **lista explícita de
excepciones justificadas** (Play, SuperAdmin, auth público, health).

Sin esto, cada módulo nuevo nace desprotegido y el trabajo se deshace solo.

**Criterio de aceptación:** añadir una ruta sin `requireInstitutionId` hace fallar la suite.

## Bloque 1 — Módulos que tocan datos académicos o personales

Por valor de riesgo, no por tamaño:

| Orden | Módulo | Rutas marcadas | Por qué primero |
|---|---|---|---|
| 1 | **`taller`** | 11/11 | Su servicio menciona `institutionId` **cero** veces. El hueco más limpio que se encontró |
| 2 | `academic/enrollment` | 14/17 | Matrículas: identidad del estudiante |
| 3 | `academic/templates` | 18/22 | Plantillas de boletín |
| 4 | `learning-route` | 14/16 | Rutas de aprendizaje |
| 5 | `attendance` | 9/10 | Asistencia |
| 6 | `evaluation/preventive-cuts` | 8/8 | Notas |
| 7 | `observer` | 21/28 | **Calíbralo primero**: probablemente falsos positivos |
| 8 | `classroom` | 29/98 | El más grande. Déjalo para cuando el método esté rodado |

## Bloque 2 — El resto

`elections`, `management-tasks`, `payments`, `areas`, y los demás hasta cubrir los 39 módulos.
`edusyn-play` y `superadmin`: **documenta por qué no aplican**, no los «arregles».

## Bloque 3 — Laboratorio A/B por HTTP

Lo que convierte «probado» en «demostrado». Dos instituciones sintéticas, sesiones reales de cada
rol, y peticiones cruzadas contra las rutas ya corregidas.

**Datos exclusivamente sintéticos.** Ver Parte VI.

## Bloque 4 — Autorización dentro de la institución

Solo cuando lo anterior esté cerrado. Que un docente solo pueda tocar **sus** grupos y asignaciones.
Es otro eje y merece su propio encargo; aquí solo déjalo **inventariado**.

---

# PARTE VI · Reglas que no se negocian

## Datos

- **Producción es READ-ONLY ABSOLUTO.** No conectar, no consultar, no probar credenciales.
- **Staging es persistente, no desechable.** Hay datos que a alguien le importan.
- **No crees, edites ni borres datos reales para probar.** Solo datos sintéticos, en laboratorio
  local aislado.
- **Nunca imprimas un secreto.** Ni contraseñas, ni cadenas de conexión, ni tokens. Si generas
  ficheros de credenciales para el laboratorio, bórralos al terminar.

## Código

- **No borres código legado.** `Classroom.tsx` se queda, y `/aula-clasica` también.
- **No inicies la extracción de las pestañas del Aula Clásica.** Es un encargo aparte.
- **No toques R1** (división de código) ni la línea de EduLab.
- **Sin migraciones**, salvo que sean indispensables y estén justificadas explícitamente. El
  aislamiento de la capa de aplicación **no necesita ninguna**: las 126 tablas ya tienen
  `institutionId`.
- **Nada de `reset`, `--force`, ni reescribir historial.**

## RLS — la frontera con Kimi

**No abras una segunda línea de RLS.** Nada de crear funciones de contexto, cambiar ownership,
modificar políticas ni escribir migraciones correctivas de RLS.

Si encuentras un hallazgo de RLS: **documéntalo y entrégalo**, siguiendo el modelo de
`docs/security/HANDOFF-RLS-DESDE-CONSOLIDACION.md` — evidencia, no solución.

Y no confundas las dos capas: **RLS reproducible = FAIL** no significa **RLS actual = FAIL**.

## Trabajo compartido

- **Worktree aislado**, rama propia, commits acotados.
- **No subas commits ajenos.** Verifica qué se va en cada push.
- `origin/staging` se mueve: **rebasa, vuelve a verificar, y solo entonces sube**.

---

# PARTE VII · Qué entregar

1. **La prueba estructural** del Bloque 0, en verde y con excepciones justificadas.
2. **Un documento por módulo** auditado, con la sección «qué NO cubre».
3. **Filas en `docs/REGISTRO_DESPLIEGUES.md`** por cada push.
4. **Un `docs/ESTADO_BLINDAJE.md`** que sustituya a este documento como fuente de verdad: la
   tabla de 39 módulos con su estado, actualizada conforme avanzas. Es lo que permite responder
   «¿cuánto falta?» sin volver a contar.
5. **Un checkpoint final** con: rutas totales, cuántas resuelven institución, cuántas no y por qué,
   módulos auditados, pruebas A/B añadidas, y **los riesgos que quedan abiertos**.

## Cómo se sabe que está al 100 %

> La prueba estructural pasa · los 39 módulos tienen documento · el laboratorio A/B demuestra el
> rechazo cruzado por HTTP en las rutas corregidas · y `ESTADO_BLINDAJE.md` no tiene ninguna
> casilla en «pendiente» sin una justificación escrita.

**Mientras tanto, no digas «Edusyn está blindado».** Di qué módulos lo están y cuáles no. Esa
precisión es la que ha hecho que este programa avance sin engañarse.

---

## Nota final

Si algo de este encargo te parece técnicamente equivocado, **dilo**. Vale más una objeción temprana
que una auditoría que dé verde sin serlo. Y si un módulo resulta más grande de lo previsto,
párate y consulta antes que hacerlo a medias: **un blindaje parcial que se declara completo es peor
que no tenerlo**, porque nadie vuelve a mirarlo.
