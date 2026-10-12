# ATMÓS 3 — Motion semántico

Implementación sobre `GatDeguin/Atmos`, revisión base `44313ab0ac069918938136f26e44619ecf185505`. Documento de diseño, contratos y verificación. Fecha de ejecución local: 11 de octubre de 2026 (Buenos Aires); algunos archivos de evidencia usan UTC del 12 de octubre.

## 1. Contexto observado y alcance

**Observado en el código publicado:** UI en un único `index.html`, JavaScript clásico y CSS integrados, SVG para gráficos, Canvas 2D para ambiente, Web Animations API, localStorage con respaldo JSON, `sw.js`, manifest y widget Scriptable separado. Sin framework, sin paquetes de producción, sin fuente variable aportada. Datos de Open-Meteo; no se modificó el proveedor ni el formato de respaldo. La copia inicial del HTML fue contrastada con su SHA Git `6f8a03a6013bc25c6bfe9bf94b97d6d590a2e688`.

**Inferencia de diseño:** la tarea frecuente es decidir cómo vestirse o planificar una salida consultando ubicación, hora, lluvia y viento; no mirar una introducción cinematográfica repetida. **Supuesto operativo:** escritorio y móvil, incluyendo iPhone, sin alterar rutas, módulos nativos ni navegación.

La versión anterior registraba listeners nuevos de gráfico en cada selección, reiniciaba entradas en los rerenders, dejaba transiciones activas al pulsar «sin movimiento» y conservaba un bucle de partículas indefinido. Se retiraron parallax, flotación de símbolos, pulsos y crecimiento decorativo de barras de datos. No se incorporaron pantallas para mostrar efectos.

## 2. Mapa semántico

| Intención | Acción real | Cambio de dominio/UI | Respuesta perceptible | Reposo y siguiente acción |
|---|---|---|---|---|
| Leer otra hora | Tocar una tarjeta o recorrer SVG | `selectedHour` cambia; valores exactos | Guía y lectura inmediatas; la curva permanece | Seleccionar otra hora sin redibujar ni desplazar la página |
| Comparar una variable | Temperatura / lluvia / viento | `activeChart` cambia y se recalcula la escala | Etiquetas y datos inmediatos; marcador de selección se asienta | Explorar puntos de la nueva variable |
| Inspeccionar un día | Abrir/cerrar una fila | `openDay` y `aria-expanded` cambian primero | Expansión desde la altura visual actual; sin escalar textos | Detalle visible o escondido; apertura reversible |
| Elegir ciudad | Abrir búsqueda y escribir | Modal activo; búsqueda real, cancelable | Modal se desplaza 6 px; iconos nuevos se escalonan | Campo con foco, resultados operables desde el inicio |
| Conservar lugares | Agregar o retirar un favorito | Lista persistente cambia | FLIP sólo de los sobrevivientes con la misma coordenada | Lista correcta y foco recuperado |
| Cambiar apariencia | Pulsar tema | Preferencia y tema nuevos inmediatamente | Disolución breve del icono de acción | Un único icono, un único botón accesible |
| Reconocer precipitación | Llega un pronóstico de lluvia/nieve para otra ciudad/condición | Datos y texto meteorológicos reales | Ilustración cualitativa de hasta 3 s | Cielo estático; no hay RAF ambiental pendiente |
| Quitar movimiento | Botón o cambio de preferencia del sistema | Política de presentación; no cambia el dominio | Cancelación y asentamiento inmediato | Todas las tareas siguen disponibles |

**Invariantes:** la presentación nunca valida el pronóstico; cifras, unidades y probabilidades no se interpolan; sólo una hora y una variable están seleccionadas; el cierre no depende de un `animationend`; ningún clon es interactivo; el layout final funciona sin WAAPI; los datos ausentes siguen ausentes; un resultado de red obsoleto no sustituye la última ciudad elegida.

**Referencias estables:** ubicación, cifras, ejes, controles y panel principal. No se inclina la cámara ni se mueve toda la pantalla al explorar horas. El nombre de la ciudad mantiene espacio legible a 320 px.

## 3. Matriz completa de 16 técnicas

| Técnica | Decisión | Ubicación real / necesidad | Beneficio previsto | Riesgo principal | Alternativa reducida | Verificación |
|---|---|---|---|---|---|---|
| Morph | Adaptar | El mismo detalle diario pasa de cerrado a abierto | Relacionar la fila con su contenido | Altura obsoleta al invertir | `hidden` directo | 60 cambios, cancelación al 0/50/95 %, resize |
| Stagger | Aplicar | Iconos de resultados nuevos, en orden de lectura | Agrupación de ubicaciones sin esperar para usarlas | Demora acumulada o foco invisible | Iconos estáticos | Siete iconos máx.; retraso total ≤120 ms |
| Spring | Adaptar | Marcador del selector de variable | Continuidad de la selección, no de los datos | Oscilación o destino antiguo | Posición final inmediata | 30 cambios rápidos; alineación <0,6 px |
| Easing | Aplicar | Apertura, foco y reordenamiento | Causalidad consistente, sin esperas ceremoniales | Interpolaciones superpuestas | 0 ms | Tokens comunes; un propietario por elemento |
| Crossfade | Aplicar | Icono del botón de tema | Sustitución en el mismo control, sin saltos | Doble objetivo accesible o clones retenidos | Reemplazo directo | 20 cambios; un SVG final; cero ghosts |
| Shared element | Omitir | No hay navegación entre vistas de la misma entidad | Evitar una ruta/clone inventado | Simular continuidad inexistente | Vista actual | Revisión de recorridos existentes |
| Magnification | Adaptar | Iconos internos de botones, hover/foco/tacto | Identificar el control sin mover su área activa | Colisión de hitboxes | Borde/foco estático | Toque emulado, teclado; área del botón fija |
| Blur | Omitir como motion | El fondo de búsqueda usa velo sólido | Separar contexto sin animar filtros de gran superficie | Coste de pintura, texto borroso | El mismo velo | Capturas temporal/final; fondo inert |
| Mask | Omitir | No corresponde a una tarea meteorológica | Datos disponibles completos | Ocultar información esencial | Contenido íntegro | Sin máscaras nuevas |
| Variable font | Omitir | No hay archivo variable autorizado ni ejes comprobados | Evitar falsa tipografía variable y descarga externa | Reflow, fuente ficticia | Tipografía de sistema existente | Sin fuentes añadidas ni redistribuidas |
| Layout animation | Aplicar | Favoritos sobrevivientes identificados por coordenadas | Conservar orientación al eliminar una fila | Índices inestables o texto deformado | Lista final inmediata | FLIP de traslación; claves estables; foco recuperado |
| Clip path | Omitir | No corresponde | No recortar controles ni duplicar morph | Foco/clipping en móvil | Apertura intrínseca | Sin clip-path nuevos; `clip` accesible preexistente no es motion |
| Path morph | Omitir | Variables/unidades/escalas diferentes | No inventar correspondencias ni mediciones intermedias | Probabilidades falsas o segmentos a través de null | Nuevo gráfico exacto | Huecos conservados; no área de relleno que puentee null |
| Stroke draw | Adaptar | Primera exploración de la curva de temperatura de un horizonte | Presentar dirección temporal de lectura | Sugerir medición que llega en vivo | Trazo completo inmediato | Longitud SVG real; 380 ms lineales; no replay al recorrer horas |
| Perspective | Omitir | Dashboard de lectura, no manipulador 3D | Conservar legibilidad y referencias | Movimiento vestibular, hitboxes engañosas | Interfaz plana | Sin tilt/cámara/parallax de puntero |
| Particles | Adaptar | Inicio de lluvia/nieve; condición/city nueva | Reconocimiento cualitativo de precipitación | Bucle permanente o falsa cuantificación | Icono y texto meteorológico estático | Semilla reproducible, hasta 48, 3 s, pausa/resize/pagehide |

**Resultado: 9 técnicas utilizadas o adaptadas; 7 omitidas.** El blur material estático del cielo original no se presenta como nueva animación. No se atribuye una velocidad/densidad físicamente medida a las partículas.

## 4. Gramática y presupuesto

Fuente única de configuración: custom properties `--motion-*` en el HTML; JavaScript las lee una vez en `MOTION`.

| Token | Valor | Uso |
|---|---:|---|
| confirm | 110 ms | Iconos de control |
| local | 180 ms | Disolución y respuesta local |
| context | 260 ms | Apertura del buscador |
| layout | 240 ms | Detalles diarios y favoritos |
| trace | 380 ms, lineal | Trazo de primera lectura |
| distance | 6 px | Desplazamiento máximo de entrada |
| step / delay-max | 24 / 120 ms | Iconos nuevos, nunca toda la página |
| arrive | `cubic-bezier(.2,.8,.2,1)` | Asentamiento sin rebote |
| omega | 24 s⁻¹ | Resorte críticamente amortiguado |
| burst / particle-cap / dpr-cap | 3000 ms / 48 / 1,5 | Ambiente cualitativo acotado |

Resorte: `m=1`, `k=576`, `c=48`, solución analítica de `x''+2ωx'+ω²(x-target)=0` en píxeles/segundos; reposo por distancia <0,15 px y velocidad <1 px/s, o corte defensivo de 900 ms. Se retienen posición y velocidad ante una intención nueva. No hay easing adicional sobre esa física. El ancho del marcador se ajusta sin estirar texto.

Partículas: una secuencia de hasta 3 s, entrada de 200 ms y salida de 450 ms, emisor Canvas, límite de pintura aproximado de 30 Hz y dt acotado a 50 ms. La semilla depende de ciudad/condición. No hay nodos DOM por partícula, relámpagos, partículas en tiempo despejado ni resurgimiento automático después de `pagehide`/salida del viewport. Los 30 Hz son un límite de programación, no un FPS garantizado.

## 5. Contratos de implementación

### C1 — Selección horaria y cambio de variable

**Identidad/propósito:** hora del horizonte y variable activa. **Precondición:** datos horarios válidos y SVG presente. **Resultado:** datos y atributos seleccionados actualizados sin esperar efectos. **Geometría:** guía exacta; curva y ejes inmóviles durante scrubbing; marcador de variable anclado al botón activo. **Tiempo:** selección inmediata; sólo marcador usa resorte. **Interrupción:** última selección válida; una asignación `onclick`/`onpointermove`, no listeners acumulativos. **Interacción:** tarjetas son botones; puntero sin anuncios por frame, selección explícita con región viva separada. **Adaptación:** teclado/tacto sin hover obligatorio, posición inmediata en modo reducido. **Ciclo de vida:** modelo SVG invalidado al vaciar o reemplazar vista; spring cancelado en resize/pagehide. **Evidencia:** 100 selecciones preservan el nodo y el path; 30 variables; gráfico vacío; null; sin WAAPI.

### C2 — Detalle del día (morph intrínseco)

**Identidad/propósito:** misma fila y mismo panel por fecha/índice del horizonte. **Precondición:** botón asociado por `aria-controls`. **Resultado:** `openDay`/`aria-expanded` se actualizan antes de animar; al reposar un panel o ninguno. **Geometría:** altura visual actual → altura natural o cero; overflow temporal sólo de la región de datos, botón y foco fuera. **Tiempo:** 240 ms. **Interrupción:** medir altura visible, cancelar transición anterior y dirigirse al nuevo destino; limpieza lee el estado actual, no una captura obsoleta. **Interacción:** cierre marca contenido `inert`/`aria-hidden` inmediatamente, apertura legible y sin texto escalado. **Adaptación:** cambio directo sin WAAPI; resize asienta altura natural. **Ciclo de vida:** `playMotion` propietario y cleanup idempotente; sin estilos de altura retenidos. **Evidencia:** 60 redirecciones en tres posiciones temporales y pruebas de resize/reduced.

### C3 — Búsqueda y resultados

**Identidad/propósito:** abrir un contexto temporal para elegir una ubicación. **Precondición:** botón de ciudad, botón lateral o Ctrl/Cmd+K. **Resultado:** modal abierto con foco en búsqueda; al cerrar, foco en origen. **Geometría:** 6 px verticales para panel y horizontales para iconos nuevos; controles y texto visibles desde frame cero. **Tiempo:** 260 ms de contexto, 180 ms por icono, retraso máximo 120 ms. **Interrupción:** reabrir enfoca el campo; cierre inmediato cancela todo; texto nuevo invalida búsqueda anterior. **Interacción:** shell inert, scroll de fondo bloqueado y focus trap. **Adaptación:** Escape, Tab/Shift+Tab, tacto; modo reducido sin transformaciones. **Ciclo de vida:** cancelación por subtree al cerrar o reemplazar resultados; limpieza de debounce/AbortController existentes. **Evidencia:** 20 ciclos, resultado controlado, foco y capturas de inicio/130 ms/final.

### C4 — Favoritos (FLIP)

**Identidad/propósito:** ubicaciones por coordenadas normalizadas, no por posición en lista. **Precondición:** lista cambia realmente. **Resultado:** persistencia existente actualizada primero; sobrevivientes reconocibles. **Geometría:** medir First, escribir lista final, medir Last en lote, invertir sólo traslación y reproducir a cero. **Tiempo:** 240 ms. **Interrupción:** nuevas medidas desde posición visual, cancelación del subtree anterior. **Interacción:** el área final sigue operable; al eliminar un control enfocado se enfoca la siguiente eliminación o «Agregar ciudad». **Adaptación:** no movimiento en sidebar oculto ni modo reducido. **Ciclo de vida:** sin clones; key/signature evita reconstrucción en cada `updateHeader`. **Evidencia:** eliminación de segunda fila con superviviente reordenado y foco conservado.

### C5 — Tema y magnificación

**Identidad/propósito:** icono de acción del mismo botón. **Precondición:** cambio real de tema, no timer de cabecera. **Resultado:** tema y nombre accesible correctos inmediatamente, un icono final. **Geometría:** disolución sin traslado; magnificación 1,08 o pulsación 0,94 sólo en SVG interno. **Tiempo:** 180/110 ms. **Interrupción:** completar visual anterior, reemplazar; cancelar elimina el icono saliente. **Interacción:** clone `aria-hidden`, `focusable=false`, inert y sin pointer-events. **Adaptación:** foco y tacto sin proximidad ficticia; estático en reduced. **Ciclo de vida:** registro de animaciones limpia fulfilled/rejected `finished`, sólo AbortError se trata como cancelación esperada. **Evidencia:** 20 inversiones, cero ghosts y rechazos no manejados.

### C6 — Trazo y precipitación cualitativa

**Identidad/propósito:** primera lectura de curva/horizonte o nueva condición meteorológica. **Precondición:** datos reales ya aceptados, zona visible, política habilitada. **Resultado:** todos los datos exactos están disponibles desde el inicio; SVG completo/canvas vacío al final. **Geometría:** longitud real por `getTotalLength`; Canvas acotado a hero; no toca botones. **Tiempo:** 380 ms/3 s. **Interrupción:** selección horaria no redibuja la curva; rerender no repite presentación; offscreen/resize/pagehide asienta y libera. **Interacción:** información fuera de Canvas; botón existente detiene motion. **Adaptación:** icono/texto/trazo estáticos. **Ciclo de vida:** registro máximo de 32 horizontes, dos observers transitorios como máximo, desconectados al terminar; RAF cancelado, partículas vaciadas. **Evidencia:** reposo global, navegación interrumpida, fixtures lluvia/despejado, fallbacks sin observers.

## 6. Implementación y archivos

`index.html`: estilo/tokens, coordinador local, handlers de gráfico sin re-registro, rutas de cancelación, aria-live controlada, morph de días, FLIP, spring, crossfade, partículas finitas, ajuste de cabecera móvil.

`sw.js`: incremento de caché del shell a `atmos-app-shell-semantic-v4`. API meteorológica sigue fuera del service worker; no borra localStorage ni cambia el formato de preferencias.

`README.md`: explicación actualizada. `tests/`: suites Python/Playwright reproducibles. `docs/evidence/`: salidas JSON reales de esta ejecución. Manifest, iconos, instalador, widget y workflow ordinario de Pages no necesitan modificaciones de producto.

Dependencias de producción añadidas: **ninguna**. Herramienta de pruebas: Playwright 1.57.0, externa al runtime, no descargada por el HTML. No Rust/WASM, frameworks, tipografías ni peticiones externas de animación.

## 7. Ejecución y revisión

Usar el sitio de GitHub Pages existente y hacer una recarga online para recibir el shell actualizado. Para revisión local, servir la carpeta con `python -m http.server 8000`; abrir `http://localhost:8000/`. La UI puede inspeccionarse también como archivo HTML, pero los límites de `file://` y contexto seguro siguen aplicando al proveedor/GPS/PWA. La PWA no es un widget nativo; Scriptable sigue siendo separado y aquí no se modificó.

Pruebas reproducibles (fuera de la app):

```sh
python -m pip install playwright==1.57.0
# Usar Chromium instalado, o instalarlo con Playwright y ajustar CHROMIUM_PATH.
CHROMIUM_PATH=/usr/bin/chromium python tests/test_motion.py --url inline:./index.html --output regression-results.json
CHROMIUM_PATH=/usr/bin/chromium python tests/test_semantic_contracts.py
# Con servidor local accesible también admite test_motion.py --url http://localhost:8000/
```

`inline:` significa que se renderiza el HTML real mediante `page.set_content` y se sustituye fetch únicamente en el harness por respuestas meteorológicas sintéticas deterministas. No valida DNS, CORS, cache HTTP, service worker, geolocalización o instalación. Nada de esa sustitución está en el HTML de producción.

## 8. Evidencia y límites

Se observaron y corrigieron las regresiones antes de integrar el cambio: acumulación de eventos, modal sin aislamiento del fondo, modo off incompleto, ambiente permanente; además se agregó una regresión del modelo de selección obsoleto en gráfico vacío y otra del nombre de ciudad colapsado a 320 px.

Las pruebas incluyen 20 ciclos de modal, 60 interrupciones del acordeón al 0/50/95 %, 100 selecciones que conservan el path, 30 cambios de variable, 20 inversiones de tema, preferencia reducida desde inicio y durante una transición, modelo con null, búsqueda, respuesta de red tardía, error/reintento, entrada táctil emulada, cinco viewports y ausencia de WAAPI/observers. Las capturas de inicio/intermedio/final y móvil fueron inspeccionadas visualmente. Su clima es un fixture, no una observación real.

El navegador del entorno bloqueó la navegación tanto a localhost como a file:// (`ERR_BLOCKED_BY_ADMINISTRATOR`). Se trabajó con renderizado inline sin eludir esa restricción. El resultado demuestra interacción y DOM en Chromium, no conectividad real ni instalación. Una publicación exitosa en Actions tampoco equivale a una prueba física de iOS.

**Pendiente:** Safari/WebKit real y VoiceOver; iPhone físico; instalación PWA y funcionamiento offline del shell tras actualización; integración Scriptable; red real/CORS; zoom del navegador y sesiones prolongadas; medición GPU/memoria; validación completa WCAG 2.2 AA. Emulación táctil y resize no sustituyen esas pruebas. Se observaron tareas largas durante carga/layout; no se reclama 60 FPS ni ausencia universal de jank.

## 9. Referencias de diseño/implementación

W3C, Web Animations (cancelación y promesas): https://www.w3.org/TR/web-animations-1/#canceling-an-animation

WebKit, Responsive Design for Motion (CSS y matchMedia): https://webkit.org/blog/7551/responsive-design-for-motion/

W3C, WCAG 2.2 (control de movimiento y accesibilidad): https://www.w3.org/TR/WCAG22/

Estas referencias fundamentan las políticas; no son una certificación de conformidad de ATMÓS.

## 10. Resultado cuantitativo de esta ejecución

Entorno: Chromium **144.0.7559.96**, Playwright 1.57.0, Linux headless, viewport 1440×1000, datos sintéticos de 192 horas y 8 días, renderizado inline.

**32/32 comprobaciones aprobadas**, sin pageerror ni unhandled rejection registrados en las suites finales. Los fallos deliberados de `baseline.json` demuestran las cuatro regresiones originales.

| Medición | Antes | Después |
|---|---:|---:|
| Registro addEventListener de gráfico tras 20 selecciones, por evento | 1 → 21 | No se re-registra; una propiedad handler por evento |
| 30 selecciones, mediana de trabajo síncrono por click | 2.80 ms | 0.55 ms |
| 30 selecciones, percentil 95 muestral | 4.30 ms | 0.70 ms |
| RAF pendiente tras reposo | 1 | 0 |
| Tamaño `index.html`, sin comprimir | 103,771 bytes | 110,172 bytes |

Diferencia de HTML: **+6,401 bytes**; no hay dependencias de runtime nuevas. Las latencias se midieron con `performance.now()` alrededor de `.click()`, no son INP, tiempo hasta píxel ni un benchmark de iPhone. Es una comparación de la misma carga sintética, no un factor universal de aceleración. La suite mide y conserva tareas largas en JSON; no mide GPU ni memoria.
