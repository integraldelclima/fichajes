/**
 * app.js
 * Lógica de las pantallas. Regla de oro: el navegador NUNCA decide nada de
 * seguridad ni de horas; solo muestra lo que calcula el servidor y le envía
 * datos, que el servidor valida todos (hora, entrada/salida, horas extra…).
 * El contador en vivo de horas es solo una ayuda visual: el valor que cuenta
 * es el que guarda y calcula el servidor.
 */
(function () {
  'use strict';

  const CONFIG = window.CONFIG_APP;
  const ZONA = 'Europe/Madrid';

  // ═══════════ Textos (preparado para añadir otros idiomas) ═══════════
  const TEXTOS = {
    es: {
      comprobando: 'Comprobando…',
      recuperando: 'Cargando…',
      cerrando: 'Cerrando sesión…',
      guardando: 'Guardando…',
      cargandoSemana: 'Cargando tus fichajes…',
      buscandoUbicacion: 'Obteniendo ubicación…',
      guardandoFichaje: 'Guardando fichaje…',
      hola: 'Hola, {nombre}',
      faltaCodigo: 'Escribe tu código de empleado de 6 cifras.',
      sinRed: 'No hay conexión a internet. Busca cobertura o wifi e inténtalo de nuevo.',
      tiempoAgotado: 'El servidor está tardando demasiado. Inténtalo de nuevo en unos segundos.',
      falloConexion: 'No se ha podido conectar con el servidor. Inténtalo de nuevo en unos segundos.',
      ver: 'Ver',
      ocultar: 'Ocultar',
      fuera: 'Fuera de jornada',
      dentroDesde: 'Dentro desde las {hora}',
      dentroDesdeDia: 'Dentro desde el {fecha} · {hora}',
      olvido: 'Tienes una entrada abierta desde el {fecha} a las {hora}. Si olvidaste fichar la salida, fíchala ahora y avisa a la oficina para corregirlo.',
      ficharEntrada: 'Fichar entrada',
      ficharSalida: 'Fichar salida',
      entradaRegistrada: 'Entrada registrada',
      salidaRegistrada: 'Salida registrada',
      salidaRegistradaA: '✓ Salida registrada a las {hora}',
      infoAntes: 'Al fichar se guardará tu ubicación en ese momento. Solo entonces.',
      ubicOk: 'Ubicación guardada (precisión ±{m} m).',
      ubicDenegada: 'Fichaje guardado sin ubicación: no has dado permiso. Puedes activarlo en los ajustes del navegador.',
      ubicNoDisponible: 'Fichaje guardado sin ubicación: el móvil no ha podido obtenerla.',
      ubicTiempo: 'Fichaje guardado sin ubicación: no había señal suficiente.',
      confUbicOk: 'Ubicación: ±{m} m',
      confSinUbic: 'Sin ubicación',
      // Horas de hoy
      extraEnCurso: 'Tu horario terminó a las {fin}. Llevas {extra} de horas extra.',
      extraFaltaJornada: 'Tu horario terminó a las {fin}. Las horas extra empezarán a contar cuando completes tu jornada (te faltan {falta}).',
      sinHorarioHoy: 'Hoy no tienes horario: todo lo que trabajes cuenta como horas extra.',
      // Mis fichajes
      estaSemana: 'Esta semana',
      sinFichajes: 'Sin fichajes',
      trabajado: 'Trabajado',
      extra: 'Extra',
      extraPendiente: 'Horas extra por confirmar: {extra}',
      confirmar: 'Confirmar',
      confirmadas: 'confirmadas',
      sinUbicacion: 'sin ubicación',
      automatica: 'cierre automático',
      otroDia: 'otro día',
      faltaSalida: 'Falta la salida de este día. Avisa a la oficina para corregirlo.',
      cruzaMedianoche: 'La salida se fichó otro día. Avisa a la oficina para revisarlo.',
      cierreAuto: 'Salida puesta automáticamente: pendiente de confirmar.',
      antesDeHora: 'Antes o fuera de horario, no extra: {t}',
      pendientes: 'Tienes {n} día(s) con horas extra por confirmar.',
      // Horas extra (cuadro)
      hoy: 'hoy',
      elDia: 'el {dia}',
      deCalculadas: '(de {calc} calculadas)',
      extraSuperaMax: 'No puedes poner más de {max}.',
      extraGuardadas: 'Horas extra registradas: {t}.'
    }
  };
  const T = TEXTOS.es;
  const PATRON_CODIGO = new RegExp('^\\d{' + CONFIG.LONGITUD_CODIGO + '}$');
  const MS_MIN = 60000;

  const formatoHora = new Intl.DateTimeFormat('es-ES',
    { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: ZONA });
  const formatoFecha = new Intl.DateTimeFormat('es-ES',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });

  // ═══════════ Estado de la app en el navegador ═══════════
  const CLAVE_TOKEN = 'idc_registro_jornada_token';
  const estado = {
    token: null,
    usuario: null,
    panel: null,          // { estado, hoy, avisoPendiente, avisoVersion }
    desfaseMs: 0,         // diferencia entre el reloj del servidor y el del móvil
    relojId: null,
    confirmacionId: null,
    fichando: false,
    semana: 0,            // 0 = esta semana, -1 = la anterior…
    extra: null           // { fecha, calculadaMin, elegidaMin, despuesDeSalida }
  };

  const $ = (id) => document.getElementById(id);
  const plantilla = (texto, valores) =>
    texto.replace(/\{(\w+)\}/g, (_, clave) => (valores[clave] !== undefined ? valores[clave] : ''));
  const ahoraServidor = () => Date.now() + estado.desfaseMs;

  /** 570 → "9 h 30 min" · 45 → "45 min" · 120 → "2 h" */
  function duracion(minutos) {
    const m = Math.max(0, Math.floor(minutos));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return r + ' min';
    return r === 0 ? h + ' h' : h + ' h ' + String(r).padStart(2, '0') + ' min';
  }

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
    estado.panel = null;
    try { localStorage.removeItem(CLAVE_TOKEN); } catch (e) { /* nada */ }
  }

  /** Traduce un error de conexión a un mensaje comprensible. */
  function mensajeConexion(error) {
    if (error && error.message === 'sin-red') return T.sinRed;
    if (error && error.message === 'tiempo-agotado') return T.tiempoAgotado;
    return T.falloConexion;
  }

  // ═══════════ Pantallas y utilidades de interfaz ═══════════
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

  /** Muestra un mensaje en una caja (textContent: nunca interpreta HTML). */
  function mostrarMensaje(idCaja, texto) {
    const caja = $(idCaja);
    caja.textContent = texto || '';
    caja.hidden = !texto;
  }

  /** Crea un elemento con clase y texto (sin innerHTML, por seguridad). */
  function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function mostrarErrorLogin(texto) {
    mostrarMensaje('error-login', texto);
    $('campo-codigo').setAttribute('aria-invalid', 'true');
  }
  function limpiarErrorLogin() {
    mostrarMensaje('error-login', '');
    $('campo-codigo').removeAttribute('aria-invalid');
  }

  function irAlLogin(mensaje) {
    pararReloj();
    cerrarCapas();
    borrarToken();
    $('form-login').reset();
    limpiarErrorLogin();
    mostrarVista('vista-login');
    if (mensaje) mostrarErrorLogin(mensaje);
    $('campo-codigo').focus();
  }

  function cerrarCapas() {
    $('capa-confirmacion').hidden = true;
    $('capa-extra').hidden = true;
  }

  /**
   * Recibe la respuesta del servidor (login, sesión, fichaje…) y decide qué
   * pantalla mostrar: el aviso de protección de datos o la de fichaje.
   */
  function aplicarPanel(respuesta, mantenerVista) {
    if (respuesta.usuario) estado.usuario = respuesta.usuario;
    estado.panel = {
      estado: respuesta.estado,
      hoy: respuesta.hoy,
      avisoPendiente: respuesta.avisoPendiente,
      avisoVersion: respuesta.avisoVersion
    };
    if (respuesta.servidorAhora) {
      estado.desfaseMs = Date.parse(respuesta.servidorAhora) - Date.now();
    }

    if (estado.panel.avisoPendiente) {
      pararReloj();
      mostrarMensaje('error-aviso', '');
      $('aviso-borrador').hidden = !CONFIG.AVISO_BORRADOR;
      mostrarVista('vista-aviso');
      return;
    }
    pintarFichaje(mantenerVista);
  }

  // ═══════════ Pantalla de fichaje ═══════════
  function pintarFichaje(mantenerVista) {
    const u = estado.usuario;
    $('saludo').textContent = plantilla(T.hola, { nombre: u.nombre });
    $('insignia-admin').hidden = !u.esAdmin;
    $('boton-panel').hidden = !u.esAdmin;
    pintarEstado();
    arrancarReloj();
    if (mantenerVista && !$('vista-mis-fichajes').hidden) return;
    if ($('vista-fichaje').hidden) mostrarMensaje('error-fichaje', '');
    mostrarVista('vista-fichaje');
  }

  /** Estado ("Fuera de jornada" / "Dentro desde…") y color del botón. */
  function pintarEstado() {
    const e = estado.panel.estado;
    const caja = $('estado-jornada');
    const boton = $('boton-fichar');

    if (e.dentro) {
      caja.textContent = e.esHoy
        ? plantilla(T.dentroDesde, { hora: e.desdeHora })
        : plantilla(T.dentroDesdeDia, { fecha: e.desdeFecha.slice(0, 5), hora: e.desdeHora });
      caja.className = 'estado estado-dentro';
      boton.textContent = T.ficharSalida;
      boton.className = 'boton boton-fichar salida';
    } else {
      caja.textContent = T.fuera;
      caja.className = 'estado';
      boton.textContent = T.ficharEntrada;
      boton.className = 'boton boton-fichar entrada';
    }

    const olvido = e.dentro && !e.esHoy;
    mostrarMensaje('aviso-olvido', olvido ? plantilla(T.olvido, { fecha: e.desdeFecha, hora: e.desdeHora }) : '');
    boton.disabled = estado.fichando;
    if (!estado.fichando && !$('info-ubicacion').dataset.fijo) $('info-ubicacion').textContent = T.infoAntes;
    pintarHoy();
  }

  /**
   * Horas de hoy. Mientras el trabajador está dentro, se recalculan cada
   * segundo con la MISMA fórmula que el servidor (Horas.gs):
   *   efectivo = presencia − pausas fijas no cubiertas por huecos fichados
   *   extra    = mín(trabajado tras el fin de horario, efectivo − horas ordinarias)
   */
  function pintarHoy() {
    const h = estado.panel && estado.panel.hoy;
    if (!h) return;

    let efectivoMin = h.efectivoMin;
    let extraMin = h.extraMin;
    let faltaMin = 0;

    if (h.dentro) {
      const ahora = ahoraServidor();
      const calculado = Date.parse(h.calculadoEn);
      const transcurrido = Math.max(0, ahora - calculado);
      const presencia = h.presenciaMs + transcurrido;
      const fin = h.finIso ? Date.parse(h.finIso) : null;
      const trasFin = h.trasFinMs + (fin === null ? transcurrido : Math.max(0, ahora - Math.max(calculado, fin)));
      const pausas = h.pausas
        .filter(function (p) { return presencia > p.umbralMin * MS_MIN; })
        .reduce(function (t, p) { return t + p.min * MS_MIN; }, 0);
      const efectivo = Math.max(0, presencia - Math.max(0, pausas - h.huecosMs));
      const extra = Math.max(0, Math.min(trasFin, efectivo - h.objetivoMin * MS_MIN));
      efectivoMin = Math.floor(efectivo / MS_MIN);
      extraMin = Math.floor(extra / MS_MIN);
      faltaMin = Math.max(0, h.objetivoMin - efectivoMin);
    }

    $('hoy-trabajado').textContent = duracion(efectivoMin);
    $('fila-hoy-extra').hidden = extraMin <= 0;
    $('hoy-extra').textContent = duracion(extraMin);

    // Mensaje solo mientras está dentro y ya pasó el fin de horario (o no hay horario)
    let mensaje = '';
    if (h.dentro) {
      if (!h.finHorario) {
        mensaje = T.sinHorarioHoy;
      } else if (ahoraServidor() >= Date.parse(h.finIso)) {
        mensaje = extraMin > 0
          ? plantilla(T.extraEnCurso, { fin: h.finHorario, extra: duracion(extraMin) })
          : plantilla(T.extraFaltaJornada, { fin: h.finHorario, falta: duracion(Math.max(1, faltaMin)) });
      }
    }
    mostrarMensaje('hoy-mensaje', mensaje);
  }

  /** Reloj con la hora del SERVIDOR (corrige si el reloj del móvil va mal). */
  function arrancarReloj() {
    pararReloj();
    const tic = function () {
      const ahora = new Date(ahoraServidor());
      $('reloj').textContent = formatoHora.format(ahora);
      $('fecha-hoy').textContent = formatoFecha.format(ahora);
      if (estado.panel && estado.panel.hoy && estado.panel.hoy.dentro) pintarHoy();
    };
    tic();
    estado.relojId = setInterval(tic, 1000);
  }
  function pararReloj() {
    if (estado.relojId) clearInterval(estado.relojId);
    estado.relojId = null;
  }

  // ═══════════ Ubicación (solo al fichar) ═══════════
  /**
   * Pide la ubicación UNA vez. Nunca falla: si no se puede, devuelve el motivo.
   * @return {Promise<{estado:string, lat?:number, lon?:number, precision?:number}>}
   */
  function obtenerUbicacion() {
    return new Promise(function (resolver) {
      if (!('geolocation' in navigator)) { resolver({ estado: 'NO_DISPONIBLE' }); return; }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolver({
            estado: 'OK',
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            precision: pos.coords.accuracy
          });
        },
        function (err) {
          const motivos = { 1: 'DENEGADA', 2: 'NO_DISPONIBLE', 3: 'TIEMPO_AGOTADO' };
          resolver({ estado: motivos[err.code] || 'NO_DISPONIBLE' });
        },
        { enableHighAccuracy: true, timeout: CONFIG.GPS_TIEMPO_MAX_MS, maximumAge: 0 }
      );
    });
  }

  function textoUbicacion(estadoUbic, precision) {
    switch (estadoUbic) {
      case 'OK': return plantilla(T.ubicOk, { m: precision });
      case 'DENEGADA': return T.ubicDenegada;
      case 'TIEMPO_AGOTADO': return T.ubicTiempo;
      default: return T.ubicNoDisponible;
    }
  }

  // ═══════════ Acceso ═══════════
  async function entrar(evento) {
    evento.preventDefault();
    limpiarErrorLogin();

    const codigo = $('campo-codigo').value.trim();
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
        delete $('info-ubicacion').dataset.fijo;
        estado.semana = 0;
        aplicarPanel(respuesta);
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

  async function aceptarAviso() {
    $('boton-aceptar-aviso').disabled = true;
    mostrarCarga(T.guardando);
    try {
      const respuesta = await Api.llamar('aceptarAviso', { version: CONFIG.AVISO_VERSION }, estado.token);
      if (respuesta && respuesta.ok) {
        aplicarPanel(respuesta);
      } else if (respuesta && respuesta.sesionCaducada) {
        irAlLogin(respuesta.error);
      } else {
        mostrarMensaje('error-aviso', (respuesta && respuesta.error) || T.falloConexion);
      }
    } catch (error) {
      mostrarMensaje('error-aviso', mensajeConexion(error));
    } finally {
      ocultarCarga();
      $('boton-aceptar-aviso').disabled = false;
    }
  }

  // ═══════════ Fichar ═══════════
  async function fichar() {
    if (estado.fichando || !estado.panel) return;
    estado.fichando = true;
    $('boton-fichar').disabled = true;
    mostrarMensaje('error-fichaje', '');

    const tipo = estado.panel.estado.siguienteTipo;
    try {
      mostrarCarga(T.buscandoUbicacion);
      const ubicacion = await obtenerUbicacion();

      mostrarCarga(T.guardandoFichaje);
      const respuesta = await Api.llamar('fichar', {
        tipo: tipo,
        ubicacion: ubicacion,
        userAgent: navigator.userAgent
      }, estado.token);

      if (respuesta && respuesta.ok) {
        const f = respuesta.fichaje;
        $('info-ubicacion').textContent = textoUbicacion(f.estadoUbicacion, f.precision);
        $('info-ubicacion').dataset.fijo = '1';
        aplicarPanel(respuesta);
        // Si es una salida con horas extra, se pregunta si son correctas; si no, confirmación normal
        if (f.tipo === 'SALIDA' && respuesta.extra && respuesta.extra.preguntar) {
          abrirExtra(respuesta.extra.fecha, respuesta.extra.calculadaMin, f.hora);
        } else {
          mostrarConfirmacion(f);
        }
      } else if (respuesta && respuesta.sesionCaducada) {
        irAlLogin(respuesta.error);
      } else {
        mostrarMensaje('error-fichaje', (respuesta && respuesta.error) || T.falloConexion);
        refrescarPanel(); // por si el estado cambió en otro dispositivo
      }
    } catch (error) {
      mostrarMensaje('error-fichaje', mensajeConexion(error));
    } finally {
      ocultarCarga();
      estado.fichando = false;
      if (estado.panel) pintarEstado();
    }
  }

  function mostrarConfirmacion(fichaje) {
    const esEntrada = fichaje.tipo === 'ENTRADA';
    $('conf-icono').className = 'conf-icono' + (esEntrada ? '' : ' salida');
    $('conf-titulo').textContent = esEntrada ? T.entradaRegistrada : T.salidaRegistrada;
    $('conf-hora').textContent = fichaje.hora;
    $('conf-detalle').textContent = fichaje.estadoUbicacion === 'OK'
      ? plantilla(T.confUbicOk, { m: fichaje.precision })
      : T.confSinUbic;
    $('capa-confirmacion').hidden = false;
    $('boton-conf-ok').focus();

    if (estado.confirmacionId) clearTimeout(estado.confirmacionId);
    estado.confirmacionId = setTimeout(cerrarConfirmacion, CONFIG.CONFIRMACION_SEG * 1000);
  }
  function cerrarConfirmacion() {
    if (estado.confirmacionId) clearTimeout(estado.confirmacionId);
    estado.confirmacionId = null;
    $('capa-confirmacion').hidden = true;
  }

  // ═══════════ Horas extra: ¿es correcto? → ¿cuántas? → ¿seguro? ═══════════
  /**
   * @param {string} fecha        día 'yyyy-MM-dd'
   * @param {number} calculadaMin horas extra calculadas por el servidor
   * @param {string=} horaSalida  si viene, se acaba de fichar la salida
   */
  function abrirExtra(fecha, calculadaMin, horaSalida) {
    estado.extra = { fecha: fecha, calculadaMin: calculadaMin, elegidaMin: calculadaMin };

    const salida = $('extra-salida');
    salida.hidden = !horaSalida;
    if (horaSalida) salida.textContent = plantilla(T.salidaRegistradaA, { hora: horaSalida });

    const hoy = estado.panel && estado.panel.hoy ? estado.panel.hoy.fecha : '';
    $('extra-dia').textContent = fecha === hoy ? T.hoy
      : plantilla(T.elDia, { dia: fecha.slice(8, 10) + '/' + fecha.slice(5, 7) });
    $('extra-calculada').textContent = duracion(calculadaMin);
    pasoExtra(1);
    $('capa-extra').hidden = false;
    $('boton-extra-si').focus();
  }

  function pasoExtra(n) {
    $('extra-paso-1').hidden = n !== 1;
    $('extra-paso-2').hidden = n !== 2;
    $('extra-paso-3').hidden = n !== 3;
    mostrarMensaje('error-extra-1', '');
    mostrarMensaje('error-extra-2', '');
    mostrarMensaje('error-extra-3', '');
  }

  /** "Hice menos": selectores de horas y minutos, con el máximo calculado. */
  function extraHiceMenos() {
    const max = estado.extra.calculadaMin;
    const horas = $('extra-horas');
    const minutos = $('extra-minutos');
    horas.textContent = '';
    minutos.textContent = '';
    for (let h = 0; h <= Math.floor(max / 60); h++) horas.appendChild(new Option(String(h), String(h)));
    for (let m = 0; m < 60; m += 5) minutos.appendChild(new Option(String(m).padStart(2, '0'), String(m)));
    horas.value = '0';
    minutos.value = '0';
    $('extra-maximo').textContent = duracion(max);
    pasoExtra(2);
    horas.focus();
  }

  function extraContinuar() {
    const elegidos = Number($('extra-horas').value) * 60 + Number($('extra-minutos').value);
    if (elegidos > estado.extra.calculadaMin) {
      mostrarMensaje('error-extra-2', plantilla(T.extraSuperaMax, { max: duracion(estado.extra.calculadaMin) }));
      return;
    }
    estado.extra.elegidaMin = elegidos;
    $('extra-elegida').textContent = duracion(elegidos);
    $('extra-de-calculadas').textContent = plantilla(T.deCalculadas, { calc: duracion(estado.extra.calculadaMin) });
    pasoExtra(3);
    $('boton-extra-confirmar').focus();
  }

  /** Envía la confirmación al servidor (las calculadas o las elegidas). */
  async function extraGuardar(minutos, idError) {
    mostrarCarga(T.guardando);
    try {
      const respuesta = await Api.llamar('confirmarExtra',
        { fecha: estado.extra.fecha, minutos: minutos }, estado.token);
      if (respuesta && respuesta.ok) {
        $('capa-extra').hidden = true;
        $('info-ubicacion').textContent = plantilla(T.extraGuardadas, { t: duracion(minutos) });
        $('info-ubicacion').dataset.fijo = '1';
        await refrescarPanel(true);
        if (!$('vista-mis-fichajes').hidden) cargarSemana(estado.semana);
      } else if (respuesta && respuesta.sesionCaducada) {
        irAlLogin(respuesta.error);
      } else {
        mostrarMensaje(idError, (respuesta && respuesta.error) || T.falloConexion);
      }
    } catch (error) {
      mostrarMensaje(idError, mensajeConexion(error));
    } finally {
      ocultarCarga();
    }
  }

  // ═══════════ Mis fichajes ═══════════
  async function cargarSemana(desplazamiento) {
    mostrarMensaje('error-mis-fichajes', '');
    mostrarCarga(T.cargandoSemana);
    try {
      const respuesta = await Api.llamar('misFichajes', { semana: desplazamiento }, estado.token);
      if (respuesta && respuesta.ok) {
        estado.semana = respuesta.semana;
        pintarSemana(respuesta);
      } else if (respuesta && respuesta.sesionCaducada) {
        irAlLogin(respuesta.error);
      } else {
        mostrarMensaje('error-mis-fichajes', (respuesta && respuesta.error) || T.falloConexion);
      }
    } catch (error) {
      mostrarMensaje('error-mis-fichajes', mensajeConexion(error));
    } finally {
      ocultarCarga();
    }
  }

  function pintarSemana(r) {
    $('titulo-semana').textContent = r.semana === 0 ? T.estaSemana : r.titulo;
    $('titulo-semana').title = r.titulo;
    $('boton-semana-atras').disabled = !r.puedeIrAtras;
    $('boton-semana-adelante').disabled = !r.puedeIrAdelante;
    $('total-trabajado').textContent = duracion(r.totales.trabajadoMin);
    $('total-extra').textContent = duracion(r.totales.extraMin);
    mostrarMensaje('total-pendientes', r.totales.extraPendientes > 0
      ? plantilla(T.pendientes, { n: r.totales.extraPendientes }) : '');

    const lista = $('lista-dias');
    lista.textContent = '';
    r.dias.filter(function (d) { return !d.futuro; }).reverse().forEach(function (d) {
      lista.appendChild(tarjetaDia(d));
    });
  }

  /** Tarjeta de un día (construida con elementos, nunca con innerHTML). */
  function tarjetaDia(d) {
    const vacio = d.tramos.length === 0;
    const tarjeta = crear('article', 'dia' + (d.esHoy ? ' dia-hoy' : '') + (vacio ? ' dia-vacio' : ''));

    const cabecera = crear('div', 'dia-cabecera');
    cabecera.appendChild(crear('h2', 'dia-nombre', d.etiqueta + (d.esHoy ? ' · hoy' : '')));
    cabecera.appendChild(crear('span', 'dia-horario', d.horario || 'Sin horario'));
    tarjeta.appendChild(cabecera);

    if (vacio) {
      tarjeta.appendChild(crear('p', 'dia-horario', T.sinFichajes));
      return tarjeta;
    }

    const tramos = crear('ul', 'dia-tramos');
    d.tramos.forEach(function (t) {
      const li = crear('li', '', t.entrada + ' → ' + (t.salida || '…'));
      if (t.entradaSinUbicacion || t.salidaSinUbicacion) li.appendChild(crear('span', 'marca', T.sinUbicacion));
      if (t.salidaAutomatica) li.appendChild(crear('span', 'marca marca-auto', T.automatica));
      if (t.salidaOtroDia) li.appendChild(crear('span', 'marca marca-auto', T.otroDia));
      tramos.appendChild(li);
    });
    tarjeta.appendChild(tramos);

    const numeros = crear('div', 'dia-numeros');
    const dato = function (etiqueta, valor) {
      const s = crear('span', '', etiqueta + ' ');
      s.appendChild(crear('strong', '', valor));
      return s;
    };
    numeros.appendChild(dato(T.trabajado, duracion(d.efectivoMin)));
    if (d.extraMin > 0 || d.estadoExtra === 'CONFIRMADA') {
      numeros.appendChild(dato(T.extra, duracion(d.extraMin) +
        (d.estadoExtra === 'CONFIRMADA' ? ' · ' + T.confirmadas : '')));
    }
    tarjeta.appendChild(numeros);

    if (d.excesoNoExtraMin > 0) {
      tarjeta.appendChild(crear('p', 'dia-horario', plantilla(T.antesDeHora, { t: duracion(d.excesoNoExtraMin) })));
    }
    if (d.incidencia === 'SALIDA_NO_FICHADA') tarjeta.appendChild(crear('p', 'dia-aviso', T.faltaSalida));
    if (d.incidencia === 'CRUZA_MEDIANOCHE') tarjeta.appendChild(crear('p', 'dia-aviso', T.cruzaMedianoche));
    if (d.automatico) tarjeta.appendChild(crear('p', 'dia-aviso', T.cierreAuto));

    if (d.estadoExtra === 'PENDIENTE') {
      const fila = crear('div', 'dia-extra-pendiente');
      fila.appendChild(crear('span', '', plantilla(T.extraPendiente, { extra: duracion(d.extraCalculadaMin) })));
      const boton = crear('button', 'boton-pequeno', T.confirmar);
      boton.type = 'button';
      boton.addEventListener('click', function () { abrirExtra(d.fecha, d.extraCalculadaMin); });
      fila.appendChild(boton);
      tarjeta.appendChild(fila);
    }
    return tarjeta;
  }

  function irAPestana(idVista) {
    if (idVista === 'vista-mis-fichajes') {
      mostrarVista('vista-mis-fichajes');
      cargarSemana(estado.semana);
    } else {
      mostrarVista('vista-fichaje');
      refrescarPanel();
    }
  }

  // ═══════════ Sesión ═══════════
  /** Pide al servidor el estado actual sin molestar al usuario. */
  async function refrescarPanel(mantenerVista) {
    if (!estado.token) return;
    try {
      const respuesta = await Api.llamar('sesion', {}, estado.token);
      if (respuesta && respuesta.ok) {
        aplicarPanel(respuesta, mantenerVista !== false);
      } else if (respuesta && respuesta.sesionCaducada) {
        irAlLogin(respuesta.error);
      }
    } catch (e) { /* sin red: se mantiene lo que hay en pantalla */ }
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
        aplicarPanel(respuesta);
      } else {
        irAlLogin(respuesta && !respuesta.sesionCaducada ? respuesta.error : null);
      }
    } catch (error) {
      // Sin conexión: se muestra el acceso, pero el token se conserva por si vuelve la red
      mostrarVista('vista-login');
      mostrarErrorLogin(mensajeConexion(error));
    } finally {
      ocultarCarga();
    }
  }

  // ═══════════ Arranque ═══════════
  $('form-login').addEventListener('submit', entrar);
  $('boton-ver-codigo').addEventListener('click', alternarVerCodigo);
  $('boton-aceptar-aviso').addEventListener('click', aceptarAviso);
  $('boton-salir-aviso').addEventListener('click', salir);
  document.querySelectorAll('.boton-salir').forEach(function (b) { b.addEventListener('click', salir); });
  document.querySelectorAll('.pestana').forEach(function (b) {
    b.addEventListener('click', function () { irAPestana(b.dataset.ir); });
  });
  $('boton-fichar').addEventListener('click', fichar);
  $('boton-conf-ok').addEventListener('click', cerrarConfirmacion);

  $('boton-semana-atras').addEventListener('click', function () { cargarSemana(estado.semana - 1); });
  $('boton-semana-adelante').addEventListener('click', function () { cargarSemana(estado.semana + 1); });

  $('boton-extra-si').addEventListener('click', function () { extraGuardar(estado.extra.calculadaMin, 'error-extra-1'); });
  $('boton-extra-menos').addEventListener('click', extraHiceMenos);
  $('boton-extra-luego').addEventListener('click', function () { $('capa-extra').hidden = true; });
  $('boton-extra-continuar').addEventListener('click', extraContinuar);
  $('boton-extra-volver-1').addEventListener('click', function () { pasoExtra(1); });
  $('boton-extra-volver-2').addEventListener('click', function () { pasoExtra(2); });
  $('boton-extra-confirmar').addEventListener('click', function () { extraGuardar(estado.extra.elegidaMin, 'error-extra-3'); });

  // El código solo admite cifras; al corregirlo, el aviso de error desaparece
  $('campo-codigo').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, CONFIG.LONGITUD_CODIGO);
    if (!$('error-login').hidden) limpiarErrorLogin();
  });

  // Al volver a la app (p. ej. al día siguiente), se actualiza el estado y la hora
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && estado.token && !estado.fichando) {
      if (!$('vista-mis-fichajes').hidden) cargarSemana(estado.semana);
      else refrescarPanel();
    }
  });

  recuperarSesion();
})();
