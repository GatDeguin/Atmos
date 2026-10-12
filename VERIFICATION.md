# Verificación de la publicación — ATMÓS 2.0

## Comprobaciones repetidas antes de publicar

18 pruebas Node aprobadas: 13 del modelo y 5 del service worker en VM con CacheStorage/red simulados.

21 comprobaciones de interfaz y movimiento aprobadas en Chromium mediante `tests/inline_test.py`: clima renderizado; escena día/noche; transformación animada observable; unidades; gráfico, teclado y 48 horas; búsqueda y favoritas; temas; movimiento reducido; detalle diario; exportación; importación; recuperación; ausencia de excepciones; anchos 320/390/768 px; escala legible; partículas de tormenta; preferencia reducida del sistema; error inicial y horizonte vencido.

Las pruebas utilizan fechas, pronósticos y almacenamiento controlados. No prueban el estado actual del tiempo ni la conexión real a Open-Meteo.

## Verificación HTTP y de publicación

`tests/browser_test.py` comprueba navegación HTTP, persistencia del navegador y recuperación offline mediante un service worker instalado. El workflow `Verify ATMOS` lo ejecuta en GitHub Actions. Su resultado efectivo debe leerse para el commit correspondiente en Actions; no se infiere de la existencia del YAML.

Los archivos de presentación y lógica se comparan por Git blob SHA con la entrega local. Se preserva el workflow Pages existente. La actualización de la rama se hace sólo después de preparar el árbol completo, sin publicar estados intermedios con dependencias faltantes.

Adaptación de empaquetado: se reutiliza `icons/atmos-large.svg` del repositorio en lugar de agregar otro PNG de 512 px. Los PNG existentes para Apple y 192 px se conservan; manifest y precaché apuntan al SVG. No se cambia la lógica del pronóstico ni del movimiento.

## Pendiente fuera del entorno de pruebas

Safari en iPhone físico, instalación desde Compartir, ejecución del widget en Scriptable y compatibilidad exhaustiva con tecnologías de asistencia. Las pruebas de Chromium no equivalen a verificar iOS. No se declara conformidad WCAG integral ni un objetivo de FPS garantizado.

El estado de GitHub Pages debe verificarse en su ejecución de Actions, separado del resultado de las pruebas de aplicación.
