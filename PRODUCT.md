# Product

## Register

product

## Users

Dos perfiles sobre la misma plataforma:

- **Inversor (usuario final):** persona aprendiendo a invertir sin arriesgar dinero. Opera con saldo virtual, ve gráficos en vivo, compra/vende y sigue su portafolio. Contexto: escritorio o móvil, sesiones cortas y frecuentes, quiere entender el flujo de una plataforma de trading real sin riesgo.
- **Administrador (back-office / CRM):** gestiona la base de usuarios: revisa cuentas, actividad, estado de verificación (KYC simulado), leads y notas de soporte. Contexto: escritorio, sesiones de gestión, necesita densidad de información y acciones rápidas sobre muchos registros.

## Product Purpose

SimTrade es un **simulador de trading educativo** (proyecto universitario, sin fines de lucro y sin dinero real) con dos superficies: la app de inversión para el usuario final y un CRM/panel de administración para gestionar la operación. El éxito se mide por: flujo de trading creíble y fluido, y un back-office que permita entender y gestionar a miles de usuarios con claridad. NUNCA maneja dinero real ni procesa pagos: el saldo es siempre virtual.

## Brand Personality

Confiable, técnico, sereno. Tres palabras: **claro, profesional, en control.** Debe transmitir la seriedad de una fintech real (Trading212, Stripe, Linear) sin estridencias: el dato manda, la interfaz desaparece detrás de la tarea.

## Anti-references

- Estética de "casino"/gamble: rojos y verdes saturados por todos lados, brillos, gradientes llamativos, promesas de ganancias. (Riesgo real en apps de trading; evitarlo a propósito.)
- Plantillas de dashboard genéricas: fila de tarjetas hero con número gigante + gradiente, tarjetas idénticas repetidas.
- Suplantar marcas reales (no usar el logo de Trading212; marca propia "SimTrade").

## Design Principles

1. **La herramienta desaparece en la tarea.** Familiaridad ganada al nivel de Linear/Stripe; nada raro sin propósito.
2. **El dato es el protagonista.** Densidad cuando ayuda; color y peso solo para jerarquizar y señalar estado, no para decorar.
3. **Estados completos.** Cada vista tiene carga (skeleton), vacío que enseña, y error claro — no solo el "camino feliz".
4. **Coherencia sobre sorpresa.** Mismo vocabulario de componentes en la app y en el CRM; el deleite se reserva para momentos, no para cada pantalla.
5. **Honestidad.** Etiquetas y números reales; nada finge ser dinero real.

## Accessibility & Inclusion

Objetivo WCAG AA: contraste de texto ≥ 4.5:1 (cuidado con gris tenue sobre fondo oscuro), foco visible en todos los interactivos, navegación por teclado en tablas y formularios, y alternativa para `prefers-reduced-motion`. Semántica correcta (roles/labels) en controles del CRM.
