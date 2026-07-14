# Propuesta de Mejora — JoinPage (EduSyn Play)

> Análisis del refactor en curso del onboarding del jugador + recomendaciones de mejora.
> **Estado:** propuesta sin aplicar. Decisión pendiente.
> **Fecha:** 2026-06-26 · **Autor:** Análisis de diseño + ingeniería

---

## 1. Qué se está cambiando hoy

El refactor en curso (`apps/web/src/pages/play/JoinPage.tsx`, +331/-98) divide el paso "nickname" — antes una sola pantalla saturada — en **tres sub-pantallas con transiciones animadas**:

```
[1] Nombre  →  [2] Avatar  →  [3] Confirmación
●○○             ●●○              ●●●
```

### Lo que el refactor hace bien

| Decisión | Por qué funciona |
|----------|------------------|
| Una decisión por pantalla | Reduce carga cognitiva. Mismo principio que pregonamos para Mi Espacio Docente. |
| Progress dots con animación | El usuario sabe dónde está. Sensación de avance. |
| Avatar grande animado en confirmación | Genera satisfacción. Buen anclaje emocional antes de entrar a la partida. |
| Microcopys cálidos ("¡Listo, Luis!") | Humanidad en producto educativo. Encaja con el ADN de Edusyn. |
| Botón "Volver" entre sub-pantallas | Affordance de control. El usuario no se siente atrapado. |
| `handleJoin(e?)` con parámetro opcional | Permite ser llamado tanto desde form submit como desde botón directo. |
| Confetti badge ✨ con `spring` | Microinteracción de calidad Apple/Linear. |

**Veredicto del refactor en curso: alta calidad. Aplicar tras validación en staging.**

---

## 2. Lo que el refactor podría afinar antes de mergear

Tres ajustes pequeños que elevarían el resultado sin reescribir nada:

### 2.1 — La sub-pantalla "nombre" pierde la pista visual del avatar

**Antes** el input tenía un emoji del avatar como prefix (`{getAvatar(avatarId).emoji}` dentro del `<input>`). **Después** el input es solo texto plano centrado.

**Problema:** el usuario entra al paso "nombre" con un avatar ya pre-seleccionado aleatoriamente (línea 129: `useState(() => ANIMAL_AVATARS[Math.floor(Math.random() * ANIMAL_AVATARS.length)].id)`). Pero no lo ve. La sorpresa del avatar queda postergada hasta el paso 2.

**Sugerencia:** mostrar el avatar pre-seleccionado **como decoración pequeña** en la esquina superior derecha del input, con un microtexto *"Tu avatar inicial — lo eliges en el siguiente paso"*. Mantiene el flujo de "una decisión por pantalla" pero teasea lo que viene.

```tsx
<div className="relative">
  <input ... className="pl-4 pr-14 ..." />
  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl opacity-50">
    {getAvatar(avatarId).emoji}
  </span>
</div>
<p className="text-[10px] text-gray-400 mt-1 text-right">
  Avatar inicial — lo eliges al siguiente paso
</p>
```

### 2.2 — El "Continuar" del paso 1 podría validar más amablemente

Hoy: si el usuario presiona Enter con campo vacío, ve un error rojo (`"Ingresa un nombre para continuar"`).

**Sugerencia más amable:** deshabilitar el botón hasta que haya algo en el input. El error rojo solo aparece si **escribió algo inválido** (emojis, caracteres prohibidos, etc.).

```tsx
<button disabled={!nickname.trim()} ...>
```

(Esto ya está, pero hay un `setError('Ingresa un nombre...')` redundante en el `onSubmit`. Quitar el error pasa estados raros si el usuario clickea el botón cuando está deshabilitado en algunos browsers.)

### 2.3 — La sub-pantalla "confirmación" debería autonavegar a la sesión

Hoy: el usuario llega a "¡Listo, Luis!" y **debe presionar otro botón** ("Entrar al juego") para conectarse.

**Sugerencia:** después de 1.2-1.5s en la pantalla de confirmación (con la animación), **auto-llamar a `handleJoin()`** sin que el usuario lo pida. El botón queda como backup para quien quiera apurar.

```tsx
useEffect(() => {
  if (nicknameStep !== 'confirm') return
  const t = setTimeout(() => { if (!loading) handleJoin() }, 1400)
  return () => clearTimeout(t)
}, [nicknameStep])
```

**Por qué:** la pantalla de confirmación celebra emocionalmente. Pedirle al usuario que clickee de nuevo rompe el momento. La auto-navegación con delay corto convierte la celebración en **continuación natural**.

---

## 3. Lo que el refactor no aborda pero debería (mediano plazo)

### 3.1 — El archivo es un monstruo: 1,665 líneas, 7 estados, 22 hooks

`JoinPage.tsx` hace todo:
- Step `code` (entrar código)
- Step `nickname` (onboarding)
- Step `lobby` (esperando inicio)
- Step `active` (respondiendo preguntas)
- Step `interlude` (entre preguntas)
- Step `finished` (ranking final)
- Step `error`

Esto debería estar **descompuesto en componentes hijo**:

```
pages/play/JoinPage.tsx           ← solo orquesta steps
  steps/StepCode.tsx
  steps/StepOnboarding.tsx        ← donde vive el refactor en curso
    substeps/NameInput.tsx
    substeps/AvatarPicker.tsx
    substeps/ConfirmationCelebration.tsx
  steps/StepLobby.tsx
  steps/StepActive.tsx
  steps/StepInterlude.tsx
  steps/StepFinished.tsx
  hooks/usePlaySession.ts         ← lógica de sesión (SSE, status)
  hooks/usePlayerScore.ts         ← lógica de puntaje y rachas
```

**Beneficios:**
- Tests por componente.
- Cambios visuales del onboarding no rompen lógica de lobby.
- Cada archivo cabe en una pantalla. El humano puede entenderlo.
- El refactor en curso vive en su propio archivo de 250 líneas en vez de mezclarse con todo lo demás.

**Costo:** ~4-6 horas de extracción, riesgo medio. Hacerlo en una rama separada, probarlo en staging.

> **Nota:** no es bloqueante. El refactor en curso puede mergearse y luego, en una segunda iteración, extraer.

### 3.2 — El paso "code" se siente más frío que el "nickname"

El paso 1 (código) es funcional pero plano. El paso 2 ahora tiene 3 sub-pantallas animadas con personalidad. El contraste hace que el inicio se sienta corporativo y el onboarding se sienta personal.

**Sugerencia:**
- Animar la aparición del logo "Edusyn Play" con un fade-up sutil.
- Cuando el código es válido (6 dígitos), el botón "Buscar sesión" debería tener un pulso suave para invitar al click.
- Si el código se ingresa por URL (deeplink), saltar este paso con una micro-animación de "verificando sala" en vez de un loader genérico.

### 3.3 — Falta gestión de errores con personalidad

Hoy todos los errores se muestran con el mismo banner rojo (`bg-red-50 border border-red-200`). Pero hay errores distintos:

- "Código no encontrado" → empático, no agresivo. Sugerir verificar.
- "Sesión llena" → informativo, casi orgulloso ("¡La sala está full! Pídele al profe que abra otra.").
- "Sesión terminada" → neutral, redirigir a otra acción.
- "Error de red" → técnico, sugerir reintentar.

**Sugerencia:** componente `<PlayError>` que recibe `kind: 'not_found' | 'full' | 'finished' | 'network'` y muestra ilustración + mensaje + acción contextual.

### 3.4 — El refactor no aprovecha la pre-selección del avatar para acelerar

El estado inicial de `avatarId` ya tiene un valor random. **El usuario podría saltar el paso 2 directamente** si quiere — el avatar pre-asignado le sirve.

**Sugerencia:** en la sub-pantalla "nombre", agregar un botón secundario *"Entrar con avatar aleatorio →"* que salta directo a la sub-pantalla de confirmación. Los apurados ganan 5 segundos. Los curiosos siguen el flujo normal.

---

## 4. Decisiones más grandes que dejar para otra conversación

### 4.1 — ¿Cuenta Play o invitado? Mover esta decisión arriba del flujo

Hoy el banner "💡 ¿Quieres guardar tu progreso? Inicia sesión" aparece **dentro** del paso de nickname. Si el usuario clickea, pierde el contexto y vuelve perdido.

**Mejor:** un paso 0 opcional con dos botones grandes:

```
┌──────────────────────────────────┐
│   ¿Cómo quieres jugar?           │
│                                  │
│   ┌──────────┐  ┌──────────┐    │
│   │  Como    │  │  Con mi  │    │
│   │ invitado │  │  cuenta  │    │
│   │   →      │  │   Play   │    │
│   └──────────┘  └──────────┘    │
│                                  │
│   Saltar próxima vez ☐           │
└──────────────────────────────────┘
```

Esto sale del scope del refactor actual pero es la conversación que vendría después.

### 4.2 — Telemetría del onboarding

No estamos midiendo:
- ¿En qué sub-pantalla los usuarios abandonan?
- ¿Cuánto tardan en cada paso?
- ¿Qué % salta el avatar y va con el random?
- ¿Cuántos llegan al confirm y NO clickean "entrar"?

Con 3 sub-pantallas nuevas, sin telemetría no sabremos qué optimizar después. **Agregar eventos `play_onboarding_step_view`, `play_onboarding_step_complete`, `play_onboarding_abandon`** antes de soltar a producción.

---

## 5. Recomendación final

### Para el corto plazo (este sprint)

1. ✅ **Aplicar el refactor actual** tras validación en staging.
2. 🟡 Aplicar los 3 afinamientos del punto 2 (avatar peek, validación amable, auto-navegación).
3. 🟡 Agregar telemetría del punto 4.2 antes de prod.

### Para el siguiente sprint

4. ⚪ Extraer JoinPage en sub-componentes (punto 3.1).
5. ⚪ Componente `<PlayError>` con personalidad (punto 3.3).

### Para una conversación de producto futura

6. ⚪ Paso 0 invitado vs cuenta (punto 4.1).
7. ⚪ Refinamiento del paso "code" (punto 3.2).
8. ⚪ Atajo "avatar aleatorio" para usuarios apurados (punto 3.4).

---

## 6. Apéndice — Diff numérico del refactor actual

```
apps/web/src/pages/play/JoinPage.tsx | 429 +++++++++++++++++++++++++++--------
1 file changed, 331 insertions(+), 98 deletions(-)
```

- Imports nuevos: `ArrowLeft`, `Check`, `Edit3` (lucide-react).
- Estado nuevo: `nicknameStep: 'name' | 'avatar' | 'confirm'`.
- `handleJoin` cambia firma de `(e)` a `(e?)`.
- Estructura del JSX del step `nickname` reescrita por completo.
- Sin cambios en lógica de SSE, lobby, scoring ni ranking.
- Sin cambios en el modelo de datos del backend.

**Riesgo de merge: bajo.** Solo afecta la fase "nickname". Si rompe, el feature toggle podría ser por hostname (staging → nuevo, prod → viejo) mientras se valida.

---

*Fin de propuesta. Aplicar cuando el rediseño del Workspace docente esté en una fase estable y se pueda dedicar atención a esto.*
