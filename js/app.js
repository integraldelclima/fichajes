/**
 * app.js
 * Lógica de las pantallas. Regla de oro: el navegador NUNCA decide nada de
 * seguridad; solo muestra pantallas y envía datos al servidor, que valida todo.
 */
(function () {
  'use strict';

  // ═══════════ Textos (preparado para añadir otros idiomas) ═══════════
  const TEXTOS = {
    es: {
      comprobando: 'Comprobando…',
      recuperando: 'Cargando…',
      cerrando: 'Cerrando sesión…',
      hola: 'Hola, {nombre}',
      faltaCodigo: 'Escribe tu código de empleado de 6 cifras.',
      sinRed: 'No hay conexión a internet. Busca cobertura o wifi e inténtalo de nuevo.',
      tiempoAgotado: 'El servidor está tardando demasiado. Inténtalo de nuevo en unos segundos.',
      falloConexion: 'No se ha podido conectar con el servidor. Inténtalo de nuevo en unos segundos.',
      ver: 'Ver',
      ocultar: 'Ocultar'
    }
  };
  const T = TEXTOS.es;
  const LONGITUD = window.CONFIG_APP.LONGITUD_CODIGO;
  const PATRON_CODIGO = new RegExp('^\\d{' + LONGITUD + '}$');

  // ═══════════ Estado de la app en el navegador ═══════════
  const CLAVE_TOKEN = 'idc_registro_jornada_token';
  const estado = { token: null, usuario: null };

  const $ = (id) => document.getElementById(id);

  // ═══════════ Token de sesión ═══════════
  // Se guarda el token (que caduca), NUNCA el código de empleado.
  function guardarToken(token) {
    estado.token = token;
    try { localStorage.setItem(CLAVE_TOKEN, token); } catch (e) { /* modo privado: solo en memoria */ }
  }
  function leerToken() {
    try { return localStorage.getItem(CLAVE_TOKEN); } catch (e) { return null; }
  }
  function borrarToken() {
    estado.token = null;
    estado.usuario = null;
    try { localStorage.removeItem(CLAVE_TOKEN); } catch (e) { /* nada */ }
  }

  /** Traduce un error de conexión a un mensaje comprensible. */
  function mensajeConexion(error) {
    if (error && error.message === 'sin-red') return T.sinRed;
    if (error && error.message === 'tiempo-agotado') return T.tiempoAgotado;
    return T.falloConexion;
  }

  // ═══════════ Pantallas ═══════════
  function mostrarVista(idVista) {
    document.querySelectorAll('.vista').forEach(function (vista) {
      vista.hidden = vista.id !== idVista;
    });
    window.scrollTo(0, 0);
  }

  function mostrarCarga(texto) {
    $('texto-carga').textContent = texto;
    $('capa-carga').hidden = false;
  }
  function ocultarCarga() {
    $('capa-carga').hidden = true;
  }

  function mostrarErrorLogin(texto) {
    const caja = $('error-login');
    caja.textContent = texto;   // textContent: nunca interpreta HTML
    caja.hidden = false;
    $('campo-codigo').setAttribute('aria-invalid', 'true');
  }
  function limpiarErrorLogin() {
    $('error-login').hidden = true;
    $('campo-codigo').removeAttribute('aria-invalid');
  }

  function pintarInicio(usuario) {
    estado.usuario = usuario;
    $('saludo').textContent = T.hola.replace('{nombre}', usuario.nombre);
    $('nombre-completo').textContent = usuario.nombre + ' ' + usuario.apellidos;
    $('insignia-admin').hidden = !usuario.esAdmin;
    $('boton-panel').hidden = !usuario.esAdmin;
    mostrarVista('vista-inicio');
  }

  function irAlLogin(mensaje) {
    borrarToken();
    $('form-login').reset();
    limpiarErrorLogin();
    mostrarVista('vista-login');
    if (mensaje) mostrarErrorLogin(mensaje);
    $('campo-codigo').focus();
  }

  // ═══════════ Acciones ═══════════
  async function entrar(evento) {
    evento.preventDefault();
    limpiarErrorLogin();

    const codigo = $('campo-codigo').value.trim();

    // Comprobación rápida en el navegador (el servidor vuelve a comprobarlo todo)
    if (!PATRON_CODIGO.test(codigo)) {
      mostrarErrorLogin(T.faltaCodigo);
      $('campo-codigo').focus();
      return;
    }

    $('boton-entrar').disabled = true;
    mostrarCarga(T.comprobando);
    try {
      const respuesta = await Api.llamar('login', { codigo: codigo });
      if (respuesta && respuesta.ok) {
        guardarToken(respuesta.token);
        $('form-login').reset();
        pintarInicio(respuesta.usuario);
      } else {
        $('campo-codigo').value = '';
        mostrarErrorLogin((respuesta && respuesta.error) || T.falloConexion);
        $('campo-codigo').focus();
      }
    } catch (error) {
      mostrarErrorLogin(mensajeConexion(error));
    } finally {
      ocultarCarga();
      $('boton-entrar').disabled = false;
    }
  }

  async function salir() {
    const token = estado.token;
    mostrarCarga(T.cerrando);
    try {
      await Api.llamar('logout', {}, token);
    } catch (e) {
      // Aunque falle la red, la sesión se cierra en el móvil
    } finally {
      ocultarCarga();
      irAlLogin();
    }
  }

  function alternarVerCodigo() {
    const campo = $('campo-codigo');
    const boton = $('boton-ver-codigo');
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    boton.textContent = mostrar ? T.ocultar : T.ver;
    boton.setAttribute('aria-pressed', String(mostrar));
  }

  /** Al abrir la app: si hay una sesión guardada y sigue viva, entra directo. */
  async function recuperarSesion() {
    const token = leerToken();
    if (!token) { ocultarCarga(); irAlLogin(); return; }

    estado.token = token;
    mostrarCarga(T.recuperando);
    try {
      const respuesta = await Api.llamar('sesion', {}, token);
      if (respuesta && respuesta.ok) {
        pintarInicio(respuesta.usuario);
      } else {
        // Sesión caducada: login limpio. Otro problema: login con el aviso.
        irAlLogin(respuesta && !respuesta.sesionCaducada ? respuesta.error : null);
      }
    } catch (error) {
      // Sin conexión: se vuelve al login, pero el token se conserva por si vuelve la red
      mostrarVista('vista-login');
      mostrarErrorLogin(mensajeConexion(error));
    } finally {
      ocultarCarga();
    }
  }

  // ═══════════ Arranque ═══════════
  $('form-login').addEventListener('submit', entrar);
  $('boton-salir').addEventListener('click', salir);
  $('boton-ver-codigo').addEventListener('click', alternarVerCodigo);

  // El código solo admite cifras; al corregirlo, el aviso de error desaparece
  $('campo-codigo').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, LONGITUD);
    if (!$('error-login').hidden) limpiarErrorLogin();
  });

  recuperarSesion();
})();
