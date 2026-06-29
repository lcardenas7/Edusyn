# Estado del Proyecto — Mi Espacio Docente (Workspace V2)

> Documento vivo. Resumen de dónde vamos, qué falta y cómo retomar.
> Trabajamos 100% en la rama `staging`. Producción intacta.
> Última actualización: 2026-06-28

---

## Cómo retomar (si se pierde el contexto)
1. Leer `docs/MI_ESPACIO_DOCENTE_MASTER.md` (plan de las 20 secciones + roadmap por fases).
2. Revisar `git log` en la rama `staging` (cada fase es un commit `feat(workspace): Fx …`).
3. Este documento dice qué fase sigue.

---

## Fases completadas (rama `staging`)
- ✅ **F0** Fundación (Event, FollowUp, Activity, Favorite, DashboardConfig + backfill kind)
- ✅ **F1** Espacios de curso + módulos bajo demanda + "Activar módulo"
- ✅ **F2** Dashboard "Centro del día" (endpoint /today)
- ✅ **F3** Calendario (eventos + fechas oficiales read-only)
- ✅ **F4** Seguimientos (transversal, motor del dashboard)
- ✅ **F5** Bitácora completa (tipos, etiquetas, estados, buscar/filtrar)
- ✅ **F6** Recaudo (relacional, meta automática, parciales, historial) + buscador
- ✅ **F6b** Consolidación grupo 8B (script `apps/api/scripts/consolidate-group-b.cjs`)
- ✅ **F7** Roles (catálogo + selector con foto + historial)
- ✅ **F8** Observaciones (general/individual + seguimiento)
- ✅ **F9** Biblioteca (archivos/enlaces, carpetas, favoritos — usa módulo storage)
- ✅ Pulidos: nombre de curso "Grado Grupo", calendario más visible, fix timezone, encabezado sin solापamiento, personalización de header (diseños), Actividad reciente.

## Siguiente
- ⬜ **F10** Proyecto (entidad de primer nivel: objetivo, competencias, %, integrantes, checklist, evidencias, comentarios)
- ⬜ **F11** Lista + Tablero libre (Kanban DnD)
- ⬜ **F12** Espacio Personal (primitivas sin curso)
- ⬜ **F13** Diferenciadores (⌘K, plantillas, ritual de día)
- ⬜ **F14** Responsive completo + plan de pruebas
- ⬜ **Producción**: aplicar migraciones + script de consolidación (con backup) tras validar todo.

---

## Accesos / credenciales
- **Staging Web:** https://edusyn-web-staging-production.up.railway.app
- **Staging API:** https://edusyn-api-staging-production.up.railway.app
- **SuperAdmin (STAGING):** `superadmin@edusyn.co` / `Edusyn2026!` (temporal, reseteada 2026-06-28 — cambiar).
- **Producción:** sin tocar. Default seed era `Super2026!` (puede haber cambiado). Resetear con OK explícito cuando se necesite.

---

## Pendientes / TODO anotados
### 1. Módulo SuperAdmin de Instituciones (análisis pendiente)
El módulo actual solo crea instituciones; el usuario necesita más parámetros para verificar.
**Por definir con el usuario antes de implementar:**
- ¿Qué campos/parámetros faltan al crear/editar una institución?
- ¿Qué validaciones se requieren?
- ¿Qué datos de verificación/estado se necesitan ver?
- ¿Flujo de activación/suspensión, planes, límites?
Archivos relevantes: `apps/web/src/pages/SuperAdminDashboard.tsx`, `apps/api/src/modules/superadmin/*`, `apps/api/src/modules/academic/institutions.controller.ts`.

### 2. F6b en producción
El script `apps/api/scripts/consolidate-group-b.cjs` consolidó el grupo B en staging. En producción se correrá el mismo enfoque (con backup previo y verificación).

### 3. Seguridad (recordatorio)
Considerar rotar secretos vistos durante setup (R2, Supabase service role, JWT) — no urgente.

---

## Estrategia de documentación (acordada)
- `docs/` en el repo = fuente de verdad. Sin herramientas externas.
- **Este `ESTADO.md`** = documento vivo de progreso.
- **`MI_ESPACIO_DOCENTE_MASTER.md`** = plan/arquitectura.
- Mensajes de commit descriptivos = changelog.
