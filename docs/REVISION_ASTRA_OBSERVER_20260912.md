# Revisión adversarial de Observer — correcciones antes de integrar

Fecha: 2026-09-12. Rama revisada: `codex/blindaje-observer-claude`, base `a61fba2d`, punta
`41025531`. Estado: **entrega recibida, no integrada; Observer no declarado cerrado**.

Claude debe añadir commits correctivos a su rama, no hacer push a `staging` y devolver los hashes,
comandos y resultados. El encargo PostgreSQL B1 sigue después de esta integración, no antes.

## Defectos que bloquean la integración

1. `observer.service.ts`: `observationFullInclude` carga compromisos, citaciones, remisiones y
   medidas sin acotar cada colección hija a la institución del actor y a la misma matrícula.
   `getById` puede validar una observación de A y devolver una fila histórica hija de B que apunta
   al `observationId` de A. Corregir en el `where` de cada relación o con una proyección acotada;
   incluir filtros de relaciones de estudiante, año, grupo/campus y grado cuando se devuelva PII.
2. `observer.service.ts`: la guarda `observationInScope` y las lecturas por matrícula deben validar
   la cadena completa `studentEnrollment.institutionId`, `student.institutionId`,
   `academicYear.institutionId`, `group.campus.institutionId`, `group.grade.institutionId` y
   `group.shift.campus.institutionId`. La
   columna propia y solo `campus` no bastan. Aplicar también a los `where` finales, no únicamente a
   una guarda previa.
3. `observer-acta-pdf.service.ts`: las dos exportaciones deben usar la misma cadena completa antes
   de obtener identidad, logo, matrícula, nombres, grado o sede y antes de emitir bytes. Un lote
   mixto propio/ajeno o propio/incoherente debe fallar íntegro, sin PDF parcial.
4. `childInScope` y listados de compromiso, citación, remisión y medida: si la fila tiene
   `observationId`, exigir que esa observación sea propia y corresponda a la misma matrícula. Una
   fila A enlazada a observación B no debe aparecer ni poder editarse aunque la columna
   `institutionId` del hijo sea A.
5. Las escrituras `updateMany`/`deleteMany` no deben quedar solo con `{ id, institutionId }` tras
   una guarda relacional. Bajo READ COMMITTED otra transacción puede cambiar la FK entre guarda y
   escritura. Añadir la condición relacional completa al `where` de la escritura y comprobar
   `count`, o demostrar bloqueo/serialización equivalente. Probar el cambio de FK entre ambas
   operaciones.

## Pruebas de aceptación nuevas

- Extiende el fixture A/B con observación A + hijo B enlazado a ella, hijo A → observación B, y las
  variantes matrícula A → estudiante B, año B, grado B y jornada con sede B, cada una por separado.
  Las FKs simples del esquema permiten
  representar estas incoherencias históricas; no supongas que una fila con `institutionId=A` es
  coherente.
- `GET /observer/:id`, lecturas de colección, timeline y summary no devuelven ni una palabra de
  PII de B; las creaciones/ediciones rechazan IDs secundarios incoherentes antes de escribir.
- Exportaciones de acta y seguimiento rechazan lote mezclado antes de crear PDF o enviar bytes.
- En las 28 rutas, las pruebas HTTP que reciben matrícula/observación incoherente devuelven 404
  indistinguible de inexistente. Afirma cero escrituras y cero lecturas secundarias sensibles.
- El doble Prisma debe materializar los `include` y aplicar de verdad filtros relacionales anidados
  e `include.where`; hoy las inversas vacías/no enumerables del fixture ocultan este defecto. La
  prueba debe quedar roja con la implementación de `41025531` y verde tras la corrección. Ejecuta una
  mutación temporal de la cadena estudiante/año/grado y registra qué pruebas caen; restaura.

## Entrega y límites

Actualizar `docs/AUDITORIA_AISLAMIENTO_OBSERVER.md` y `docs/ENTREGA_CLAUDE_OBSERVER.md` para que
la matriz, las cifras y los límites describan el head real. No sustituir pruebas anteriores ni
debilitar el contrato. No tocar Classroom, PostgreSQL, RLS, otras rutas, esquema o migraciones.
Ejecutar focal Observer + contrato, suite API completa, tipos/build API y pruebas/tipos web. Los
28 retiros del JSON pueden conservarse en el último commit existente si el contrato sigue verde;
los commits de corrección deben tocar solo Observer, fixture, pruebas y sus documentos.

Si una relación no admite `where` en un `include`, usar una lectura/proyección explícita acotada;
no devolver el objeto Prisma sin filtrar. Declarar cualquier autorización fina todavía abierta.
