# Edusyn Construye — operación segura

Este módulo trabaja con instituciones reales. Su desarrollo y despliegue siguen estas reglas:

- No ejecutar `prisma migrate reset`, `db push --force-reset`, seeds, truncados ni comandos de borrado contra staging o producción.
- Las migraciones son aditivas, revisables y con reversión por una nueva migración; nunca se edita una migración ya aplicada.
- Se valida primero en la base local con datos de prueba. Staging solo recibe cambios terminados, mediante el proceso habitual de la rama `staging` y con una fila nueva en `REGISTRO_DESPLIEGUES.md`.
- Producción (`main`) requiere validación explícita del usuario después de la comprobación funcional en staging. Nunca se usa producción para explorar, probar prompts ni cargar datos de demostración.
- Antes de un despliegue con migración se revisan: compatibilidad hacia atrás, índices, RLS por `institutionId`, claves foráneas, tiempo de bloqueo y un plan de reversión aditivo.
- El código de los estudiantes se mantiene separado del origen principal de Edusyn. El preview no recibe cookies, tokens, APIs internas, red ni datos académicos.
- Las conversaciones con ChatGPT, DeepSeek u otro proveedor ocurren fuera de Edusyn. La plataforma muestra un prompt copiable y no transmite nombres, matrículas, calificaciones o información institucional sin una decisión posterior, explícita y revisada.

## Estado actual

F0 y la base de F1 están solo en el espacio local. La migración `20260913010000_edusyn_construye_f1` todavía no se ha aplicado en staging ni producción.

**Gate de F0 (aislamiento del preview): cerrado el 2026-09-13.** El prompt de arranque exigía
una prueba que confirmara que el preview no recibe datos de sesión y que rechaza mensajes
inválidos antes de continuar. Se añadieron pruebas de confianza del puente en ambos extremos:

- Host (`apps/web/src/features/construye/protocol.test.ts`): `isTrustedPreviewMessage` rechaza
  mensajes de un origen distinto al iframe activo, con `instanceId` obsoleto (preview anterior) o
  con esquema/tamaño inválido; `buildLoadProjectMessage` se verifica campo a campo para probar que
  el único mensaje saliente hacia el preview nunca lleva JWT, cookies, usuario ni datos de
  institución.
- Runner (`apps/construye-preview/src/bridge.test.ts`): `isTrustedLoadProjectMessage` rechaza
  mensajes que no vienen exactamente de la ventana y el origin padre esperados, con protocolo o
  `instanceId` equivocado, con un tipo distinto de `load-project`, o con un proyecto que no sea
  texto estático puro.

Ambas suites pasan (`npm run test` en `apps/web` y en `apps/construye-preview`) y `tsc --noEmit`
sigue limpio en `apps/api` y `apps/web`. Esto no reemplaza una revisión adversarial manual con un
navegador real antes de habilitar estudiantes, pero cierra el requisito explícito de la fase F0.
La UI (`BriefBuilder`/`CodeWorkspace`) sigue sin conectar a los endpoints `/construye` de F1: es
el siguiente trabajo pendiente, no parte de este gate.
