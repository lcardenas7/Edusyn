# Consolidación académica y Aula — resultado de trabajo local

Fecha: 2026-09-08. No desplegado. Base: `0eec42ba7b364efc3408a48db27de2d564f0de4d`, copia aislada bajo `staging/` de esta carpeta. La rama abierta y los cambios previos de Claude se conservan.

## Correcciones implementadas

| Área | Defecto y resultado |
|---|---|
| Reportes históricos | El boletín desaparecía después del cierre por filtrar solo matrículas ACTIVE. Ahora admite estados del cierre y acota el grupo al año del período. Prueba HTTP: nota 2 conservada al cerrar y al activar el siguiente año. |
| PDF | Asistencia/observaciones quedaban a la derecha; fecha civil se desplazaba un día; ausencia de registros aparecía como 0%. Corregido y revisado visualmente. Filas adaptan altura y repiten encabezado al paginar. |
| Recuperaciones | Resultado inferior o tope menor podía reducir la nota original. Corregida regla de no disminución. |
| Revisión de recuperación | Rechazo conservaba 3 en el registro aunque el boletín mostraba 2. Ahora persiste la nota original. Regresión reproducida antes y aprobada después por HTTP. |
| Inclusión | Revocar consentimiento podía dejar activo el perfil. Ahora desactiva y registra la transición. |
| Acompañamiento | Cuerpo de creación podía sustituir institución resuelta; lectores por matrícula/ID no recibían institución. Corregidos esos contratos, con pruebas. No es certificación de todo el aislamiento. |
| Menús | Seguimiento e inclusión agrupados; matrícula/cierre/siguiente año con nombres claros; permisos de acceso diferenciados de permisos del personal. |
| Aula | Foro, materiales, anuncios y herramientas de actividades dentro del shell nuevo; editor conserva aula/actividad. Creación, copia y color incorporados. Cancelar programación no publica y cancelar devolución no devuelve. Diálogos de texto propios. Selector distingue año y cierre para el docente. |
| Copia de Aula | La primera comprobación visual reveló que la copia omitía actividades sin sección. Se corrigió para copiar tanto actividades de sección como las no seccionadas, mapear período equivalente al destino, dejar el contenido como borrador y no trasladar entregas ni calificaciones. |

## Evidencia ejecutada

- API: 61 suites / 1006 pruebas aprobadas (`jest-final.json`) y contrato de copia de Aula aprobado después de la corrección (`aula-copy-after.json`). Son pruebas automatizadas de alcance específico, no certificación de producción.
- Modelo frontend Aula: 14 archivos / 171 pruebas aprobadas. TypeScript web y build Vite aprobados antes del último ajuste de etiquetas; revalidación final en curso. Vite conserva advertencias de tamaño de paquetes.
- HTTP inicial: 11 casos aprobados en `http-flow-results.json` (observador, acompañamiento, consentimiento, configuración y consultas).
- Ciclo académico: notas 0, 2 y 4; anual 3 con pesos 50/50; cierre y rechazo del segundo cierre. El fallo original del histórico se conserva en `academic-cycle-results.json`; su corrección en `report-fixes-results.json`.
- Cambio de año: 2027 configurado y activado, una matrícula trasladada, repetición sin duplicado, histórico intacto. Primeros cinco casos de `next-year-aula-first-run.json`. Los errores posteriores de ese archivo fueron rutas incorrectas del script de prueba (`classroom` en vez de `classrooms`), no defectos del producto.
- Aula HTTP: diez casos aprobados en `next-year-aula-results.json`: material, anuncio, publicación/cancelación, foro, acceso y entrega estudiante, respuesta y calificación.
- Recuperación HTTP: pendiente mantiene 2; aprobación actualiza a 3 conforme al tope; rechazo corregido mantiene 2 en registro y boletín (`recovery-review-fixed.json`).
- PDF normal inspeccionado; caso de 40 asignaturas y textos largos produce cuatro páginas. Páginas de continuación y final inspeccionadas sin solapamientos (`boletin-extenso-page2.png`, `boletin-extenso-page4.png`).
- Navegación docente y estudiante: foro con respuesta estudiante, edición de tarea guardada, diálogo de devolución cancelado con calificación conservada, etiquetas 2026 cerrado/2027 visibles, creación de aula C, copia comprobada y quiz creado desde el acceso rápido con pregunta agregada. No equiparar estos casos a cobertura completa de todos los dispositivos/roles.

## Pendientes de aceptación

1. Completar seguridad HTTP cruzada entre instituciones A/B y roles, en coordinación con Claude. Los pendientes concretos están en `RELEVO_CLAUDE.md` (privado/local).
2. Revisar el índice de inclusión: mostró 15% con cero perfiles activos y un plan genérico. Acordar su significado antes de presentar esa cifra como indicador confiable.
3. Validar preescolar, escala 0–100, importaciones, matrícula tardía/retiro/reingreso, graduación y casos administrativos excepcionales del plan.
4. Reconciliar todos los reportes/exportaciones, históricos FINALIZED/snapshots y configuraciones cambiantes. La prueba realizada cubre el boletín básico y algunos lectores, no todo el catálogo.
5. Completar navegación de Aula: envío estudiante por interfaz, sesiones en vivo, rutas/proyectos, Valeria y pruebas móviles controladas. El quiz y la edición de preguntas ya se comprobaron; confirmar copia/color/materiales en más roles y tamaños. Los editores reutilizados conservan detalles visuales de su implementación anterior.
6. Evaluar rendimiento del módulo: carga diferida evita cargar todas las herramientas al entrar, pero persisten paquetes grandes.
7. Verificar con la revisión efectivamente desplegada cuando corresponda. No se ha validado staging/producción ni publicado cambios.

## Entrega e integración

`consolidacion-academica-aula.patch` contiene solo cambios de fuente y pruebas; `MANIFIESTO_CAMBIOS.json` identifica la base y los hashes. Revisar y aplicar selectivamente sobre una rama compatible. La cronología completa está en `BITACORA_CONSOLIDACION_20260908.md`. No fusionar la carpeta del laboratorio ni publicar sus secretos, datos, dependencias o relevo de seguridad. La auditoría completa permanece abierta mientras existan casos críticos pendientes.
