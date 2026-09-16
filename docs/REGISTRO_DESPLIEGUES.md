# Registro de despliegues — Edusyn

> **Bitácora append-only de todo lo que se envía a `staging` y `main` (producción).**
> Fuente de verdad compartida entre sesiones y agentes: antes de desplegar, **lee la tabla**;
> después de cada `push`, **añade una fila** (más reciente arriba). Así ninguna sesión tiene
> que reinvestigar qué se subió, cuándo y si llevaba migración.

## Cómo se despliega (mecánica, no repetir por sesión)

- **Railway** (proyecto `believable-forgiveness`, un solo environment con servicios separados):
  - **Producción:** servicios `api` + `Postgres` + web → despliega de la rama **`main`**.
  - **Staging:** `edusyn-api-staging` + `edusyn-staging-db` + `edusyn-web-staging` → despliega de **`staging`**.
- **Las migraciones se aplican solas en el deploy** (`startCommand` = `prisma migrate deploy && node main.js`).
  Deploy SUCCESS = migración aplicada. Si un cambio **no** trae migración, el `migrate deploy` es no-op (sin riesgo de BD).
- **Flujo limpio recomendado** (para no arrastrar WIP ajeno ni commits que no toquen a un entorno):
  1. Aislar el cambio en **un commit** (si el árbol tiene trabajo previo sin confirmar, no mezclarlo).
  2. **Staging:** `git push origin <rama>:staging` (o rebasar el commit sobre `origin/staging` si divergió).
  3. **Producción:** `git fetch origin main`; hacer **cherry-pick** del commit sobre `origin/main`
     (idealmente en un `git worktree` aislado para no tocar el árbol con WIP), typecheck, y `git push origin <rama-temp>:main`.
- **Verificación mínima antes de un push a `main`:** `npx tsc --noEmit` en `apps/api` y `apps/web`.
- ⚠️ Nunca desplegar WIP sin confirmar de otra persona sin avisar. Producción es real y con usuarios.

## Historial (más reciente arriba)

### Edusyn Crea + Autoevaluación del Aula — producción · 2026-09-16 · ✅ DESPLEGADO

> ** en ** (fast-forward desde ), autorizado por el usuario. API
> , web , preview , todos SUCCESS. Las 4 migraciones quedaron
> aplicadas (: al día). API y web respondieron 200 durante todo el
> despliegue. Servicio nuevo **** (rama , Railpack) con dominio
>  (CSP, CORP y Referrer-Policy verificadas);
>  fijada en  (respaldo previo fuera del repo). Verificado
> desde : el preview carga, ejecuta el proyecto y recibe el envío del formulario;
> el paquete publicado trae Crea, Autoevaluación y el origen del preview. Rutas nuevas: 401 sin
> sesión. **Pendiente:** recorrido con cuentas reales (docente y estudiante).
>
> ⚠️ Operación: la URL pública del servicio  tiene una contraseña vieja. Para
>  desde local usar las credenciales del  de  con el host
> público  y . La base de producción ya tenía
> , que no está en ;  lo tolera.

> **Estado original (antes del push):** preparada, sin push. Rama `deploy/crea-prod`, construida desde `origin/main` solo con el
> trabajo de Edusyn Crea y de Autoevaluación/Coevaluación del Aula (el mismo que está en staging
> hasta `fdf63a32`). Nada más de `staging` (195 commits ajenos) viaja en ella.

**Migraciones (4, todas aditivas):** `20260913010000_edusyn_construye_f1`,
`20260916010000_edusyn_crea_team_brief`, `20260917010000_edusyn_crea_session_note`,
`20260917020000_formative_evaluation`. Comprobado con `prisma migrate diff` desde el esquema de
`main`: el resultado equivale a las migraciones y no contiene ningún `DROP`; la de evaluación
formativa es idéntica byte a byte a la de staging.

**Diferencias con la rama de staging (por la forma de `main`):** sin la maqueta `/edusim/construye`
(Crea entra solo por el Aula); el cliente de Crea usa `lib/api.ts` (en `main` no existe
`lib/api/client`); las funciones de evaluación formativa van en el `classroomApi` de `lib/api.ts`.

**Verificación:** `tsc` api y web limpios, `prisma validate`, API 974/974, web 415/415, runner
117/117, `vite build` de web y runner.

**Pasos para desplegar (cuando el usuario lo autorice, tras revisar staging):**
1. Railway: crear el servicio del preview de producción (igual que `crea-preview-staging`: Railpack,
   `RAILPACK_BUILD_CMD` / `RAILPACK_START_CMD`, dominio propio) desde la rama `main`.
2. Fijar `VITE_CONSTRUYE_PREVIEW_ORIGIN` en el servicio `web` de producción con `--skip-deploys`.
3. `git push origin deploy/crea-prod:main` (fast-forward sobre `main`); la API aplica las 4
   migraciones al arrancar. Verificar `prisma migrate status`, `/api/health` y el Aula.
4. La generación con IA de rúbricas usa `APD_AI_*` (ya configurado en producción).

### Landing pública: primer despliegue a producción + 3 fixes — 2026-09-13

`main` (prod) en `be2ba5a7` — primera vez que la landing pública multipágina llega a producción
(hasta ahora solo estaba en `staging`). `staging` en `da3f9225` (mismo commit de fixes,
cherry-pickeado). Ambos en worktrees aislados (`worktrees/landing-production-20260913` para
main, `edusyn-wt-landing-deploy` para staging). Sin migración, solo `apps/web`.

- **Contexto:** otra sesión de Claude había aislado los 4 commits de la landing sobre `main` en
  `worktrees/landing-production-20260913` y encontrado 3 bugs reales durante la revisión, dejando
  las correcciones sin commitear. Esta sesión las verificó de forma independiente (no se confió
  en el reporte previo) antes de publicar.
- **Fix 1 — nav móvil ausente:** `PublicNav`/`LandingPage` — el menú (`hidden md:flex`) no tenía
  ningún reemplazo en pantallas angostas, dejando la navegación pública inaccesible en móvil.
  `LandingPage.tsx` ahora usa el `PublicNav` compartido, que agrega un botón de menú real con
  panel desplegable. Confirmado con clic real en el botón (JS) en viewport 375×812: el panel abre
  con los 6 enlaces.
- **Fix 2 — colores de módulo invisibles en build:** `Caracteristicas.tsx` construía las clases de
  Tailwind por interpolación (`` `from-${color}-500 to-${color}-600` ``), que el compilador no
  puede detectar de forma estática — en un build real esas clases no existen en el CSS generado.
  Se cambió a una clase completa literal por módulo. Confirmado: los 6 gradientes aparecen en el
  CSS del build de producción (`grep from-<color>-500 dist/assets/*.css` → 1 cada uno).
  Este bug lo introdujo esta misma sesión el 2026-09-12 al escribir `Caracteristicas.tsx`.
- **Fix 3 — anual por debajo del mínimo del plan:** `Precios.tsx` aplicaba el descuento de
  prepago anual (10/12) *después* de aplicar el piso (`minAnnual`), pudiendo mostrar un anual menor
  al mínimo publicado del plan. Ahora el piso se aplica sobre el valor ya descontado. Se agregó
  tope de estudiantes (1–100.000), leyenda "Tamaño orientativo / Mínimo anual" por plan, y
  atributos de accesibilidad. Confirmado con 10 estudiantes: los 4 planes caen en su piso exacto
  y ninguno muestra un "Ahorras..." falso.
- **Verificación independiente de esta sesión** (no solo confiar en el reporte de la sesión
  anterior): `npm install` en el worktree de producción, `npx tsc --noEmit` limpio, 182/182
  pruebas de `apps/web` (16/16 archivos), `npm --workspace apps/web run build` exitoso, grep del
  CSS generado confirmando los 6 degradados, y prueba manual en navegador (menú móvil real,
  mínimo anual real) antes de publicar.

### Fix: tarjetas de highlights encajonadas en la columna de texto — 2026-09-12

`staging` en `1b584024` (cherry-pick sobre `8d99d810`, mismo worktree aislado). Sin migración,
solo `apps/web/src/pages/LandingPage.tsx`.

- El usuario reportó, con captura de staging, que las 3 tarjetas ("Gestión integral", "Multirol",
  "Implementación rápida") se veían mal — quedaron anidadas dentro de la columna de texto
  (5/12) del ajuste anterior en vez de ocupar el ancho completo de la sección.
- Se movieron fuera del grid texto+imagen, a su propio bloque a ancho completo debajo, y se les
  agregó icono de color (`Layers`/`Users`/`Zap`), más padding y hover-lift.
- **Verificación:** `npx tsc --noEmit` en `apps/web` limpio; revisado visualmente a 1400px.

### Ajuste hero: imagen más grande, tarjetas menos invasivas — 2026-09-12

`staging` en `8cc159a5` (cherry-pick sobre `bf824c49`, mismo worktree aislado). Sin migración,
solo `apps/web/src/pages/LandingPage.tsx`.

- Feedback directo del usuario sobre el hero recién desplegado: la captura se veía muy chica y
  las tarjetas flotantes tapaban el contenido del reporte.
- Columna de la imagen: de `lg:grid-cols-2` (50/50) a `lg:grid-cols-12` con texto en 5/12 e imagen
  en 7/12.
- Tarjetas flotantes reposicionadas a las esquinas exteriores del marco (`-left-3 -top-3` /
  `-right-3 -bottom-3`, antes `top-1/4` / `bottom-1/4` que caía sobre el contenido), más pequeñas
  y con fondo blanco semitransparente (`bg-white/95 backdrop-blur`).
- **Verificación:** `npx tsc --noEmit` en `apps/web` limpio; revisado visualmente en el navegador
  a 1400px.

### Hero de landing con captura real y animación — 2026-09-12

`staging` en `3ab458a9` (cherry-pick sobre `5ed368c9`, mismo worktree aislado). Sin migración,
solo `apps/web`.

- Reemplaza el mockup ficticio de stat-cards del hero (`LandingPage.tsx`) por una captura real
  de Edusyn — institución demo (`ied-del-saber`, datos de prueba, nunca una institución real),
  reporte "Niveles por asignatura" (Bajo/Básico/Alto/Superior) — capturada con Playwright a
  1440x950 @2x contra el entorno local efímero. Asset: `apps/web/public/screenshots/hero-dashboard.png`.
- Las tarjetas flotantes (Notas actualizadas / Nueva notificación) ahora animan con `animate-float`
  / `animate-float-delayed` (keyframes nuevos en `index.css`), sin cifras ni reseñas inventadas.
- Efecto lateral aparte, no incluido en este commit: se detectó que el cliente de Prisma local
  estaba desactualizado tras la migración `20260829120000_quiz_numeric_categorize` (faltaba
  `prisma generate`, causaba `TS2367` en `classroom.service.ts` y el API no arrancaba). Se
  regeneró localmente para poder levantar el entorno demo; no es un cambio de código ni se
  desplegó — si el mismo síntoma aparece en staging/producción, correr `prisma generate` ahí.
- **Verificación:** `npx tsc --noEmit` en `apps/web` limpio antes del commit. Cherry-pick sin
  conflictos.

### Landing pública multipágina, precios por estudiante y logo real — 2026-09-12

`staging` en `5ed368c9` (cherry-pick de `cb4cd3f9` sobre `origin/staging`, worktree aislado en
`edusyn-wt-landing-deploy`). Sin migración, solo `apps/web`.

- Páginas públicas con URL propia para SEO (antes eran anclas de una sola página sin indexar):
  `/caracteristicas`, `/precios`, `/casos-de-exito`, `/preguntas-frecuentes`, `/recursos`,
  `/contacto`. Hook `useSeo` para title/meta description por ruta. `sitemap.xml` y `robots.txt`
  nuevos.
- `Precios.tsx`: modelo por estudiante/año (Esencial $3.500, Crecimiento $5.200, Integral $7.800,
  Institucional $11.500), calibrado contra precios públicos de Quid y Q10 (ver
  `mercado-precios-competencia.md` en memoria). Calculadora con stepper de estudiantes y toggle
  mensual/anual con ahorro.
- Logo real de Edusyn (icono sin marca de agua, recortado y con fondo transparente) reemplaza el
  placeholder `GraduationCap` en nav, footer y `LandingPage.tsx`; favicon actualizado.
- Aislado del WIP sin confirmar de Valeria conversacional (`apd-ai.service.ts` y relacionados, ver
  entrada pendiente más abajo) — commit propio (`cb4cd3f9` en `feat/aula-rediseno`), sin mezclar.
- **Verificación:** `npx tsc --noEmit` en `apps/web` limpio antes del commit. Cherry-pick sin
  conflictos en los archivos de contenido; único conflicto (orden de imports en `App.tsx` con el
  refactor de code-splitting ya en `staging`/`main`) resuelto a mano, revisado visualmente.
- **Pendiente:** confirmación del usuario para desplegar a `main` (producción) — ver bloque
  "Pendiente de commit y despliegue" si aplica, o repetir el cherry-pick de `cb4cd3f9` sobre
  `origin/main` cuando se autorice.

### Continuidad de Inclusión — 2026-09-11

Por indicación del usuario, se pospone continuar Inclusión y se retoma el orden del encargo de blindaje: academic/templates, learning-route, attendance, preventive-cuts, observer y finalmente classroom. No declarar APD terminado.

Publicado hasta 95b2e3e5: contexto de trabajo, perfiles/planes, actividades y avances. Quedan participantes, adjuntos, firmas, materias, categorías, agregaciones, relaciones históricas inconsistentes, sincronización desde diagnóstico, API compartida pedagogical-support y validación PostgreSQL sintética. Las reglas por asignación docente siguen inventariadas en el Bloque 4. Detalle y evidencia: docs/AUDITORIA_AISLAMIENTO_INCLUSION.md. Al retomarlo, leer esa auditoría y esta bitácora antes de modificar.

Los pendientes operativos de Matrículas (PostgreSQL sintético y dependencias HTTP compartidas) siguen abiertos; posponer Inclusión no los da por resueltos.

### Reasignación de frentes de blindaje — 2026-09-12

Claude termina `docs/ENCARGO_CLAUDE_BLINDAJE_OBSERVER.md` y, una vez integrado por Astra, pasa a `docs/ENCARGO_CLAUDE_POSTGRESQL_BLINDAJE_B1.md`: laboratorio local desechable, transacciones/concurrencia real de Matrículas y evidencia RLS sin modificar políticas. Kimi toma `docs/ENCARGO_KIMI_CLASSROOM_BLOQUE_1.md`, exactamente 17/98 rutas de aulas y actividades. El anterior encargo Classroom para Claude queda cancelado. Ambos trabajan en worktrees/ramas separados, sin push directo a staging; Astra integra y actualiza los estados.

Revisión adversarial posterior: las puntas Observer `41025531` y Classroom B1 `9ac64f02` **no se integraron** por hallazgos de filtrado relacional, PII y atomicidad descritos en `docs/REVISION_ASTRA_OBSERVER_20260912.md` y `docs/REVISION_ASTRA_CLASSROOM_B1_20260912.md`. Se publicaron únicamente documentación y correcciones exigidas en `77fa0475`, sin migración ni cambio de aplicación. El siguiente tramo de Kimi, Classroom B2 (19 rutas; 36/98 acumuladas), queda versionado pero no comienza hasta integrar B1 corregido. Claude conserva PostgreSQL B1 después de integrar Observer corregido.

| Fecha | Entorno | Commit | Migración | Cambio |
|-------|---------|--------|-----------|--------|
| 2026-09-11 | `main` (prod) | `aa7ee9cc` | **No** | **Foro: vista previa legible y HTML de usuario siempre limpio** (probado antes en staging `7e2a1b7a`). Solo cliente web, cero migraciones, API sin cambios. (1) La lista del foro mostraba el HTML crudo del editor (`<p>Responde&nbsp;con…</p>`), reportado por el fundador con captura: la vista previa pasa a texto plano con `DOMParser`. (2) **Cerrado un XSS almacenado que estaba en producción:** `RichContent` insertaba el HTML de usuario sin limpiar y la API tampoco lo limpia; un estudiante podía publicar en el foro código que se ejecutaba en el navegador del docente. Ahora pasa por DOMPurify (conserva el formato del editor, quita lo ejecutable; enlaces con `rel=noopener noreferrer`). Verificado en navegador real: 7 cargas de ataque → 0 ejecuciones; sin limpiar, SÍ se ejecutan. `tsc`, 182/182 pruebas web y build sobre `main`; paquete servido `index-D3sgjccH.js` contiene la limpieza y la vista previa; la app arranca sin errores; API 200. **Recomendado, no bloqueante:** limpiar también en la API al guardar (defensa en profundidad para otros clientes). |
| 2026-09-11 | `main` (prod) | `2cf09fb9` | **No** | **Aula Virtual nueva en producción.** Promovida por cherry-pick en worktree aislado sobre `85a77559`: los 38 commits web del aula de staging (del modelo `a01c3fcc` a la redirección de rutas `67745bc3`, más los arreglos de «Crear con IA» `8b84d43c`, `dd270ca4`, `209ffd99`, `dea0eff9`, `666f97a0`) y la **mitad web** de la consolidación `d26f0dd0` (foro, anuncios, materiales y editor dentro del aula nueva). **API idéntica a la de producción y cero migraciones** (verificado con `git diff origin/main -- apps/api`). Los 28 endpoints que llama el aula nueva existen en la API de producción, y el almacenamiento ya aceptaba los formatos de audio de la entrega por audio. El aula nueva es la **predeterminada** (menú → `/aula`; `/classroom` y `/my-classes` redirigen); la clásica sigue en `/aula-clasica` con botón de vuelta. **Dos bloqueantes encontrados al probar sobre `main`, invisibles en staging:** (1) las pruebas del aula importan `vitest`, que `apps/web` de producción no tenía, y el build es `tsc && vite build` con las pruebas incluidas: **el despliegue habría fallado**. `2cf09fb9` añade SOLO `package.json`/lock de `370fb7dc` (sin su cambio del interceptor de Reportes); el lock solo agrega el árbol de vitest. (2) una prueba exigía `React.lazy` para el aula clásica; ahora acepta también la importación directa de producción. **Fuera, a propósito:** mitad API de `d26f0dd0` (recuperaciones, reportes, APD, copia de aulas), quiz Numérica/Categorizar (trae migración), Valeria sin IA (`8c9b44fd`) y la carga diferida `17045fb3`. Verificado: `tsc` api y web, **176/176 pruebas web**, `npm run build` correcto; paquete servido `index-Kg1YIkhg.js` contiene el aula nueva; la app arranca sin errores de consola; API 200. **Pendiente:** revisión humana con sesión real de docente y de estudiante en producción (solo navegar). Entrada +51 kB gzip (1.391 vs 1.340; producción aún no carga en diferido). Sigue abierto, preexistente: copiar un aula omite las actividades sin sección (el arreglo está en la mitad API de `d26f0dd0`). |
| 2026-09-09 | `main` (prod) | `0f47f339` | **No** | **Identidad institucional unificada en formatos.** Actas y seguimientos ahora leen el escudo del perfil institucional y, si una institución todavía lo tiene solo en la configuración histórica de Boletines, usan ese valor como respaldo. Al guardar el escudo o el color desde Boletines, se consolidan en el perfil para que todos los formatos posteriores usen la misma fuente. Prueba de respaldo aprobada, 6 pruebas de exportación de Observador y tipos API limpios; Railway API/web confirmadas y la ruta de exportación respondió `401` sin sesión. Sin migración ni escrituras de datos reales. |
| 2026-09-09 | `staging` | `5c24784b` | **No** | **Identidad institucional unificada en formatos.** Actas y seguimientos ahora leen el escudo del perfil institucional y, si una institución todavía lo tiene solo en la configuración histórica de Boletines, usan ese valor como respaldo. Al guardar el escudo o el color desde Boletines, se consolidan en el perfil para que todos los formatos posteriores usen la misma fuente. Prueba de respaldo aprobada, 6 pruebas de exportación de Observador y tipos API limpios; Railway API/web confirmadas. Sin migración ni escrituras de datos reales. |
| 2026-09-09 | `main` (prod) | `15d03fbe` | **No** | **Descarga de informes de seguimiento pedagógico del Observador.** Cada registro se exporta como informe individual con encabezado construido desde la institución autenticada: escudo, color, identificación y datos de contacto cuando estén configurados. El documento organiza situación, apoyos, plan de seguimiento, comunicación con acudiente y constancias. La exportación múltiple reúne una hoja por estudiante. 55 pruebas de Observador y tipos API/web aprobados; Railway API/web confirmadas y la ruta pública respondió `401` sin sesión. Sin migración ni escrituras de datos. |
| 2026-09-09 | `staging` | `b3772bbc` | **No** | **Descarga de informes de seguimiento pedagógico del Observador.** Cada registro se exporta como informe individual con encabezado construido desde la institución autenticada: escudo, color, identificación y datos de contacto cuando estén configurados. El documento organiza situación, apoyos, plan de seguimiento, comunicación con acudiente y constancias. La exportación múltiple reúne una hoja por estudiante. 55 pruebas de Observador y tipos API/web aprobados; PDF revisado visualmente; API y web de Railway confirmadas. Sin migración ni escrituras de datos. |
| 2026-09-09 | `main` (prod) | `63989973` | **No** | **Garantía de identidad institucional para actas.** Solo promoción del refuerzo de Observador ya validado en staging: encabezado construido con el perfil de la institución autenticada, escudo y color, dirección y ciudad, NIT/DANE, resolución y contacto cuando estén configurados; proceso y firmantes leídos de la configuración de esa institución. Prueba de aislamiento entre dos instituciones aprobada. Sin migraciones, sin borrados y sin cambios a datos reales. |
| 2026-09-09 | `staging` | `7f6d61a6` | **No** | **Garantía explícita de identidad institucional en actas.** El encabezado se resuelve por la institución autenticada e incorpora nombre, escudo, color, dirección, ciudad, NIT, DANE, resolución y, cuando existen, teléfono, correo y sitio web. Los datos del proceso se leen del `ActaRecord` institucional y las firmas configurables de `ReportCardConfig`. Nueva prueba genera el formato para una segunda institución con identidad y configuración distintas y verifica el mismo `institutionId` en perfil, configuración, casos y logo. 54 pruebas aprobadas, TypeScript API limpio y muestra de tres páginas revisada. |
| 2026-09-09 | `main` (prod) | `562bfe5b` | **No** | **Acta principal en cuadros y descargos como anexos individuales.** Promoción exacta del formato aprobado en staging: descripción amplia, norma, medidas y testigos en bloques con borde; firmas institucionales compactas; una hoja anexa por estudiante con área de versión y firmas propias. Verificado nuevamente sobre `main`: 53 pruebas del Observador y TypeScript API. Sin migración ni escrituras de datos. |
| 2026-09-09 | `staging` | `96d41d93` | **No** | **Formato físico mejorado para actas del Observador.** El acta principal usa cuadros completos para implicados, descripción amplia, norma, medidas y testigos; los descargos salen del cuerpo y cada estudiante recibe un anexo individual con área extensa y firmas de estudiante, acudiente y docente. Las firmas institucionales quedan compactadas en una fila. Una acta conjunta de dos estudiantes genera tres hojas exactas: acta y dos anexos. Verificado visualmente página por página, 53 pruebas del Observador y TypeScript API. Sin migración ni escrituras de datos. |
| 2026-09-09 | `main` (prod) | `af78f616` | **No** | **Exportación institucional de actas del Observador promovida desde staging.** Misma funcionalidad validada: PDF para Acta Tipo I, II y III, modalidad conjunta o individual multipágina, encabezado institucional dinámico, implicados, acuerdos y firmas. Promoción aislada desde `origin/main`; 53 pruebas del Observador, TypeScript API/web y build Vite aprobados. Despliegue comprobado en `api.edusyn.co`: la ruta responde `401` sin sesión; el paquete web público contiene los tres controles nuevos. No se consultaron ni modificaron casos reales. Pendiente institucional: cargar o confirmar el escudo y verificar dirección, resolución, NIT y color de La Esperanza del Sur. |
| 2026-09-09 | `staging` | `bba72e62` | **No** | **Exportación institucional de actas del Observador.** Añade descarga PDF para Acta Tipo I, II y III, individual o conjunta, con identidad configurada de la institución, datos del caso, implicados, acuerdos y firmas. Aislamiento por institución y alcance docente, máximo 30 actas y respuesta genérica ante IDs ajenos o inválidos. Incluye selección y descarga desde la lista y el detalle. Verificado: 53 pruebas del Observador, TypeScript API/web, build Vite, PDF sintético de dos páginas sin recortes; la ruta desplegada responde `401` sin sesión. Sin escrituras de datos para la verificación. Queda por configurar o confirmar el escudo y los datos oficiales de La Esperanza del Sur. |
| 2026-09-09 | `staging` | `ea525836` | **No** | **El puente con la planilla, dentro del aula nueva.** Cero migraciones, cero esquema, cero endpoints nuevos: solo cliente web. Calificar en el aula y calificar en la planilla eran dos trabajos separados; el vinculo ya existia en el backend y en el editor anterior, pero el aula nueva no lo mostraba en ninguna parte. Ahora el detalle de la actividad dice si va a la planilla y a que casilla, con boton «Llevar notas a la planilla»; si no esta vinculada lo dice y lleva al editor, donde se configura. La tarjeta lo indica en la lista para el docente. **Antes de escribir se pide `sync-preview` y se dice cuantas notas se crean, cuantas se reemplazan y cuantas quedan fuera** por conflicto o por falta de entrega; solo tras confirmar se llama a `sync-gradebook`. Son los mismos endpoints que ya usaba el aula anterior. Verificado: 18 archivos / 198 pruebas web, `tsc --noEmit` limpio, `vite build` correcto. **Ojo al probar:** este boton escribe notas reales en la planilla del periodo. |
| 2026-09-09 | `staging` | `8c9b44fd` | **No** | **Valeria responde de verdad cuando no hay IA.** Cero migraciones, cero esquema; solo `apps/api/src/modules/apd/ai/` y dos `.env.example`. Avance directo sobre `a63807a3`. Antes devolvia «estoy en modo basico» y un menu de modulos: un docente que preguntaba como registrar una evidencia recibia un indice. Ahora un filtro previo (`valeria-knowledge.ts`, 16 temas con los flujos reales de la plataforma) responde sin LLM y sin coste por consulta, que es la situacion de staging hoy (no hay proveedor de IA configurado). Tres reglas en orden: si piden crear una actividad no se inventan preguntas; si la pregunta es sobre Edusyn se responde con el flujo verificado; si no lo es, se dice que no hay IA en vez de fingir. **Dos defectos corregidos:** (1) sin IA el borrador de actividad se entregaba CON preguntas de plantilla («¿Cual describe mejor que es El tema?», con opciones inventadas) que parecian reales y el docente podia publicar; ahora va sin preguntas. (2) «¿Como matriculo un estudiante?» no encontraba el tema porque las claves eran las formas completas `matricula`/`matricular`; se usa la raiz `matricul`. El prompt del LLM lleva ademas la base de conocimiento operativa de cada modulo, y `isExplicitActivityRequest` evita que una pregunta normal se convierta en un quiz. Verificado: **79 suites / 1183 pruebas API** (12 nuevas del modulo, antes 7/12 en verde), `tsc --noEmit` limpio. **Pendiente:** verificar el deploy en Railway y probar las respuestas con sesion de docente. **Sin enganchar a proposito:** `buildTopicGrounding()` esta importado pero no se inyecta al prompt del LLM; eso cambiaria lo que Valeria responde CUANDO haya proveedor, y es decision del fundador. |
| 2026-09-08 | `staging` | `53658339` | **No** | **Consolidacion academica + Aula nueva como predeterminada.** Cero migraciones y cero cambios de esquema (verificado con `git diff --name-only ... -- apps/api/prisma/`), asi que el `migrate deploy` del arranque es no-op. Avance directo sobre `0eec42ba`, sin fusion. **(1) Correcciones academicas** de la auditoria del 08-sep: el historico de reportes vuelve a salir tras el cierre; el universo de matriculas se acota al ano del periodo (grupos reutilizados ya no arrastran matriculas de otro ano); la nota final de una recuperacion no puede bajar de la original; rechazar una recuperacion dejaba el registro en 3 y el boletin en 2, ahora `reviewResult` persiste `finalScore`; revocar el consentimiento APD desactiva el perfil; acompanamiento pedagogico deja de permitir que el cuerpo de la peticion sustituya la institucion resuelta. Arreglos de alineacion, fecha civil y asistencia sin registros en el PDF del boletin. **(2) Copia de actividades:** omitia las que no estaban dentro de una seccion, asi que un aula copiada quedaba vacia. Ahora conserva las no seccionadas, mapea periodo equivalente, crea borradores y NO copia entregas ni calificaciones. **(3) Aula nueva:** cerrados los ocho huecos de §9. Foro, anuncios, materiales, editor de actividades y preguntas ya se abren DENTRO del aula nueva (reutilizando las pestanas del aula anterior, con `lazy()`); Rutas y Expedicion montadas en el shell. **Entrega por audio** escrita de cero: el docente marca la tarea, el estudiante graba desde el panel, la tarjeta lo indica. **(4) El aula nueva pasa a ser la PREDETERMINADA:** el menu entra a `/aula`, y `/classroom` y `/my-classes` apuntan tambien ahi para que los enlaces guardados sigan sirviendo. El aula anterior NO se retira: queda en `/aula-clasica` y sigue siendo el respaldo. Verificado: **78 suites / 1171 pruebas API**, **18 archivos / 198 pruebas web**, `tsc --noEmit` limpio en ambos, `vite build` correcto. Entrada 148,2 kB gzip; `Classroom.tsx` en trozo aparte de 92,5 kB, fuera de la entrada (frontera de R1 respetada). Estado del aula en `docs/ESTADO_AULA_VIRTUAL.md`; auditoria en `docs/auditoria-academica-20260908/`. **Pendiente:** verificar el deploy en Railway y probar con sesiones reales de docente y estudiante. **Sigue abierto:** el rol ACUDIENTE (P0-6) cae en la vista de estudiante — decision de producto, identica en las dos aulas. |
| 2026-09-05 | `staging` | `9cacf595` | No | **Aula nueva: vista del estudiante.** Solo cliente web y casi todo dentro de `apps/web/src/pages/aula`: cero archivos de `apps/api`, cero de `prisma`, cero migraciones (verificado con `git diff --name-only`). (1) **Arreglo critico:** la pantalla del estudiante salia EN BLANCO porque las notas son `Decimal` de Prisma y viajan como TEXTO en el JSON, asi que `score.toFixed()` lanzaba y tumbaba el render; ahora pasan por `aNumero()` y hay prueba de regresion. (2) **El estudiante elige el color** con el que ve su aula, sin cambiarselo a nadie (se guarda en su dispositivo): lo pidio el fundador porque el rosado del docente no le sienta a medio salon. (3) **La unidad se ve como un recorrido** de recursos y actividades en un solo camino, usando el `sortOrder` que el docente ya dejaba y la interfaz ignoraba. (4) **Texto que se salia de su caja en el celular**, cuatro causas: los espacios duros (U+00A0) que llegan al pegar desde Word convertian un parrafo entero en una sola palabra y estiraban la pagina a 2009 px; un `<select>` nativo cortaba su etiqueta ("Primer Periodo · e") y pasa a ser un boton corto con hoja; faltaba `min-w-0` en la cadena de flex del recorrido; y el anillo de progreso quitaba ancho a todas las lineas del titulo. Ademas los periodos salian en orden alfabetico ("Cuarto, Primer, Segundo"). 171 pruebas, `tsc` limpio. Probado en el navegador con sesion de estudiante real, en movil (375 px) y escritorio. Trampas documentadas en `docs/REDISENO_AULA_VIRTUAL.md` §11. **Pendiente:** verificar el deploy en Railway. |
| 2026-09-05 | `staging` | `133dbb98` | No | **Aula Virtual rediseñada**, como modulo aparte en `/aula`. La actual sigue en `/classroom` y sigue siendo la predeterminada: se entra por el boton "Probar la nueva aula" y se vuelve con "Volver al aula de siempre". Solo cliente web: cero archivos de `apps/api`, cero de `prisma`, cero migraciones (verificado con `git diff --name-only`). Incluye 4 arreglos en el aula ACTUAL que ya estaban en produccion: reiniciar leccion y borrar recurso ahora piden confirmacion (borraban de un clic), y 8 manejadores dejan de tragarse el error con `catch {}`. Traidos al aula nueva: tablero Hoy por rol, Actividades con busqueda y filtros, Unidades (material + trabajo juntos), detalle con entrega y calificacion, Notas, Estudiantes y aviso de quiz en vivo. Rutas, Expedicion y Foro siguen puenteando al aula actual. Corrige P0-1 (copias sin periodo), P0-2 ("Cancelar programacion" publicaba), P0-3, P0-4 ("Devolver" se ejecutaba al cancelar el prompt) y P0-5. 125 pruebas, `tsc` limpio, `dist/` con solo `index.html`. Plan y garantias de datos en `docs/REDISENO_AULA_VIRTUAL.md` (§5.bis y §10). **Pendiente:** verificar el deploy en Railway y probar con los grupos de ejemplo siguiendo el orden de §10.6. |
| 2026-09-01 | `staging` | `cbc7795c` | No | Reportes Academicos: aislar el estado del cliente al cambiar de institucion (destino explicito en la carga de estudiantes, reinicio de los ocho filtros, descarte de respuestas obsoletas, vaciado de catalogos y escala por defecto sin instancia compartida). Solo cliente web. Despliegues: `40bd12fb` (web) y `ee4f13c8` (api), ambos SUCCESS; health 200 en ambos servicios. Validacion funcional con SuperAdmin pendiente. |
| 2026-09-01 | `staging` | `370fb7d` | No | Blindaje del contexto temporal de Reportes en el cliente web: el `institutionId` explicito del llamante tiene prioridad y las rutas permitidas se reconocen por segmento completo (antes por prefijo). Habilita Vitest en apps/web con 10 pruebas del interceptor. Validado en staging con sesion SuperAdmin: el reporte carga con destino, al cambiar de institucion no persiste el anterior, y el panel SuperAdmin sigue operativo. |
| 2026-08-31 | `staging` | `3b63349` | No | Blindaje multi-tenant de Reportes: 12 commits (destino validado para SuperAdmin, aserciones de pertenencia por recurso, harness HTTP). Incluye tambien `71d2529` de classroom (preservar contenido de leccion al duplicar), que no es de seguridad. Verificado en vivo tras el despliegue: recursos de otra institucion responden 404 sin datos en los tres roles. |
| 2026-08-29 | `staging` | `8b84d43` | No | Flujo guiado "Crear con IA" (Lección/Quiz/Tarea) en Actividades |
| 2026-08-29 | `main` (prod) | `ed0032b` | No | Importador de preguntas de quiz desde JSON de IA |
| 2026-08-29 | `staging` | `a0131a5` | No | Importador de preguntas de quiz desde JSON de IA |

---

## Notas por despliegue

### Criterio permanente — formatos imprimibles del Observador

- Todo tipo de registro que pueda requerir archivo físico institucional debe contar con un formato de exportación propio, descargable e imprimible.
- El formato debe resolver la identidad de la institución autenticada (nombre, escudo, datos de identificación, contacto y color cuando estén configurados), presentar la información pertinente al proceso y prever las constancias o firmas necesarias.
- Una vista en pantalla no sustituye el formato de archivo. Al crear o ampliar un tipo de Observador, se debe evaluar y documentar su salida imprimible antes de dar el flujo por terminado.

### 2026-08-29 — Importador de preguntas de quiz desde JSON de IA
- **Qué:** botón "Importar IA" en el editor de Quiz/Examen. El docente pide a una IA un JSON "limpio"
  de preguntas, lo pega/sube y se crean en lote. Backend traduce al formato interno de `ActivityQuestion`.
- **Archivos:** `classroom.controller.ts` (endpoint `POST /classrooms/activities/:id/questions/import`),
  `classroom.service.ts` (`importQuestions`), `apps/web/src/lib/api.ts`, `apps/web/src/pages/Classroom.tsx`.
- **Migración:** ninguna (usa la tabla `ActivityQuestion` existente).
- **Soporta:** los 7 tipos (MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, SHORT_ANSWER, FILL_BLANK, ORDERING, MATCHING),
  con normalización tolerante (sinónimos en español, respuesta como texto/letra/índice) y creación atómica.
- **Verificación:** `tsc` limpio en API y web; smoke-test de la normalización; formato idéntico al alta manual (mismo calificador).
- **Pendiente relacionado:** rediseño del flujo guiado "Crear con IA" (Lección/Quiz/Tarea) — ver diagnóstico de UX; unificar importadores.
- **Nota:** en `staging` este commit quedó como `a0131a5`; sobre él se empujó luego trabajo de firma/asistencia.
