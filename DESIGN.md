# Design

Sistema visual de Stratex. Tema oscuro, denso, tipo terminal fintech. Dos acentos por superficie: **verde/rojo** para la app de trading (dirección del mercado) y **azul** para el CRM (acciones de administración).

## Theme

Dark, único (no hay modo claro). Escena: operadores y administradores frente a pantallas, en interiores, foco prolongado en datos numéricos y gráficos; el fondo oscuro reduce fatiga y hace resaltar las velas y cifras.

## Color

Estrategia: **Restrained** (neutros + un acento por superficie).

### Superficies (neutros)
- `#0A0B0D` — fondo de página
- `#0F1115` — barras laterales / paneles (capa de navegación)
- `#101216` — tarjetas y contenedores de contenido
- `#16181C` / `#1A1D23` — controles y fondos internos
- Bordes: `#1E2128` (hairline por defecto), `#262A33` (énfasis)

### Texto
- `#F2F3F5` — primario
- `#B8BFCC` — secundario
- `#8B92A0` — atenuado (labels, metadatos)
- `#5B6472` — muy tenue (usar con cuidado; verificar contraste)

### Acentos semánticos
- Trading — verde `#16C784` (alza, compra, positivo), rojo `#FF5C5C` (baja, venta, negativo)
- CRM — azul `#3B82F6` (relleno de acción), `#60A5FA` (texto/selección)
- Estado — ámbar `#E8B339` (KYC pendiente / advertencia)
- Sobre fondos de color usar el mismo tono a mayor opacidad, nunca gris.

## Typography

Una sola familia: stack de sistema (`-apple-system, Inter, system-ui, Segoe UI, Roboto`). Escala fija en rem/px (no fluida): números grandes para cifras clave (28–40px), 13–16px para cuerpo/labels, 10–11px para metadatos en mayúsculas suaves. Peso 400/500/600. Fuente monoespaciada del sistema para precios/valores donde ayuda la alineación.

## Components

- **Tarjetas:** fondo `#101216`, borde hairline `#1E2128`, radio 16px (`rounded-2xl`). Sin sombras decorativas. Nunca tarjeta dentro de tarjeta.
- **Botones:** primario relleno (verde en trading / azul en CRM) con texto `#0A0B0D`; secundario con borde `#262A33` y hover sutil. Radio `rounded-lg/xl`.
- **Inputs:** fondo `#0A0B0D`, borde `#1E2128`, foco al color de acento. Radio `rounded-xl`.
- **Badges/píldoras:** fondo = acento a ~12% opacidad, texto = acento; para estado (activo/suspendido, KYC) con punto de color.
- **Tablas/listas del CRM:** filas con divisor `#1A1D23`, hover `white/[0.03]`, encabezados 10–11px en mayúsculas `#5B6472`.
- **Gráficos:** `lightweight-charts` (velas y área), cuadrícula `#15181E`, ejes `#787E8C`, herramientas de dibujo ancladas a tiempo+precio.

Estados requeridos por componente: default, hover, focus, active, disabled, loading (skeleton), empty (que enseñe), error.

## Layout

- App de trading: barra lateral fija (240px) + contenido; en móvil debe colapsar.
- CRM: barra lateral (240px) + área de trabajo (máx ~1200px).
- Responsive estructural (colapso de sidebar, tablas adaptables), no tipografía fluida.
- Escala z-index semántica (dropdown → sticky → modal → toast → tooltip).

## Motion

Transiciones 150–250ms, solo para transmitir estado (hover, foco, cambio, carga). Nada de secuencias de carga coreografiadas. Respetar `prefers-reduced-motion`.
