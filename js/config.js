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
  LONGITUD_CODIGO: 6
});
