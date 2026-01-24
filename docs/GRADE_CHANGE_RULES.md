# Sistema de Cambio de Grado - Reglas y Validaciones

## 📋 Resumen del Sistema

Se ha implementado un sistema robusto para manejar cambios de grado con validaciones estrictas que protegen la integridad académica y aseguran el cumplimiento normativo.

## 🎯 Tipos de Cambio de Grado

### 1. **SAME_GRADE** - Cambio de Grupo (Mismo Grado)
- **Permitido:** ✅ Siempre
- **Requisitos:** Cupo disponible
- **Restricciones:** Ninguna
- **Acta:** No requerida

### 2. **PROMOTION** - Promoción Anticipada
- **Permitido:** ✅ Con validaciones
- **Requisitos:**
  - Evaluación psicoacadémica
  - Autorización del consejo académico
  - Consentimiento de acudientes
  - Acta académica aprobada
- **Restricciones:**
  - No antes de mitad de año lectivo (excepto casos excepcionales)
  - Promedio académico mínimo 4.0
- **Acta:** Requerida

### 3. **DEMOTION** - Rebaja de Grado
- **Permitido:** ❌ Generalmente NO
- **Requisitos (casos excepcionales):**
  - Acta de consejo académico aprobada
  - Autorización del rector y coordinador
  - Consentimiento firmado de acudientes
  - Evaluación psicológica
- **Restricciones:**
  - Solo en casos excepcionales documentados
  - Requiere aprobación del Ministerio de Educación
- **Acta:** Requerida

## 🔄 Proceso de Validación

### Paso 1: Detección del Tipo de Cambio
El sistema analiza automáticamente:
- Grado actual vs grado destino
- Etapa educativa (Preescolar, Primaria, Secundaria, Media)
- Nivel numérico del grado

### Paso 2: Validación de Reglas
Según el tipo de cambio, se aplican las reglas correspondientes.

### Paso 3: Verificación de Requisitos
- Cupo disponible en el nuevo grupo
- Estado del año lectivo (permite modificaciones)
- Estado de la matrícula (debe estar ACTIVA)

### Paso 4: Autorizaciones
- Para promociones/demociones: se verifica acta académica
- La acta debe estar aprobada (`approvalDate` no nulo)

### Paso 5: Ejecución y Auditoría
- Se actualiza la matrícula
- Se crea evento de auditoría
- Se notifica a partes interesadas

## 📊 Transiciones Especiales entre Etapas

### Preescolar → Primaria
- **Requerimientos:** Certificado de desarrollo infantil
- **Restricciones:** Edad mínima 6 años cumplidos

### Secundaria → Media
- **Requerimientos:** Evaluación de vocación y aptitudes
- **Restricciones:** Aprobación de grado 9°

## 🛡️ Medidas de Seguridad

### 1. **Validación Frontend**
- El sistema valida antes de enviar al backend
- Muestra advertencias y requerimientos
- Bloquea cambios no permitidos

### 2. **Validación Backend**
- Doble verificación de todas las reglas
- Verificación de actas académicas
- Control de cupos y disponibilidad

### 3. **Auditoría Completa**
- Registro de todos los cambios
- Tracking de valores anteriores y nuevos
- Referencia a actas académicas

## 📋 Flujo de Usuario

### Para Cambio de Grupo (Mismo Grado)
1. Seleccionar nuevo grupo
2. Motivo del cambio
3. ✅ Cambio inmediato

### Para Promoción Anticipada
1. Seleccionar grupo de grado superior
2. Sistema detecta promoción
3. Muestra requerimientos y advertencias
4. Confirmación del usuario
5. ✅ Cambio ejecutado

### Para Intento de Rebaja
1. Seleccionar grupo de grado inferior
2. Sistema detecta rebaja
3. ❌ Bloqueado con mensaje de restricciones
4. Requiere proceso especial con acta

## 🎨 Interfaz de Usuario

### Indicadores Visuales
- **🟢 Verde:** Cambio permitido
- **🟡 Amarillo:** Cambio con advertencias
- **🔴 Rojo:** Cambio no permitido

### Mensajes de Validación
- **Requerimientos:** Lista de documentos necesarios
- **Advertencias:** Consideraciones importantes
- **Restricciones:** Motivos de bloqueo

## 📚 Base Legal y Normativa

El sistema cumple con:
- **Decreto 1290 de 2009** - Evaluación y promoción
- **Resolución 2680 de 2014** - Cambios de grado
- **Lineamientos MEN** - Edades mínimas y transiciones

## 🔧 Configuración

### Parámetros Ajustables
- Promedio mínimo para promoción: 4.0
- Progreso mínimo del año para promoción: 50%
- Cupos máximos por grupo

### Personalización
- Los requerimientos pueden ajustarse por institución
- Las reglas pueden personalizarse según políticas internas

## 📈 Reportes y Estadísticas

### Auditoría de Cambios
- Todos los cambios quedan registrados
- Reportes por tipo de cambio
- Estadísticas de promociones vs demociones

### Métricas
- Tasa de promociones anticipadas
- Casos especiales documentados
- Tiempo promedio de procesamiento

---

## 🚀 Implementación Técnica

### Endpoints
- `POST /grade-change/validate` - Validar cambio
- `POST /grade-change/execute` - Ejecutar cambio
- `GET /grade-change/rules` - Obtener reglas

### Servicios
- `GradeChangeService` - Lógica de validación
- `GradeChangeController` - Endpoints HTTP
- DTOs específicos para validación

### Frontend
- Validación en tiempo real
- Indicadores visuales
- Confirmaciones contextuales
