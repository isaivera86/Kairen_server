/* ============================================================

   MODULO: EVENTOS PRO - RC-2

   RESPONSABILIDAD:
   - Cargar eventos desde backend.
   - Actualizar KPIs del Dashboard.
   - Actualizar Dashboard Ejecutivo.
   - Pintar módulo Eventos en vista tarjetas o tabla.
   - Filtrar, ordenar y administrar eventos.

   NO DEBE CONTENER:
   - Lógica interna de configuración.
   - Lógica de ventas.
   - Lógica visual del Dashboard, salvo llamar a actualizarDashboardEjecutivo().

============================================================ */


/* ============================================================
   FILTRO POR TIPO (funciones, activaciones, ensayos, etc.)
============================================================ */
const TIPO_ETIQUETAS = {
    funcion:       "🎭 Funciones",
    activacion:    "📍 Activaciones",
    clase:         "🎓 Clases",
    ensayo:        "🎤 Ensayos",
    grabacion:     "🎬 Grabaciones",
    especial:      "🎪 Especiales",
    traslado:      "🚚 Traslados",
    mantenimiento: "🛠️ Mantenimiento"
};

function etiquetaTipo(tipo){
    if(TIPO_ETIQUETAS[tipo]){ return TIPO_ETIQUETAS[tipo]; }
    return "📌 " + tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

function poblarFiltroTipos(eventos){
    const sel = document.getElementById("filtroTipoEventos");
    if(!sel){ return; }

    const valorActual = sel.value || "funcion";

    const tipos = new Set();
    (eventos || []).forEach(ev => tipos.add(ev.tipoRegistro || "funcion"));

    const lista = Array.from(tipos).sort((a, b) => {
        if(a === "funcion"){ return -1; }
        if(b === "funcion"){ return 1; }
        return a.localeCompare(b);
    });

    let html = "";
    lista.forEach(t => {
        html += `<option value="${t}">${etiquetaTipo(t)}</option>`;
    });
    html += `<option value="todos">📋 Todos los tipos</option>`;
    sel.innerHTML = html;

    if(Array.from(sel.options).some(o => o.value === valorActual)){
        sel.value = valorActual;
    }
}


/* ============================================================
   CARGAR EVENTOS

   Esta es la función principal del módulo.
   Se llama al iniciar la app, al buscar, al filtrar y después
   de crear/editar/eliminar eventos o funciones.
============================================================ */
async function cargarEventos(){

    let eventos;

    try{
        const respuesta =
            await fetch(`${API_URL}/api/eventos`);

        if(!respuesta.ok){ throw new Error("respuesta no ok"); }

        eventos = await respuesta.json();

        // Guarda copia local (IndexedDB) para verlos sin internet
        if(typeof offCacheGuardar === "function"){
            try{ await offCacheGuardar("eventos", eventos); }catch(e){}
        }

    }catch(e){
        // Sin conexión: usa la última copia guardada
        eventos = [];
        if(typeof offCacheLeer === "function"){
            try{
                const guardado = await offCacheLeer("eventos");
                if(Array.isArray(guardado)){ eventos = guardado; }
            }catch(err){ eventos = []; }
        }

        if(typeof mostrarToast === "function"){
            mostrarToast("Sin conexión: mostrando lo último guardado", "warning");
        }
    }

    eventosActuales =
        eventos;

    poblarFiltroTipos(eventos);

    const metricas =
        calcularMetricasEventos(eventos);

    actualizarKPIsGlobales(metricas);

    if(typeof actualizarDashboardEjecutivo === "function"){
        actualizarDashboardEjecutivo(eventos);
    }

    if(typeof actualizarAgenda === "function"){
        actualizarAgenda(eventos);
    }

    pintarEventosPro(
        aplicarFiltrosEventos(eventos)
    );
}


/* ============================================================
   CALCULAR METRICAS GENERALES

   Devuelve datos usados por Dashboard y Eventos Pro.
============================================================ */
function calcularMetricasEventos(eventos){

    let totalFunciones = 0;
    let totalBoletos = 0;
    let eventosActivos = 0;

    eventos.forEach(evento => {

        if(evento.activo !== false){
            eventosActivos++;
        }

        evento.funciones.forEach(funcion => {
            totalFunciones++;
            totalBoletos += calcularBoletosFuncion(funcion);
        });
    });

    return {
        totalEventos:eventos.length,
        eventosActivos,
        totalFunciones,
        totalBoletos
    };
}


/* ============================================================
   ACTUALIZAR KPIs

   Actualiza números del Dashboard y resumen del módulo Eventos.
============================================================ */
function actualizarKPIsGlobales(metricas){

    actualizarTextoSeguro("totalEventos", metricas.totalEventos);
    actualizarTextoSeguro("totalFunciones", metricas.totalFunciones);
    actualizarTextoSeguro("totalBoletos", metricas.totalBoletos);

    actualizarTextoSeguro("eventosProTotal", metricas.totalEventos);
    actualizarTextoSeguro("eventosProActivos", metricas.eventosActivos);
    actualizarTextoSeguro("eventosProFunciones", metricas.totalFunciones);
    actualizarTextoSeguro("eventosProBoletos", metricas.totalBoletos);
}


/* ============================================================
   FILTROS Y ORDEN

   Usa:
   - buscadorEventos
   - filtroEstadoEventos
   - ordenEventos
============================================================ */
function aplicarFiltrosEventos(eventos){

    const textoBusqueda =
        document
            .getElementById("buscadorEventos")
            ?.value
            ?.toLowerCase() || "";

    const filtroEstado =
        document
            .getElementById("filtroEstadoEventos")
            ?.value || "todos";

    const orden =
        document
            .getElementById("ordenEventos")
            ?.value || "recientes";

    const filtroTipo =
        document
            .getElementById("filtroTipoEventos")
            ?.value || "funcion";

    let resultado =
        eventos.filter(evento => {

            const tipoEv = evento.tipoRegistro || "funcion";

            // Filtro por tipo: "todos" muestra todo; si no, solo ese tipo.
            const coincideTipo =
                filtroTipo === "todos" || tipoEv === filtroTipo;

            const coincideTexto =
                evento.nombre
                    .toLowerCase()
                    .includes(textoBusqueda) ||
                String(evento.lugar || "")
                    .toLowerCase()
                    .includes(textoBusqueda);

            const coincideEstado =
                filtroEstado === "todos" ||
                (
                    filtroEstado === "activos" &&
                    evento.activo !== false
                ) ||
                (
                    filtroEstado === "inactivos" &&
                    evento.activo === false
                );

            return coincideTipo && coincideTexto && coincideEstado;
        });

    resultado =
        ordenarEventos(resultado, orden);

    return resultado;
}


function ordenarEventos(eventos, orden){

    const copia =
        [...eventos];

    if(orden === "nombre"){
        return copia.sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
        );
    }

    if(orden === "funciones"){
        return copia.sort((a, b) =>
            b.funciones.length - a.funciones.length
        );
    }

    if(orden === "boletos"){
        return copia.sort((a, b) =>
            calcularBoletosEvento(b) - calcularBoletosEvento(a)
        );
    }

    return copia.sort((a, b) =>
        Number(b.id || 0) - Number(a.id || 0)
    );
}


/* ============================================================
   CAMBIAR VISTA

   Alterna entre tarjetas y tabla sin tocar backend.
============================================================ */
function cambiarVistaEventos(vista){

    vistaEventosActual =
        vista;

    const btnTarjetas =
        document.getElementById("btnVistaTarjetas");

    const btnTabla =
        document.getElementById("btnVistaTabla");

    if(btnTarjetas && btnTabla){
        btnTarjetas.classList.toggle(
            "vista-activa",
            vista === "tarjetas"
        );

        btnTabla.classList.toggle(
            "vista-activa",
            vista === "tabla"
        );
    }

    pintarEventosPro(
        aplicarFiltrosEventos(eventosActuales)
    );
}


/* ============================================================
   PINTAR EVENTOS PRO

   Decide si mostrar tarjetas o tabla.
============================================================ */
function pintarEventosPro(eventos){

    const contenedor =
        document.getElementById("listaEventos");

    if(!contenedor){
        return;
    }

    if(eventos.length === 0){
        contenedor.innerHTML = `
            <div class="empty-state">
                No hay eventos que coincidan con los filtros.
            </div>
        `;
        inyectarPendientesEventos();
        return;
    }

    if(vistaEventosActual === "tabla"){
        pintarEventosTabla(eventos, contenedor);
        inyectarPendientesEventos();
        return;
    }

    pintarEventosTarjetas(eventos, contenedor);
    inyectarPendientesEventos();
}


/* Pinta arriba de la lista los eventos creados sin conexión (pendientes) */
async function inyectarPendientesEventos(){
    const cont = document.getElementById("listaEventos");
    if(!cont || typeof offPendientesPorTipo !== "function"){ return; }

    let pend = [];
    try{ pend = await offPendientesPorTipo("/api/eventos"); }catch(e){ return; }
    if(!pend.length){ return; }

    const tarjetas = pend
        .map(p => tarjetaPendienteEvento(p.body || {}))
        .join("");

    let grid = cont.querySelector(".eventos-grid-pro");
    if(!grid){
        // Había empty-state o vista tabla: creamos el grid
        cont.innerHTML = `<div class="eventos-grid-pro"></div>`;
        grid = cont.querySelector(".eventos-grid-pro");
    }
    grid.insertAdjacentHTML("afterbegin", tarjetas);
}

function tarjetaPendienteEvento(body){
    const nombre = escaparTexto(body.nombre || "Evento sin nombre");
    const lugar = escaparTexto(body.lugar || "Sin lugar");
    return `
        <article class="evento-card-pro pendiente-card">
            <div class="evento-card-pro-placeholder">⏳</div>
            <div class="evento-card-pro-body">
                <div class="evento-card-pro-top">
                    <div>
                        <h3>${nombre}</h3>
                        <p class="evento-card-pro-meta">📍 ${lugar}</p>
                    </div>
                    <span class="pendiente-badge">⏳ Pendiente</span>
                </div>
                <div class="evento-pro-proxima">
                    Se subirá cuando haya internet.
                </div>
            </div>
        </article>
    `;
}


/* ============================================================
   VISTA TARJETAS
============================================================ */
function pintarEventosTarjetas(eventos, contenedor){

    contenedor.innerHTML = `
        <div class="eventos-grid-pro">
            ${eventos.map(evento => crearTarjetaEventoPro(evento)).join("")}
        </div>
    `;
}


function crearTarjetaEventoPro(evento){

    const esBoletaje =
        (evento.tipoRegistro || "funcion") === "funcion";

    const totalFunciones =
        evento.funciones.length;

    const boletos =
        calcularBoletosEvento(evento);

    const descuentos =
        calcularDescuentosEvento(evento);

    const proximaFuncion =
        obtenerProximaFuncionEvento(evento);

    const statsHTML = esBoletaje
        ? `
            <div class="evento-pro-stat">
                <strong>${totalFunciones}</strong>
                <span>Funciones</span>
            </div>
            <div class="evento-pro-stat">
                <strong>${boletos}</strong>
                <span>Boletos</span>
            </div>
            <div class="evento-pro-stat">
                <strong>${descuentos}</strong>
                <span>Descuentos</span>
            </div>
        `
        : `
            <div class="evento-pro-stat">
                <strong>${totalFunciones}</strong>
                <span>Fechas</span>
            </div>
            <div class="evento-pro-stat">
                <strong>${etiquetaTipo(evento.tipoRegistro || "funcion").replace(/^[^\s]+\s/, "")}</strong>
                <span>Tipo</span>
            </div>
        `;

    return `
        <article class="evento-card-pro">

            ${
                evento.imagen
                ? `<img class="evento-card-pro-imagen" src="${escaparTexto(evento.imagen)}" alt="${escaparTexto(evento.nombre)}">`
                : `<div class="evento-card-pro-placeholder">Sin imagen</div>`
            }

            <div class="evento-card-pro-body">

                <div class="evento-card-pro-top">
                    <div>
                        <h3>${escaparTexto(evento.nombre)}</h3>
                        <p class="evento-card-pro-meta">
                            📍 ${escaparTexto(evento.lugar)}
                        </p>
                    </div>

                    <span class="${evento.activo ? "status-ok" : "status-off"}">
                        ${evento.activo ? "🟢 Activo" : "🔴 Inactivo"}
                    </span>
                </div>

                <div class="evento-pro-stats">
                    ${statsHTML}
                </div>

                <div class="evento-pro-proxima">
                    ${
                        proximaFuncion
                        ? `📅 Próxima: ${formatearFechaEvento(proximaFuncion.fecha)} · ${escaparTexto(proximaFuncion.hora)}`
                        : "📅 Sin próximas fechas"
                    }
                </div>

                <div class="evento-pro-acciones">
                    <button
                        class="btn-secundario"
                        onclick="abrirModalFuncion(${evento.id})">
                        ➕ ${esBoletaje ? "Función" : "Fecha"}
                    </button>

                    <button
                        class="btn-danger"
                        onclick="cambiarEstadoEvento(${evento.id})">
                        ${evento.activo ? "⏸️ Pausar" : "▶️ Activar"}
                    </button>

                    <button
                        class="btn-danger"
                        onclick="eliminarEvento(${evento.id})">
                        🗑️ Eliminar
                    </button>
                </div>

                <div class="funciones-lista">
                    ${crearFuncionesHTML(evento)}
                </div>

            </div>

        </article>
    `;
}


/* ============================================================
   VISTA TABLA
============================================================ */
function pintarEventosTabla(eventos, contenedor){

    contenedor.innerHTML = `
        <div class="eventos-tabla-wrapper">
            <table class="eventos-tabla">
                <thead>
                    <tr>
                        <th>Evento</th>
                        <th>Estado</th>
                        <th>Funciones</th>
                        <th>Boletos</th>
                        <th>Próxima función</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>

                <tbody>
                    ${eventos.map(evento => crearFilaEventoTabla(evento)).join("")}
                </tbody>
            </table>
        </div>
    `;
}


function crearFilaEventoTabla(evento){

    const proximaFuncion =
        obtenerProximaFuncionEvento(evento);

    return `
        <tr>
            <td class="evento-tabla-nombre">
                <strong>${escaparTexto(evento.nombre)}</strong>
                <small>📍 ${escaparTexto(evento.lugar)}</small>
            </td>

            <td>
                <span class="${evento.activo ? "status-ok" : "status-off"}">
                    ${evento.activo ? "🟢 Activo" : "🔴 Inactivo"}
                </span>
            </td>

            <td>${evento.funciones.length}</td>

            <td>${calcularBoletosEvento(evento)}</td>

            <td>
                ${
                    proximaFuncion
                    ? `${formatearFechaEvento(proximaFuncion.fecha)} · ${escaparTexto(proximaFuncion.hora)}`
                    : "Sin función"
                }
            </td>

            <td>
                <div class="evento-tabla-acciones">
                    <button
                        class="btn-secundario btn-icon"
                        title="Editar"
                        onclick="abrirEditarFuncion(${evento.id}, ${evento.funciones[0] ? evento.funciones[0].id : 0})">
                        ✏️
                    </button>

                    <button
                        class="btn-secundario btn-icon"
                        title="Agregar función"
                        onclick="abrirModalFuncion(${evento.id})">
                        ➕
                    </button>

                    <button
                        class="btn-danger btn-icon"
                        title="Pausar / activar"
                        onclick="cambiarEstadoEvento(${evento.id})">
                        ${evento.activo ? "⏸️" : "▶️"}
                    </button>

                    <button
                        class="btn-danger btn-icon"
                        title="Eliminar"
                        onclick="eliminarEvento(${evento.id})">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `;
}


/* ============================================================
   FUNCIONES DENTRO DE EVENTO

   Conserva la lógica anterior, pero la encapsula.
============================================================ */
function crearFuncionesHTML(evento){

    let funcionesHTML = "";

    const esBoletaje =
        (evento.tipoRegistro || "funcion") === "funcion";

    evento.funciones.forEach(funcion => {

        const categorias =
            obtenerCategorias(funcion);

        let categoriasHTML = "";

        categoriasHTML += crearHTMLCategoria(
            "General",
            "🎫",
            categorias.general
        );

        if(categorias.preferente?.activa){
            categoriasHTML += crearHTMLCategoria(
                "Preferente",
                "🎟️",
                categorias.preferente
            );
        }

        if(categorias.vip?.activa){
            categoriasHTML += crearHTMLCategoria(
                "VIP",
                "⭐",
                categorias.vip
            );
        }

        funcionesHTML += `
            <div class="funcion">

                <div class="funcion-grid">
                    <div class="funcion-item">
                        <span class="funcion-label">Fecha</span>
                        📅 ${escaparTexto(funcion.fecha)}
                    </div>

                    <div class="funcion-item">
                        <span class="funcion-label">Hora</span>
                        ⏰ ${escaparTexto(funcion.hora)}
                    </div>
                </div>

                ${esBoletaje ? `
                <div class="categorias-grid">
                    ${categoriasHTML}
                </div>
                ` : ""}

                <p class="${funcion.activa ? "status-ok" : "status-off"}">
                    ${funcion.activa
                        ? (esBoletaje ? "🟢 Función activa" : "🟢 Activo")
                        : (esBoletaje ? "🔴 Función inactiva" : "🔴 Inactivo")}
                </p>

                <div class="funcion-acciones-premium">

                    <button
                        class="btn-secundario"
                        title="Editar"
                        onclick="abrirEditarFuncion(${evento.id}, ${funcion.id})">
                        ✏️ Editar
                    </button>

                    ${esBoletaje ? `
                    <button
                        class="btn-secundario"
                        title="Caja / venta de boletos"
                        onclick="abrirCaja(${evento.id}, ${funcion.id})">
                        💵 Caja
                    </button>

                    <button
                        class="btn-secundario btn-descuentos-funcion"
                        title="Administrar descuentos"
                        onclick="abrirGestionDescuentos(${evento.id}, ${funcion.id})">
                        🎁 Descuentos
                    </button>
                    ` : ""}

                    <button
                        class="btn-secundario"
                        title="${funcion.activa ? "Desactivar" : "Activar"}"
                        onclick="toggleFuncion(${evento.id}, ${funcion.id})">
                        ${funcion.activa ? "⏸️ Pausar" : "▶️ Activar"}
                    </button>

                    <button
                        class="btn-danger"
                        title="Eliminar"
                        onclick="eliminarFuncion(${evento.id}, ${funcion.id})">
                        🗑️ Eliminar
                    </button>

                </div>
            </div>
        `;
    });

    return funcionesHTML || `
        <div class="empty-state">
            ${esBoletaje
                ? "Este evento todavía no tiene funciones."
                : "Aún no hay fechas agregadas."}
        </div>
    `;
}


/* ============================================================
   ACCIONES CRUD EVENTO
============================================================ */
async function cambiarEstadoEvento(id){

    const respuesta =
        await fetch(
            `${API_URL}/api/eventos/${id}/toggle`,
            {
                method: "PATCH"
            }
        );

    const resultado =
        await respuesta.json();

    mostrarToast(resultado.mensaje, "success");

    cargarEventos();
}


async function eliminarEvento(id){

    abrirConfirmacion(
        "Eliminar evento",
        "¿Seguro que quieres eliminar este evento y todas sus funciones?",
        async function(){

            const respuesta =
                await fetch(
                    `${API_URL}/api/eventos/${id}`,
                    {
                        method:"DELETE"
                    }
                );

            const resultado =
                await respuesta.json();

            mostrarToast(resultado.mensaje, "success");

            cargarEventos();
        }
    );
}


/* ============================================================
   HELPERS EVENTOS
============================================================ */
function calcularBoletosEvento(evento){

    return evento.funciones.reduce((total, funcion) => {
        return total + calcularBoletosFuncion(funcion);
    }, 0);
}


function calcularDescuentosEvento(evento){

    return evento.funciones.reduce((total, funcion) => {
        return total + Number((funcion.descuentos || []).length);
    }, 0);
}


function obtenerProximaFuncionEvento(evento){

    const funciones =
        evento.funciones
            .filter(funcion => funcion.activa !== false)
            .sort((a, b) => {
                return new Date(`${a.fecha}T${a.hora || "00:00"}`) -
                       new Date(`${b.fecha}T${b.hora || "00:00"}`);
            });

    return funciones[0] || null;
}


function formatearFechaEvento(fechaISO){

    if(!fechaISO){
        return "Sin fecha";
    }

    const fecha =
        new Date(`${fechaISO}T00:00:00`);

    return fecha.toLocaleDateString("es-MX", {
        day:"2-digit",
        month:"short",
        year:"numeric"
    });
}


function actualizarTextoSeguro(id, valor){

    const elemento =
        document.getElementById(id);

    if(elemento){
        elemento.textContent = valor;
    }
}