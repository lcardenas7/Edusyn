# Propuesta — qué debe ver un ACUDIENTE en el Aula

Fecha: 2026-09-09 · **Propuesta. No se implementó nada.**

> **Estado del código, verificado hoy:** el rol `ACUDIENTE` **cae en la vista de estudiante**. Las
> dos aulas usan exactamente el mismo criterio —`DOCENTE`/`COORDINADOR` → docente; **todo lo
> demás** → estudiante—, así que haber hecho predeterminada el Aula Nueva no cambió nada para el
> acudiente. No es una regresión; es un hueco que viene de antes.
>
> ```
> apps/web/src/pages/aula/index.tsx:138
> return nombres.some((n) => ['DOCENTE','COORDINADOR'].includes(n)) ? 'docente' : 'estudiante'
> ```
>
> `P0-6` en [`REDISENO_AULA_VIRTUAL.md`](REDISENO_AULA_VIRTUAL.md).

---

## 1. Por qué esto no es un bug

Un acudiente **no es un estudiante con menos permisos**. Es otra persona con otra pregunta.

El estudiante entra a **hacer**: resolver, entregar, participar. El acudiente entra a **saber**:
cómo va su hijo, qué debe entregar esta semana, si hay algo que atender. Darle la pantalla del
estudiante es contestarle una pregunta que no hizo.

Hay además un problema que no se arregla ocultando botones: **hoy el acudiente ve el aula como si
fuera el estudiante**, y eso incluye pantallas pensadas para actuar en nombre de él.

## 2. El problema que primero hay que decidir: **¿de qué estudiante?**

Un acudiente puede tener **varios acudidos**, y puede tenerlos **en grupos y grados distintos**.
La vista de estudiante asume un único sujeto implícito —el usuario autenticado— y esa suposición
no se sostiene aquí.

**Esto no es un detalle de interfaz: condiciona el modelo.** Antes de programar nada hay que
resolver:

1. ¿Cómo se resuelve la lista de acudidos de un acudiente? (relación en el modelo, y si un
   acudiente puede tener acudidos en **más de una institución**)
2. ¿Entra a un selector de hijo, o a un panel con todos?
3. ¿Qué pasa con un acudiente que además es docente en la misma institución?

## 3. Qué SÍ debería ver

| Bloque | Contenido | Por qué |
|---|---|---|
| **Cómo va** | Notas publicadas por asignatura y período, promedio, estado de promoción | Es la pregunta que trae |
| **Qué viene** | Actividades pendientes con su fecha, y las vencidas sin entregar | Le permite acompañar en casa, que es su papel |
| **Qué entregó** | Estado de cada entrega y la nota, cuando ya está calificada | Sin abrir el trabajo en sí |
| **Asistencia** | Faltas y retardos del período | Suele ser el motivo real de la consulta |
| **Observador** | Solo lo que la institución marque como comunicable a la familia | **Requiere decisión: hoy no existe esa marca** |
| **Comunicados** | Los que la institución le dirigió | Ya existe el módulo |

## 4. Qué NO debe ver — y esto es lo importante

| No debe ver | Motivo |
|---|---|
| **Los datos de otros estudiantes** | Incluye el **ranking** y el puesto: aunque el boletín los lleve, exponer la posición relativa a una familia es una decisión pedagógica que nadie ha tomado |
| **El contenido de las entregas** | El trabajo es del estudiante |
| **Notas en borrador o sin publicar** | Un docente califica en varias sesiones; una nota a medias genera una llamada innecesaria |
| **El foro** | Es espacio de convivencia entre estudiantes |
| **Observaciones internas** | Las de seguimiento pedagógico o disciplinario que no se han comunicado formalmente |
| **Inclusión / APD** | Datos sensibles, con su propio gobierno |

## 5. Qué NO debe poder hacer

**Ninguna escritura académica. Ninguna.**

| Acción | Por qué no |
|---|---|
| Entregar una tarea | La entrega es un acto del estudiante y su autoría queda registrada |
| Resolver un quiz | Ídem, y además invalida la evaluación |
| Publicar en el foro | No es su espacio |
| Editar el perfil del estudiante | Los cambios de matrícula van por secretaría |

Lo único razonable a futuro sería **acusar recibo** de un comunicado. Es escritura, pero sobre un
objeto suyo, no del estudiante. **Fuera de alcance hasta que se decida.**

## 6. Cómo lo implementaría, cuando se autorice

**Un rol propio, no un estudiante recortado.** Añadir `'acudiente'` al tipo `Rol` del aula, en vez
de dejar que caiga en el `else`. Un rol que se define por descarte acaba viendo lo que nadie
revisó.

Y la regla que hace que esto sea seguridad y no maquillaje:

> **El backend decide, la interfaz solo pinta.** Un acudiente que pida por HTTP la entrega de un
> estudiante debe recibir la misma respuesta que un desconocido. Ocultar el botón no es proteger
> el dato — es exactamente el defecto que estamos corrigiendo en Recuperaciones.

Orden de trabajo propuesto:

1. **Decidir** los tres puntos del §2 y la marca de «comunicable a la familia» del §3.
2. **Backend primero**: que toda lectura del acudiente exija que el estudiante sea acudido suyo,
   con pruebas A/B cruzadas —acudiente de un estudiante pidiendo datos de otro—.
3. **Después** la vista, que ya no puede filtrar nada que el backend no haya autorizado.
4. Al final, quitar el `else` que hoy lo manda a la vista de estudiante.

## 7. Riesgo de dejarlo como está

No es teórico. **Hoy un acudiente entra a la vista de estudiante de su acudido**: ve sus
actividades y sus paneles de entrega. Que las escrituras estén o no bloqueadas en el backend para
ese rol **no está verificado en este documento** — habría que comprobarlo, y es lo primero que
haría antes de tocar la interfaz.

**Recomendación:** verificar ese punto **antes** que el rediseño de la vista. Si resultara que un
acudiente puede entregar en nombre del estudiante, eso deja de ser una mejora de producto y pasa a
ser un defecto de integridad académica.
