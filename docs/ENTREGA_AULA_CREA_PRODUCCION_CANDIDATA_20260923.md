# Aula y CREA: candidato selectivo a producción

Fecha: 2026-09-23. Rama local `codex/aula-crea-production`, basada en `origin/main` `08a4627a`. **No publicada en `main` ni en Railway.**

El candidato incorpora los cambios de CREA (permiso docente para IA, ciclo de vida de apps y ajustes móviles), Classroom B1 (17/98 rutas) y el rediseño móvil de Aula con avisos, períodos y filtros de entregas. No fusiona `staging` completo, porque las ramas tienen historial divergente y trabajo de blindaje aún parcial.

Adaptaciones específicas a `main`:

- La API de comunicaciones del web aún sale de `lib/api.ts`; el hook de avisos utiliza esa exportación existente.
- El editor de quiz de `main` no ofrece los tipos `NUMERIC`/`CATEGORIZE`. Se retiraron los fragmentos de interfaz que llegaron en una resolución de conflicto, pues carecían de estado y soporte de API en esta base.
- `requireInstitutionId` devuelve 400 cuando una sesión no tiene contexto institucional, en vez de dejar escapar un 500 genérico.
- El primer commit de Classroom B1 trajo dos pruebas de copia de aulas de una línea distinta de staging. Esas pruebas invocan `cloneActivityContent`, método que no existe en `main` ni forma parte de las 17 rutas B1. Se excluyeron solo esas dos pruebas nuevas del candidato; los tests B1 de aislamiento, HTTP, relaciones y contrato Prisma siguen incluidos y verdes. La copia de aulas pertenece a las 81 rutas Classroom aún pendientes; no se declara blindada.

Verificaciones locales: Prisma generado; migración completa de este candidato aplicada en PostgreSQL 17 desechable (98 migraciones); tipos API y web limpios; API 67 suites/1245 pruebas; web 35 archivos/494 pruebas; Nest y Vite compilaron. El build web conserva un bundle principal de 5,9 MB antes de gzip, deuda de rendimiento de `main` que debe medirse en móvil. En staging, el despliegue anterior (`84db2558`) tuvo éxito en los cuatro servicios y la interfaz de Aula/CREA abrió con sesión docente. Esa cuenta no tiene aulas, por lo que falta recorrer una publicación y una entrega con un aula y matrícula de prueba. No usar datos de un colegio real para crear contenido de ensayo.

**Puerta de producción:** confirmar la compilación final del candidato, validar la nueva punta de staging y recorrer con cuentas de prueba un docente y un estudiante (publicación, aviso, cambio de período, filtros, entrega y CREA). Si cualquiera falla, corregir en staging y volver a validar esta rama antes de publicar `main`.
