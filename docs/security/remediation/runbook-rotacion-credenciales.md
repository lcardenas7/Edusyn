# RUNBOOK · Rotación de la credencial de PostgreSQL de producción

> **Estado:** NO EJECUTADO. Este documento describe el procedimiento; no lo aplica.
> **Requiere:** autorización explícita del responsable + ventana de mantenimiento.
> **Derivado de:** `docs/security/RLS-AUDIT-FASE0.3.md` §2.
> **Ningún secreto aparece en este documento.** Los marcadores son
> `POSTGRES_PASSWORD_PLACEHOLDER`, `NUEVA_DATABASE_URL_PLACEHOLDER`.

---

## 0. Resumen del incidente

La contraseña del rol `postgres` de la base de datos de **producción** está versionada en
Git y es la credencial **actualmente válida**. El rol es `SUPERUSER` con `BYPASSRLS`, es
decir: acceso total de lectura y escritura a los datos de 5 instituciones reales, saltándose
la aplicación y cualquier RLS futuro.

| | |
|---|---|
| Servicio Railway origen | `Postgres` (environment `production`) |
| Host público | `centerbeam.proxy.rlwy.net:53943`, base `railway` |
| Host interno | `postgres.railway.internal:5432` |
| Rol | `postgres` — `SUPERUSER`, `BYPASSRLS`, owner de las 216 tablas |

---

## 1. Prerrequisitos (antes de abrir la ventana)

- [ ] **1.1** Autorización explícita registrada (quién autoriza, cuándo).
- [ ] **1.2** Ventana acordada en horario de **baja actividad escolar**. Evitar: horas de
      clase, periodos de cierre de notas, días de entrega de boletines.
- [ ] **1.3** **Backup fresco bajo demanda.** El backup programado corre los días 1 y 15;
      el RPO puede ser de hasta 15 días. Lanzar manualmente el workflow:
      `Actions → Database Backup to R2 → Run workflow` y confirmar que termina en verde.
- [ ] **1.4** Verificar que no hay despliegue en curso en el servicio `api`.
- [ ] **1.5** Tener a mano acceso a: panel de Railway, secretos de GitHub Actions, y un
      usuario real de prueba para el login post-rotación.
- [ ] **1.6** Anunciar la ventana a los usuarios si dura más de unos minutos.

---

## 2. Procedimiento

### Paso 1 · Generar la nueva credencial

- [ ] **2.1** En Railway → environment `production` → servicio **`Postgres`** → pestaña
      *Variables* → rotar la contraseña del rol `postgres`.
      - Railway propaga el cambio a `PGPASSWORD`, `POSTGRES_PASSWORD`, `DATABASE_URL` y
        `DATABASE_PUBLIC_URL` **del propio servicio `Postgres`**.
      - ⚠️ **No propaga** al servicio `api`, que tiene su propia copia literal de
        `DATABASE_URL`. Ese es el paso 2.
- [ ] **2.2** **No** copiar la contraseña a ningún fichero, chat, nota ni historial de
      terminal. Manejarla solo mediante copiar/pegar entre paneles.

> **Punto de no retorno:** a partir de aquí, la credencial anterior deja de funcionar y la
> API de producción empieza a fallar hasta completar el paso 2.

### Paso 2 · Actualizar los consumidores

- [ ] **2.3** Railway → servicio **`api`** → variable `DATABASE_URL` → sustituir por la nueva.
      - Formato: `postgresql://postgres:POSTGRES_PASSWORD_PLACEHOLDER@postgres.railway.internal:5432/railway`
      - Usar el host **interno** (`postgres.railway.internal`), no el proxy público.
      - Guardar. Railway redesplegará el servicio `api`.
- [ ] **2.4** GitHub → repositorio → *Settings → Secrets and variables → Actions* → secreto
      **`DATABASE_PUBLIC_URL`** → actualizar.
      - Formato: `postgresql://postgres:POSTGRES_PASSWORD_PLACEHOLDER@centerbeam.proxy.rlwy.net:53943/railway`
      - Aquí sí es el host **público**: GitHub Actions se conecta desde fuera de Railway.
- [ ] **2.5** Revisar si algún colaborador tiene la credencial en un `.env` local o en el
      historial de su terminal, y pedir su purga.

### Paso 3 · Limpiar el árbol de trabajo

Estos dos cambios evitan reintroducir la credencial nueva por el mismo camino.

- [ ] **2.6** `scripts/fix-recovery-grades.ts` línea 17 — sustituir el literal:

```ts
// ANTES (línea 14-20 aprox.)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:<LITERAL>@centerbeam.proxy.rlwy.net:53943/railway'
    }
  }
});

// DESPUÉS
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL no está definida. Ejecuta el script con la variable de entorno:\n' +
    '  DATABASE_URL="postgresql://..." npx ts-node scripts/fix-recovery-grades.ts',
  );
}
const prisma = new PrismaClient();   // Prisma lee DATABASE_URL del entorno
```

- [ ] **2.7** `docs/RBAC_OBSERVATION_SPRINT.md` líneas 38 y 149 — sustituir la cadena
      completa por un marcador:

```
# ANTES
$env:DATABASE_URL="postgresql://postgres:<LITERAL>@centerbeam.proxy.rlwy.net:53943/railway"

# DESPUÉS
$env:DATABASE_URL="<pedir la cadena de conexión al responsable de infraestructura>"
```

- [ ] **2.8** Commit en rama propia (**no** en `main` directamente, hay trabajo concurrente):
      `fix(seguridad): las credenciales de producción salen del repositorio`

---

## 3. Verificación post-rotación

Ninguna de estas comprobaciones escribe en la base de datos.

- [ ] **3.1 · Arranque de la API.** Railway → servicio `api` → *Deployments* → el último
      despliegue en verde, sin errores `P1000` (auth failed) ni `P1001` (unreachable) en los
      logs.
- [ ] **3.2 · Migraciones.** En los logs de arranque debe aparecer
      `prisma migrate deploy` sin migraciones pendientes ni errores.
      *(Estado esperado: 89 aplicadas, 0 sin terminar.)*
- [ ] **3.3 · Login real.** Iniciar sesión con un usuario de prueba en producción y navegar a
      una pantalla que consulte datos (p. ej. listado de estudiantes).
- [ ] **3.4 · Backup.** Lanzar manualmente `Database Backup to R2` (`workflow_dispatch`) y
      confirmar que termina en verde y sube el fichero. **Este paso valida el secreto de
      GitHub Actions**; si se omite, el fallo no se detectaría hasta el día 1 o 15.
- [ ] **3.5 · Credencial antigua inutilizada.** Confirmación del responsable de que un intento
      de conexión con la anterior es rechazado.
      ⚠️ **Esta auditoría no realiza esa comprobación**: exigiría usar la credencial expuesta.
- [ ] **3.6 · Barrido del árbol.** Sin resultados con credenciales:

```bash
grep -rn "rlwy.net" --include=*.ts --include=*.md --include=*.yml apps scripts docs .github
```

- [ ] **3.7 · Auditoría de uso.** Revisar en Railway las conexiones recientes a la base de
      producción buscando orígenes no reconocidos.
      *Limitación conocida:* sin `log_connections` activo, la evidencia histórica puede no
      existir. **No se puede reconstruir retroactivamente quién usó la credencial.**

---

## 4. Rollback

| Situación | Acción |
|---|---|
| La API no arranca tras el paso 2.3 | Revisar la cadena: usuario `postgres`, host **interno**, base `railway`. Corregir la variable y redesplegar |
| El backup falla en 3.4 | Revisar el secreto de GitHub: debe usar el host **público** |
| Fallo generalizado | **No se puede volver a la contraseña anterior.** El rollback consiste en corregir las variables, no en restaurar la credencial |

> Por eso el paso 1.3 (backup fresco) es obligatorio: es la única red de seguridad real,
> dado que **no hay PITR** (`archive_mode = off` en producción).

---

## 5. Qué NO hace este runbook

- **No reescribe el historial de Git.** Tras la rotación, la credencial del historial queda
  inerte. `git filter-repo` afectaría a más de 30 ramas activas con trabajo concurrente; el
  beneficio marginal no lo justifica. Decisión documentada en `RLS-AUDIT-FASE0.3.md` §9.
- **No rota los secretos compartidos** (`JWT_SECRET`, R2). Eso es
  `runbook-separacion-secretos.md`.
- **No toca staging.** La base de staging tiene credenciales propias y distintas.

---

## 6. Criterios de cierre

- [ ] **C1** · Credencial rotada; la anterior ya no autentica.
- [ ] **C2** · Barrido de `rlwy.net` sobre el árbol de trabajo sin credenciales.
- [ ] Backup manual posterior a la rotación, correcto.
- [ ] Login real de producción, correcto.
