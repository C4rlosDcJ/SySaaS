---
name: sysaas-design-system
description: >-
  Guía y especificación oficial de diseño y arquitectura UI de SySaaS. Define los principios de Nothing OS
  y Apple Monochromatic minimalista, tokens de color (Dark y Light), paleta ejecutiva Cool, tipografías Space Mono e Inter,
  componentes base (botones, modales, cards, tablas responsivas a tarjetas), estándares de tickets térmicos/comprobantes digitales y patrones mobile-first.
---

# SySaaS Design System Specification (Oficial & Integral)

Esta especificación es el estándar canónico de diseño y experiencia de usuario (UI/UX) para toda la plataforma SySaaS. Todo nuevo componente, módulo, página, modal o ajuste debe apegarse rigurosamente a las directrices aquí documentadas.

---

## 1. Principios Visuales y Filosofía de Diseño

SySaaS combina la sobriedad técnica e industrial de **Nothing OS** con la precisión tipográfica y monocromática de **Apple**:
- **Monocromático de Alto Contraste**: La interfaz se estructura primordialmente en blanco, negro y una escala de grises neutros de alta fidelidad.
- **Superficies y Profundidad**: Fondos profundos con paneles semitransparentes (`backdrop-filter: blur(12px - 16px)`) delimitados por bordes ultrafinos (`1px solid var(--color-border)`).
- **Acento Nothing**: El color rojo vibrante Nothing (`#ff003c`) está reservado con estricta intención: balances adeudados, alertas críticas de stock o acciones destructivas.
- **Micro-interacciones Inmediatas**: Transiciones sutiles y directas (`0.1s - 0.2s ease`). Sin animaciones exageradas que entorpezcan la agilidad operativa.
- **Estricta Regla Text-Only**: No utilizar emojis en la interfaz de usuario, títulos de estado, etiquetas ni mensajes del sistema.

---

## 2. Tokens de Color y Paleta Oficial

### Tema Oscuro (Predeterminado)
```css
/* Primarios y Acentos */
--color-primary: #ffffff;
--color-primary-dark: #e5e5e5;
--color-primary-contrast: #000000;
--color-primary-muted: rgba(255, 255, 255, 0.06);
--color-accent-red: #ff003c; /* Nothing Red */

/* Fondos y Superficies */
--color-bg: #000000;
--color-bg-card: rgba(10, 10, 10, 0.7);
--color-bg-elevated: rgba(22, 22, 22, 0.75);
--color-bg-input: #0a0a0a;

/* Bordes y Líneas */
--color-border: #1a1a1a;
--color-border-strong: #2c2c2c;

/* Tipografía */
--color-text: #ffffff;
--color-text-secondary: #888888;
--color-text-muted: #555555;
```

### Tema Claro (`:root[data-theme='light']`)
```css
--color-primary: #000000;
--color-primary-dark: #171717;
--color-primary-contrast: #ffffff;
--color-primary-muted: rgba(0, 0, 0, 0.04);

--color-bg: #ffffff;
--color-bg-card: rgba(250, 250, 250, 0.8);
--color-bg-elevated: rgba(244, 244, 245, 0.85);
--color-bg-input: #ffffff;

--color-border: #e5e5e5;
--color-border-strong: #d4d4d8;

--color-text: #000000;
--color-text-secondary: #666666;
--color-text-muted: #999999;
```

### Paleta Ejecutiva Cool (Estados, Badges y Métricas)
Se utilizan colores pastel/fríos con fondos translúcidos al 12% y sin bordes estridentes:
- **Cool Cyan** (`#38bdf8` / `rgba(56, 189, 248, 0.12)`): En progreso, diagnósticos activos, tickets en curso.
- **Cool Teal** (`#34d399` / `rgba(52, 211, 153, 0.12)`): Completado, entregado, inventario óptimo, ingresos.
- **Cool Amber** (`#fbbf24` / `rgba(251, 191, 36, 0.12)`): Pendiente, presupuesto en espera, stock bajo.
- **Cool Rose** (`#f87171` / `rgba(248, 113, 113, 0.12)`): Cancelado, agotado, devolución, garantía rechazada.
- **Cool Slate Blue** (`#818cf8` / `rgba(129, 140, 248, 0.12)`): Métricas de catálogo, servicios, equipos en taller.
- **Cool Sky** (`#60a5fa` / `rgba(96, 165, 250, 0.12)`): Traspasos, órdenes de taller vinculadas.
- **Cool Indigo** (`#a78bfa` / `rgba(167, 139, 250, 0.12)`): Facturación, suscripciones, usuarios staff.

---

## 3. Tipografía y Jerarquía Textual

| Uso | Familia | Propiedades |
| :--- | :--- | :--- |
| **Interfaz y Lectura General** | `'Inter', -apple-system, sans-serif` | `font-weight: 400` (cuerpo), `500` (etiquetas), `700` (encabezados) |
| **Folios, Códigos, SKUs y Cifras** | `'Space Mono', 'SF Mono', monospace` | `letter-spacing: -0.01em`, `font-weight: 600 - 800` |
| **Títulos de Secciones / Cards** | Inter o Space Mono | `text-transform: uppercase`, `letter-spacing: 0.05em`, `font-size: 11px - 13px` |
| **Indicadores / Micro-etiquetas** | Monospace | `font-size: 9px - 10px`, `text-transform: uppercase` |

---

## 4. Botones y Elementos Interactivos

1. **Botón Primario (`.btn-primary`)**:
   - Fondo: `var(--color-primary)` (Blanco en Dark / Negro en Light).
   - Texto: `var(--color-primary-contrast)` (Negro en Dark / Blanco en Light).
   - Altura estándar: 36px (Desktop), 42px - 44px (Móvil).
   - Radio: `var(--radius-md)` (4px - 6px).
2. **Botón Secundario (`.btn-secondary`)**:
   - Fondo: `var(--color-bg-elevated)`, Borde: `1px solid var(--color-border)`.
   - Texto: `var(--color-text)`.
   - Hover: Borde `var(--color-border-strong)`.
3. **Botón Peligro (`.btn-danger`)**:
   - Fondo neutro o transparente con texto `#ef4444`.
   - Hover destructivo con fondo `#ffffff` y texto `#000000` o rojo Nothing `#ff003c`.
4. **Botón Fantasma / Icono (`.btn-ghost`, `.btn-icon`)**:
   - Fondo transparente, tamaño de icono 14px - 16px, contenedor táctil de 32px a 38px.

---

## 5. Arquitectura de Modales (Estándar SySaaS)

Todos los modales deben implementar la siguiente estructura semántica y responsiva:

```html
<div class="modal-overlay">
  <div class="modal [modal-custom-name]">
    <div class="modal-header">
      <div class="modal-header-info">
        <div class="modal-icon-wrap"><Icon size={18} /></div>
        <div class="modal-title-col">
          <h3 class="modal-title font-mono">[FOLIO O TITULO]</h3>
          <span class="modal-subtitle">[Subtítulo / Fecha / Contexto]</span>
        </div>
      </div>
      <div class="modal-header-actions">
        <!-- Acciones primarias de cabecera -->
        <button class="modal-close"><X size={18} /></button>
      </div>
    </div>
    <div class="modal-body">
      <!-- Contenido scrolleable independiente -->
    </div>
    <div class="modal-footer">
      <!-- Acciones de cierre y confirmación -->
    </div>
  </div>
</div>
```

### Reglas para Modales:
- **Estructura Flex**: `.modal` tiene `display: flex; flex-direction: column; max-height: calc(100vh - 32px); overflow: hidden;`.
- **Cuerpo con Scroll Aislado**: El `modal-body` tiene `overflow-y: auto; -webkit-overflow-scrolling: touch; flex: 1;`.
- **En Móviles (<= 600px)**:
  - Adopta comportamiento tipo *bottom sheet* o modal completo (`width: 100%`, `max-height: 90vh - 94vh`).
  - Botones de acción en la cabecera pasan a modo icono compacto para evitar rupturas de línea en folios largos.
  - Los botones del pie se ordenan verticalmente a ancho completo (`width: 100%`).

---

## 6. Patrón de Tablas a Tarjetas (Mobile-First Data Transformation)

Las tablas complejas (como Historial de Ventas e Inventario) no deben provocar scroll horizontal infinito en dispositivos pequeños. En pantallas `<= 768px`, las filas de la tabla se transforman en **tarjetas ordenadas**:

```css
@media (max-width: 768px) {
  .table-container {
    background: transparent !important;
    border: none !important;
    overflow: visible !important;
  }
  .table thead {
    display: none; /* Se oculta el encabezado rígido */
  }
  .table tbody {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .table tbody tr {
    display: grid;
    grid-template-columns: auto 1fr auto;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 12px);
    padding: 12px;
    gap: 8px 10px;
  }
  .table td {
    padding: 0 !important;
    border: none !important;
  }
}
```

### Directrices para la Tarjeta Móvil:
- **Zona Superior**: Miniatura/Icono + Folio/Nombre del ítem + Badge de estado/categoría en la esquina superior derecha.
- **Zona Media**: Desglose informativo compacto (Cliente, precios o existencias) con etiquetas descriptivas en miniatura (`font-size: 10px; text-transform: uppercase`).
- **Zona Inferior**: Botones de acción agrupados horizontalmente con iconos claros y área táctil mínima de 36px.

---

## 7. Comprobantes Digitales y Tickets Térmicos

Para la generación de tickets imprimibles y la exportación de comprobantes digitales de alta resolución (PNG/WhatsApp) con `html2canvas`:

1. **Papel Virtual**:
   - Fondo: Blanco puro (`#ffffff`) y texto negro puro (`#000000`).
   - Forzado de estilos: Utilizar `!important` en el contenedor del ticket para anular los estilos globales del tema oscuro del sistema.
2. **Dimensiones y Tipografía**:
   - Ancho exacto durante el render: 340px a 360px (emulando impresoras térmicas de 80mm).
   - Tipografía: `'SF Mono', 'Space Mono', 'Cascadia Mono', monospace`.
   - Interlineado: `line-height: 1.4 - 1.5`, `font-size: 10.5px - 11px`.
3. **Optimización para Exportación de Imagen**:
   - Escala: Forzar `scale: 2.5` o `3` en `html2canvas` para nitidez Retina.
   - Márgenes y Cajas: Todos los nodos internos deben tener `box-sizing: border-box`.
   - Separadores: Líneas discontinuas nítidas `border-top: 1px dashed #000000`.
   - Badges sobre ticket térmico: Fondo negro `#000000` con texto blanco `#ffffff` para garantizar legibilidad al imprimir o digitalizar.
4. **Formato de Fechas y Horas en Comprobantes**:
   - Usar estrictamente la utilidad centralizada `formatDateTime` de `utils/constants.js`.
   - Evitar `new Date(val).toLocaleString()` directo en componentes de tickets para impedir que el huso horario local desplace la fecha u hora original registrada en la orden.

---

## 8. Sistema de Scrollbars y Selectores Horizontales

Para selectores de filtros, pestañas de sucursales o presets en pantallas táctiles:
```css
.horizontal-scroll-tabs {
  width: 100%;
  overflow-x: auto;
  display: flex;
  gap: 6px;
  scrollbar-width: none; /* Firefox */
  -webkit-overflow-scrolling: touch;
}
.horizontal-scroll-tabs::-webkit-scrollbar {
  display: none; /* Chrome, Safari */
}
.horizontal-scroll-tabs .tab-pill {
  flex-shrink: 0;
  white-space: nowrap;
}
```

---

## 9. Breakpoints Canónicos del Sistema

- **Mobile Compact** (`max-width: 420px`): Teléfonos pequeños, headers en 1 sola columna, fuentes de folios compactas (13px - 14px), modales a pantalla completa.
- **Mobile Standard** (`max-width: 600px` - `640px`): Teléfonos comunes, bottom sheets para modales, grids de filtros a 1 columna.
- **Tablet / Mobile Switch** (`max-width: 768px` - `900px`): Ocultamiento del sidebar fijo, activación del `MobileHeader`, conversión de tablas a tarjetas.
- **Desktop** (`min-width: 901px`): Barra lateral expandida (240px), tablas completas de alta densidad, modales centrados flotantes.

---

## 10. Lista de Verificación (Checklist) para Nuevas Vistas

Antes de dar por completado cualquier desarrollo de UI en SySaaS, verificar:
- [ ] ¿Respeta el contraste monocromático oscuro y la variable `--color-accent-red` solo para elementos críticos?
- [ ] ¿Se omitieron todos los emojis reemplazándolos por iconos de Lucide o texto sobrio?
- [ ] ¿Los folios, códigos y cifras monetarias utilizan fuente monospace?
- [ ] ¿En pantallas de 360px a 420px de ancho no existe ningún desborde horizontal inesperado?
- [ ] ¿Los títulos largos o nombres de clientes tienen elipsis (`text-overflow: ellipsis`) donde corresponde?
- [ ] ¿Los modales tienen scroll interno en su cuerpo y no quedan recortados bajo la barra móvil o chatbots?
