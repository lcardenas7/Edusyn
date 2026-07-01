# Flujo de Relevo Docente (reemplazo de un docente por otro)

> Referencia operativa. Qué pasa, por dónde, y qué se conserva cuando un docente se retira y otro lo reemplaza.
> Estado del código: implementado en `staging` (commit `bbbfc6f`).

---

## Regla de oro
**Nunca se elimina la asignación del docente que sale.** Se **finaliza** (queda histórica con motivo) y se **crea una nueva** para el reemplazo. Así no se pierde historia. Intentar *eliminar* una asignación con notas o asistencia queda **bloqueado** (C-5a).

---

## Paso 1 — Crear el docente nuevo (si no existe)
El relevo requiere que el reemplazo ya exista como usuario docente.

- **Ruta:** menú lateral **Docentes** → `/teachers`
- **Clicks:** botón **"Nuevo Docente"** → llenar datos → **Guardar**.
- Resultado: usuario con rol DOCENTE + credenciales. (Si ya existe, saltar este paso.)
- **Permisos:** Admin institucional / Coordinador.

## Paso 2 — Transferir la carga al reemplazo
- **Ruta:** menú lateral **Carga Académica** → `/academic-load`
- **Clicks:**
  1. **"Transferir Carga"**.
  2. **Docente saliente** → se listan sus asignaciones.
  3. **Seleccionar** las asignaciones a transferir (todas o algunas).
  4. **Docente de Reemplazo**.
  5. **Motivo** (ej. "Licencia", "Retiro").
  6. **Confirmar**.
- **Endpoint:** `POST /teacher-assignments/transfer` (`transferFullLoad`). También existe el single `POST /teacher-assignments/:id/replace` (`replaceTeacher`).
- **Permisos:** Admin institucional / Coordinador.

### Qué ocurre automáticamente (una sola transacción, por cada asignación)
1. La asignación del saliente se **cierra** → `endDate` + `endReason` (queda histórica).
2. Se **crea una asignación nueva** para el reemplazo (mismo grupo + asignatura + año, `startDate` = fecha del relevo).
3. Se transfieren a la nueva asignación: **horario**, **notas (`PartialGrade`)** y **asistencia (`AttendanceRecord`)**.

## Paso 3 — El reemplazo entra y continúa
- Inicia sesión (cambia su contraseña temporal la primera vez).
- **Calificaciones** (`/grades`): ve la planilla del grupo **con las notas ya cargadas** (continuidad).
- **Asistencia** (`/attendance`): ve el historial del grupo.
- Aula virtual del curso: acceso normal como docente del grupo.

---

## Qué se conserva / qué no
| Elemento | Comportamiento |
|---|---|
| Asignación anterior | Histórica (endDate + endReason). No se borra. |
| Horario | Se transfiere a la nueva asignación. |
| Notas parciales | Se transfieren (continuidad). |
| Asistencia | Se transfiere (continuidad). |
| **Nota final del período** | No depende de la asignación (va por estudiante+materia+período) → intacta. |
| **Override manual de nota final (C-1)** | Se conserva. |
| Cuenta del docente saliente | **NO** se desactiva sola. Si se fue de la institución, desactivarla aparte en **Docentes**. |

---

## Notas y límites
- **Atribución de notas**: al transferir, las notas quedan bajo la asignación del reemplazo (el "libro de calificaciones" pasa al docente que continúa). La asignación histórica documenta hasta cuándo enseñó el anterior (endReason).
- **Migración perezosa (fallback)**: si por alguna razón se creó la asignación nueva sin usar transfer/replace, el guardado de la planilla (`bulkUpsert`) migra las notas del docente anterior de forma perezosa (auditando cualquier conflicto — C-3).
- **Sin conflictos de llave**: la asignación nueva nace vacía, por eso el `updateMany` de notas/asistencia no choca con la llave única.
