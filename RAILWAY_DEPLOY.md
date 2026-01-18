# 🚀 Guía de Despliegue en Railway

## Requisitos Previos
- Cuenta en [Railway](https://railway.app)
- Repositorio Git (GitHub, GitLab, etc.)

---

## 📦 Paso 1: Crear Proyecto en Railway

1. Inicia sesión en Railway
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Conecta tu repositorio de Edusyn

---

## 🗄️ Paso 2: Configurar PostgreSQL

1. En tu proyecto Railway, click en **"+ New"**
2. Selecciona **"Database" → "Add PostgreSQL"**
3. Railway creará automáticamente la base de datos
4. Copia la variable `DATABASE_URL` que Railway genera

---

## ⚙️ Paso 3: Configurar Backend (NestJS)

### 3.1 Crear servicio para el backend
1. Click en **"+ New" → "GitHub Repo"**
2. Selecciona el repositorio
3. En **Settings → General**, configura:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npx prisma db seed && npm run start:prod`

### 3.2 Variables de Entorno del Backend
En **Settings → Variables**, agrega:

```
DATABASE_URL=postgresql://... (la que copiaste de PostgreSQL)
JWT_SECRET=tu-secreto-super-seguro-minimo-32-caracteres
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=3000
```

### 3.3 Generar dominio público
1. Ve a **Settings → Networking**
2. Click en **"Generate Domain"**
3. Copia la URL (ej: `edusyn-api.railway.app`)

---

## 🌐 Paso 4: Configurar Frontend (Vite/React)

### 4.1 Crear servicio para el frontend
1. Click en **"+ New" → "GitHub Repo"**
2. Selecciona el mismo repositorio
3. En **Settings → General**, configura:
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview -- --host 0.0.0.0 --port $PORT`

### 4.2 Variables de Entorno del Frontend
En **Settings → Variables**, agrega:

```
VITE_API_URL=https://tu-backend.railway.app/api
```

(Reemplaza `tu-backend.railway.app` con el dominio que generaste para el backend)

### 4.3 Generar dominio público
1. Ve a **Settings → Networking**
2. Click en **"Generate Domain"**
3. Esta será la URL de tu aplicación

---

## 🌱 Paso 5: Ejecutar Seed (Primera vez)

El seed se ejecuta automáticamente con el start command del backend.
Si necesitas ejecutarlo manualmente:

1. Ve al servicio del backend en Railway
2. Click en **"Settings" → "Deploy"**
3. En **"Custom Start Command"**, temporalmente usa:
   ```
   npx prisma migrate deploy && npx prisma db seed
   ```
4. Redeploy
5. Luego vuelve al comando original

---

## 👤 Usuarios de Prueba

Después del seed, tendrás estos usuarios disponibles:

| Rol | Email | Contraseña |
|-----|-------|------------|
| **Admin** | admin@villasanpablo.edu.co | Demo2026! |
| **Coordinador** | coordinador@villasanpablo.edu.co | Demo2026! |
| **Docente** | docente@villasanpablo.edu.co | Demo2026! |

---

## ✅ Verificación

1. Abre la URL del frontend
2. Inicia sesión con el usuario admin
3. Ve a **Docentes** → Importar desde Excel
4. Ve a **Estudiantes** → Importar desde Excel
5. Asigna docentes a asignaturas
6. El docente puede ingresar notas
7. El coordinador puede ver reportes

---

## 🔧 Troubleshooting

### Error de conexión a la base de datos
- Verifica que `DATABASE_URL` esté correctamente configurada
- Asegúrate de que el servicio PostgreSQL esté corriendo

### Error 401 Unauthorized
- Verifica que `JWT_SECRET` esté configurado
- Limpia localStorage del navegador y vuelve a iniciar sesión

### Frontend no conecta con backend
- Verifica que `VITE_API_URL` apunte al dominio correcto del backend
- Asegúrate de incluir `/api` al final de la URL

### Seed no se ejecuta
- Ejecuta manualmente desde la consola de Railway:
  ```bash
  npx prisma db seed
  ```

---

## 📊 Estructura del Proyecto

```
Edusyn/
├── apps/
│   ├── api/          ← Backend NestJS (servicio 1)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   └── web/          ← Frontend React (servicio 2)
│       └── src/
└── packages/         ← Código compartido
```

---

## 🎯 Flujo de Pruebas Recomendado

1. **Admin**: Configurar institución, crear áreas y asignaturas
2. **Admin**: Importar docentes desde Excel
3. **Admin**: Importar estudiantes desde Excel
4. **Admin**: Asignar docentes a grupos/asignaturas
5. **Docente**: Iniciar sesión y ver sus asignaciones
6. **Docente**: Registrar notas y logros de estudiantes
7. **Coordinador**: Ver reportes y estadísticas
8. **Coordinador**: Generar boletines

---

¡Listo! Tu sistema Edusyn está desplegado en Railway. 🎉
