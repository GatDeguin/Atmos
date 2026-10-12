# ATMÓS 3 — Meteorología y motion semántico

App meteorológica local-first con motion graphics, clima real, gráficos de 24 horas y 7 días, favoritas y respaldo JSON.

**Web:** https://gatdeguin.github.io/Atmos/  
**Instalación en iOS:** https://gatdeguin.github.io/Atmos/instalar.html

## Instalación en iPhone

Desde Safari: Compartir → Agregar a pantalla de inicio → Abrir como app web → Agregar.

Widgets de Scriptable: abrir [widget/ATMOS-Widget.js](widget/ATMOS-Widget.js), copiar el script en Scriptable, añadir widget y asignarlo. Parámetro opcional: `-34.6037,-58.3816|Buenos Aires`. Los widgets son independientes de la PWA.

## Despliegue

Workflow `.github/workflows/pages.yml`. Activar GitHub Pages una sola vez en **Settings → Pages → Build and deployment → Source: GitHub Actions**. El sitio se actualiza con cada push a main.

## Motion graphics

Sistema semántico sin dependencias: selección con resorte críticamente amortiguado, expansión reversible de días, favoritos con FLIP, entrada acotada de iconos de búsqueda y disolución del icono de tema. Las cifras se actualizan inmediatamente y no se interpolan.

Lluvia/nieve: representación cualitativa de 3 s como máximo, hasta 48 partículas, sin bucles decorativos permanentes. Botón ✧ y `prefers-reduced-motion` desactivan movimiento CSS y JavaScript sin impedir las tareas. No se cambia el motor de datos ni los widgets.

[Diagnóstico, matriz de 16 técnicas, contratos y evidencia](docs/MOTION_SEMANTICO.md). Pruebas reproducibles: `tests/test_motion.py` y `tests/test_semantic_contracts.py`. Los datos de prueba son sintéticos; una prueba de Chromium no equivale a una prueba de Safari/iPhone físico.

## Verificación continua

El workflow [Verificar motion semántico](.github/workflows/semantic.yml) ejecuta las regresiones mediante un servidor HTTP local y los contratos de interrupción, identidad, foco, fallback y reposo de ATMÓS 3. Guarda los resultados JSON y capturas como el artefacto `atmos-semantic-evidence` en cada ejecución. No verifica la API meteorológica real ni un iPhone físico; la suite de contratos usa DOM inline y red controlada.

```sh
python -m pip install playwright==1.57.0
python -m playwright install --with-deps chromium
# CHROMIUM_PATH debe apuntar al Chromium instalado; por defecto, /usr/bin/chromium.
python tests/test_motion.py --url inline:index.html --output results.json
python tests/test_semantic_contracts.py
```

Consultar el resultado efectivo de cada commit en [GitHub Actions](https://github.com/GatDeguin/Atmos/actions). Pruebas y despliegue tienen estados independientes. Se conserva la implementación semántica y su historial; el paquete 2.0 anterior no reemplaza esta versión 3.

## Privacidad y límites

Se consulta Open-Meteo directamente desde el navegador, sin backend propio. Los datos y preferencias locales se pueden exportar; los pronósticos nuevos necesitan conexión y pueden quedar obsoletos. El widget guarda caché separado. La API gratuita es para uso no comercial. No es un sistema oficial de alerta.
