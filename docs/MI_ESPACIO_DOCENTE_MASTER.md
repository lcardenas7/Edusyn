# Mi Espacio Docente — Documento Maestro de Arquitectura y Diseño

> Propuesta integral para convertir el Espacio Docente en el **Centro de Trabajo del Docente**.
> Escrito desde el rol de Lead Product Designer + UX + Software Architect.
> **No es una especificación complaciente.** Contiene crítica al brief, simplificaciones y propuestas que van más allá de lo pedido.
>
> **Versión:** 2.0 · **Fecha:** 2026-06-28 · **Entorno:** STAGING · **Owner:** Luis Cárdenas
> Supersede a `MI_ESPACIO_DOCENTE_REVISION.md` y extiende `MI_ESPACIO_DOCENTE_VISION.md`.
> **La implementación NO comienza hasta aprobar este documento.**

---

## Cómo leer este documento

Son 20 secciones. Si solo lees 3, lee:
- **§0 — La tesis** (el insight que cambia todo).
- **§4 — Arquitectura de datos** (las decisiones técnicas).
- **§14 — Roadmap por fases** (qué se hace y en qué orden).

---

# §0. La tesis (y mi mayor crítica al brief)

Tu brief lista **9 módulos** (Bitácora, Observaciones, Recaudo, Roles, Recursos, Proyecto, Lista, Tablero, Personal) + Calendario + Seguimientos. Tratados como 9 cosas separadas, eso son 9 CRUDs, 9 UIs, 9 modelos. **Sería un error de arquitectura.** Construiríamos lo mismo nueve veces y el resultado se sentiría como un CRUD, justo lo que NO quieres.

**Mi tesis: todo el Espacio Docente se reduce a 2 primitivas + 3 sub-dominios + 2 capas transversales.**

```
PRIMITIVAS (el 70% de los módulos son esto)
  1. ENTRY  → un registro de texto con fecha   (Bitácora, Observación, Nota, Idea)
  2. TASK   → un pendiente con estado           (Lista, Checklist, Card de Kanban, Tarea de Proyecto)

SUB-DOMINIOS (necesitan estructura relacional real)
  3. RECAUDO    → concepto + cargo por estudiante + pagos
  4. ROLES      → catálogo + asignaciones con historial
  5. BIBLIOTECA → archivos (carpetas, etiquetas)

CAPAS TRANSVERSALES (atraviesan todo)
  A. CALENDARIO / EVENTOS   → cualquier registro puede tener una fecha-acción
  B. SEGUIMIENTOS           → cualquier registro puede generar un follow-up
```

Bajo esta lente:
- **Bitácora, Observaciones, Notas, Ideas** = la misma ENTRY con `kind` distinto. Una implementación, no cuatro.
- **Lista, checklist de Proyecto, cards de Tablero, pendientes del Personal** = la misma TASK. Una implementación, no cuatro.
- **Proyecto** = un contenedor que agrupa ENTRIES + TASKS + archivos + comentarios. No es un módulo aparte, es una *vista compuesta* de las primitivas.
- **Tablero libre** = TASKs agrupadas por `columna` (que ya existe: `WorkspaceColumn`). No es un módulo nuevo, es una *vista* de TASKs.
- **Espacio Personal "mini Notion"** = un espacio sin curso que usa las mismas primitivas. **No construimos un Notion** — reusamos ENTRY/TASK/Event/Files. (Crítica directa a "mini Notion": un Notion real es años de trabajo; lo que necesitas es las primitivas en un espacio sin grupo.)

**Esto es lo que hace que el módulo escale y se sienta coherente, no como nueve herramientas pegadas.**

---

# §1. Evaluación crítica del sistema actual

## Lo que ya está bien y se conserva
- Infra de staging operativa (copia real de prod) → podemos probar migraciones sin riesgo.
- Modelo base `WorkspaceBoard` / `WorkspaceColumn` / `WorkspaceItem` + campos aditivos ya migrados (`kind`, `amount`, `emoji`, `isPinned`, etc.).
- Módulo `storage` (R2/Supabase) ya existe → archivos viables sin infra nueva.
- El servicio **ya lee el roster oficial en solo-lectura** (`getScopeOptions`, `searchStudentsForBoard`) → la base del "puente sin escritura" ya está.
- Componentes V2 ya hechos (Greeting, SpaceCard, tabs, CaptureBar, CollectionRow).

## Lo que está mal (crítica honesta)
1. **Modelo "1 tablero = 1 tipo"** choca con "1 curso = varios módulos". (Detallado en doc previo.)
2. **Doble fuente de verdad**: `item.kind` (columna) vs `metadata.kind` (lo que escribe la captura V2). Hay que unificar a la columna.
3. **Recaudo plano**: `metadata.amountPaid` (un número) no soporta varios recaudos, parciales ni historial.
4. **Sin primitiva de TASK real**: el "status" existe pero no hay prioridad, responsable, ni una vista unificada de pendientes.
5. **Sin capa de Seguimientos ni Eventos**: hoy no existen; son el corazón de tu nueva visión.
6. **Dashboard = colección de tarjetas**, no responde "¿qué hago hoy?".
7. **UI interna**: banner alto, ícono tapado, espacio desperdiciado.
8. **Riesgo de N+1**: el patrón de otros reportes (bucle de fetch por grupo) no debe repetirse en el dashboard.

---

# §2. Problemas encontrados (resumen accionable)

| # | Problema | Severidad | Solución (sección) |
|---|----------|-----------|--------------------|
| P1 | Modelo 1-tablero-1-tipo | 🔴 Alta | §4 (Espacio = contenedor) |
| P2 | Módulos redundantes (4 checklists, 4 editores de texto) | 🔴 Alta | §0 (2 primitivas) |
| P3 | Recaudo no soporta el caso real | 🔴 Alta | §4.3 |
| P4 | No existe Seguimientos | 🟠 Media | §4.5 |
| P5 | No existe Calendario/Eventos | 🟠 Media | §4.4 |
| P6 | Doble fuente de verdad kind | 🟠 Media | §16 (migración) |
| P7 | Dashboard poco útil | 🟠 Media | §6 |
| P8 | UI interna (banner/ícono) | 🟡 Baja | §6 |
| P9 | Naming "+ Agregar espacio" confunde | 🟡 Baja | §8 |
| P10 | Riesgo performance dashboard | 🟠 Media | §13 |

---

# §3. Oportunidades de mejora + diferenciadores (más allá del brief)

Estas son ideas que **tu brief no incluye** y que harían del Espacio Docente algo único en plataformas educativas:

1. **Puente de solo-lectura con el sistema oficial.** Tu regla dice "nunca *modificar* lo oficial" — pero *leer* es seguro y poderoso. El curso debe **mostrar** (sin reescribir) el roster oficial, el horario y las fechas de períodos. Así Roles/Observaciones/Recaudo no piden re-ingresar estudiantes, y el calendario puede mostrar (en gris, no editable) las fechas oficiales del período. **Diferenciador enorme y 100% seguro.**

2. **Captura rápida global (Cmd/Ctrl+K).** Desde cualquier pantalla: "anotar", "nuevo pendiente", "recordar". Estilo ClickUp/Notion. Reduce fricción a cero — clave para "abrir todos los días".

3. **Plantillas.** Tu brief las menciona solo en Personal. Las elevo a transversales: una plantilla "Salida pedagógica" crea de un golpe un recaudo + checklist + evento + carpeta de recursos. Esto es lo que convierte tareas repetitivas en un clic.

4. **Ritual de inicio/cierre de día.** Al abrir: *"Hoy: 2 seguimientos, 1 recaudo vence, reunión 3pm."* Al cerrar: *"Cerraste 4 cosas. Mañana tienes…"*. Esto crea el hábito diario que persigues.

5. **Resumen semanal automático** (viernes): qué se hizo, qué queda.

6. **Seguimientos como motor del dashboard** (tu idea, la elevo a entidad de primer nivel — §4.5).

## Mi crítica simplificadora (qué quitar o fusionar)
- **"+ Agregar espacio" → renombrar a "+ Activar módulo".** Agrega un módulo, no un espacio. El naming actual confunde.
- **No empujar la fecha de creación al calendario.** Si todo cae al calendario, se vuelve ruido. El calendario muestra **eventos** (fecha que importa) y **seguimientos** (acción pendiente), no cada creación. La fecha de creación queda como metadato. *(Matiz a tu "todo puede terminar en el calendario": sí puede, pero por decisión del docente, no por defecto.)*
- **Unificar Evento + Recordatorio + Seguimiento.** Son lo mismo con matices: algo con fecha y, a veces, una acción y un estado. Tres tablas separadas = deuda. Propongo **una** entidad con discriminador (§4.4/4.5).
- **Espacio Personal no es un Notion nuevo** — es las primitivas en un espacio sin curso.

---

# §4. Arquitectura de datos

> Todo **aditivo**. Nada escribe sobre el core académico. Se prueba en staging antes de prod.

## 4.1 El contenedor: Espacio
`WorkspaceBoard` se reconceptualiza como **Espacio**:
- `COURSE` (ligado a un grupo) — contiene módulos.
- `PERSONAL` (`isPersonal=true`).
```
WorkspaceBoard  (+ ya migrados: emoji, coverImage, isPinned, isPersonal, linkedClassId, lastAccessedAt)
  + enabledModules String[] @default([])   // módulos activados manualmente
  + isCourseSpace  Boolean  @default(false) // marca de espacio-curso (evita tocar el enum type)
```
**Módulo visible si:** tiene ≥1 registro **O** está en `enabledModules`.

## 4.2 Primitivas
**ENTRY y TASK son el mismo `WorkspaceItem`** (ya existe) discriminado por `kind`:
```
WorkspaceItem (ya existe) — consolidar:
  kind        // ENTRY: LOG|OBSERVATION|NOTE|IDEA   ·   TASK: TASK   ·   EVENT
  entryType?  String?   // sub-tipo de ENTRY: clase|reunion|idea|llamada|incidente|otro
  scope?      String?   // observación: 'GENERAL' | 'INDIVIDUAL'
  + priority   (LOW|MEDIUM|HIGH)?      // TASK
  + isImportant Boolean @default(false) // ENTRY "importante"
  + assigneeId String?                  // TASK responsable (User, opcional)
  (ya existe: status, completedAt, dueDate, eventDate, studentId, columnId, tags, metadata)
```
- **Bitácora** = ENTRY con `entryType`.
- **Observaciones** = ENTRY `kind=OBSERVATION` + `scope` (general/individual) + `studentId`.
- **Lista** = TASK con prioridad/fecha/responsable.
- **Tablero libre** = TASK + `columnId` (usa `WorkspaceColumn`, ya existe).
- **Notas/Ideas (Personal)** = ENTRY `kind=NOTE|IDEA`.

## 4.3 Sub-dominio Recaudo (3 tablas nuevas)
```
WorkspaceCollection        { id, boardId, name, description?, unitValue Decimal, dueDate?, createdAt }
WorkspaceCollectionCharge  { id, collectionId, studentId, status(PENDING|PARTIAL|PAID) }
WorkspaceCollectionPayment { id, chargeId, amount Decimal, paidAt, note? }
```
**Meta = unitValue × nº cargos** (calculada, nunca manual). Saldo, progreso, historial: derivados de pagos.

## 4.4 Capa Calendario/Eventos (1 tabla, unificada con recordatorios)
```
WorkspaceEvent {
  id, boardId, itemId?,        // ligado a un registro (opcional)
  title, date DateTime, time?,
  type (REMINDER|MEETING|DEADLINE|ACTIVITY|OTHER),
  done Boolean @default(false),
  createdAt
}
```
Calendario del dashboard = `WorkspaceEvent` de todos los espacios del docente + (read-only) fechas oficiales del período.

## 4.5 Capa Seguimientos (1 tabla — entidad de primer nivel)
El "seguimiento" es lo que tu visión pone en el centro. Es polimórfico: cualquier registro lo genera.
```
WorkspaceFollowUp {
  id, boardId,
  sourceType (OBSERVATION|BITACORA|PROJECT|COLLECTION|TASK|MANUAL),
  sourceItemId?,          // referencia blanda al origen
  studentId?,             // si aplica
  title, notes?,
  dueDate?,               // si tiene fecha → también aparece en calendario
  status (OPEN|IN_PROGRESS|DONE),
  createdAt, resolvedAt?
}
```
**Los seguimientos OPEN alimentan el dashboard** ("¿qué tengo pendiente?"). Si tienen `dueDate`, se reflejan en el calendario. *(Así Evento y Seguimiento comparten el eje fecha sin duplicar: el evento es "algo pasa ese día", el seguimiento es "debo hacer algo, quizá con fecha".)*

## 4.6 Archivos (1 tabla compartida)
```
WorkspaceAttachment {
  id, boardId, itemId?, collectionId?, folder?,
  fileName, mimeType, sizeBytes, url,   // url del storage existente
  tags String[] @default([]), uploadedAt
}
```
Sirve a Biblioteca, Bitácora, Proyecto, Recaudo. Sube vía `StorageService.upload()`.

## 4.7 Roles (2 tablas)
```
WorkspaceRole           { id, boardId, name, isCustom Boolean }
WorkspaceRoleAssignment { id, roleId, studentId, assignedAt, removedAt? }  // historial
```

## 4.8 Proyecto (contenedor, sin tabla pesada nueva)
Proyecto = `WorkspaceItem(kind=PROJECT)` con `metadata` (objetivo, competencias, %) + reúso de:
- TASKs (checklist) con `metadata.projectId`
- `WorkspaceAttachment` (evidencias/productos)
- `WorkspaceItemComment { id, itemId, authorId, text, createdAt }` (comentarios — reutilizable)
- integrantes: `metadata.memberStudentIds` (read-only del roster)

## 4.9 Plantillas (diferenciador)
```
WorkspaceTemplate {
  id, ownerId?, institutionId?, scope(PERSONAL|INSTITUTION),
  name, description?, definition Json   // receta: módulos+items+eventos a crear
}
```

**Resumen: ~9 tablas nuevas + campos aditivos.** Ni una toca el core académico.

---

# §5. Arquitectura visual (sistema de diseño)

- **Paleta**: fondo crema/papel (`#FAF8F3`) — "esto es tuyo, no del colegio". Acento por espacio (color del curso).
- **Tipografía**: serif elegante en títulos (señal personal), sans (Inter) en cuerpo.
- **Jerarquía**: banner BAJO (≤96px), ícono a la izquierda del título (no flotando tapado), contenido al frente.
- **Densidad**: tarjetas −25%. Más información por pantalla.
- **Etiquetas de estado** (componente único `StatusBadge`): Hoy · Pendiente · Hace 3 días · Nuevo · Urgente · Resuelto. Calculadas desde fechas/flags.
- **Microinteracciones** (framer-motion ya disponible): transiciones suaves, check con tachado, sin toasts molestos.

---

# §6. Flujos de usuario clave

**F-A. Inicio de día:** abre → dashboard responde "hoy / pendientes / curso que necesita atención / recaudos / próximos eventos / seguimientos abiertos".

**F-B. Abrir curso:** no entra a una pestaña — ve un **mini-dashboard del curso** (estudiantes, última actividad, próximo evento, módulos activos, seguimientos pendientes) y debajo los módulos activos.

**F-C. Activar módulo:** "+ Activar módulo" → elige → aparece su tarjeta.

**F-D. Crear registro con fecha opcional:** escribe → *"¿solo guardar fecha?"* vs *"agregar al calendario"* vs *"crear seguimiento"*.

**F-E. Recaudo:** crea "Libro" $80.000 → asigna 25 → meta $2.000.000 auto → registra pagos parciales → progreso e historial.

**F-F. Seguimiento desde observación:** registra observación individual → "crear seguimiento" → aparece en dashboard hasta resolverlo.

---

# §7-9. Wireframes / Mockups ASCII

## Dashboard (centro de productividad)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Buenos días, Luis · jueves 28 de junio                          ⌘K  👤      │
│                                                                              │
│ ┌── HOY ───────────────────────────┐ ┌── CALENDARIO ──── junio  ◀ ▶ ─────┐ │
│ │ ⚠ Recaudo "Libro" 8A vence hoy   │ │  L  M  X  J  V  S  D               │ │
│ │ 📌 Seguimiento: llamar acudiente │ │              1  2  3               │ │
│ │    de Mariana (8B)               │ │  4  5  6  7 [8] 9 10  ● evento     │ │
│ │ 📅 Reunión padres 10C · 3:00pm   │ │ 11 12 13●14 15 16 17  ◦ oficial    │ │
│ └──────────────────────────────────┘ │ 18 19 20 21 22 23 24               │ │
│                                       └────────────────────────────────────┘ │
│ ┌── SEGUIMIENTOS ABIERTOS (3) ─────┐ ┌── MIS CURSOS ────────────────────┐ │
│ │ • Mariana 8B — observación        │ │ ┌──────┐┌──────┐┌──────┐┌─ + ─┐ │ │
│ │ • Proyecto feria — entrega ✎      │ │ │📐 8A ││📘 8B ││∫ 10C ││curso│ │ │
│ │ • Cobro fotocopias 10C            │ │ │•Hoy  ││2 pend││Nuevo ││     │ │ │
│ └───────────────────────────────────┘ │ └──────┘└──────┘└──────┘└─────┘ │ │
│                                       └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

## Mini-dashboard del curso
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Mi Espacio   📐 8A — Matemáticas   [banner bajo]                  ⚙ ···   │
│ 28 estudiantes · última actividad hace 2h · próximo: reunión 30 jun         │
│ 3 módulos activos · 2 seguimientos abiertos                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ MÓDULOS                                                   + Activar módulo  │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                               │
│ │📖 Bitácora │ │💰 Recaudo  │ │🎭 Roles    │   (los no usados NO aparecen) │
│ │12 · Hoy    │ │2 · ⚠$480k  │ │4 · ayer    │                               │
│ └────────────┘ └────────────┘ └────────────┘                               │
└────────────────────────────────────────────────────────────────────────────┘
```

## Captura con destino de fecha
```
╭──────────────────────────────────────────────────────────╮
│ Escribe tu entrada…                                       │
│ [Clase ▾]  #etiqueta            ☆ Importante              │
│ ○ Solo guardar (fecha de hoy)                             │
│ ○ Agregar evento al calendario     [ 📅 fecha ]          │
│ ○ Crear seguimiento                [ 📌 fecha opcional ]  │
│                                       [ Guardar  ⌘↵ ]     │
╰──────────────────────────────────────────────────────────╯
```

---

# §10. Componentes reutilizables

| Componente | Reusado por |
|------------|-------------|
| `EntryEditor` | Bitácora, Observaciones, Notas/Ideas |
| `TaskItem` / `TaskList` | Lista, checklist de Proyecto, Personal |
| `KanbanBoard` | Tablero libre, Proyecto (vista) |
| `StudentPicker` (con foto) | Roles, Observaciones, Recaudo, Proyecto |
| `EventComposer` | todos (fecha opcional) |
| `FollowUpButton` / `FollowUpList` | todos + dashboard |
| `AttachmentUploader` / `FileGrid` | Biblioteca, Bitácora, Proyecto, Recaudo |
| `StatusBadge`, `TagInput`, `ReminderPicker` | transversales |
| `MiniCalendar`, `TodayPanel` | dashboard, curso |
| `QuickCapture` (⌘K) | global |

---

# §11. Nuevos modelos de datos
Resumen (detalle en §4): `WorkspaceCollection`, `WorkspaceCollectionCharge`, `WorkspaceCollectionPayment`, `WorkspaceEvent`, `WorkspaceFollowUp`, `WorkspaceAttachment`, `WorkspaceRole`, `WorkspaceRoleAssignment`, `WorkspaceItemComment`, `WorkspaceTemplate` + campos aditivos en `WorkspaceBoard`/`WorkspaceItem`.

---

# §12. Estrategia de migración

1. **Aditiva primero** (campos + tablas nuevas). Cero riesgo.
2. **Backfill `item.kind`** desde `metadata.kind` y desde el `type` del tablero (resuelve la doble fuente de verdad).
3. **Espacios de curso**: por `(teacher, group)` designar/crear un Espacio `COURSE`; absorber items viejos asignando `kind`.
4. **Recaudo**: `metadata.amountPaid` → `Collection/Charge/Payment` (lo pagado se vuelve un pago histórico).
5. **Roles**: `metadata.role` → `WorkspaceRole/Assignment`.
6. Tableros viejos → archivados (no se borran). UI clásica sigue tras flag.
7. **Todo se ejecuta y verifica en staging** (datos reales restaurados) antes de prod.

---

# §13. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Migración de 23 tableros corrompe datos | Probar en staging, backups, tableros viejos archivados (reversible) |
| Dashboard lento (N+1) | Endpoint único `GET /workspace/today` agregado en una query |
| Scope creep ("mini Notion") | Reducir a primitivas; cortar features no esenciales |
| Subida de archivos abusa storage | Límite de tamaño por archivo + cuota por docente |
| Doble fuente de verdad persiste | Backfill + escribir SIEMPRE a la columna `kind` |
| Mezcla con WorkspaceV2 en rama staging | Commits en archivos separados, cherry-pick limpio a main |

---

# §14. Roadmap por fases (cada una desplegable y verificable en staging)

| Fase | Entrega | Depende |
|------|---------|---------|
| **F0** | Migración aditiva (tablas + campos) + backfill kind | — |
| **F1** | Espacios de curso + módulos bajo demanda + "+ Activar módulo" | F0 |
| **F2** | Dashboard útil (TodayPanel + cursos compactos) + endpoint `/workspace/today` | F1 |
| **F3** | Calendario (`WorkspaceEvent`) + EventComposer + capa read-only fechas oficiales | F2 |
| **F4** | Seguimientos (`WorkspaceFollowUp`) transversal + en dashboard | F2 |
| **F5** | Bitácora completa (tipos, etiquetas, estados, adjuntos, buscar/filtrar) | F1 |
| **F6** | Recaudo (3 tablas, meta auto, parciales, historial) | F0 |
| **F7** | Roles (catálogo + foto + historial) | F0 |
| **F8** | Observaciones (general/individual + seguimiento) | F4 |
| **F9** | Biblioteca (archivos, carpetas, etiquetas) | F0 |
| **F10** | Proyecto (objetivo, competencias, checklist, evidencias, comentarios) | F5 |
| **F11** | Lista + Tablero libre (Kanban DnD) | F1 |
| **F12** | Espacio Personal (primitivas sin curso) | F5 |
| **F13** | Diferenciadores: ⌘K, Plantillas, ritual de día, resumen semanal | F2-F4 |
| **F14** | Responsive completo + pulido + plan de pruebas | todas |

**Recomendado:** F0→F1→F2→F3→F4 transforma la sensación del módulo (contenedor + dashboard + calendario + seguimientos). Luego F6/F7/F5 (mayor valor funcional). F9-F13 enriquecen. F14 cierra.

---

# §15-18. Qué reutilizar / eliminar / refactorizar / construir

**Reutilizar:** `WorkspaceBoard/Column/Item` + campos aditivos · módulo `storage` · lectura del roster oficial · componentes V2 (Greeting, SpaceCard, CaptureBar, CollectionRow → evoluciona) · framer-motion.

**Eliminar:** la dependencia de `metadata.kind` (migrar a columna) · meta manual de recaudo · la idea de "tablero por tipo" en la UI · naming "+ Agregar espacio".

**Refactorizar:** `SpaceDetail` (pestañas → módulos bajo demanda) · `filterForSection` (heurísticas frágiles → kind confiable) · recaudo puente (metadata → tablas) · banner/header interno.

**Construir desde cero:** capa Calendario · capa Seguimientos · sub-dominio Recaudo relacional · Roles relacional · Biblioteca · Proyecto compuesto · TodayPanel/MiniCalendar · QuickCapture · Plantillas.

---

# §19. Plan de pruebas

- **Unit (backend)**: cálculo de meta/saldo de recaudo, estado de seguimiento, agregación `/workspace/today`, backfill de kind.
- **Migración**: correr en staging sobre los 23 tableros reales → verificar conteos pre/post, que la UI clásica sigue leyendo, que Recaudo/Roles migraron sin pérdida.
- **Integración (API)**: módulos aparecen/desaparecen según registros; archivos suben y se listan; eventos/seguimientos aparecen en dashboard.
- **E2E manual en staging**: los 6 flujos (§6) en desktop + móvil.
- **Regresión**: confirmar que nada del core académico cambió (notas, observador, asistencia intactos).

---

# §20. Estrategia de despliegue en STAGING

1. Cada fase → rama de trabajo → merge a `staging` → deploy automático (Railway) → verificación.
2. Migraciones: `prisma migrate deploy` corre en el deploy; cada migración aditiva probada en staging primero.
3. Feature flag `WORKSPACE_V2` controla visibilidad; UI clásica disponible como respaldo.
4. Verificación por fase con checklist de §19.
5. Solo cuando una fase está validada en staging se considera para prod (cherry-pick de commits separados).
6. Backups de la BD antes de cada migración que transforme datos (F1 absorción, F6/F7 conversión).

---

## Decisiones (APROBADAS — 2026-06-28)

1. ✅ Tesis §0 (2 primitivas + 3 sub-dominios + 2 capas) — aprobada.
2. ✅ Diferenciadores §3 — aprobados.
3. ✅ Unificar a `WorkspaceEvent` + `WorkspaceFollowUp` — aprobado.
4. ✅ Roadmap §14 — aprobado (con incorporaciones §21-§24 abajo).

---

# §21. Mejoras oficiales incorporadas (aprobadas 2026-06-28)

Estas 16 directrices pasan a ser parte oficial del proyecto:

1. **El Workspace ES el centro de trabajo del docente.** Filtro de toda decisión: *"¿esto ayuda al docente a organizar mejor su día?"* Si no, se replantea.
2. **Dashboard configurable por widgets.** Cada docente elige qué ver/ocultar y en qué orden → nuevo modelo `WorkspaceDashboardConfig`.
3. **Centro del día.** El Home abre la jornada: *"Hoy tienes: 2 seguimientos, 1 recaudo, reunión 2:30pm… ¿en qué quieres trabajar?"* Es la experiencia principal (no solo datos).
4. **Timeline del curso.** Vista cronológica integrada de todo lo del curso sin importar el módulo → se resuelve con `WorkspaceActivity` (sin UNION costoso).
5. **Búsqueda global transversal.** Un solo buscador encuentra en observaciones, bitácora, proyectos, recaudos, roles, recursos, notas, seguimientos. No búsqueda por módulo.
6. **Actividad reciente.** Widget alimentado por `WorkspaceActivity`.
7. **Favoritos.** Cualquier elemento marcable → modelo polimórfico `WorkspaceFavorite`.
8. **Archivado, nunca borrado por defecto.** Soft-delete + restaurar en todas las entidades.
9. **Inteligencia funcional (sin IA).** Reglas que recuerdan: *"hace 20 días sin actividad en este curso", "recaudo vencido", "seguimiento de hace 15 días", "demasiados seguimientos abiertos".* Computada sobre `WorkspaceActivity` + fechas.
10. **Proyecto → entidad de primer nivel** (ver §22).
11. **Biblioteca → modelo independiente** (ver §23).
12. **Performance**: endpoints agregados (una query, no N+1), lazy loading, índices, render optimizado.
13. **Responsive por fase** — cada componente nace responsive; no se deja para el final.
14. **Experiencia de calma** — agenda elegante, no ERP/CRUD/panel admin.
15. **Implementación por fases** — cada fase termina con revisión técnica + visual + responsive + arquitectura + pruebas. No se avanza hasta estabilizar.
16. **Cuestionar continuamente** — si aparece mejor solución, se propone antes de implementar.

# §22. Decisión: Proyecto como entidad de primer nivel

**Decisión: SÍ.** Revisa y reemplaza §4.8.

**Justificación técnica:**
- La inteligencia funcional (§21.9) y el dashboard requieren consultas como *"proyectos sin actividad > 30 días"*, *"proyectos que vencen esta semana"*, filtrar por estado/avance. Sobre `metadata` JSON eso es **no indexable** y degrada con el volumen.
- Proyecto tiene **ciclo de vida propio** (estado, % avance, cronograma inicio/fin) y relaciones reales (integrantes N:M, comentarios, evidencias).
- **No duplica primitivas**: tareas reusan TASK (`WorkspaceItem` con `projectId`), comentarios `WorkspaceItemComment`, archivos `WorkspaceAttachment`.

```
WorkspaceProject {
  id, boardId, name, objective?, competencies?, status(PLANNING|ACTIVE|DONE|ARCHIVED),
  progress Int @default(0), startDate?, endDate?, isFavorite Boolean @default(false),
  isArchived Boolean @default(false), createdAt, updatedAt
}
WorkspaceProjectMember { id, projectId, studentId, addedAt }   // N:M con roster (read-only)
```
Se implementa en **F10**.

# §23. Decisión: Biblioteca como modelo independiente

**Decisión: SÍ, separada de adjuntos.** Revisa y complementa §4.6.

**Justificación técnica:**
- Dos conceptos distintos: **adjunto** (archivo pegado a un registro, efímero, vive/muere con él) vs **recurso de biblioteca** (repositorio curado, reutilizable, con versionado, carpetas, etiquetas, favoritos, enlaces; crece por años).
- Versionado, categorías, favoritos y crecimiento futuro justifican un modelo propio. Forzarlo dentro de `WorkspaceAttachment` mezclaría responsabilidades.

```
WorkspaceResourceFolder { id, boardId?, ownerId, name, parentId?, createdAt }  // árbol de carpetas
WorkspaceResource {
  id, boardId?, ownerId, folderId?, name, type(FILE|LINK|VIDEO),
  url, mimeType?, sizeBytes?, version Int @default(1), parentResourceId?,  // versionado
  tags String[] @default([]), isFavorite Boolean @default(false),
  isArchived Boolean @default(false), createdAt, updatedAt
}
```
`WorkspaceAttachment` (adjuntos inline) se mantiene separado. Un adjunto podrá, en el futuro, referenciar un `resourceId` ("adjuntar desde biblioteca"). Se implementa en **F9**.

# §24. Modelos transversales nuevos (de las mejoras §21) + alcance de F0

Nuevos por las mejoras: `WorkspaceDashboardConfig` (#2), `WorkspaceActivity` (#4,#6,#9), `WorkspaceFavorite` (#7).

**`WorkspaceActivity` es la columna vertebral** de Timeline (#4), Actividad reciente (#6) e Inteligencia (#9): una tabla append-only e indexada en vez de hacer UNION sobre 10 tablas. Cada acción relevante registra una fila `{verb, entityType, entityId, summary, boardId, createdAt}`.

**Búsqueda global (#5):** se arranca con un endpoint agregado `GET /workspace/search?q=` que consulta entidades por columnas indexadas (ILIKE). A futuro, si el volumen lo exige, `tsvector` (full-text Postgres). **No se sobre-construye** un índice de búsqueda desde el día 1.

## Alcance de F0 (decisión de arquitectura)

**Crítica a mi propio roadmap:** crear las ~13 tablas de una vez incluiría tablas muertas hasta F10. Por mantenibilidad (prioridad declarada), **cada sub-dominio trae su propia migración en su fase**. F0 incorpora solo la **fundación** que necesitan F1-F4:

- `WorkspaceBoard`: `+ enabledModules String[]`, `+ isCourseSpace Boolean`.
- Tablas transversales: `WorkspaceEvent`, `WorkspaceFollowUp`, `WorkspaceActivity`, `WorkspaceFavorite`, `WorkspaceDashboardConfig`.
- **Backfill de `item.kind`** (resuelve la doble fuente de verdad) desde `metadata.kind` y desde `board.type`.

Recaudo (F6), Roles (F7), Biblioteca (F9), Proyecto (F10) traen sus tablas en su fase. Todas aditivas, todas probadas en staging.

*Fin del documento maestro. Implementación por fases en STAGING en curso.*
