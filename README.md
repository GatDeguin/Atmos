# ATMÓS 2.0 — Motion edition

Aplicación meteorológica local-first en HTML, CSS y JavaScript, sin dependencias de ejecución ni compilación. Distribución para GitHub Pages con PWA y widget independiente para Scriptable.

**Aplicación:** https://gatdeguin.github.io/Atmos/  
**Instalación y widgets:** https://gatdeguin.github.io/Atmos/instalar.html

## Capacidades

Condiciones estimadas por Open-Meteo, pronósticos horarios de 24/48 horas y siete días, búsqueda de ciudades, favoritas, Celsius/Fahrenheit, temas claro/oscuro, respaldo JSON exportable y restauración con confirmación. La fecha del modelo y la fecha de consulta se mantienen separadas. Las variables ausentes no se convierten en cero; el horizonte horario vencido no reaparece como futuro.

La escena ilustra la condición meteorológica y el ciclo día/noche. Incluye nubes, sol/luna, lluvia/nieve, transiciones de controles y trazado de gráficos. No es un radar ni una medición visual de precipitación. Ajustes → Motion graphics permite elegir Auto o Reducido; se respeta la preferencia del sistema.

## Ejecutar

No hay build. Servir la raíz mediante HTTPS o, para desarrollo:

```sh
python -m http.server 8000
```

Abrir `http://localhost:8000/`. Las consultas nuevas requieren Internet. El service worker guarda los recursos de interfaz; la aplicación conserva los pronósticos con su fecha. El almacenamiento del navegador puede borrarse: exportar respaldos.

## Archivos

- `index.html`, `app.css`: interfaz y estilos responsive.
- `model.js`: contratos, validación, fechas, conversiones y agregaciones.
- `motion.js`: animación de presentación, sin modificar datos meteorológicos.
- `app.js`: interacción, consultas, preferencias, caché e importación/exportación.
- `sw.js`, `manifest.webmanifest`, `icons/`: instalación y apertura offline.
- `instalar.html`, `widget/ATMOS-Widget.js`: instrucciones y widget iOS independiente.
- `tests/`: pruebas con datos sintéticos identificados; no se cargan en producción.

Se conservan los PNG de 180/192 px y el SVG escalable del repositorio. El manifest usa el SVG para tamaños grandes; el PNG de 180 px sigue siendo el ícono de Apple. No se incorporan fuentes externas.

## Verificar

```sh
node --test tests/*.test.cjs
python -m pip install playwright==1.57.0
python -m playwright install --with-deps chromium
python tests/browser_test.py
```

`tests/inline_test.py` ofrece además pruebas DOM sin navegación para entornos restringidos y usa `/usr/bin/chromium`; red y Storage son dobles explícitos. No reemplaza la prueba HTTP/service worker.

El workflow `Verify ATMOS` ejecuta pruebas Node y Chromium/HTTP. El workflow existente `Publicar ATMÓS en GitHub Pages` publica los cambios de `main`. Ver resultados de cada commit en [Actions](https://github.com/GatDeguin/Atmos/actions); una configuración de workflow no acredita por sí sola una ejecución aprobada.

## Límites y privacidad

La PWA no crea widgets nativos por sí sola: el script se instala separadamente en Scriptable. Los widgets son estáticos y su refresco depende de iOS. Safari/iOS físico y Scriptable requieren verificación en dispositivo.

Sin backend propio, telemetría propia ni secretos en el frontend. Buscar envía texto a la API de geocodificación; consultar envía coordenadas al proveedor meteorológico. Compartir una ubicación incluye coordenadas en la URL. GitHub y los proveedores pueden registrar solicitudes según sus políticas.

Datos atribuidos a Open-Meteo/GeoNames, CC BY 4.0. La API gratuita de Open-Meteo está destinada al uso no comercial. Los pronósticos son estimaciones de modelos, no observaciones en vivo ni alertas oficiales. Consultar el SMN en Argentina.
