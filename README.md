# SySaaS - Plataforma Integral SaaS Multi-Tenant & Multi-Sucursal para Gestion de Talleres y Soporte Tecnico

[![License: ISC](https://img.shields.io/badge/License-ISC-007ACC.svg)](https://opensource.org/licenses/ISC)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1.svg)](https://www.mysql.com/)
[![Stripe](https://img.shields.io/badge/Payments-Stripe-6772E5.svg)](https://stripe.com/)
[![AI-Powered](https://img.shields.io/badge/AI-Diagnostics-FF6B6B.svg)](https://gemini.google.com/)

**SySaaS** es una plataforma integral SaaS (Software as a Service) multi-tenant y multi-sucursal de ultima generacion, disenada para digitalizar, optimizar y automatizar el ciclo operativo completo de talleres, laboratorios de reparacion, tiendas de soporte tecnico y franquicias de dispositivos electronicos.

Ofrece aislamiento total de datos por empresa (multi-tenancy con identificador de slug), control de inventario descentralizado con traslados inter-sucursales, punto de venta (POS) en tiempo real con impresion de tickets termicos, diagnosticos inteligentes potenciados por Inteligencia Artificial (Gemini AI), motor de analisis predictivo en Python, portal de clientes con tracking publico en vivo, control de suscripciones y facturacion automatizada mediante Stripe.

---

## Modulos del Sistema y Funcionalidades

### 1. Panel de SuperAdministrador (Control Global de la Plataforma)
- **Gestion Global de Tenants:** Monitorizacion, alta, suspension y reactivacion instantanea de empresas cliente.
- **Impersonacion Segura de Soporte:** Capacidad para ingresar a la vista de cualquier tenant para asistir a los usuarios y resolver incidencias tecnicas.
- **Planes y Limites:** Configuracion dinamica de precios, cuotas de sucursales, limites de usuarios staff y tope mensual de reparaciones.
- **Auditoria Global y Logs:** Trazabilidad completa de actividades y exportacion de auditorias en formato CSV.
- **Sistema de Broadcasts:** Emision de avisos y notificaciones globales para todos los inquilinos activos.
- **Ajustes de Plataforma:** Personalizacion del nombre de marca, logotipo, terminos de servicio y configuracion SMTP.

### 2. Multi-Tenancy & Aislamiento de Datos
- **Aislamiento Multi-Tenant Estricto:** Cada empresa cuenta con su contexto (`sysaas.com/app/empresa-slug`), garantizando la privacidad absoluta de clientes, reparaciones y finanzas.
- **SubscriptionGuard:** Middleware de verificacion de cuotas y limites de uso en tiempo real.
- **Manejo de Roles Granular:** Permisos diferenciados para SuperAdmin, Admin de Empresa, Tecnicos, Cajeros y Clientes.

### 3. Gestion Operativa Multi-Sucursal e Inventario
- **Inventario Descentralizado:** Catalogo unificado por empresa con stock fisico controlado independientemente por sucursal (`branch_inventory`).
- **Filtros Avanzados de Stock:** Busqueda multi-criterio en tiempo real, alertas de bajo stock y deteccion de existencias agotadas con diseno sobrio de alto contraste.
- **Traslados de Mercancia:** Flujo seguro de transferencia entre sucursales (Solicitud en origen -> Estado en transito -> Aprobacion y recepcion en destino -> Movimiento de stock atomico).
- **Gestion de Proveedores y Compras:** Modulo de administracion de proveedores y costos de adquisicion.

### 4. Punto de Venta (POS) e Historial de Ventas
- **Cobro Rapido y Descuento en Vivo:** Terminal de venta ágil con soporte para multiples metodos de pago (Efectivo, Tarjeta, Transferencia, Mixto).
- **Historial Completo de Ventas:** Busqueda por folio de ticket o cliente, filtros por rango de fechas, exportacion a CSV y reimpresion de recibos termicos.
- **Gestion de Cupones:** Creacion y aplicacion de codigos de descuento por porcentaje o monto fijo.

### 5. Modulo de Reparaciones y Taller
- **Ciclo Completo del Ticket:** Recepcion -> Diagnostico -> Cotizacion -> En Espera de Piezas -> Reparando -> Pruebas -> Listo para Entrega -> Entregado.
- **Checklist Visual y Fotos:** Registro de condiciones de recepcion del equipo, danos previos, accesorios y fotografias con compresion automatica.
- **Generacion de Documentos PDF:** Emision automatica de recibos de recepcion, ordenes de servicio y certificados de garantia.

### 6. Inteligencia Artificial y Analisis Predictivo
- **Diagnostico Asistido por AI:** Analisis inteligente de sintomas mediante Gemini AI, sugiriendo causas probables, componentes a revisar y tiempos estimados.
- **Motor de Machine Learning & Analytics:** Script de Python integrado (`analytics_engine.py`) para proyecciones de demanda, deteccion de anomalias y tendencias operativas.
- **Chatbot Asistente:** Asistente interactivo en tiempo real integrado en el portal publico y privado para resolver dudas frecuentes y consultas de estado.

### 7. Portal y Experiencia del Cliente
- **Tracking Publico en Vivo:** Rastreo de estado de reparacion en tiempo real con codigo de seguimiento sin requerir inicio de sesion.
- **Aprobacion de Cotizaciones:** Aceptacion o rechazo digital de presupuestos de reparacion.
- **Gestion de Garantias:** Registro y atencion de garantias con validacion automatica de plazos de cobertura.
- **Tienda y Catalogo Publico:** Visualizacion de repuestos y servicios disponibles por sucursal.

---

## Diseno y Experiencia de Usuario

- **Estilo Industrial Minimalista:** Lineas limpias, acabados en cristal (glassmorphism) y paletas equilibradas inspiradas en diseno moderno.
- **Soporte de Temas:** Alternancia instantanea entre modo claro y modo oscuro.
- **Acceso Rapido por Teclado:** Buscador global rapido accesible con `Ctrl + K` / `Cmd + K`.
- **Experiencia 100% Responsiva:** Interfaces totalmente adaptadas para dispositivos moviles, tablets y estaciones de trabajo.

---

## Guia de Inicio Rapido

### Requisitos Previos
- **Node.js** (v18.x o superior)
- **MySQL** (v8.0.x o compatible)
- **Python 3** (opcional, para el motor de analiticas avanzadas)
- **Stripe Account** & **Google Gemini API Key**

### 1. Clonar el Repositorio
```bash
git clone https://github.com/C4rlosDcJ/SysTeck.git
cd SysTeck
```

### 2. Configuracion de la Base de Datos
1. Crea una base de datos MySQL.
2. Ejecuta el archivo de esquema principal:
```bash
mysql -u tu_usuario -p tu_base_datos < database/schema.sql
```
*(Las migraciones de superadministrador y funciones SaaS se inicializan de forma automatica en el primer arranque del servidor).*

### 3. Variables de Entorno (.env)

Configura el archivo `backend/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=sysaas_db
JWT_SECRET=tu_jwt_secret_super_seguro
FRONTEND_URL=http://localhost:5173

# Integracion con Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...
```

### 4. Ejecutar en Modo Desarrollo

**Backend**:
```bash
cd backend
npm install
npm run dev
```

**Frontend**:
```bash
cd ../frontend
npm install
npm run dev
```

---

## Stack Tecnologico

- **Frontend:** React 18, Vite, Recharts, Lucide Icons, Vanilla CSS Variables & Design Tokens.
- **Backend:** Node.js, Express, JWT, Stripe SDK, Google Generative AI (Gemini).
- **Analiticas:** Python 3 (NumPy, Scikit-learn / Analytics Engine).
- **Base de Datos:** MySQL 8 (`mysql2/promise` con soporte para transacciones y pools seguros).

---

## Estructura del Proyecto

```text
SySaaS/
├── frontend/           # SPA en React (Vite), componentes modulares y diseno responsivo
├── backend/            # API REST en Express, controladores multi-tenant y servicios AI
│   ├── config/         # Configuracion de base de datos y migraciones
│   ├── controllers/    # Logica de negocio por modulo (POS, Inventario, AI, etc.)
│   ├── middleware/     # Autenticacion, SubscriptionGuard y contexto de tenant
│   ├── routes/         # Endpoints de la API REST
│   └── services/       # Motor de analiticas y servicios auxiliares
├── database/           # Scripts SQL de esquema, migraciones y datos de prueba
└── uploads/            # Almacenamiento local de adjuntos y comprobantes
```

---

## Licencia

Este proyecto esta bajo la licencia **ISC**.

Desarrollado para **SySaaS** (c) 2026.
