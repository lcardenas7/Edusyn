# Mi Espacio Docente — Visión de Producto Unificada

> Documento maestro de visión, principios y arquitectura del rediseño de **Mi Espacio Docente** en Edusyn.
> Esta es la **única fuente de verdad** para producto, diseño, ingeniería, marketing y soporte.
>
> **Versión:** 1.0 · **Fecha:** 2026-06-26 · **Owner:** Luis Cárdenas

---

## 0. Cómo leer este documento

- **Parte I — Visión** (qué y por qué): para todo el equipo.
- **Parte II — Diseño** (cómo se ve y se siente): para producto, diseño y marketing.
- **Parte III — Arquitectura** (cómo se construye): para ingeniería.
- **Parte IV — Plan** (cuándo y en qué orden): para liderazgo.

Si solo lees una sección, lee la **Parte I**.

---

# PARTE I — VISIÓN

## 1. El problema que estamos resolviendo

Edusyn tiene hoy una sección llamada "Mi Espacio de Trabajo" que funciona con un sistema de **tableros**. Para anotar cualquier cosa, el docente debe:

1. Crear un tablero.
2. Elegir un tipo (Kanban, Bitácora, Observación, Recaudo, Roles, Proyecto, Checklist).
3. Ponerle nombre.
4. Definir alcance (grupo, grado, multi-grupo).
5. Configurar columnas o plantilla.
6. Recién ahí puede anotar.

Esto es **trabajo de arquitecto de información** antes de poder trabajar. El docente no piensa en "tableros con alcance multi-grupo"; piensa en *"acordarme de hablar con Mariana mañana"*. El sistema actual lo obliga a traducir sus pensamientos a estructuras de datos antes de capturarlos.

### Las consecuencias observadas

- **Fricción de captura**: anotar algo cuesta más que un papelito.
- **Carga cognitiva al revés**: decidir el tipo de tablero es decidir *cómo voy a pensar* antes de pensar.
- **Pérdida de contexto**: cada tablero es una isla; no se ve qué pasa con 9B sin abrir 4 tableros distintos.
- **Estética sin alma**: grids fríos, sin jerarquía visual, sin respiración.
- **Cero recompensa emocional**: nada celebra el progreso, nada da ganas de volver.

### Resultado

Los docentes terminan abandonando el espacio. El módulo existe pero no genera el valor para el cual fue creado.

---

## 2. Lo que queremos construir

Mi Espacio Docente debe ser **el escritorio personal del docente** dentro de Edusyn. Un lugar donde el docente piensa:

> *"Aquí tengo organizada toda mi vida laboral."*

No reemplaza los módulos oficiales (asistencia, notas, evaluaciones). **Los complementa.** Es el espacio paralelo donde el docente organiza lo suyo:

- Cómo quedó cada grupo.
- Observaciones personales (no las disciplinarias oficiales).
- Recordatorios y pendientes.
- Microrecaudos privados que lleva mientras organiza la información.
- Planeaciones, ideas, bitácoras.
- Listas, recursos, archivos.
- Notas rápidas, seguimiento informal de estudiantes.
- Información temporal que necesita recordar.

### Inspiraciones (mezcla, no copia)

Notion · Apple Notes · Todoist · Linear · Craft · Things 3 — pero diseñado **específicamente para docentes latinoamericanos**, no para developers ni para knowledge workers de Silicon Valley.

### Diferenciación competitiva

Ninguna plataforma de gestión educativa actual (Phidias, Ciudad Educativa, Q10, Alexia) ofrece un espacio personal real para el docente. Todas son **sistemas de control administrativo** disfrazados de productividad. Construir un espacio que **el docente quiera abrir por gusto** es una diferenciación de categoría — no una feature.

---

## 3. Los 7 principios del rediseño

Estos principios son la **constitución** del nuevo espacio. Cualquier decisión de diseño que los viole se descarta.

| # | Principio | Significado práctico |
|---|-----------|----------------------|
| **P1** | **Capture-first, organize-later** | El docente captura primero; el sistema organiza después. La estructura emerge del uso, no se impone antes. |
| **P2** | **El contexto es el curso, no el tablero** | El modelo mental del docente está organizado por *grupos* y *estudiantes*, no por *tipos de objeto*. |
| **P3** | **Una sola superficie de entrada** | El docente entra a un solo lugar (el "Hoy") que ya sabe qué mostrarle. El árbol de navegación se revela cuando se necesita. |
| **P4** | **Calidez tipográfica, no decoración** | El alma viene de tipografía generosa, espacios respirados, microcopys humanos y transiciones físicas. *Linear, no Trello.* |
| **P5** | **Lo personal se ve personal** | El Espacio Docente debe sentirse visualmente *distinto* del resto de Edusyn. Pista clara: "esto es tuyo, no del colegio". |
| **P6** | **Progreso visible, esfuerzo invisible** | El docente ve avanzar sus cosas. No ve la maquinaria (auto-archivo, auto-categorización, auto-vinculación). |
| **P7** | **Sin estado vacío hostil** | Un docente nuevo no ve "Crea tu primer tablero". Ve **una página ya escrita con su nombre y la fecha de hoy**, lista para que solo escriba. |

---

# PARTE II — DISEÑO

## 4. El modelo conceptual nuevo

### 4.1 Renombramiento (lo que el usuario ve)

| Concepto técnico actual | Concepto que ve el docente |
|-------------------------|----------------------------|
| Tablero | **Espacio** |
| Item / Card | **Elemento de organización** (o solo "elemento") |
| Tipo de tablero (Kanban, Bitácora…) | **Tipo de espacio** (solo visible al crear) |
| Columna | **Sección** |
| Scope (grupo/grado/multi) | (oculto — el sistema infiere o pregunta una vez) |

> **Regla:** la palabra "tablero" no aparece en ninguna parte de la UI nueva. Se mantiene como nombre de tabla en la base de datos para no romper migraciones.

### 4.2 Los dos tipos de espacio

**Espacios de curso** (uno por grupo/materia que da el docente)
Contienen todo lo del grupo: bitácora, observaciones, recaudo, roles, lista de estudiantes, recursos. **Personalizables visualmente** (color, portada, emoji, banner). El docente siente *"este es MI 8A"*, no *"curso #48"*.

**Espacio personal** (uno solo, fijo)
Contiene lo que no pertenece a un curso: ideas, pendientes propios, notas sueltas, archivos personales.

### 4.3 El elemento polimórfico

Todo lo que el docente registra es un **elemento de organización**. La diferencia entre tipos es solo qué metadata tiene:

```
                    ┌─────────────────────────────┐
                    │  ELEMENTO DE ORGANIZACIÓN   │
                    │   (texto + metadata)        │
                    └──────────────┬──────────────┘
                                   │
       ┌──────────────┬────────────┴────────────┬──────────────┐
       │              │                         │              │
   ┌───▼───┐    ┌─────▼─────┐            ┌──────▼─────┐  ┌─────▼────┐
   │CUÁNDO │    │ DE QUIÉN  │            │  DE QUÉ    │  │  QUÉ ES  │
   │ fecha │    │estudiante │            │  curso /   │  │ nota /   │
   │       │    │  o nadie  │            │  materia / │  │ recaudo /│
   │       │    │           │            │  proyecto  │  │ obs / …  │
   └───────┘    └───────────┘            └────────────┘  └──────────┘
```

**Tipos de elemento disponibles:**
- 📝 Nota
- ✅ Pendiente
- 👀 Observación personal
- 📖 Bitácora de clase
- 💰 Recaudo
- 💡 Idea
- 📋 Lista / Checklist
- 📎 Archivo / Recurso
- 📅 Evento

> **Por qué "elemento de organización" y no "anotación":** "anotación" sesga hacia texto. "Elemento" abre el modelo a archivos, eventos, listas y recursos sin reescribir el concepto.

---

## 5. La captura: dos caminos, mismo destino

El error más grande del sistema actual es asumir **un solo perfil de docente**. Hay dos:

- **El 90%** (docente promedio): quiere botones claros, formularios cortos, cero markdown.
- **El 10%** (power user): quiere escribir libre y rápido, con menciones y comandos.

**No elegimos uno y excluimos al otro. Servimos a los dos sin obligar a ninguno.**

### Camino A — Selector visual (default)

```
┌──────────────────────────────────────────────────────────┐
│  ¿Qué quieres registrar?                                 │
│                                                           │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │  📝  │  │  ✅  │  │  👀  │  │  💰  │  │  📖  │       │
│  │ Nota │  │Pend. │  │ Obs. │  │Cobro │  │Bitác.│       │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘       │
│                                                           │
│  + más tipos                                             │
└──────────────────────────────────────────────────────────┘
```

Al tocar un tipo → formulario corto (3 campos máximo) → guardar.

### Camino B — Caja libre (opcional, siempre presente)

```
╭──────────────────────────────────────────────────────────╮
│  + Anotar algo…                                          │
╰──────────────────────────────────────────────────────────╯
```

Si el docente escribe texto libre, se guarda como Nota. Si usa `@`, abre selector de estudiantes. Si escribe `/`, abre comandos. **Los atajos son una recompensa para quien los descubra, no un requisito.**

---

## 6. La pantalla principal (Home)

### Principio: lo importante en el primer pantallazo, sin scroll

El docente abre el espacio en huecos de 3-4 minutos entre clases. **No tiene tiempo de scrollear**. La home debe ser:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Mi Espacio                                              ⌘K    👤 Luis    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Buenos días, Luis                            jueves 26 de junio          │
│  Hoy tienes 3 clases                                                      │
│                                                                           │
│  ─── HOY ──────────────────────────────────────────────────────────────   │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  7:00 — 9B · Matemáticas                            en 12 min      │  │
│  │  ─────────────────────────                                         │  │
│  │  Última clase: "Quedamos en pág. 47, ej. 12. Mariana con dudas."  │  │
│  │  💡 idea guardada para hoy: "rúbrica con emojis"                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  · 9:00  — 8A · Geometría                                                 │
│  · 11:00 — 10C · Cálculo                                                  │
│                                                                           │
│  ─── MIS ESPACIOS ─────────────────────────────────────────────────────   │
│                                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  📐 9B   │  │  📏 8A   │  │  ∫ 10C   │  │  σ 11A   │  │   ⭐     │   │
│  │ azul     │  │ verde    │  │ púrpura  │  │ ámbar    │  │ Personal │   │
│  │          │  │          │  │          │  │          │  │          │   │
│  │ pág 47   │  │ taller 3 │  │ 3 cobros │  │ proyecto │  │ 5 ideas  │   │
│  │ 🟢 al día│  │ 🟡 4 pen.│  │ ⚠ pend.  │  │  activo  │  │ 2 pend.  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                                           │
│                                              [+ nuevo espacio]            │
│                                                                           │
│  ╭──────────────────────────────────────────────────────────────────╮    │
│  │  + Anotar algo                                                    │    │
│  ╰──────────────────────────────────────────────────────────────────╯    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Las 3 zonas (en orden)

1. **Saludo + contexto del día** (1 línea, tipografía serif elegante).
2. **HOY** — las clases del día con su última bitácora visible y las ideas guardadas para esa clase.
3. **MIS ESPACIOS** — cards de cursos personalizadas + card del espacio personal.

### Lo que NO va en la home (vive dentro de los espacios o en pestañas secundarias)

- Lista completa de ideas
- Notas rápidas viejas
- Archivos
- Calendario semanal completo
- Historial extenso

> **Razón:** la home no es un dashboard, es un punto de partida. Cada zona extra es ruido que retrasa la captura.

---

## 7. Dentro de un espacio de curso

Al tocar la card de 9B, se expande a vista completa:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Mi Espacio    /    📐 9B — Matemáticas                       ⚙ ···    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   [BANNER PERSONALIZABLE — color azul, gradiente sutil, foto opcional]   │
│                                                                           │
│   📐 9B — Matemáticas                                                     │
│   28 estudiantes  ·  3 clases por semana  ·  Aula 204                     │
│                                                                           │
│  ╔═══════════╦═══════════╦═══════════╦═══════════╦═══════════╗           │
│  ║ Bitácora  ║   Obs.    ║  Recaudo  ║   Roles   ║ Recursos  ║           │
│  ╚═══════════╩═══════════╩═══════════╩═══════════╩═══════════╝           │
│                                                                           │
│   📖  Última sesión — martes 24 de junio                                  │
│                                                                           │
│   "Avanzamos hasta el ejercicio 12 de la página 47.                       │
│    Mariana y Juan tuvieron dudas con factorización.                       │
│    Próxima clase: empezar fracciones algebraicas."                        │
│                                                                           │
│   ─── sesiones anteriores ───                                             │
│   · jueves 19 — "taller 2 entregado, faltan 3 estudiantes"               │
│   · martes 17 — "explicamos productos notables"                          │
│                                                                           │
│   ╭───────────────────────────────────────────────────────────────╮      │
│   │  ¿Cómo terminó hoy 9B? Escribe aquí…                          │      │
│   ╰───────────────────────────────────────────────────────────────╯      │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Pestañas del espacio de curso

- **Bitácora** — registro cronológico de sesiones.
- **Observaciones** — observaciones personales del docente sobre estudiantes (NO las oficiales).
- **Recaudo** — seguimiento privado de cobros.
- **Roles** — organización del salón.
- **Recursos** — archivos, links, materiales.

> Las pestañas que el docente no usa **se ocultan automáticamente** después de 60 días sin actividad. Se pueden reactivar desde un menú "+".

### Personalización visual de cada espacio

Cada espacio de curso permite:

- **Color base** (de una paleta curada de 12 colores)
- **Emoji o icono** (de una librería educativa)
- **Portada** (foto o gradiente sutil)
- **Banner opcional** (imagen propia, para los que quieran)

**Por qué importa:** convertir *"curso #48"* en *"MI 8A"* es lo que genera apropiación emocional. Es barato de construir y de altísimo retorno.

---

## 8. Microinteracciones y sensación

### Tipografía
- Títulos: **serif elegante** (GT Sectra, Tiempos, o similar) → señal de "esto es tuyo, no del colegio".
- Cuerpo: **sans humano** (Inter, Söhne) → legibilidad.
- Tamaños generosos: 18px cuerpo, 32px títulos. Aire para leer.

### Paleta
- Modo claro: tonos crema/papel (`#FAF8F3` fondo), no blanco puro.
- Modo oscuro: verdes profundos tipo pizarra (`#1A2B25`), no negro.
- Acentos: solo uno por espacio, definido por el color del curso.

### Animaciones (todas con easing suave, 200-400ms)
- Al cerrar un pendiente: el texto se tacha con animación de pluma, se desliza a "completados hoy".
- Al abrir un espacio: zoom suave desde la card, no transición dura.
- Al guardar un elemento: pulso sutil en el icono de tipo (no toast molesto).
- Al cambiar de día: el saludo cambia con fade.

### Microcopys humanos
- ❌ "No hay datos"
- ✅ "Aún no has anotado nada hoy. Tranquilo."
- ❌ "Error al guardar"
- ✅ "No se pudo guardar. ¿Lo intentamos otra vez?"
- ❌ "Tablero archivado exitosamente"
- ✅ "Listo, lo guardé."

### Momentos de satisfacción
- **Cierre de día**: *"Hoy hiciste 3 clases y cerraste 5 cosas. Buen día."*
- **Resumen de viernes**: *"Esta semana registraste 47 elementos. ¿Algo para el lunes?"*
- **Continuidad**: *"La última vez que estuviste con 9B me dijiste que…"*

---

# PARTE III — ARQUITECTURA

## 9. Modelo de datos

### 9.1 Compatibilidad con lo existente

El modelo actual usa `WorkspaceBoard`, `WorkspaceColumn`, `WorkspaceItem`. **No se rompe.** Se mantiene como capa de almacenamiento. Cambia la capa de UI y se agregan campos para personalización.

### 9.2 Cambios mínimos requeridos

**Sobre `WorkspaceBoard` (ahora "Espacio"):**
- `+ color` (string, hex)
- `+ emoji` (string)
- `+ coverImage` (string, URL opcional)
- `+ pinned` (bool, para fijar en home)
- `+ linkedClassId` (FK opcional al grupo/materia oficial)
- `+ hiddenSections` (array de strings, pestañas ocultas por desuso)

**Sobre `WorkspaceItem` (ahora "Elemento"):**
- `+ kind` (enum: NOTE, TASK, OBSERVATION, LOG, COLLECTION, IDEA, LIST, FILE, EVENT)
- `+ studentRef` (FK opcional a estudiante)
- `+ dueDate` (datetime opcional)
- `+ completedAt` (datetime opcional)
- `+ amount` (decimal opcional, para recaudos)

### 9.3 Nuevas entidades

- **`TeacherWorkspaceProfile`** (uno por docente): preferencias visuales, modo claro/oscuro, idioma, configuración del saludo.
- **`PersonalSpace`** (uno por docente): el espacio personal fijo, separado de los espacios de curso.

### 9.4 Espacios de curso automáticos

Al cargar el horario oficial del docente, el sistema **crea automáticamente** un espacio por cada grupo/materia que él dicta. El docente no los crea — los encuentra ya listos al entrar por primera vez. Esto resuelve el "estado vacío hostil".

---

## 10. Migración desde el sistema actual

> **Crítico:** hay docentes que ya usan tableros. No podemos romper su trabajo.

### Estrategia: rebranding sin pérdida

**Fase 0 — Preparación silenciosa (semana 0)**
- Agregar campos nuevos a las tablas existentes.
- Backfill: a cada `WorkspaceBoard` viejo se le asigna un color aleatorio de la paleta y un emoji por tipo.
- Crear `PersonalSpace` para cada docente.
- Crear espacios automáticos a partir del horario para cada docente.

**Fase 1 — Lanzamiento con bandera (semana 1)**
- Feature flag `NEW_WORKSPACE_UI` por docente.
- Los docentes nuevos lo reciben por default.
- Los docentes existentes ven un banner: *"Estrenamos Mi Espacio. ¿Lo pruebas?"* con opción de volver al anterior por 30 días.

**Fase 2 — Coexistencia (semanas 1-4)**
- Ambas UIs leen y escriben los mismos datos.
- Métricas: tasa de adopción, tasa de regreso al viejo, NPS comparativo.
- Soporte preparado con guion de transición.

**Fase 3 — Migración completa (semana 5)**
- Si las métricas son positivas, se desactiva la UI vieja.
- Los docentes que no migraron reciben aviso 7 días antes.
- Se mantiene un modo "vista clásica" leyendo los mismos datos por 90 días más, como red de seguridad.

**Fase 4 — Limpieza (mes 4)**
- Se retira el código de la UI vieja.
- Se documenta el cambio en changelog público.

---

# PARTE IV — PLAN

## 11. Fases de evolución del producto

### Fase 1 — Cambio de paradigma (mes 1-2)
**Objetivo:** que el docente deje de pensar en "tableros".
- Rebranding completo (tableros → espacios).
- Home nueva con HOY + MIS ESPACIOS.
- Captura con selector visual + caja libre.
- Espacios de curso creados automáticamente desde el horario.
- Estado vacío amable.

**Métrica de éxito:** 60% de docentes activos capturan al menos 1 elemento por semana.

### Fase 2 — Organización por contexto (mes 3-4)
**Objetivo:** que cada curso se sienta como un espacio vivo.
- Pestañas dentro del espacio de curso (Bitácora, Obs, Recaudo, Roles, Recursos).
- Ocultamiento automático de pestañas sin uso.
- Espacio personal completamente funcional.
- Vinculación automática a estudiantes (selector visual, no `@`).

**Métrica de éxito:** 40% de docentes activos abren al menos 3 espacios distintos por semana.

### Fase 3 — Personalización (mes 5)
**Objetivo:** que el docente sienta "esto es mío".
- Color, emoji, portada y banner por espacio.
- Modo claro/oscuro a nivel de espacio.
- Reordenamiento de espacios en la home.

**Métrica de éxito:** 70% de docentes personalizan al menos un espacio.

### Fase 4 — IA contextual (mes 6+)
**Objetivo:** que el sistema empiece a recordar y sugerir.
- *"La semana pasada anotaste que 8B quedó en pág. 47."*
- *"Tienes 5 estudiantes que aún no pagan la salida pedagógica."*
- *"Hace 12 días no registras una bitácora para 10C."*
- Resumen semanal automático los viernes.

**Métrica de éxito:** 50% de docentes interactúan con sugerencias de IA semanalmente.

> **Regla:** la IA no llega antes de la Fase 4. El docente primero confía en el espacio; después la IA aporta sobre esa base.

---

## 12. Lo que NO se construye (anti-scope)

Para mantener foco, estas cosas **explícitamente no entran** en este rediseño:

- ❌ Compartir espacios entre docentes (cada espacio es 100% privado).
- ❌ Sincronización con Google Drive / OneDrive (Fase 5 o nunca).
- ❌ App móvil nativa (la web responsive cubre el caso de uso).
- ❌ Plantillas comunitarias o marketplace.
- ❌ Chat con estudiantes o padres desde el espacio.
- ❌ Editor markdown completo (solo enriquecido básico).
- ❌ Reemplazar módulos oficiales (asistencia, notas, evaluaciones siguen donde están).

---

## 13. Decisiones tomadas (con justificación)

| Decisión | Por qué |
|----------|---------|
| Ocultar "tableros" en vez de eliminarlos | Hay base instalada que ya entiende el concepto. Migración suave. |
| Captura con selector visual + caja libre opcional | Sirve al 90% (selector) y al 10% (power) sin obligar a ninguno. |
| IA solo en Fase 4 | Sin datos limpios y sin trust del usuario, una IA temprana destruye confianza. |
| Personalización visual por espacio | Convierte *"curso #48"* en *"MI 8A"*. Apropiación emocional. |
| Home con 3 zonas máximo | El docente entra en huecos de 3-4 min. No hay tiempo de scroll. |
| Espacios de curso autocreados desde horario | Elimina el estado vacío hostil del primer ingreso. |
| Tipografía serif para títulos | Señal visual de "esto es personal, no corporativo". |
| Ocultamiento automático de pestañas sin uso | Reduce ruido sin perder funcionalidad. |
| Renombre: "anotación" → "elemento de organización" | Abre el modelo a archivos, eventos, listas sin reescribir. |

---

## 14. Próximos pasos inmediatos

1. **Validación con docentes reales** — 5 entrevistas de 30 min sobre los wireframes de este documento, antes de cualquier código.
2. **Mockups de alta fidelidad** — 3 pantallas clave: home, vista de espacio de curso, captura.
3. **Prototipo navegable** — Figma con flujo completo.
4. **Plan técnico detallado** — basado en este documento, ingeniería arma el plan de implementación de Fase 1.
5. **Plan de migración** — soporte arma el guion y los materiales de comunicación a docentes.

---

## 15. Apéndice — Glosario

- **Espacio**: contenedor superior. Reemplaza "tablero" en la UI. Puede ser de curso o personal.
- **Elemento**: unidad atómica dentro de un espacio. Reemplaza "item / card".
- **Sección**: agrupación dentro de un espacio (ej. pestañas Bitácora, Obs, Recaudo). Reemplaza "columna".
- **Espacio de curso**: espacio vinculado a un grupo/materia oficial. Autocreado desde el horario.
- **Espacio personal**: único, fijo, para lo que no pertenece a ningún curso.
- **Captura**: el acto de registrar un elemento nuevo.
- **HOY**: zona principal de la home con las clases del día.
- **MIS ESPACIOS**: zona de la home con las cards de todos los espacios del docente.

---

*Fin del documento de visión. Cualquier cambio requiere consenso del owner y debe quedar versionado al final de este archivo.*
