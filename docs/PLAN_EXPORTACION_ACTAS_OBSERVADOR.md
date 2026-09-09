# Exportación de actas del Observador

Fecha: 2026-09-09. Institución solicitante: Institución Educativa Distrital La Esperanza del Sur.

## Encargo operativo

Implementar una exportación formal y segura de las observaciones clasificadas como Acta Tipo I, II o III. El documento debe usar la identidad configurada de la institución, mostrar los datos completos del caso, permitir firma física y resolver de forma explícita los casos con varios estudiantes. Primero se valida localmente con datos sintéticos, después en staging y finalmente en producción sobre la misma revisión aprobada. No se deben crear, editar ni eliminar casos reales para probar la función.

## Formato institucional acordado

El encabezado toma sus valores de la configuración institucional, sin codificar datos de un colegio en el programa:

- nombre oficial;
- escudo institucional, cuando exista en el perfil;
- dirección;
- resolución oficial tomada de la configuración de boletines;
- NIT y código DANE, cuando estén registrados;
- color principal institucional.

Para La Esperanza del Sur, el encabezado solicitado es:

```text
IED LA ESPERANZA DEL SUR
DIRECCIÓN CARRERA 8C No. 93-92
APROBACIÓN RESOLUCIÓN OFICIAL 06197/2015
NIT 802.014.062-7
```

La búsqueda pública en producción confirmó el nombre `Institución Educativa Distrital La Esperanza del Sur` y el slug `/esperanza-del-sur`. La pantalla pública mostró el icono genérico de Edusyn, por lo que el escudo institucional no puede darse por configurado hasta revisar el perfil con acceso válido o recibir el archivo oficial.

## Regla para uno o varios estudiantes

- Una selección: acta individual.
- Varias selecciones del mismo hecho: el usuario puede generar una sola acta conjunta con todos los implicados, versiones y firmas.
- Varias selecciones que deben archivarse por expediente: se genera un único PDF multipágina con una acta individual por estudiante.
- La pantalla explica que el modo conjunto solo corresponde cuando las observaciones pertenecen al mismo hecho. La decisión queda en el responsable institucional.

## Contenido del documento

1. Encabezado e identidad institucional.
2. Tipo, número de acta, fecha, año lectivo y modalidad.
3. Estudiantes implicados y grupo.
4. Descripción objetiva de la situación.
5. Versión o descargos de los estudiantes.
6. Norma o apartado del Manual de Convivencia.
7. Medidas, acuerdos y compromisos.
8. Testigos u otros asistentes.
9. Firmas de docente que registra, director de grupo, coordinación, estudiantes y acudientes.
10. Pie de confidencialidad y numeración de páginas.

Si existe un `ActaRecord`, sus hechos, descargos, normatividad, medidas, testigos y consecutivo tienen prioridad. Si la observación está tipificada como acta pero aún no tiene ese registro complementario, se usan la descripción y la acción tomada, y los campos faltantes quedan claramente marcados para completar.

## Seguridad

- Solo se aceptan observaciones `ACTA_TYPE_I`, `ACTA_TYPE_II` y `ACTA_TYPE_III`.
- Todos los IDs se filtran por la institución resuelta desde el usuario autenticado.
- Si falta un ID o pertenece a otra institución, la respuesta no revela cuál existe.
- Rector, administración institucional y coordinación pueden exportar las actas de su institución.
- Un docente solo puede exportar actas que registró o de grupos que dirige.
- El endpoint es de lectura: genera un PDF y no modifica el Observador.
- Máximo 30 actas por solicitud para limitar exposición accidental y consumo de recursos.

## Plan de pruebas

1. PDF individual con y sin `ActaRecord`.
2. PDF conjunto de dos estudiantes con un mismo hecho.
3. PDF multipágina con una acta por estudiante.
4. Textos largos, tildes, nombres compuestos y varios firmantes.
5. Escudo válido, escudo ausente y color inválido con fallback.
6. ID de otra institución, observación no tipificada como acta y docente no autorizado.
7. Selección, descarga y nombres de archivo desde la interfaz.
8. Staging: utilizar datos de prueba, comprobar cabecera HTTP, apertura, impresión y navegación.
9. Producción: consultar un acta real ya existente con el responsable institucional; no crear ni editar datos para la prueba.

## Criterio de promoción

La versión puede pasar a producción cuando API y web compilen, las pruebas de Observador aprueben, el PDF renderizado no tenga recortes ni páginas vacías, el aislamiento institucional esté demostrado y staging permita descargar/abrir ambas modalidades. Antes de la aceptación final de La Esperanza del Sur deben estar configurados el escudo oficial, la dirección, el NIT, la resolución y el color institucional correctos.

## Registro de ejecución

- Implementación aislada desde `origin/staging` en `codex/observer-acta-export`.
- Sin migración de base de datos.
- Dos suites del Observador aprobadas: 53 pruebas.
- TypeScript web aprobado.
- TypeScript API aprobado después de generar el cliente Prisma correspondiente a staging.
- Build Vite de producción aprobado; conserva la advertencia existente de algunos paquetes mayores a 500 kB.
- Muestra conjunta renderizada en tamaño carta: dos páginas, contenido en la primera y firmas completas en la segunda, sin páginas vacías después de la corrección.
- Despliegue pendiente de completar y registrar en `docs/REGISTRO_DESPLIEGUES.md`.
