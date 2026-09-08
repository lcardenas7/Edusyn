# Bitácora — EduLab

Registro append-only. **Entrada más reciente arriba.** Una entrada por bloque de trabajo, escrita
al terminarlo.

Convención de marcado, la misma del programa multi-tenant:
**[V]** verificado con evidencia · **[P]** propuesto, sin ejecutar · **[I]** pendiente de verificar.

```
## AAAA-MM-DD · <bloque> · <agente>
**Qué medí:**
**Qué encontré:**       [V]/[P]/[I]
**Qué NO pude comprobar:**
**Qué cambié:**         (ficheros, commits)
**Qué queda pendiente:** (y esperando qué autorización)
```

> ## Nota append-only de vigencia · 2026-09-07 · EDULAB-4A-D
>
> Los párrafos conservados más abajo que dicen **«R1 sigue CONGELADO / no se ha integrado»** y
> **«Código de EduLab: cero líneas / EduLab está sin código»** son registros históricos y **ya no
> están vigentes**. R1 quedó integrado y validado en staging antes de abrir la implementación, y
> EduLab ya tiene runtime, validador, fixtures, slice jugable y recuperación local. Se conservan
> literalmente para respetar el registro append-only; esta nota gobierna su lectura actual.
>
> `ecfb7832` es el **HEAD documental** que incorporó la bitácora al branch. `993656de` es el
> **último candidato funcional de código**: el commit posterior solo añadió documentación.

> ## Actualización de estado · 2026-09-07
>
> **EduLab ya tiene foundation reutilizable, un primer slice jugable y recuperación local
> verificable.** El candidato vigente es `993656de` en `feat/edulab-local-recovery`; 198 pruebas
> web y 22 del runtime pasan. No existen todavía persistencia remota, Prisma EduLab, migraciones,
> integración con Aula ni despliegue. Este bloque reemplaza como estado vigente el encabezado
> histórico que se conserva debajo por la regla append-only.

> ## Estado en una frase
>
> **EduLab está completamente diseñado y sin una sola línea de código escrita.** Los dos requisitos
> mínimos para empezar están resueltos: R1 (división de código) ejecutado y verificado, y la
> reproducibilidad RLS del perímetro de consolidación subsanada por Codex. **Lo que sigue es que
> Codex arranque el diseño de implementación de la Fase 1.** Empezar por §1 de esta bitácora.

---

## 1. Para quien releve — orden de lectura

Cuatro documentos, en este orden. No hay más fuentes; todo lo demás es conversación.

| # | Documento | Qué contiene | Cuándo leerlo |
|---|---|---|---|
| 1 | [`AUDITORIA_EDUSIM_EDULAB.md`](AUDITORIA_EDUSIM_EDULAB.md) | Qué existe **de verdad** en el repositorio y qué no. Los tres hallazgos que cambiaron la conversación | Primero, siempre |
| 2 | [`PROPUESTA_EDULAB_ETAPA2.md`](PROPUESTA_EDULAB_ETAPA2.md) | **La fuente de verdad del diseño.** 864 líneas, 32 secciones, cinco partes | El grueso del trabajo |
| 3 | [`PROPUESTA_EDUSYN_LABS.md`](PROPUESTA_EDUSYN_LABS.md) | Arquitectura y decisiones de la familia de Labs; la respuesta a «¿motor o módulo?» | Para el encuadre |
| 4 | [`PROPUESTA_EDUSYN_MATHLAB.md`](PROPUESTA_EDUSYN_MATHLAB.md) | El Lab de matemáticas: diagnóstico por **paso**, no por respuesta | Cuando toque MathLab |

Complementarios: [`PLAN_R1_CODE_SPLITTING.md`](PLAN_R1_CODE_SPLITTING.md) y
[`R1_FINAL_REPORT.md`](R1_FINAL_REPORT.md) — el bloqueante que hubo que resolver antes.

---

## 2. Lo que ya está decidido y NO se vuelve a discutir

Son decisiones cerradas del fundador. Reabrirlas cuesta semanas.

**La regla no negociable.** EduLab debe producir *«estoy entrando a un videojuego»*, no *«estoy
haciendo una actividad de Edusyn con un fondo bonito y puntos»*. Y no queda como aspiración: se
convirtió en una **regla que el motor hace cumplir**.

> Todo objetivo declara **dos** condiciones: una de éxito lúdico (`achieved`) y una de evidencia
> pedagógica (`demonstrates`). El validador del catálogo **rechaza publicar** una experiencia con
> objetivos que tengan una sin la otra.
>
> Solo `achieved` → es un videojuego. Solo `demonstrates` → es otro LMS. El motor no deja publicar
> ninguno de los dos.

| Decisión | Resuelto así |
|---|---|
| ¿Motor o módulo? | **Ambos.** Capacidad transversal con puerta propia, que el Aula, Expedición y las Rutas **referencian** sin duplicar |
| Punto de partida técnico | **El Taller**, que ya existe: motor declarativo con registro de instrumentos, grafo de objetos, log append-only y control de concurrencia |
| Variabilidad por estudiante | **Generación procedural determinista** (§9 de la propuesta). Era exigencia explícita: *«que las condiciones sean diferentes para los estudiantes, porque si no se vuelve aburrido y todos lo filtran»* |
| El error | **Es una mecánica**, no una equis roja. Debe producir consecuencia (§7) |
| Primer corte | **«Fuga en el laboratorio»** — no escape room *ni* laboratorio: los dos, con **una sola mecánica**, la manipulación con consecuencia |
| Renderizado | **DOM primero.** Canvas 2D y mundos históricos vienen después (§26), sin desechar lo construido |
| Alcance de lanzamiento | **Tres experiencias excelentes** antes que diez correctas |

**Por qué «Fuga en el laboratorio» y no uno de los dos.** La comparación en nueve criterios dio un
resultado incómodo, y por eso es útil: el escape room gana en reutilización y configurabilidad,
pero un escape room de puertas y códigos es estructuralmente *pregunta → respuesta → se abre la
puerta* — justo lo que la regla no negociable prohíbe. El laboratorio gana exactamente ahí, porque
es donde el error produce consecuencia real. El corte combinado demuestra lo que ninguno demuestra
por separado, **y sigue siendo una sola mecánica**.

---

## 3. Requisitos mínimos para empezar — **ambos cumplidos**

La auditoría fue tajante: *«el bloqueante no es el motor de juego, es el bundle»*. Ese, y la deuda
de reproducibilidad RLS que apareció después, eran los dos requisitos previos. Ya no bloquean.

| Requisito | Estado | Quién | Evidencia |
|---|---|---|---|
| **R1 · división de código** | **HECHO**, congelado a la espera de integración | Claude | `feat/aula-rediseno`, `R1_FINAL_REPORT.md` |
| **RLS reproducible del perímetro** | **HECHO en local**, pendiente de gate de staging | **Codex** | `codex/rls-reproducibilidad-local`, commit `ba353f43` |

### R1 — el bloqueante del bundle

| | Antes | Después |
|---|---|---|
| Entrada (gzip) | **1 429,77 kB** | **144,48 kB** |
| | | **−89,9 %** |

95 páginas convertidas a carga diferida; la fachada `lib/api` troceada en once módulos; frontera
semántica probada en tres direcciones (aula ↔ finanzas ↔ entrada, todas en cero). Coste conocido y
declarado: el JS total creció **+2,3 %** — el precio de trocear, y un intercambio bueno.

> **R1 sigue CONGELADO.** No se ha integrado. Cuando se autorice, va en rama nueva desde el staging
> consolidado y **vuelve a pasar su verificación entera**, porque será una composición nueva.

### RLS — el trabajo de Codex

Codex tomó el handoff `HANDOFF-RLS-DESDE-CONSOLIDACION.md` y **subsanó localmente** el bloqueo de
reproducibilidad del perímetro de consolidación: bootstrap versionado + 96 migraciones, cinco tablas
verificadas, aislamiento sintético A/B en PASS. Su propio checkpoint lo acota con honestidad: la
deuda **global** sigue `PARTIAL` (21 tablas con declaraciones históricas no se activaron sin sus
gates funcionales), y **no** debe afirmarse «Edusyn completamente blindado». **[V]**

Lo relevante para EduLab, y está dicho en su checkpoint: **`EduLab modificado: NO`**. No hay
interferencia entre las dos líneas.

---

## 4. Lo que está construido (documento) frente a lo que está construido (código)

**Distinción que hay que tener clara antes de tocar nada:**

| | Estado |
|---|---|
| Diseño de EduLab | **Completo** — 32 secciones, cinco partes |
| Código de EduLab | **Cero líneas.** No existe `EduLab` ni `EduSim` en el repositorio |
| Base sobre la que se construye | **El Taller**, que sí existe y funciona |

Lo que la propuesta deja resuelto, por partes:

- **I · Fundamentos** — arquitectura definitiva; capa de presentación separada del motor; las 8
  primitivas reales (`inspect`, `pick`, `input`, …).
- **II · El motor** — esquema de experiencia; estado y reglas; motor de feedback y diagnóstico; el
  error como mecánica; andamiaje configurable; generación procedural determinista; eventos y
  evidencia.
- **III · Datos y plataforma** — qué se reutiliza y qué es nuevo; catálogo, ámbitos y versionado;
  asset packs y su economía; audio; avatar persistente; XP y perfil de habilidades; integración con
  Aula Virtual y evaluación.
- **IV · Calidad no funcional** — presupuesto de rendimiento con control en CI; estrategia móvil;
  conectividad inestable; accesibilidad **dentro del motor, no como capa**; seguridad y anti-cheat
  proporcional; las decisiones irreversibles del multijugador futuro.
- **V · Producto** — contenido docente y «Crear con IA»; mecánicas por asignatura; evolución a
  Canvas 2D; el vertical slice; roadmap; criterios de éxito; riesgos; y **§31, dónde discrepo con
  el fundador** — que conviene leer antes de implementar.

---

## 5. Roadmap acordado

| Fase | Qué | Depende de | Tamaño |
|---|---|---|---|
| **0** | R1 · división de código | — | **HECHA** |
| **1** | Runtime + presentador DOM + 8 primitivas + motor de diagnóstico + eventos | Fase 0 | 4–5 sem |
| **2** | Vertical slice «Fuga en el laboratorio», con arte real y medición en dispositivo | Fase 1 | 4–5 sem |

**Codex empieza por el diseño de implementación de la Fase 1.**

---

## 6. Decisiones abiertas — bloquean o condicionan el arranque

De §32 de la propuesta. Dos ya están respondidas; tres siguen abiertas.

| # | Pregunta | Estado |
|---|---|---|
| 1 | ¿«Fuga en el laboratorio» como vertical slice? | **Sí** (§2 de esta bitácora) |
| 2 | ¿Autorizar R1? | **Sí, y ejecutado** |
| 3 | ¿Tres experiencias excelentes en vez de diez correctas? | **Sí** |
| 4 | **¿Quién revisa la fidelidad científica?** | **ABIERTA** — hacen falta una docente de química y una de física, ~2 h por experiencia. Es el insumo que ningún agente puede producir |
| 5 | **¿CI de compilación y pruebas como parte de la Fase 0?** | **PARCIAL** — R1 dejó `.github/workflows/ci.yml`; falta decidir si el presupuesto de rendimiento se controla ahí desde el principio |

> La #4 no es un trámite. El diseño apuesta a que **el error produzca consecuencia física correcta**;
> si la química está mal, la mecánica central deja de ser educativa y pasa a ser decorativa.

---

## 7. Reglas heredadas que también gobiernan EduLab

No son de EduLab, pero se aplican igual:

- **Regla Cero** — producción **read-only absoluto**; staging **persistente, no desechable**; el
  PostgreSQL del 5432 es `UNKNOWN` y está **fuera de alcance**. Solo `LOCAL_EPHEMERAL` (puerto
  55432) admite escrituras sintéticas de prueba.
- **Migraciones** — forward-only, aditivas, compatibles con datos existentes; **nunca** modificar
  una migración histórica.
- **RLS se trabaja en su propia línea.** EduLab no abre una segunda línea paralela: si aparece un
  hallazgo, se entrega como evidencia a esa sesión y se sigue.
- **Convenciones del proyecto** — `confirmDialog`/`alertDialog` + `toast`, nunca `confirm()`/
  `alert()` nativos; fechas de Colombia (UTC−5) con los helpers, nunca la zona del dispositivo.

---

# Entradas

## 2026-09-07 · EDULAB-4B — cierre recuperable · Codex

**Qué cambió respecto de la entrada anterior.** La autorización separada para commits locales fue
concedida. La referencia histórica «código sin stage por revisión automática» ya no describe el
estado vigente; se conserva literalmente por la convención append-only. **[V]**

**Commits locales.**

- `b7b3e184` — contexto transaccional autenticado y pruebas.
- `140baeab` — schema y migración aditiva tenant-safe.
- `7cd12c5d` — repositorio transaccional, idempotencia, CAS y pruebas.

`7cd12c5d` es el candidato funcional de EDULAB-4B antes de este cierre documental. No hubo push,
merge, despliegue ni conexión a staging/producción.

**Qué queda pendiente.** Revisión del diff candidato. La eventual aplicación en staging exige un
gate independiente con backup, drift check, revisión SQL y autorización explícita. Retención y rol
editorial deben resolverse antes de habilitar persistencia en producción.

---

## 2026-09-07 · EDULAB-4B-IMPLEMENTACIÓN — persistencia local aislada · Codex

**Qué medí.** Viabilidad completa de la persistencia sobre la base exacta
`origin/staging@17045fb3`, usando dos bases PostgreSQL efímeras locales independientes y datos
exclusivamente sintéticos.

**Qué encontré.**

- Las 96 migraciones históricas más la nueva migración aditiva de EduLab se aplicaron desde cero
  en ambas bases: **97 aplicadas, 0 fallidas**. Ninguna migración histórica fue editada. **[V]**
- El contexto transaccional propaga institución y usuario autenticado mediante settings locales;
  no toma identidad desde parámetros del cliente y falla cerrado cuando falta cualquiera. **[V]**
- El catálogo global quedó de solo lectura para el rol de aplicación. Attempts y Events quedaron
  aislados por institución + owner con RLS habilitado y forzado. **[V]**
- La matriz A/B negó lectura e inserción cruzada entre instituciones y entre usuarios de una misma
  institución. También negó UPDATE/DELETE/TRUNCATE de Events, DELETE de Attempts y escrituras de
  catálogo. **[V]**
- El repositorio usa creación idempotente sin abortar la transacción, compare-and-swap antes de
  anexar el stream y rollback atómico ante conflicto. No se añadieron endpoints. **[V]**
- Tres intents persistidos reprodujeron el mismo resultado determinista:
  `stateHash = edulab-fnv1a32-27abccaa`. **[V]**
- Prisma validate, check BOM, API build y `git diff --check` pasaron. La suite API terminó con
  **72 suites / 1 145 tests PASS**; las pruebas focales finales terminaron con **12 PASS**. **[V]**
- El diff schema/base no contiene diferencias EduLab. Permanece drift histórico ajeno a EduLab;
  no se corrigió ni se convirtió en bloqueo. **[P]**

**Qué cambié.** Se prepararon cuatro modelos Prisma nuevos, una migración forward-only con
pre/postcondiciones, extensión del contexto transaccional y un repositorio interno con pruebas. No
se añadieron endpoints, UI, seed versionado, Aula, notas, Assessment o Pixi. Staging y producción no
se conectaron ni modificaron.

**Qué queda pendiente.** El código está sin stage porque el revisor automático exigió una
autorización separada y explícita para sus commits locales. Retención, rol editorial y despliegues
siguen abiertos; no forman parte de este gate local.

---

## 2026-09-07 · EDULAB-4B — preflight de persistencia · Codex

**Qué medí.** Compatibilidad del contrato privado con las 96 migraciones versionadas, el schema y
el contexto transaccional de la base oficial `origin/staging@17045fb3`. La revisión fue solo de
archivos locales: no ejecutó Prisma, SQL ni conexiones de base de datos.

**Qué encontré.**

- La base no contiene todavía entidades EduLab y ninguna migración histórica necesita cambiarse.
  **[V]**
- El contexto actual fija institución pero no identidad de usuario. El ownership de Attempts y
  Events requiere incorporar esa identidad autenticada dentro de la misma transacción antes de
  habilitar persistencia. **[V]**
- El contrato RLS consolidado sirve como referencia de preflight y `ENABLE + FORCE`, pero sus
  grants generales y policy única no sirven literalmente para el Event append-only de EduLab.
  La futura migración debe revocar defaults y conceder permisos mínimos por operación. **[V]**
- La retención no bloquea pruebas locales con datos sintéticos; sí impide definir purgas, cascadas
  o despliegue productivo hasta que producto/legal cierre la política. **[P]**

**Qué cambié.** Se amplió exclusivamente el documento privado ignorado por Git con los hallazgos,
el orden seguro de concurrencia y el gate exacto de implementación. No se modificó código, schema,
migraciones, API, datos, Aula, RLS desplegado, staging ni producción.

**Qué queda pendiente.** EDULAB-4B-IMPLEMENTACIÓN necesita autorización expresa para levantar dos
prohibiciones únicamente en entorno local efímero: modificar `apps/api/prisma/` y ejecutar Prisma.
Hasta entonces, el preflight queda **PASS CON GATE** y este bloque se detiene en documentación.

---

## 2026-09-07 · EDULAB-3A — QA visual y recuperación local · Codex

**Qué medí.** Render real del slice en escritorio y continuidad del intento tras recargar, usando
un harness Vite temporal e ignorado por Git. La prueba fue exclusivamente local y no llamó API,
base de datos, staging ni producción.

**Qué encontré.**

- La entrada y la escena DOM/SVG renderizan con jerarquía legible de misión, laboratorio,
  controles y bitácora de evidencia. **[V]**
- `activar alerta → aislar acceso → habilitar control remoto` produjo ticks, eventos semánticos y
  el primer objetivo `achieved + demonstrates`; la consecuencia quedó visible en la escena. **[V]**
- Las mediciones de pH y trazador elevaron el intento a cinco decisiones y conservaron sus valores
  y eventos. **[V]**
- Tras recargar apareció «Hay un intento guardado»; «Continuar intento» restituyó los cinco ticks,
  las dos evidencias, el objetivo demostrado y la secuencia de eventos. **[V]**
- No se ejecutó el descarte desde la UI en esta revisión; su comportamiento continúa cubierto por
  las pruebas automatizadas de recuperación local. **[P]**

**Qué cambié.** Nada en el producto. El servidor y el navegador locales de QA fueron cerrados; sus
archivos temporales permanecieron bajo `node_modules/.cache/`, fuera de Git.

**Qué queda pendiente.** Prueba visual en tablet/móvil y revisión humana de fidelidad científica
antes de considerar publicable el contenido educativo.

---

## 2026-09-07 · EDULAB-4A-D — contrato privado de persistencia · Codex

**Qué medí.** Compatibilidad del diseño de persistencia con la base
`origin/staging@17045fb3`, el contexto transaccional de tenant, el contrato RLS reproducible y la
inmutabilidad/replay ya demostrados por el runtime.

**Qué encontré.**

- El catálogo de experiencias y asset packs debe ser global, versionado e inmutable por contenido;
  el rol de aplicación solo necesita lectura. **[V]**
- Attempts y Events deben llevar `institutionId` obligatorio. Attempt pertenece al usuario
  autenticado; Event pertenece al mismo tenant y owner a través de su Attempt. **[P]**
- El contexto RLS existente cubre institución, pero el ownership fuerte requiere añadir en el
  futuro una identidad de usuario autenticada dentro de la misma transacción. Ausencia de
  cualquiera de los dos contextos debe negar el acceso. **[P]**
- `contentHash` debe ser SHA-256 sobre contenido canónico. No es intercambiable con el
  `definitionHash` FNV estable que hoy usa el runtime para identidad y replay. Ambos deben
  persistirse. **[P]**
- Event será append-only para el rol de aplicación; no habrá actualización, borrado ni truncate.
  Attempt avanza con control optimista de versión y eventos idempotentes/ordenados. **[P]**
- La retención de attempts y eventos sigue siendo una decisión abierta. Hasta resolverla, el
  diseño seguro es minimizar desde el origen y no habilitar purga automática. **[P]**

**Qué NO pude comprobar.** Ninguna tabla, policy o migración existe todavía; las pruebas A/B,
denegación sin contexto, replay persistido y concurrencia son criterios del siguiente gate local,
no resultados ejecutados. **[I]**

**Qué cambié.** Se añadió esta reconciliación pública-safe y se preparó un documento privado
ignorado por Git con el contrato de datos, permisos, RLS, SQL propuesto, prueba A/B y secuencia de
migración. La bitácora no reproduce SQL ni el mapa de seguridad. No se modificó código, Prisma,
migraciones, API, Aula, Assessment, notas, Pixi, staging o producción.

**Qué queda pendiente.** Revisión humana del contrato privado y decisión de retención. Solo después
podrá autorizarse EDULAB-4B: implementación aditiva en una rama/gate separado y validación exclusiva
contra base local efímera. Este bloque queda sin stage y sin commit; un commit documental público-safe
requiere autorización separada.

---

## 2026-09-07 · EDULAB-3 — recuperación local verificable · Codex

**Qué medí.** Si un intento de «Fuga en el laboratorio» puede sobrevivir a una recarga sin
convertir el snapshot local en fuente de verdad, si la telemetría local tolera escrituras
repetidas y si el nuevo código conserva la frontera lazy de R1.

**Qué encontré.**

- El estado se puede reconstruir exclusivamente desde `definition + engineVersion + seed +
  ordered intents`; no hace falta confiar en una copia mutable del mundo. **[V]**
- Un registro con `definitionHash`, versión del Engine, secuencia o `stateHash` incompatibles es
  rechazado y no se ejecuta. **[V]**
- `eventId` ya es una clave determinista (`attemptId:sequence`) adecuada para una cola idempotente.
  **[V]**
- IndexedDB puede permanecer fuera del Engine: el runtime sigue sin React, DOM, Pixi, NestJS ni
  Prisma. **[V]**

**Qué NO pude comprobar.** La revisión visual autenticada completa. El servidor local abrió desde
la red local y la ruta protegida redirigió correctamente a `/login`; no se usaron credenciales ni
se alteró la autenticación. **[I]**

**Qué cambié.**

- Rama: `feat/edulab-local-recovery`.
- Candidato: `993656de017f49942a2811d254d3f6a5cb5181c2`.
- Dos commits locales:
  - `64a64cb6 feat(edulab): add verified local recovery`;
  - `993656de feat(edulab): resume local fuga attempts`.
- Cinco ficheros: adaptador IndexedDB, contrato puro de recuperación, seis pruebas, integración
  continuar/descartar y estilos.
- El registro local versionado guarda referencia inmutable, modo, seed, intents aceptados,
  `stateHash`, tick lógico y estado; no guarda PII ni usa wall clock.
- Cada recuperación vuelve a ejecutar `replay`, compara hash y ticks y solo entonces entrega el
  estado a la experiencia.
- La cola local hace `put` por `eventId`, ordena por secuencia y no duplica el mismo evento.
- Las escrituras se serializan para impedir que un snapshot anterior sobrescriba uno reciente.
- La experiencia muestra `Guardando`, `Guardado local` o `Sin guardado`, ofrece continuar o
  descartar y cierra cada conexión IndexedDB al terminar la operación.

**Evidencia.**

| Comprobación | Resultado |
|---|---|
| Web | **198/198 PASS** **[V]** |
| Runtime | **22/22 PASS** **[V]** |
| Typecheck | **PASS** **[V]** |
| Web build | **PASS** **[V]** |
| API build | **PASS** **[V]** |
| Entry local | **148.989 bytes gzip** **[V]** |
| Entry antes de EDULAB-3 | **148.993 bytes gzip** **[V]** |
| Chunks JS | **164; 0 mayores de 1 MB** **[V]** |
| `modulepreload` EduLab en HTML | **0** **[V]** |
| `indexedDB` en entry eager | **0** **[V]** |
| Prisma / migraciones / RLS / Aula / backend funcional | **0 cambios** **[V]** |
| Staging / producción / push / deploy | **NO** **[V]** |

**Qué queda pendiente.**

- Revisión visual autenticada de entrada, avance, recarga, continuar, descartar y finalización.
- La cola es deliberadamente local: todavía no existe endpoint ni sincronización remota. **[P]**
- No crear persistencia institucional hasta aprobar el contrato tenant/RLS y una migración
  exclusivamente aditiva en un gate separado.

**Secuencia recomendada para continuar.** **[P]**

1. **EDULAB-3A · gate manual corto:** probar con una cuenta de prueba autenticada iniciar, tomar
   decisiones, recargar, continuar, descartar y terminar. Registrar evidencia; no desplegar.
2. **Gate científico:** una docente de química revisa perfiles, instrumentos, consecuencias,
   recuperación y explicaciones de «Fuga». La persona responsable sigue siendo una decisión del
   fundador; hasta resolverla, conservar `CONTENIDO EN REVISIÓN`.
3. **EDULAB-4A · contrato antes de datos:** documentar campos, ownership y retención de entidades
   `GLOBAL`, `INSTITUTION_OWNED` y `USER_ATTEMPT_OWNED`; definir idempotencia, replay, minimización
   de datos y matriz tenant/RLS. Sin Prisma todavía.
4. **EDULAB-4B · migración local aditiva:** solo después de aprobar 4A, crear nuevas tablas sin
   `DROP`, renombres ni modificación de migraciones históricas. Validar primero en una base local
   efímera con aislamiento A/B, `ENABLE + FORCE RLS` y rollback operativo por forward-fix.
5. **API y sincronización:** adaptar snapshot/outbox a endpoints idempotentes sin acoplar Attempt a
   Grade, Aula, XP o notas. Mantener el Engine puro.
6. **Gate de staging:** backup verificado, drift check, revisión SQL y `migrate deploy`; producción
   continúa fuera de alcance. Aula/Assessment reciben su propio gate posterior.

---

## 2026-09-07 · EDULAB-2 — primer slice jugable de «Fuga en el laboratorio» · Codex

**Qué medí.** Si la definición aprobada podía convertirse en una simulación pequeña pero real,
con decisiones, consecuencias, recuperación, evidencia pedagógica y presentación DOM/SVG sin
inflar el bundle inicial.

**Qué encontré.**

- El mismo Engine declarativo soporta una experiencia jugable con cuatro perfiles de incidente
  cualitativos seleccionados por seed. **[V]**
- La intervención accidental puede alcanzar el estado seguro sin demostrar comprensión; el cierre
  completo exige objetivos demostrados. **[V]**
- Una acción insegura o una válvula incorrecta cambia exposición, presión o dispersión, genera
  diagnóstico y conserva una ruta de recuperación. **[V]**
- La evidencia del circuito permanece oculta hasta usar el instrumento correspondiente. **[V]**

**Qué NO pude comprobar.** Fidelidad científica final en aula: sigue faltando revisión humana de
química. Por eso la interfaz declara `CONTENIDO EN REVISIÓN`. **[I]**

**Qué cambié.**

- Rama de origen del slice: `feat/edulab-fuga-vertical-slice`.
- Candidato del bloque: `c2d661cdef093211ed76618354e8461cd9e3c065`.
- Cuatro commits locales: `a754c7b7`, `bb9fbaf9`, `b37a5285`, `c2d661cd`.
- Ruta protegida y lazy `/edulab/fuga`, fuera de `Layout`.
- Definición declarativa completa del slice: seguridad, evidencia, hipótesis, intervención,
  contención, verificación y explicación causal.
- Finalizaciones: contención explicada, recuperación y escalamiento seguro.
- Presentador React + DOM/SVG; sin Pixi, Canvas, endpoints ni persistencia.
- Replay local y comparación de `stateHash` al finalizar.

**Evidencia.** Web **192/192 PASS**, runtime **22/22 PASS**, typecheck, build web y build API en
**PASS**. Entry medido en **148.993 bytes gzip**, 164 chunks, ninguno mayor de 1 MB; runtime y
experiencia quedaron en chunks lazy separados. **[V]**

**Qué queda pendiente.** Validación visual autenticada y revisión de fidelidad científica antes de
retirar la marca de contenido en revisión. No conectar todavía con Aula, notas o Assessment.

---

## 2026-09-07 · EDULAB-0/1 — foundation reutilizable · Codex

**Qué medí.** Si el corazón de EduLab podía existir en Edusyn como paquete reutilizable,
determinista y no gráfico, sin entrar al bundle inicial ni depender de la plataforma académica.

**Qué encontré.**

- `@edusyn/types` es deliberadamente type-only y no es lugar correcto para el Engine ejecutable.
  **[V]**
- Un paquete workspace independiente puede ejecutarse en navegador y tests Node sin React, DOM,
  Pixi, NestJS o Prisma. **[V]**
- Dos dominios distintos —micro-laboratorio y circuito eléctrico— funcionan con los mismos
  contratos y Engine. **[V]**
- `achieved` y `demonstrates` requieren estados separados y el validador debe rechazar cualquier
  objetivo incompleto. **[V]**

**Qué NO pude comprobar.** Persistencia, tenancy y comportamiento en staging quedaron fuera del
lote por diseño. **[I]**

**Qué cambié.**

- Rama: `feat/edulab-runtime-foundation`.
- Candidato: `b4b8adcad9402c85f2446fd5b65b4d52abe48093`.
- Cinco commits locales: `6ddaf404`, `12845654`, `55927819`, `db25df6a`, `b4b8adca`.
- Paquete `packages/edulab-runtime` con contratos mínimos, validador structural/semantic, lenguaje
  declarativo cerrado, PRNG explícito, ticks lógicos, canonicalización, `stateHash`, Engine,
  diagnóstico, eventos y replay.
- Prohibidos por frontera y pruebas: `eval`, `new Function`, callbacks de contenido, red, reloj del
  sistema, `Math.random`, React, DOM, Pixi, NestJS y Prisma.
- Fixtures de archivos, no registros de base de datos.

**Evidencia.** ExperienceDefinition, validación structural/semantic, PRNG, replay, hash, ambos
fixtures, `achieved != demonstrates`, consecuencia recuperable, typecheck y build: **PASS**. El
runtime tenía **22/22 pruebas PASS** al cerrar la línea actual. **[V]**

**Qué queda pendiente.** El paquete demuestra reutilización; los adaptadores de UI, almacenamiento
y plataforma deben permanecer fuera del Engine.

---

## 2026-09-07 · Reconciliación de Stage 3, R1 y Prisma local · Codex

**Qué medí.** La base real posterior a R1, la documentación Stage 1–3, el grafo de carga y la causa
de los errores de compilación API observados durante el precheck.

**Qué encontré.**

- La base autorizada es `origin/staging = 17045fb3e47ee2f63a5067372cc7ce0b48331346`.
  R1 estaba integrado, desplegado y validado antes de abrir EduLab. **[V]**
- La frontera `lazy() + Suspense` y la fachada API por dominios ya existían; EduLab debía respetar
  ambas y no importar el barrel general. **[V]**
- El cliente Prisma compartido localmente estaba obsoleto respecto del `schema.prisma` versionado:
  faltaban símbolos actuales y eso producía 12 errores de build API. No era corrupción de staging
  ni una razón para borrar datos. **[V]**
- Regenerar Prisma es una operación de artefactos de compilación; no requiere conectarse ni escribir
  en una base. **[V]**

**Qué NO pude comprobar.** El control automático del presupuesto de bundle en CI sigue sin existir;
solo está versionado `db-backup.yml`. **[I]**

**Qué cambié.** Se creó un worktree limpio desde el commit exacto autorizado. Para validar API se
instalaron dependencias localmente de forma aislada, se ejecutaron `prisma validate` y `prisma
generate` con una URL sintáctica local no conectada y luego `nest build`. No se cambió schema,
migración, Prisma versionado, API funcional ni base de datos.

**Qué queda pendiente.**

- En un cambio de infraestructura separado, hacer explícito `prisma generate` antes del build API
  para impedir clientes obsoletos.
- Mantener prohibidos `db push`, `migrate reset` y cualquier borrado para resolver problemas de
  generación.
- Las futuras tablas EduLab deben llegar mediante migraciones forward-only, aditivas y revisadas,
  después de aprobar el contrato tenant/RLS.

---

## 2026-09-07 · Apertura de la bitácora y traspaso a Codex · Claude

**Qué medí.** Qué existe de EduLab en el repositorio, y si los requisitos mínimos para empezar
estaban realmente cumplidos o solo dados por cumplidos.

**Qué encontré.**

- **Cuatro documentos versionados** en `feat/aula-rediseno`: la auditoría, la propuesta de Etapa 2,
  la de la familia de Labs y la de MathLab. Ninguno tenía bitácora hasta hoy. **[V]**
- **Cero código.** `EduLab` y `EduSim` no aparecen en el repositorio. Lo que sí existe es **El
  Taller**, que es el patrón que la propuesta adopta. **[V]**
- **R1 hecho y verificado**: entrada de 1 429,77 kB → 144,48 kB gzip (−89,9 %). **Congelado**, sin
  integrar. **[V]**
- **Codex resolvió el segundo requisito**: `codex/rls-reproducibilidad-local`, commit `ba353f43`,
  con checkpoint propio que acota el alcance a `PARTIAL` global y declara `EduLab modificado: NO`.
  **[V]**
- De las cinco decisiones abiertas de §32, **tres están cerradas y dos siguen abiertas** — y la de
  la fidelidad científica (#4) no la puede cerrar ningún agente. **[V]**

**Qué NO pude comprobar.** Nada del diseño está probado en ejecución, porque no hay código. Todas
las cifras de rendimiento de la propuesta son **presupuestos**, no mediciones: siguen **[P]** hasta
que exista el vertical slice y se mida en dispositivo real.

**Qué cambié.** Solo este archivo. **Ninguna línea de código.** No se tocó R1, ni el Aula, ni la
línea de RLS, ni la rama de consolidación.

**Qué queda pendiente.**

- **Codex: diseño de implementación de la Fase 1** — runtime, presentador DOM, las 8 primitivas,
  motor de diagnóstico y sistema de eventos. Fuente de verdad: `PROPUESTA_EDULAB_ETAPA2.md`,
  Partes I y II. Antes de escribir código, leer **§31 (dónde discrepo contigo)** y **§30 (riesgos y
  deuda técnica)**.
- **Decisión #4 del fundador** — quién revisa la fidelidad científica. Condiciona la Fase 2, no la 1,
  así que **no bloquea el arranque del diseño**.
- **Decisión #5** — si el presupuesto de rendimiento se controla en CI desde el principio.
- **Integración de R1** — sigue congelada y no depende de EduLab. Cuando toque, rama nueva desde el
  staging consolidado y verificación completa otra vez.
