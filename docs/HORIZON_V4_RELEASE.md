# ATMÓS Horizon 4

## Funcionalidad

Nueva UI responsive con jerarquía de ciudad, temperatura y fecha del modelo. Escena meteorológica 3D real con geometría indexada, normales, iluminación, profundidad y cámara de perspectiva en WebGL2, sin librerías de producción. Parallax con puntero, arrastre, flechas y desplazamiento suave; botón para centrar y modo 2D. La escena es ilustrativa: no es radar ni reconstrucción de nubes; la luna no representa una efeméride.

Pronóstico de diez días y selector de 24/48 horas. Diez tarjetas abren un detalle horario con selección de día, cursor, extremos y tabla. Se incorporan punto de rocío y series de presión y nubosidad. Las medidas ausentes no se convierten en cero y las horas vencidas no se etiquetan como futuras.

Calidad del aire opcional: datos CAMS a través de Open-Meteo, US AQI, PM2,5 y PM10. No es un índice oficial argentino ni una medición del teléfono. Caché independiente y exportable, fechas explícitas, reintento y plazo máximo de espera. Se conservan favoritos, respaldo JSON, temas, unidades, PWA e instalación existente. Scriptable no fue modificado.

## Referencia de diseño

Se consultó la documentación oficial de Clima de iOS, no la app nativa en un iPhone físico. Se tomaron como referencia diez días, detalle por variable, tarjetas y calidad del aire. No se incorporaron mapas, radar, avisos oficiales, precipitación minuto a minuto ni promedios históricos sin una integración real.

- https://support.apple.com/guide/iphone/check-the-weather-iph1ac0b35f/ios
- https://support.apple.com/en-us/105038
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/air-quality-api

## Controles y degradación

Sólo la escena responde al parallax; texto y controles mantienen su posición. Movimiento reducido desactiva la cámara móvil y conserva la lectura. El renderer termina al asentarse, se pausa fuera de pantalla y libera recursos al reemplazarse. Pérdida de contexto: vista 2D con posibilidad de reintento. No requiere cámara ni sensores.

## Verificación

53 comprobaciones locales aprobadas: 5 regresiones, 27 contratos semánticos y 21 de Horizon. Chromium 144.0.7559.96, Playwright 1.57.0, Linux headless/Xvfb, WebGL2 por software y respuestas meteorológicas sintéticas. Se verificaron veinte ciclos de detalle, foco, cambio 24/48, valores ausentes, respaldo de aire, fecha importada inválida, pérdida/recuperación real de contexto y cambio efectivo de píxeles al variar la perspectiva. Anchos: 320, 390, 768 y 1440 px. Reposo sin RAF huérfanos.

La integración y las tres suites también finalizaron correctamente en GitHub Actions: https://github.com/GatDeguin/Atmos/actions/runs/38193603768

Comprobación de integridad de los archivos probados, mediante Git blob SHA-1:

- index.html: c503b1268a598c436a3a5d7c66637543320f3dbe
- horizon.js: f39de0b5b7307431578e66074244addffc55f33d
- horizon.css: 09d0e7c07fff3e3429952bb78a18f782eca16677
- sw.js: 8a2d2d82e3de6313c466829c9d131d1653c19962

No se verificó localmente la API real, Safari/WebKit, VoiceOver, iPhone físico, Scriptable ni instalación y actualización offline PWA. La navegación local HTTP fue bloqueada; se utilizó HTML inline. Los resultados de CI no equivalen a una prueba en iPhone. Se observaron tareas largas; no se garantizan 60 FPS. Los tiempos de envío de comandos son de CPU, no mediciones GPU.

## Ejecución

Servir la carpeta por HTTPS o con `python -m http.server 8000`. Todos los recursos visuales están incluidos; las consultas nuevas requieren Internet. Los recursos de Horizon están incorporados al precache del service worker, cuya versión fue renovada. El navegador puede eliminar los datos locales: conservar respaldos exportados.

Pruebas: instalar `playwright==1.57.0`, Pillow y Chromium, indicar `CHROMIUM_PATH` si corresponde y ejecutar bajo `xvfb-run -a`:

```sh
python tests/test_motion.py --url "inline:$PWD/index.html" --output test-results/regressions.json
python tests/test_semantic_contracts.py
python tests/test_horizon.py
```

`upgrade_horizon.py` es una integración reproducible y legible; rechaza un HTML de origen diferente. No utiliza red, credenciales, descargas ejecutables ni payloads comprimidos. Los cambios concurrentes previos de README y CI se conservaron.
