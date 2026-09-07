# Mejoras de Cupito — septiembre de 2026

## Interfaz y uso diario

- Portada con un mensaje más directo, nueva paleta, presentación en dos columnas en escritorio y demo más compacta en mobile.
- Planes Semilla, Crece y Escala con precios y beneficios compartidos con el panel y el checkout. Los textos distinguen las señas por transferencia del pago de la suscripción con Mercado Pago.
- Panel con próximo turno, reservas pendientes y acceso a la lista de espera y a la página pública.
- Búsqueda de secciones y acciones con Ctrl/⌘ K. Permite abrir directamente horarios y datos de cobro; funciona con flechas, Enter y Escape.
- Navegación mobile sin botones flotantes superpuestos, con espacio para el área segura del teléfono. Al cambiar de sección, el contenido vuelve al inicio.
- Tarjetas de turnos con acciones en una fila independiente en mobile y nombres que aprovechan el ancho disponible sin cortarse a una o dos letras.
- Modales del panel con overlay completo, scroll interno y altura adaptada al viewport y al safe area inferior.
- Animaciones breves que mantienen el contenido legible, foco visible y respeto por movimiento reducido.

## Reservas y configuración

- Las aclaraciones del cliente se guardan en la reserva y se muestran en su detalle.
- Validación de horarios de atención, duración completa del servicio, reaperturas y datos de transferencia.
- Guardado conjunto de horarios, descarte de cambios y borrador conservado durante la sesión.
- Una falla de conexión no se informa como una reserva o inscripción a la lista de espera guardada en la nube.
- La API determina si una seña queda pendiente; el cliente no puede declararla acreditada al reservar.
- Profesionales con teléfono / WhatsApp editable; el botón de calendario usa ese número y muestra cómo completarlo cuando falta.
- Al elegir Semilla, se cancela primero la suscripción identificada de Mercado Pago para detener el débito automático.

## Reserva pública mobile

- Safe areas superior e inferior para que el título, el precio y los controles no queden debajo de la interfaz del teléfono.
- Selector de profesional, atajos de días, horarios y botones con wrap responsive para evitar desbordes horizontales.

## Rendimiento

- HTML de la portada generado durante el build, con estilos iniciales incluidos.
- El sistema de gestión y sus utilidades CSS se cargan al abrir las rutas que los necesitan.
- Tipografía del sistema en la portada; fuentes locales para el panel y las reservas.
- Caché prolongada para archivos con nombre versionado y fuentes.
- El build expone únicamente las variables públicas permitidas de Supabase.

La auditoría local del build final con Lighthouse devolvió 100 en rendimiento, accesibilidad, prácticas recomendadas y SEO (FCP 0,9 s, LCP 1,1 s, TBT 0 ms y CLS 0). La puntuación de PageSpeed en producción puede variar con el equipo, la red y el servidor; su API pública devolvió HTTP 429 por cuota agotada durante esta revisión.

## Verificación

```sh
npm ci
npm run typecheck
npm run build
npm test
node scripts/audit.mjs
```

Las 10 pruebas cubren HTML sin JavaScript, hidratación, rutas, menú mobile, planes, reserva con notas, configuración de horarios y señas, búsqueda y navegación del panel. Las pruebas de pagos y API usan respuestas simuladas.

Playwright usa Edge para las pruebas en esta configuración. La auditoría inicia su propio servidor del build y abre el Chromium de Playwright con un puerto de depuración temporal, lo que evita depender de una instalación global de Chrome o Edge. En otros sistemas requiere `npx playwright install chromium`.

Los informes JSON/HTML de Lighthouse y las capturas de pantalla se guardan en `artifacts/`, fuera de Git.
