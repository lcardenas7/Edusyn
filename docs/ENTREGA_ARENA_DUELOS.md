# Entrega · Arena (Duelos) — experiencia de juego

**Rama de integración:** `codex/duelos-staging` · **Base:** `origin/staging` (584f4ed5)
**Worktree de origen:** `Edusyn/worktrees/duelos-experiencia`
**Estado de origen:** commit `32364b54`, sin push. Integrado a `codex/duelos-staging` como `30c5ce6f`; los arreglos de revisión continúan en esa rama.

> Se partió de `staging`, que ya incluía los Duelos y los bancos oficiales. **No se
> tocó el worktree `student-blocks-staging`** (tenía trabajo sin confirmar de los
> bancos de Arte 7.º) ni ningún otro.

---

## 1. Qué se construyó

### Backend (`apps/api/src/modules/classroom/`)

| Archivo | Cambio |
|---|---|
| `duel.service.ts` | Ranking, perfil e insignias, ruleta por ronda, bono de tema, rival al azar |
| `duel.controller.ts` | Rutas `GET .../ranking`, `GET .../me`; `usePower` y `invite` admiten los modos nuevos |
| `arena-badges.ts` | **Nuevo.** Catálogo de insignias en código, como `badge-catalog.ts` |
| `duel.service.spec.ts` | 28 pruebas (eran 5) |

**Sin cambios de esquema.** Nada de lo anterior necesitó migración.

1. **Ruleta por ronda.** `selectionMode: 'ROULETTE'` ya no fija una categoría: sortea
   una categoría y una pregunta **en cada una de las siete rondas**
   (`rouletteQuestions`). El duelo se guarda con `category: 'Ruleta'` y cada pregunta
   lleva la suya. Si ninguna categoría reúne 7 preguntas, cae a `'Mixta'`.

2. **Ranking** (`ranking`) con tres alcances: `group` (esta aula), `grade` (aulas del
   grado) y `general` (toda la institución en el año en curso). **Los puntos son por
   duelo, no por pregunta acertada:**

   ```
   Ganar 3 · Empatar 1 · Perder 0
   +2  partida perfecta (las siete correctas)
   +1  ganarle a quien iba por delante en la tabla
   ```

   Los duelos se recorren del más antiguo al más nuevo porque la bonificación de
   remontada necesita saber cómo estaba la tabla en ese momento. Desempates: aciertos
   → duelos jugados → orden alfabético. Tope de lectura: 2000 duelos (`truncated`).

3. **Perfil e insignias** (`profile`). Sobre todos los duelos terminados del
   estudiante en la institución. Familias: victorias, aciertos, hazañas (perfectas,
   remontadas, rachas) y **una escalera por cada categoría jugada**, generada a partir
   del JSON congelado de cada duelo. Devuelve también las bloqueadas con su progreso.

4. **Bono único con dos usos.** `usePower(..., kind)`:
   - `FIFTY` — descarta dos opciones incorrectas (el de antes).
   - `CATEGORY` — **elige el tema de la ronda siguiente.** No añade preguntas:
     intercambia dos de las siete ya congeladas. Ambos participantes responden el
     mismo conjunto; solo cambia el orden de quien gastó el bono.

   Se guarda en `ClassroomDuelPowerUse.options`, que es `Json`: array = 50/50 (formato
   antiguo, sigue funcionando), objeto `{kind, category, swap}` = tema. Por eso **no
   hizo falta migración**. `get` y `answer` aplican el intercambio con `applySwap`.

5. **Rival al azar.** `invite(..., { rivalMode: 'RANDOM' })` lo sortea el servidor
   entre compañeros **sin duelo abierto** contigo. No se acepta un id del cliente en
   ese modo.

6. `get` devuelve ahora `opponent`, `opponentEnrollmentId` (para la revancha) y
   `powerCategories` (temas que el bono puede adelantar).

### Frontend (`apps/web/src/pages/aula/`)

| Archivo | Qué es |
|---|---|
| `Arena.tsx` | Reescrito. Armazón con pestañas |
| `arena/Match.tsx` | **Nuevo.** La partida, a pantalla completa |
| `arena/Wheel.tsx` | **Nuevo.** La ruleta, en SVG |
| `arena/RankingBoard.tsx` | **Nuevo.** Tabla de posiciones |
| `arena/Profile.tsx` | **Nuevo.** Perfil e insignias |
| `arena/CategoryCard.tsx` | **Nuevo.** Tarjeta de categoría |
| `arena/mascots.tsx` | **Nuevo.** 14 mascotas SVG propias, en dos modos |
| `arena/categories.ts` | **Nuevo.** Catálogo nombre → mascota + color |
| `arena/sound.ts` | **Nuevo.** Sonidos sintetizados (sin archivos) |
| `arena/shared.tsx` | **Nuevo.** Tipos y piezas comunes |
| `index.css` | Animaciones de la Arena al final del archivo |

- **Cuatro pestañas** para el estudiante (Jugar · Duelos · Ranking · Perfil) y dos
  para el docente (Contenido · Ranking).
- **La ronda es una secuencia de cinco pasos** y se ven todos:
  `spin (2,8 s) → landed (0,9 s) → reveal (1,9 s) → reading (4,2 s) → answering`.
  En duelos de tema fijo se entra directo a `reading`.
- **Pantalla de la pregunta** con el color del tema de fondo, la pregunta en una
  tarjeta clara y las opciones como píldoras. La elegida se llena con el color de la
  categoría: marca la **selección**, no el acierto.
- **Mascotas** en `color` (grande) y `flat` (gajos y píldoras), con corrección óptica
  por mascota para que todas se vean del mismo tamaño.
- **Sonido** con interruptor persistente y **animaciones** que respetan
  `prefers-reduced-motion`.

### Bancos de pruebas visuales (solo desarrollo)

Siguen el patrón que ya existía (`aula-local.html`, `shell-aula.html`):

- `apps/web/arena-local.html` → `src/pages/aula/visual/arenaLocal.tsx`
  Monta la Arena **real** contra un servidor simulado que respeta las reglas del
  servicio. Interruptor para ver la pantalla del docente.
- `apps/web/mascotas.html` → `src/pages/aula/visual/mascotasDemo.tsx`
  Hoja de contacto de las mascotas en sus dos modos.

```bash
npm run dev --prefix apps/web
# http://localhost:5173/arena-local.html
```

---

## 2. Reglas que NO se tocaron (no romperlas)

1. **Las siete preguntas son las mismas para ambos.** El bono de tema solo reordena.
2. **La respuesta correcta no viaja hasta que ambos terminan.** `get` solo incluye
   `result` cuando el duelo está `COMPLETED`. Hay pruebas que lo fijan.
3. **El aislamiento por institución.** Todas las consultas nuevas filtran por
   `institutionId`; hay una prueba que lo comprueba en los tres alcances.
4. **El ranking no acepta cifras del cliente.** Se calcula con las respuestas guardadas.

---

## 3. Qué está verificado y qué no

**Verificado en la integración actual**

- `npx jest src/modules/classroom/duel.service.spec.ts --runInBand` → **30 pruebas en verde**.
- `npx tsc --noEmit` en `apps/api` → **sin errores**.
- `npx vite build --configLoader runner` en `apps/web` → **compilación exitosa** (4259 módulos).
- `npx jest src/modules/classroom/question-bank.service.spec.ts --runInBand` → **24 pruebas en verde**.
- Recorrido completo en el navegador a 375×812 sobre el banco de pruebas: rival al
  azar, secuencia de los cinco pasos (medida en el DOM, no a ojo), los dos bonos,
  ranking, perfil y tarjetas de categoría.

**Todavía no verificado en entorno real**

- No se probó contra base de datos real ni con dos estudiantes autenticados en staging. Las pruebas automatizadas cubren privacidad, reglas de ranking y poderes con mocks.

---

## 4. Pendiente, y por qué se paró ahí

### 4.1 Configuración del docente (pedida, no hecha)

Que el docente decida qué modos están disponibles (rival al azar sí/no, ruleta o
elegir tema). **`Classroom` no tiene ningún campo JSON** donde guardarlo, así que
exige migración:

```prisma
model Classroom {
  // …
  arenaConfig Json?   // { rivalMode, themeMode }
}
```

No se implementó en este alcance; la API actual sí pasa `tsc`.

### 4.2 Reloj con efecto real (parcial)

El reloj de 30 s **se ve y corre, pero no penaliza**: al llegar a cero el botón dice
«Se acabó el tiempo · responde igual» y la respuesta cuenta.

Para que cuente de verdad, el servidor tiene que registrar **cuándo entregó la
pregunta** y compararlo al responder; si lo controlara el navegador bastaría recargar
para esquivarlo. Necesita un campo nuevo (p. ej. `servedAt` en una tabla de entregas,
o `ClassroomDuelAnswer.servedAt`). Se dejó honesto a propósito, sin cuenta atrás
decorativa.

**Decisión de producto abierta:** si el tiempo se registra, el empate podría
resolverse por tiempo total (hoy un empate es empate).

### 4.3 Ilustraciones de las categorías

`CategoryCard` acepta `illustration?: string`. Mientras no exista imagen, dibuja la
mascota a color sobre un degradado. Las ilustraciones ricas del referente son
imágenes que hay que producir aparte; el hueco ya está preparado y entran sin tocar
la pantalla.

### 4.4 Otros

- No hay historial de preguntas vistas: un duelo puede repetir preguntas de otro.
- No hay torneo entre varios grupos del mismo grado (pedido en su momento). Requiere
  anclar el duelo a algo de nivel grado, no al aula: **migración**.
- No existe práctica contra la máquina.

---

## 5. Cómo continuar

1. `git worktree add <ruta> feat/duelos-experiencia-claude` (o trabajar en el
   worktree existente), `npm install`, `npx prisma generate` en `apps/api`.
2. `npx tsc --noEmit` en `apps/api` y `apps/web`. **Debe salir limpio antes de nada.**
3. `npx jest src/modules/classroom` en `apps/api`.
4. Probar en el banco `arena-local.html` y luego con datos reales en staging.
5. Antes de `push`, añadir fila en `docs/REGISTRO_DESPLIEGUES.md` (regla del CLAUDE.md).

**Siguiente alcance recomendado:** decidir una migración única para el reloj con efecto real, preferencias de Arena del docente y torneos entre grupos del mismo grado. También queda práctica contra la máquina. Estas funciones no están incluidas en la Arena que se prepara para staging.
