/**
 * api.js
 * Comunicación con el servidor (Apps Script).
 *
 * Cada llamada envía un POST con { accion, datos, token } y recibe un JSON.
 * Detalles importantes:
 * - El cuerpo se envía como texto (text/plain). Así el navegador no hace la
 *   "consulta previa" (preflight) de CORS, que Apps Script no admite.
 * - fetch NO envía las sesiones de Google del navegador a otra web: por eso
 *   aquí no afecta el fallo de "varias cuentas" de Google.
 */
window.Api = (function () {
  'use strict';

  const config = window.CONFIG_APP;

  /** Error de red o de servidor que se puede mostrar al usuario. */
  function errorConexion(motivo) {
    const error = new Error(motivo);
    error.esConexion = true;
    return error;
  }

  /**
   * Llama a una acción del servidor.
   * @param {string} accion  Nombre de la acción (login, sesion, logout…).
   * @param {Object=} datos  Datos de la acción.
   * @param {string=} token  Token de sesión, si la acción lo necesita.
   * @return {Promise<Object>} La respuesta del servidor: { ok, ... }.
   */
  async function llamar(accion, datos, token) {
    if (!navigator.onLine) throw errorConexion('sin-red');

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), config.TIEMPO_MAX_MS);

    let respuesta;
    try {
      respuesta = await fetch(config.API_URL, {
        method: 'POST',
        body: JSON.stringify({ accion: accion, datos: datos || {}, token: token || '' }),
        redirect: 'follow',
        cache: 'no-store',
        signal: controlador.signal
      });
    } catch (e) {
      throw errorConexion(e.name === 'AbortError' ? 'tiempo-agotado' : 'fallo-red');
    } finally {
      clearTimeout(temporizador);
    }

    if (!respuesta.ok) throw errorConexion('http-' + respuesta.status);

    try {
      return await respuesta.json();
    } catch (e) {
      throw errorConexion('respuesta-no-valida');
    }
  }

  return { llamar: llamar };
})();
