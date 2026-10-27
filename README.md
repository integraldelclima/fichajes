# Registro de Jornada – Integral del Clima, S.L. (pantallas)

Pantallas de la app de fichajes. Se publican gratis con **GitHub Pages**.

El **servidor** (Apps Script + Google Sheets) está en otro proyecto, privado.
Este repositorio es público y **no contiene ningún secreto**: solo HTML, CSS,
JavaScript e imágenes. Toda la seguridad está en el servidor.

## Cómo funciona
```
Móvil del trabajador ──(fetch POST, JSON)──▶ Apps Script /exec ──▶ Google Sheets
     (esta web)                                (servidor privado)
```
Las pantallas no se sirven desde script.google.com para evitar el fallo de
Google con varias cuentas iniciadas en el navegador ("No se puede abrir el archivo").

## Archivos
| Archivo                 | Para qué sirve                                         |
|-------------------------|--------------------------------------------------------|
| `index.html`            | Estructura de las pantallas                            |
| `css/app.css`           | Estilos (colores corporativos al principio)            |
| `js/config.js`          | Dirección del servidor (`API_URL`)                     |
| `js/api.js`             | Comunicación con el servidor                           |
| `js/app.js`             | Lógica de las pantallas                                |
| `manifest.webmanifest`  | Permite instalar la app en la pantalla de inicio       |
| `img/`                  | Logo e iconos                                          |

## Pantallas
- **Acceso**: código de empleado de 6 cifras.
- **Aviso de protección de datos**: solo antes del primer fichaje (o si cambia el texto).
- **Fichar**: reloj, estado, botón entrada/salida, ubicación y tarjeta "Hoy"
  (trabajado y horas extra en tiempo real).
- **Mis fichajes**: semana a semana, con totales y días con horas extra por confirmar.
- **Confirmación de horas extra**: al fichar la salida, o después desde Mis fichajes.

Los cálculos los hace siempre el servidor. La pantalla solo adelanta el contador
de "Hoy" entre una consulta y otra, usando la hora del servidor.

## Publicar un cambio
```
git add .
git commit -m "Descripción del cambio"
git push
```
GitHub Pages actualiza la web en 1-2 minutos.

## Aviso de protección de datos
El texto está en `index.html` (vista `vista-aviso`). Si se cambia:
1. Cambiar la fecha `AVISO_VERSION` en `js/config.js`.
2. Cambiar la misma fecha en el servidor (`AVISO_RGPD_VERSION` en `Config.gs`) y publicar nueva versión.
3. Cuando lo valide quien lleve protección de datos, poner `AVISO_BORRADOR: false`.

## Normas
- Nunca poner aquí datos personales, códigos de empleado ni secretos.
- No publicar otras webs con esta misma cuenta de GitHub: comparten dirección
  (`usuario.github.io`) y podrían leer el almacenamiento del navegador de esta app.
