# Edusyn Institutional Onboarding v2

> Documento **de proceso de negocio**, no de código. Define cómo un colegio pasa de "acabo de comprar Edusyn" a "sistema listo" en minutos, no en días. Es la base contractual para dividir el trabajo: **backend/negocio (equipo Edusyn)** ↔ **frontend (Kimi K3)**.
> Grounded: cada afirmación sobre "lo que hoy existe" referencia archivo real; lo demás se marca **[PROPUESTO]**.
> Fecha: 2026-07-22 · Complementa: `AUDITORIA_CREACION_INSTITUCION.md`, `REDISENO_EXPERIENCIA_RECTOR.md`, `CONFIG_MODELO_Y_REDISENO.md`.

---

## Punto de partida (estado real, verificado)

Hoy conviven **dos importadores solapados** y **ninguno** infiere el ecosistema:
- `iam/bulk` (`bulk-upload.controller.ts`): plantillas + carga de **docentes, estudiantes, personal**. `processStudentUpload` lee filas y **exige** que el grupo ya exista (no crea grados/grupos).
- `iam/grades-bulk-import` (`grades-bulk-import.service.ts`): importa **notas** desde Excel y de paso crea estudiantes; frágil (heurística de columnas, DEFINITIVA ignorada, borrado destructivo ya mitigado).
- **No existe** importador de **carga académica** (`TeacherAssignment` solo se crea individualmente, `academic/teacher-assignments.service.ts`).
- La institución nace casi vacía (`superadmin.service.ts:102`): sin sede, jornada, año, grados, grupos, áreas.

**Conclusión de partida:** el onboarding actual es "crear cosas a mano, una por una". v2 lo invierte: **el colegio entrega su información y Edusyn construye el ecosistema.**

---

## 1. Filosofía del onboarding

**Un colegio no quiere configurar un sistema. Quiere entregar su información y empezar a trabajar.**

Principios:
1. **"Aquí está mi información" → "listo en 10 minutos".** El trabajo del rector es *entregar y confirmar*, no *crear*.
2. **Edusyn infiere; el rector confirma.** Nada que se pueda deducir del Excel se pregunta.
3. **El ecosistema antes que las personas.** Primero grados/grupos/sedes/jornadas/áreas (deducidos), luego docentes y estudiantes.
4. **Nada se escribe sin previsualización.** Todo import es dos fases: *analizar (sin escribir) → confirmar → aplicar*.
5. **Errores humanos y accionables**, con reporte de cuadre (qué entró, qué no, por qué).
6. **Idempotente y transaccional.** Reejecutar no duplica; un lote es todo-o-nada.
7. **Legal por diseño.** Datos de 1.500 menores: consentimiento, minimización y trazabilidad desde el primer archivo (ver §8).

---

## 2. Flujo ideal de incorporación

```
1. Crear institución            (SuperAdmin: nombre, DANE, NIT, slug, admin, rector)
2. Identidad                    (logo, colores, ciudad)  — 1 min
3. SIEE base                    (escala, períodos, composición de nota) — plantilla MEN 1-clic
4. Subir Excel de ESTUDIANTES   → Edusyn ANALIZA y detecta el ecosistema:
      cursos → niveles → grados → grupos → jornadas → sedes
   ┌─────────────────────────────────────────────┐
   │ Se encontraron: 3 niveles · 11 grados ·      │
   │ 42 grupos · 2 jornadas · 1 sede              │
   │ [ Revisar ]     [ Crear todo ]               │
   └─────────────────────────────────────────────┘
5. Subir Excel de DOCENTES      → crea usuarios docentes (login + rol)
6. Subir Excel de CARGA ACADÉMICA → crea TeacherAssignment (docente↔grupo↔asignatura↔horas)
7. Confirmar y finalizar        → año activado, sistema listo
```

Todo lo demás (grados, grupos, sedes, jornadas, áreas, asignaturas) **se genera automáticamente** desde los archivos. El rector solo **confirma resúmenes**.

**Orden crítico (dependencias reales del modelo):** ecosistema (sedes→jornadas→grados→grupos, áreas→asignaturas) **antes** de personas; docentes **antes** de carga académica; matrícula requiere estudiante+año+grupo (`StudentEnrollment` FKs).

---

## 3. Casos de uso

| Caso | Qué trae | Qué hace Edusyn |
|---|---|---|
| **Colegio nuevo (año desde cero)** | Excel estudiantes + docentes + carga | Infiere ecosistema, crea todo, activa año en período 1 |
| **Colegio a mitad de año (tras P1/P2)** | Lo anterior **+ notas definitivas** de períodos ya cursados | Además carga las definitivas por asignatura como notas finales de esos períodos, y los bloquea (ver §5.5 y `AUDITORIA_CREACION_INSTITUCION.md` §A). **Hoy NO soportado.** |
| **Migración desde otra plataforma** | Export de otro sistema (formato ajeno) | Mapeo de columnas asistido → normaliza a los formatos oficiales → flujo estándar |
| **Colegio pequeño (<300)** | A veces sin Excel | Wizard manual también disponible; misma inferencia al vuelo |
| **Colegio grande (>2.000)** | Varios Excel, varias sedes | Import por sede/jornada; procesamiento por lotes; reporte de cuadre grande |

---

## 4. Formatos oficiales de importación (Excel)

> Reemplazan a la heurística actual. **Estructura fija y verificable** (encabezados exactos + hoja de instrucciones). Si el archivo no calza, se **rechaza** con mensaje claro (no se adivina).

**4.1 Institución** *(alternativa al form; opcional)*
`Nombre · DANE · NIT · Calendario(A/B) · Dirección · Ciudad · Departamento · Escala · Períodos`

**4.2 Docentes**
| Columna | Req | Formato / validación |
|---|---|---|
| TipoDocumento | ✔ | CC/CE/PA |
| Documento | ✔ | único en institución |
| Nombres · Apellidos | ✔ | |
| Correo | ✔ | único global (es login); si repetido → reportar |
| Celular | ○ | |
| Especialidad | ○ | |
| TipoContrato | ○ | |

**4.3 Estudiantes** (con acudiente en la misma fila)
| Columna | Req | Notas |
|---|---|---|
| Curso | ✔ | ej. `6A` → de aquí se **infiere** grado 6 + grupo A |
| Jornada | ○ | si falta → jornada única/por defecto |
| Sede | ○ | si falta → "Sede Principal" |
| TipoDocumento · Documento | ✔ | documento único en institución |
| PrimerNombre · SegundoNombre · PrimerApellido · SegundoApellido | ✔/○ | 4 columnas (formato ya soportado en `bulk-upload.service.ts:680`) |
| FechaNacimiento | ✔ (menores) | base para edad/curso |
| Género | ○ | |
| Acudiente (nombre) · Parentesco · TelAcudiente · CorreoAcudiente | ✔/○ | crea `Guardian` + `StudentGuardian` (N:M) |

**4.4 Carga académica**
`Curso · Área · Asignatura · IntensidadHoraria(horas) · DocumentoDocente(o Correo)`
→ crea `Area`/`Subject` si no existen, y `TeacherAssignment` (año+grupo+asignatura+docente). **Hoy no existe este importador.**

**4.5 Notas históricas** *(solo caso "mitad de año")* **[PROPUESTO]**
`Curso · Documento · Asignatura · Período · NotaDefinitiva` → escribe la definitiva como nota final del período (marcada como carga histórica), sin recalcular.

---

## 5. Reglas de inferencia automática

Motor que, dado un Excel (idealmente el de estudiantes o carga académica), **deduce el ecosistema sin preguntar**.

**5.1 Curso → Grado + Grupo.** `"6A"`, `"6°A"`, `"Sexto A"`, `"6 - A"` → grado **6**, grupo **A**. Regla: extraer el número/nombre de grado + el sufijo de grupo. Nombres compuestos (`"Transición A"`, `"Jardín"`) por diccionario.

**5.2 Grado → número (`Grade.number`) obligatorio.** Primero=1 … Undécimo=11, Transición=0. **Crítico**: sin `number` la promoción no puede ordenar los grados (ver Fase 1, `academic-level.util.ts`). La inferencia SIEMPRE fija el número.

**5.3 Grado → Nivel/Etapa (`stage`).** 0→Preescolar · 1–5→Básica Primaria · 6–9→Básica Secundaria · 10–11→Media. (Casos "CICLO N" de educación de adultos → no ordinales, se marcan para revisión manual.)

**5.4 Jornada y Sede.** De columna si existe; si no → jornada única + "Sede Principal" (se crean `Campus`/`Shift` por defecto, como ya hace `grades.service.syncGradesAndGroups`).

**5.5 Áreas y Asignaturas.** Del Excel de carga académica (`Área`, `Asignatura`). Si el área no viene, agrupar por asignatura en un área "General" revisable.

**5.6 Resumen de inferencia (obligatorio antes de escribir).**
```
Detectado desde "estudiantes.xlsx":
  Niveles: 3   Grados: 11 (1°–11°)   Grupos: 42
  Jornadas: 2 (Mañana, Tarde)   Sedes: 1
  Estudiantes: 1.500   Acudientes: 1.500
  ⚠ 2 cursos no reconocidos: "CICLO 3", "ACELERACIÓN" → revisar
[ Crear ecosistema y matricular ]   [ Ajustar ]
```

**Restricciones del modelo a respetar en la inferencia** (verificadas):
- `Grade @@unique([institutionId, stage, name])` — no duplicar grado por nombre+etapa.
- Grupo único por grado+sede+nombre.
- `StudentEnrollment` único por `(studentId, academicYearId)` — un estudiante, una matrícula por año.
- `TeacherAssignment @@unique([academicYearId, groupId, subjectId, teacherId, startDate])`.

---

## 6. APIs del backend por etapa **[CONTRATO PROPUESTO — a finalizar por el equipo de backend]**

Patrón uniforme de **dos fases** (analizar sin escribir → aplicar), reutilizando el patrón `previewImport`/`importGrades` que ya existe en `grades-bulk-import.service.ts`.

| Etapa | Endpoint propuesto | Método | Fase | Notas |
|---|---|---|---|---|
| Analizar ecosistema | `/onboarding/analyze` | POST (Excel) | dry-run | Devuelve el resumen de inferencia (§5.6). **No escribe.** |
| Aplicar ecosistema | `/onboarding/apply-ecosystem` | POST | escribe | Crea sedes/jornadas/grados/grupos/áreas/asignaturas en **una transacción**. |
| Docentes | `/onboarding/teachers` (o el existente `POST /iam/bulk/upload/teachers`) | POST (Excel) | 2 fases | Crea usuarios docentes + rol. |
| Estudiantes + acudientes | `/onboarding/students` (unifica `iam/bulk` + `grades-bulk-import`) | POST (Excel) | 2 fases | Crea `Student`+`StudentEnrollment`+`Guardian`+`StudentGuardian`. |
| Carga académica | `/onboarding/academic-load` | POST (Excel) | 2 fases | **Nuevo.** Crea `TeacherAssignment`. |
| Notas históricas | `/onboarding/historical-grades` | POST (Excel) | 2 fases | **Nuevo.** Solo caso mitad de año. |
| Estado del onboarding | `/onboarding/status` | GET | — | % completo, qué falta, qué está bloqueado. |

**Existentes hoy (para reusar/reemplazar):** `GET/POST /iam/bulk/{template,upload}/{teachers,students,staff}` (`bulk-upload.controller.ts`), `POST /grades/generate` y `/grades/backfill-numbers` (Fase 1), import de notas `iam/grades-bulk-import` (7 endpoints).

**Regla de contrato:** toda respuesta de fase "analizar" y "aplicar" devuelve `{ resumen, creados, actualizados, omitidos, errores[], advertencias[] }` para el reporte de cuadre.

---

## 7. Validaciones y reportes de error

**Por archivo (analizar):** encabezados exactos; tipos/documentos válidos; documento único; correo docente único; nota (histórica) dentro de la escala; cursos reconocibles.
**Por dependencia (aplicar):** ecosistema creado antes de personas; docente existe antes de carga académica; grupo existe antes de matrícula.
**Reporte de cuadre (obligatorio):** por cada archivo → filas OK, filas con error (con nº de fila y motivo humano), filas omitidas (duplicados), y entidades creadas. **Nada se aplica en silencio.**
**Transaccionalidad:** cada "apply" es todo-o-nada; ante fallo parcial, rollback y reporte.

---

## 8. Requisitos legales y de protección de datos (Colombia)

> Un colegio real sube PII de **1.500 menores**. Esto no es opcional.

- **Marco:** Ley **1581 de 2012** (Habeas Data) y Decreto **1377 de 2013**. Datos de **menores** requieren tratamiento especialísimo y **autorización del acudiente**.
- **Roles:** el **colegio es Responsable** del tratamiento; **Edusyn es Encargado**. → Debe existir un **Acuerdo/Contrato de Encargo de Tratamiento** firmado antes de cargar datos.
- **Autorización:** el colegio declara/garantiza que tiene la **autorización de tratamiento** de estudiantes y acudientes. Registrar esa declaración en el onboarding (checkbox con constancia + fecha + usuario).
- **Aviso de privacidad** y finalidad: usar los datos solo para fines académicos del colegio; **minimización** (no pedir datos que no se usan).
- **Seguridad:** acceso por rol (ya existe), auditoría (parcial — reforzar), cifrado en tránsito (HTTPS) y en reposo (verificar en Railway), y **cerrar el aislamiento multi-tenant del núcleo** (hoy sin RLS en tablas académicas — riesgo directo de fuga de PII entre colegios; ver auditoría §11).
- **Retención y supresión:** definir política; permitir exportar/eliminar por institución al terminar el contrato (soft-delete ya existe en `Student`).
- **No transferencia internacional** de datos sin garantías (relevante según dónde esté Railway).

**Acción mínima antes de la primera institución real:** contrato de encargo + registro de autorización en el flujo + cerrar el gap RLS del núcleo.

---

## 9. Diseño del asistente (Wizard)

Base: `REDISENO_EXPERIENCIA_RECTOR.md` (ya define principios, etapas y prototipo). El onboarding v2 es el contenido de la etapa **Construir**:

```
Bienvenida → ¿Cómo comenzar? (nuevo / mitad de año / migrar / plantilla)
  → Identidad → SIEE base → [Subir estudiantes → confirmar ecosistema]
  → [Subir docentes] → [Subir carga académica] → Activar año → Listo
```
- Menú lateral **oculto** durante el wizard; barra de progreso persistente.
- Cada subida = pantalla de **previsualización + cuadre** antes de aplicar.
- Valeria acompaña: "detecté 42 grupos, ¿los creo?", "faltan 3 docentes en la carga académica".
- Al 100%, transición al **Centro de Control**.

---

## 10. Especificación para el frontend (handoff a Kimi K3)

> Kimi recibe **solo** esto: pantallas, componentes, estados y consumo de APIs. **No decide lógica de negocio** (eso lo define el backend en §5–§7).

**Obligatorio (mobile-first):** diseñar primero a ~375px; táctiles ≥44px; tipografía base ≥16px; `inputmode` numérico para NIT/DANE/documento; tablas con scroll horizontal propio; sin menú en el wizard; progreso persistente; estados vacío/cargando/error/éxito en cada paso; accesibilidad AA + `prefers-reduced-motion`.

**Pantallas a entregar en DOBLE ancho (móvil ~375px y PC ~1280px):**
1. Bienvenida + "¿Cómo comenzar?"
2. Identidad (logo, colores, ciudad).
3. SIEE base (escala / composición de nota con validación 100% / períodos).
4. **Subir Excel de estudiantes** → **pantalla de resumen de inferencia** (§5.6) con confirmación.
5. Subir Excel de docentes → cuadre.
6. Subir Excel de carga académica → cuadre.
7. (Mitad de año) Subir notas históricas → cuadre.
8. Checklist de puesta en marcha (% + estados + bloqueos) y transición al Centro de Control.

**Componentes reutilizables que Kimi debe especificar:** `FileDropUpload`, `ImportSummaryCard` (resumen de inferencia/cuadre), `ProgressStepper`, `ValidationReportTable` (filas OK/error/omitidas), `WizardShell` (sin menú + progreso), `ValeriaHint`.

**Contrato de consumo:** cada paso llama `analyze` (muestra resumen sin escribir) → usuario confirma → `apply` (muestra cuadre). Estados de red: cargando, error con reintento, éxito con conteos.

---

## Cierre y división de trabajo

- **Equipo Edusyn (backend/negocio):** finaliza §5 (reglas de inferencia), §6 (contratos de API), §7 (validaciones), §4 (formatos), §8 (legal). Unifica los dos importadores actuales en el flujo v2 y construye los dos importadores faltantes (carga académica, notas históricas).
- **Kimi K3 (frontend):** implementa §10 contra los contratos ya definidos.

Este documento es el **contrato entre ambos**: mientras §5–§7 no estén cerrados, Kimi no debería empezar, para no rehacer. Una vez cerrados, el frontend y el backend avanzan en paralelo sin fricción.

*Nada aquí proviene de suposiciones sobre el código: lo existente está referenciado; lo nuevo está marcado [PROPUESTO].*
