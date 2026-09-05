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

Se construye el aula real (no otro prototipo) en `apps/web/src/pages/classroom/`, wired contra los
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
apps/web/src/pages/classroom/
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
| P0-1 | Copia de actividad opaca que produce copias "sin período", irreparables desde la UI | `Classroom.tsx:2704-2716`, `6451-6532`, `quickCreateSection` 2230-2240 |
| P0-2 | "Cancelar programación" **publica** la actividad inmediatamente | `Classroom.tsx:5251` → `2533-2536` |
| P0-3 | Reiniciar lección borra intento, nota y XP de un clic sobre la fila del estudiante | `Classroom.tsx:5577-5581` |
| P0-4 | "Devolver" se ejecuta aunque se cancele el `prompt()` nativo (`fb \|\| undefined`) | `Classroom.tsx:2955-2961` |
| P0-5 | ~13 handlers con `catch {}` vacío: la UI miente | `1286,1290,1339,1343,2542,2557,2569,2960,3210` |
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
| T6 | Vista **Actividades**: búsqueda, filtros, agrupación, URL | ⬜ | |
| T7 | Vista **Unidades**: materiales + actividades | ⬜ | |
| T8 | **Detalle de actividad** con línea de tiempos e intentos | ⬜ | |
| T9 | **Wizard de copia** en 4 pasos (corrige P0-1) | ⬜ | |
| T10 | Defectos P0-2 … P0-5 en el código actual | ⬜ | |
| T11 | Interruptor + montaje de rutas + enlaces profundos | ⬜ | |
| T12 | Notas, Foro, Rutas, Estudiantes en el shell nuevo | ⬜ | |

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

2. **Los cuatro paneles del docente se solapan a propósito.**
   Una actividad que vence hoy Y tiene entregas por calificar sale en los dos sitios, así que
   los conteos no suman al total. Derivarlos del estado excluyente de la tarjeta producía una
   mentira: el panel decía "Nada se cierra hoy" mientras el estudiante veía "Vence hoy a las
   5:00 p.m." de esa misma actividad. La auditoría ya advertía este solapamiento (C5).
   (`today.ts` · `buildTeacherToday`)

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
