# Duelos de Matemáticas: preparación de producción (20 de octubre de 2026)

## Alcance de esta rama

`prep/math-duels-production-20261020` parte de `origin/main` e incorpora el módulo institucional de eventos, los bancos oficiales, Duelos, PWA, ranking, resultados, reacciones y audio opcional. Mantiene el Aula nueva de `main` y añade desde ella el acceso docente al banco. Esta rama no desplegó a `main` ni alteró datos de producción.

## Datos editoriales

- El código trae 300 preguntas oficiales de Matemáticas (150 de 6.º y 150 de 7.º). Importar esos dos catálogos al colegio produce 296 enunciados únicos para el evento, porque hay cuatro coincidencias exactas que la importación omite.
- `docs/duelos/matematicas_evento/REGISTRO_EDITORIAL.csv` contiene 550 filas: esas 300 oficiales y 250 suplementarias en lotes 2–11. Las 250 suplementarias son borradores, no se han importado ni son banco jugable. El piloto previo de 25 también queda fuera de este conteo.
- Los códigos y grados suplementarios son metadatos editoriales. El modelo del evento todavía no guarda grado por pregunta. La selección actual comparte siete preguntas con ambos rivales y prioriza las no vistas por ninguno, luego las no vistas por ambos y finalmente el conjunto completo. Antes de importar material de 8.º–11.º se necesita una batería común apta para todos o un selector por bandas de grado que conserve enfrentamientos entre grados.

## Pasos operativos antes de abrir el evento

1. Confirmar despliegue de API y web y aplicación de las seis migraciones nuevas de Duelos/bancos/eventos mediante `prisma migrate deploy` de Railway. Revisar logs de ambos servicios.
2. Comprobar en producción qué catálogos oficiales existen realmente en la base. Desde una cuenta docente del colegio, abrir un aula de 6.º y otra de 7.º, entrar en **Banco de preguntas** e importar el catálogo oficial de Matemáticas de cada grado. El catálogo incluido en el código no se carga automáticamente en la base.
3. Crear en **Eventos → Organizar** un borrador para Ciudadela 20 de Julio, con fechas y grados 6.º–11.º, importar los bancos publicados y comprobar el total de preguntas antes de publicarlo. Publicar solo después de revisar título, fechas, colegio, respuestas y explicaciones visibles, y límite diario.
4. Confirmar que las claves VAPID están configuradas en la API de producción y que la web se sirve por HTTPS para las notificaciones web. Las alertas dentro de la app deben seguir funcionando aunque el alumno no acepte Push.
5. Hacer un recorrido real con dos cuentas de estudiantes de distinto grado: invitación, aceptación, siete respuestas, resultado, ranking y recarga. Comprobar el acceso PWA en Android y «Compartir → Agregar a Inicio» en Safari/iPhone.

## Criterios técnicos

- Antes del push a `main`, ejecutar `tsc --noEmit` en `apps/api` y `apps/web` y confirmar el esquema Prisma.
- Revisar `docs/REGISTRO_DESPLIEGUES.md` antes del push; después registrar la entrega más reciente arriba, junto con el estado de migraciones.
- No importar automáticamente los 250 borradores editoriales ni dar por publicado un evento por el solo hecho de desplegar código.
