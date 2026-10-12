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

Canvas 2D (partículas decorativas según cielo, lluvia o nieve); transiciones CSS, microinteracciones, parallax y gráficas con Web Animations API. Botón ✧ para activarlas/desactivarlas. Respeta `prefers-reduced-motion`, detiene el render fuera de pantalla y limita el fondo a ~30 FPS cuando el hardware permite.

## Privacidad y límites

Se consulta Open-Meteo directamente desde el navegador, sin backend propio. Los datos y preferencias locales se pueden exportar; los pronósticos nuevos necesitan conexión y pueden quedar obsoletos. El widget guarda caché separado. La API gratuita es para uso no comercial. No es un sistema oficial de alerta.
