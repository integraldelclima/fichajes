/**
 * config.js
 * Configuración de la web. Aquí NO hay ningún secreto: esta dirección es la
 * misma URL pública /exec del servidor (Apps Script), que cualquiera puede ver.
 * Toda la seguridad está en el servidor.
 */
window.CONFIG_APP = Object.freeze({
  // URL de la implementación de Apps Script (Implementar → Gestionar implementaciones → Copiar)
  API_URL: 'https://script.google.com/macros/s/AKfycbwCzrwX-qf3X0L9iybatr6LWJaF5VkCqrAoj4nFxCXsxG7sXn7as80Xzi8GkTlxeAPMpA/exec',

  // Tiempo máximo de espera de una respuesta del servidor (milisegundos)
  TIEMPO_MAX_MS: 30000,

  // Longitud del código de empleado
  LONGITUD_CODIGO: 6,

  // Tiempo máximo para obtener la ubicación al fichar (milisegundos).
  // Pasado este tiempo se ficha igualmente, marcado como "sin ubicación".
  GPS_TIEMPO_MAX_MS: 15000,

  // Segundos que se muestra la confirmación tras fichar
  CONFIRMACION_SEG: 8,

  // Versión del aviso de protección de datos. DEBE coincidir con
  // CONFIG.AVISO_RGPD_VERSION del servidor (Config.gs). Si cambias el texto
  // del aviso en index.html, cambia la fecha aquí y en el servidor.
  AVISO_VERSION: '2026-10-27',

  // true mientras el texto del aviso no lo haya validado quien lleve protección de datos
  AVISO_BORRADOR: true
});
