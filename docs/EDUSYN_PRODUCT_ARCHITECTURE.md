# Edusyn — Arquitectura Maestra del Producto

> **La Constitución Técnica de Edusyn.**
> Este documento no describe código: describe **cómo debe construirse Edusyn**. Es de cumplimiento **obligatorio** para todo desarrollo futuro, humano o asistido por IA.
> Cuando un patrón concreto de código contradiga esta constitución, **manda la constitución** (o se enmienda la constitución explícitamente, nunca por omisión).
> **Versión:** 1.0 · **Fecha:** 2026-08-01 · **Custodio:** Chief Software Architect.
> **Documentos que gobierna / complementa:** `ONBOARDING_INSTITUCIONAL_V2.md`, `AUDITORIA_ONBOARDING_V2_ARQUITECTURA.md`, `CONSTITUCION_MODULO_NOTAS.md`, `AUDITORIA_NUCLEO_ACADEMICO.md`, `AUDITORIA_ADVERSARIAL_PASE1.md`.

---

## Cómo leer este documento

- **DEBE / NUNCA / PUEDE** son normativos. "DEBE" es obligatorio; "NUNCA" es prohibición absoluta; "PUEDE" es permitido con criterio.
- Cada regla lleva un identificador estable (`P1`, `AR3`, `CH7`…) para poder citarla en revisiones de código y PRs ("esto viola `AR4`").
- El **Checklist §10** es el punto de control operativo: ningún módulo entra sin cumplirlo.

---

## 1. Filosofía del producto

### 1.1 ¿Qué es Edusyn?
Edusyn es un **ERP educativo SaaS, multi-tenant, para instituciones colombianas**. Una sola plataforma que corre la operación completa de un colegio: académico (grados, grupos, matrícula, notas, SIEE), administrativo (usuarios, roles, comunicaciones) y los procesos de incorporación y operación diaria. Reemplaza la suma de Excel dispersos, plataformas rígidas y procesos manuales por **un sistema coherente donde el dato se captura una vez y se reutiliza en todo el ciclo**.

### 1.2 ¿Qué problemas resuelve?
1. **Fragmentación:** la información del colegio vive en decenas de archivos inconexos. Edusyn la unifica y la hace fuente de verdad.
2. **Trabajo manual repetitivo:** crear grados, grupos, matrículas y usuarios uno por uno. Edusyn **infiere y construye** a partir de lo que el colegio ya tiene.
3. **Fragilidad de las notas:** el corazón legal de un colegio es la evaluación. Edusyn protege la **integridad de las notas** con reglas explícitas y trazabilidad (ver `CONSTITUCION_MODULO_NOTAS.md`).
4. **Cumplimiento legal:** datos de menores bajo Habeas Data (Ley 1581/2012). Edusyn trata la protección de datos como requisito de arquitectura, no como añadido.
5. **Opacidad del proceso:** el usuario nunca sabe en qué punto está. Edusyn hace **el estado siempre visible y explicable**.

### 1.3 Principios del producto
- **P-PROD-1 — El sistema trabaja, el humano confirma.** Todo lo que se pueda deducir del dato existente **no se pregunta**. El rol del usuario es *entregar y confirmar*, no *crear a mano*.
- **P-PROD-2 — El dato se captura una vez.** Nunca se le pide al usuario un dato que el sistema ya tiene o puede inferir.
- **P-PROD-3 — Nada se escribe sin previsualización.** Todo proceso que modifica datos importantes muestra primero **qué va a pasar**.
- **P-PROD-4 — El estado siempre es visible y explicable.** El usuario, en todo momento, sabe qué hizo, qué falta, qué está mal y qué sigue.
- **P-PROD-5 — Legal y seguro por diseño.** La protección de datos de menores y el aislamiento entre colegios no son features: son cimientos.
- **P-PROD-6 — La integridad del dato académico es sagrada.** Una nota, una matrícula o una promoción incorrecta tiene consecuencias legales reales para un menor. La corrección le gana siempre al rendimiento y a la conveniencia.

### 1.4 Qué NUNCA debe hacerse
- **NUNCA** duplicar una regla de negocio en el frontend. La regla vive en el backend; el frontend la representa.
- **NUNCA** escribir datos de un colegio accesibles por otro (fuga multi-tenant).
- **NUNCA** modificar datos académicos importantes sin trazabilidad (quién, cuándo, qué cambió).
- **NUNCA** ejecutar un proceso masivo que, al reejecutarse, duplique o corrompa datos.
- **NUNCA** sorprender al usuario: ni con un dato que se perdió, ni con un bloqueo sin explicación, ni con una acción irreversible sin aviso.
- **NUNCA** ofrecer en la interfaz una capacidad que el backend no soporta ("puertas sin cuarto detrás").
- **NUNCA** pedir datos que no se usan (minimización de datos personales).

---

## 2. Principios Arquitectónicos (normativos)

Estos principios son **obligatorios**. Un módulo que los viole no se acepta (ver §10).

- **AR1 — El backend es la única fuente de verdad de las reglas.** Reglas de negocio, cálculos, transiciones de estado, permisos y validaciones viven **solo** en el backend.
- **AR2 — El frontend solo representa estado.** El cliente **nunca** calcula progreso, elegibilidad, orden de pasos, bloqueos ni resultados de reglas. Los recibe y los pinta. (Corolario directo de la auditoría de Onboarding: *"el frontend no piensa, renderiza"*.)
- **AR3 — Una regla, un solo lugar.** Ninguna regla de negocio se implementa dos veces. Si se necesita en dos flujos, se extrae a una función/servicio de dominio y se reutiliza. Duplicar una regla es deuda que corrompe.
- **AR4 — Idempotencia obligatoria en todo proceso importante.** Cualquier operación que cree o modifique datos en lote (importaciones, activaciones, migraciones, generaciones) **DEBE** poder reejecutarse sin duplicar ni corromper. Se logra con *find-or-create*, `upsert`, o `createMany({ skipDuplicates })` — **no** asumiendo que corre una sola vez.
- **AR5 — Reanudable sobre transaccional en lotes grandes.** Para lotes masivos (miles de filas), **NUNCA** se hace "todo-o-nada" ingenuo: una fila mala no debe revertir mil buenas. El estándar es **idempotente + reanudable + reporte de cuadre por fila**. La atomicidad estricta (`$transaction`) se reserva para unidades pequeñas y consistentes.
  - **AR5.1 — Veneno de conexión Prisma:** un `create()` sobre un campo `@unique` dentro de un `$transaction` que colisiona envenena la conexión (Postgres `25P02`) y hace fallar en cascada todo lo que sigue. Dentro de transacciones se usa `upsert` / `createMany({ skipDuplicates })`, nunca `create` sobre único sin protección. (Ver memoria `prisma-tx-unique-poison`.)
- **AR6 — Multi-tenant obligatorio y por defecto.** Toda entidad de negocio pertenece a una institución (`institutionId`) y **toda** consulta filtra por tenant. El aislamiento es *deny-by-default*: si una consulta no acota el tenant, es un bug de seguridad, no de datos.
  - **AR6.1 — Aislamiento en la base, no solo en el código.** El objetivo de arquitectura es **RLS (Row-Level Security)** en las tablas del núcleo. Mientras no exista, el filtrado por `institutionId` en cada acceso es obligatorio y auditado. *(Estado actual: RLS parcial; el núcleo académico aún sin RLS — riesgo documentado, ver §9 y `AUDITORIA_CREACION_INSTITUCION.md §11`.)*
- **AR7 — Seguridad por defecto.** Todo endpoint autentica y autoriza por rol explícitamente. El acceso se **concede**, no se **quita**: sin permiso declarado, no hay acceso.
- **AR8 — APIs REST consistentes.** Recursos en plural, verbos HTTP semánticos, formas de respuesta uniformes por familia de operación (ver §4.3 y §7). Un desarrollador que conoce un endpoint puede predecir la forma del siguiente.
- **AR9 — Eventos auditables.** Toda operación sensible (cambio de nota, matrícula, activación de año, importación masiva, cambio de rol) **DEBE** dejar un rastro: quién, cuándo, qué cambió, valor anterior/nuevo. La auditoría es parte del contrato del módulo, no un lujo.
- **AR10 — Estado canónico expuesto.** Todo proceso o entidad con ciclo de vida expone un **objeto de estado canónico** calculado por el backend (ver §5). El frontend nunca deriva ese estado.
- **AR11 — Contratos explícitos y versionables.** El contrato entre backend y frontend se define antes de construir (formas de request/response, estados, errores). Cambiar un contrato es un acto deliberado y comunicado, nunca un efecto colateral.
- **AR12 — Migraciones controladas.** Todo cambio de esquema pasa por migración versionada de Prisma; nada de cambios manuales al esquema en ambientes. (Ver memoria `railway-migraciones`.)
- **AR13 — Fallar fuerte y claro.** Ante entrada inválida o precondición no cumplida, el backend rechaza con un error **humano y accionable** (qué pasó, en qué fila/campo, cómo corregir). Nunca falla en silencio ni "adivina".
- **AR14 — El dominio no depende de la entrega.** Las reglas de negocio no dependen de HTTP, de la forma del request ni del framework web. Se pueden invocar desde un endpoint, un job o un test sin cambiar la lógica.

---

## 3. Arquitectura General (conceptual)

Edusyn se organiza en capas con **dependencia unidireccional hacia abajo**. Una capa **NUNCA** conoce los detalles de la que está encima.

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (cliente)                                       │
│  Representa estado. Renderiza. Captura intención.         │
│  No calcula reglas. No es fuente de verdad de nada.       │
└───────────────────────────┬─────────────────────────────┘
                            │  contrato REST explícito (§4)
                            ▼
┌─────────────────────────────────────────────────────────┐
│  API (capa de entrega)                                    │
│  Autentica, autoriza (rol + tenant), valida forma,        │
│  traduce HTTP ↔ dominio. Fina: sin reglas de negocio.     │
└───────────────────────────┬─────────────────────────────┘
                            │  invoca servicios de dominio
                            ▼
┌─────────────────────────────────────────────────────────┐
│  DOMINIO (corazón del sistema)                            │
│  Reglas de negocio, cálculos, workflows, estados,         │
│  inferencia, validaciones. Independiente del transporte.  │
│  Aquí vive LA VERDAD.                                      │
└───────────────────────────┬─────────────────────────────┘
                            │  persistencia vía repositorio/ORM
                            ▼
┌─────────────────────────────────────────────────────────┐
│  BASE DE DATOS (PostgreSQL + Prisma)                      │
│  Estado persistente, integridad referencial, unicidad,    │
│  aislamiento multi-tenant (meta: RLS). Migraciones.       │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│  INFRAESTRUCTURA (Railway u hosting)                      │
│  Ejecución, red, almacenamiento, cifrado en tránsito y    │
│  reposo, respaldos, observabilidad, secretos.             │
└─────────────────────────────────────────────────────────┘
```

**Reglas de capa:**
- **G1 —** El **Dominio** no importa nada de la capa API ni conoce HTTP. (Refuerza AR14.)
- **G2 —** La capa **API** es delgada: orquesta, no decide. Si un controlador tiene lógica de negocio, está mal ubicada.
- **G3 —** El **Frontend** solo habla con la API por el contrato publicado. Nunca asume comportamiento no contratado.
- **G4 —** La **Base de datos** es el guardián final de la integridad (unicidad, FKs, tenant). El código no es el único que protege el dato.
- **G5 —** La **Infraestructura** es reemplazable; ninguna regla de negocio depende del proveedor de hosting.

---

## 4. Contratos entre Backend y Frontend

La separación de responsabilidades es **absoluta**. Mezclarlas es la causa raíz de la deuda arquitectónica y está prohibida (AR1, AR2).

### 4.1 Backend es dueño de:
- **Reglas** de negocio y cálculos.
- **Estados** y sus transiciones (qué es válido, qué sigue, qué está bloqueado).
- **Permisos** (quién puede hacer qué, por rol y por tenant).
- **Validaciones** de datos y de precondiciones.
- **Dominio** (el modelo conceptual del colegio).
- **Workflows** (procesos multi-paso: onboarding, matrícula, cierre de período).

### 4.2 Frontend es dueño de:
- **UX** y el flujo percibido.
- **Componentes** visuales y su composición.
- **Navegación** entre pantallas.
- **Responsive** (mobile-first obligatorio: diseñar a ~375px, luego escritorio).
- **Accesibilidad** (AA, `prefers-reduced-motion`, táctiles ≥44px, tipografía ≥16px).
- **Experiencia del usuario**: claridad, estados vacío/cargando/error/éxito, microcopys.

### 4.3 Reglas del contrato
- **C1 — Nunca mezclar responsabilidades.** El frontend no implementa reglas; el backend no dicta diseño visual.
- **C2 — El frontend consume estado, no lo deduce.** Si el cliente necesita saber "¿puede avanzar?", el backend responde `enabled: true/false` con motivo; el cliente no lo calcula.
- **C3 — Formas de respuesta uniformes.** Las operaciones de la misma familia comparten forma. En particular, toda operación de importación/proceso responde con la estructura de cuadre estándar (§7): `{ resumen, creados, actualizados, omitidos, errores[], advertencias[] }`.
- **C4 — Errores como datos, no como texto suelto.** Los errores viajan estructurados (`{ campo/fila, severidad, motivo, cómo_corregir }`) para que el frontend los presente sin interpretarlos.
- **C5 — El contrato se acuerda antes de construir.** Mientras el contrato de un módulo no esté cerrado, el frontend no lo implementa (para no rehacer). Una vez cerrado, ambos avanzan en paralelo.
- **C6 — Estabilidad del contrato.** Un cambio incompatible de contrato requiere aviso explícito y coordinación; nunca se rompe silenciosamente.

---

## 5. Arquitectura de Estados

**AR10 formalizado.** Todo módulo con ciclo de vida **DEBE** exponer un **Estado Canónico**: un único recurso, calculado por el backend, que responde *todo* lo que el frontend necesita para pintar la experiencia — sin que el cliente calcule nada.

### 5.1 Por qué (la justificación)
- **Una sola verdad.** Si el estado se calcula en un solo lugar (backend), no hay dos partes del sistema en desacuerdo sobre "en qué punto estamos".
- **Multi-sesión y multi-persona gratis.** Los procesos reales de un colegio duran días y los tocan varias personas. Con el estado en el servidor, cualquiera retoma donde se quedó, desde cualquier dispositivo.
- **Frontend desechable y simple.** El cliente se vuelve un renderizador puro; su complejidad cae y su corrección sube.
- **Evita el "gotcha".** Si las precondiciones (`blockedBy`) viajan en el estado, el usuario nunca choca contra un muro invisible.

### 5.2 Estados canónicos previstos
`OnboardingState`, `EnrollmentState` (matrícula), `ImportState` (cualquier importación en curso), `WorkflowState` (procesos genéricos multi-paso), `GradingPeriodState` (apertura/cierre de períodos), `AcademicYearState` (DRAFT→ACTIVE→CLOSED). Todo módulo nuevo con ciclo de vida agrega el suyo.

### 5.3 Forma conceptual mínima de un Estado Canónico
```
XxxState {
  progress            // 0..100, ponderado (no lineal)
  recommendedNext     // qué sugiere el sistema hacer ahora (sugerir, no forzar)
  steps/items: [
    {
      key
      status          // locked | available | in_progress | done | error
      blockedBy[]      // precondiciones faltantes (grafo de dependencias)
      summary          // conteos/hechos ya resueltos ("1.500 estudiantes")
      issues[]         // hallazgos: { severidad, motivo, cómo_corregir }
      actions[]        // qué se puede hacer AHORA: { tipo, enabled, motivo }
    }
  ]
}
```
- **E1 —** `status`, `blockedBy`, `progress` y `recommendedNext` los calcula **siempre** el backend.
- **E2 —** `actions[].enabled` gobierna qué botones se habilitan en el cliente. El cliente no decide elegibilidad.
- **E3 —** El sistema **sugiere** el siguiente paso; **nunca** salta pasos automáticamente ni le quita agencia al usuario.
- **E4 —** El mismo objeto de estado sirve al diagnóstico inicial, a la reanudación y al cierre. No se construyen tres cosas para lo que es una.

---

## 6. Arquitectura de Componentes (conceptual)

Aplica tanto a componentes de dominio (backend) como de interfaz (frontend). El objetivo: **módulos reutilizables que se componen sin acoplarse**.

- **CO1 — Responsabilidad única.** Un componente hace una cosa y la hace bien. Si su descripción necesita un "y", probablemente son dos componentes.
- **CO2 — Contrato explícito, interior oculto.** Un componente expone entradas/salidas claras y esconde su implementación. Se puede reemplazar por dentro sin afectar a quien lo usa.
- **CO3 — Data-driven, no hard-coded.** Los componentes se configuran por datos, no por casos especiales incrustados. Ejemplo normativo: una tabla de reporte de errores renderiza *una lista arbitraria de hallazgos con severidad*; agregar un nuevo tipo de error **no** requiere tocar el componente.
- **CO4 — Composición sobre herencia.** Se construye combinando piezas pequeñas, no con jerarquías profundas.
- **CO5 — Sin estado oculto compartido.** Un componente no depende de estado global implícito; recibe lo que necesita. (En frontend, corolario de AR2: recibe el estado por props, no lo calcula.)
- **CO6 — Reutilizable por diseño, extraído por evidencia.** No se abstrae desde un solo caso. Se construye concreto, y cuando aparece el **tercer** uso real (regla de tres), se extrae la abstracción. Abstraer prematuramente produce la abstracción equivocada.
- **CO7 — Los componentes de dominio son independientes del transporte** (refuerza AR14): invocables desde un endpoint, un job o un test.

---

## 7. Arquitectura de Importadores (estándar del sistema)

Toda incorporación masiva de datos a Edusyn — estudiantes, docentes, carga académica, notas, y **cualquier módulo futuro** (acudientes, horarios, biblioteca, convivencia, transporte, inventario…) — **DEBE** seguir este patrón de dos fases. Es el estándar, no una opción.

```
  ┌──────────┐   ┌────────────┐   ┌──────────┐   ┌──────────────┐   ┌────────┐   ┌───────────┐
  │ ANALYZE  │ → │ VALIDACIÓN │ → │ RESUMEN  │ → │ CONFIRMACIÓN │ → │ APPLY  │ → │ RESULTADO │
  │(read-only)│  │ (checks)   │   │(inferido)│   │ (usuario)    │   │(escribe│   │ (cuadre)  │
  └──────────┘   └────────────┘   └──────────┘   └──────────────┘   │ idempo)│   └───────────┘
                                                                     └────────┘
```

- **I1 — ANALYZE nunca escribe.** Lee el archivo, corre validaciones e inferencias, y devuelve un resumen. Cero efectos secundarios. Se puede correr mil veces sin consecuencia.
- **I2 — VALIDACIÓN por severidad.** Los hallazgos se clasifican:
  - **P0 Bloqueante** (impide el apply): documento duplicado en el archivo, correo de login en colisión, formato/encabezados inválidos, valor fuera de rango legal (ej. nota fuera de escala).
  - **P1 Advertencia** (no bloquea, se destaca): grado faltante en la secuencia, grupo sospechosamente pequeño/grande, variantes del mismo valor por tipeo, incoherencias (edad vs. grado), referencia a una entidad ausente.
  - **P2 Sugerencia** (informativa): normalización de tildes/casing, valores autogenerados, confirmaciones suaves.
- **I3 — RESUMEN antes de escribir (obligatorio).** El sistema muestra qué detectó e inferirá ("3 niveles · 42 grupos · 1.500 estudiantes") **antes** de tocar la base.
- **I4 — CONFIRMACIÓN humana explícita.** El `apply` solo ocurre tras una acción deliberada del usuario sobre el resumen. Nada se aplica "en automático" tras analizar.
- **I5 — APPLY es idempotente y reanudable** (AR4, AR5): reejecutar no duplica; una fila mala no tumba el lote; los errores se recolectan por fila.
- **I6 — RESULTADO es un cuadre estándar** (C3): `{ resumen, creados, actualizados, omitidos, errores[], advertencias[] }`. **Nada se aplica en silencio.**
- **I7 — Dependencias declaradas.** Cada importador declara sus precondiciones (ej. "requiere año lectivo y ecosistema"), que alimentan el grafo del Estado Canónico (§5) y se muestran como `blockedBy` — el usuario nunca choca contra una dependencia oculta.
- **I8 — Formato verificable, no adivinado.** Si el archivo no calza el formato oficial, se **rechaza** con mensaje claro; nunca se heuristican columnas para "adivinar" la intención.
- **I9 — Hacia un Motor de Importadores.** El objetivo de escalabilidad es un **contrato genérico `Importer`** (parse → analyze → apply, con `key`, `dependencies` y `templateSpec`) y **un** par de endpoints que despachen a un registro, de modo que agregar un importador nuevo sea *registrar*, no *replumbing*. Esta extracción se hace por **regla de tres** (CO6), no anticipadamente.

---

## 8. Arquitectura de UX (principios normativos)

La UX no es decoración; es parte del contrato de calidad. Estas reglas son obligatorias para toda pantalla.

- **UX1 — Nunca sorprender al usuario.** Ningún dato se pierde solo; ninguna acción irreversible ocurre sin aviso; ningún comportamiento contradice lo que la pantalla prometió.
- **UX2 — Todo error debe ser entendible y accionable.** Nada de códigos crípticos: qué pasó, dónde (fila/campo), cómo corregirlo. (Espejo de AR13 en la interfaz.)
- **UX3 — Todo proceso largo debe poder retomarse.** Save & resume por defecto (habilitado por el Estado Canónico, §5). Cerrar la pestaña nunca destruye el progreso.
- **UX4 — Siempre mostrar progreso.** Progreso ponderado y, cuando sea posible, expectativa de esfuerzo restante. El usuario siempre sabe cuánto avanzó y cuánto falta.
- **UX5 — Nunca bloquear sin explicar.** Un control deshabilitado siempre dice *por qué* y *qué desbloquearlo* (viaja en `blockedBy`/`actions[].motivo`).
- **UX6 — Previsualizar antes de actuar.** Ninguna operación importante escribe sin mostrar antes qué hará (espejo de P-PROD-3 e I3).
- **UX7 — Estados completos siempre.** Cada vista maneja los cuatro estados: vacío, cargando, error (con reintento), éxito (con conteos/constancia).
- **UX8 — Reducir la carga cognitiva.** No pedir lo que se puede inferir (P-PROD-1/2). Menos campos, más defaults sensatos, decisiones agrupadas.
- **UX9 — Confirmar lo destructivo, celebrar lo logrado.** Las acciones peligrosas se confirman; los hitos importantes se cierran con una señal clara de éxito y un puente hacia el siguiente paso útil.
- **UX10 — Coherencia.** Un patrón que el usuario aprende en un módulo se comporta igual en los demás. La consistencia es una función de confianza.
- **UX11 — Honestidad de la interfaz.** No se muestran opciones que no funcionan (sin "puertas sin cuarto"); lo que aún no existe se marca claramente como próximo.
- **UX12 — Mobile-first y accesible** (contrato §4.2): 375px primero, AA, `prefers-reduced-motion`, táctiles ≥44px.

---

## 9. Arquitectura de Escalabilidad

Cómo crece Edusyn a lo largo de años **sin romperse** cuando entran módulos nuevos (acudientes, horarios, biblioteca, convivencia, transporte, bienestar, inventario, …).

- **SC1 — Módulos autónomos, contratos estables.** Un módulo nuevo se acopla al sistema por **contratos** (API + Estado Canónico + eventos de auditoría), nunca por dependencias internas de otro módulo. Se puede construir, probar y desplegar sin tocar el corazón de otro.
- **SC2 — Todo módulo con ciclo de vida expone su Estado Canónico** (§5). Así, el sistema entero puede componer una visión de "salud institucional" iterando los estados de cada módulo, sin lógica especial por módulo.
- **SC3 — Toda incorporación masiva usa el patrón Importador** (§7). Un módulo nuevo no inventa su forma de cargar datos: adopta analyze→apply. A futuro, se registra en el Motor de Importadores (I9).
- **SC4 — Multi-tenant y auditoría son transversales, no opcionales.** Ningún módulo nuevo "se salta" el `institutionId` ni la auditoría. Son parte del andamiaje base que todo módulo hereda (AR6, AR9).
- **SC5 — Extensión sin modificación.** Agregar capacidad se hace **agregando** un módulo/importador/estado, no **modificando** el núcleo. Si un módulo nuevo obliga a cambiar el núcleo, es señal de que un contrato faltaba y hay que definirlo, no parchar.
- **SC6 — El dominio compartido se extrae, no se copia.** Conceptos que varios módulos usan (año lectivo, grado/nivel, tenant, roles) viven en un lugar común y se reutilizan (AR3). Copiarlos entre módulos es deuda.
- **SC7 — Migraciones y datos hacia adelante.** Todo cambio de esquema es una migración versionada y compatible; se evita romper datos existentes de colegios en producción (AR12).
- **SC8 — Deuda de seguridad se salda antes de escalar el riesgo.** El aislamiento multi-tenant a nivel de base (RLS en el núcleo académico) es un **prerrequisito** para escalar el volumen de PII de menores; no se difiere indefinidamente. *(Riesgo abierto vigente — ver §2 AR6.1.)*

---

## 10. Checklist de revisión (obligatorio para aceptar un módulo)

Ningún módulo nuevo de Edusyn se acepta hasta cumplir **todo** lo aplicable. Cada ítem cita la regla que lo respalda.

### Dominio y reglas
- [ ] **CH1** — Las reglas de negocio viven solo en el backend; el frontend no las duplica. *(AR1, AR3)*
- [ ] **CH2** — La lógica de dominio es invocable sin HTTP (endpoint/job/test). *(AR14, G1)*
- [ ] **CH3** — No hay ninguna regla implementada dos veces; lo compartido está extraído. *(AR3, SC6)*

### Estado y contrato
- [ ] **CH4** — Si el módulo tiene ciclo de vida, expone un **Estado Canónico** calculado en backend. *(AR10, §5)*
- [ ] **CH5** — El frontend no calcula progreso, elegibilidad, orden ni bloqueos; los recibe. *(AR2, E1–E2)*
- [ ] **CH6** — El contrato API (request/response/errores/estados) está definido y acordado **antes** de construir el frontend. *(AR11, C5)*
- [ ] **CH7** — Respuestas de la misma familia comparten forma; los procesos usan el cuadre estándar. *(AR8, C3, I6)*
- [ ] **CH8** — Los errores viajan estructurados y accionables (fila/campo, motivo, cómo corregir). *(AR13, C4, UX2)*

### Datos y procesos
- [ ] **CH9** — Todo proceso masivo es **idempotente**: reejecutar no duplica ni corrompe. *(AR4)*
- [ ] **CH10** — Los lotes grandes son **reanudables** con reporte por fila; no "todo-o-nada" ingenuo; sin veneno de conexión Prisma. *(AR5, AR5.1)*
- [ ] **CH11** — Toda incorporación masiva sigue el patrón Importador analyze→validación→resumen→confirmación→apply→resultado. *(§7 I1–I8)*
- [ ] **CH12** — Las dependencias/precondiciones del proceso están declaradas y se exponen como bloqueos explicables. *(I7, UX5)*

### Seguridad, tenant y auditoría
- [ ] **CH13** — Toda entidad y toda consulta acotan `institutionId`; sin acceso cruzado entre colegios. *(AR6)*
- [ ] **CH14** — Todo endpoint autentica y autoriza por rol explícito (deny-by-default). *(AR7)*
- [ ] **CH15** — Las operaciones sensibles dejan rastro auditable (quién, cuándo, qué, antes/después). *(AR9)*
- [ ] **CH16** — Datos personales minimizados; datos de menores con base legal/consentimiento registrado cuando aplique. *(P-PROD-5, §1.4)*
- [ ] **CH17** — Cambios de esquema por migración versionada; sin cambios manuales. *(AR12)*

### UX
- [ ] **CH18** — Cada vista maneja los estados vacío/cargando/error/éxito. *(UX7)*
- [ ] **CH19** — Nada se escribe sin previsualización; lo destructivo se confirma. *(P-PROD-3, UX6, UX9)*
- [ ] **CH20** — El proceso largo se puede retomar; el progreso es visible. *(UX3, UX4)*
- [ ] **CH21** — No hay controles bloqueados sin explicación ni opciones que no funcionan. *(UX5, UX11)*
- [ ] **CH22** — Mobile-first y accesibilidad AA cumplidas. *(UX12, §4.2)*

### Escalabilidad
- [ ] **CH23** — El módulo se acopla por contratos, no por internos de otro módulo; se despliega sin tocar el núcleo. *(SC1, SC5)*
- [ ] **CH24** — No se abstrajo prematuramente; las abstracciones nuevas salen de ≥3 usos reales. *(CO6, I9)*

---

## Cláusula de vigencia y enmienda

- Esta constitución es **obligatoria** para todo desarrollo futuro de Edusyn.
- Se **enmienda** solo de forma explícita: una propuesta de cambio a este documento, revisada y versionada. **Nunca** se deroga una regla por la vía de los hechos (código que la ignora).
- Ante conflicto entre un documento de módulo y esta constitución, **manda la constitución**, salvo enmienda formal.
- El incumplimiento de una regla en un PR es motivo suficiente para no aceptar el módulo (§10).

*Documento maestro. Versión 1.0. Anclado a los patrones reales verificados de Edusyn (NestJS · Prisma · PostgreSQL · multi-tenant por `institutionId` · dos fases analyze/apply · Estado canónico). Todo lo que aquí se afirma como "estado actual" está fechado y puede haber evolucionado: verificar contra el código vigente.*
