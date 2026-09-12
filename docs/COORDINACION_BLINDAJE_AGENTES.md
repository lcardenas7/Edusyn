# Coordinación vigente del blindaje — Astra, Claude y Kimi

Fecha: 2026-09-12. Responsable de integración: **Astra**.

Este documento es la fuente vigente para evitar que dos agentes trabajen el mismo frente. Si una
instrucción anterior contradice esta asignación, prevalece este documento.

## Estado de partida

La base publicada al redactar este relevo es `origin/staging` en `a61fba2d`. La rama se mueve: cada
agente debe ejecutar `git fetch origin staging`, crear un worktree nuevo desde el `origin/staging`
vigente y registrar el hash real usado. Nadie debe forzar historial ni hacer push directo a
`staging`. Astra integra, rebasa, ejecuta la verificación común y publica.

El inventario global sigue abierto: 1.113 rutas, 338 resoluciones directas, 712 pendientes y 63
excepciones no institucionales. Un contador en cero no cierra por sí solo un módulo; hacen falta
servicios acotados, relaciones completas, pruebas A/B y HTTP, atomicidad y documentación.

## Asignaciones sin solapamiento

| Agente | Trabajo actual | Trabajo siguiente | No debe tocar |
|---|---|---|---|
| Claude | Terminar `Observer` según `ENCARGO_CLAUDE_BLINDAJE_OBSERVER.md` | `ENCARGO_CLAUDE_POSTGRESQL_BLINDAJE_B1.md`, después de que Astra integre Observer | Classroom, Inclusión, R1, EduLab, producción y datos compartidos |
| Kimi | `ENCARGO_KIMI_CLASSROOM_BLOQUE_1.md`, 17/98 rutas | Esperar integración y nuevo encargo | Observer, laboratorio PostgreSQL, RLS, otras 81 rutas de Classroom, cron, R1 y EduLab |
| Astra | Integración, revisión adversarial, estado, bitácora y siguiente módulo | Continuar el blindaje por riesgo | Trabajo no entregado de Claude/Kimi |

El anterior `ENCARGO_CLAUDE_CLASSROOM_BLOQUE_1.md` queda **cancelado y reasignado a Kimi**. Claude
no debe comenzar Classroom. Kimi no debe continuar más allá de las 17 rutas indicadas.

## Orden de integración

Observer, Classroom B1 y el laboratorio PostgreSQL viven en worktrees y ramas separados. Astra
puede integrar Observer y Classroom B1 en el orden en que superen revisión. Claude solo comienza
PostgreSQL después de que Observer aparezca integrado en `origin/staging`, para que el laboratorio
mida la base publicada y no una rama de entrega.

Cada entrega debe incluir ruta del worktree, rama, base exacta, commits en orden, ficheros, pruebas,
mutaciones o fallos provocados, cambios de comportamiento y límites. Una entrega sin esos datos se
considera pendiente de integración.

## Mensajes exactos para iniciar

**Claude**

> Termina Observer según `docs/ENCARGO_CLAUDE_BLINDAJE_OBSERVER.md`. Cuando Astra confirme que fue
> integrado, lee `docs/ENCARGO_CLAUDE_POSTGRESQL_BLINDAJE_B1.md` desde el nuevo `origin/staging` y
> ejecútalo completo en un worktree nuevo. No hagas push a staging y no empieces Classroom.

**Kimi**

> Lee `docs/ENCARGO_KIMI_CLASSROOM_BLOQUE_1.md` en `origin/staging` y ejecútalo completo en un
> worktree nuevo. Son exactamente 17 de 98 rutas; no toques las otras 81, el cron, RLS ni
> PostgreSQL. No hagas push a staging y no declares Classroom cerrado.

