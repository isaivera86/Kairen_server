/* ============================================================

   ALPHA v1.4: MOTOR DE REGISTROS

   RESPONSABILIDAD:
   - Centralizar tipos operativos.
   - Abrir formulario genérico para todos los tipos no boleteros.
   - Guardar registros en backend usando /api/registros.
   - Mantener Función con el flujo actual de evento/función.
   - Preparar timeline y checklist base.

============================================================ */

const TIPOS_REGISTRO = {
    funcion: {
        icono: "🎭",
        nombre: "Función",
        clase: "tipo-funcion",
        descripcion: "Obra o presentación abierta al público."
    },
    activacion: {
        icono: "📍",
        nombre: "Activación",
        clase: "tipo-activacion",
        descripcion: "Marca, plaza o evento promocional."
    },
    clase: {
        icono: "🎓",
        nombre: "Clase",
        clase: "tipo-clase",
        descripcion: "Taller, curso, masterclass o capacitación."
    },
    ensayo: {
        icono: "🎤",
        nombre: "Ensayo",
        clase: "tipo-ensayo",
        descripcion: "Preparación artística o técnica."
    },
    grabacion: {
        icono: "🎬",
        nombre: "Grabación",
        clase: "tipo-grabacion",
        descripcion: "Video, streaming, contenido o sesión."
    },
    especial: {
        icono: "🎪",
        nombre: "Evento especial",
        clase: "tipo-especial",
        descripcion: "Actividad única o evento no recurrente."
    },
    traslado: {
        icono: "🚚",
        nombre: "Traslado",
        clase: "tipo-traslado",
        descripcion: "Equipo, staff, utilería o logística."
    },
    mantenimiento: {
        icono: "🛠️",
        nombre: "Mantenimiento",
        clase: "tipo-mantenimiento",
        descripcion: "Reparaciones o revisión técnica."
    }
};

// ALPHA v1.14: catálogo editable cargado desde el backend.
// Si no carga (backend viejo / offline), infoTipo cae a TIPOS_REGISTRO.
let CATALOGO_TIPOS = {};

async function cargarCatalogoTipos(){
    try{
        const respuesta = await fetch(`${API_URL}/api/tipos-registro`);
        const resultado = await respuesta.json();
        CATALOGO_TIPOS = (resultado && resultado.tipos) ? resultado.tipos : {};
    }catch(error){
        CATALOGO_TIPOS = {};
    }
}

// Resuelve la info visual de un tipo: catálogo -> defaults -> activación.
function infoTipo(tipo){
    return CATALOGO_TIPOS[tipo] || CATALOGO_TIPOS[tipo] || TIPOS_REGISTRO[tipo] || TIPOS_REGISTRO.activacion;
}


function abrirSelectorNuevoRegistro(){

    renderSelectorTipos();

    document.body.classList.add("modal-abierto");

    document
        .getElementById("modalNuevoRegistro")
        .classList
        .remove("oculto");
}

function cerrarSelectorNuevoRegistro(){

    const modal =
        document.getElementById("modalNuevoRegistro");

    if(modal){
        modal.classList.add("oculto");
    }

    document.body.classList.remove("modal-abierto");
}

// Alias para mantener compatibilidad con botones existentes.
function cerrarModalNuevoRegistro(){ cerrarSelectorNuevoRegistro(); }

function seleccionarTipoRegistro(tipo){

    if(tipo === "funcion"){

        document
            .getElementById("modalNuevoRegistro")
            .classList
            .add("oculto");

        mostrarSeccion("eventos");
        abrirModalNuevoEvento();
        return;
    }

    document
        .getElementById("modalNuevoRegistro")
        .classList
        .add("oculto");

    abrirModalRegistroGenerico(tipo);
}

// ALPHA v1.8: guarda la operación en edición ({eventoId, funcionId}) o null en modo crear.
let REGISTRO_EDICION = null;

// Abre el modal genérico en modo EDICIÓN, precargando los datos.
// origen: "drawer" (default) o "hoy" -> define cómo refrescar al guardar.
function abrirEditarOperacion(eventoId, funcionId, origen){

    if(typeof eventosActuales === "undefined" || !Array.isArray(eventosActuales)){
        return;
    }

    const evento =
        eventosActuales.find(item => Number(item.id) === Number(eventoId));

    const funcion =
        evento?.funciones?.find(item => Number(item.id) === Number(funcionId));

    if(!evento || !funcion){
        mostrarToast("No se encontró la operación", "error");
        return;
    }

    const tipo =
        funcion.tipoRegistro || evento.tipoRegistro || "activacion";

    const info =
        CATALOGO_TIPOS[tipo] || TIPOS_REGISTRO[tipo] || TIPOS_REGISTRO.activacion;

    limpiarFormularioRegistroGenerico();

    // Modo EDICIÓN.
    REGISTRO_EDICION = {
        eventoId: Number(eventoId),
        funcionId: Number(funcionId),
        origen: origen || "drawer"
    };

    document.getElementById("registroGenericoTipo").value = tipo;
    document.getElementById("registroGenericoIcono").textContent = info.icono;
    document.getElementById("registroGenericoTitulo").textContent = `Editar · ${info.nombre}`;
    document.getElementById("registroGenericoDescripcion").textContent = "Edita los datos de esta operación.";
    document.getElementById("registroGenericoPreviewIcono").textContent = info.icono;
    document.getElementById("registroGenericoPreviewTitulo").textContent = `${info.nombre} operativo`;

    // Precargar datos existentes.
    document.getElementById("registroGenericoNombre").value = evento.nombre || "";
    document.getElementById("registroGenericoLugar").value = evento.lugar || "";
    document.getElementById("registroGenericoFecha").value = funcion.fecha || "";
    document.getElementById("registroGenericoHora").value = funcion.hora || "";
    document.getElementById("registroGenericoContacto").value = funcion.contacto || "";
    document.getElementById("registroGenericoTelefono").value = funcion.telefono || "";
    document.getElementById("registroGenericoNotas").value = funcion.notas || "";

    cargarRecurrenciaFormulario(funcion.recurrencia);

    const btnGuardar =
        document.getElementById("btnGuardarRegistroGenerico");

    if(btnGuardar){ btnGuardar.textContent = "Guardar cambios"; }

    document.body.classList.add("modal-abierto");

    document
        .getElementById("modalRegistroGenerico")
        .classList
        .remove("oculto");
}

function abrirModalRegistroGenerico(tipo){

    const info =
        CATALOGO_TIPOS[tipo] || TIPOS_REGISTRO[tipo] || TIPOS_REGISTRO.activacion;

    limpiarFormularioRegistroGenerico();

    // Modo CREAR: limpiamos cualquier edición previa y restauramos el botón.
    REGISTRO_EDICION = null;

    const btnGuardar =
        document.getElementById("btnGuardarRegistroGenerico");

    if(btnGuardar){ btnGuardar.textContent = "Guardar registro"; }

    document.getElementById("registroGenericoTipo").value =
        tipo;

    document.getElementById("registroGenericoIcono").textContent =
        info.icono;

    document.getElementById("registroGenericoTitulo").textContent =
        `Nuevo registro · ${info.nombre}`;

    document.getElementById("registroGenericoDescripcion").textContent =
        info.descripcion;

    document.getElementById("registroGenericoPreviewIcono").textContent =
        info.icono;

    document.getElementById("registroGenericoPreviewTitulo").textContent =
        `${info.nombre} operativo`;

    document.body.classList.add("modal-abierto");

    document
        .getElementById("modalRegistroGenerico")
        .classList
        .remove("oculto");
}

function cerrarModalRegistroGenerico(){

    REGISTRO_EDICION = null;

    document
        .getElementById("modalRegistroGenerico")
        .classList
        .add("oculto");

    document.body.classList.remove("modal-abierto");
}

function limpiarFormularioRegistroGenerico(){

    [
        "registroGenericoTipo",
        "registroGenericoNombre",
        "registroGenericoLugar",
        "registroGenericoFecha",
        "registroGenericoHora",
        "registroGenericoContacto",
        "registroGenericoTelefono",
        "registroGenericoNotas"
    ].forEach(id => {
        const campo =
            document.getElementById(id);

        if(campo){
            campo.value = "";
        }
    });

    resetRecurrenciaFormulario();
}


/* ============================================================
   SPRINT RECURRENCIA: helpers de la UI de repetición.
   Solo aplica a operaciones (Función/boletaje no la usa).
============================================================ */

function togglePanelRecurrencia(){
    const tipo =
        document.getElementById("registroGenericoRepeticion")?.value || "no";

    const panel =
        document.getElementById("recPanelPersonalizado");

    if(panel){
        panel.classList.toggle("oculto", tipo !== "personalizado");
    }

    const finTipo =
        document.querySelector('input[name="recFin"]:checked')?.value || "nunca";

    const finFecha = document.getElementById("recFinFecha");
    const finConteo = document.getElementById("recFinConteo");

    if(finFecha){ finFecha.disabled = (finTipo !== "fecha"); }
    if(finConteo){ finConteo.disabled = (finTipo !== "conteo"); }
}

function leerRecurrenciaFormulario(){
    const tipo =
        document.getElementById("registroGenericoRepeticion")?.value || "no";

    if(tipo === "no"){ return null; }

    if(tipo === "semanal"){
        return { tipo: "semanal", intervalo: 1, dias: [], fin: { tipo: "nunca" } };
    }

    if(tipo === "mensual"){
        return { tipo: "mensual", intervalo: 1, fin: { tipo: "nunca" } };
    }

    // Personalizado: cada N semanas, en los días marcados, con fin opcional.
    const intervalo =
        Math.max(1, Number(document.getElementById("recIntervalo")?.value) || 1);

    const dias = [];
    document.querySelectorAll(".rec-dia-chk:checked").forEach(chk => {
        dias.push(Number(chk.value));
    });

    const finTipo =
        document.querySelector('input[name="recFin"]:checked')?.value || "nunca";

    const fin = { tipo: finTipo };

    if(finTipo === "fecha"){
        fin.fecha = document.getElementById("recFinFecha")?.value || null;
    }
    if(finTipo === "conteo"){
        fin.conteo = Math.max(1, Number(document.getElementById("recFinConteo")?.value) || 1);
    }

    return { tipo: "personalizado", intervalo, dias, fin };
}

function resetRecurrenciaFormulario(){
    const sel = document.getElementById("registroGenericoRepeticion");
    if(sel){ sel.value = "no"; }

    const intervalo = document.getElementById("recIntervalo");
    if(intervalo){ intervalo.value = "1"; }

    document.querySelectorAll(".rec-dia-chk").forEach(chk => { chk.checked = false; });

    const finNunca = document.querySelector('input[name="recFin"][value="nunca"]');
    if(finNunca){ finNunca.checked = true; }

    const finFecha = document.getElementById("recFinFecha");
    if(finFecha){ finFecha.value = ""; }

    const finConteo = document.getElementById("recFinConteo");
    if(finConteo){ finConteo.value = "10"; }

    togglePanelRecurrencia();
}

function cargarRecurrenciaFormulario(recurrencia){
    resetRecurrenciaFormulario();

    if(!recurrencia || !recurrencia.tipo || recurrencia.tipo === "no"){
        return;
    }

    const sel = document.getElementById("registroGenericoRepeticion");

    if(recurrencia.tipo === "semanal" || recurrencia.tipo === "mensual"){
        if(sel){ sel.value = recurrencia.tipo; }
        togglePanelRecurrencia();
        return;
    }

    if(sel){ sel.value = "personalizado"; }

    const intervalo = document.getElementById("recIntervalo");
    if(intervalo){ intervalo.value = String(recurrencia.intervalo || 1); }

    (recurrencia.dias || []).forEach(d => {
        const chk = document.querySelector(`.rec-dia-chk[value="${d}"]`);
        if(chk){ chk.checked = true; }
    });

    const fin = recurrencia.fin || { tipo: "nunca" };
    const radio = document.querySelector(`input[name="recFin"][value="${fin.tipo}"]`);
    if(radio){ radio.checked = true; }

    if(fin.tipo === "fecha"){
        const f = document.getElementById("recFinFecha");
        if(f){ f.value = fin.fecha || ""; }
    }
    if(fin.tipo === "conteo"){
        const c = document.getElementById("recFinConteo");
        if(c){ c.value = String(fin.conteo || 10); }
    }

    togglePanelRecurrencia();
}

async function guardarRegistroGenerico(){

    const tipo =
        document.getElementById("registroGenericoTipo").value;

    const nombre =
        document.getElementById("registroGenericoNombre").value.trim();

    const lugar =
        document.getElementById("registroGenericoLugar").value.trim();

    const fecha =
        document.getElementById("registroGenericoFecha").value;

    const hora =
        document.getElementById("registroGenericoHora").value;

    const contacto =
        document.getElementById("registroGenericoContacto").value.trim();

    const telefono =
        document.getElementById("registroGenericoTelefono").value.trim();

    const notas =
        document.getElementById("registroGenericoNotas").value.trim();

    if(!nombre || !lugar || !fecha || !hora){
        mostrarToast("Completa nombre, lugar, fecha y hora", "warning");
        return;
    }

    const recurrencia = leerRecurrenciaFormulario();

    // ALPHA v1.8: modo EDICIÓN -> PUT de datos (no toca checklist/material/estado/etc.).
    if(REGISTRO_EDICION){

        const { eventoId, funcionId, origen } = REGISTRO_EDICION;

        const respuestaEdicion =
            await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/datos`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, lugar, fecha, hora, contacto, telefono, notas, recurrencia })
            });

        const resultadoEdicion =
            await respuestaEdicion.json();

        if(!respuestaEdicion.ok){
            mostrarToast(resultadoEdicion.mensaje || "No se pudo guardar", "error");
            return;
        }

        REGISTRO_EDICION = null;

        cerrarModalRegistroGenerico();

        mostrarToast(resultadoEdicion.mensaje || "Operación actualizada", "success");

        await cargarEventos();

        // Actualizar Vista Hoy (barato; mantiene la vista al día sin recargar la app).
        if(typeof renderVistaHoy === "function"){ renderVistaHoy(); }

        // Drawer: reabrir si venimos de él, o refrescarlo si está abierto.
        const modalDrawer =
            document.getElementById("modalAgendaDia");

        const drawerAbierto =
            modalDrawer && !modalDrawer.classList.contains("oculto");

        if(typeof abrirAgendaDia === "function" && fecha && (origen === "drawer" || drawerAbierto)){
            abrirAgendaDia(fecha, eventoId, funcionId);
        }

        return;
    }

    const resumenOff = `${tipo}: ${nombre}`;
    const envio =
        await crearConCola(`${API_URL}/api/registros`, {
            tipoRegistro: tipo,
            nombre,
            lugar,
            fecha,
            hora,
            contacto,
            telefono,
            notas,
            recurrencia
        }, resumenOff);

    // Guardado sin conexión: se subirá al reconectar
    if(!envio.online){
        mostrarToast("Guardado sin conexión ⏳ (se subirá al reconectar)", "success");
        cerrarModalRegistroGenerico();
        return;
    }

    const resultado = envio.data || {};

    cerrarModalRegistroGenerico();

    mostrarToast(resultado.mensaje || "Registro guardado", "success");

    cargarEventos();

    mostrarSeccion("funciones");
}

function obtenerTipoRegistroVisual(funcion){

    const tipo =
        funcion.tipoRegistro || "funcion";

    return CATALOGO_TIPOS[tipo] || TIPOS_REGISTRO[tipo] || TIPOS_REGISTRO.funcion;
}

/* ============================================================
   ALPHA v1.4.1: CONFIGURACION DE DRAWER POR TIPO

   Nota:
   - No cambia la forma en que Función guarda boletaje.
   - Solo centraliza cómo se muestran los registros operativos.
============================================================ */

const DRAWER_REGISTRO_CONFIG = {
    activacion: {
        titulo: "Detalle de activación",
        campos: [
            { icono: "👤", etiqueta: "Contacto", key: "contacto" },
            { icono: "📱", etiqueta: "Teléfono", key: "telefono" },
            { icono: "📝", etiqueta: "Notas", key: "notas" }
        ],
        checklistTitulo: "Checklist de activación"
    },

    clase: {
        titulo: "Detalle de clase",
        campos: [
            { icono: "👤", etiqueta: "Contacto", key: "contacto" },
            { icono: "📍", etiqueta: "Sede", key: "lugarEvento" },
            { icono: "📝", etiqueta: "Notas", key: "notas" }
        ],
        checklistTitulo: "Checklist de clase"
    },

    ensayo: {
        titulo: "Detalle de ensayo",
        campos: [
            { icono: "👤", etiqueta: "Responsable", key: "contacto" },
            { icono: "📍", etiqueta: "Lugar", key: "lugarEvento" },
            { icono: "📝", etiqueta: "Notas", key: "notas" }
        ],
        checklistTitulo: "Checklist de ensayo"
    },

    grabacion: {
        titulo: "Detalle de grabación",
        campos: [
            { icono: "👤", etiqueta: "Contacto", key: "contacto" },
            { icono: "📱", etiqueta: "Teléfono", key: "telefono" },
            { icono: "📝", etiqueta: "Notas", key: "notas" }
        ],
        checklistTitulo: "Checklist de grabación"
    },

    especial: {
        titulo: "Detalle de evento especial",
        campos: [
            { icono: "👤", etiqueta: "Contacto", key: "contacto" },
            { icono: "📍", etiqueta: "Lugar", key: "lugarEvento" },
            { icono: "📝", etiqueta: "Notas", key: "notas" }
        ],
        checklistTitulo: "Checklist de evento especial"
    },

    traslado: {
        titulo: "Detalle de traslado",
        campos: [
            { icono: "👤", etiqueta: "Responsable", key: "contacto" },
            { icono: "📱", etiqueta: "Teléfono", key: "telefono" },
            { icono: "📝", etiqueta: "Notas", key: "notas" }
        ],
        checklistTitulo: "Checklist de traslado"
    },

    mantenimiento: {
        titulo: "Detalle de mantenimiento",
        campos: [
            { icono: "👤", etiqueta: "Responsable", key: "contacto" },
            { icono: "📱", etiqueta: "Teléfono", key: "telefono" },
            { icono: "📝", etiqueta: "Notas", key: "notas" }
        ],
        checklistTitulo: "Checklist de mantenimiento"
    }
};

function obtenerValorRegistroDrawer(evento, funcion, key){

    if(key === "lugarEvento"){
        return evento?.lugar || "";
    }

    return funcion?.[key] || evento?.[key] || "";
}

function crearFilaDetalleRegistro(icono, etiqueta, valor){

    if(!valor){
        return "";
    }

    return `
        <div class="agenda-categoria-mini agenda-detalle-row">
            <span>${icono} ${escaparTexto(etiqueta)}</span>
            <strong>${escaparTexto(valor)}</strong>
        </div>
    `;
}

function crearChecklistRegistroAgenda(evento, funcion, tipoRegistro){

    const config = DRAWER_REGISTRO_CONFIG[tipoRegistro];
    const checklist = funcion?.checklist || evento?.checklist || [];
    const titulo = "✅ Checklist (tareas)";

    const items = Array.isArray(checklist) && checklist.length > 0
        ? checklist.map((item, index) => {
            const texto = typeof item === "string" ? item : item.texto || item.nombre || "";
            const itemId = Number(item.id || index + 1);
            const completado = Boolean(item.completado);

            return `
                <div class="agenda-checklist-editable-item ${completado ? "completado" : ""}">
                    <button class="agenda-checklist-toggle" onclick="toggleChecklistRegistroAgenda(${evento.id}, ${funcion.id}, ${itemId}, this)" title="Marcar / desmarcar">
                        ${completado ? "☑" : "☐"}
                    </button>

                    <strong>${escaparTexto(texto)}</strong>

                    <button class="agenda-checklist-action" onclick="editarItemChecklistRegistro(${evento.id}, ${funcion.id}, ${itemId}, '${escaparTexto(texto)}')" title="Editar">
                        ✏️
                    </button>

                    <button class="agenda-checklist-action danger" onclick="eliminarItemChecklistRegistro(${evento.id}, ${funcion.id}, ${itemId})" title="Eliminar">
                        🗑️
                    </button>
                </div>
            `;
        }).join("")
        : `<div class="agenda-checklist-empty">Agrega tareas por hacer para esta operación.</div>`;

    return `
        <div class="agenda-drawer-bloque">
            <h4>${escaparTexto(titulo)}</h4>

            <div class="agenda-checklist-add">
                <input id="nuevoChecklistTexto-${evento.id}-${funcion.id}" placeholder="Ej. Confirmar lugar, llamar al cliente, imprimir guía...">
                <button onclick="agregarItemChecklistRegistro(${evento.id}, ${funcion.id})">+ Agregar</button>
            </div>

            <div class="agenda-checklist-lista">
                ${items}
            </div>
        </div>
    `;
}
function crearTimelineRegistroAgenda(evento, funcion){

    const timeline =
        funcion?.timeline || evento?.timeline || [];

    if(!Array.isArray(timeline) || timeline.length === 0){
        return "";
    }

    const ultimo =
        timeline[timeline.length - 1];

    const mensaje =
        ultimo.mensaje || "Registro actualizado";

    return `
        <div class="agenda-timeline-mini">
            <span>🕓 Último movimiento</span>
            <strong>${escaparTexto(mensaje)}</strong>
        </div>
    `;
}

function crearDetalleOperativoAgenda(evento, funcion){

    const tipoRegistro =
        funcion?.tipoRegistro || evento?.tipoRegistro || "activacion";

    const tipoVisual =
        CATALOGO_TIPOS[tipoRegistro] || TIPOS_REGISTRO[tipoRegistro] || TIPOS_REGISTRO.activacion;

    const config =
        DRAWER_REGISTRO_CONFIG[tipoRegistro] || DRAWER_REGISTRO_CONFIG.activacion;

    let html = `
        <div class="agenda-drawer-bloque">
            <h4>${escaparTexto(config.titulo)}</h4>

            <div class="agenda-categoria-mini agenda-detalle-row">
                <span>${tipoVisual.icono} Tipo</span>
                <strong>${escaparTexto(tipoVisual.nombre)}</strong>
            </div>
        </div>
    `;

    const campos =
        config.campos || [];

    const filas =
        campos.map(campo => {
            const valor =
                obtenerValorRegistroDrawer(evento, funcion, campo.key);

            return crearFilaDetalleRegistro(
                campo.icono,
                campo.etiqueta,
                valor
            );
        }).join("");

    if(filas){
        html += `
            <div class="agenda-drawer-bloque">
                <h4>Información</h4>
                ${filas}
            </div>
        `;
    }

    html += crearChecklistRegistroAgenda(
        evento,
        funcion,
        tipoRegistro
    );

    html += crearMaterialRegistroAgenda(
        evento,
        funcion
    );

    html += crearDocumentosRegistroAgenda(
        evento,
        funcion
    );

    html += crearPersonasRegistroAgenda(
        evento,
        funcion
    );

    html += crearTimelineRegistroAgenda(
        evento,
        funcion
    );

    return html;
}

/* ============================================================
   ALPHA v1.4.2: TOGGLE DE CHECKLIST (puente front <-> backend)

   Faltaba esta función: el botón del checklist la llamaba pero
   no estaba definida. Hace el PATCH al endpoint y actualiza el
   ítem en el momento (sin recargar el drawer ni perder scroll).
============================================================ */

async function toggleChecklistRegistroAgenda(eventoId, funcionId, itemId, boton){

    try{

        const respuesta =
            await fetch(
                `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/checklist/${itemId}/toggle`,
                { method: "PATCH" }
            );

        if(!respuesta.ok){
            mostrarToast("No se pudo actualizar el checklist.", "error");
            return;
        }

        // Actualización optimista, acorde a la estructura v1.4.3:
        // el ícono ☐/☑ es el texto del propio botón y la clase
        // .completado vive en el contenedor del ítem (el padre).
        if(boton){

            const item =
                boton.closest(".agenda-checklist-editable-item");

            const completado =
                item
                    ? !item.classList.contains("completado")
                    : true;

            if(item){
                item.classList.toggle("completado", completado);
            }

            boton.textContent = completado ? "☑" : "☐";
        }

        // Refrescamos los datos en segundo plano para que el
        // estado y el timeline queden correctos al reabrir.
        await cargarEventos();

    }catch(error){
        mostrarToast("Error de conexión al actualizar el checklist.", "error");
    }
}

/* ============================================================
   ALPHA v1.4.3: CHECKLIST EDITABLE POR USUARIO
============================================================ */

async function agregarItemChecklistRegistro(eventoId, funcionId){
    const input = document.getElementById(`nuevoChecklistTexto-${eventoId}-${funcionId}`);
    const texto = input?.value?.trim();

    if(!texto){
        mostrarToast("Escribe el pendiente", "warning");
        return;
    }

    const respuesta = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto })
    });

    const resultado = await respuesta.json();

    if(!respuesta.ok){
        mostrarToast(resultado.mensaje || "No se pudo agregar", "error");
        return;
    }

    mostrarToast(resultado.mensaje || "Pendiente agregado", "success");
    await refrescarDrawerChecklist(eventoId, funcionId);
}

function editarItemChecklistRegistro(eventoId, funcionId, itemId, textoActual){

    abrirPrompt(
        "Editar pendiente",
        textoActual,
        async function(nuevoTexto){

            const respuesta =
                await fetch(
                    `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/checklist/${itemId}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ texto: nuevoTexto })
                    }
                );

            const resultado =
                await respuesta.json();

            if(!respuesta.ok){
                mostrarToast(resultado.mensaje || "No se pudo editar", "error");
                return;
            }

            mostrarToast(resultado.mensaje || "Pendiente actualizado", "success");
            await refrescarDrawerChecklist(eventoId, funcionId);
        }
    );
}

function eliminarItemChecklistRegistro(eventoId, funcionId, itemId){

    abrirConfirmacion(
        "Eliminar pendiente",
        "¿Seguro que quieres eliminar este pendiente?",
        async function(){

            const respuesta =
                await fetch(
                    `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/checklist/${itemId}`,
                    { method: "DELETE" }
                );

            const resultado =
                await respuesta.json();

            if(!respuesta.ok){
                mostrarToast(resultado.mensaje || "No se pudo eliminar", "error");
                return;
            }

            mostrarToast(resultado.mensaje || "Pendiente eliminado", "success");
            await refrescarDrawerChecklist(eventoId, funcionId);
        }
    );
}

async function refrescarDrawerChecklist(eventoId, funcionId){

    await cargarEventos();

    const evento =
        eventosActuales.find(item => Number(item.id) === Number(eventoId));

    const funcion =
        evento?.funciones?.find(item => Number(item.id) === Number(funcionId));

    const contenedor =
        document.getElementById("agendaDrawerFunciones");

    if(!funcion?.fecha || !contenedor){
        return;
    }

    // Repintamos los registros de ese día con datos frescos,
    // directo en el contenedor del drawer (sin reabrir el modal).
    let delDia =
        (typeof agruparFuncionesPorFecha === "function")
            ? (agruparFuncionesPorFecha(eventosActuales)[funcion.fecha] || [])
            : [];

    // Si el drawer está enfocado en UNA operación, mantener solo esa
    // (por evento.id, que es el identificador único real).
    if(typeof AGENDA_DRAWER_CTX === "object" && AGENDA_DRAWER_CTX && AGENDA_DRAWER_CTX.eventoId != null){
        const enfocada = delDia.filter(item =>
            Number(item.evento.id) === Number(AGENDA_DRAWER_CTX.eventoId) &&
            (AGENDA_DRAWER_CTX.funcionId == null || Number(item.funcion.id) === Number(AGENDA_DRAWER_CTX.funcionId))
        );
        if(enfocada.length){
            delDia = enfocada;
        }
    }

    // Recordar qué secciones estaban expandidas (por título) antes de repintar,
    // para no volver a colapsarlas al agregar/editar dentro de ellas.
    const seccionesExpandidas = new Set(
        Array.from(contenedor.querySelectorAll(".agenda-drawer-bloque"))
            .filter(bloque => !bloque.classList.contains("colapsado"))
            .map(bloque => (bloque.querySelector("h4")?.textContent || ""))
    );

    contenedor.innerHTML = "";

    delDia
        .sort((a, b) => String(a.funcion.hora).localeCompare(String(b.funcion.hora)))
        .forEach(item => {
            contenedor.innerHTML +=
                crearFuncionAgendaCard(item.evento, item.funcion);
        });

    // Re-aplicar el estado de expansión que tenía el usuario.
    contenedor.querySelectorAll(".agenda-drawer-bloque").forEach(bloque => {
        const titulo = bloque.querySelector("h4")?.textContent || "";
        if(seccionesExpandidas.has(titulo)){
            bloque.classList.remove("colapsado");
        }
    });
}


/* ============================================================
   ALPHA v1.5: ESTADO DE OPERACIÓN

   - Pendiente / Confirmado: lo guardado, antes del día.
   - En curso: automático cuando llega el día (hoy >= fecha);
     gana sobre Pendiente y Confirmado.
   - Finalizado / Cancelado: terminales, mandan siempre.
   El estado efectivo se calcula aquí al mostrar (no se guarda
   "en curso"); el backend solo guarda lo que el usuario elige.
============================================================ */

const ESTADOS_OPERACION = {
    pendiente:  { valor: "pendiente",  icono: "🟡", nombre: "Pendiente",  clase: "estado-pendiente" },
    confirmado: { valor: "confirmado", icono: "🔵", nombre: "Confirmado", clase: "estado-confirmado" },
    en_curso:   { valor: "en_curso",   icono: "🟢", nombre: "En curso",   clase: "estado-encurso" },
    finalizado: { valor: "finalizado", icono: "⚫", nombre: "Finalizado", clase: "estado-finalizado" },
    cancelado:  { valor: "cancelado",  icono: "🔴", nombre: "Cancelado",  clase: "estado-cancelado" }
};

// Fecha de hoy en formato YYYY-MM-DD (hora local).
function fechaHoyLocal(){
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");
    return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// Estado EFECTIVO (lo que se muestra), combinando lo guardado + la fecha.
function obtenerEstadoVisual(funcion){

    const guardado =
        funcion?.estado || "pendiente";

    // Terminales: mandan siempre, sin importar la fecha.
    if(guardado === "cancelado"){ return ESTADOS_OPERACION.cancelado; }
    if(guardado === "finalizado"){ return ESTADOS_OPERACION.finalizado; }

    // No terminales: al llegar el día pasa a "En curso" automáticamente.
    const fecha = funcion?.fecha;

    if(fecha && fechaHoyLocal() >= fecha){
        return ESTADOS_OPERACION.en_curso;
    }

    // Antes del día: lo guardado (pendiente / confirmado / en_curso si lo forzó).
    return ESTADOS_OPERACION[guardado] || ESTADOS_OPERACION.pendiente;
}

// Selector de 5 estados (resalta el efectivo).
function crearSelectorEstadoRegistro(evento, funcion){

    const actual =
        obtenerEstadoVisual(funcion).valor;

    const pills =
        Object.values(ESTADOS_OPERACION).map(estado => `
            <button
                class="estado-pill ${estado.clase} ${estado.valor === actual ? "estado-activo" : ""}"
                onclick="cambiarEstadoRegistro(${evento.id}, ${funcion.id}, '${estado.valor}')"
                title="${estado.nombre}">
                ${estado.icono} ${estado.nombre}
            </button>
        `).join("");

    return `
        <div class="agenda-drawer-bloque">
            <h4>Estado de operación</h4>
            <div class="estado-selector">
                ${pills}
            </div>
        </div>
    `;
}

// Cambia el estado: guarda, registra timeline y refresca drawer + agenda.
async function cambiarEstadoRegistro(eventoId, funcionId, estado){

    try{

        const respuesta =
            await fetch(
                `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/estado`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estado })
                }
            );

        const resultado =
            await respuesta.json();

        if(!respuesta.ok){
            mostrarToast(resultado.mensaje || "No se pudo cambiar el estado", "error");
            return;
        }

        mostrarToast(resultado.mensaje || "Estado actualizado", "success");

        await refrescarDrawerChecklist(eventoId, funcionId);

    }catch(error){
        mostrarToast("Error de conexión al cambiar el estado", "error");
    }
}


/* ============================================================
   ALPHA v1.6: VISTA HOY

   Vista de solo lectura del día actual. Se pinta bajo demanda
   (mostrarSeccion -> renderVistaHoy) usando eventosActuales ya
   cargado; no toca cargarEventos ni el backend.
============================================================ */

// "YYYY-MM-DD HH:MM" en hora local (para comparar próxima operación).
function ahoraLocal(){
    const d = new Date();
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Tiempo restante hasta una fecha/hora (ej. "en 2h 15m", "en 3d 4h").
function tiempoRestante(fecha, hora){
    try{
        const [a, m, d] = fecha.split("-").map(Number);
        const [hh, mm] = (hora || "00:00").split(":").map(Number);
        const objetivo = new Date(a, m - 1, d, hh || 0, mm || 0);

        let diff = Math.round((objetivo - new Date()) / 60000); // minutos

        if(diff <= 0){ return "Ahora"; }

        const dias = Math.floor(diff / 1440); diff -= dias * 1440;
        const horas = Math.floor(diff / 60);
        const mins = diff % 60;

        if(dias > 0){ return `en ${dias}d ${horas}h`; }
        if(horas > 0){ return `en ${horas}h ${mins}m`; }
        return `en ${mins}m`;
    }catch(error){
        return "";
    }
}

// Fecha legible para el encabezado (ej. "Martes 30 de junio de 2026").
function formatearFechaLarga(fechaISO){
    try{
        const [a, m, d] = fechaISO.split("-").map(Number);
        const fecha = new Date(a, m - 1, d);
        const txt = fecha.toLocaleDateString("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        return txt.charAt(0).toUpperCase() + txt.slice(1);
    }catch(error){
        return fechaISO;
    }
}

function tipoVisualHoy(funcion){
    return (typeof obtenerTipoRegistroVisual === "function")
        ? obtenerTipoRegistroVisual(funcion)
        : { icono: "🎭", nombre: "Función" };
}

// Saludo según la hora.
function saludoHoy(){
    const hora = new Date().getHours();
    if(hora < 12){ return "Buenos días"; }
    if(hora < 19){ return "Buenas tardes"; }
    return "Buenas noches";
}

// Render principal de la Vista Hoy.
function renderVistaHoy(){

    if(typeof eventosActuales === "undefined" || !Array.isArray(eventosActuales)){
        return;
    }

    const hoy = fechaHoyLocal();

    // Todas las operaciones (evento + función).
    const todas = [];

    eventosActuales.forEach(evento => {
        (evento.funciones || []).forEach(funcion => {
            todas.push({ evento, funcion });
        });
    });

    const deHoy =
        todas.filter(operacion => operacion.funcion.fecha === hoy);

    const elFecha = document.getElementById("hoyFecha");
    if(elFecha){ elFecha.textContent = formatearFechaLarga(hoy); }

    const elSaludo = document.getElementById("hoySaludo");
    if(elSaludo){ elSaludo.textContent = saludoHoy(); }

    renderHoyResumen(deHoy);
    renderHoyProxima(todas);
    renderHoyOperaciones(deHoy);
    renderHoyPendientes(deHoy);
}

// Resumen por estado (de las operaciones de hoy).
function renderHoyResumen(lista){

    const el = document.getElementById("hoyResumen");
    if(!el){ return; }

    const conteo = {
        pendiente: 0,
        confirmado: 0,
        en_curso: 0,
        finalizado: 0,
        cancelado: 0
    };

    lista.forEach(operacion => {
        const estado = obtenerEstadoVisual(operacion.funcion).valor;
        if(conteo[estado] !== undefined){ conteo[estado]++; }
    });

    el.innerHTML =
        Object.values(ESTADOS_OPERACION).map(estado => `
            <div class="hoy-resumen-item ${estado.clase}">
                <span class="hoy-resumen-icono">${estado.icono}</span>
                <span class="hoy-resumen-num">${conteo[estado.valor] || 0}</span>
                <span class="hoy-resumen-label">${estado.nombre}</span>
            </div>
        `).join("");
}

// Próxima operación (hoy o futuro, la más cercana que no ha pasado).
function renderHoyProxima(todas){

    const el = document.getElementById("hoyProxima");
    if(!el){ return; }

    const ahora = ahoraLocal();

    const futuras = todas
        .filter(operacion => operacion.funcion.fecha)
        .map(operacion => ({
            evento: operacion.evento,
            funcion: operacion.funcion,
            dt: `${operacion.funcion.fecha} ${operacion.funcion.hora || "00:00"}`
        }))
        .filter(operacion => operacion.dt >= ahora)
        .filter(operacion => {
            const estado = obtenerEstadoVisual(operacion.funcion).valor;
            return estado !== "cancelado" && estado !== "finalizado";
        })
        .sort((a, b) => a.dt.localeCompare(b.dt));

    if(futuras.length === 0){
        el.innerHTML = `<p class="hoy-vacio">No hay próximas operaciones.</p>`;
        return;
    }

    const prox = futuras[0];
    const tipoVisual = tipoVisualHoy(prox.funcion);
    const estado = obtenerEstadoVisual(prox.funcion);
    const hoy = fechaHoyLocal();

    const fechaTexto =
        prox.funcion.fecha === hoy
            ? "Hoy"
            : formatearFechaLarga(prox.funcion.fecha);

    el.innerHTML = `
        <div class="hoy-proxima-card hoy-clickable" onclick="abrirAgendaDia('${prox.funcion.fecha}', ${prox.evento.id}, ${prox.funcion.id})">
            <div class="hoy-proxima-hora">⏰ ${escaparTexto(prox.funcion.hora || "--:--")}</div>
            <div class="hoy-proxima-info">
                <h4>${tipoVisual.icono} ${escaparTexto(prox.evento.nombre)}</h4>
                <p>📍 ${escaparTexto(prox.evento.lugar || "")}</p>
                <p class="hoy-proxima-fecha">📅 ${escaparTexto(fechaTexto)}</p>
                <p class="hoy-proxima-restante">⏳ ${escaparTexto(tiempoRestante(prox.funcion.fecha, prox.funcion.hora))}</p>
                <span class="estado-badge ${estado.clase}">${estado.icono} ${estado.nombre}</span>
            </div>
        </div>
    `;
}

// Operaciones de hoy, ordenadas por hora.
function renderHoyOperaciones(lista){

    const el = document.getElementById("hoyOperaciones");
    if(!el){ return; }

    if(lista.length === 0){
        el.innerHTML = `<p class="hoy-vacio">No hay operaciones para hoy.</p>`;
        return;
    }

    const ordenadas =
        [...lista].sort((a, b) =>
            String(a.funcion.hora).localeCompare(String(b.funcion.hora))
        );

    el.innerHTML = ordenadas.map(operacion => {
        const evento = operacion.evento;
        const funcion = operacion.funcion;
        const tipoVisual = tipoVisualHoy(funcion);
        const estado = obtenerEstadoVisual(funcion);

        const checklist = Array.isArray(funcion.checklist) ? funcion.checklist : [];
        const material = Array.isArray(funcion.material) ? funcion.material : [];
        const documentos = Array.isArray(funcion.documentos) ? funcion.documentos : [];
        const personas = Array.isArray(funcion.personas) ? funcion.personas : [];
        const chkDone = checklist.filter(item => item.completado).length;
        const matDone = material.filter(item => item.listo).length;

        return `
            <div class="hoy-op-card">
                <div class="hoy-op-card-top">
                    <span class="hoy-op-hora">⏰ ${escaparTexto(funcion.hora || "--:--")}</span>
                    <span class="estado-badge ${estado.clase}">${estado.icono} ${estado.nombre}</span>
                </div>

                <h4 class="hoy-op-card-nombre">${tipoVisual.icono} ${escaparTexto(evento.nombre)}</h4>
                <p class="hoy-op-card-lugar">📍 ${escaparTexto(evento.lugar || "Sin lugar")}</p>

                <div class="hoy-op-indicadores">
                    <span class="hoy-indicador">✅ Tareas ${chkDone}/${checklist.length}</span>
                    <span class="hoy-indicador">🧰 Material ${matDone}/${material.length}</span>
                    ${documentos.length ? `<span class="hoy-indicador">📎 ${documentos.length}</span>` : ""}
                    ${personas.length ? `<span class="hoy-indicador">👥 ${personas.length}</span>` : ""}
                </div>

                <div class="hoy-op-acciones">
                    <button class="btn-secundario" onclick="abrirEditarOperacion(${evento.id}, ${funcion.id}, 'hoy')">✏️ Editar</button>
                    <button class="btn-secundario" onclick="abrirAgendaDia('${funcion.fecha}', ${evento.id}, ${funcion.id})">📂 Abrir</button>
                </div>
            </div>
        `;
    }).join("");
}

// Pendientes (checklist no completado) de hoy, agrupados por operación.
function renderHoyPendientes(lista){

    const el = document.getElementById("hoyPendientes");
    if(!el){ return; }

    const conPendientes = lista
        .map(operacion => ({
            evento: operacion.evento,
            funcion: operacion.funcion,
            pendientes: (operacion.funcion.checklist || []).filter(item => !item.completado)
        }))
        .filter(operacion => operacion.pendientes.length > 0);

    if(conPendientes.length === 0){
        el.innerHTML = `<p class="hoy-vacio">Sin pendientes para hoy. 🎉</p>`;
        return;
    }

    el.innerHTML = conPendientes.map(operacion => {
        const tipoVisual = tipoVisualHoy(operacion.funcion);
        const items = operacion.pendientes
            .map(item => `<li>☐ ${escaparTexto(item.texto)}</li>`)
            .join("");
        return `
            <div class="hoy-pend-grupo">
                <h4>${tipoVisual.icono} ${escaparTexto(operacion.evento.nombre)}</h4>
                <ul class="hoy-pend-lista">${items}</ul>
            </div>
        `;
    }).join("");
}


/* ============================================================
   ALPHA v1.7: MATERIAL POR OPERACIÓN

   Material = cosas que llevar/preparar (distinto del checklist).
   Espejo del checklist, con item { id, nombre, listo }.
   Refresca con refrescarDrawerChecklist (re-pinta todo el día).
============================================================ */

function crearMaterialRegistroAgenda(evento, funcion){

    const material = funcion?.material || [];

    const items = Array.isArray(material) && material.length > 0
        ? material.map((item, index) => {
            const nombre = typeof item === "string" ? item : item.nombre || "";
            const itemId = Number(item.id || index + 1);
            const listo = Boolean(item.listo);

            return `
                <div class="agenda-material-item ${listo ? "listo" : ""}">
                    <button class="agenda-material-toggle" onclick="toggleMaterialRegistroAgenda(${evento.id}, ${funcion.id}, ${itemId}, this)" title="Marcar listo">
                        ${listo ? "☑" : "☐"}
                    </button>

                    <strong>${escaparTexto(nombre)}</strong>

                    <button class="agenda-material-action" onclick="editarItemMaterialRegistro(${evento.id}, ${funcion.id}, ${itemId}, '${escaparTexto(nombre)}')" title="Editar">
                        ✏️
                    </button>

                    <button class="agenda-material-action danger" onclick="eliminarItemMaterialRegistro(${evento.id}, ${funcion.id}, ${itemId})" title="Eliminar">
                        🗑️
                    </button>
                </div>
            `;
        }).join("")
        : `<div class="agenda-material-empty">Agrega el material que debes llevar o preparar.</div>`;

    return `
        <div class="agenda-drawer-bloque colapsado">
            <h4>🧰 Material (qué llevar)</h4>

            <div class="agenda-material-add">
                <input id="nuevoMaterialNombre-${evento.id}-${funcion.id}" placeholder="Ej. Cable HDMI, bocina, contrato...">
                <button onclick="agregarItemMaterialRegistro(${evento.id}, ${funcion.id})">+ Agregar material</button>
            </div>

            <div class="agenda-material-lista">
                ${items}
            </div>
        </div>
    `;
}

async function agregarItemMaterialRegistro(eventoId, funcionId){

    const input =
        document.getElementById(`nuevoMaterialNombre-${eventoId}-${funcionId}`);

    const nombre = input?.value?.trim();

    if(!nombre){
        mostrarToast("Escribe el material", "warning");
        return;
    }

    const respuesta =
        await fetch(
            `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/material`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre })
            }
        );

    const resultado = await respuesta.json();

    if(!respuesta.ok){
        mostrarToast(resultado.mensaje || "No se pudo agregar", "error");
        return;
    }

    mostrarToast(resultado.mensaje || "Material agregado", "success");
    await refrescarDrawerChecklist(eventoId, funcionId);
}

async function toggleMaterialRegistroAgenda(eventoId, funcionId, itemId, boton){

    try{

        const respuesta =
            await fetch(
                `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/material/${itemId}/toggle`,
                { method: "PATCH" }
            );

        if(!respuesta.ok){
            mostrarToast("No se pudo actualizar el material.", "error");
            return;
        }

        // Actualización optimista.
        if(boton){
            const item = boton.closest(".agenda-material-item");
            const listo = item ? !item.classList.contains("listo") : true;
            if(item){ item.classList.toggle("listo", listo); }
            boton.textContent = listo ? "☑" : "☐";
        }

        await cargarEventos();

    }catch(error){
        mostrarToast("Error de conexión al actualizar el material.", "error");
    }
}

function editarItemMaterialRegistro(eventoId, funcionId, itemId, nombreActual){

    abrirPrompt(
        "Editar material",
        nombreActual,
        async function(nuevoNombre){

            const respuesta =
                await fetch(
                    `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/material/${itemId}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nombre: nuevoNombre })
                    }
                );

            const resultado = await respuesta.json();

            if(!respuesta.ok){
                mostrarToast(resultado.mensaje || "No se pudo editar", "error");
                return;
            }

            mostrarToast(resultado.mensaje || "Material actualizado", "success");
            await refrescarDrawerChecklist(eventoId, funcionId);
        }
    );
}

function eliminarItemMaterialRegistro(eventoId, funcionId, itemId){

    abrirConfirmacion(
        "Eliminar material",
        "¿Seguro que quieres eliminar este material?",
        async function(){

            const respuesta =
                await fetch(
                    `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/material/${itemId}`,
                    { method: "DELETE" }
                );

            const resultado = await respuesta.json();

            if(!respuesta.ok){
                mostrarToast(resultado.mensaje || "No se pudo eliminar", "error");
                return;
            }

            mostrarToast(resultado.mensaje || "Material eliminado", "success");
            await refrescarDrawerChecklist(eventoId, funcionId);
        }
    );
}


/* ============================================================
   ALPHA v1.11/v1.12: FORMULARIO GENÉRICO (varios campos)

   abrirFormulario(titulo, campos, valores, onGuardar)
   - campos: [{ key, label, placeholder?, type?("text"|"textarea"), inputType?, required? }]
   - valores: objeto con valores iniciales (para editar)
   - onGuardar(valores): callback async con los valores capturados
============================================================ */

let ACCION_FORMULARIO = null;

function abrirFormulario(titulo, campos, valores, onGuardar){

    document.getElementById("formularioTitulo").textContent = titulo;

    const contenedor = document.getElementById("formularioCampos");

    contenedor.innerHTML = campos.map(campo => {
        const val = (valores && valores[campo.key] != null) ? String(valores[campo.key]) : "";

        if(campo.type === "textarea"){
            return `
                <label class="formulario-label">${escaparTexto(campo.label)}
                    <textarea id="form-${campo.key}" placeholder="${escaparTexto(campo.placeholder || "")}">${escaparTexto(val)}</textarea>
                </label>
            `;
        }

        if(campo.type === "upload"){
            return `
                <div class="formulario-label">${escaparTexto(campo.label)}
                    <div class="input-con-upload">
                        <input id="form-${campo.key}" type="text" value="${escaparTexto(val)}" placeholder="${escaparTexto(campo.placeholder || "")}">
                        <label class="input-upload-icono" title="Subir archivo">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2"/></svg>
                            <input type="file" onchange="subirArchivoFormulario('${escaparTexto(campo.key)}', this)" hidden>
                        </label>
                    </div>
                    <span id="fileestado-${campo.key}" class="formulario-file-estado"></span>
                </div>
            `;
        }

        return `
            <label class="formulario-label">${escaparTexto(campo.label)}
                <input id="form-${campo.key}" type="${campo.inputType || "text"}" value="${escaparTexto(val)}" placeholder="${escaparTexto(campo.placeholder || "")}">
            </label>
        `;
    }).join("");

    ACCION_FORMULARIO = { campos, onGuardar };

    document.getElementById("modalFormulario").classList.remove("oculto");

    setTimeout(function(){
        const primero = document.getElementById(`form-${campos[0] && campos[0].key}`);
        if(primero){ primero.focus(); }
    }, 50);
}

function cerrarFormulario(){
    ACCION_FORMULARIO = null;
    document.getElementById("modalFormulario").classList.add("oculto");
}

document.addEventListener("DOMContentLoaded", function(){

    const boton = document.getElementById("btnGuardarFormulario");
    if(!boton){ return; }

    boton.addEventListener("click", async function(){

        if(!ACCION_FORMULARIO){ return; }

        const valores = {};

        ACCION_FORMULARIO.campos.forEach(campo => {
            const el = document.getElementById(`form-${campo.key}`);
            valores[campo.key] = el ? el.value.trim() : "";
        });

        const faltan =
            ACCION_FORMULARIO.campos.filter(c => c.required && !valores[c.key]);

        if(faltan.length){
            mostrarToast(`Completa: ${faltan.map(c => c.label).join(", ")}`, "warning");
            return;
        }

        const callback = ACCION_FORMULARIO.onGuardar;

        cerrarFormulario();

        if(callback){ await callback(valores); }
    });
});


/* ============================================================
   ALPHA v1.11: DOCUMENTOS POR OPERACIÓN
============================================================ */

const CAMPOS_DOCUMENTO = [
    { key: "nombre", label: "Nombre", placeholder: "Ej. Contrato firmado", required: true },
    { key: "tipo", label: "Tipo", placeholder: "Contrato, cotización, logo, INE..." },
    { key: "url", label: "URL o archivo", placeholder: "https://... o sube un archivo", type: "upload", inputType: "url" },
    { key: "notas", label: "Notas", placeholder: "Opcional", type: "textarea" }
];

function crearDocumentosRegistroAgenda(evento, funcion){

    const documentos = Array.isArray(funcion?.documentos) ? funcion.documentos : [];

    const items = documentos.length > 0
        ? documentos.map(doc => {
            const enlace = doc.url
                ? `<a class="agenda-doc-link" href="${escaparTexto(doc.url)}" target="_blank" rel="noopener">🔗 Abrir</a>`
                : "";
            const tipo = doc.tipo ? `<span class="agenda-doc-tipo">${escaparTexto(doc.tipo)}</span>` : "";
            const notas = doc.notas ? `<p class="agenda-doc-notas">${escaparTexto(doc.notas)}</p>` : "";

            return `
                <div class="agenda-doc-item">
                    <div class="agenda-doc-info">
                        <div class="agenda-doc-titulo">📄 <strong>${escaparTexto(doc.nombre)}</strong> ${tipo}</div>
                        ${notas}
                    </div>
                    <div class="agenda-doc-acciones">
                        ${enlace}
                        <button class="agenda-material-action" onclick="editarDocumentoRegistro(${evento.id}, ${funcion.id}, ${Number(doc.id)})" title="Editar">✏️</button>
                        <button class="agenda-material-action danger" onclick="eliminarDocumentoRegistro(${evento.id}, ${funcion.id}, ${Number(doc.id)})" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        }).join("")
        : `<div class="agenda-material-empty">Agrega contratos, cotizaciones, logos o enlaces de esta operación.</div>`;

    return `
        <div class="agenda-drawer-bloque colapsado">
            <h4>📎 Documentos</h4>
            <div class="agenda-material-add">
                <button onclick="agregarDocumentoRegistro(${evento.id}, ${funcion.id})">+ Agregar documento</button>
            </div>
            <div class="agenda-doc-lista">${items}</div>
        </div>
    `;
}

function agregarDocumentoRegistro(eventoId, funcionId){
    abrirFormulario("Nuevo documento", CAMPOS_DOCUMENTO, {}, async function(valores){
        const respuesta = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/documentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(valores)
        });
        const resultado = await respuesta.json();
        if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo guardar", "error"); return; }
        mostrarToast(resultado.mensaje || "Documento agregado", "success");
        await refrescarDrawerChecklist(eventoId, funcionId);
    });
}

function editarDocumentoRegistro(eventoId, funcionId, documentoId){
    const evento = eventosActuales.find(item => Number(item.id) === Number(eventoId));
    const funcion = evento?.funciones?.find(item => Number(item.id) === Number(funcionId));
    const doc = (funcion?.documentos || []).find(d => Number(d.id) === Number(documentoId));
    if(!doc){ mostrarToast("No se encontró el documento", "error"); return; }

    abrirFormulario("Editar documento", CAMPOS_DOCUMENTO, doc, async function(valores){
        const respuesta = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/documentos/${documentoId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(valores)
        });
        const resultado = await respuesta.json();
        if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo editar", "error"); return; }
        mostrarToast(resultado.mensaje || "Documento actualizado", "success");
        await refrescarDrawerChecklist(eventoId, funcionId);
    });
}

function eliminarDocumentoRegistro(eventoId, funcionId, documentoId){
    abrirConfirmacion("Eliminar documento", "¿Seguro que quieres eliminar este documento?", async function(){
        const respuesta = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/documentos/${documentoId}`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo eliminar", "error"); return; }
        mostrarToast(resultado.mensaje || "Documento eliminado", "success");
        await refrescarDrawerChecklist(eventoId, funcionId);
    });
}


/* ============================================================
   ALPHA v1.12: PERSONAS POR OPERACIÓN
============================================================ */

const CAMPOS_PERSONA = [
    { key: "nombre", label: "Nombre", placeholder: "Ej. Omar Vera", required: true },
    { key: "rol", label: "Rol", placeholder: "Cliente, staff, proveedor, chofer..." },
    { key: "telefono", label: "Teléfono", placeholder: "10 dígitos", inputType: "tel" },
    { key: "correo", label: "Correo", placeholder: "correo@ejemplo.com", inputType: "email" },
    { key: "notas", label: "Notas", placeholder: "Opcional", type: "textarea" }
];

function soloDigitos(telefono){
    return String(telefono || "").replace(/\D/g, "");
}

function crearPersonasRegistroAgenda(evento, funcion){

    const personas = Array.isArray(funcion?.personas) ? funcion.personas : [];

    const items = personas.length > 0
        ? personas.map(persona => {
            const rol = persona.rol ? `<span class="agenda-persona-rol">${escaparTexto(persona.rol)}</span>` : "";
            const tel = persona.telefono ? `<div class="agenda-persona-dato">📞 ${escaparTexto(persona.telefono)}</div>` : "";
            const correo = persona.correo ? `<div class="agenda-persona-dato">✉️ ${escaparTexto(persona.correo)}</div>` : "";
            const notas = persona.notas ? `<p class="agenda-doc-notas">${escaparTexto(persona.notas)}</p>` : "";

            const wa = persona.telefono
                ? `<a class="agenda-persona-btn wa" href="https://wa.me/${escaparTexto(soloDigitos(persona.telefono))}" target="_blank" rel="noopener">WhatsApp</a>`
                : "";
            const mail = persona.correo
                ? `<a class="agenda-persona-btn mail" href="mailto:${escaparTexto(persona.correo)}">Email</a>`
                : "";

            return `
                <div class="agenda-persona-item">
                    <div class="agenda-persona-info">
                        <div class="agenda-persona-titulo">👤 <strong>${escaparTexto(persona.nombre)}</strong> ${rol}</div>
                        ${tel}
                        ${correo}
                        ${notas}
                    </div>
                    <div class="agenda-persona-acciones">
                        ${wa}
                        ${mail}
                        <button class="agenda-material-action" onclick="editarPersonaRegistro(${evento.id}, ${funcion.id}, ${Number(persona.id)})" title="Editar">✏️</button>
                        <button class="agenda-material-action danger" onclick="eliminarPersonaRegistro(${evento.id}, ${funcion.id}, ${Number(persona.id)})" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        }).join("")
        : `<div class="agenda-material-empty">Agrega cliente, responsable, staff o proveedores de esta operación.</div>`;

    return `
        <div class="agenda-drawer-bloque colapsado">
            <h4>👥 Personas</h4>
            <div class="agenda-material-add">
                <button onclick="agregarPersonaRegistro(${evento.id}, ${funcion.id})">+ Agregar persona</button>
            </div>
            <div class="agenda-persona-lista">${items}</div>
        </div>
    `;
}

function agregarPersonaRegistro(eventoId, funcionId){
    abrirFormulario("Nueva persona", CAMPOS_PERSONA, {}, async function(valores){
        const respuesta = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/personas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(valores)
        });
        const resultado = await respuesta.json();
        if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo guardar", "error"); return; }
        mostrarToast(resultado.mensaje || "Persona agregada", "success");
        await refrescarDrawerChecklist(eventoId, funcionId);
    });
}

function editarPersonaRegistro(eventoId, funcionId, personaId){
    const evento = eventosActuales.find(item => Number(item.id) === Number(eventoId));
    const funcion = evento?.funciones?.find(item => Number(item.id) === Number(funcionId));
    const persona = (funcion?.personas || []).find(p => Number(p.id) === Number(personaId));
    if(!persona){ mostrarToast("No se encontró la persona", "error"); return; }

    abrirFormulario("Editar persona", CAMPOS_PERSONA, persona, async function(valores){
        const respuesta = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/personas/${personaId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(valores)
        });
        const resultado = await respuesta.json();
        if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo editar", "error"); return; }
        mostrarToast(resultado.mensaje || "Persona actualizada", "success");
        await refrescarDrawerChecklist(eventoId, funcionId);
    });
}

function eliminarPersonaRegistro(eventoId, funcionId, personaId){
    abrirConfirmacion("Eliminar persona", "¿Seguro que quieres eliminar esta persona?", async function(){
        const respuesta = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/personas/${personaId}`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo eliminar", "error"); return; }
        mostrarToast(resultado.mensaje || "Persona eliminada", "success");
        await refrescarDrawerChecklist(eventoId, funcionId);
    });
}

/* ============================================================
   ALPHA v1.14: SELECTOR DE TIPOS DINÁMICO (agregar / eliminar)
============================================================ */

// Pinta los tipos operativos del catálogo en el selector.
function renderSelectorTipos(){

    const cont = document.getElementById("selectorTiposOperacion");
    if(!cont){ return; }

    const slugs = Object.keys(CATALOGO_TIPOS || {});

    if(slugs.length === 0){
        cont.innerHTML = `<p class="registro-vacio">Aún no hay tipos de operación. Agrega el primero con “➕ Agregar tipo”.</p>`;
        return;
    }

    cont.innerHTML = slugs.map(slug => {
        const t = CATALOGO_TIPOS[slug] || {};
        return `
            <div class="registro-opcion-wrap">
                <button class="registro-opcion ${escaparTexto(t.clase || "")}" onclick="seleccionarTipoRegistro('${escaparTexto(slug)}')">
                    <span>${escaparTexto(t.icono || "📌")}</span>
                    <div><strong>${escaparTexto(t.nombre || slug)}</strong><small>${escaparTexto(t.descripcion || "")}</small></div>
                    <b>→</b>
                </button>
                <button class="registro-tipo-eliminar" onclick="eliminarTipoRegistro('${escaparTexto(slug)}')" title="Eliminar tipo">🗑️</button>
            </div>
        `;
    }).join("");
}

// Agregar un nuevo tipo (nombre + emoji + descripción).
function agregarTipoRegistro(){
    abrirFormulario("Nuevo tipo de operación", [
        { key: "nombre", label: "Nombre del tipo", placeholder: "Ej. Junta, Cita, Entrega...", required: true },
        { key: "icono", label: "Emoji (opcional)", placeholder: "📌" },
        { key: "descripcion", label: "Descripción (opcional)", placeholder: "Para qué sirve este tipo", type: "textarea" }
    ], {}, async function(valores){
        const respuesta = await fetch(`${API_URL}/api/tipos-registro`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(valores)
        });
        const resultado = await respuesta.json();
        if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo agregar", "error"); return; }
        mostrarToast(resultado.mensaje || "Tipo agregado", "success");
        await cargarCatalogoTipos();
        renderSelectorTipos();
    });
}

// Eliminar un tipo (los registros que ya lo usan se conservan).
function eliminarTipoRegistro(slug){
    const t = CATALOGO_TIPOS[slug] || {};
    abrirConfirmacion(
        "Eliminar tipo",
        `¿Eliminar el tipo "${t.nombre || slug}"? Los registros que ya lo usan se conservan.`,
        async function(){
            const respuesta = await fetch(`${API_URL}/api/tipos-registro/${encodeURIComponent(slug)}`, { method: "DELETE" });
            const resultado = await respuesta.json();
            if(!respuesta.ok){ mostrarToast(resultado.mensaje || "No se pudo eliminar", "error"); return; }
            mostrarToast(resultado.mensaje || "Tipo eliminado", "success");
            await cargarCatalogoTipos();
            renderSelectorTipos();
        }
    );
}


/* ============================================================
   ALPHA v1.15: SECCIONES COLAPSABLES DEL DRAWER (acordeón)

   Click en el título (h4) de un .agenda-drawer-bloque lo pliega
   o despliega. Delegado en document -> funciona con el contenido
   que se pinta dinámicamente en el drawer.
============================================================ */
document.addEventListener("click", function(ev){
    const h4 = ev.target.closest("h4");
    if(!h4){ return; }
    const bloque = h4.parentElement;
    if(bloque && bloque.classList && bloque.classList.contains("agenda-drawer-bloque")){
        bloque.classList.toggle("colapsado");
    }
});


/* ============================================================
   ALPHA v1.16: SUBIDA DE ARCHIVOS LOCALES (helpers compartidos)
============================================================ */

// Lee un File -> dataURL. Si es imagen y comprimir=true, la reescala
// a máx 1000px y la exporta como JPEG (más ligera).
function archivoADataUrl(file, comprimir){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if(comprimir && file.type && file.type.indexOf("image/") === 0){
                const img = new Image();
                img.onload = () => {
                    const maxW = 1000;
                    const escala = Math.min(1, maxW / img.width);
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(img.width * escala);
                    canvas.height = Math.round(img.height * escala);
                    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.75));
                };
                img.onerror = () => resolve(reader.result);
                img.src = reader.result;
            }else{
                resolve(reader.result);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Sube un dataURL al backend y devuelve la url guardada (/uploads/...).
async function subirDataUrl(dataUrl, nombre){
    const respuesta = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, nombre: nombre || "" })
    });
    const resultado = await respuesta.json();
    if(!respuesta.ok){ throw new Error(resultado.mensaje || "No se pudo subir"); }
    return resultado.url;
}

// Handler para el campo "upload" del formulario genérico (documentos).
async function subirArchivoFormulario(key, input){
    const file = input.files && input.files[0];
    if(!file){ return; }

    const estado = document.getElementById(`fileestado-${key}`);
    const esImagen = file.type && file.type.indexOf("image/") === 0;

    try{
        if(estado){ estado.textContent = "Subiendo..."; }
        const dataUrl = await archivoADataUrl(file, esImagen);
        const url = await subirDataUrl(dataUrl, file.name);
        const target = document.getElementById(`form-${key}`);
        if(target){ target.value = url; }
        if(estado){ estado.textContent = "✅ " + file.name; }
    }catch(error){
        if(estado){ estado.textContent = "❌ " + (error.message || "Error"); }
        mostrarToast(error.message || "No se pudo subir", "error");
    }finally{
        input.value = "";
    }
}

// Handler para subir la imagen de un evento (comprime siempre).
async function subirImagenEvento(input, targetId){
    const file = input.files && input.files[0];
    if(!file){ return; }

    try{
        mostrarToast("Subiendo imagen...", "success");
        const dataUrl = await archivoADataUrl(file, true);
        const url = await subirDataUrl(dataUrl, file.name);

        const target = document.getElementById(targetId);
        if(target){ target.value = url; }

        const preview = document.getElementById(targetId + "Preview");
        if(preview){ preview.src = url; preview.style.display = "block"; }

        mostrarToast("Imagen lista ✅", "success");
    }catch(error){
        mostrarToast(error.message || "No se pudo subir la imagen", "error");
    }finally{
        input.value = "";
    }
}