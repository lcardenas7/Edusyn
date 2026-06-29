# Plan de Pruebas — Mi Espacio Docente (Workspace V2)

> Checklist para validar el módulo en staging antes de pasar a producción.
> Entorno: https://edusyn-web-staging-production.up.railway.app
> Superadmin staging: `superadmin@edusyn.co` / `Edusyn2026!`

---

## 0. Regresión crítica (lo más importante)
El workspace es PRIVADO del docente y NO debe tocar el core académico.
- [ ] Notas oficiales sin cambios tras usar el workspace.
- [ ] Observador institucional sin cambios.
- [ ] Asistencia sin cambios.
- [ ] Boletines/reportes sin cambios.
- [ ] Un docente NO ve los espacios de otro docente.

## 1. Dashboard (Centro del día)
- [ ] Saludo + fecha correctos (zona horaria local, no marca el día siguiente de noche).
- [ ] "Centro del día" muestra recaudos pendientes, seguimientos, eventos del día, pendientes.
- [ ] Inteligencia: "sin actividad hace tiempo", "demasiados seguimientos".
- [ ] Actividad reciente muestra últimos elementos tocados y enlaza al espacio.
- [ ] Calendario: navegación de meses, evento marcado con barrita, fechas oficiales en ámbar, agregar/completar/eliminar evento.
- [ ] Seguimientos: crear, resolver, eliminar.
- [ ] Búsqueda ⌘K: encuentra estudiante/nota/recaudo/proyecto y abre el módulo correcto (?module=).

## 2. Espacios y módulos
- [ ] Una tarjeta por curso (no duplicados tras consolidación).
- [ ] Módulos aparecen solo si se usan o se activan.
- [ ] "+ Activar módulo" agrega y abre el módulo.
- [ ] Nombre de curso completo ("Décimo C").
- [ ] Encabezado: ícono visible (no tapado), personalización de diseño (gradientes/patrones/sólidos) persiste.

## 3. Por módulo
**Bitácora:** crear con tipo/etiquetas/importante, buscar, filtrar por tipo/estado, resolver, eliminar.
**Observaciones:** general vs individual (selector con foto), filtros, seguimiento opcional.
**Recaudo:** crear (valor × estudiantes = meta auto), buscar estudiante, pago parcial, historial, "solo pendientes".
**Roles:** preset + custom, asignar con foto, historial, quitar.
**Biblioteca:** subir archivo, agregar enlace, carpeta, favorito, abrir/descargar (URL firmada), eliminar.
**Proyecto:** crear, objetivo, estado, checklist (avance auto), integrantes desde roster.
**Lista:** prioridad/fecha/responsable, completar, filtros.
**Tablero (Kanban):** crear columnas, tarjetas, arrastrar entre columnas, color, eliminar.
**Espacio Personal:** card dedicada, solo módulos sin estudiantes (notas/lista/tablero/recursos/bitácora/proyecto).

## 4. Captura transversal
- [ ] Dentro de un módulo, "📅 Programar" crea evento ligado.
- [ ] "📌 Seguimiento" crea seguimiento ligado (aparece en dashboard).

## 5. Responsive (Desktop / Laptop / Tablet / Celular)
- [ ] Dashboard: 3 columnas en desktop, apila en tablet/móvil.
- [ ] Grid de espacios: 1→2→3→4 columnas según ancho.
- [ ] Grid de módulos y de biblioteca: se adaptan.
- [ ] Kanban: scroll horizontal en móvil.
- [ ] Modales: caben en pantalla pequeña (scroll interno).
- [ ] Barra de captura no tapada por el botón de búsqueda (oculto en espacios).
- [ ] Calendario y paneles legibles en móvil.

## 6. Performance
- [ ] Dashboard carga con una sola petición (/today).
- [ ] Búsqueda responde rápido (debounce 250ms).
- [ ] No hay llamadas en bucle (N+1) al abrir el dashboard.

---

## Despliegue a producción (cuando todo lo anterior pase)
1. Backup de la BD de producción (pg_dump).
2. Aplicar migraciones (`prisma migrate deploy` corre en el deploy).
3. Correr el script de consolidación equivalente (`apps/api/scripts/consolidate-group-b.cjs`) adaptado a los grupos reales de prod, con verificación de conteos.
4. Activar el flag `WORKSPACE_V2` gradualmente (tu usuario → 1 institución piloto → resto).
5. Mantener la UI clásica como respaldo 90 días.
