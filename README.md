# ATMÓS Horizon 4 — Meteorología, 3D y motion semántico

App meteorológica local-first con escena WebGL2 real, parallax contenido, pronóstico de diez días, selector de 24/48 horas, detalle por variable, calidad del aire opcional, favoritas y respaldo JSON.

**Web:** https://gatdeguin.github.io/Atmos/  
**Instalación en iOS:** https://gatdeguin.github.io/Atmos/instalar.html

## Horizon

Mové el puntero, arrastrá sobre la escena o usá sus flechas de teclado para cambiar perspectiva. «Centrar vista» vuelve al origen; «3D activado» permite alternar con 2D. El texto y los controles no se inclinan. El renderer se detiene en reposo y dispone de alternativa ante pérdida de contexto.

Tocá las tarjetas de sensación, lluvia, viento, UV, humedad, rocío, presión, visibilidad, nubosidad o precipitación para abrir datos horarios, selector de día y tabla. La temperatura se explora desde cada día. No se interpolan cifras ni se convierten valores ausentes en cero.

Calidad del aire consulta CAMS mediante Open-Meteo al pulsar el botón. Muestra US AQI y PM2,5/PM10, fecha del modelo y caché exportable. No es un índice oficial argentino ni un sensor del teléfono. No se simulan radar, avisos oficiales o precipitación minuto a minuto. La escena y la luna son ilustrativas, no reconstrucciones ni efemérides.

[Diseño, pruebas, fuentes y límites de Horizon](docs/HORIZON_V4_RELEASE.md).

## Instalación en iPhone

Desde Safari: Compartir → Agregar a pantalla de inicio → Abrir como app web → Agregar.

Widgets de Scriptable: abrir [widget/ATMOS-Widget.js](widget/ATMOS-Widget.js), copiar el script en Scriptable, añadir widget y asignarlo. Parámetro opcional: `-34.6037,-58.3816|Buenos Aires`. Los widgets son independientes de la PWA y no fueron modificados en Horizon.

## Despliegue

Workflow `.github/workflows/pages.yml`. Activar GitHub Pages una sola vez en **Settings → Pages → Build and deployment → Source: GitHub Actions**. El sitio se actualiza con cada push a main.

## Movimiento y accesibilidad

Se conserva el sistema semántico: selección con resorte amortiguado, expansión reversible de días, favoritos con FLIP y foco recuperable. El botón de movimiento y `prefers-reduced-motion` desactivan movimiento CSS/JavaScript y parallax sin impedir las tareas. Hay soporte de teclado y controles de escena 2D/3D. No se declara una auditoría completa WCAG.

[Diagnóstico y matriz histórica de 16 técnicas](docs/MOTION_SEMANTICO.md).

## Verificación continua

Se conserva el workflow [Verificar motion semántico](.github/workflows/semantic.yml), con regresiones HTTP y contratos de interrupción, identidad, foco y reposo. Guarda resultados y capturas como `atmos-semantic-evidence`. La integración de Horizon ejecutó además `tests/test_horizon.py`: 53 comprobaciones entre las tres suites, tanto localmente como en [la integración verificada](https://github.com/GatDeguin/Atmos/actions/runs/38193603768).

```sh
python -m pip install playwright==1.57.0 pillow
python -m playwright install --with-deps chromium
# CHROMIUM_PATH debe apuntar al Chromium instalado; por defecto, /usr/bin/chromium.
# En Linux sin display, utilizar xvfb-run -a antes de cada comando de pruebas.
python tests/test_motion.py --url inline:index.html --output results.json
python tests/test_semantic_contracts.py
python tests/test_horizon.py
```

Consultar el resultado de cada commit en [GitHub Actions](https://github.com/GatDeguin/Atmos/actions). Pruebas y despliegue tienen estados independientes. Los datos de pruebas son sintéticos; Chromium y WebGL por software no equivalen a Safari o GPU de un iPhone físico. No se verificaron la API real, VoiceOver, Scriptable ni instalación/actualización offline en iOS.

## Privacidad y límites

Open-Meteo se consulta desde el navegador, sin backend propio. Datos locales exportables; los pronósticos nuevos necesitan conexión y pueden quedar obsoletos. La conservación del navegador no está garantizada. El widget guarda caché separado. La API gratuita es para uso no comercial. No es un sistema oficial de alerta. No hay dependencias de producción ni fuentes externas nuevas.
