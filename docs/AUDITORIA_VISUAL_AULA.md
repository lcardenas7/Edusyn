# Auditoría visual del Aula Virtual

Fecha: 2026-07-15 · Alcance: `apps/web/src/pages/Classroom.tsx` (~6.000 líneas) y sus modales.
Origen: observaciones del fundador (chips de filtro, nombres truncados al copiar sección,
secciones sin salida rápida ni categorización) + barrido de problemas del mismo tipo.

---

## Resumen

El aula **funciona**, pero visualmente se comporta como un módulo escrito *antes* del Design
System y nunca migrado. El hallazgo de raíz que explica la sensación de "se pierde identidad":

> **`Classroom.tsx` usa CERO tokens del Design System.** Existen `--surface-*`, `--ink-*`,
> `--brand-*` definidos en `index.css` (líneas 30-35+), y el aula los usa **0 veces**
> (verificado por conteo). Todo está pintado con Tailwind crudo (`slate-500`, `violet-600`,
> `blue-600`, `amber-500`…), elegido caso por caso.

De ahí se derivan casi todos los síntomas: el arcoíris de chips, los hovers que no coinciden
entre modales gemelos, y que en móvil no haya jerarquía. No es "mal gusto puntual": es
**ausencia de sistema**.

---

## Hallazgos

### H1 · Los chips de filtro comen la pantalla y no identifican nada
**Evidencia:** `Classroom.tsx:5252-5290` (filtro por tipo) y `5293-5315` (filtro por estado).

Son **dos sistemas de filtro paralelos**, visualmente casi idénticos (mismo `rounded-xl`,
`border-2`, misma píldora de conteo), apilados uno sobre otro, ambos con `flex-wrap`.

- **Espacio:** en móvil (375px) los ~5 chips de tipo + 4 de estado envuelven en **~4 filas
  ≈ 200px** de alto *antes* de ver una sola actividad. En el escritorio ya ocupan 2 filas.
- **Identidad:** el filtro de tipo asigna **8 colores distintos** (`slate/blue/purple/red/
  violet/pink/emerald/amber`, líneas 5268-5277). Un arcoíris no jerarquiza: compite. Peor,
  **`violet` está duplicado** (`LIVE_QUIZ` "En Línea" y `LESSON` "Lecciones", líneas 5259 y
  5262) → el color ya ni siquiera identifica de forma única.
- **Semántica:** "Tareas/Quiz/Lecciones" (¿qué es?) y "Por calificar/Vence hoy" (¿qué me toca?)
  son preguntas **distintas** con el mismo peso visual. El docente no sabe cuál mirar primero.

**Dirección:** una sola fila de filtros. Chips **neutros** (el color solo en el activo); la
identidad la da el ícono + la etiqueta, no 8 tonos. En móvil, tira horizontal con scroll
(sin `wrap`) o un `select`. El bloque "estado del trabajo" es un *centro de control*, no un
filtro más: merece otro tratamiento (p. ej. una barra compacta arriba, o solo mostrar los que
tienen conteo > 0).

---

### H2 · Los selectores de aula truncan justo lo que desambigua
**Evidencia:** `Classroom.tsx:1677-1678` (copiar sección), `5872-5873` (duplicar actividad),
y el equivalente de materiales (~`4610`).

```
<p className="font-medium text-slate-800 truncate">{c.title}</p>
<p className="text-xs text-slate-500 truncate">{c.groupName} • {c.subjectName}</p>
```

El modal es `max-w-md` (448px) y, restando el avatar de 40px y paddings, al texto le quedan
**~330px**. Con `truncate` (una línea + elipsis), "Pensamiento computacional 1" y
"10°B • Tecnología e informática" se cortan.

**La ironía:** dos aulas suelen llamarse **igual** (mismo curso, distinto grupo). Lo único que
las distingue es `groupName • subjectName` — **exactamente la línea que se trunca**. Se está
recortando la única señal que importa. De ahí el "uno tiene que adivinar".

**Dirección:** ensanchar a `max-w-lg`, `line-clamp-2` en el título, **nunca** truncar
grupo+asignatura (que respire en su línea, o apilado), y `title={}` para tooltip.

---

### H3 · Secciones: callejón sin salida y sin forma de categorizar
**Evidencia:** `Classroom.tsx:5562-5566` (selector) y el modelo `ClassroomSection` en `schema.prisma`.

**3a · Sin salida rápida.** El formulario de nueva actividad tiene:
```
<select ...><option value="">Seleccionar sección...</option>{sections.map(...)}</select>
```
Si el aula **no tiene secciones**, el desplegable queda **vacío** y `createActivity` exige
`sectionId: string` (`lib/api.ts:2066`). El docente queda atrapado: debe **abandonar el
formulario**, ir a Contenido, crear la sección y volver a empezar — perdiendo el borrador,
**incluidas las preguntas que Valeria acabara de generar**. Es el peor momento posible para
un callejón sin salida.

**3b · Sin categorización.** `ClassroomSection` solo tiene:
`title, description, sortOrder, isVisible`. **No hay período ni categoría.** La plataforma
**sí** tiene el concepto (`AcademicTerm`, usado en notas y boletines), pero las secciones no
lo conocen. No hay forma de decir "esto es del Período 2".

**Dirección:**
- Opción "➕ Crear sección" **dentro del propio select** (o input rápido inline), sin salir del
  formulario. Alternativa complementaria: sembrar una sección "General" al primer uso, y/o
  permitir `sectionId` opcional con un cajón "Sin sección".
- `academicTermId` **opcional** en `ClassroomSection` (+ filtro por período en Contenido).
  Opcional, como pediste: el que no lo use, no lo ve.

---

### H4 · Estados vacíos sin acción y con textos divergentes
**Evidencia:** `1617`, `1663`, `4610`, `5831`, `5859`, `5901`.

Tres redacciones distintas para la misma idea — "No hay secciones disponibles" / "Esta aula no
tiene secciones" / "No hay otras aulas disponibles" — y **ninguna ofrece una acción**. Son
callejones sin salida, el mismo patrón de H3 repetido por toda la app.

**Dirección:** todo estado vacío = frase única + **CTA**. Si no hay secciones → "Crear la primera".

---

### H5 · El mismo selector copiado 3 veces (y ya divergió)
**Evidencia:** `1666-1682`, `5862-5877`, `~4610`.

El "elige un aula destino" está triplicado casi literal. Ya divergieron: unos hacen
`hover:border-violet-300`, otros `hover:border-blue-300`. Cada arreglo (como el truncado de H2)
hay que hacerlo 3 veces, y por eso se desincronizan.

**Dirección:** extraer `<ClassroomPicker>` y `<SectionPicker>`. Arregla identidad + H2 de una vez
y evita la próxima divergencia.

---

### H6 · 14 diálogos nativos del navegador
**Evidencia:** 14 usos de `alert(` / `confirm(` en `Classroom.tsx`.

Cada `confirm("¿Eliminar?")` es una caja gris del sistema operativo: rompe la identidad justo
en el momento de más tensión (borrar algo). Deuda conocida, barata de pagar con un modal propio.

---

## Plan sugerido (por bloques, priorizado)

| # | Bloque | Qué resuelve | Esfuerzo |
|---|--------|--------------|----------|
| **V1** | **Chips de filtro** (H1) | La queja #1. Una fila, chips neutros, scroll horizontal en móvil, estado separado del tipo | Bajo |
| **V2** | **Pickers compartidos** (H2+H5) | El "adivinar" al copiar + mata la triplicación | Bajo-medio |
| **V3** | **Secciones sin fricción** (H3a) | Crear sección desde el formulario, sin perder el borrador | Bajo |
| **V4** | **Estados vacíos con CTA** (H4) | Quita callejones sin salida en toda el aula | Bajo |
| **V5** | **Períodos/categoría en secciones** (H3b) | Organizar Contenido por período (opcional) | Medio (migración aditiva) |
| **V6** | **Migrar el aula al Design System** (H0/raíz) | La identidad de verdad; sin esto los parches se vuelven a desviar | Alto (incremental) |
| **V7** | Modal propio para confirmaciones (H6) | Identidad en borrados | Bajo |

**Recomendación de orden:** V1 → V3 → V2 → V4 (todos baratos y atacan lo que duele hoy), y
dejar V5 y V6 como bloques con su propio ticket. **V6 es el arreglo real de fondo**, pero es
incremental: conviene hacerlo *después* de V1-V4 para no migrar código que igual vamos a
reescribir.
