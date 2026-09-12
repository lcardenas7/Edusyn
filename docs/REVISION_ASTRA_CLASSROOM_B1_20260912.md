# Revisión adversarial de Classroom B1 — correcciones antes de integrar

Fecha: 2026-09-12. Rama revisada: `codex/blindaje-classroom-b1-kimi`, base `a61fba2d`, punta
`9ac64f02`. Estado: **entrega recibida, no integrada; Classroom continúa 0/98 acreditadas**.

Kimi debe añadir commits correctivos en su rama y devolver hashes, comandos y resultados. El
Bloque 2 (entregas, quiz y progreso) empieza solo después de que Astra integre B1 corregido.

## Defectos que bloquean la integración

1. `classroom.service.ts#getActivityAssignments`: se filtra
   `studentEnrollment.institutionId`, pero no `studentEnrollment.student.institutionId`, año,
   grupo ni cadena completa. Una matrícula A que apunta a estudiante B y un destinatario
   preexistente permite devolver nombre/foto de un menor B. El fixture ya incluye `enr-inc-A`:
   úsalo en la prueba de lectura, no solo al crear destinatarios.
2. `listForTeacher`, `listForStudent` y `getAvailableAssignments`: exigir en la consulta la cadena
   completa de asignación, año, grupo/campus/grado y materia/área. `listForStudent` debe exigir
   también `student.institutionId` y matrícula compatible; el conteo docente debe filtrar
   institución y estudiante, aunque cambie un número antes contaminado por una fila incoherente.
3. `getById`: la respuesta del estudiante incluye secciones/materiales sin filtrar visibilidad y
   `_count.activities` que cuenta borradores. Aplicar proyección específica para estudiante;
   `ClassroomB1Controller` no tiene filtro posterior. Períodos, secciones y materiales devueltos
   deben pertenecer al año/aula de la institución y cumplir visibilidad. No entregar una lista rica
   cruda al estudiante.
4. `getActivity`: la rama estudiante retorna `_count.submissions`, conteo interno del docente.
   Omitirlo y cualquier respuesta/resumen docente. En `listActivities`, filtrar la entrega del
   actor por `studentEnrollmentId` ya validado, no solo por `student.userId`.
5. `create` y `createActivity`: la guarda y el `create` están fuera de una misma transacción.
   `createActivity` además acepta `academicTermId` y `rubricId` sin comprobar institución, año,
   aula o compatibilidad; `sectionId` debe validarse por la cadena completa y responder 404 ante
   un ID ajeno. Guardas, comprobación de duplicado, lectura previa y escritura deben compartir
   `tx`, con el cliente raíz prohibido dentro del callback. Usar la unicidad de base para carreras
   y traducir colisión al comportamiento funcional correcto sin crear enlaces cruzados.

## Pruebas de aceptación nuevas

- Con el fixture A/B, demostrar que `getActivityAssignments` y su HTTP no devuelven `enr-inc-A`
  ni PII de B; repetir A→B/B→A y comparar con recurso inexistente.
- Insertar asignación A con año, grupo/campus/grado o materia/área de B por separado: ninguno de
  los tres listados la devuelve; una matrícula A→estudiante B tampoco lista aula.
- Estudiante autenticado en `GET /classrooms/:id` y `GET /classrooms/activities/:id`: no aparecen
  material/sección ocultos, borradores, respuestas internas ni `_count` de entregas; el mismo
  docente conserva la información que usa su pantalla.
- `academicTermId` y `rubricId` de B, de otro año de A o incompatibles con el aula: 404 antes de
  escritura. Lote/ID mixto conserva el estado original.
- En creación de aula y actividad, `tx` es objeto distinto; si falla el create, no queda efecto;
  si el recurso sale de alcance antes de escribir, no se crea un vínculo ajeno.
- Las pruebas deben fallar contra `9ac64f02` y pasar después. Haz mutaciones temporales de la
  validación de `student.institutionId` y de la proyección estudiante; registra los casos que
  caen, restaura y vuelve a verde.

## Documentación y límites

Actualizar `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md` y
`docs/ENTREGA_KIMI_CLASSROOM_B1.md`: el commit `9ac64f02` **sí retiró** las 17 excepciones y el
contrato final pasó; ambos documentos conservan texto anterior que dice lo contrario. Rectificar
las cifras y los comandos finales, además de los nuevos defectos y cambios de comportamiento.

No tocar las otras 81 rutas, cron, PostgreSQL/RLS, storage, esquema/migraciones, R1 ni EduLab.
Ejecutar focal B1 + contrato, suite API completa, tipos/build API, suite/tipos web y
`git diff --check`. Devolver una entrega verificable; Astra integra y actualiza estado/bitácora.

