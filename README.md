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

## Publicar un cambio
```
git add .
git commit -m "Descripción del cambio"
git push
```
GitHub Pages actualiza la web en 1-2 minutos.

## Normas
- Nunca poner aquí datos personales, códigos de empleado ni secretos.
- No publicar otras webs con esta misma cuenta de GitHub: comparten dirección
  (`usuario.github.io`) y podrían leer el almacenamiento del navegador de esta app.
