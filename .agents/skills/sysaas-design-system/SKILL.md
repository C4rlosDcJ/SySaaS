---
name: sysaas-design-system
description: >-
  Guía y especificación oficial de diseño de SySaaS. Define los principios de Nothing OS
  y Apple Monochromatic minimalista, paleta de colores oscuros con alto contraste,
  bordes sutiles, tipografías Space Mono e Inter, y patrones responsive mobile-first.
---

# SySaaS Design System Specification

## 1. Principios Visuales (Nothing OS + Minimalist Apple)
- **Fondo base**: Negro puro (`#000000`) o carbón profundo (`--color-bg-card: rgba(10, 10, 10, 0.7)`).
- **Elevación y tarjetas**: Superficies en `rgba(22, 22, 22, 0.75)` con bordes ultrafinos `#1a1a1a` o `#2c2c2c`.
- **Acento monocromático**: Blanco puro (`#ffffff`) para botones primarios con texto en negro (`#000000`).
- **Acento Nothing**: Rojo vibrante Nothing (`#ff003c`) reservado para saldos, alertas o badges críticos.
- **Tipografías**:
  - UI y lectura: `'Inter', -apple-system, system-ui, sans-serif`.
  - Códigos, folios y tickets: `'Space Mono', 'SF Mono', monospace`.

## 2. Componentes de Modales y Headers
- **Modal Header**:
  - Título a la izquierda en 2 líneas: Título principal (`font-weight: 700`) + Folio / Subtítulo (`font-family: monospace; color: #888888`).
  - Acciones a la derecha en una fila horizontal compacta (`gap: 8px`).
  - Botón primario: Fondo blanco (`#ffffff`), texto negro (`#000000`), bordes redondeados (`4px` - `6px`).
  - Botón secundario: Fondo tarjeta (`#161616`), borde `#2c2c2c`, texto blanco (`#ffffff`).
  - Botón de cierre: Icono `X` transparente con hover sutil.

## 3. Responsive & Mobile-First
- En pantallas móviles (`max-width: 640px` o `max-width: 768px`):
  - Los modales deben ocupar `width: 100%`, `padding: 12px` y `max-height: 96vh`.
  - Los encabezados deben ajustar los textos a tamaño compacto y permitir scroll vertical sin desbordes horizontales.
  - El layout de 2 columnas debe colapsar a 1 columna apilada ordenada (`preview arriba`, `acciones abajo` o mediante tabs en móvil).
  - Los botones de acción deben tener un área táctil mínima de 44px de alto.

## 4. Tickets Térmicos y Comprobantes Digitales
- **Papel virtual**: Fondo blanco `#ffffff` con texto negro puro `#000000`.
- **Tipografía**: Monospace nítida con espaciado consistente.
- **Renderizado para imagen**:
  - Escala mínima `2.5x` o `3x` para pantallas retina.
  - `box-sizing: border-box` en todos los nodos hijos.
  - Asegurar anchos fijos (340px - 380px) durante el clonado para evitar texto comprimido.
