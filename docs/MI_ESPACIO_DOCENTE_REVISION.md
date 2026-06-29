# Mi Espacio Docente — Revisión Arquitectónica Pre-Producción

> Documento de revisión y rediseño del módulo **Espacio Docente (Workspace V2)** antes de pasar a producción.
> **Entregable para aprobación.** No se escribe código de implementación hasta aprobar este documento.
>
> **Versión:** 1.0 · **Fecha:** 2026-06-28 · **Autor:** Revisión técnica + diseño · **Owner:** Luis Cárdenas
>
> Documentos relacionados: [[MI_ESPACIO_DOCENTE_VISION]] (visión de producto original).

---

## Principio rector (no negociable)

> El Espacio Docente es el **libro de anotaciones personal del docente**. Vive 100% dentro del Workspace. **NO** modifica notas, observador oficial, convivencia institucional, asistencia ni informes oficiales. Es un espacio paralelo, privado, de organización.

Toda la arquitectura de este documento respeta esto: ninguna tabla nueva escribe sobre el core académico; todas cuelgan del Workspace del docente.

---

# 1. Problemas encontrados

## 1.1 Arquitectura de datos — el problema de fondo

El modelo actual es **"un tablero = un solo tipo"**:

```
WorkspaceBoard.type ∈ { KANBAN, CLASS_LOG, STUDENT_NOTES, CHECKLIST,
                        MICRO_COLLECT, CLASSROOM_ROLES, PROJECT }
```

Esto choca de frente con tu visión nueva: **"un curso = un espacio con varios módulos que aparecen solo cuando se usan."**

Hoy, para que el curso 8B tenga Bitácora + Recaudo + Roles, necesitaría **3 tableros separados**. El docente ve "3 cosas distintas" en vez de "mi 8B con sus módulos". La V2 actual disimula esto mostrando 5 pestañas sobre **un** tablero filtrando por `item.kind`, pero un tablero sigue teniendo un solo `type` real, así que el modelo y la UI están desalineados.

**Consecuencia:** sin resolver esto, el dashboard nunca se sentirá como "mi curso con sus módulos".

## 1.2 Datos demasiado planos para lo que pides

Varios módulos necesitan estructura relacional que hoy se fuerza dentro de `metadata` (JSON):

| Módulo | Hoy | Lo que pides | Problema |
|--------|-----|--------------|----------|
| **Recaudo** | `metadata.amountPaid` (un número) | Varios recaudos por curso (Libro, Salida…), cada uno con valor individual, estudiantes asignados, **historial de pagos**, pagos parciales | Imposible con un solo número en JSON |
| **Roles** | `metadata.role` (texto) | Catálogo de roles + asignación a varios estudiantes + **historial de quién ocupó el rol** + foto | JSON no guarda historial ni relaciones |
| **Recursos** | casi nada | Repositorio de archivos por carpetas, búsqueda, etiquetas | No hay modelo de archivos en el workspace |
| **Proyecto** | item vacío | Integrantes, checklist, %, comentarios, archivos | JSON no escala para sub-listas con estado |

## 1.3 UX / UI

- **Tarjetas del dashboard demasiado grandes** — no cabe nada más (ni calendario).
- **Se muestran módulos vacíos** — ruido visual; un curso que nunca usó "Proyecto" igual ve la opción.
- **Vista interna**: banner demasiado alto, el emoji/ícono queda tapado, el contenido se empuja hacia abajo, hay espacio desperdiciado.
- **Sin calendario** — pediste uno integrado y opcional.
- **Sin "estado" en las tarjetas** (Hoy / Pendiente / Hace 3 días / Urgente / Nuevo).
- **Responsive sin verificar** en tablet/celular.

## 1.4 Módulos incompletos o no funcionales

- **Observaciones**: no distingue general (curso) vs individual (estudiante).
- **Roles**: no funciona realmente (sin catálogo, sin selector de estudiantes, sin historial).
- **Recaudo**: lógica de "meta general manual" — debe calcularse sola.
- **Recursos / Proyecto / Lista / Tablero libre**: existen como opción pero quedan vacíos.

## 1.5 Deuda técnica detectada

- La captura en V2 escribe el tipo en `metadata.kind` porque el backend aún no llena la columna `kind` (que sí existe tras la migración aditiva). Hay **doble fuente de verdad** (columna vs metadata) que hay que unificar.
- El recaudo V2 actual lee/escribe `metadata.amountTarget/amountPaid` para mantener compatibilidad con la UI vieja — funciona pero es un puente temporal, no el modelo final.
- Lógica de clasificación de items (`filterForSection`) tiene heurísticas frágiles para items sin `kind`.

---

# 2. Oportunidades de mejora

1. **Reconceptualizar "tablero" → "espacio de curso"** con módulos que aparecen al usarse. Limpia el dashboard y alinea modelo con mente del docente.
2. **Módulos bajo demanda**: tarjeta aparece si el módulo tiene registros **o** fue activado explícitamente con "+ Agregar espacio".
3. **Tablas satélite** solo donde se necesita estructura real (Recaudo, Roles, Recursos, Proyecto). El resto (Bitácora, Observaciones, Lista, Notas) sigue como `WorkspaceItem` con `kind` — reutiliza lo que ya existe.
4. **Capa de calendario unificada**: un `WorkspaceEvent` opcional que cualquier registro puede crear; el dashboard agrega todos los eventos del docente.
5. **Adjuntos reutilizables**: una tabla `WorkspaceAttachment` que sirve a Bitácora, Proyecto, Recursos, Recaudo — apoyada en el módulo `storage` (R2/Supabase) que **ya existe**.
6. **Infra ya disponible que podemos reusar**: `StorageService.upload()` (archivos), `Student.photo` (fotos en Roles), `framer-motion` (animaciones), los componentes V2 ya construidos (Greeting, SpaceCard, tabs, CaptureBar).
7. **Sistema de etiquetas de estado** transversal (Hoy/Pendiente/Urgente/Nuevo/Resuelto) calculado desde fechas y flags.

---

# 3. Nueva arquitectura propuesta

## 3.1 Modelo conceptual

```
                          ┌─────────────────────────────┐
                          │   ESPACIO DOCENTE (home)    │
                          │  dashboard + calendario     │
                          └──────────────┬──────────────┘
                  ┌──────────────────────┼──────────────────────┐
                  ▼                       ▼                       ▼
        ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
        │  ESPACIO 8A      │   │  ESPACIO 8B      │   │  ESPACIO PERSONAL│
        │  (curso/grupo)   │   │  (curso/grupo)   │   │  (sin grupo)     │
        └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
                 │ módulos (aparecen al usarse)                  │
     ┌───────────┼───────────┬───────────┬──────────┐          │
     ▼           ▼           ▼           ▼          ▼           ▼
  Bitácora  Observac.   Recaudo      Roles     Recursos    Notas/Ideas
  Lista     Proyecto    Tablero libre                      Checklist
```

**Regla de oro de módulos:** una tarjeta de módulo se muestra si `tiene ≥1 registro` **O** `está en enabledModules`. Botón **"+ Agregar espacio"** activa un módulo nuevo (lo agrega a `enabledModules`).

## 3.2 Estrategia de datos: híbrida

**A) Universal — `WorkspaceItem` con `kind`** (ya existe, lo consolidamos):
Sirve para módulos "tipo texto/lista":
- `LOG` → Bitácora
- `OBSERVATION` → Observaciones
- `TASK` / `LIST` → Lista
- `NOTE` / `IDEA` → Notas e ideas (espacio personal)
- `EVENT` → eventos sueltos
- Cards de **Tablero libre** → `WorkspaceItem` + `columnId` (las columnas ya existen: `WorkspaceColumn`)

**B) Tablas satélite — donde hace falta estructura relacional:**
- **Recaudo** (3 tablas): concepto + cargo por estudiante + historial de pagos.
- **Roles** (2 tablas): catálogo + asignaciones con historial.
- **Recursos / Adjuntos** (1 tabla compartida): archivos.
- **Proyecto** (item + 1-2 tablas hijas): checklist + integrantes/comentarios.

**C) Transversales:**
- **`WorkspaceEvent`**: eventos de calendario opcionales (cualquier registro puede crear uno).
- **`WorkspaceAttachment`**: archivos reutilizables por cualquier módulo.

> **Por qué híbrida y no todo-tablas-nuevas:** reusa los 23 tableros e items reales que ya hay en producción, minimiza migración, y solo agrega estructura donde el JSON ya no alcanza. Escala sin reescribir el core del workspace.

## 3.3 Compatibilidad y migración con producción

Producción ya tiene **23 tableros + 118 items reales** (de un solo tipo cada uno). Propuesta de migración (probada primero en la BD de staging, que es copia de prod):

1. **Crear espacios de curso**: por cada `(teacher, group)` con tableros, crear (o designar) un `WorkspaceBoard` de tipo `COURSE`.
2. **Absorber items**: mover los items de los tableros viejos al espacio de curso, asignando `item.kind` = el `type` del tablero viejo (MICRO_COLLECT→COLLECTION, CLASS_LOG→LOG, etc.).
3. **Recaudos**: convertir los items MICRO_COLLECT (con `metadata.amountPaid`) a las nuevas tablas de Recaudo, preservando lo pagado como un pago histórico inicial.
4. **Roles**: convertir `metadata.role` a asignaciones de rol.
5. **Tableros viejos** quedan archivados (no se borran — reversibilidad).
6. La **UI clásica** sigue leyendo lo suyo durante la transición (feature flag `WORKSPACE_V2`).

> Toda la migración se ejecuta **primero en staging** con los datos reales restaurados, se verifica, y solo entonces va a prod. Cero `reset`, cero pérdida.

---

# 4. Cambios de base de datos necesarios

> Todos **aditivos**. Sin DROPs ni renames sobre lo existente. Mismo principio que la migración aditiva anterior.

## 4.1 Sobre `WorkspaceBoard` (espacio)
```
+ enabledModules  String[]  @default([])   // módulos activados manualmente
+ moduleType      (ya existe `type`; agregamos valor COURSE al enum o
                    usamos isCourseSpace Boolean para no tocar el enum)
```
*(Ya existen de la migración previa: emoji, coverImage, bannerColor, isPinned, isPersonal, linkedClassId, hiddenSections, lastAccessedAt.)*

## 4.2 Recaudo (nuevo sub-dominio)
```
model WorkspaceCollection {            // el concepto de cobro
  id, boardId, name, description?, unitValue Decimal, dueDate?,
  createdAt, updatedAt
}
model WorkspaceCollectionCharge {       // un cargo por estudiante
  id, collectionId, studentId, status (PENDING|PARTIAL|PAID),
  // meta = unitValue del concepto; saldo se calcula
}
model WorkspaceCollectionPayment {      // historial de pagos
  id, chargeId, amount Decimal, paidAt, note?
}
```
**Meta general = `unitValue × nº de cargos`** (calculada, nunca manual).

## 4.3 Roles (nuevo sub-dominio)
```
model WorkspaceRole {                   // catálogo (preestablecido o custom)
  id, boardId, name, isCustom Boolean, createdAt
}
model WorkspaceRoleAssignment {         // asignación con historial
  id, roleId, studentId, assignedAt, removedAt?  // removedAt null = activo
}
```
Roles preestablecidos se siembran al activar el módulo (Monitor, Representante, Secretario, Líder ambiental, Líder tecnológico, Líder convivencia…).

## 4.4 Recursos / Adjuntos (compartido)
```
model WorkspaceAttachment {
  id, boardId, itemId?,        // itemId opcional → adjunto de una entrada
  folder?,                     // organización por carpetas
  fileName, mimeType, sizeBytes, url,   // url del storage (R2/Supabase)
  tags String[] @default([]),
  uploadedAt
}
```
Sube vía `StorageService.upload()` (ya existe).

## 4.5 Proyecto (item + hijas)
```
WorkspaceItem (kind=PROJECT) +
model WorkspaceProjectTask {            // checklist
  id, itemId, title, done Boolean, dueDate?, order
}
// integrantes: WorkspaceProjectMember(itemId, studentId)
// comentarios: WorkspaceItemComment(itemId, authorId, text, createdAt)  ← reusable
```

## 4.6 Calendario (transversal)
```
model WorkspaceEvent {
  id, boardId, itemId?,        // evento ligado a un registro (opcional)
  title, date DateTime, kind?, // reunión, entrega, recordatorio…
  done Boolean @default(false),
  createdAt
}
```
El calendario del dashboard = `WorkspaceEvent` de todos los espacios del docente.

## 4.7 Campos de estado en `WorkspaceItem`
*(Ya existe: `completedAt`, `dueDate`, `eventDate`, `status`, `tags`.)* Agregar:
```
+ priority   (LOW|MEDIUM|HIGH)?     // para Lista / Proyecto
+ isImportant Boolean @default(false)  // Bitácora "Importante"
```

---

# 5. Nuevos componentes (frontend)

## 5.1 Dashboard
- `WorkspaceDashboard` (rediseño de la home actual) — tarjetas 20-30% más pequeñas + zona de calendario.
- `MiniCalendar` — calendario mensual del docente con eventos.
- `SpaceCardCompact` — tarjeta de espacio reducida con métricas (última actualización, nº registros, próximo evento, pendientes).
- `StatusBadge` — etiquetas Hoy / Pendiente / Hace 3 días / Nuevo / Urgente / Resuelto.

## 5.2 Vista de espacio (rediseño interno)
- `SpaceHeaderCompact` — banner más bajo, ícono reposicionado, jerarquía corregida.
- `ModuleGrid` — módulos del curso que aparecen solo si tienen datos / están activos.
- `AddModuleButton` + `AddModuleSheet` — "+ Agregar espacio".

## 5.3 Módulos
- `BitacoraModule` — diario: título, descripción, etiquetas, adjunto, fecha, recordatorio, estados (Importante/Pendiente/Resuelta), buscar/filtrar/ordenar.
- `ObservationsModule` — general vs individual (selector de estudiantes), filtros, seguimiento.
- `RecaudoModule` — lista de recaudos, cada uno con progreso, asignación de estudiantes, registro de pagos parciales, historial.
- `RolesModule` — catálogo + selector de estudiantes con foto + historial.
- `ResourcesModule` — repositorio con carpetas, subida, búsqueda, etiquetas.
- `ProjectModule` — gestor: estado, %, integrantes, checklist, archivos, comentarios, recordatorios.
- `ListModule` — checklist con prioridad, fecha, responsable, recordatorio.
- `KanbanModule` — columnas (Ideas/Pendientes/En proceso/Finalizado), drag & drop, colores, etiquetas, archivos.
- `PersonalSpace` — notas, ideas, recordatorios, archivos, checklist, eventos (independiente de curso).

## 5.4 Transversales
- `EventComposer` — "¿solo guardar fecha?" vs "agregar al calendario".
- `AttachmentUploader` — subida pequeña reutilizable.
- `StudentPicker` — selector de estudiantes del curso (con foto), reutilizado por Roles, Observaciones, Recaudo.
- `TagInput`, `ReminderPicker` — reutilizables.

---

# 6. Flujo de usuario

## 6.1 Entrada
1. Docente entra a "Mi Espacio" → **Dashboard**: saludo + calendario + tarjetas compactas de sus cursos + espacio personal.
2. Cada tarjeta muestra: última actualización, nº de registros, próximo evento, pendientes, etiqueta de estado.

## 6.2 Dentro de un curso
3. Abre "8B" → ve **solo los módulos que ha usado** (ej: Bitácora + Recaudo). El resto no aparece.
4. **"+ Agregar espacio"** → elige un módulo nuevo (ej: Roles) → se activa y aparece su tarjeta.

## 6.3 Crear un registro (ejemplo Bitácora)
5. Escribe título + descripción → decide: *"¿solo guardar fecha?"* o *"agregar evento al calendario"* (ej: revisar el viernes).
6. Si crea evento → aparece en el calendario del dashboard.

## 6.4 Recaudo (ejemplo)
7. Crea recaudo "Libro" → valor individual $80.000 → asigna 25 estudiantes → **meta = $2.000.000 (automática)**.
8. Registra pago parcial de un estudiante ($40.000) → estado "Pago parcial", saldo $40.000, queda en historial.

## 6.5 Roles (ejemplo)
9. Activa Roles → elige "Monitor" (preestablecido) → selecciona estudiante (con foto) → queda asignado. Cambio futuro queda en historial.

---

# 7. Mock del nuevo funcionamiento (ASCII)

## 7.1 Dashboard (con calendario, tarjetas compactas)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Buenos días, Luis                                   junio 2026   ◀ ▶     │
│  3 cursos · 2 pendientes hoy                                               │
│                                                                           │
│  ┌─────────── MIS ESPACIOS ───────────┐   ┌──── CALENDARIO ────────────┐ │
│  │ ┌────────┐ ┌────────┐ ┌────────┐  │   │  L  M  X  J  V  S  D       │ │
│  │ │📐 8A   │ │📘 8B   │ │∫ 10C  │  │   │              1  2  3        │ │
│  │ │3 mód.  │ │2 mód.  │ │1 mód. │  │   │  4  5  6  7 [8] 9 10        │ │
│  │ │•Hoy    │ │•2 pend │ │•Nuevo │  │   │              ●●  ●          │ │
│  │ │act. 2h │ │ayer    │ │3 días │  │   │ 11 12 13 14 15 16 17        │ │
│  │ └────────┘ └────────┘ └────────┘  │   │        ●                   │ │
│  │ ┌────────┐ ┌─ + ───┐              │   │ ───────────────────────────│ │
│  │ │⭐ Pers.│ │ nuevo │              │   │ Hoy:                       │ │
│  │ │5 notas │ │espacio│              │   │ • Cobrar recaudo Libro 8A  │ │
│  │ └────────┘ └───────┘              │   │ • Reunión padres 10C 3pm   │ │
│  └────────────────────────────────────┘   └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Vista de curso — módulos solo si se usan

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Mi Espacio   📐 8A — Matemáticas        [banner bajo]            ⚙ ··· │
│ 28 estudiantes · Aula 204                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│  MÓDULOS ACTIVOS                                        + Agregar espacio │
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │ 📖 Bitácora │  │ 💰 Recaudo  │  │ 🎭 Roles    │                       │
│  │ 12 entradas │  │ 2 activos   │  │ 4 asignados │                       │
│  │ • Hoy       │  │ ⚠ $480k pend│  │ act. ayer   │                       │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
│                                                                           │
│  (Observaciones, Recursos, Proyecto, Lista, Tablero NO aparecen          │
│   porque este curso aún no los usa)                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

## 7.3 Recaudo — meta automática

```
┌──────────────────────────────────────────────────────────────┐
│ 💰 Recaudo › Libro                                            │
│ Valor individual: $80.000 · 25 estudiantes                   │
│ Meta automática: $2.000.000   ▰▰▰▰▰▱▱▱▱▱  52% ($1.040.000)   │
│ ───────────────────────────────────────────────────────────  │
│ AHUMADA, Leider     ✅ Pagado     $80.000                     │
│ ALBORNOZ, Mariana   🟡 Parcial    $40.000 / $80.000  [+pago] │
│ BARRIOS, Santiago   ⬜ Pendiente  $0 / $80.000       [+pago] │
└──────────────────────────────────────────────────────────────┘
```

---

# 8. Orden recomendado de implementación

Por fases, cada una desplegable y verificable en **staging** antes de prod. Cada fase deja el módulo usable.

| Fase | Contenido | Riesgo | Valor |
|------|-----------|--------|-------|
| **F0 — Migración de datos** | Espacios de curso + absorber items + migrar recaudos/roles. Probado en staging con datos reales. | Medio | Habilita todo lo demás |
| **F1 — Dashboard + módulos bajo demanda** | Tarjetas compactas, módulos que aparecen al usarse, "+ Agregar espacio", etiquetas de estado | Bajo | Limpieza visual inmediata |
| **F2 — Vista interna + Bitácora completa** | Banner bajo, jerarquía, Bitácora con etiquetas/estados/buscar/filtrar/adjunto | Bajo | El módulo más usado, sólido |
| **F3 — Calendario + eventos** | `WorkspaceEvent`, MiniCalendar, EventComposer ("solo fecha" vs "evento") | Medio | Diferenciador clave |
| **F4 — Recaudo (rediseño completo)** | 3 tablas, meta automática, pagos parciales, historial, progreso | Medio | Alto valor docente |
| **F5 — Roles** | Catálogo + selector con foto + historial | Bajo | Completa lo roto |
| **F6 — Observaciones (general/individual)** | Dos tipos, filtros, seguimiento | Bajo | Completa lo incompleto |
| **F7 — Recursos** | Repositorio, carpetas, subida, etiquetas, búsqueda | Medio | Repositorio real |
| **F8 — Proyecto + Lista + Tablero libre** | Gestor de proyectos, checklist, Kanban drag&drop | Medio | Cierra el set de módulos |
| **F9 — Espacio Personal + Responsive + Pulido** | Independiente de curso, responsive completo, microinteracciones | Bajo | Experiencia "Notion-like" |

**Recomendación:** F0 → F1 → F2 → F3 primero (es lo que transforma la sensación del módulo). Recaudo/Roles/Observaciones (F4-F6) son los de mayor valor funcional. F7-F9 cierran.

---

## Notas finales

- **Nada de esto toca el core académico.** Todas las tablas nuevas cuelgan del Workspace.
- **Todo se prueba en staging** (que tiene copia real de prod) antes de tocar producción.
- **El trabajo V2 ya hecho** (home, tabs, captura, recaudo-puente, modal de crear) **no se tira**: evoluciona. Las pestañas actuales ya son, conceptualmente, los módulos; el cambio mayor es (a) módulos bajo demanda, (b) tablas satélite para datos ricos, (c) dashboard + calendario, (d) pulido interno.
- **Decisión pendiente tuya:** aprobar este documento y, dentro de él, dos puntos:
  1. Estrategia de migración F0 (agrupar tableros en espacios de curso) — ¿la confirmas?
  2. Orden de fases — ¿el propuesto o reordenas prioridades?

---

*Fin del entregable. La implementación comienza solo tras tu aprobación.*
