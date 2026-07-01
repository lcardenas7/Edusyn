# Diseño C-5 — Papelera / Soft-Delete + Revisión de Cascadas

> Bloque C del Programa de Fortalecimiento. Ítem ⭐ del checklist de piloto.
> Base: auditoría Fase 1 (C-5) + Fase 2 (§6 continuidad, H8).

---

## ⚠️ CORRECCIÓN tras revisar el código (2026-07-01)

La auditoría subestimó el estado real: **la mayoría de los borrados YA están protegidos** con guard "bloquear si hay historia" (que es justo el patrón que se pedía):
- **Group.delete** bloquea si hay matrículas o carga docente. ✅
- **Grade.delete** bloquea si hay grupos. ✅
- **Area/Subject.delete** bloquean si hay dependencias. ✅
- **Student.delete** YA hace soft-delete (`deletedAt/deletedReason`) si hay historia; físico si no. ✅ (el patrón ya existe)
- **AcademicYear.deleteYear** solo permite borrar años en DRAFT sin matrículas. ✅

**Gaps reales encontrados y CERRADOS en C-5a:**
1. `TeacherAssignment.delete` revisaba notas pero **no asistencia** → al borrar, la asistencia se cascada-borraba en silencio. **Corregido**: ahora bloquea si hay notas **o** asistencia.
2. `TeacherAssignment.deleteAll` ("nuke" de carga docente, accesible a Admin) **no revisaba nada** → borraba en masa notas Y asistencia de toda la institución. **Corregido**: bloquea si existe cualquier nota/asistencia en el alcance.

**Conclusión:** C-5a (protección contra pérdida irreversible) se logra cerrando esos gaps, **no** construyendo una papelera nueva. La papelera con restauración (soft-delete extendido) pasa a ser **mejora opcional** (ver §5), no bloqueante para el piloto. El resto de este documento queda como referencia para esa mejora futura.

---

## 1. Diagnóstico (anclado en el esquema real)

- **No existe soft-delete**: en TODO `schema.prisma` hay **un solo** `deletedAt` (un documento). El resto de borrados son **físicos**.
- **235 relaciones `onDelete: Cascade`**. Varias son **catastróficas** porque destruyen historia académica sin retorno:
  - Borrar **`Group`** → cascada a `StudentEnrollment` → cascada a `PartialGrade`, `PeriodFinalGrade`, `AttendanceRecord`, observador, recuperaciones…
  - Borrar **`Student`** / **`StudentEnrollment`** → mismo efecto.
  - Borrar **`Grade`** (grado) → cascada a `Group` → todo lo anterior.
  - Borrar **`AcademicYear`** → cascada a términos, grupos, matrículas y toda la historia del año.
  - Borrar **`Subject`** / **`TeacherAssignment`** → cascada a notas y asistencia.
- **Endpoints DELETE reales de alto riesgo** (superficie de ataque): `academic-year-lifecycle DELETE :yearId`, `grades DELETE :id`, `groups DELETE :id`, `students DELETE :id`, `areas/subjects DELETE`, `teacher-assignments DELETE :id` y `DELETE all`.

**Consecuencia (Historia 8 / Caso 18 de la auditoría):** un admin que borra un grupo o un estudiante por error **destruye irreversiblemente** notas, asistencia y observador. Hoy solo se recupera restaurando **toda** la BD a un backup (perdiendo lo posterior).

---

## 2. Principios (no negociables para C-5)

1. **Borrar nunca destruye historia académica.** Si una entidad tiene notas/asistencia/observador asociados, no se elimina físicamente.
2. **Todo borrado de entidad raíz es reversible** durante una ventana de retención (papelera).
3. **La papelera es explícita**: quién borró, cuándo, qué, y quién puede restaurar (con auditoría — reutiliza el patrón de C-4/B).
4. **No sobre-diseñar**: NO se agrega soft-delete a las 235 relaciones. Se protegen las **entidades raíz** cuya pérdida es catastrófica; el resto queda cubierto por dependencia de ellas.
5. **Degradación segura**: mientras exista historia, el borrado físico se **bloquea** (no se "intenta y falla a medias").

---

## 3. Alcance — entidades raíz protegidas

Solo estas obtienen soft-delete + papelera (son las "raíces" de las cascadas catastróficas):

| Entidad | Por qué | Al borrar hoy |
|---|---|---|
| `Student` | Persona + toda su historia | Cascada total |
| `StudentEnrollment` | Ancla de notas/asistencia/observador | Cascada total |
| `Group` | Contiene matrículas | Cascada a matrículas → historia |
| `Grade` (grado) | Contiene grupos | Cascada en cadena |
| `Subject` | Notas dependen de él | Cascada a notas |
| `TeacherAssignment` | Notas/asistencia cuelgan de él | Cascada |
| `AcademicYear` | Raíz de todo el año | Cascada masiva |

> `Guardian`, `StudentDocument`, `Template`, `Shift` y demás **no** entran en C-5 (bajo riesgo / no destruyen historia académica). Se revisan aparte si hace falta.

---

## 4. Diseño técnico

### 4.1 Modelo
Añadir a cada entidad raíz (aditivo, nullable):
```
deletedAt   DateTime?   // null = activo; con valor = en papelera
deletedById String?     // quién lo envió a la papelera
```
Índice parcial por `deletedAt` para que los listados filtren barato.

### 4.2 Dos caminos de borrado
```
DELETE entidad raíz
   │
   ├─ ¿Tiene historia académica asociada (notas/asistencia/observador/matrículas activas)?
   │        SÍ → SOFT-DELETE (deletedAt = now, deletedById = actor) + evento de auditoría.
   │             Queda oculta pero recuperable. NUNCA cascada física.
   │        NO → permite HARD-DELETE (physical) — no hay nada que perder.
   │
   └─ En ambos casos: registrar en auditoría (quién/cuándo/qué).
```

### 4.3 Revisión de cascadas catastróficas
Las cascadas que destruyen historia se **neutralizan**: cambiar `onDelete: Cascade` → `onDelete: Restrict` en las relaciones raíz→historia (p. ej. `StudentEnrollment → PartialGrade/AttendanceRecord`). Así, si por cualquier vía se intenta un borrado físico con historia, **la BD lo impide** (defensa en profundidad, además del guard de aplicación).
- ⚠️ Requiere migración que altere las FK. Es la parte más delicada; se hace por lotes y se prueba.

### 4.4 Papelera (UI + API)
- **Listar** lo borrado (por tipo, con quién/cuándo).
- **Restaurar** (`deletedAt = null`) — con permiso y auditoría.
- **Purga** tras ventana de retención (p. ej. 30 días) — job (Bloque E) o manual por ahora.

### 4.5 Filtrado en lecturas (el "ripple")
Todo query de listado/uso de estas entidades debe excluir `deletedAt != null`. Es el mayor trabajo transversal. Estrategia para no romper nada:
- Usar el patrón de Prisma de filtrar en los servicios de lectura de estas entidades.
- Empezar por los servicios que ya filtran por `status: 'ACTIVE'` (matrículas) — mismo lugar.

---

## 5. Fases de C-5 (para aprobar por separado)

- **C-5a — Protección de raíces (núcleo):** `deletedAt/deletedById` en las 7 entidades + **guard de aplicación** que convierte el DELETE en soft-delete cuando hay historia + papelera básica (listar/restaurar) + auditoría. *Sin tocar las FK todavía.*
- **C-5b — Defensa en BD:** cambiar las cascadas catastróficas a `Restrict` (migración de FK por lotes, con pruebas).
- **C-5c — Retención/purga:** política de 30 días + purga (manual ahora; automática en Bloque E colas).

**Recomendación:** implementar **C-5a primero** (elimina el 90% del riesgo con cambio aditivo y sin alterar FK). C-5b después (más delicado). C-5c al final.

---

## 6. Riesgos y mitigaciones
- **Ripple de filtrado `deletedAt`**: si un query olvida filtrar, muestra basura borrada. → Empezar por entidades con pocos puntos de lectura; checklist por entidad.
- **Migración de FK (C-5b)**: alterar `onDelete` puede fallar si ya hay datos huérfanos. → Verificar integridad antes; hacer por lotes; probar en staging.
- **RLS**: las columnas nuevas no afectan RLS (solo `deletedAt/deletedById`).
- **Interacción con cierre de año**: el archivado histórico (año cerrado) NO es borrado; soft-delete y cierre son ortogonales.

---

## 7. Decisiones que necesito de ti antes de codear
1. **¿Ventana de retención?** (sugiero **30 días** antes de purga; purga manual por ahora).
2. **¿Quién puede restaurar/purgar?** (sugiero: restaurar = Admin/Coordinador con auditoría; purgar definitivo = solo SuperAdmin/Admin).
3. **¿Arrancamos por C-5a** (protección de raíces, aditivo, bajo riesgo) y dejamos C-5b (FK) como paso 2 aprobado aparte?
4. **¿Incluir `AcademicYear`** en la primera tanda, o tratar el borrado de año como caso especial (es el más destructivo y probablemente deba prohibirse salvo SuperAdmin)?

> Con tus respuestas, paso a Etapa 3 (implementación) de **C-5a**.
