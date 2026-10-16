---
name: sysaas-backend-architecture
description: >-
  Guía maestra y estándar oficial de arquitectura backend para SySaaS (Node.js, Express, MySQL multi-tenant).
  Cubre:
  1) Aislamiento estricto de tenants (tenant_id) y sucursales (branch_id).
  2) Manejo canónico de fechas, zonas horarias y CONVERT_TZ sin desfasajes UTC.
  3) Control transaccional ACID en checkout POS, inventario y reparaciones.
  4) Pipeline de middlewares: auth, tenantContext, subscriptionGuard y planLimit.
  5) Seguridad de webhooks externos (Stripe rawBody) y rate limiting.
  6) Integración con Gemini AI (fallback de modelos, prompt estructurado, JSON Mode).
  7) Notificaciones asíncronas multi-canal (Email Nodemailer + WhatsApp Cloud API).
  8) Esquema canónico de respuestas JSON, paginación, logging de auditoría y tests.
---

# SySaaS Backend Engineering & Architecture Master Guide

Esta especificación es el estándar canónico de desarrollo, diseño de endpoints, seguridad y manipulación de datos en el backend de SySaaS. Todo nuevo controlador, ruta, servicio o migración debe ceñirse con máxima rigurosidad a estas directrices.

---

## 1. Principios de Multi-Tenancy y Aislamiento de Datos

SySaaS opera bajo una arquitectura **multi-tenant con base de datos relacional compartida** y aislamiento lógico por `tenant_id`:

### 1.1 Inyección Obligatoria de Tenant
- **Regla de Oro**: Ninguna consulta SQL sobre tablas de negocio (`repairs`, `customers`, `inventory`, `inventory_categories`, `sales`, `sale_items`, `cash_registers`, `coupons`, `orders`, `branches`) puede prescindir de la cláusula `WHERE tenant_id = ?`.
- El `tenant_id` **debe extraerse siempre** de `req.tenantCtx.tenantId` (inyectado por el middleware `tenantContext`).
- **Prohibición**: Jamás tomar `tenant_id` de `req.body`, `req.query` o `req.params`, excepto en el caso único de `superadmin` actuando sobre un inquilino explícito mediante `req.headers['x-tenant-id']`.

### 1.2 Contexto y Filtrado por Sucursal (`branch_id`)
- **Usuarios de sucursal** (`technician`, `cashier`, `salesperson`, `branch_manager`): Su contexto operativo está limitado a su `branch_id`.
- **Administradores** (`tenant_admin`, `admin`, `superadmin`): Tienen visibilidad global de la empresa, pero pueden filtrar por sucursal específica vía encabezado `x-branch-id` o query param `branch_id`.
- En creaciones de registros dependientes de sucursal:
  ```javascript
  const tenantId = req.tenantCtx.tenantId;
  let branchId = req.body.branch_id || req.tenantCtx.branchId;
  if (!branchId) {
      const [mainBranch] = await db.query(
          'SELECT id FROM branches WHERE tenant_id = ? AND is_main = TRUE LIMIT 1',
          [tenantId]
      );
      branchId = mainBranch.length > 0 ? mainBranch[0].id : null;
  }
  ```

---

## 2. Pipeline Canónico de Middlewares y Roles

El orden de montaje en los enrutadores es estrictamente secuencial:

```text
Request 
  └── rateLimiter (limiter por IP/Ruta)
  └── auth (Valida JWT, busca usuario activo en DB e inyecta req.user)
  └── tenantContext (Resuelve tenant_id, branch_id, datos de suscripción e inyecta req.tenantCtx)
  └── subscriptionGuard (Verifica estado: active, trial, past_due, canceled)
  └── planLimit / Rol Guard (Valida cuota mensual o permisos de rol)
  └── Controller Handler
```

### Matriz de Roles Oficiales
- `superadmin`: Operador global de la plataforma SaaS (omite guardias de suscripción).
- `tenant_admin` / `admin`: Dueño o administrador general de la empresa/taller.
- `branch_manager`: Administrador encargado de una sucursal específica.
- `technician`: Técnico de taller (gestión de reparaciones, estados, diagnósticos y refacciones).
- `cashier` / `salesperson`: Punto de venta, cobros, inventario y cotizaciones.
- `client`: Usuario final (portal de autoservicio, consulta de órdenes y aprobación de presupuestos).

### Guardias de Suscripción (`subscriptionGuard`)
- `active`: Acceso ilimitado a todos los verbos HTTP.
- `trial`: Acceso permitido hasta `trial_ends_at`. Al vencer, retorna código `403` con `{ code: 'TRIAL_EXPIRED' }`.
- `past_due`: Solo se permiten peticiones de lectura (`GET`). Cualquier mutación (`POST`, `PUT`, `DELETE`) retorna `403` con `{ code: 'PAYMENT_PAST_DUE' }`.
- `canceled` o `suspended`: Acceso completamente bloqueado (`403`).

### Límites de Plan (`planLimit`)
- Para operaciones sujetas a cuotas de uso (ej. `monthly_repairs`, `max_branches`, `max_users`):
  ```javascript
  router.post('/', planLimit('monthly_repairs'), repairController.create);
  ```

---

## 3. Manejo Canónico de Fechas, Horas y Zonas Horarias

Para erradicar definitivamente cualquier desfase horario entre navegadores clientes y la base de datos MySQL:

### 3.1 Configuración de Conexión MySQL (`backend/config/database.js`)
- **`dateStrings: true` es mandatorio** en la configuración del pool de `mysql2`.
- Evita que el driver convierta automáticamente campos `DATETIME` a objetos `Date` nativos de Node.js que fuerzan conversiones UTC no deseadas al responder con `res.json()`.

### 3.2 Normalización de Entradas (`normalizeDateTime`)
- Cualquier valor proveniente de un input HTML5 (`<input type="datetime-local">`, que emite `YYYY-MM-DDTHH:mm`) debe ser sanitizado antes de guardarse:
  ```javascript
  const normalizeDateTime = (val) => {
      if (!val) return null;
      if (typeof val === 'string') {
          const match = val.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
          if (match) {
              const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
              return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
          }
      }
      return val;
  };
  ```

### 3.3 Agrupación y Estadísticas por Día en MySQL
- Para métricas de ventas y cortes de caja que dependen del huso horario del tenant:
  - Leer el encabezado `x-timezone` o `req.tenantCtx.tenant.timezone` (ej. `'America/Mexico_City'`).
  - Obtener el offset horario (ej. `'-06:00'`).
  - Usar `CONVERT_TZ(created_at, '+00:00', ?)` en consultas SQL agregadas para agrupar por el día real de la sucursal y no el día UTC del servidor.

---

## 4. Transacciones ACID y Consistencia de Datos

Toda operación que involucre dos o más tablas dependientes (ej. checkout de venta en POS, ingreso de garantías, traspasos de stock entre sucursales o cambios de refacciones) **debe ejecutarse bajo una transacción explícita**:

```javascript
const connection = await db.getConnection();
try {
    await connection.beginTransaction();

    // 1. Operación principal (usando connection, NO el pool global db)
    const [result] = await connection.query(
        'INSERT INTO sales (...) VALUES (...)',
        [...]
    );
    const saleId = result.insertId;

    // 2. Operaciones secundarias (descuento de inventario, kardex, caja)
    for (const item of items) {
        await connection.query(
            'UPDATE inventory SET stock = stock - ? WHERE id = ? AND tenant_id = ?',
            [item.quantity, item.product_id, tenantId]
        );
        await connection.query(
            'INSERT INTO stock_movements (tenant_id, product_id, type, quantity, reference_id) VALUES (?, ?, "sale", ?, ?)',
            [tenantId, item.product_id, item.quantity, saleId]
        );
    }

    // 3. Confirmar cambios
    await connection.commit();
    res.status(201).json({ success: true, id: saleId });
} catch (error) {
    // 4. Reversión ante cualquier fallo
    await connection.rollback();
    console.error('[MODULE_NAME] Error transaccional:', error);
    res.status(500).json({ message: 'Error al procesar la operación.', detail: error.message });
} finally {
    // 5. Liberar conexión al pool OBLIGATORIAMENTE
    connection.release();
}
```

---

## 5. Integración con Gemini AI (Servicio de Inteligencia Artificial)

Las llamadas al motor de IA (`aiService.js`) deben garantizar alta disponibilidad, velocidad y salida estructurada:

1. **Estrategia Multi-Modelo con Fallback Automático**:
   - Iterar sobre una lista de prioridad de modelos (ej. `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-flash-latest`, `gemini-3.5-flash`). Si uno satura cuota o falla por rate limit, saltar automáticamente al siguiente disponible.
2. **System Instruction Aislado**:
   - Proveer siempre el rol operativo del sistema vía `requestBody.systemInstruction` para que el modelo no se desvíe del contexto del taller/empresa.
3. **Modo JSON Estricto**:
   - Cuando el frontend o la lógica de negocio requiera datos computables (diagnósticos sugeridos, estimación de costos, análisis de fallas), fijar:
     `requestBody.generationConfig.responseMimeType = 'application/json'`.
4. **Almacenamiento de API Key**:
   - Buscar primero en la base de datos (`settings.setting_key = 'gemini_api_key'`) para permitir al tenant o administrador configurar su propia llave, con fallback a `process.env.GEMINI_API_KEY`.

---

## 6. Notificaciones Asíncronas Multi-Canal

Las notificaciones hacia clientes y técnicos deben ser asíncronas y resilientes:

1. **Email Transaccional (Nodemailer)**:
   - Plantillas HTML sobrias y de alto contraste (alineadas al diseño de SySaaS).
   - El envío se dispara en segundo plano (`.catch(err => console.error(...))`) para **jamás bloquear o demorar la respuesta HTTP del endpoint principal**.
2. **WhatsApp Cloud API**:
   - Integración mediante templates pre-aprobados o mensajes interactivos directos con URLs de seguimiento al ticket (`/rastrear?ticketId=...`).
   - Envío controlado con fallback elegante si el número carece de formato internacional E.164.

---

## 7. Pagos y Webhooks de Terceros (Stripe)

1. **Manejo del Body Crudo (`rawBody`)**:
   - Los webhooks de Stripe requieren validar la firma criptográfica (`stripe.webhooks.constructEvent`) sobre el buffer/string crudo antes de `express.json()`.
   - En `server.js` se captura `req.rawBody` específicamente para la ruta `/api/billing/webhook`.
2. **Idempotencia en Webhooks**:
   - Validar eventos recurrentes (ej. `invoice.payment_succeeded`, `customer.subscription.deleted`) evitando duplicar renovaciones de suscripción.

---

## 8. Estándar de Respuestas RESTful y Paginación

### 8.1 Paginación Canónica
Los endpoints de listado (`GET /api/repairs`, `/api/inventory/products`, `/api/customers`) deben implementar paginación uniforme:
```javascript
const page = Math.max(1, parseInt(req.query.page, 10) || 1);
const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
const offset = (page - 1) * limit;

// Retorno estructurado
res.json({
    data: rows,
    pagination: {
        page,
        limit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / limit)
    }
});
```

### 8.2 Convención de Códigos de Estado
- `200 OK`: Consultas y actualizaciones exitosas.
- `201 Created`: Recursos creados satisfactoriamente.
- `400 Bad Request`: Parámetros faltantes o formatos inválidos.
- `401 Unauthorized`: Token ausente, alterado o expirado.
- `403 Forbidden`: Permisos insuficientes (rol o plan de suscripción vencido).
- `404 Not Found`: Recurso inexistente o no perteneciente al `tenant_id`.
- `429 Too Many Requests`: Límite de tasa excedido.
- `500 Internal Server Error`: Fallos no controlados del servidor.

---

## 9. Lista de Verificación (Checklist) para Nuevos Endpoints

Antes de liberar cualquier endpoint en producción, verificar:
- [ ] ¿La consulta incluye `WHERE tenant_id = ?` extraído de `req.tenantCtx.tenantId`?
- [ ] ¿Si el usuario no es admin global, se restringe la acción al `branch_id` correspondiente?
- [ ] ¿Las fechas y horas pasan por `normalizeDateTime` antes de insertarse o actualizarse?
- [ ] ¿Si modifica inventario, caja o estados en cascada, se implementó transacción `BEGIN TRANSACTION` con `ROLLBACK` y `RELEASE`?
- [ ] ¿Los envíos de correo o WhatsApp se ejecutan en segundo plano sin ralentizar la respuesta HTTP?
- [ ] ¿Los mensajes de error son profesionales, claros y no contienen emojis?
