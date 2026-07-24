# Edusyn — Experiencia del Rector (documento de producto / UX)

> Documento **de experiencia**, no técnico. Aquí no se nombra ninguna tabla, servicio ni endpoint — eso vive en `CONFIG_MODELO_Y_REDISENO.md`. Aquí solo hay: recorrido, pantallas, estados, progreso, mensajes y principios.
> Norte: el rector no configura un sistema. **Pone en marcha, opera y mejora su colegio.**
> Fecha: 2026-07-22

---

## 0. Filosofía del producto

Edusyn no debe sentirse como un ERP ni como un trámite gubernamental. Debe sentirse como un **asistente administrativo** que acompaña al rector.

**Regla de oro de diseño: cada pantalla responde UNA sola pregunta.**

```
¿Qué colegio administro?     →  Identidad
¿Cómo está organizado?       →  Estructura
¿Cómo evalúa?                →  Evaluación
¿Qué está pasando hoy?       →  Operación
¿Qué necesita mi atención?   →  Centro de control
¿Cómo puedo mejorar?         →  Acompañamiento (Valeria)
```

Si una pantalla intenta responder tres preguntas, está mal diseñada.

---

## 1. Tres etapas (no dos)

El colegio vive un ciclo, y la interfaz **cambia de piel** en cada etapa:

```
🏗  CONSTRUIR            ⚙  OPERAR                 ✨  MEJORAR
Poner en marcha         Gestionar el año          Elevar el colegio
(una vez)               (cada período)            (continuo, con Valeria)
                                                
Bienvenida + asistente  Centro de control         Valeria proactiva:
Progreso 0→100%         "qué requiere atención"   detecta, propone, acompaña
```

- **Construir** se hace una vez. **Operar** se repite cada período/año. **Mejorar** es continuo y proactivo.
- La etapa *Mejorar* es donde Valeria deja de esperar y empieza a **proponer** (planes de mejoramiento, propuestas de recuperación basadas en el MEN, alertas pedagógicas). Es la continuación natural de la Visión de Producto 2030 de Edusyn.

---

## 2. Construir vs Operar — separar dos mundos

Hoy todo se mezcla bajo "Configuración". Son dos mundos con propósito y frecuencia distintos:

| 🏗 Construir (raro) | ⚙ Operar (recurrente) |
|---|---|
| Identidad del colegio | Abrir / cerrar período |
| Sedes y jornadas | Ventanas de calificación |
| Organización académica | Recuperaciones |
| Cómo se evalúa | Promoción |
| Usuarios · Calendario base | Cierre y apertura de año |
| *"estoy armando mi colegio"* | *"estoy operando el año"* |

El rector entiende de inmediato si está **construyendo** o **administrando**. Durante la operación siempre hay un acceso discreto a "Ajustes del colegio" para retoques ocasionales — pero no es lo primero que ve.

---

## 3. El colegio tiene ESTADOS (la interfaz sigue el estado)

```
Estado             Inicio muestra…                        Progreso
─────────────────────────────────────────────────────────────────
Recién creado      Bienvenida + "¿Cómo quieres comenzar?"   0%
En puesta          Asistente + checklist con progreso       1–99%
en marcha          (menú lateral OCULTO)
Listo / operando   Centro de Control (misión del día)       100%
                   El asistente desaparece
```

Al llegar al 100%, **la interfaz cambia por completo**: el asistente se retira y entra el centro de operaciones. Es el mismo "Inicio" que maduró.

**El progreso es honesto:** cada paso se marca "Listo" solo cuando de verdad quedó completo y válido. Marcar como listo algo incompleto rompe la confianza en todo el sistema.

---

## 4. El recorrido completo

```
Primera vez
   │
   ▼
🎉 Bienvenida  →  ¿Cómo quieres comenzar?
   │
   ▼
Asistente de puesta en marcha (progreso, dependencias, Valeria acompañando)
   1. Información del colegio
   2. Sedes y jornadas
   3. Organización académica      (niveles → grados generados → grupos)
   4. Cómo se evalúa               (escala → composición de nota → períodos)
   5. Año académico                (crear y activar)
   6. Docentes                     (invitar / asignar)
   │
   ▼  (100%)
✅ "Tu colegio está listo para iniciar clases"
   │
   ▼
⚙ Centro de Control  →  operar el año
   │
   ▼
✨ Valeria  →  detectar y proponer mejoras (continuo)
```

El orden es **imposible de equivocar**: los pasos posteriores están bloqueados hasta cumplir sus dependencias, con el motivo siempre visible.

---

## 5. "¿Cómo quieres comenzar?" — un colegio no siempre parte de cero

Antes del paso 1, el asistente pregunta la **forma de arranque**:

```
┌─ Vamos a poner en marcha tu institución ─────────────────┐
│  ¿Cómo quieres comenzar?                                 │
│                                                          │
│   ○ Crear un colegio nuevo                               │
│        Empieza desde cero, paso a paso.                  │
│   ○ Copiar la configuración del año anterior             │
│        Reusa estructura y evaluación del año pasado.     │
│   ○ Usar una plantilla institucional (pública / MEN)     │
│        Estructura y SIEE estándar, lista para ajustar.   │
│   ○ Importar información existente                       │
│        Traes estudiantes, grados o notas desde archivos. │
│   ○ Restaurar un respaldo                                │
│                                                          │
│              [ Continuar ]                                │
└──────────────────────────────────────────────────────────┘
```

Cada modo **precarga** el asistente: "copiar año anterior" salta pasos ya resueltos; "plantilla MEN" trae escala y evaluación estándar; "importar" abre el flujo de archivos. El asistente deja de ser lineal-rígido y se vuelve poderoso.

---

## 6. El asistente — foco total, con Valeria al lado

Durante la puesta en marcha **el menú lateral desaparece por completo.** El menú invita a perderse; aquí solo importa el paso actual.

```
┌──────────────────────────────────────────────────────────┐
│  Paso 3 de 6                          ■■■■■■░░░░  60%      │
│  Organización académica                                  │
│  ──────────────────────────────────────────────────────  │
│                                                          │
│   (contenido del paso — una sola pregunta)               │
│                                                          │
│  🟣 Valeria                                               │
│   "Veo que activaste Primaria y Secundaria. ¿Genero los  │
│    grados estándar (1°–5°, 6°–9°) para que solo agregues │
│    los grupos?"            [ Sí, generar ]  [ Lo hago yo ]│
│                                                          │
│         [ Atrás ]                    [ Guardar y seguir ] │
└──────────────────────────────────────────────────────────┘
```

Valeria acompaña en cada paso con propuestas concretas, no genéricas:
- *"Tu colegio usa 4 períodos como el año pasado. ¿Copio esa configuración?"*
- *"Veo que eres institución pública. Puedo crear la estructura SIEE estándar del MEN."* → `[ Usar ]` `[ Personalizar ]`
- *"Los pesos de la nota no suman 100%. ¿Los reparto por ti?"*

Reduce trabajo real, no solo adorna.

---

## 7. Wireframes de las pantallas del asistente

### 7.1 Centro de puesta en marcha (checklist con estado)
```
┌─ Poner en marcha · Colegio San José ─────────────────────┐
│  Progreso                                   ■■■■■■░░░░ 60% │
│                                                          │
│  ✔ 1. Información del colegio            Listo   [Editar] │
│  ✔ 2. Sedes y jornadas                  Listo   [Editar] │
│  ✔ 3. Organización académica            Listo   [Editar] │
│  ▶ 4. Cómo se evalúa                  En curso [Continuar]│
│  ○ 5. Año académico                   Bloqueado          │
│        └ requiere terminar "Cómo se evalúa"              │
│  ○ 6. Docentes                        Pendiente          │
│                                                          │
│  🟣 Valeria: te faltan 2 pasos. El más rápido es         │
│      "Docentes" — puedo invitarlos por correo.  [Ver]    │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Paso 3 · Organización académica (grados generados, no tecleados)
```
┌──────────────────────────────  Paso 3 de 6 · ■■■■■■░░░░ ─┐
│  ¿Cómo está organizado tu colegio?                       │
│                                                          │
│  Niveles que ofreces:                                    │
│   ☑ Preescolar   ☑ Primaria   ☑ Secundaria   ☐ Media     │
│                                                          │
│  Primaria                       1° 2° 3° 4° 5°  (generados)│
│  Secundaria                     6° 7° 8° 9°     [+ agregar]│
│                                                          │
│   ┌─ Grado 5° ──────────────────────────────────────┐   │
│   │  Grupos:   5A    5B    [+ grupo]                 │   │
│   └──────────────────────────────────────────────────┘  │
│  ℹ Al activar un nivel generamos sus grados. Tú agregas  │
│    los grupos.                                           │
│         [ Atrás ]                   [ Guardar y seguir ]  │
└──────────────────────────────────────────────────────────┘
```

### 7.3 Paso 4 · Cómo se evalúa (lenguaje humano)
```
┌──────────────────────────────  Paso 4 de 6 · ■■■■■■■■░░ ─┐
│  1) Escala de valoración                                 │
│     Superior 4.6–5.0 · Alto 4.0–4.5 · Básico 3.0–3.9 ·   │
│     Bajo 1.0–2.9        Aprueba desde: 3.0    [Ajustar]   │
│                                                          │
│  2) ¿Con qué se arma una nota?                           │
│     ● Saber (Cognitivo)      40 %                         │
│     ● Hacer (Procedimental)  40 %                         │
│     ● Ser  (Actitudinal)     20 %           Total 100% ✔  │
│     ☐ Permitir que cada docente ajuste estos pesos       │
│                                                          │
│  3) Períodos del año     4 períodos · 25·25·25·25 [Ajustar]│
│                                                          │
│  🟣 Valeria: puedo traer el SIEE estándar del MEN. [Usar]│
│         [ Atrás ]                   [ Guardar y seguir ]  │
└──────────────────────────────────────────────────────────┘
```

---

## 8. El Centro de Control (después del 100%)

No es una lista de módulos: es un **centro de operaciones proactivo** que saluda y prioriza.

```
┌──────────────────────────────────────────────────────────┐
│  Buenos días, Rector.        Colegio San José · Período 2 │
│                                                          │
│  Hoy tienes:                                             │
│   🔴  14 docentes sin cargar notas                        │
│   🟡  Mañana vence la ventana de calificación             │
│   🟢  Todos los grupos tienen director                    │
│   🔵  3 solicitudes pendientes de aprobación              │
│   ⚠   El período 2 ya se puede cerrar                     │
│                                                          │
│  Año escolar   ● P1 cerrado  ● P2 abierto  ○ P3  ○ P4    │
│   [ Ver planillas ]  [ Cerrar período 2 ]  [ Promoción ] │
│                                                          │
│  🟣 Valeria: en Matemáticas el 48% está en desempeño bajo.│
│      ¿Genero un plan de mejoramiento?      [ Generar ]    │
│                                                          │
│  Tu colegio   1.500 estudiantes · 65 docentes · 45 grupos │
│  Accesos   Estudiantes · Docentes · Notas · Boletines ·  │
│            Reportes · ⚙ Ajustes del colegio               │
└──────────────────────────────────────────────────────────┘
```

Diferencia clave con hoy: el sistema **dice qué hacer**, no solo ofrece dónde entrar.

---

## 9. La etapa Mejorar — Valeria proactiva (visión)

Cuando el colegio ya opera, Edusyn deja de ser un sistema académico tradicional y se vuelve un acompañante:

```
🟣  "En Matemáticas 8° el 48% está en desempeño bajo.
     ¿Quieres que genere un plan de mejoramiento?"     [ Generar ]

🟣  "Aún no has definido criterios de recuperación.
     ¿Genero una propuesta basada en el MEN?"          [ Proponer ]

🟣  "El período 2 puede cerrarse. Revisé las notas:
     3 grupos tienen planillas incompletas."           [ Ver ]
```

Esto **no se implementa en el rediseño de config** — se diseñan los *ganchos* (dónde aparece Valeria) y se conecta a la visión de IA existente de Edusyn, entregándolo por fases. Evita inflar el alcance del rediseño ahora.

---

## 10. Nomenclatura (humano primero)

| Hoy | Propuesto |
|---|---|
| Configuración Institucional | **Mi Colegio** / **Ajustes del colegio** |
| Configuración SIEE | **Cómo se evalúa** (subtítulo: *Sistema de Evaluación · SIEE*) |
| Niveles Académicos | **Organización académica** |
| Procesos y Pesos | **Composición de la nota** |
| (nuevo) | **Año escolar** (operación) · **Poner en marcha** (asistente) · **Centro de control** (inicio operativo) |

---

## 11. Estados, errores y mensajes (tono)

- **Vacíos con acción:** "Aún no tienes grupos → generar", nunca una tabla vacía.
- **Bloqueos con motivo:** "Bloqueado — requiere terminar Cómo se evalúa" (nunca un botón gris sin explicación).
- **Errores humanos:** "Los pesos suman 90%, faltan 10% por repartir" en vez de "validation error".
- **Confirmaciones honestas:** al cambiar algo que recalcula boletines o promoción, decirlo claro y marcar qué es reversible.
- **Autoguardado** con "Guardado ✓" discreto — el rector nunca teme perder trabajo.

---

## 12. Principios (base del sistema de diseño)

1. Un rector entiende qué hacer en **menos de 30 segundos**.
2. Nunca se pregunta cuál es el siguiente paso.
3. Sensación **constante de progreso**.
4. Es **casi imposible** configurar en orden incorrecto.
5. Lo avanzado está **oculto** hasta que se necesita.
6. **Una pantalla, una pregunta.**
7. El sistema **propone**, no solo presenta opciones (Valeria).
8. Se siente **moderno y limpio** — comparable a Linear, Stripe, Notion, Shopify — aplicado a la educación.

---

## 13. Referentes
- **Stripe / Vercel:** checklist de onboarding con estado que desaparece al completarse.
- **Linear:** densidad limpia, jerarquía por tipografía, cero relleno.
- **Notion:** lenguaje humano, bloques, avanzado oculto.
- **Shopify admin:** separación tajante entre *configurar* (una vez) y *operar* (diario).

---

*El "qué se siente" está aquí. El "con qué funciona" está en `CONFIG_MODELO_Y_REDISENO.md`. Antes de escribir código de estas pantallas: aprobar este diseño (y el prototipo de alta fidelidad que lo acompaña).*
