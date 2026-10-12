# ATMÓS — Meteorología interactiva

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

[Diagnóstico, matriz de 16 técnicas, contratos y evidencia](docs/MOTION_SEMANTICO.md). Pruebas reproducibles: `tests/test_motion.py` y `tests/test_semantic_contracts.py`. La verificación local se hizo en Chromium, con datos sintéticos; no equivale a una prueba de Safari/iPhone físico.


## Privacidad y límites

Se consulta Open-Meteo directamente desde el navegador, sin backend propio. Los datos y preferencias locales se pueden exportar; los pronósticos nuevos necesitan conexión y pueden quedar obsoletos. El widget guarda caché separado. La API gratuita es para uso no comercial. No es un sistema oficial de alerta.
