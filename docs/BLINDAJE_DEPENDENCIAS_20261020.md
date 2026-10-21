# Blindaje de dependencias — 2026-10-20

## Alcance

Continuación posterior a la reconciliación de main/staging. Base main `5400ef32`; base staging `e6d3e4e2`. Se reutilizan los worktrees aislados `blindaje-produccion` y `sincronizar-staging`. El directorio principal conserva el trabajo previo sin confirmar.

Se traslada a main el parche de dependencias `68fca171`, ya integrado en staging. Aplicó completo sin conflictos. No se copió staging completo ni se cambiaron esquema, migraciones o datos académicos. Se conservan los pendientes de aislamiento, notas, reportes y RLS.

## Cambios

- Lockfile con versiones corregidas dentro de las líneas compatibles: entre otras, Nest 11.2.7, jsPDF 4.2.1, React Router 7.18.4, Vite 7.3.7, Multer 2.4.0 y proxy-addr 2.0.8.
- XLSX pasa de 0.18.5 a la distribución vendorizada 0.20.3 que ya usaba staging. SHA-256 del archivo en ambas ramas: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.
- BrowserRouter usa `useTransitions={false}`, nombre vigente en la versión actualizada, preservando la política de navegación inmediata del proyecto.
- Se fija Node 22 en `.nvmrc` de raíz, API y web. El build remoto anterior usó Node 18 pese a los requisitos de Vite. La raíz es relevante porque Railway construye el monorepo desde allí; no bastaba el archivo interno de web.
- El build web sustituye `npm install` por `npm ci --no-audit --no-fund` seguido de `npm --workspace apps/web run build`. Así instala el lockfile verificado y no recalcula versiones en cada publicación. La configuración de Node y el build reproducible se aplican también a staging.

No se ejecuta `npm audit fix --force`, no se rebajan versiones para silenciar avisos y no se retiran pruebas fallidas.

## Auditoría comparable

Medición con `npm audit --json --package-lock-only --omit=dev --ignore-scripts`, mismo día y criterio. Los números son paquetes señalados por npm y pueden incluir cadenas transitivas. Se auditan los lockfiles de las ramas, no un inventario extraído de contenedores activos. El total de 35 mostrado en un build previo y la auditoría completa con desarrollo tienen ámbitos/resoluciones distintos y no se presentan como una tendencia comparable.

| Lockfile de ejecución | Bajos | Moderados | Altos | Críticos | Total |
|---|---:|---:|---:|---:|---:|
| main antes | 3 | 11 | 19 | 3 | 36 |
| candidato main después | 2 | 2 | 0 | 0 | 4 |
| staging existente | 2 | 2 | 0 | 0 | 4 |

La auditoría completa previa incluyendo desarrollo reportó 93 paquetes (5 bajos, 23 moderados, 61 altos y 4 críticos); no se usa ese total como si fuera exposición de ejecución. Un aviso tampoco demuestra por sí solo que el caso vulnerable sea alcanzable en Edusyn.

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
