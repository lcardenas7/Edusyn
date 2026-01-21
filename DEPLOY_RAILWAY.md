# 🚀 Deploy en Railway - Edusyn

## Requisitos Previos

1. Cuenta en [Railway](https://railway.app)
2. Repositorio en GitHub conectado
3. PostgreSQL provisionado en Railway

---

## 📦 Estructura del Proyecto

```
Edusyn/
├── apps/
│   ├── api/          # Backend NestJS
│   └── web/          # Frontend React
```

---

## 🔧 Configuración del Backend (API)

### Variables de Entorno en Railway

```env
DATABASE_URL=postgresql://user:pass@host:5432/railway
PORT=3000
NODE_ENV=production
JWT_ACCESS_SECRET=tu-secret-seguro-min-32-chars
JWT_REFRESH_SECRET=tu-secret-seguro-min-32-chars
FRONTEND_URL=https://tu-frontend.railway.app
```

### Comandos de Build/Start

Railway detectará automáticamente desde `railway.json`:
- **Build**: `npm run prisma:generate && npm run build`
- **Start**: `npx prisma migrate deploy && npm run start:prod`

---

## 🌐 Configuración del Frontend (Web)

### Variables de Entorno en Railway

```env
VITE_API_URL=https://tu-backend.railway.app/api
```

### Comandos de Build/Start

- **Build**: `npm install && npm run build`
- **Start**: `npx serve dist -s -l $PORT`

---

## 📋 Pasos para Deploy

### 1. Crear Proyecto en Railway

1. Ir a [Railway Dashboard](https://railway.app/dashboard)
2. Click en "New Project"
3. Seleccionar "Deploy from GitHub repo"
4. Conectar el repositorio de Edusyn

### 2. Provisionar PostgreSQL

1. En el proyecto, click en "New"
2. Seleccionar "Database" → "PostgreSQL"
3. Copiar la `DATABASE_URL` generada

### 3. Configurar Backend

1. Click en "New" → "GitHub Repo"
2. Seleccionar el repo y configurar:
   - **Root Directory**: `apps/api`
   - **Variables de entorno**: Agregar todas las listadas arriba
3. Deploy automático al hacer push

### 4. Configurar Frontend

1. Click en "New" → "GitHub Repo"
2. Seleccionar el repo y configurar:
   - **Root Directory**: `apps/web`
   - **Variables de entorno**: `VITE_API_URL`
3. Deploy automático al hacer push

---

## 🌱 Seed de Producción

Después del primer deploy, ejecutar el seed de producción:

```bash
# Conectarse a Railway CLI
railway login
railway link

# Ejecutar seed de producción
railway run npm run seed:production
```

Esto creará:
- ✅ Roles del sistema
- ✅ Catálogo de permisos
- ✅ Usuario SuperAdmin

### Credenciales SuperAdmin

```
Email:    superadmin@edusyn.co
Usuario:  superadmin
Password: EdusynAdmin2026!
```

💡 Puede ingresar con **email** O **usuario**.

⚠️ **IMPORTANTE**: Cambiar la contraseña después del primer login.

---

## 🔄 Reset Lógico (Para limpiar datos de prueba)

Cuando necesites limpiar los datos de prueba pero conservar la estructura:

```bash
railway run npm run reset:logical
```

### Se ELIMINA:
- 🗑️ Estudiantes
- 🗑️ Docentes
- 🗑️ Instituciones de prueba
- 🗑️ Grados / grupos
- 🗑️ Notas
- 🗑️ Asistencias
- 🗑️ Comunicaciones
- 🗑️ Observaciones

### Se CONSERVA:
- ✅ Migraciones
- ✅ Estructura de BD
- ✅ Roles del sistema
- ✅ Catálogo de permisos
- ✅ Usuario SuperAdmin
- ✅ Código

---

## 🔍 Verificar Deploy

### Backend Health Check

```bash
curl https://tu-backend.railway.app/api/health
```

### Frontend

Abrir en navegador: `https://tu-frontend.railway.app`

---

## 📝 Scripts Disponibles

### Backend (apps/api)

| Script | Descripción |
|--------|-------------|
| `npm run start:prod` | Iniciar en producción |
| `npm run prisma:migrate:deploy` | Aplicar migraciones |
| `npm run seed` | Seed de desarrollo (datos de prueba) |
| `npm run seed:production` | Seed de producción (solo base) |
| `npm run reset:logical` | Limpiar datos de prueba |

### Frontend (apps/web)

| Script | Descripción |
|--------|-------------|
| `npm run build` | Build de producción |
| `npm run preview` | Preview local del build |

---

## 🐛 Troubleshooting

### Error de conexión a BD

1. Verificar que `DATABASE_URL` esté correctamente configurada
2. Verificar que PostgreSQL esté corriendo en Railway

### Error de CORS

1. Verificar que `FRONTEND_URL` en el backend apunte al dominio correcto del frontend

### Error de migraciones

```bash
# Forzar reset de migraciones (⚠️ BORRA DATOS)
railway run npx prisma migrate reset --force
```

---

## 🔐 Seguridad

1. **JWT Secrets**: Usar strings aleatorios de al menos 32 caracteres
2. **Contraseñas**: Cambiar la contraseña del SuperAdmin inmediatamente
3. **HTTPS**: Railway provee HTTPS automáticamente
4. **Variables de entorno**: Nunca commitear secrets al repositorio

---

## 📞 Soporte

Para problemas con el deploy, revisar:
1. Logs en Railway Dashboard
2. Documentación de Railway: https://docs.railway.app
