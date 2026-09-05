# Rediseño del Aula Virtual — plan maestro y bitácora

> **Este documento es la fuente de verdad del rediseño.** Si retomas el trabajo (otro agente,
> otra sesión), lee §1 a §5 antes de tocar código y actualiza §7 al terminar cada ticket.
>
> Rama: `feat/aula-virtual-rediseno` · Inicio: 2026-09-05 · Alcance: **solo frontend** (`apps/web`).

---

## 0. De dónde viene esto

Cuatro auditorías de solo-frontend sobre el aula actual (`apps/web/src/pages/Classroom.tsx`,
7110 líneas) y un prototipo navegable, entregados en
`C:\Users\LUIS C\Documents\kimi\tasks\2026-09-05\02-08-19-267ebaf9\`:

| Archivo | Contenido |
|---|---|
| `AUDITORIA-AULA-VIRTUAL.md` | Síntesis priorizada P0/P1/P2 + propuesta de IA |
| `informe-auditoria-ux-aula.md` | Actividades, contenidos y flujo de duplicado (45 hallazgos) |
| `auditoria-flujos-creacion-aula.md` | Creación, lecciones, rutas e IA |
| `auditoria-aula-virtual-ux.md` | Navegación, layout y Home |
| `prototipo-aula/` | Prototipo Vite+React con datos simulados |

**El prototipo NO se copia tal cual.** §2 explica qué se toma, qué se corrige y qué se agrega.

Documentos del proyecto con los que este rediseño debe ser coherente:
`docs/DESIGN_SYSTEM_LEARNING.md` (tokens), `docs/AUDITORIA_VISUAL_AULA.md` (por qué el aula se
siente fuera de sistema), `docs/EDUSYN_PRODUCT_ARCHITECTURE.md` (reglas AR1–AR14),
`CLAUDE.md` (convenciones de diálogos y fechas).

---

## 1. Diagnóstico en una frase

> El aula **funciona pero no comunica**: el estado del trabajo se codifica en un borde de color de
> 4 px sin leyenda, no hay búsqueda, el docente no tiene centro de control, y las operaciones
> sensibles (copiar, programar, reiniciar, devolver) se ejecutan de un clic sin previsualización.

Tres causas estructurales:

1. **El estado es invisible.** `openDate`, `scheduledPublishAt`, `maxAttempts`, `attemptNumber`,
   OVERDUE/RETURNED ya existen en los datos y nunca se pintan. Gran parte del rediseño es *revelar*.
2. **Los flujos sensibles no tienen ceremonia.** Y uno de ellos ("Cancelar programación") hace
   exactamente lo contrario de lo que promete.
3. **El módulo se escribió antes del Design System y nunca se migró** (`AUDITORIA_VISUAL_AULA.md`).

---

## 2. Decisiones tomadas (con el fundador, 2026-09-05)

### D1 · Arquitectura de información — 7 destinos

```
Aula Virtual
├── Selector de aula
└── Aula
    ├── Hoy          ← tablero por rol + muro de anuncios (reemplaza "Inicio" y "Anuncios")
    ├── Unidades     ← columna vertebral pedagógica: contenidos + actividades por unidad
    ├── Actividades  ← lista completa: búsqueda, filtros, agrupación conmutable
    ├── Rutas        ← rutas de aprendizaje con progreso inline
    ├── Expedición   ← ABP (se conserva: es otra superficie con su propio lenguaje, El Taller)
    ├── Foro
    ├── Notas        ← estudiante: sus notas · docente: planilla
    └── Estudiantes  (solo docente)
```

- **"Anuncios" deja de ser pestaña** y se convierte en el *muro* dentro de Hoy — es donde el
  estudiante ya está mirando.
- **"Expedición ABP" se conserva** como destino propio.

### D2 · Navegación — riel colapsable + barra inferior en móvil

El prototipo pone una barra fija de 224 px *dentro* de la página, pero `Layout.tsx` ya tiene un
menú global de 256 px: serían ~480 px de cromo en un portátil. En su lugar:

- **Escritorio:** riel de 64 px (solo iconos, con tooltip) que se expande a 232 px. El estado se
  recuerda en `localStorage` (`edusyn:aula:rail`). Por defecto expandido ≥ 1280 px, riel debajo.
- **Móvil:** **barra inferior** con los 4 destinos principales al alcance del pulgar
  (Hoy · Actividades · Unidades · Notas) + "Más". Los estudiantes usan celular; una hamburguesa
  esconde la navegación justo para quien más la necesita.
- **Header de contexto persistente** (aula › vista + selector de período con "Todos").
  Corrige además el bug F1 de la auditoría (la barra sticky quedaba bajo el header fijo móvil).

### D3 · Enlaces profundos

Rutas reales: `/classroom/:classroomId/:vista` y `/classroom/:classroomId/actividades/:activityId`.
Corrige P1-7: hoy el aula vive en `useState`, así que refrescar devuelve a la lista y el botón
"atrás" del navegador no funciona.

### D4 · Entrega — módulo nuevo con interruptor

Se construye el aula real (no otro prototipo) en `apps/web/src/pages/aula/`, wired contra los
endpoints existentes. Un interruptor la activa y deja la actual intacta como respaldo, para poder
desplegar a staging sin romper a docentes a mitad de período. Cuando el fundador valide, la nueva
pasa a ser el default y la vieja se retira.

### D5 · Lenguaje visual — el DS **más** una capa de ilustración

El fundador fue explícito: *"el diseño que propone el prototipo me gusta pero no me encanta, le
hace falta un poco más de visual — iconos, no los de las barras ni los del menú, sino los del
contenido."* Tiene razón, y hay un dato que lo confirma: **`apps/web` no tiene ni un solo SVG
propio**; toda la identidad visual son iconos de lucide y emoji.

Resolución de la tensión con `DESIGN_SYSTEM_LEARNING.md` (que pide silencio):

| El DS manda | Se añade para el aula |
|---|---|
| Canvas neutro, sin degradados full-screen | **Carátulas** de unidad y de aula con patrón geométrico + glifo |
| El color codifica significado, no adorna | El color sigue codificando **tipo** y **estado**; la ilustración aporta **identidad**, no estado |
| Elevación por superficie, no sombra | Se mantiene: superficies `surface-1/2/3` y `hairline` |

Capa nueva, toda **SVG en línea** (nada que descargar, escala sin pixelarse, respeta el tema):

- `SubjectMark` — identidad por asignatura derivada de su nombre (matemáticas → compás y cifras;
  lenguaje → libro; ciencias → matraz; sociales → globo; inglés → diálogo; arte → paleta…).
  Se usa en la tarjeta del aula, la carátula de unidad y el header.
- `ActivityGlyph` — el tile del tipo de actividad, con silueta propia por tipo (no un icono
  genérico dentro de un cuadrado de color).
- `ProgressRing` — progreso como anillo, no solo barra.
- `Stamp` — sello de "entregada"/"calificada" (a los estudiantes les funciona el sello).
- `Scene` — ilustraciones para estados vacíos, en vez del emoji 🔍 del prototipo.

**Regla de accesibilidad que gobierna todo:** el estado nunca se comunica solo por color ni solo
por emoji. Siempre **texto + icono + color**. Objetivos táctiles ≥ 44 px (`min-h-btn` ya existe en
`tailwind.config.cjs`). Contraste ≥ 4.5:1 → `text-ink-muted` en vez de `text-slate-400`.

---

## 3. Qué se toma del prototipo, qué se corrige

### Se adopta

- La arquitectura de información de 7 destinos.
- **Chips de estado con texto** (semáforo textual) en vez del borde de color mudo.
- **Línea de tiempos completa** en la tarjeta y el detalle: Publicada · Abre · Vence · Entregada ·
  Calificada, más "Intento 2 de 3".
- **Búsqueda + filtros + agrupación conmutable** (por unidad / estado / vencimiento) y período con
  opción "Todos".
- **Tableros "Hoy"** distintos por rol.
- **Wizard de copia en 4 pasos** con período **obligatorio**.

### Se corrige (defectos del propio prototipo, no arrastrar)

| # | Defecto del prototipo | Corrección |
|---|---|---|
| X1 | Pinta con `slate-*`/`blue-*` crudo: repite el hallazgo raíz de `AUDITORIA_VISUAL_AULA.md` | Todo con tokens del DS (`canvas`, `surface-1/2/3`, `ink-*`, `hairline`, `accent`) |
| X2 | `Hoy.tsx` calcula "vence hoy" con la fecha `'2026-05-20'` en duro | Derivación real con los helpers de `lib/datetime` (Colombia UTC-5) |
| X3 | `filtroInicial` solo se usa como estado inicial: navegar dos veces desde Hoy no reaplica el filtro | Filtro controlado, sincronizado con la URL |
| X4 | `useMemo` con `eslint-disable` en sus dependencias | Dependencias correctas; lógica de filtrado extraída a funciones puras probadas |
| X5 | La línea de tiempo son 5 columnas iguales con una línea absoluta: en 360 px las etiquetas chocan | Variante vertical en móvil; solo se muestran los hitos que existen |
| X6 | "Unidades" agrupa solo actividades e ignora los materiales | Une `Section.materials` + actividades: es el valor real de la pestaña |
| X7 | Emoji como canal principal de estado (⚠️📌🔁🔒) | Icono + texto + color; el emoji queda como decoración opcional |
| X8 | Cero estados de carga y de error | Skeletons, error con reintento, y vacío y error mutuamente excluyentes |
| X9 | `text-slate-400` como texto de contenido (≈3:1, no pasa AA) | `text-ink-muted` (#78786E, ≈4.7:1) |

---

## 4. Arquitectura del módulo

```
apps/web/src/pages/aula/
├── index.tsx            · AulaVirtual: rutas del módulo y carga del aula
├── AulaShell.tsx        · riel colapsable + header de contexto + barra inferior móvil
├── model/               · LÓGICA PURA, sin React — es lo que se prueba
│   ├── labels.ts        · glosario único: un solo nombre por tipo y por estado
│   ├── activityState.ts · derivación de estado (docente/estudiante), orden y agrupación
│   ├── periods.ts       · resolución de período de una actividad
│   ├── countdown.ts     · "Vence hoy", "Te quedan 2 días", "Venció hace 3 días"
│   └── *.test.ts        · vitest, entorno node (no hace falta DOM)
├── visual/              · capa de ilustración (SVG en línea)
│   ├── SubjectMark.tsx · ActivityGlyph.tsx · ProgressRing.tsx · Stamp.tsx · Scene.tsx
├── ui/                  · componentes compartidos del aula
│   └── StateChip.tsx · ActivityCard.tsx · EmptyState.tsx · Skeletons.tsx
└── views/               · una vista por destino
    └── Hoy.tsx · Unidades.tsx · Actividades.tsx · ActividadDetalle.tsx · …
```

**Regla de cableado:** las vistas no derivan estado. Toda decisión ("¿está vencida?",
"¿qué chip va?", "¿en qué grupo cae?") vive en `model/` como función pura y **se prueba**.
Las vistas solo piden datos y pintan. Así la lógica que hoy está enterrada en 7110 líneas
queda verificable sin montar React.

**Sin dependencias nuevas.** El prototipo trae shadcn/radix; el proyecto real usa Tailwind 3.4 +
lucide y no los necesita. Las páginas del prototipo, de hecho, no usan ni un componente de shadcn.

---

## 5. Convenciones obligatorias en este módulo

1. **Diálogos:** `confirmDialog` / `alertDialog` de `components/ui/confirm` + `toast` de
   `lib/toast`. Nunca `confirm()` / `alert()` / `prompt()` nativos (`CLAUDE.md`).
2. **Fechas:** helpers de `lib/datetime` (Colombia UTC-5). Nunca `toLocaleDateString` a secas.
3. **Cero `catch {}` vacíos.** Todo error visible con mensaje accionable (P0-5).
4. **Cero hex sueltos.** Solo tokens del DS. Excepción justificada: los colores de identidad de
   tipo de actividad, centralizados en `model/labels.ts`.
5. **Un solo nombre por concepto** (P2-1): "Quiz en vivo" (nunca "Live Quiz"/"En Línea"),
   "Quiz en casa" (nunca "En Casa"), "Devuelta" (nunca "Para revisar"/"Devuelto").

---

## 5.bis Garantías de datos — INNEGOCIABLE

> Instrucción del fundador (2026-09-05): *"nada en producción, todo a staging, y ten en cuenta
> que sea adecuado el traspaso cuando se intente utilizar en producción, es decir que no borre
> datos."*

Reglas que **todo agente que retome esto debe respetar**:

### G1 · Cero migraciones, cero esquema
El rediseño es **solo frontend**. No se toca Prisma, no se crea ni se altera ninguna tabla, no
hay `prisma migrate`. Si en algún momento parece que hace falta un campo nuevo en la base, **se
para y se pregunta**: no se añade de paso.

### G2 · Cero endpoints nuevos de borrado
El módulo nuevo consume **los mismos endpoints** que el aula actual (`classroomApi`). No se
crea ningún `delete*` nuevo. Los borrados que ya existen (actividad, material, sección) se
llaman igual que hoy, y solo detrás de `confirmDialog`.

### G3 · El interruptor es reversible y sin efectos
Cambiar entre aula actual y aula nueva **no escribe nada en el servidor**. Es una preferencia
de interfaz. Volver atrás deja todo exactamente como estaba: mismas actividades, mismas notas,
mismas entregas.

### G4 · El estado local del estudiante se hereda, no se pisa
El aula actual guarda "última visita" por dispositivo en **dos** claves redundantes:

```
edusyn:seenActs:<classroomId>     → milisegundos (Classroom.tsx:231, 729, 736)
classroom_visited_<classroomId>   → ISO string   (Classroom.tsx:2428-2431)
```

Sirven para marcar actividades como "nuevas". El módulo nuevo **lee las dos y sigue escribiendo
las dos**, para que:
- al estrenar el aula nueva, el estudiante no vea de golpe todo marcado como "nuevo";
- si vuelve al aula actual, tampoco.

Cuando se retire el aula actual, se puede dejar de escribir la clave vieja — **nunca antes**.

### G5 · La copia crea, jamás sobrescribe
El wizard de copia (T9) siempre **crea** una actividad nueva. Nunca modifica ni borra la
original. La copia nace como borrador y **no arrastra entregas ni notas** salvo que el docente
lo pida explícitamente.

### G6 · Los arreglos P0 van a favor del dato
Los defectos de §6 son, tres de ellos, riesgos de pérdida: "Cancelar programación" publica sin
querer, reiniciar lección borra intento/nota/XP de un clic, y "Devolver" se ejecuta aunque el
docente cancele. Arreglarlos **reduce** el riesgo de destruir evidencia académica. Ninguno de
esos arreglos borra nada por su cuenta.

### G7 · Ruta de despliegue
`feat/aula-virtual-rediseno` → **`staging`** únicamente. A `main` no se sube nada de este
trabajo sin decisión explícita del fundador. Antes de cualquier despliegue:
`npx tsc --noEmit` en `apps/web` y `npm test`; después, fila en `docs/REGISTRO_DESPLIEGUES.md`.

---

## 6. Defectos P0 heredados que hay que arreglar

Se arreglan en el **código actual** (`Classroom.tsx`), no solo en el módulo nuevo: son bugs que
están hoy en producción.

| # | Defecto | Evidencia |
|---|---|---|
| P0-1 | Copia de actividad opaca que produce copias "sin período", irreparables desde la UI | `Classroom.tsx:2704-2716` · raíz en `classroom.service.ts:2773` (crea sin `academicTermId`) · **corregido en el aula nueva** (T9) |
| P0-2 | "Cancelar programación" **publica** la actividad inmediatamente | `Classroom.tsx:5251` → `2533-2536` · **corregido en el aula nueva** (T8); falta en la actual |
| P0-3 | Reiniciar lección borra intento, nota y XP de un clic sobre la fila del estudiante | `Classroom.tsx:5577-5581` · **corregido** (T10) |
| P0-4 | "Devolver" se ejecuta aunque se cancele el `prompt()` nativo (`fb \|\| undefined`) | `Classroom.tsx:2955-2961` · **corregido en el aula nueva** (T8); falta en la actual |
| P0-5 | ~13 handlers con `catch {}` vacío: la UI miente | **8 mutaciones corregidas** (T10); quedan 28 `catch {}` de solo lectura |
| P0-6 | El rol ACUDIENTE cae en una vista que no lo contempla | `Layout.tsx:283` |

---

## 7. Bitácora de tickets

Estado: ⬜ pendiente · 🟡 en curso · ✅ hecho

| # | Ticket | Estado | Notas |
|---|---|---|---|
| T0 | Plan maestro (este documento) | ✅ | |
| T1 | `model/` + pruebas: glosario, estado, período, cuenta regresiva | ✅ | `b7a700c6` · 61 pruebas |
| T2 | `visual/`: SubjectMark, ActivityGlyph, Progress, Scene | ✅ | `44f5b655` · galería en `/galeria-aula.html` |
| T3 | `ui/`: StateChip, ActivityCard, EmptyState, Skeletons | ✅ | `83ec939f` |
| T4 | `AulaShell`: riel colapsable, header de contexto, barra inferior móvil | ✅ | Demo en `/shell-aula.html` |
| T5 | Vista **Hoy** (docente y estudiante) + muro de anuncios | ✅ | `e99911bc` · falta cablear a la API (T11) |
| T6 | Vista **Actividades**: búsqueda, filtros, agrupación | ✅ | `e25fe180` · la URL llega en T11 |
| T7 | Vista **Unidades**: materiales + actividades | ✅ | `bb628ade` |
| T8 | **Detalle de actividad**, entrega y calificación | ✅ | `36a0a09c` · corrige P0-2 y P0-4 |
| T9 | **Asistente de copia** (corrige P0-1) | ✅ | `4c56888c` |
| T10 | Defectos P0-3, P0-5 y H1 en el código actual | ✅ | `2b84b75f` · quedan 28 `catch {}` de solo lectura |
| T11 | Interruptor + montaje de rutas + enlaces profundos | ✅ | `e3065128` · rutas `/aula/*` |
| T12 | **Notas** y **Estudiantes** en el shell nuevo | ✅ | `f71a8abe` · Rutas, Expedición y Foro siguen con puente al aula actual |
| T13 | **Sesión de quiz en vivo** en todo el aula, con sondeo | ✅ | `2644282f` |
| T14 | Tarjetas verticales, agrupación por estado y portada de tipo | ✅ | `c5f89c02` · el peso visual sigue al estado |
| T15 | **Recorrido de la unidad**: recursos y actividades en un solo camino | ✅ | `31ea35c0` · usa el `sortOrder` que la interfaz ignoraba |
| T16 | Notas `Decimal` que llegan como texto (pantalla en blanco) | ✅ | `a053174d` · ver §11 |
| T17 | **Tema del estudiante**: elige el color con el que ve su aula | ✅ | `d69f15f2` · `ProveedorAcento` es el punto único |
| T18 | Texto que se salía de su caja en móvil (4 causas) | ✅ | `217dcdf8` · ver §11 |

---

## 7.bis Cómo entrar al aula nueva

1. `cd apps/web && npm run dev`, entrar con tu usuario.
2. Ir a **Aula Virtual** (o *Mis Clases*) → botón **"Probar la nueva aula"** arriba a la derecha.
3. O directamente: `/aula`.

Vuelta atrás: **"Volver al aula de siempre"** en la cabecera del selector, o `/classroom`.
Entrar y volver **no escribe nada en el servidor** (garantía G3).

**Ojo con el nombre del módulo:** vive en `apps/web/src/pages/aula/`, no en `pages/classroom/`.
Convivía con `pages/Classroom.tsx` diferenciándose solo en mayúsculas y TypeScript lo rechaza
en sistemas de archivos insensibles a mayúsculas (error TS1149).

---

## 8. Cómo probar

```bash
cd apps/web && npm test          # pruebas puras del model/
cd apps/web && npx tsc --noEmit  # obligatorio antes de main (CLAUDE.md)
```

**Páginas de revisión** (solo desarrollo), con `npm run dev`:

| Página | Qué muestra |
|---|---|
| <http://localhost:5173/galeria-aula.html> | Glifos, tarjetas en ambos roles, leyenda de estados, avance, sellos, estados vacíos |
| <http://localhost:5173/shell-aula.html> | El armazón: riel colapsable, migas, período, barra inferior. Conmuta rol y asignatura |

Ninguna de las dos entra al build de producción — Vite solo empaqueta `index.html`; verificado
en `dist/` tras `npm run build`.

### Decisiones de criterio que NO hay que "arreglar"

Dos comportamientos parecen bugs y son deliberados. Están fijados con pruebas; si alguien los
cambia, las pruebas caen y este es el porqué:

1. **Al estudiante, lo vencido va DESPUÉS de lo que todavía alcanza a entregar.**
   El orden heredado ponía lo vencido primero. Pero un taller que murió hace una semana por
   encima de un quiz que vence hoy es mal consejo: no puede viajar en el tiempo, y solo
   desmoraliza. El criterio es *qué puede ganar todavía*. Entre lo vencido manda lo más
   reciente, que es lo único recuperable hablando con el profe.
   (`activityState.ts` · `deriveStudentState`, `tieBreak: 'desc'`)

2. **Los paneles y los chips del docente se solapan a propósito.**
   Una actividad que vence hoy Y tiene entregas por calificar sale en los dos sitios, así que
   los conteos no suman al total. Derivarlos del estado excluyente de la tarjeta producía dos
   mentiras: el panel decía "Nada se cierra hoy" mientras el estudiante veía "Vence hoy a las
   5:00 p.m." de esa misma actividad, y el chip "Vencen hoy" desaparecía de la lista.
   Los predicados (`venceHoy`, `vencioSinEntregas`, `tieneEntregasPorCalificar`) viven en
   `activityState.ts` y los usan **tanto los paneles como los chips**; hay una prueba que
   cruza ambos. La auditoría ya advertía este solapamiento (C5).

3. **La sesión de quiz en vivo se sondea, no se consulta una sola vez.**
   El aula actual pregunta al montar el componente y ya. Pero el orden real de los hechos es:
   la clase entra al aula, y *después* el profe lanza el quiz — así que ese estudiante no se
   entera nunca. `useLiveSession` consulta cada 20 s (callado con la pestaña oculta). El
   `catch {}` de ese hook es la **única** excepción permitida a la regla de "cero catch
   vacíos": un fallo de red ahí no debe romper el aula, y el aviso reaparece al ciclo
   siguiente. (`data/useLiveSession.ts`)

4. **Los conteos de los chips respetan la búsqueda y el tipo.**
   El número de un chip es *cuántas verás al pulsarlo*, no cuántas hay en el aula. Con
   "taller" escrito, un chip que dijera 7 y mostrara 2 al pulsarlo sería peor que no poner
   número. (`list.ts` · `buildActivityList`, pasos 2–4)

4. **"Notas" del docente no es una planilla, y es a propósito.**
   Las notas del boletín viven en el módulo académico, con sus ventanas de calificación, su
   auditoría de cambios y su cierre de período. Abrir en el aula una segunda superficie de
   captura crearía **dos verdades sobre el mismo dato**. Aquí el docente ve el estado de su
   trabajo de revisión y un enlace a Calificaciones; la nota de una entrega concreta se pone
   en el detalle de esa actividad. Por lo mismo, el promedio del estudiante sale de
   `getMyGrades` y no se recalcula en el navegador. (`views/Notas.tsx`)

> **Tropiezo conocido: reinicia el servidor de desarrollo al crear archivos nuevos.**
> El escáner de Tailwind resuelve su lista de archivos al arrancar. Si creas un componente
> nuevo con `npm run dev` ya corriendo, funcionarán solo las clases que **ya existían en otro
> archivo del proyecto**, y las nuevas se caerán en silencio. Pasó aquí: `lg:flex` funcionaba y
> `lg:flex-col` no, y el riel se dibujaba en fila con los botones fuera de su caja. Se
> diagnostica en dos minutos con `getComputedStyle` y se arregla reiniciando el servidor.

Al cambiar cualquier cosa de `visual/` o `ui/`, **míralo ahí antes de dar por buena la pieza**.
Tres defectos de esta tanda solo se vieron mirando, no leyendo el código: el anillo dejaba un
punto a 0 %, el examen en borrador se le mostraba al estudiante como "Pendiente", y una
actividad ya calificada seguía gritando "Venció hace 8 días".

Despliegue: `staging` primero, y registrar la fila en `docs/REGISTRO_DESPLIEGUES.md`.

---

## 9. Qué falta (estado a 2026-09-05)

Los catorce tickets planificados están cerrados. Lo que sigue **no** está hecho, ordenado por
lo que más bloquea a un usuario real.

### 9.1 Bloquea a alguien hoy

| # | Qué | Por qué importa |
|---|---|---|
| F1 | **Crear y editar actividades** siguen en el aula actual | El formulario por intención (§6.1 del informe de flujos) y el editor de preguntas están dentro de `Classroom.tsx` y no son componentes reutilizables. En el aula nueva los botones existen y avisan antes de saltar, pero el docente termina cambiando de aula para trabajar. |
| F2 | **Motores de quiz, examen, simulacro y autoevaluación** | Igual: viven dentro de `ActivitiesTab`. El estudiante puede *ver* la actividad en el aula nueva pero la resuelve en la anterior. Lecciones y juegos sí funcionan (reusan `LessonPlayer`). |
| F3 | **Publicar y editar anuncios** | El muro dentro de "Hoy" es de solo lectura. El docente publica desde el aula actual. |
| F4 | **Entrega por audio** | El aula actual permite grabar audio en una tarea con `metadata.audioResponse`; el panel nuevo acepta texto y archivo, pero no grabación. |

### 9.2 Destinos aún no traídos

**Rutas**, **Expedición ABP** y **Foro** muestran un puente al aula actual. Los tres tienen
componente propio (`LearningRoutesTab`, `AbpTab`, `ForumTab`), así que traerlos es sobre todo
montarlos en el shell nuevo y revisarles el lenguaje visual — no reescribirlos.

### 9.3 Defectos conocidos que siguen abiertos

| # | Qué | Notas |
|---|---|---|
| P0-6 | El rol **ACUDIENTE** cae en la vista de estudiante | El aula nueva hereda el mismo criterio (`rol` = docente si DOCENTE/COORDINADOR, si no estudiante). Hace falta decidir **qué debe ver un acudiente** antes de programarlo: es una decisión de producto, no un bug. |
| P0-5 | Quedan **28 `catch {}`** en `Classroom.tsx` | Son cargas de solo lectura y guardas de `localStorage`/`JSON.parse`. Mienten menos (muestran vacío en vez de error) y tocarlas en bloque es más arriesgado que valioso. Se van con la retirada del aula actual. |

### 9.4 Verificación que no puedo hacer yo

- **Probar con datos reales.** Todo lo revisado hasta ahora usa datos de muestra o el adaptador
  simulado de la demo. Las rutas `/aula/*` están protegidas y necesitan una sesión.
- **Despliegue a staging.** Nada de este trabajo se ha desplegado (garantía G7).
- **Prueba con un docente y un estudiante de verdad**, que es lo único que dice si la nueva
  arquitectura de información se entiende sin explicarla.

### 9.5 Deuda asumida a propósito

- **Solo se prueba `model/`.** No hay pruebas de componentes: el proyecto no tiene
  `@testing-library` y añadirlo es una decisión aparte. La lógica que decide *qué se ve* sí
  está cubierta (120 pruebas).
- **El aula actual sigue siendo la predeterminada.** El cambio de default es tuyo, no mío.

---

## 10. Empalme con staging — qué puede y qué no puede pasarle a los datos

> Escrito porque staging **ya tiene grupos y actividades de ejemplo** y la pregunta del fundador
> fue directa: *"espero que este cambio no borre cosas"*. Esto es la respuesta verificada, no una
> promesa.

### 10.1 Lo que este cambio NO puede hacer

**No hay nada que migrar.** Verificado con `git diff --name-only <base>..HEAD`: el trabajo del
rediseño toca **solo `apps/web/` y `docs/`**. Cero archivos en `apps/api/`, cero en `prisma/`,
cero migraciones. El despliegue es un frontend nuevo contra el **mismo** backend.

**No hay endpoints nuevos.** El aula nueva consume exactamente los mismos que la actual.

**Nada corre solo.** No hay ninguna escritura automática al abrir el aula, al cambiar de vista
ni al filtrar. Todo lo que escribe nace de un clic explícito.

**Volver atrás no cuesta nada.** El aula actual sigue en `/classroom` y sigue siendo la
predeterminada. Revertir es revertir el frontend; no hay dato que deshacer.

### 10.2 Inventario completo de lo que SÍ escribe

Toda llamada de escritura del módulo `pages/aula/`, sin excepción:

| Llamada | La dispara | Efecto |
|---|---|---|
| `submitTask` / `updateSubmission` | El estudiante pulsa Enviar | Crea o actualiza **su propia** entrega |
| `uploadMaterial` | El estudiante adjunta un archivo | Sube el archivo |
| `gradeSubmission` | El docente pulsa Guardar nota | Escribe nota y comentario |
| `returnSubmission` | El docente pulsa Devolver | Marca la entrega como devuelta (comentario obligatorio) |
| `publishActivity` / `unpublishActivity` | El docente | Cambia visibilidad. `unpublish` **confirma** y avisa que las entregas no se borran |
| `duplicateActivity` | El asistente de copia | **Crea** una copia nueva. No toca el original |
| `deleteActivity` | El docente | Único borrado del módulo. Detrás de `confirmDialog` con aviso de irreversible |
| `updateSection` | Solo el arreglo de período del asistente de copia | **Ver 10.3** |

### 10.3 La única escritura con efecto no obvio

`updateSection({ academicTermId })` cambia el período de una **unidad**. Importa porque una
actividad hereda el período de su unidad cuando no tiene uno propio
(`periodIdOf = a.academicTermId ?? a.section?.academicTermId`): cambiar el de la unidad **mueve
de período** a las actividades que no lo tengan propio.

En un aula con datos reales eso puede reorganizar trabajo ya calificado, así que el asistente
lo confirma diciendo el efecto completo antes de hacerlo. **No borra nada**, pero es la única
acción del módulo que modifica algo preexistente distinto de lo que el usuario está mirando.

### 10.4 Continuidad del estado del estudiante

Ya resuelta en el código (garantía G4, `model/lastVisit.ts`, 11 pruebas): el aula nueva lee y
escribe **las dos** claves de "última visita" que usa la actual, así que estrenar el aula nueva
no le marca al estudiante todo como NUEVO, y volver a la actual tampoco.

### 10.5 Antes de subir a staging

- [ ] `npx tsc --noEmit` y `npm test` en `apps/web` — verde
- [ ] `npm run build` — y comprobar que `dist/` solo tiene `index.html` (las tres páginas de
      demo, `galeria-aula.html`, `shell-aula.html` y `aula-local.html`, **no** deben estar)
- [x] **Arrastre corregido.** Un `git add -A apps/web` demasiado amplio había metido en el
      commit `e3065128` cinco archivos que NO son del rediseño (`ValeriaAssistant.tsx`,
      `InstitutionLogin.tsx`, `LandingPage.tsx`, `Students.tsx`,
      `InstitutionalPortfolio.tsx`). Pertenecen a la entrada **"2026-09-02 — Demo rectoría,
      marca comercial y Valeria conversacional"** de `REGISTRO_DESPLIEGUES.md`, que dice
      explícitamente *"aislar estos archivos en un commit propio"* y tiene verificaciones
      pendientes antes de desplegar. Peor: `ValeriaAssistant.tsx` va emparejado con
      `apd-ai.service.ts`, que sigue sin commitear — subir solo la mitad web dejaría a Valeria
      con contextos nuevos sin el cambio de API que los acompaña.
      **Resuelto reconstruyendo la rama** (ver 10.7).
- [ ] Fila en `docs/REGISTRO_DESPLIEGUES.md` tras el push
- [ ] **A `main` no sube nada** sin decisión explícita del fundador (garantía G7)

### 10.6 Qué probar en staging, en este orden

1. **Que el aula actual sigue igual.** Entrar por `/classroom`, abrir un aula con datos, ver
   actividades y entregas. Nada debe haber cambiado salvo: reiniciar lección y borrar recurso
   ahora piden confirmación, y los errores ahora se ven.
2. **Entrar al aula nueva** por "Probar la nueva aula" y comprobar que se ven los mismos
   grupos, las mismas actividades y las mismas notas.
3. **Volver** con "Volver al aula de siempre" y comprobar que todo sigue en su sitio.
4. Recién entonces, probar entregar, calificar y copiar.

### 10.7 Cuál es la rama buena

| Rama | Qué es |
|---|---|
| **`feat/aula-rediseno`** | **La buena.** 25 commits, 53 archivos, **solo** el rediseño. Cero `apps/api`, cero migraciones, cero archivos de otras entradas de la bitácora. Es la que se despliega. |
| `feat/aula-virtual-rediseno` | La primera, con el arrastre. Se conserva por si hace falta consultar algo; **no desplegar desde aquí**. |

Reconstruida con `git cherry-pick` commit a commit desde el mismo punto de partida
(`13016f7e`), restaurando los cinco archivos ajenos a su estado original dentro del commit que
los había tocado. La historia queda igual de legible y el contenido, limpio.

Verificación de la rama limpia: `tsc` sin errores, **125 pruebas**, `npm run build` con
`dist/index.html` como único HTML (las tres páginas de demo no entran).

---

## 11. Trampas que ya nos costaron una pantalla rota

Cada una salió **con datos del colegio**, no con datos de prueba. Si vas a tocar
este módulo, léelas antes.

### 11.1 Las notas llegan como TEXTO, no como número

Los campos de nota son `Decimal` de Prisma y se serializan como **cadena** en el
JSON. `score.toFixed(1)` lanza y, como está dentro del render, **tumba la página
entera**: el estudiante ve una pantalla en blanco, no un error.

Usa siempre `aNumero()` (`model/activityState.ts`) al leer una nota que venga de
la API. Los tipos ya admiten `number | string`. Hay prueba de regresión en
`model/activityState.test.ts`.

### 11.2 El texto del docente trae espacios duros (U+00A0)

Cuando el docente pega desde Word, cada espacio viaja como `&nbsp;` y el
navegador lo convierte en U+00A0 al leer el HTML. **Un espacio duro no es sitio
por donde cortar la línea**, así que un párrafo entero cuenta como una sola
palabra: estiró la página a 2009 px en un celular de 375.

Todo texto libre escrito por una persona se pinta pasando por `textoLegible()`
(`model/texto.ts`), y además con `break-words` como red de seguridad para
enlaces largos. No se arregla en la base: el dato del colegio no se toca.

### 11.3 Un `<select>` nativo corta su etiqueta, no la recorta con "…"

Si la opción no cabe, un select la parte contra el borde: "Primer Período · e".
Parece una pantalla rota. Antes de meter un `<select>` con tope de ancho,
comprueba que la opción más larga quepa; si no, usa un botón + `Hoja` (así se
hizo con el período) o acorta las etiquetas.

### 11.4 `truncate` necesita `min-w-0` en TODA la cadena de flex

Le faltaba al enlace de las filas de recurso del recorrido: el enlace se quedó
en el ancho de su título completo (364 px dentro de una caja de 275) y la fila
se salió de la pantalla. `min-w-0` en el hijo no basta si un antepasado flexible
no lo tiene.

### 11.5 Lo que flota sobre una portada le quita ancho a TODAS las líneas

El anillo de progreso colgaba del borde y el título reservaba un pasillo de
40 px en cada renglón; en dos columnas de móvil eso partía "Pensamiento
computacional" en "computacion / al". Si algo flota, o va dentro de la portada,
o el pasillo se reserva solo en la primera línea.

### 11.6 Cómo cazarlas antes que el fundador

En el navegador, sobre el aula en móvil (375 px):

```js
// 1. ¿la página es más ancha que la pantalla?
document.documentElement.scrollWidth > innerWidth
// 2. ¿algún select corta su opción más larga?
[...document.querySelectorAll('select')].filter(s => {
  const cs = getComputedStyle(s), cv = document.createElement('canvas').getContext('2d')
  cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const ancha = Math.max(...[...s.options].map(o => cv.measureText(o.text).width))
  return ancha > s.getBoundingClientRect().width - 20 - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
})
```
