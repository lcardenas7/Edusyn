# Blindaje de dependencias — 2026-10-20

## Alcance

Continuación posterior a la reconciliación de main/staging. Base main `5400ef32`; base staging `e6d3e4e2`. Se reutilizan los worktrees aislados `blindaje-produccion` y `sincronizar-staging`. El directorio principal conserva el trabajo previo sin confirmar.

Se traslada a main el parche de dependencias `68fca171`, ya integrado en staging. Aplicó completo sin conflictos. No se copió staging completo ni se cambiaron esquema, migraciones o datos académicos. Se conservan los pendientes de aislamiento, notas, reportes y RLS.

## Cambios

- Lockfile con versiones corregidas dentro de las líneas compatibles: entre otras, Nest 11.2.7, jsPDF 4.2.1, React Router 7.18.4, Vite 7.3.7, Multer 2.4.0 y proxy-addr 2.0.8.
- XLSX pasa de 0.18.5 a la distribución vendorizada 0.20.3 que ya usaba staging. SHA-256 del archivo en ambas ramas: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.
- BrowserRouter usa `useTransitions={false}`, nombre vigente en la versión actualizada, preservando la política de navegación inmediata del proyecto.
- Se fija Node 22 en `.nvmrc` de raíz, API y web. El build remoto anterior usó Node 18 pese a los requisitos de Vite. La raíz es relevante porque Railway construye el monorepo desde allí; no bastaba el archivo interno de web.
- El build web ejecuta `npm --workspace apps/web run build` sin volver a instalar paquetes. Nixpacks ya ejecuta `npm ci` en su fase de instalación (comprobado en los logs), por lo que se usa el lockfile y no se recalculan versiones con `npm install` durante el build. La configuración de Node y el build reproducible se aplican también a staging.

No se ejecuta `npm audit fix --force`, no se rebajan versiones para silenciar avisos y no se retiran pruebas fallidas.

## Auditoría comparable

Medición con `npm audit --json --package-lock-only --omit=dev --ignore-scripts`, mismo día y criterio. Los números son paquetes señalados por npm y pueden incluir cadenas transitivas. Se auditan los lockfiles de las ramas, no un inventario extraído de contenedores activos. El total de 35 mostrado en un build previo y la auditoría completa con desarrollo tienen ámbitos/resoluciones distintos y no se presentan como una tendencia comparable.

| Lockfile de ejecución | Bajos | Moderados | Altos | Críticos | Total |
|---|---:|---:|---:|---:|---:|
| main antes | 3 | 11 | 19 | 3 | 36 |
| candidato main después | 2 | 2 | 0 | 0 | 4 |
| staging existente | 2 | 2 | 0 | 0 | 4 |

La auditoría completa previa incluyendo desarrollo reportó 93 paquetes (5 bajos, 23 moderados, 61 altos y 4 críticos); no se usa ese total como si fuera exposición de ejecución. Un aviso tampoco demuestra por sí solo que el caso vulnerable sea alcanzable en Edusyn.

La medición completa posterior queda en 37 paquetes: 2 bajos, 29 moderados, 6 altos y cero críticos. Los seis altos están en la cadena de desarrollo de Tailwind (braces, chokidar, fast-glob, micromatch, picomatch y tailwindcss). La revisión de herramientas de desarrollo sigue abierta; el resultado sin altos/críticos se limita a `--omit=dev`.

Pendientes de ejecución: ExcelJS/uuid (moderados) y react-quill-new/Quill (bajos). npm propone cambios de versión mayor o retrocesos para estas cadenas; requieren revisión de uso, compatibilidad y pruebas propias. No se atribuye cierre global de seguridad ni cero avisos.

Fuentes primarias consultadas: [aviso jsPDF](https://github.com/parallax/jsPDF/security/advisories/GHSA-7x6v-j9x4-qf24), [aviso proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), [selección de Node en Nixpacks](https://nixpacks.com/docs/providers/node).

## Verificación local

- Instalación limpia del lockfile: `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline`, 1.303 paquetes instalados. No se ejecutan scripts de instalación; Prisma se genera explícitamente después, sin conexión a bases ni migración.
- Tipos API y web aprobados; builds Nest y Vite aprobados sobre las dependencias locales actualizadas y Node 22.17.0. El build web válido se ejecutó desde `apps/web`, con su configuración Tailwind.
- API completa: **76 suites aprobadas y una fallida; 1.443 pruebas aprobadas y diez fallidas**. Los diez fallos siguen limitados a bancos de preguntas de 7.º/8.º y grados inferiores. Sus fuentes y tests no cambian en este lote.
- Web completa: **34 archivos aprobados y uno fallido; 499 pruebas aprobadas y una fallida**. El fallo previo es la regla de diseño de Arena por `text-slate-300`/`text-slate-200`; tanto Arena como su test están sin cambios respecto de main. No se declara la suite global verde. La primera ejecución web no llegó a correr tests por EPERM en temporales del sandbox; la repetición autorizada sí ejecutó los 500 casos.
- Prueba funcional de las librerías reales: crear/escribir/leer XLSX conserva documento con cero inicial, nombre con acentos y nota decimal; jsPDF y AutoTable generan tabla y dos páginas de PDF válidas. Solo datos sintéticos, sin usar registros de estudiantes.
- No se modifica código de API ni esquema. El único cambio de aplicación fuera de dependencias es la propiedad de BrowserRouter exigida por la versión actualizada.

## Orden de continuidad

1. Verificar el runtime y build reproducible de staging.
2. Publicar el candidato de dependencias de main y comprobar sus servicios y salud pública.
3. Registrar hashes, estados y límites en la bitácora; diferenciar envío y despliegue confirmado.
4. Siguiente lote: bancos de preguntas y sus diez fallos previos; después aislamiento HTTP de rutas nuevas y promoción selectiva del blindaje restante. No hace falta igualar todas las ramas para avanzar.

Los avisos residuales de bibliotecas y la deuda visual de Arena quedan identificados; no se mezclan con notas, RLS ni los cambios locales de CREA.

### Verificación posterior y candidato final

El autodeploy volvió a cargar correctamente Nixpacks y los archivos de configuración en `1be3786d`: API `f52d75a0` y web `8c20dc27` terminaron en SUCCESS. Esto acredita recuperación en ese intento, sin atribuir una causa no demostrada a los fallos anteriores.

Se encontró `NIXPACKS_NODE_VERSION=20` en ambas API, con prioridad sobre `.nvmrc`. Se cambió a 22 únicamente en staging antes de probar: API `6af38325` SUCCESS; su log confirma `nodejs_22` y Node 22.14.0. La versión del repositorio por sí sola no acreditaba la versión efectiva. Web no tiene ese override. Staging API health y web aula respondieron HTTP 200 después de estas comprobaciones.

El candidato final de producción conserva commits separados para dependencias y bancos, con la corrección del build antes de publicar. La reconciliación de bancos resuelve los diez fallos API previos: **77 suites y 1.453 pruebas aprobadas**, además de tipos API/web y build Nest. Véase `RECONCILIACION_BANCOS_20261020.md`. Se mantiene explícitamente el fallo visual previo de Arena y los avisos residuales de dependencias. No se añaden migraciones.

## Incidencias detectadas al verificar staging

Los autodeploys `a0c890f0` (API) y `8a9aa792` (web), y el reintento de API `acaff7c5`, dejaron metadatos sin configFile y con Railpack sin comandos; el único log visible fue el arranque del builder. No se atribuye ese fallo a una compilación que no consta en los logs. La configuración del entorno conserva las rutas de archivos, y los intentos de edición por CLI respondieron «No changes to apply». El mecanismo de autodeploy queda pendiente de diagnóstico; la página general de Railway no mostraba incidencia abierta.

Las subidas directas del mismo worktree recuperaron `/apps/api/railway.json` y `/apps/web/railway.json` con Nixpacks. API `3847c8a1` terminó en SUCCESS. El primer web directo `69eee579` llegó a ejecutar los comandos y falló por `EBUSY`: la segunda ejecución de `npm ci` intentaba borrar `/app/node_modules/.cache`, montado por Nixpacks. Ese segundo `npm ci` lo introducía este lote y se retira. Se conserva el `npm ci` inicial de Nixpacks y el build ejecuta solo el workspace web; verificar el siguiente despliegue antes de declarar publicado el lote.

## Resultado terminal de publicación

Producción `db4b2b07`: API `3cf2cadc-dd66-4c83-8e7f-c60f1aa694e2` y web `1596d22e-2bf3-44c3-a227-4a2c0ed58163` **SUCCESS**, ambos con ese `meta.commitHash`. Sus logs de build confirman Node 22.14.0. Se cambió el override API de producción de 20 a 22 después de validarlo en staging; no se modificaron otras variables. La API informó «No pending migrations to apply».

La consulta pública posterior confirmó `/api/health` HTTP 200 y `status: ok`; `/aula` HTTP 200 sirve `/assets/index-C2vWFJ0k.js`, coincidente con el build nuevo. El web adicional de staging `3bf1caa2` también terminó en SUCCESS. No se inició sesión ni se modificaron datos académicos reales para comprobarlo.

Tipos API/web revalidados sobre el candidato final; build Nest y build web con el comando final aprobados. La suite API queda verde con la reconciliación de bancos incluida. El siguiente lote de código corresponde al aislamiento HTTP de Duelos/bancos/Eventos; avisos residuales, fallo visual de Arena y tamaño del bundle siguen abiertos. La publicación de este lote no acredita blindaje global ni promueve las siete migraciones exclusivas de staging.
