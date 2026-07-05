# AUDITORÍA DEL CATÁLOGO ACADÉMICO (Plan de Estudios)

> **Motivo:** el catálogo es confuso incluso para el fundador. Auditoría contundente + guía + propuesta práctica.
> **Método:** anclado en código real (frontend `AcademicCatalog.tsx`, `AcademicTemplates.tsx`, `AreasAdmin.tsx`, `Layout.tsx`, `App.tsx`; backend `areas.service`, `templates.service`; schema Area/Subject/AcademicTemplate/TemplateArea/TemplateSubject/GradeTemplate).
> **Fecha:** 2026-07-04.
> **Veredicto:** 🟠 **El modelo de datos es correcto y potente (reutilizable), pero la UX expone la fontanería: arma un plan de estudios obligando a entender 3 capas de indirección repartidas en 2 pantallas y ~4 modales, con conceptos duplicados y una tercera pantalla huérfana.**

---

# PARTE A — AUDITORÍA (por qué confunde)

## A.1 Las 3 capas (el modelo real)

```
CAPA 1 · CATÁLOGO      Area → Subject           "La biblioteca": qué materias existen.
   (definición)         (sin peso, sin horas,    Pantalla: Catálogo Académico
                         sin grado)

CAPA 2 · PLANTILLA     AcademicTemplate          "La receta" de un nivel, POR AÑO:
   (configuración)      → TemplateArea            área con peso%/cálculo/aprobación/recuperación
                        → TemplateSubject         asignatura con horas/peso%/dominante
                                                  Pantalla: Plantillas Académicas (tab "Plantillas")

CAPA 3 · ASIGNACIÓN    GradeTemplate             "Aplicar" la plantilla a un grado.
   (grado ← plantilla)                            Pantalla: Plantillas Académicas (tab "Grados")
```

El modelo es **bueno** (una misma materia "Matemáticas" se reutiliza en muchas plantillas, grados y años sin duplicar datos). El problema es que **la UI obliga al admin a pensar en las 3 capas**.

## A.2 El flujo real para lograr algo simple

Para que **"5.º tenga Matemáticas con 4 horas"** aparezca en el boletín, el admin debe hacer **6 pasos en 2 pantallas**:

1. Catálogo → crear **Área** "Matemáticas"
2. Catálogo → crear **Asignatura** "Matemáticas" dentro del área
3. Plantillas → seleccionar **año** → crear **Plantilla** "Primaria"
4. Plantillas → **agregar el área** a la plantilla (otra vez) + peso/cálculo/aprobación
5. Plantillas → **agregar la asignatura** al área-de-plantilla + **horas semanales**
6. Plantillas (tab Grados) → **asignar la plantilla a 5.º**

→ El admin piensa *"quiero Mate con 4 horas en 5.º"* y el sistema le pide **definir Mate, re-agregar Mate a una receta con horas, y luego pegar la receta al grado**. La relación "materia-definición" vs "materia-en-plantilla" es **invisible**.

## A.3 Problemas concretos

| # | Problema | Evidencia |
|---|---|---|
| **C-1** | **Doble concepto de "Área/Asignatura"**: existen en Catálogo (definición) y otra vez en Plantilla (con config). El admin agrega la misma área dos veces, en dos sitios, con significado distinto. | `Area`/`Subject` vs `TemplateArea`/`TemplateSubject` |
| **C-2** | **La relación entre las 3 capas no se explica en ningún lado.** No hay migas de pan ni texto que diga "esto alimenta a…". | `AcademicCatalog.tsx`, `AcademicTemplates.tsx` |
| **C-3** | **Pantalla huérfana**: `AreasAdmin.tsx` (1185 líneas) hace CRUD de áreas/asignaturas, está ruteada en `/admin/areas` pero **NO enlazada en el menú** → código muerto que confunde y puede editar el mismo dato por otra vía. | `App.tsx:304` sin entrada en `Layout.tsx` |
| **C-4** | **Rutas duplicadas**: Catálogo en `/academic-catalog` y `/academic/catalog`; Plantillas en `/academic-templates` y `/academic/templates`. | `App.tsx:337-360` |
| **C-5** | **Config de área duplicada**: `TemplateArea` tiene `calculationType/approvalRule/recoveryRule`, y a nivel institución existen `areaCalculationType/areaApprovalRule/...` (config institucional). ¿Cuál gana? No es evidente. ⚠ verificar precedencia | schema + `institution-config` |
| **C-6** | **Todo por año**: la plantilla pertenece a un `academicYearId`. Cada año hay que rehacer/duplicar plantillas (no hay "clonar del año anterior" evidente en el catálogo). | `AcademicTemplate.academicYearId` |
| **C-7** | **Tab "Grados" escondido**: la asignación grado↔plantilla (el paso que "enciende" todo) vive como una pestaña dentro de Plantillas, no como un paso visible del flujo. | `AcademicTemplates.tsx` `activeTab` |

## A.4 Riesgos

- **Adopción:** un admin de colegio se pierde antes del paso 4 → planes de estudio incompletos → boletines sin materias.
- **Datos:** editar por `/admin/areas` (huérfana) vs Catálogo puede divergir.
- **Operación anual:** sin "clonar plantillas del año anterior", cada año es trabajo manual repetido (ligado al hallazgo G-3 de la Fase 2).

---

# PARTE B — GUÍA DEL ADMIN (cómo armar el plan HOY)

> Menú: **Gestión Institucional → Catálogo Académico** y **→ Plantillas Académicas**.

**Regla mental:**
> **Catálogo = la biblioteca** (qué materias existen). **Plantilla = el plan de un nivel** (qué materias, con cuántas horas y peso). **Asignar a grado = encender el plan.**

**Orden correcto:**
1. **Catálogo Académico** → crea tus **Áreas** y, dentro de cada una, tus **Asignaturas**. (Solo definición: nombres y códigos.)
2. **Plantillas Académicas** → elige el **año** → crea una **Plantilla** por nivel (Primaria, Bachillerato…).
3. En la plantilla, **agrega las áreas** (define su peso y reglas) y dentro de cada una **agrega las asignaturas** con sus **horas semanales**.
4. En la pestaña **Grados**, **asigna la plantilla** a cada grado.
5. Luego, en **Carga Académica**, asignas el **docente** a cada grupo+asignatura.

**Si una materia no aparece en el boletín de un grado:** casi siempre es que falta el paso 3 (no está en la plantilla) o el paso 4 (la plantilla no está asignada al grado).

---

# PARTE C — PROPUESTA (hacerlo práctico sin romper el modelo)

**Principio:** conservar las 3 capas en los datos (son correctas para reutilización), pero **colapsarlas en UI en una sola tarea orientada al objetivo**: *"Arma el plan de estudios de un grado"*.

### C-Prop-1 · Vista unificada "Plan de Estudios" (recomendada)
Una sola pantalla con:
- **Selector de grado + año** arriba ("Plan de estudios de 5.º — 2026").
- **Lienzo**: áreas → asignaturas con horas/peso, editable inline.
- **Biblioteca (Catálogo)** como panel lateral: arrastrar/agregar una materia existente, o crear una nueva al vuelo (crea Area/Subject por detrás).
- Al guardar, el sistema crea/actualiza Catálogo + Plantilla + GradeTemplate **en una operación** — el admin nunca ve las 3 capas.

### C-Prop-2 · Asistente guiado (alternativa más simple de construir)
Wizard de 3 pasos: **Grado/Año → Áreas y materias (con horas) → Confirmar**. Reutiliza los endpoints actuales; solo orquesta el orden correcto.

### C-Prop-3 · Limpieza (rápida, cero riesgo — buen primer paso)
- **Eliminar la pantalla huérfana** `AreasAdmin.tsx` y su ruta `/admin/areas` (código muerto, C-3).
- **Unificar rutas** duplicadas (C-4).
- **Explicadores + migas de pan** en Catálogo y Plantillas: banner "Catálogo = biblioteca; para que una materia cuente en un grado, agrégala a una Plantilla y asígnala al grado" con enlaces (C-2).
- **"Clonar plantillas del año anterior"** (C-6).

### Orden sugerido
1. **C-Prop-3** (limpieza + explicadores) — inmediato, sin riesgo, ya reduce mucha confusión.
2. **C-Prop-2 o C-Prop-1** (flujo guiado / vista unificada) — el salto de usabilidad real.

---

## RESUMEN
El catálogo no está "mal hecho": su modelo de 3 capas (Catálogo → Plantilla → Grado) es sólido y reutilizable. Lo que falla es que **la UI expone esas 3 capas** y obliga a 6 pasos en 2 pantallas para algo que el admin piensa como una sola tarea, con conceptos duplicados y una pantalla huérfana. La solución es una **capa de UI orientada a la tarea** ("arma el plan de un grado") sobre el mismo modelo — sin migración, bajo riesgo — empezando por la limpieza + explicadores (C-Prop-3).
