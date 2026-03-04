# RBAC Multi-tenant — Sprint de Observación

> **Deploy:** commit `b7df217` — 2026-03-03 21:13 COL
> **Backfill:** 93/93 registros creados, 0 errores
> **Duración:** 1 sprint completo (~2 semanas)
> **Regla:** NO intervenir. Solo observar.

---

## 1️⃣ Monitoreo de Logs

Revisar en Railway → Logs del API service. Buscar:

| Patrón | Significado | Acción |
|--------|------------|--------|
| `[TenantGuard] BLOCKED` | Cross-tenant bloqueado | Normal si aparece poco. Investigar si es masivo |
| `Unique constraint failed on.*InstitutionUserRole` | Duplicate insert | Revisar dual-write, el upsert debería prevenir esto |
| `P2002.*institutionUserId_roleId` | Unique violation en IUR | Mismo que arriba |
| `Transaction failed` / `P2034` | Transacción abortada | Investigar causa raíz |
| `UnauthorizedException` en login | Fallos de auth | Normal si son credenciales incorrectas |
| `No tienes acceso a esta institución` | TenantGuard o login rechazó | Verificar si es legítimo |
| `Token sin institución activa` | SSE/LiveSession sin tenant | Puede ser token viejo pre-migración |

### Comando rápido (Railway CLI):
```bash
# Ver logs en tiempo real
railway logs --tail
```

---

## 2️⃣ Métrica de Crecimiento

Ejecutar cada 3-5 días contra producción:

```powershell
# Desde la raíz del proyecto
$env:DATABASE_URL="postgresql://postgres:HAvTNeXPTjDApwRxwPYyqGrLuDMTLNsM@centerbeam.proxy.rlwy.net:53943/railway"
```

### Query de verificación:
```sql
-- Conteo comparativo
SELECT 
  (SELECT COUNT(*) FROM "UserRole") as user_role_count,
  (SELECT COUNT(*) FROM "InstitutionUserRole") as iur_count,
  (SELECT COUNT(*) FROM "InstitutionUser") as iu_count;

-- Diferencia: debe ser ≤ número de SUPERADMINs
SELECT COUNT(*) as superadmins_sin_institucion
FROM "UserRole" ur
WHERE NOT EXISTS (
  SELECT 1 FROM "InstitutionUser" iu WHERE iu."userId" = ur."userId"
);

-- Verificar sincronización (debe ser 0)
SELECT COUNT(*) as desincronizados
FROM "UserRole" ur
JOIN "InstitutionUser" iu ON iu."userId" = ur."userId"
LEFT JOIN "InstitutionUserRole" iur ON iur."institutionUserId" = iu.id AND iur."roleId" = ur."roleId"
WHERE iur.id IS NULL;
```

### Criterios:
| Métrica | Esperado |
|---------|----------|
| `user_role_count - iur_count` | = número de SUPERADMINs (hoy: 1) |
| `desincronizados` | **0** (si > 0, re-ejecutar backfill) |
| Crecimiento proporcional | Ambos crecen juntos con cada nuevo usuario |

---

## 3️⃣ Verificación Funcional Manual

### Checklist (marcar cuando se pruebe):

- [ ] **Login normal** — usuario con 1 institución → login directo, JWT tiene `institutionId`
- [ ] **Login multi-institución** — usuario con 2+ instituciones → `requiresInstitutionSelection: true`
- [ ] **switchInstitution** — POST `/auth/switch-institution` → nuevo JWT con nueva institución
- [ ] **Crear staff** — desde panel admin → UserRole + InstitutionUserRole creados
- [ ] **Bulk upload docentes** — Excel → ambas tablas escritas
- [ ] **Bulk upload staff** — Excel → ambas tablas escritas
- [ ] **SuperAdmin login** — sin institutionId → JWT con `isSuperAdmin: true`
- [ ] **SuperAdmin acceso cross-tenant** — query con `?institutionId=X` → funciona
- [ ] **TenantGuard bloqueo** — usuario normal intenta acceder a otra institución → 403
- [ ] **Live Session** — crear/unirse → tenant validado
- [ ] **Cambiar rol staff** — actualizar role → ambas tablas actualizadas

---

## 🚫 FASE 4 — Criterios de entrada

**NO iniciar hasta cumplir TODOS:**

1. ✅ 1 sprint completo (~2 semanas) sin intervención
2. ✅ 0 errores de sincronización en queries de verificación
3. ✅ 0 `desincronizados` en la query de arriba
4. ✅ Logs limpios (sin unique violations ni tx failures)
5. ✅ Verificación funcional completa (todos los checkboxes arriba)
6. ✅ Confirmación explícita del responsable

### Cuando se apruebe FASE 4:
1. Auditar todos los `prisma.userRole.findMany` en el codebase
2. Migrar lecturas restantes a `InstitutionUserRole`
3. Remover fallback en `signTokenForInstitution()`
4. Remover dual-write (solo escribir a IUR)
5. Marcar `UserRole` como `@deprecated` en schema
6. (Opcional) Dejar tabla vacía pero no eliminar por un sprint más

---

## Re-ejecutar backfill (si se necesita)

```powershell
$env:DATABASE_URL="postgresql://postgres:HAvTNeXPTjDApwRxwPYyqGrLuDMTLNsM@centerbeam.proxy.rlwy.net:53943/railway"

# Dry-run primero
npx tsx scripts/backfill-institution-user-roles.ts

# Aplicar
npx tsx scripts/backfill-institution-user-roles.ts --apply
```

El script es idempotente (usa upsert). Seguro de re-ejecutar en cualquier momento.
