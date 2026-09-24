# Rediseño del panel y la reserva — septiembre de 2026

## Panel nuevo (`src/components/panel/`)

- Sistema visual propio (`panel.css` + `ui.tsx`): tipografía Inter variable auto‑alojada, tokens de color/radios/sombras, botones, inputs, badges de estado, hojas (drawer lateral en desktop, hoja inferior en mobile), menús con teclado, confirmaciones y skeletons.
- Navegación: sidebar agrupada con contadores, topbar con buscador global (⌘/Ctrl K), “Copiar mi link”, actividad de clientes y “Nuevo turno”. En mobile, barra inferior (Inicio · Agenda · + · Reservas · Más).
- Las secciones viven en la URL (`#/app/agenda?d=…`): refrescar o volver atrás ya no pierde la pantalla.
- **Inicio**: próximo turno con acciones, agenda del día con huecos libres, “Para resolver” (por confirmar, señas, turnos sin cerrar, recordatorios de mañana por WhatsApp, lista de espera), actividad reciente, métricas del día y guía de primeros pasos.
- **Agenda**: grilla horaria por profesional (día), semana y mes; horario cerrado y bloqueos sombreados, línea de “ahora”, clic en un hueco para agendar y arrastrar para reprogramar con deshacer. Lista de 14 días en mobile.
- **Ficha del turno**: acción principal según el momento, reprogramar con horarios libres reales, reasignar profesional, cobro (arreglado el cálculo de seña, que estaba fijo en 20 %), nota interna, plantillas de WhatsApp, historial de cambios, exportar a calendario.
- **Alta de turno**: autocompleta clientes existentes, servicios combinados, profesional, tira de días con disponibilidad y horarios libres; sobreturno manual.
- **Reservas**: filtros por estado/período/profesional, búsqueda, “Confirmar todos” y exportación CSV.
- **Clientes**: segmentos (frecuentes, nuevos, para recuperar, con ausencias), ficha con historial, próximos turnos, nota privada y edición de datos en todos sus turnos.
- **Horarios**: semana con cortes y copiar a Lun–Vie, feriados/vacaciones/horarios especiales y lista de bloqueos que ahora se pueden quitar.
- **Ajustes** reorganizados: Negocio, Reservas (intervalo, pausa entre turnos, anticipación mínima y máxima), Pagos y seña, Notificaciones, Apariencia, Plan y Cuenta.

## Reservas y datos

- Motor único de disponibilidad (`src/lib/availability.ts`) compartido por panel, página pública y `/api/public`: respeta duración combinada, pausa entre turnos, bloqueos por rango, horarios especiales, feriados y anticipación.
- `normalizeData` descartaba `brandColor`, `bufferMinutes`, `specialHours` y `logoUrl`: ahora persisten.
- Eliminar un servicio con historial lo archiva en vez de borrar sus turnos.
- Los turnos guardan historial (`events`) y nota interna; deshacer una eliminación ya no la revierte la sincronización.
- Nueva acción `reschedule` en `/api/public`: el cliente cambia su turno desde “Mis turnos” (antes creaba un turno duplicado).
- Página pública: selector de profesional y días con disponibilidad, arranque en el primer día con lugar, errores claros de cancelación tardía y lista de espera, total correcto con servicios combinados.
- Recordatorio por email desactivable (`remindersEnabled`).

## Verificación

`npm run typecheck`, `npm run build` y `npm test` (24 pruebas; en contenedores: `PW_EXECUTABLE=/ruta/a/chromium npm test`).

---

# Mejoras de Cupito — septiembre de 2026

## Interfaz y uso diario

- Portada con un mensaje más directo, nueva paleta, presentación en dos columnas en escritorio y demo más compacta en mobile.
- Planes Semilla, Crece y Escala con precios y beneficios compartidos con el panel y el checkout. Los textos distinguen las señas por transferencia del pago de la suscripción con Mercado Pago.
- Panel con próximo turno, reservas pendientes y acceso a la lista de espera y a la página pública.
- Búsqueda de secciones y acciones con Ctrl/⌘ K. Permite abrir directamente horarios y datos de cobro; funciona con flechas, Enter y Escape.
- Navegación mobile sin botones flotantes superpuestos, con espacio para el área segura del teléfono. Al cambiar de sección, el contenido vuelve al inicio.
- Tarjetas de turnos con acciones en una fila independiente en mobile y nombres que aprovechan el ancho disponible sin cortarse a una o dos letras.
- Modales del panel con overlay completo, scroll interno y altura adaptada al viewport y al safe area inferior.
- Reserva pública con el logo real de Cupito en el encabezado y la tarjeta lateral.
- Productos opcionales dentro de un panel plegable: la reserva empieza limpia y el catálogo se abre en una grilla compacta con resumen del carrito.
- Hero de la landing con beneficios concretos junto al CTA para explicar el valor en un vistazo.
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

La auditoría local del build final con Lighthouse devolvió 100 en rendimiento, accesibilidad, prácticas recomendadas y SEO (FCP 0,9 s, LCP 1,1 s, TBT 70 ms y CLS 0). La puntuación de PageSpeed en producción puede variar con el equipo, la red y el servidor; su API pública devolvió HTTP 429 por cuota agotada durante esta revisión.

## Verificación

```sh
npm ci
npm run typecheck
npm run build
npm test
node scripts/audit.mjs
```

Las 11 pruebas cubren HTML sin JavaScript, hidratación, rutas, menú mobile, planes, reserva con notas, productos opcionales plegables, configuración de horarios y señas, búsqueda y navegación del panel. Las pruebas de pagos y API usan respuestas simuladas.

Playwright usa Edge para las pruebas en esta configuración. La auditoría inicia su propio servidor del build y abre el Chromium de Playwright con un puerto de depuración temporal, lo que evita depender de una instalación global de Chrome o Edge. En otros sistemas requiere `npx playwright install chromium`.

Los informes JSON/HTML de Lighthouse y las capturas de pantalla se guardan en `artifacts/`, fuera de Git.

## Landing rediseñada

- Nueva portada con sistema visual propio (Bricolage Grotesque + Inter autoalojadas, verde marca + lima).
- Hero con escena animada: el cliente reserva desde el celular y el turno aparece en la agenda (loop sincronizado, con tilt al mover el mouse).
- Secciones: problema → solución (chat animado), funciones en bento con microanimaciones, cómo funciona, personalizador en vivo, precios con toggle mensual/anual, preguntas y CTA final.
- Animaciones de entrada al hacer scroll sin romper el HTML prerenderizado; todo respeta `prefers-reduced-motion`.
- Se eliminaron los estilos y componentes viejos de la landing (`landing-light/refinement/polish.css`, `Accordion`, `LandingTour`).
