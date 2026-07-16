/* ============================================================

   ALPHA v1: AGENDA PREMIUM

   RESPONSABILIDAD:
   - Construir calendario mensual.
   - Marcar días con funciones usando 🎭.
   - Abrir drawer de día.
   - Preparar base para activaciones y Siri/iPhone.

============================================================ */

let agendaFechaActual =
    new Date();

function actualizarAgenda(eventos){

    if(!document.getElementById("agendaCalendario")){
        return;
    }

    pintarAgendaCalendario(eventos);
    pintarAgendaResumen(eventos);
    pintarAgendaProximas(eventos);
}

function pintarAgendaCalendario(eventos){

    const contenedor =
        document.getElementById("agendaCalendario");

    const titulo =
        document.getElementById("agendaTituloMes");

    if(!contenedor || !titulo){
        return;
    }

    const year =
        agendaFechaActual.getFullYear();

    const month =
        agendaFechaActual.getMonth();

    titulo.textContent =
        agendaFechaActual.toLocaleDateString("es-MX", {
            month:"long",
            year:"numeric"
        });

    const primerDiaMes =
        new Date(year, month, 1);

    const ultimoDiaMes =
        new Date(year, month + 1, 0);

    const offset =
        (primerDiaMes.getDay() + 6) % 7;

    const totalDias =
        ultimoDiaMes.getDate();

    const funcionesPorFecha =
        agruparFuncionesPorFecha(eventos);

    contenedor.innerHTML = "";

    for(let i = 0; i < offset; i++){
        contenedor.innerHTML += `
            <div class="agenda-dia agenda-dia-vacio">
                <span class="agenda-dia-numero"></span>
            </div>
        `;
    }

    for(let dia = 1; dia <= totalDias; dia++){

        const fechaISO =
            construirFechaISO(year, month, dia);

        const funciones =
            funcionesPorFecha[fechaISO] || [];

        const hoy =
            esFechaHoy(year, month, dia);

        contenedor.innerHTML += crearDiaAgenda(
            dia,
            fechaISO,
            funciones,
            hoy
        );
    }
}

function crearDiaAgenda(
    dia,
    fechaISO,
    funciones,
    hoy
){

    const visibles =
        funciones.slice(0, 3);

    const restantes =
        funciones.length - visibles.length;

    const mascaras =
        visibles.map(item => {

            const boletos =
                calcularBoletosFuncion(item.funcion);

            const tipoVisual =
                typeof obtenerTipoRegistroVisual === "function"
                ? obtenerTipoRegistroVisual(item.funcion)
                : { icono: "🎭", clase: "tipo-funcion" };

            const esFuncionBoletaje =
                (item.funcion.tipoRegistro || "funcion") === "funcion";

            const claseEstado =
                item.funcion.activa === false
                ? "pausada"
                : esFuncionBoletaje && boletos <= 0
                    ? "sin-boletos"
                    : "";

            return `
                <span
                    class="agenda-mascara ${claseEstado} ${tipoVisual.clase}"
                    title="${escaparTexto(item.evento.nombre)}">
                    ${tipoVisual.icono}
                </span>
            `;
        }).join("");

    return `
        <div
            class="agenda-dia ${hoy ? "agenda-dia-hoy" : ""}"
            onclick="abrirAgendaDia('${fechaISO}')">

            <div>
                <span class="agenda-dia-numero">${dia}</span>

                <div class="agenda-mascaras">
                    ${mascaras}

                    ${
                        restantes > 0
                        ? `<span class="agenda-mas-eventos">+${restantes}</span>`
                        : ""
                    }
                </div>
            </div>

            <div class="agenda-dia-footer">
                ${
                    funciones.length > 0
                    ? `${funciones.length}`
                    : ""
                }
            </div>
        </div>
    `;
}

// ALPHA v1.14.1: contexto de lo que muestra el drawer.
// OJO: en operativas todas las funciones comparten funcion.id=1,
// así que el identificador único real es evento.id.
let AGENDA_DRAWER_CTX = { fecha: null, eventoId: null, funcionId: null };

function abrirAgendaDia(fechaISO, eventoId, funcionId){

    let funciones =
        agruparFuncionesPorFecha(eventosActuales)[fechaISO] || [];

    // Si se pide una operación específica, mostrar solo esa
    // (por evento.id + funcion.id; con fallback al día completo).
    if(eventoId != null){
        const filtradas = funciones.filter(item =>
            Number(item.evento.id) === Number(eventoId) &&
            (funcionId == null || Number(item.funcion.id) === Number(funcionId))
        );
        if(filtradas.length){
            funciones = filtradas;
        }
    }

    if(funciones.length === 0){
        return;
    }

    AGENDA_DRAWER_CTX = {
        fecha: fechaISO,
        eventoId: (eventoId != null ? Number(eventoId) : null),
        funcionId: (funcionId != null ? Number(funcionId) : null)
    };

    const titulo =
        document.getElementById("agendaDrawerTitulo");

    const subtitulo =
        document.getElementById("agendaDrawerSubtitulo");

    const contenedor =
        document.getElementById("agendaDrawerFunciones");

    titulo.textContent =
        `🎭 ${formatearFechaAgenda(fechaISO)}`;

    subtitulo.textContent =
        (AGENDA_DRAWER_CTX.eventoId != null)
            ? (funciones[0].evento.nombre || "Operación")
            : `${funciones.length} función${funciones.length === 1 ? "" : "es"} programada${funciones.length === 1 ? "" : "s"}`;

    contenedor.innerHTML = "";

    funciones
        .sort((a, b) => String(a.funcion.hora).localeCompare(String(b.funcion.hora)))
        .forEach(item => {

            contenedor.innerHTML += crearFuncionAgendaCard(
                item.evento,
                item.funcion,
                { fecha: fechaISO, esOcurrencia: Boolean(item.ocurrencia) }
            );
        });

    inyectarPendientesAgenda(contenedor, fechaISO);

    document.body.classList.add("modal-abierto");

    document
        .getElementById("modalAgendaDia")
        .classList
        .remove("oculto");
}

function cerrarAgendaDia(){

    document
        .getElementById("modalAgendaDia")
        .classList
        .add("oculto");

    document.body.classList.remove("modal-abierto");
}

function crearFuncionAgendaCard(evento, funcion, ctx){

    const tipoVisual =
        typeof obtenerTipoRegistroVisual === "function"
        ? obtenerTipoRegistroVisual(funcion)
        : { icono: "🎭", nombre: "Función" };

    const tipoRegistro =
        funcion.tipoRegistro || "funcion";

    const esFuncion =
        tipoRegistro === "funcion";

    const estadoVisual =
        (typeof obtenerEstadoVisual === "function")
            ? obtenerEstadoVisual(funcion)
            : null;

    const estadoSelectorHTML =
        (typeof crearSelectorEstadoRegistro === "function")
            ? crearSelectorEstadoRegistro(evento, funcion)
            : "";

    // SPRINT RECURRENCIA: banner de serie + acciones protegidas.
    const rec = funcion.recurrencia;
    const tieneRecurrencia = rec && rec.tipo && rec.tipo !== "no";
    const esOcurrencia = !!(ctx && ctx.esOcurrencia);

    const serieBannerHTML = tieneRecurrencia
        ? `<div class="agenda-serie-banner ${esOcurrencia ? "es-ocurrencia" : ""}">
                📆 ${esOcurrencia
                    ? "Ocurrencia de una serie recurrente"
                    : `Operación recurrente · ${escaparTexto(etiquetaRecurrencia(rec))}`}
           </div>`
        : "";

    // En una ocurrencia NO mostramos editar/eliminar directos (protege la serie).
    // Dejamos preparada la elección de alcance (arquitectura del siguiente sprint).
    const accionesHTML = esOcurrencia
        ? `<div class="agenda-serie-editar">
               <span class="agenda-serie-editar-label">Editar:</span>
               <button class="btn-secundario btn-mini" onclick="editarSerieProximamente('sola')">Solo esta</button>
               <button class="btn-secundario btn-mini" onclick="editarSerieProximamente('serie')">Toda la serie</button>
           </div>`
        : `${
                esFuncion
                ? `<button class="btn-secundario" onclick="cerrarAgendaDia(); abrirEditarFuncion(${evento.id}, ${funcion.id})">✏️ Editar</button>
                   <button class="btn-secundario" onclick="cerrarAgendaDia(); abrirCaja(${evento.id}, ${funcion.id})">💵 Caja</button>
                   <button class="btn-secundario btn-descuentos-funcion" onclick="cerrarAgendaDia(); abrirGestionDescuentos(${evento.id}, ${funcion.id})">🎁 Descuentos</button>`
                : `<button class="btn-secundario" onclick="cerrarAgendaDia(); abrirEditarOperacion(${evento.id}, ${funcion.id})">✏️ Editar</button>`
            }
            ${
                esFuncion
                ? `<button class="btn-secundario" onclick="toggleFuncion(${evento.id}, ${funcion.id})">${funcion.activa ? "⏸️ Pausar" : "▶️ Activar"}</button>`
                : ""
            }
            <button class="btn-danger" onclick="eliminarFuncion(${evento.id}, ${funcion.id})">🗑️ Eliminar</button>`;

    let detalleHTML = "";

    if(esFuncion){
        const categorias = obtenerCategorias(funcion);

        detalleHTML += crearCategoriaAgendaMini(
            "🎫 General",
            categorias.general
        );

        if(categorias.preferente?.activa){
            detalleHTML += crearCategoriaAgendaMini(
                "🎟️ Preferente",
                categorias.preferente
            );
        }

        if(categorias.vip?.activa){
            detalleHTML += crearCategoriaAgendaMini(
                "⭐ VIP",
                categorias.vip
            );
        }

        // ALPHA v1.7: Material también para Función (no usa el detalle operativo).
        if(typeof crearMaterialRegistroAgenda === "function"){
            detalleHTML += crearMaterialRegistroAgenda(evento, funcion);
        }

        // ALPHA v1.11/v1.12: Documentos y Personas también para Función.
        if(typeof crearDocumentosRegistroAgenda === "function"){
            detalleHTML += crearDocumentosRegistroAgenda(evento, funcion);
        }
        if(typeof crearPersonasRegistroAgenda === "function"){
            detalleHTML += crearPersonasRegistroAgenda(evento, funcion);
        }
    }else{

        if(typeof crearDetalleOperativoAgenda === "function"){
            detalleHTML = crearDetalleOperativoAgenda(evento, funcion);
        }else{
            detalleHTML = `
                <div class="agenda-categoria-mini">
                    <span>${tipoVisual.icono} Tipo</span>
                    <strong>${escaparTexto(tipoVisual.nombre)}</strong>
                </div>

                ${
                    funcion.contacto
                    ? `<div class="agenda-categoria-mini"><span>👤 Contacto</span><strong>${escaparTexto(funcion.contacto)}</strong></div>`
                    : ""
                }

                ${
                    funcion.telefono
                    ? `<div class="agenda-categoria-mini"><span>📱 Teléfono</span><strong>${escaparTexto(funcion.telefono)}</strong></div>`
                    : ""
                }

                ${
                    funcion.notas
                    ? `<div class="agenda-categoria-mini"><span>📝 Notas</span><strong>${escaparTexto(funcion.notas)}</strong></div>`
                    : ""
                }
            `;
        }
    }

    const calBtnHTML =
        (typeof agregarEventoCalendario === "function")
        ? `<button class="btn-secundario btn-mini btn-cal-evento"
               onclick="agregarEventoCalendario('${encodeURIComponent(JSON.stringify({
                   eventoId: evento.id,
                   funcionId: funcion.id,
                   fecha: (ctx && ctx.fecha) || funcion.fecha,
                   hora: funcion.hora,
                   nombre: evento.nombre,
                   lugar: evento.lugar,
                   notas: funcion.notas || ""
               }))}')">📅 Agregar a mi calendario</button>`
        : "";

    return `
        <div class="agenda-funcion-card">
            <div class="agenda-funcion-top">
                <div>
                    <h3>${tipoVisual.icono} ${escaparTexto(evento.nombre)}</h3>
                    <p>📍 ${escaparTexto(evento.lugar)}</p>
                </div>

                <span class="agenda-hora">
                    ⏰ ${escaparTexto(funcion.hora)}
                </span>
            </div>

            ${serieBannerHTML}

            ${
                esFuncion
                ? `<span class="${funcion.activa ? "status-ok" : "status-off"}">
                    ${funcion.activa ? "🟢 Registro activo" : "🔴 Registro pausado"}
                </span>`
                : ""
            }

            ${
                estadoVisual
                ? `<span class="estado-badge ${estadoVisual.clase}">${estadoVisual.icono} ${estadoVisual.nombre}</span>`
                : ""
            }

            ${estadoSelectorHTML}

            <div class="agenda-categorias-mini">
                ${detalleHTML}
            </div>

            <div class="agenda-cal-fila">
                ${calBtnHTML}
            </div>

            <div class="agenda-funcion-actions">
                ${accionesHTML}
            </div>
        </div>
    `;
}

/* Inyecta los registros pendientes de subir (creados sin conexión) del día */
async function inyectarPendientesAgenda(contenedor, fechaISO){
    if(!contenedor || typeof offPendientesPorTipo !== "function"){ return; }
    let pend = [];
    try{ pend = await offPendientesPorTipo("/api/registros"); }catch(e){ return; }

    const delDia = pend.filter(p => (p.body && p.body.fecha) === fechaISO);
    if(!delDia.length){ return; }

    const html = delDia.map(p => tarjetaPendienteAgenda(p.body || {})).join("");
    contenedor.insertAdjacentHTML("afterbegin", html);
}

function tarjetaPendienteAgenda(body){
    const nombre = escaparTexto(body.nombre || "Registro");
    const lugar = escaparTexto(body.lugar || "Sin lugar");
    const hora = escaparTexto(body.hora || "");
    return `
        <div class="agenda-funcion-card pendiente-card">
            <div class="agenda-funcion-top">
                <div>
                    <h3>⏳ ${nombre}</h3>
                    <p>📍 ${lugar}</p>
                </div>
                <span class="agenda-hora">⏰ ${hora}</span>
            </div>
            <span class="pendiente-badge">⏳ Pendiente de subir</span>
            <div class="agenda-categorias-mini">
                <div class="agenda-categoria-mini">
                    <span>Estado</span>
                    <strong>Se subirá cuando haya internet</strong>
                </div>
            </div>
        </div>
    `;
}

function crearCategoriaAgendaMini(nombre, categoria){

    return `
        <div class="agenda-categoria-mini">
            <span>${nombre}</span>
            <strong>${Number(categoria?.boletos || 0)} boletos</strong>
        </div>
    `;
}

function pintarAgendaResumen(eventos){

    const funcionesMes =
        obtenerFuncionesDelMes(eventos);

    const eventosUnicos =
        new Set(funcionesMes.map(item => item.evento.id));

    const boletos =
        funcionesMes.reduce((total, item) => {
            return total + calcularBoletosFuncion(item.funcion);
        }, 0);

    actualizarAgendaTexto("agendaTotalFunciones", funcionesMes.length);
    actualizarAgendaTexto("agendaTotalEventos", eventosUnicos.size);
    actualizarAgendaTexto("agendaTotalBoletos", boletos);
}

function pintarAgendaProximas(eventos){

    const contenedor =
        document.getElementById("agendaProximasFunciones");

    if(!contenedor){
        return;
    }

    const proximas =
        obtenerFuncionesOrdenadasAgenda(eventos)
            .filter(item => item.funcion.activa !== false)
            .slice(0, 4);

    if(proximas.length === 0){
        contenedor.innerHTML = `
            <div class="empty-state">
                No hay próximas funciones.
            </div>
        `;
        return;
    }

    contenedor.innerHTML = "";

    proximas.forEach(item => {

        contenedor.innerHTML += `
            <div class="agenda-proxima-item">
                <div>
                    <strong>${escaparTexto(item.evento.nombre)}</strong>
                    <span>${formatearFechaAgenda(item.funcion.fecha)} · ${escaparTexto(item.funcion.hora)}</span>
                </div>

                <span class="agenda-proxima-icono">
                    ${
                        typeof obtenerTipoRegistroVisual === "function"
                        ? obtenerTipoRegistroVisual(item.funcion).icono
                        : "🎭"
                    }
                </span>
            </div>
        `;
    });
}

function cambiarMesAgenda(direccion){

    agendaFechaActual =
        new Date(
            agendaFechaActual.getFullYear(),
            agendaFechaActual.getMonth() + direccion,
            1
        );

    actualizarAgenda(eventosActuales);
}

function irMesActualAgenda(){

    agendaFechaActual =
        new Date();

    actualizarAgenda(eventosActuales);
}

/* ============================================================
   SPRINT RECURRENCIA: ocurrencias virtuales.
   No se crean registros nuevos: se calculan al vuelo para el
   mes visible de la agenda. El registro real es el "padre" y
   las ocurrencias lo referencian (evento + funcion).
============================================================ */

function isoLocalAgenda(fecha){
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function inicioSemanaAgenda(fecha){
    const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const offset = (d.getDay() + 6) % 7;   // lunes = inicio de semana
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
}

function etiquetaRecurrencia(rec){
    if(!rec || !rec.tipo){ return ""; }
    if(rec.tipo === "semanal"){ return "Semanal"; }
    if(rec.tipo === "mensual"){ return "Mensual"; }
    if(rec.tipo === "personalizado"){
        const n = Math.max(1, Number(rec.intervalo) || 1);
        return n === 1 ? "Cada semana" : `Cada ${n} semanas`;
    }
    return "Serie";
}

function generarOcurrenciasMesVisible(funcion){
    const rec = funcion.recurrencia;

    if(!rec || !rec.tipo || rec.tipo === "no" || !funcion.fecha){
        return [];
    }

    const year = agendaFechaActual.getFullYear();
    const month = agendaFechaActual.getMonth();
    const mesInicio = new Date(year, month, 1);
    const mesFin = new Date(year, month + 1, 0);
    mesFin.setHours(23, 59, 59, 999);

    const base = new Date(`${funcion.fecha}T00:00:00`);
    if(isNaN(base.getTime())){ return []; }

    // El mes visible es anterior a la fecha base: nada que generar.
    if(mesFin < base){ return []; }

    const fin = rec.fin || { tipo: "nunca" };
    const finFecha = (fin.tipo === "fecha" && fin.fecha)
        ? new Date(`${fin.fecha}T23:59:59`)
        : null;
    const finConteo = (fin.tipo === "conteo" && fin.conteo)
        ? Number(fin.conteo)
        : null;

    const resultado = [];
    const SAFETY = 3000;   // tope duro: nunca genera infinito

    // ---- Mensual: mismo día del mes, cada N meses ----
    if(rec.tipo === "mensual"){
        const intervalo = Math.max(1, Number(rec.intervalo) || 1);
        const diaMes = base.getDate();
        let contador = 0;

        for(let i = 0; i < SAFETY; i++){
            const cursor = new Date(base.getFullYear(), base.getMonth() + intervalo * i, diaMes);

            if(finConteo != null && contador >= finConteo){ break; }
            if(finFecha && cursor > finFecha){ break; }
            if(cursor > mesFin){ break; }

            contador++;

            if(cursor >= mesInicio && cursor >= base){
                resultado.push(isoLocalAgenda(cursor));
            }
        }
        return resultado;
    }

    // ---- Semanal / Personalizado: cada N semanas, en días marcados ----
    const intervalo = Math.max(1, Number(rec.intervalo) || 1);
    const dias = (Array.isArray(rec.dias) && rec.dias.length)
        ? rec.dias.map(Number)
        : [base.getDay()];

    const baseSemana = inicioSemanaAgenda(base);
    const cursor = new Date(base);
    let contador = 0;

    for(let i = 0; i < SAFETY; i++){
        if(finConteo != null && contador >= finConteo){ break; }
        if(finFecha && cursor > finFecha){ break; }
        if(cursor > mesFin){ break; }

        const semanas = Math.round((inicioSemanaAgenda(cursor) - baseSemana) / (7 * 86400000));
        const semanaValida = semanas >= 0 && (semanas % intervalo === 0);
        const diaValido = dias.includes(cursor.getDay());

        if(semanaValida && diaValido && cursor >= base){
            contador++;
            if(cursor >= mesInicio){
                resultado.push(isoLocalAgenda(cursor));
            }
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    return resultado;
}

// Arquitectura lista para el siguiente sprint (edición de series).
function editarSerieProximamente(scope){
    const msg = scope === "serie"
        ? "Editar toda la serie llegará en el próximo sprint 🛠️"
        : "Editar solo esta ocurrencia llegará en el próximo sprint 🛠️";
    if(typeof mostrarToast === "function"){ mostrarToast(msg, "info"); }
}

function agruparFuncionesPorFecha(eventos){

    const mapa = {};

    eventos.forEach(evento => {

        evento.funciones.forEach(funcion => {

            if(!mapa[funcion.fecha]){
                mapa[funcion.fecha] = [];
            }

            mapa[funcion.fecha].push({
                evento,
                funcion
            });

            // Ocurrencias virtuales del mes visible (solo si hay recurrencia).
            const ocurrencias = generarOcurrenciasMesVisible(funcion);

            ocurrencias.forEach(fechaOcu => {
                if(fechaOcu === funcion.fecha){ return; }   // el padre ya está

                if(!mapa[fechaOcu]){ mapa[fechaOcu] = []; }

                mapa[fechaOcu].push({
                    evento,
                    funcion,
                    ocurrencia: { fecha: fechaOcu }
                });
            });
        });
    });

    return mapa;
}

function obtenerFuncionesDelMes(eventos){

    const year =
        agendaFechaActual.getFullYear();

    const month =
        agendaFechaActual.getMonth();

    return obtenerFuncionesOrdenadasAgenda(eventos)
        .filter(item => {

            const fecha =
                new Date(`${item.funcion.fecha}T00:00:00`);

            return (
                fecha.getFullYear() === year &&
                fecha.getMonth() === month
            );
        });
}

function obtenerFuncionesOrdenadasAgenda(eventos){

    const funciones = [];

    eventos.forEach(evento => {

        evento.funciones.forEach(funcion => {

            funciones.push({
                evento,
                funcion,
                fechaOrden:
                    new Date(`${funcion.fecha}T${funcion.hora || "00:00"}`)
            });
        });
    });

    return funciones.sort((a, b) => {
        return a.fechaOrden - b.fechaOrden;
    });
}

function construirFechaISO(year, month, day){

    const mes =
        String(month + 1).padStart(2, "0");

    const dia =
        String(day).padStart(2, "0");

    return `${year}-${mes}-${dia}`;
}

function esFechaHoy(year, month, day){

    const hoy =
        new Date();

    return (
        hoy.getFullYear() === year &&
        hoy.getMonth() === month &&
        hoy.getDate() === day
    );
}

function formatearFechaAgenda(fechaISO){

    if(!fechaISO){
        return "Sin fecha";
    }

    const fecha =
        new Date(`${fechaISO}T00:00:00`);

    return fecha.toLocaleDateString("es-MX", {
        day:"2-digit",
        month:"long",
        year:"numeric"
    });
}

function actualizarAgendaTexto(id, valor){

    const elemento =
        document.getElementById(id);

    if(elemento){
        elemento.textContent = valor;
    }
}