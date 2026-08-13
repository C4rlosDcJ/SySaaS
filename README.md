# SysTeck - Plataforma Integral SaaS Multi-Tenant & Multi-Sucursal para Gestión de Talleres

[![License: ISC](https://img.shields.io/badge/License-ISC-007ACC.svg)](https://opensource.org/licenses/ISC)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1.svg)](https://www.mysql.com/)
[![Stripe](https://img.shields.io/badge/Payments-Stripe-6772E5.svg)](https://stripe.com/)
[![AI-Powered](https://img.shields.io/badge/AI-Diagnostics-FF6B6B.svg)](https://gemini.google.com/)

**SysTeck** es una plataforma integral SaaS (Software as a Service) multi-tenant y multi-sucursal diseñada para simplificar y digitalizar el ciclo operativo de talleres, laboratorios y cadenas de soporte técnico de dispositivos electrónicos. Con aislamiento total de datos de clientes, control de inventario descentralizado por sucursal, diagnósticos inteligentes potenciados por Inteligencia Artificial (AI) y procesamiento automatizado de suscripciones mediante Stripe.

---

## 🛠️ Módulos del Sistema y Funcionalidades

### 1. Panel de SuperAdministrador (Control de la Plataforma)
- **Gestión Global de Tenants:** Visualización, suspensión y reactivación de empresas suscritas.
- **Planes y Precios:** Configuración del catálogo de planes de suscripción (ej: Trial, Basic, Premium) con límites de uso directos.
- **Facturación General:** Monitorización del estado de cuentas a través de Stripe.

### 2. Multi-Tenancy & Aislamiento de Datos
- **Aislamiento Multi-Tenant:** Cada empresa accede mediante su identificador (`systeck.com/app/empresa-slug`), aislando los datos de clientes, tickets y configuraciones.
- **SubscriptionGuard & Límites:** Control de cuota automático (cantidad de sucursales, cantidad de personal staff y número de reparaciones mensuales permitidas).
- **Acceso Restringido:** Bloqueo automático de inserción o lectura en caso de que una cuenta esté suspendida o tenga pagos pendientes.

### 3. Gestión Operativa Multi-Sucursal
- **Inventario Descentralizado:** Catálogo de productos unificado por empresa con stock físico controlado de manera individual por sucursal (`branch_inventory`).
- **Traslados de Mercancía:** Flujo seguro para mover stock entre sucursales (Solicitud en origen -> Estado en tránsito -> Aprobación y recepción física en destino -> Movimiento de stock atómico).
- **Selector de Sucursal:** El personal del staff (técnicos, cajeros, administradores) puede alternar en la barra lateral su sucursal activa según sus asignaciones autorizadas.

### 4. Inteligencia Artificial (Diagnósticos y Cotizaciones AI)
- **Generador de Diagnósticos AI:** Sugerencias automáticas de fallas probables, repuestos necesarios y estimación de tiempos de reparación según el modelo y problema del dispositivo.
- **Estructuración de Presupuestos:** Automatización de cotizaciones a partir de descripciones de texto libre ingresadas por los clientes.
- **Corrector y Optimizador de Notas:** Redacción profesional de observaciones técnicas para el reporte final del cliente.

### 5. Portal y Experiencia de Clientes
- **Seguimiento Público por Ticket:** Rastreo en tiempo real del progreso de equipos sin necesidad de iniciar sesión (Recibido -> Diagnóstico -> Esperando Aprobación -> Reparando -> Listo para entrega).
- **Ingreso de Garantías:** Solicitudes y reclamos automáticos sobre tickets cerrados que estén dentro del periodo de cobertura.
- **Catálogo y Tienda de Repuestos/Servicios:** Visualización de productos y servicios disponibles filtrados por sucursal.

### 6. Punto de Venta (POS) e Historial
- **Cobro Rápido:** Checkout unificado que descuenta stock en tiempo real de la sucursal activa, emite recibos y permite abonos en reparaciones.
- **Estadísticas de Negocio:** Reportes mensuales interactivos de facturación global, métodos de pago, rendimiento de técnicos y balance de gastos.

---

## 🎨 Diseño y Experiencia de Usuario

- **Estilo Minimalista Industrial:** Inspirado en la estética premium de Nothing/Apple con interfaces limpias de alto contraste.
- **Soporte de Temas:** Transición fluida en caliente entre modo oscuro y claro.
- **Micro-interacciones:** Animaciones dinámicas basadas en interacciones de teclado (incluyendo buscador global rápido con `⌘K`).
- **Responsivo Completo:** UI fluida y compacta optimizada para teléfonos móviles, tablets y ordenadores de escritorio.

---

## 🚀 Guía de Inicio Rápido

### Requisitos Previos
- **Node.js** (v18.x o superior)
- **MySQL** (v8.0.x o compatible)
- **Stripe Account** & **Gemini API Key** (para diagnósticos AI)

### 1. Instalación
```bash
git clone https://github.com/C4rlosDcJ/SysTeck.git
cd SysTeck
```

### 2. Configuración de Base de Datos
1. Crea una base de datos MySQL local o remota.
2. Importa el esquema general:
```bash
mysql -u tu_usuario -p nombre_db < database/schema.sql
```
*(Los scripts de migración SaaS se ejecutan de manera automática en el primer arranque).*

### 3. Variables de Entorno (.env)

En **`backend/.env`**:
```env
PORT=5000
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=nombre_db
JWT_SECRET=tu_secreto_jwt
FRONTEND_URL=http://localhost:5173

# Integración Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Diagnostics
GEMINI_API_KEY=AIzaSy...
```

### 4. Lanzar Entorno de Desarrollo

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

## 💻 Stack Tecnológico

- **Frontend:** React (Vite), Recharts, Lucide Icons, Vanilla CSS Variables.
- **Backend:** Node.js, Express, JWT, Stripe SDK, Gemini AI API.
- **Base de Datos:** MySQL (Pool de conexiones a través de `mysql2/promise` con soporte SSL).

---

## 📂 Estructura del Directorio

```text
SysTeck/
├── frontend/           # SPA en React y estilos CSS interactivos
├── backend/            # API REST en Node.js, Express y controladores AI/Stripe
├── database/           # Esquemas y scripts de migración SaaS
└── uploads/            # Soporte multimedia local para fotos de dispositivos
```

---

## Licencia

Este proyecto está bajo la licencia **ISC**.

Desarrollado para **SysTeck** © 2026.
