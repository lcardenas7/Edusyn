# RUNBOOK · Separación de secretos entre staging y producción

> **Estado:** NO EJECUTADO. Requiere autorización explícita.
> **Derivado de:** `docs/security/RLS-AUDIT-FASE0.3.md` §3 y §4.
> **Ningún secreto aparece en este documento.**

---

## 0. Situación

Cinco secretos son **idénticos** en el servicio `api` (producción) y `edusyn-api-staging`.
Verificado por comparación de huellas SHA-256, sin exponer valores.

| Secreto | ¿Compartido? | ¿Lo usa alguien en el código? |
|---|---|---|
| `JWT_SECRET` | Sí | **Sí** — 5 puntos |
| `JWT_ACCESS_SECRET` | Sí | **No** — variable muerta |
| `JWT_REFRESH_SECRET` | Sí | **No** — variable muerta |
| `R2_SECRET_ACCESS_KEY` (+ `R2_ACCESS_KEY_ID`, `R2_BUCKET`) | Sí | **Sí** |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | **No** — variable muerta |
| `SUPABASE_URL` | Sí | **No** — variable muerta |

Consecuencias: un JWT emitido en staging es **criptográficamente válido en producción** (el
token no lleva `iss` ni `aud`, y `JwtStrategy` no consulta la base de datos), y staging escribe
en el **mismo bucket R2** donde viven los backups de producción.

---

## VENTANA 0 · Eliminar variables muertas — impacto CERO

> Sin consumidores en el código. Ni siquiera requiere ventana de mantenimiento.
> Es el primer paso recomendado de toda la contención: reduce superficie sin ningún riesgo.

### Verificación previa (obligatoria antes de borrar)

```bash
cd apps/api
grep -rn "JWT_ACCESS_SECRET\|JWT_REFRESH_SECRET\|SUPABASE_SERVICE_ROLE_KEY\|SUPABASE_URL" src/
# Resultado esperado: SIN COINCIDENCIAS
```

```bash
grep -rn "SUPABASE\|JWT_ACCESS\|JWT_REFRESH" apps/web/src/
# Resultado esperado: SIN COINCIDENCIAS
```

### Ejecución

- [ ] **0.1** Confirmar que ambos `grep` no devuelven nada.
- [ ] **0.2** Anotar los valores actuales en un gestor de contraseñas **antes** de borrar
      (por si hubiera un consumidor externo no detectado).
- [ ] **0.3** Eliminar en el servicio **`api`**:

```bash
railway variable delete JWT_ACCESS_SECRET        --service api
railway variable delete JWT_REFRESH_SECRET       --service api
railway variable delete SUPABASE_SERVICE_ROLE_KEY --service api
railway variable delete SUPABASE_URL             --service api
```

- [ ] **0.4** Eliminar las mismas cuatro en **`edusyn-api-staging`**:

```bash
railway variable delete JWT_ACCESS_SECRET        --service edusyn-api-staging
railway variable delete JWT_REFRESH_SECRET       --service edusyn-api-staging
railway variable delete SUPABASE_SERVICE_ROLE_KEY --service edusyn-api-staging
railway variable delete SUPABASE_URL             --service edusyn-api-staging
```

- [ ] **0.5** También existen en `apps/api/.env.example`. Retirarlas de ahí si aparecen, para
      que nadie las reintroduzca.
- [ ] **0.6** Verificar que ambos servicios arrancan. El código usa `getOrThrow` **solo** con
      `JWT_SECRET`, que no se toca aquí.
- [ ] **0.7** **Rotar la `SUPABASE_SERVICE_ROLE_KEY` en el panel de Supabase**, no solo
      borrarla de Railway. Es una clave de rol de servicio real; borrar la variable la retira
      del entorno pero **no la invalida**.

> ⚠️ Cada comando de Railway **debe llevar `--service` explícito**: existe un único
> environment (`production`) que contiene también los servicios de staging. Un comando sin
> `--service` puede actuar sobre producción.

---

## VENTANA 1 · Credencial R2 propia para staging — sin impacto en usuarios

### Situación verificada

`R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCOUNT_ID` y `R2_ACCESS_KEY_ID` son **idénticos** en ambos
servicios. No hay separación por bucket ni por prefijo. El workflow de backup escribe en
`s3://edusyn-files/backups/db/`, dentro de ese mismo bucket.

> **Corrección a la propuesta original:** no basta con generar un nuevo
> `R2_SECRET_ACCESS_KEY`. Las credenciales de R2 son **pares**: al crear un token nuevo cambian
> **`R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` a la vez**. Cambiar solo la clave secreta deja
> el servicio sin poder autenticarse.

### Ejecución

- [ ] **1.1** Cloudflare → R2 → crear el bucket **`edusyn-staging`**.
- [ ] **1.2** Crear un **token de API nuevo**, con permiso de *lectura y escritura*
      **limitado a `edusyn-staging`**. Anotar el par (`Access Key ID`, `Secret Access Key`).
- [ ] **1.3** Actualizar staging — **las tres variables juntas**:

```bash
railway variable set R2_ACCESS_KEY_ID=R2_STAGING_KEY_ID_PLACEHOLDER      --service edusyn-api-staging
railway variable set R2_SECRET_ACCESS_KEY=R2_STAGING_SECRET_PLACEHOLDER  --service edusyn-api-staging
railway variable set R2_BUCKET=edusyn-staging                            --service edusyn-api-staging
```

- [ ] **1.4** No tocar `R2_ACCOUNT_ID` ni `R2_ENDPOINT`: la cuenta es la misma.
- [ ] **1.5** Verificar en staging que una subida de fichero funciona y aterriza en el bucket
      nuevo.
- [ ] **1.6** **Los ficheros previamente subidos desde staging siguen en `edusyn-files`.**
      Decidir: migrarlos, o asumir que el histórico de staging se pierde (recomendado: asumir).

### Endurecimiento recomendado (mismo bloque de trabajo)

- [ ] **1.7** Crear un **token exclusivo para el backup**, con permiso **solo** sobre el
      prefijo `backups/db/`, y usarlo en el secreto de GitHub Actions. Así, ni siquiera la API
      de producción puede borrar sus propias copias.
- [ ] **1.8** Activar retención/bloqueo de objetos en `backups/db/` para que un borrado
      accidental no elimine el histórico.

---

## VENTANA 2 · `JWT_SECRET` propio para staging — cierra sesiones de staging

### Decisión de alcance

**Solo hay que cambiar el de staging.** Para romper la equivalencia entre entornos basta con
que dejen de coincidir. Rotar también el de producción cerraría **todas** las sesiones reales
(hasta 24 h de TTL para estudiantes y acudientes) y solo está justificado si se sospecha
compromiso del secreto de producción — cosa que la auditoría **no** ha establecido.

### Ejecución

- [ ] **2.1** Generar un secreto aleatorio robusto (≥ 32 bytes). No reutilizar ninguno
      existente y no anotarlo en el repositorio.
- [ ] **2.2** Aplicarlo **solo a staging**:

```bash
railway variable set JWT_SECRET=NUEVO_JWT_SECRET_STAGING_PLACEHOLDER --service edusyn-api-staging
```

- [ ] **2.3** Comprobar que el servicio de staging redespliega y arranca.
      `auth.module.ts` y `jwt.strategy.ts` usan `getOrThrow('JWT_SECRET')`: si falta, el
      arranque falla de forma ruidosa, no silenciosa.
- [ ] **2.4** Todas las sesiones de staging quedan invalidadas. Volver a iniciar sesión.
- [ ] **2.5** Verificar en staging: login, una petición autenticada, y **un stream SSE**
      (`live-session` y `play` verifican el JWT manualmente desde un *query param* con el mismo
      `JWT_SECRET`; son los consumidores fáciles de olvidar).

### Verificación de que la brecha queda cerrada

- [ ] **2.6** Un token emitido por staging debe ser **rechazado** por producción.
      Prueba controlada, **no destructiva**: obtener un token en staging con un usuario de
      prueba y hacer una petición `GET` de solo lectura contra producción; debe responder
      `401`. **No** intentar escrituras.

---

## VENTANA 3 · Endurecimiento estructural del JWT (recomendado, no urgente)

El problema de fondo no es que los secretos coincidieran, sino que **nada en el token
identifica el entorno**. Verificado: no se emite ni valida `iss`, ni `aud`, y el algoritmo no
está fijado.

Cambios propuestos (código, requieren su propio PR y pruebas):

```ts
// apps/api/src/modules/auth/auth.module.ts
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: '8h',
      issuer: config.getOrThrow<string>('JWT_ISSUER'),    // ej. "edusyn-production"
      audience: config.getOrThrow<string>('JWT_AUDIENCE'), // ej. "edusyn-api"
      algorithm: 'HS256',
    },
  }),
});
```

```ts
// apps/api/src/modules/auth/jwt.strategy.ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
  issuer: config.getOrThrow<string>('JWT_ISSUER'),
  audience: config.getOrThrow<string>('JWT_AUDIENCE'),
  algorithms: ['HS256'],
});
```

⚠️ **Dos puntos que este cambio obliga a tocar y son fáciles de pasar por alto:**

1. `live-session.controller.ts:32` y `play.controller.ts:29` verifican el JWT **a mano** con
   `jwt.verify(token, this.jwtSecret)`. Deben pasar también `{ issuer, audience, algorithms }`,
   o aceptarán tokens que la estrategia rechazaría.
2. Al desplegar, **todos los tokens vigentes dejan de validar** (no llevan `iss`/`aud`). Es
   equivalente a rotar el secreto: exige la misma ventana. Si se quiere evitar, se puede
   desplegar en dos fases (primero emitir con `iss`/`aud`, y una vez expirados todos los tokens
   antiguos —máximo 24 h— activar la validación).

---

## Orden recomendado y criterios de cierre

| Orden | Ventana | Impacto | Reversible |
|---|---|---|---|
| 1.º | **0** · Borrar variables muertas | **Ninguno** | Sí |
| 2.º | **1** · R2 propio para staging | Ninguno en producción | Sí |
| 3.º | **2** · `JWT_SECRET` propio en staging | Cierra sesiones **de staging** | Sí |
| 4.º | **3** · `iss`/`aud`/algoritmo | Cierra **todas** las sesiones | Sí, con despliegue |

- [ ] **C3** · `JWT_SECRET` distinto en staging y producción.
- [ ] **C4** · Las 4 variables muertas eliminadas de ambos servicios **y** la clave de Supabase
      rotada en su panel.
- [ ] **C5** · Staging usa credencial y bucket R2 propios y **no** puede escribir en
      `edusyn-files/backups/db/`.
